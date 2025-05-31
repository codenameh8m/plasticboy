const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// МАКСИМАЛЬНО БЫСТРЫЕ Middleware
app.use(compression({
    level: 6, // Сбалансированная компрессия
    threshold: 1024, // Сжимаем файлы больше 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

app.use(cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password', 'Accept', 'Cache-Control'],
    exposedHeaders: ['ETag', 'Last-Modified', 'Cache-Control']
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Статические файлы с агрессивным кэшированием
app.use(express.static('public', {
    maxAge: '7d', // Кэш на неделю
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        // Дополнительные заголовки для статики
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 дней
        }
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 час
        }
    }
}));

// МГНОВЕННЫЙ КЭШИРОВАНИЕ СИСТЕМЫ
class HighSpeedCache {
    constructor() {
        this.data = {
            public: null,
            admin: null,
            etag: null,
            lastUpdate: 0,
            version: 1
        };
        this.isUpdating = false;
        this.subscribers = [];
    }
    
    // Подписка на обновления кэша
    subscribe(callback) {
        this.subscribers.push(callback);
        return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) this.subscribers.splice(index, 1);
        };
    }
    
    // Уведомление подписчиков
    notify() {
        this.subscribers.forEach(callback => {
            try { callback(this.data); } catch (e) {}
        });
    }
    
    // Проверка актуальности
    isValid(maxAge = 30000) {
        return this.data.public && (Date.now() - this.data.lastUpdate) < maxAge;
    }
    
    // Получение публичных данных
    getPublic() {
        return this.data.public || [];
    }
    
    // Получение админских данных
    getAdmin() {
        return this.data.admin || [];
    }
    
    // Быстрое обновление
    async update() {
        if (this.isUpdating) return false;
        
        this.isUpdating = true;
        const startTime = Date.now();
        
        try {
            // Проверяем состояние БД
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️ БД не подключена, пропускаем обновление кэша');
                return false;
            }
            
            // Параллельные запросы для максимальной скорости
            const [adminPoints, publicPoints] = await Promise.all([
                ModelPoint.find({})
                    .select('+qrSecret') // Включаем секретное поле для админа
                    .lean()
                    .exec(),
                    
                ModelPoint.find({
                    scheduledTime: { $lte: new Date() }
                })
                    .select('-qrSecret') // Исключаем секретное поле для публики
                    .lean()
                    .exec()
            ]);
            
            // Атомарное обновление кэша
            this.data = {
                admin: adminPoints,
                public: publicPoints,
                lastUpdate: Date.now(),
                etag: `"${Date.now()}-${adminPoints.length}-v${++this.data.version}"`,
                version: this.data.version + 1
            };
            
            const updateTime = Date.now() - startTime;
            console.log(`⚡ Кэш обновлен за ${updateTime}ms (${adminPoints.length} точек)`);
            
            // Уведомляем подписчиков
            this.notify();
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка обновления кэша:', error);
            return false;
        } finally {
            this.isUpdating = false;
        }
    }
    
    // Принудительная инвалидация
    invalidate() {
        this.data.lastUpdate = 0;
        setImmediate(() => this.update());
    }
    
    // Получение статистики
    getStats() {
        const data = this.data.public || [];
        return {
            total: data.length,
            available: data.filter(p => p.status === 'available').length,
            collected: data.filter(p => p.status === 'collected').length,
            lastUpdate: this.data.lastUpdate,
            cacheAge: Date.now() - this.data.lastUpdate
        };
    }
}

// Создаем глобальный кэш
const cache = new HighSpeedCache();

// Multer для быстрой загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { 
        fileSize: 3 * 1024 * 1024, // 3MB лимит
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения'), false);
        }
    }
});

// МОЛНИЕНОСНОЕ подключение к MongoDB
async function connectDB() {
    const mongoOptions = {
        //
