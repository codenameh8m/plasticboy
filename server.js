const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const compression = require('compression');
require('dotenv').config();

console.log('🚀 PlasticBoy v2.1 starting...');

const app = express();
const PORT = process.env.PORT || 3000;

// === БАЗОВЫЕ MIDDLEWARE ===
app.use(compression({
    level: 6,
    threshold: 1024
}));

app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
    etag: true
}));

app.use(cors({
    origin: true,
    credentials: false
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// === КЭШИРОВАНИЕ В ПАМЯТИ ===
class MemoryCache {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
    }
    
    set(key, value, ttl = 60000) {
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        
        this.cache.set(key, value);
        
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
}

const cache = new MemoryCache();

// === TELEGRAM BOT ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

// === АДМИН ПАРОЛЬ ===
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
function checkAdminPassword(req) {
    const password = req.headers.authorization || req.headers['x-admin-password'] || req.get('Authorization');
    return password === ADMIN_PASSWORD;
}

// === MULTER НАСТРОЙКИ ===
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'), false);
        }
    }
});

// === MONGOOSE СХЕМА ===
const modelPointSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, index: 'text' },
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
    versionKey: false
});

// === СОСТАВНЫЕ ИНДЕКСЫ ===
modelPointSchema.index({ status: 1, scheduledTime: 1 });
modelPointSchema.index({ id: 1, qrSecret: 1 });
modelPointSchema.index({ 'collectorInfo.telegramData.id': 1, collectedAt: -1 });

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// === ПОДКЛЮЧЕНИЕ К MONGODB ===
const connectDB = async () => {
    try {
        console.log('🔌 Connecting to MongoDB...');
        
        const options = {
            maxPoolSize: 5,
            minPoolSize: 1,
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
            retryWrites: true,
            retryReads: true,
            heartbeatFrequencyMS: 30000,
            maxIdleTimeMS: 30000
        };
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', options);
        
        console.log('✅ MongoDB connected successfully');
        console.log('📊 Database:', mongoose.connection.name);
        
        // Создаем индексы в продакшене
        if (process.env.NODE_ENV === 'production') {
            try {
                await ModelPoint.createIndexes();
                console.log('📊 MongoDB indexes created');
            } catch (indexError) {
                console.warn('⚠️ Index warning:', indexError.message);
            }
        }
        
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        
        if (error.name === 'MongoParseError') {
            console.error('🔧 Check MONGODB_URI format');
        } else if (error.name === 'MongoNetworkError') {
            console.error('🌐 Check internet connection');
        } else if (error.name === 'MongoServerSelectionError') {
            console.error('🎯 Check MongoDB cluster status');
        }
        
        process.exit(1);
    }
};

// === API ENDPOINTS ===

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        pid: process.pid,
        uptime: process.uptime(),
        memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Получение точек (с кэшированием)
app.get('/api/points', async (req, res) => {
    try {
        const cacheKey = 'public_points';
        
        if (cache.has(cacheKey)) {
            const cachedPoints = cache.get(cacheKey);
            res.set('X-Cache', 'HIT');
            return res.json(cachedPoints);
        }
        
        const now = new Date();
        
        const points = await ModelPoint.find({
            scheduledTime: { $lte: now }
        }, {
            qrSecret: 0,
            __v: 0
        })
        .lean()
        .limit(1000)
        .exec();
        
        cache.set(cacheKey, points, 30000); // 30 секунд кэш
        
        res.set('X-Cache', 'MISS');
        res.json(points);
    } catch (error) {
        console.error('❌ Points loading error:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    try {
        const { id } = req.params;
        const { secret, name, signature, authMethod, telegramData } = req.body;
        
        if (!secret || !name) {
            return res.status(400).json({ error: 'Secret and name are required' });
        }
        
        // Атомарный поиск и обновление
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
            { new: false }
        );
        
        if (!point) {
            return res.status(404).json({ error: 'Point not found, already collected, or not ready' });
        }
        
        // Обработка Telegram данных асинхронно
        if (authMethod === 'telegram' && telegramData) {
            setTimeout(async () => {
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
                    console.error('❌ Telegram data error:', error);
                }
            }, 0);
        }
        
        // Обработка селфи асинхронно
        if (req.file) {
            setTimeout(async () => {
                try {
                    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
                    await ModelPoint.updateOne(
                        { _id: point._id },
                        { $set: { 'collectorInfo.selfie': base64Image } }
                    );
                } catch (error) {
                    console.error('❌ Selfie error:', error);
                }
            }, 0);
        }
        
        // Инвалидируем кэш
        cache.delete('public_points');
        cache.delete('leaderboard_data');
        
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

// Админ панель - получение всех точек
app.get('/api/admin/points', async (req, res) => {
    if (!checkAdminPassword(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const points = await ModelPoint.find({}, { __v: 0 }).lean().exec();
        res.json(points);
    } catch (error) {
        console.error('❌ Admin points error:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Админ панель - создание точки
app.post('/api/admin/points', async (req, res) => {
    if (!checkAdminPassword(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { name, lat, lng, scheduledTime } = req.body;
        
        if (!name || !lat || !lng) {
            return res.status(400).json({ error: 'Name, lat, lng are required' });
        }
        
        const id = crypto.randomBytes(8).toString('hex');
        const qrSecret = crypto.randomBytes(16).toString('hex');
        
        const qrText = `${process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}/collect.html?id=${id}&secret=${qrSecret}`;
        const qrCode = await QRCode.toDataURL(qrText);
        
        const point = new ModelPoint({
            id,
            name: name.trim(),
            coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
            qrCode,
            qrSecret,
            scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date()
        });
        
        await point.save();
        
        cache.delete('public_points');
        
        res.json({ success: true, point });
    } catch (error) {
        console.error('❌ Point creation error:', error);
        res.status(500).json({ error: 'Failed to create point' });
    }
});

// Админ панель - удаление точки
app.delete('/api/admin/points/:id', async (req, res) => {
    if (!checkAdminPassword(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    try {
        const { id } = req.params;
        const deletedPoint = await ModelPoint.findOneAndDelete({ id });
        
        if (!deletedPoint) {
            return res.status(404).json({ error: 'Point not found' });
        }
        
        cache.delete('public_points');
        
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Point deletion error:', error);
        res.status(500).json({ error: 'Failed to delete point' });
    }
});

// Лидерборд
app.get('/api/telegram/leaderboard', async (req, res) => {
    try {
        const cacheKey = 'leaderboard_data';
        
        if (cache.has(cacheKey)) {
            res.set('X-Cache', 'HIT');
            return res.json(cache.get(cacheKey));
        }
        
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
        
        cache.set(cacheKey, response, 60000); // 60 секунд кэш
        
        res.set('X-Cache', 'MISS');
        res.json(response);
        
    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// === TELEGRAM WEBHOOK ===
if (BOT_TOKEN) {
    app.post(WEBHOOK_PATH, express.json({ limit: '1mb' }), async (req, res) => {
        res.status(200).send('OK');
        
        setTimeout(() => {
            handleTelegramUpdate(req.body, req).catch(console.error);
        }, 0);
    });
}

// Функции Telegram бота
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
                
            case 'help':
                await sendTelegramMessage(chatId, `📋 *Как играть:*\n\n1️⃣ Открой карту\n2️⃣ Найди ближайшую точку\n3️⃣ Отсканируй QR код\n4️⃣ Собери 3D модель\n5️⃣ Получи очки!`, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🗺️ Карта', url: appUrl }]
                        ]
                    }
                });
                break;
                
            case 'stats':
                const stats = await getGameStats();
                await sendTelegramMessage(chatId, `📊 *Статистика игры:*\n\n🎯 Всего моделей: ${stats.totalPoints}\n✅ Собрано: ${stats.collected}\n🎮 Игроков: ${stats.players}\n\n🏆 [Посмотреть рейтинг](${appUrl}/leaderboard.html)`);
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
            disable_web_page_preview: true,
            ...options
        }, { timeout: 5000 });
    } catch (error) {
        console.error('❌ Send message error:', error.response?.data || error.message);
    }
}

async function getGameStats() {
    try {
        const [totalPoints, collected, players] = await Promise.all([
            ModelPoint.countDocuments(),
            ModelPoint.countDocuments({ status: 'collected' }),
            ModelPoint.distinct('collectorInfo.telegramData.id', { 
                status: 'collected',
                'collectorInfo.authMethod': 'telegram' 
            })
        ]);
        
        return {
            totalPoints,
            collected,
            players: players.length
        };
    } catch (error) {
        console.error('❌ Stats error:', error);
        return { totalPoints: 0, collected: 0, players: 0 };
    }
}

function getAppUrl(req) {
    return process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`;
}

// === СТАТИЧЕСКИЕ МАРШРУТЫ ===
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

// === ОБРАБОТКА СОБЫТИЙ MONGOOSE ===
mongoose.connection.on('connected', () => {
    console.log('🟢 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('🔴 Mongoose connection error:', err.message);
});

mongoose.connection.on('disconnected', () => {
    console.log('🟡 Mongoose disconnected from MongoDB');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📛 Shutting down...');
    mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    try {
        await mongoose.connection.close();
        console.log('👋 MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// === ЗАПУСК СЕРВЕРА ===
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log(`🚀 PlasticBoy v2.1 started on port ${PORT}`);
            console.log(`📊 Memory cache active`);
            console.log(`🌐 Health check: http://localhost:${PORT}/health`);
            
            if (BOT_TOKEN) {
                console.log(`🤖 Telegram bot ready: @${BOT_USERNAME}`);
            }
        });
    } catch (error) {
        console.error('❌ Startup error:', error);
        process.exit(1);
    }
};

startServer();
