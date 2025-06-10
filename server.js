const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
const cluster = require('cluster');
const os = require('os');
require('dotenv').config();

// Кластеризация для многоядерности (только в продакшене)
if (cluster.isMaster && process.env.NODE_ENV === 'production') {
    const numCPUs = Math.min(os.cpus().length, 2); // Максимум 2 воркера для бесплатного плана
    console.log(`🚀 Master ${process.pid} starting ${numCPUs} workers`);
    
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
    
    cluster.on('exit', (worker, code, signal) => {
        console.log(`💀 Worker ${worker.process.pid} died, restarting...`);
        cluster.fork();
    });
    
    return;
}

const app = express();
const PORT = process.env.PORT || 3000;

// КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ: Compression и кэширование
app.use(compression({
    level: 6, // Компромисс между скоростью и размером
    threshold: 1024, // Сжимать файлы больше 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
    }
}));

// Агрессивное кэширование статических файлов
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 день
        }
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'public, max-age=300'); // 5 минут
        }
    }
}));

// УЛЬТРА-БЫСТРЫЕ middleware
app.use(cors({
    origin: true,
    credentials: false,
    maxAge: 86400 // 24 часа preflight кэш
}));

// Увеличиваем лимиты только где нужно
const jsonParser = express.json({ limit: '1mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '1mb' });

// Middleware только для POST запросов
app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        return jsonParser(req, res, next);
    }
    next();
});

app.use((req, res, next) => {
    if (req.method === 'POST' || req.method === 'PUT') {
        return urlencodedParser(req, res, next);
    }
    next();
});

// ОПТИМИЗИРОВАННАЯ конфигурация multer
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // Уменьшили до 5MB
        files: 1
    },
    fileFilter: (req, file, cb) => {
        // Быстрая проверка типа файла
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'), false);
        }
    }
});

// КЭШИРОВАНИЕ В ПАМЯТИ для критических данных
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }
    
    set(key, value, ttl = 300000) { // 5 минут по умолчанию
        // Очищаем старый таймер
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        this.cache.set(key, value);
        
        // Устанавливаем TTL
        const timer = setTimeout(() => {
            this.cache.delete(key);
            this.timers.delete(key);
        }, ttl);
        
        this.timers.set(key, timer);
    }
    
    get(key) {
        return this.cache.get(key);
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    delete(key) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        return this.cache.delete(key);
    }
    
    clear() {
        for (const timer of this.timers.values()) {
            clearTimeout(timer);
        }
        this.cache.clear();
        this.timers.clear();
    }
}

const cache = new MemoryCache();

// === ТЕЛЕГРАМ БОТ ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

// ОПТИМИЗИРОВАННАЯ проверка пароля администратора
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD;
function ultraFastPasswordCheck(req) {
    const password = req.headers.authorization || req.headers['x-admin-password'] || req.get('Authorization');
    return password === ADMIN_PASSWORD_HASH;
}

// МГНОВЕННЫЙ HEAD endpoint для проверки пароля админа
app.head('/api/admin/points', (req, res) => {
    res.status(ultraFastPasswordCheck(req) ? 200 : 401).end();
});

// ОПТИМИЗИРОВАННАЯ MongoDB схема с индексами
const modelPointSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: 'text' }, // Текстовый поиск
    coordinates: {
        lat: { type: Number, required: true, index: true },
        lng: { type: Number, required: true, index: true }
    },
    qrCode: { type: String, required: true },
    qrSecret: { type: String, required: true, index: true },
    status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    scheduledTime: { type: Date, default: Date.now, index: true },
    collectedAt: { type: Date, index: true },
    collectorInfo: {
        name: { type: String, index: true },
        signature: String,
        selfie: String,
        authMethod: { type: String, enum: ['manual', 'telegram'], default: 'manual', index: true },
        telegramData: {
            id: { type: Number, index: true },
            first_name: String,
            last_name: String,
            username: { type: String, index: true },
            photo_url: String,
            auth_date: Number,
            hash: String
        }
    }
}, {
    // Оптимизация схемы
    autoIndex: false, // Отключаем автоматическое создание индексов в продакшене
    minimize: false,
    versionKey: false
});

// СОСТАВНЫЕ ИНДЕКСЫ для ускорения запросов
modelPointSchema.index({ status: 1, scheduledTime: 1 }); // Основной запрос
modelPointSchema.index({ id: 1, qrSecret: 1 }); // Поиск для сбора
modelPointSchema.index({ 'collectorInfo.telegramData.id': 1, collectedAt: -1 }); // Лидерборд
modelPointSchema.index({ 'collectorInfo.authMethod': 1, status: 1 }); // Статистика

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// ОПТИМИЗИРОВАННОЕ подключение к MongoDB
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 5, // Максимум 5 подключений
            serverSelectionTimeoutMS: 5000, // 5 секунд таймаут
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false,
            // Важные оптимизации
            readPreference: 'secondaryPreferred', // Читаем с реплик
            compressors: ['zlib'], // Сжатие данных
            // Пул подключений
            minPoolSize: 1,
            heartbeatFrequencyMS: 30000,
            retryWrites: true,
            retryReads: true
        });
        
        console.log('✅ MongoDB connected with optimizations');
        
        // Создаем индексы в продакшене
        if (process.env.NODE_ENV === 'production') {
            await ModelPoint.ensureIndexes();
            console.log('📊 MongoDB indexes created');
        }
    } catch (error) {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    }
};

// УЛЬТРА-БЫСТРЫЙ health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        worker: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed / 1024 / 1024
    });
});

// КЭШИРОВАННЫЙ endpoint для точек
app.get('/api/points', async (req, res) => {
    try {
        const cacheKey = 'public_points';
        
        // Проверяем кэш
        if (cache.has(cacheKey)) {
            const cachedPoints = cache.get(cacheKey);
            res.set('X-Cache', 'HIT');
            return res.json(cachedPoints);
        }
        
        const now = new Date();
        
        // ОПТИМИЗИРОВАННЫЙ запрос с проекцией
        const points = await ModelPoint.find({
            scheduledTime: { $lte: now }
        }, {
            qrSecret: 0, // Исключаем секретное поле
            __v: 0 // Исключаем версию
        })
        .lean() // Возвращаем plain objects
        .limit(1000) // Лимит для безопасности
        .exec();
        
        // Кэшируем на 30 секунд
        cache.set(cacheKey, points, 30000);
        
        res.set('X-Cache', 'MISS');
        res.json(points);
    } catch (error) {
        console.error('❌ Points loading error:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// ОПТИМИЗИРОВАННЫЙ сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    try {
        const { id } = req.params;
        const { secret, name, signature, authMethod, telegramData } = req.body;
        
        if (!secret || !name) {
            return res.status(400).json({ error: 'Secret and name are required' });
        }
        
        // АТОМАРНЫЙ поиск и обновление
        const point = await ModelPoint.findOneAndUpdate(
            {
                id: id.trim(),
                qrSecret: secret.trim(),
                status: 'available',
                scheduledTime: { $lte: new Date() }
            },
            {
                $set: {
                    status: 'collected',
                    collectedAt: new Date(),
                    'collectorInfo.name': name.trim(),
                    'collectorInfo.signature': signature?.trim() || '',
                    'collectorInfo.authMethod': authMethod || 'manual'
                }
            },
            {
                new: false, // Возвращаем старый документ
                runValidators: false // Отключаем валидацию для скорости
            }
        );
        
        if (!point) {
            return res.status(404).json({ error: 'Point not found, already collected, or not ready' });
        }
        
        // Обрабатываем Telegram данные асинхронно
        if (authMethod === 'telegram' && telegramData) {
            setImmediate(async () => {
                try {
                    const parsedTelegramData = typeof telegramData === 'string' 
                        ? JSON.parse(telegramData) 
                        : telegramData;
                    
                    if (parsedTelegramData.id && parsedTelegramData.first_name) {
                        await ModelPoint.updateOne(
                            { _id: point._id },
                            {
                                $set: {
                                    'collectorInfo.telegramData': {
                                        id: parsedTelegramData.id,
                                        first_name: parsedTelegramData.first_name,
                                        last_name: parsedTelegramData.last_name || '',
                                        username: parsedTelegramData.username || '',
                                        photo_url: parsedTelegramData.photo_url || '',
                                        auth_date: parsedTelegramData.auth_date,
                                        hash: parsedTelegramData.hash || ''
                                    }
                                }
                            }
                        );
                    }
                } catch (error) {
                    console.error('❌ Async Telegram data error:', error);
                }
            });
        }
        
        // Обрабатываем селфи асинхронно
        if (req.file) {
            setImmediate(async () => {
                try {
                    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
                    await ModelPoint.updateOne(
                        { _id: point._id },
                        { $set: { 'collectorInfo.selfie': base64Image } }
                    );
                } catch (error) {
                    console.error('❌ Async selfie error:', error);
                }
            });
        }
        
        // Инвалидируем кэш асинхронно
        setImmediate(() => {
            cache.delete('public_points');
            cache.delete('leaderboard_data');
        });
        
        // Быстрый ответ
        res.json({
            success: true,
            point: {
                id: point.id,
                name: point.name,
                collectedAt: new Date()
            }
        });
        
    } catch (error) {
        console.error('❌ Collection error:', error);
        res.status(500).json({ error: 'Failed to collect point' });
    }
});

// КЭШИРОВАННЫЙ leaderboard
app.get('/api/telegram/leaderboard', async (req, res) => {
    try {
        const cacheKey = 'leaderboard_data';
        
        if (cache.has(cacheKey)) {
            res.set('X-Cache', 'HIT');
            return res.json(cache.get(cacheKey));
        }
        
        // ОПТИМИЗИРОВАННЫЙ агрегационный запрос
        const [leaderboard, stats] = await Promise.all([
            ModelPoint.aggregate([
                {
                    $match: {
                        status: 'collected',
                        'collectorInfo.authMethod': 'telegram',
                        'collectorInfo.telegramData.id': { $exists: true }
                    }
                },
                {
                    $group: {
                        _id: '$collectorInfo.telegramData.id',
                        totalCollections: { $sum: 1 },
                        firstCollection: { $min: '$collectedAt' },
                        lastCollection: { $max: '$collectedAt' },
                        first_name: { $first: '$collectorInfo.telegramData.first_name' },
                        last_name: { $first: '$collectorInfo.telegramData.last_name' },
                        username: { $first: '$collectorInfo.telegramData.username' },
                        photo_url: { $first: '$collectorInfo.telegramData.photo_url' }
                    }
                },
                {
                    $sort: { totalCollections: -1, firstCollection: 1 }
                },
                {
                    $limit: 50
                },
                {
                    $project: {
                        _id: 0,
                        id: '$_id',
                        totalCollections: 1,
                        lastCollection: 1,
                        first_name: 1,
                        last_name: 1,
                        username: 1,
                        photo_url: 1
                    }
                }
            ]),
            
            ModelPoint.aggregate([
                {
                    $match: {
                        status: 'collected',
                        'collectorInfo.authMethod': 'telegram'
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalCollections: { $sum: 1 },
                        uniqueUsers: { $addToSet: '$collectorInfo.telegramData.id' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        totalCollections: 1,
                        totalUsers: { $size: '$uniqueUsers' }
                    }
                }
            ])
        ]);
        
        const response = {
            leaderboard,
            stats: stats[0] || { totalCollections: 0, totalUsers: 0 },
            timestamp: new Date().toISOString()
        };
        
        // Кэшируем на 60 секунд
        cache.set(cacheKey, response, 60000);
        
        res.set('X-Cache', 'MISS');
        res.json(response);
        
    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// БЫСТРЫЕ админ endpoints
app.get('/api/admin/points', async (req, res) => {
    if (!ultraFastPasswordCheck(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const points = await ModelPoint.find({}, { __v: 0 }).lean().exec();
        res.json(points);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Оптимизированный Telegram webhook
if (BOT_TOKEN) {
    // Простой обработчик webhook без сложной логики
    app.post(WEBHOOK_PATH, express.json({ limit: '1mb' }), async (req, res) => {
        res.status(200).send('OK'); // Отвечаем сразу
        
        // Обрабатываем update асинхронно
        setImmediate(() => {
            handleTelegramUpdate(req.body, req).catch(console.error);
        });
    });
}

// Telegram functions (упрощенные)
async function handleTelegramUpdate(update, req) {
    if (!update.message?.text) return;
    
    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text;
    const user = message.from;
    
    if (!text.startsWith('/')) return;
    
    const command = text.split(' ')[0].substring(1).toLowerCase();
    const appUrl = getAppUrl(req);
    
    try {
        switch (command) {
            case 'start':
                await sendTelegramMessage(chatId, `🎯 *PlasticBoy*\n\nПривет, ${user.first_name}! Найди QR коды и собирай 3D модели в Алматы!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🗺️ Открыть карту', url: appUrl }],
                            [{ text: '🏆 Рейтинг', url: `${appUrl}/leaderboard.html` }]
                        ]
                    }
                });
                break;
        }
    } catch (error) {
        console.error('❌ Telegram error:', error);
    }
}

async function sendTelegramMessage(chatId, message, options = {}) {
    if (!BOT_TOKEN) return;
    
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            ...options
        }, { timeout: 5000 });
    } catch (error) {
        console.error('❌ Send message error:', error.response?.data || error.message);
    }
}

function getAppUrl(req) {
    return process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
}

// Статические файлы
const staticRoutes = ['/', '/admin.html', '/collect.html', '/leaderboard.html'];
staticRoutes.forEach(route => {
    app.get(route, (req, res) => {
        const fileName = route === '/' ? 'index.html' : route.slice(1);
        res.sendFile(path.join(__dirname, 'public', fileName));
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: 'Internal error' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📛 Shutting down...');
    cache.clear();
    mongoose.connection.close();
    process.exit(0);
});

// Запуск сервера
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`🚀 Worker ${process.pid} started on port ${PORT}`);
            console.log(`📊 Memory cache active`);
            console.log(`⚡ Optimizations enabled`);
        });
    } catch (error) {
        console.error('❌ Startup error:', error);
        process.exit(1);
    }
};

startServer();
