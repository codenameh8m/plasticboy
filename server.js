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
    level: 6,
    threshold: 1024,
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

// Статические файлы с кэшированием
app.use(express.static('public', {
    maxAge: '1d',
    etag: true,
    lastModified: true
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
    }
    
    isValid(maxAge = 30000) {
        return this.data.public && (Date.now() - this.data.lastUpdate) < maxAge;
    }
    
    getPublic() {
        return this.data.public || [];
    }
    
    getAdmin() {
        return this.data.admin || [];
    }
    
    async update() {
        if (this.isUpdating) return false;
        
        this.isUpdating = true;
        const startTime = Date.now();
        
        try {
            if (mongoose.connection.readyState !== 1) {
                console.log('⚠️ БД не подключена');
                return false;
            }
            
            const [adminPoints, publicPoints] = await Promise.all([
                ModelPoint.find({}).lean().exec(),
                ModelPoint.find({
                    scheduledTime: { $lte: new Date() }
                }).select('-qrSecret').lean().exec()
            ]);
            
            this.data = {
                admin: adminPoints,
                public: publicPoints,
                lastUpdate: Date.now(),
                etag: `"${Date.now()}-${adminPoints.length}"`,
                version: this.data.version + 1
            };
            
            const updateTime = Date.now() - startTime;
            console.log(`⚡ Кэш обновлен за ${updateTime}ms (${adminPoints.length} точек)`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Ошибка обновления кэша:', error);
            return false;
        } finally {
            this.isUpdating = false;
        }
    }
    
    invalidate() {
        this.data.lastUpdate = 0;
        setImmediate(() => this.update());
    }
}

const cache = new HighSpeedCache();

// Multer для файлов
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        cb(null, file.mimetype.startsWith('image/'));
    }
});

// БЫСТРОЕ подключение к MongoDB
async function connectDB() {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: false,
            bufferMaxEntries: 0
        });
        
        console.log(`⚡ MongoDB подключена: ${conn.connection.host}`);
        
        // Создаем тестовые данные если их нет
        await createTestDataIfNeeded();
        
        // Инициализируем кэш
        await cache.update();
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка подключения MongoDB:', error);
        return false;
    }
}

// Оптимизированная схема с индексами
const ModelPointSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true, index: true },
    name: { type: String, required: true },
    coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
    qrCode: { type: String, required: true },
    qrSecret: { type: String, required: true, index: true },
    scheduledTime: { type: Date, default: Date.now, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    collectedAt: { type: Date },
    collectorInfo: {
        name: String,
        signature: String,
        selfie: String
    }
});

// Составной индекс для быстрых запросов
ModelPointSchema.index({ scheduledTime: 1, status: 1 });
ModelPointSchema.index({ id: 1, qrSecret: 1 });

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Создание тестовых данных
async function createTestDataIfNeeded() {
    try {
        const count = await ModelPoint.countDocuments();
        if (count > 0) {
            console.log(`📊 В базе уже есть ${count} точек`);
            return;
        }
        
        console.log('📝 Создание тестовых данных...');
        
        const testPoints = [
            {
                id: 'almaty-001',
                name: 'Модель "Алматы Арена"',
                coordinates: { lat: 43.2220, lng: 76.8512 },
                status: 'available',
                qrCode: await QRCode.toDataURL('http://localhost:3000/collect.html?id=almaty-001&secret=secret1'),
                qrSecret: 'secret1',
                scheduledTime: new Date()
            },
            {
                id: 'almaty-002',
                name: 'Модель "Площадь Республики"',
                coordinates: { lat: 43.2380, lng: 76.8840 },
                status: 'collected',
                qrCode: await QRCode.toDataURL('http://localhost:3000/collect.html?id=almaty-002&secret=secret2'),
                qrSecret: 'secret2',
                scheduledTime: new Date(),
                collectedAt: new Date(Date.now() - 3600000),
                collectorInfo: {
                    name: 'Айдар Нурланов',
                    signature: 'Первая находка в центре города!'
                }
            },
            {
                id: 'almaty-003',
                name: 'Модель "Кок-Тобе"',
                coordinates: { lat: 43.2050, lng: 76.9080 },
                status: 'available',
                qrCode: await QRCode.toDataURL('http://localhost:3000/collect.html?id=almaty-003&secret=secret3'),
                qrSecret: 'secret3',
                scheduledTime: new Date()
            },
            {
                id: 'almaty-004',
                name: 'Модель "Медеу"',
                coordinates: { lat: 43.1633, lng: 77.0669 },
                status: 'available',
                qrCode: await QRCode.toDataURL('http://localhost:3000/collect.html?id=almaty-004&secret=secret4'),
                qrSecret: 'secret4',
                scheduledTime: new Date()
            },
            {
                id: 'almaty-005',
                name: 'Модель "Парк 28 Панфиловцев"',
                coordinates: { lat: 43.2628, lng: 76.9569 },
                status: 'available',
                qrCode: await QRCode.toDataURL('http://localhost:3000/collect.html?id=almaty-005&secret=secret5'),
                qrSecret: 'secret5',
                scheduledTime: new Date()
            }
        ];
        
        await ModelPoint.insertMany(testPoints);
        console.log(`✅ Создано ${testPoints.length} тестовых точек`);
        
    } catch (error) {
        console.error('❌ Ошибка создания тестовых данных:', error);
    }
}

// Автообновление кэша каждые 30 секунд
setInterval(() => {
    if (!cache.isValid(25000)) {
        cache.update();
    }
}, 30000);

// Запуск подключения
connectDB();

// МАРШРУТЫ

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// МГНОВЕННОЕ получение точек
app.get('/api/points', async (req, res) => {
    try {
        // Проверяем кэш
        if (cache.isValid()) {
            const points = cache.getPublic();
            
            res.set({
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=30',
                'ETag': cache.data.etag,
                'Last-Modified': new Date(cache.data.lastUpdate).toUTCString()
            });
            
            // 304 Not Modified
            if (req.get('If-None-Match') === cache.data.etag) {
                return res.status(304).end();
            }
            
            return res.json(points);
        }
        
        // Обновляем кэш если устарел
        console.log('🔄 Обновление кэша для /api/points');
        await cache.update();
        
        const points = cache.getPublic();
        
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=15'
        });
        
        res.json(points);
        
    } catch (error) {
        console.error('❌ Ошибка /api/points:', error);
        
        // Возвращаем закэшированные данные при ошибке
        const points = cache.getPublic();
        if (points.length > 0) {
            return res.json(points);
        }
        
        res.status(500).json({ error: 'Ошибка сервера', points: [] });
    }
});

// Админские точки
app.get('/api/admin/points', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] || req.headers.authorization;
        
        if (!password || decodeURIComponent(password) !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        if (!cache.isValid()) {
            await cache.update();
        }
        
        const points = cache.getAdmin();
        
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=10'
        });
        
        res.json(points);
        
    } catch (error) {
        console.error('❌ Ошибка админских точек:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание новой точки
app.post('/api/admin/points', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] || req.headers.authorization;
        
        if (!password || decodeURIComponent(password) !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const { name, coordinates, delayMinutes } = req.body;
        
        if (!name || !coordinates || !coordinates.lat || !coordinates.lng) {
            return res.status(400).json({ error: 'Неверные данные' });
        }
        
        const pointId = `point-${Date.now()}`;
        const qrSecret = Math.random().toString(36).substring(2, 15);
        
        const scheduledTime = new Date();
        if (delayMinutes && !isNaN(delayMinutes)) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });

        const newPoint = new ModelPoint({
            id: pointId,
            name: name.trim(),
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            qrCode: qrCodeDataUrl,
            qrSecret,
            scheduledTime
        });

        await newPoint.save();
        cache.invalidate();
        
        console.log(`✅ Создана новая точка: ${name}`);
        res.status(201).json(newPoint);
        
    } catch (error) {
        console.error('❌ Ошибка создания точки:', error);
        if (error.code === 11000) {
            res.status(409).json({ error: 'Точка уже существует' });
        } else {
            res.status(500).json({ error: 'Ошибка создания точки' });
        }
    }
});

// Альтернативный роут создания
app.post('/api/admin/points/create', async (req, res) => {
    try {
        const { name, coordinates, delayMinutes, adminPassword } = req.body;
        
        if (!adminPassword || adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const pointId = `point-${Date.now()}`;
        const qrSecret = Math.random().toString(36).substring(2, 15);
        
        const scheduledTime = new Date();
        if (delayMinutes && !isNaN(delayMinutes)) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, { width: 300, margin: 2 });

        const newPoint = new ModelPoint({
            id: pointId,
            name: name.trim(),
            coordinates,
            qrCode: qrCodeDataUrl,
            qrSecret,
            scheduledTime
        });

        await newPoint.save();
        cache.invalidate();
        
        res.status(201).json(newPoint);
        
    } catch (error) {
        console.error('❌ Ошибка создания точки (альт):', error);
        res.status(500).json({ error: 'Ошибка создания точки' });
    }
});

// Страница сбора
app.get('/collect.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// Получение информации для сбора
app.get('/api/collect/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { secret } = req.query;

        if (!id || !secret) {
            return res.status(400).json({ error: 'Неверные параметры' });
        }

        const point = await ModelPoint.findOne({ 
            id, 
            qrSecret: secret 
        }).lean().exec();
        
        if (!point) {
            return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
        }

        if (point.status === 'collected') {
            return res.status(400).json({ error: 'Эта модель уже собрана' });
        }

        res.json({
            id: point.id,
            name: point.name,
            coordinates: point.coordinates
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения информации о сборе:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    try {
        const { id } = req.params;
        const { secret, name, signature } = req.body;

        if (!id || !secret || !name) {
            return res.status(400).json({ error: 'Не все данные заполнены' });
        }

        const point = await ModelPoint.findOne({ 
            id, 
            qrSecret: secret 
        }).exec();
        
        if (!point) {
            return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
        }

        if (point.status === 'collected') {
            return res.status(400).json({ error: 'Эта модель уже собрана' });
        }

        // Обработка селфи
        let selfieBase64 = null;
        if (req.file) {
            selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        // Обновляем точку
        point.status = 'collected';
        point.collectedAt = new Date();
        point.collectorInfo = {
            name: name.trim(),
            signature: signature ? signature.trim() : '',
            selfie: selfieBase64
        };

        await point.save();
        cache.invalidate();
        
        console.log(`✅ Точка собрана: ${name} → ${point.name}`);
        
        res.json({ success: true, message: 'Модель успешно собрана!' });
        
    } catch (error) {
        console.error('❌ Ошибка сбора модели:', error);
        res.status(500).json({ error: 'Ошибка сбора модели' });
    }
});

// Информация о точке
app.get('/api/point/:id/info', async (req, res) => {
    try {
        const { id } = req.params;
        
        const point = await ModelPoint.findOne({ id })
            .select('-qrSecret')
            .lean()
            .exec();
        
        if (!point) {
            return res.status(404).json({ error: 'Точка не найдена' });
        }

        res.set({
            'Cache-Control': 'public, max-age=300' // 5 минут
        });

        res.json(point);
        
    } catch (error) {
        console.error('❌ Ошибка получения информации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удаление точки
app.delete('/api/admin/points/:id', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] || req.headers.authorization;
        
        if (!password || decodeURIComponent(password) !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const { id } = req.params;
        
        const deletedPoint = await ModelPoint.findOneAndDelete({ id }).exec();
        
        if (!deletedPoint) {
            return res.status(404).json({ error: 'Точка не найдена' });
        }

        cache.invalidate();

        res.json({ success: true, message: 'Точка удалена' });
        
    } catch (error) {
        console.error('❌ Ошибка удаления точки:', error);
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const stats = cache.data;
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        cache: {
            publicPoints: stats.public ? stats.public.length : 0,
            adminPoints: stats.admin ? stats.admin.length : 0,
            lastUpdate: new Date(stats.lastUpdate).toISOString(),
            isValid: cache.isValid()
        },
        database: {
            connected: mongoose.connection.readyState === 1,
            state: mongoose.connection.readyState
        }
    });
});

// Админ панель
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 404 обработка
app.use((req, res) => {
    res.status(404).json({ error: 'Страница не найдена' });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('💥 Глобальная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`⚡ Получен ${signal}, завершение работы...`);
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB соединение закрыто');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка при закрытии:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Запуск сервера
app.listen(PORT, () => {
    console.log(`⚡ PlasticBoy сервер запущен на порту ${PORT}`);
    console.log(`🚀 Режим: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 MongoDB: ${process.env.MONGODB_URI ? 'облачная' : 'локальная'}`);
    console.log(`🔧 Админ пароль: ${process.env.ADMIN_PASSWORD ? 'установлен' : 'НЕ УСТАНОВЛЕН'}`);
});

module.exports = app;
