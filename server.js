const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// КЭШИРОВАНИЕ В ПАМЯТИ ДЛЯ МАКСИМАЛЬНОЙ СКОРОСТИ
const cache = new Map();
const CACHE_TTL = {
    points: 2 * 60 * 1000,     // 2 минуты для публичных точек
    admin: 1 * 60 * 1000,      // 1 минута для админских точек
    leaderboard: 5 * 60 * 1000, // 5 минут для лидерборда
    collect: 10 * 60 * 1000    // 10 минут для информации о сборе
};

function getFromCache(key) {
    const item = cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expires) {
        cache.delete(key);
        return null;
    }
    
    return item.data;
}

function setCache(key, data, ttl) {
    cache.set(key, {
        data,
        expires: Date.now() + ttl
    });
}

function invalidateCache(pattern) {
    for (const key of cache.keys()) {
        if (key.includes(pattern)) {
            cache.delete(key);
        }
    }
}

// Периодическая очистка кэша
setInterval(() => {
    const now = Date.now();
    for (const [key, item] of cache.entries()) {
        if (now > item.expires) {
            cache.delete(key);
        }
    }
}, 60000); // Каждую минуту

// Middleware с оптимизацией
app.use(cors({
    origin: true,
    credentials: false,
    maxAge: 86400 // 24 часа кэширования CORS
}));

app.use(express.json({ 
    limit: '50mb',
    strict: false
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '50mb',
    parameterLimit: 1000
}));

// Статические файлы с кэшированием
app.use(express.static('public', {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : '1h',
    etag: true,
    lastModified: true
}));

// Configure multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
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

// === ТЕЛЕГРАМ БОТ ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

console.log('🤖 Telegram Bot Configuration:');
console.log('Token available:', !!BOT_TOKEN);
console.log('Bot username:', BOT_USERNAME);

// СУПЕР БЫСТРАЯ проверка пароля администратора
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
function ultraFastPasswordCheck(req) {
    const password = req.headers.authorization || req.headers['x-admin-password'] || req.get('Authorization');
    return password === ADMIN_PASSWORD;
}

// МГНОВЕННЫЙ HEAD endpoint для проверки пароля
app.head('/api/admin/points', (req, res) => {
    res.status(ultraFastPasswordCheck(req) ? 200 : 401).end();
});

// MongoDB Schema с оптимизированными индексами
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
        name: String,
        signature: String,
        selfie: String,
        authMethod: { type: String, enum: ['manual', 'telegram'], default: 'manual', index: true },
        telegramData: {
            id: { type: Number, index: true },
            first_name: String,
            last_name: String,
            username: String,
            photo_url: String,
            auth_date: Number,
            hash: String
        }
    }
}, {
    versionKey: false,
    minimize: false,
    strict: false
});

// Составные индексы для ускорения запросов
modelPointSchema.index({ id: 1, qrSecret: 1 });
modelPointSchema.index({ status: 1, scheduledTime: 1 });
modelPointSchema.index({ status: 1, createdAt: -1 });
modelPointSchema.index({ 'collectorInfo.authMethod': 1, 'collectorInfo.telegramData.id': 1 });
modelPointSchema.index({ coordinates: '2dsphere' }); // Геоиндекс для будущих фич

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// Функция для отправки сообщений в Telegram с пулом соединений
const telegramAxios = axios.create({
    baseURL: `https://api.telegram.org/bot${BOT_TOKEN}`,
    timeout: 8000,
    maxRedirects: 0,
    headers: {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive'
    }
});

async function sendTelegramMessage(chatId, message, options = {}) {
    if (!BOT_TOKEN) {
        console.log('⚠️ BOT_TOKEN not available');
        return;
    }
    
    try {
        const response = await telegramAxios.post('/sendMessage', {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            ...options
        });
        
        console.log(`✅ Message sent to chat ${chatId}`);
        return response.data;
    } catch (error) {
        console.error('❌ Telegram error:', error.response?.data?.description || error.message);
        
        // Retry без markdown при ошибке парсинга
        if (error.response?.data?.description?.includes('parse')) {
            try {
                const response = await telegramAxios.post('/sendMessage', {
                    chat_id: chatId,
                    text: message.replace(/[*_`\[\]]/g, ''),
                    ...options,
                    parse_mode: undefined
                });
                return response.data;
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError.response?.data);
            }
        }
        throw error;
    }
}

function getAppUrl(req) {
    return process.env.RENDER_EXTERNAL_URL || 
           `${req.get('x-forwarded-proto') || req.protocol}://${req.get('host')}`;
}

// Обработка Telegram команд с кэшированием
async function handleTelegramUpdate(update, req) {
    try {
        if (update.message) {
            const message = update.message;
            const chatId = message.chat.id;
            const text = message.text;
            const user = message.from;
            
            if (text && text.startsWith('/')) {
                const command = text.split(' ')[0].substring(1).toLowerCase()
                    .replace(`@${BOT_USERNAME.toLowerCase()}`, '');
                
                const appUrl = getAppUrl(req);
                
                switch (command) {
                    case 'start':
                        await sendTelegramMessage(chatId, `🎯 *PlasticBoy - Almighty Edition*

Hello, ${user.first_name}! 👋

Welcome to the 3D model collection hunt in Almaty!

🎮 *How to play:*
• Find QR codes around the city
• Scan them to collect models
• Compete with other players

🏆 Happy hunting!`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🗺️ Open Map', url: appUrl }],
                                    [
                                        { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                                        { text: '📊 Statistics', callback_data: 'stats' }
                                    ],
                                    [{ text: '❓ Help', callback_data: 'help' }]
                                ]
                            }
                        });
                        break;
                        
                    case 'stats':
                        await handleStatsCommand(chatId, appUrl);
                        break;
                        
                    default:
                        await sendTelegramMessage(chatId, `❓ Unknown command: /${command}

Use /start for main menu!`, {
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🗺️ Play Game', url: appUrl }]
                                ]
                            }
                        });
                }
            }
        }
        
        if (update.callback_query) {
            await handleCallbackQuery(update.callback_query, req);
        }
        
    } catch (error) {
        console.error('❌ Telegram update error:', error);
    }
}

// Кэшированная статистика для бота
async function handleStatsCommand(chatId, appUrl) {
    try {
        let stats = getFromCache('telegram_stats');
        
        if (!stats) {
            const [totalPoints, collectedPoints, telegramStats] = await Promise.all([
                ModelPoint.countDocuments(),
                ModelPoint.countDocuments({ status: 'collected' }),
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
                            telegramCollections: { $sum: 1 },
                            uniqueTelegramUsers: { $addToSet: '$collectorInfo.telegramData.id' }
                        }
                    }
                ])
            ]);
            
            const tgStats = telegramStats[0] || { telegramCollections: 0, uniqueTelegramUsers: [] };
            
            stats = {
                totalPoints,
                availablePoints: totalPoints - collectedPoints,
                collectedPoints,
                telegramUsers: tgStats.uniqueTelegramUsers.length,
                telegramCollections: tgStats.telegramCollections
            };
            
            setCache('telegram_stats', stats, CACHE_TTL.points);
        }
        
        const statsMessage = `📊 *Game Statistics*

📦 Total Models: *${stats.totalPoints}*
🟢 Available: *${stats.availablePoints}*
🔴 Collected: *${stats.collectedPoints}*

📱 *Telegram Players:*
👥 Active Players: *${stats.telegramUsers}*
🎯 Their Collections: *${stats.telegramCollections}*

🏆 Join the competition!`;
        
        await sendTelegramMessage(chatId, statsMessage, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ Start Playing', url: appUrl }],
                    [{ text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` }]
                ]
            }
        });
    } catch (error) {
        console.error('❌ Stats error:', error);
        await sendTelegramMessage(chatId, '❌ Statistics temporarily unavailable');
    }
}

// Обработка callback запросов
async function handleCallbackQuery(callbackQuery, req) {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    
    try {
        await telegramAxios.post('/answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '✅'
        });
    } catch (e) {}
    
    const appUrl = getAppUrl(req);
    
    switch (data) {
        case 'stats':
            await handleStatsCommand(chatId, appUrl);
            break;
        case 'help':
            await sendTelegramMessage(chatId, `❓ *PlasticBoy Help*

🎮 Find QR codes around Almaty and collect 3D models!

📱 Commands: /start, /stats
🗺️ Open map to start playing
🏆 Use Telegram login for leaderboard`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🗺️ Start Playing', url: appUrl }]
                    ]
                }
            });
            break;
        case 'leaderboard':
            await sendTelegramMessage(chatId, `🏆 *Collectors Leaderboard*

View top PlasticBoy players!
Use Telegram login when collecting to join rankings!`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` }],
                        [{ text: '🗺️ Play Game', url: appUrl }]
                    ]
                }
            });
            break;
    }
}

// === WEBHOOK ROUTES ===
if (BOT_TOKEN) {
    app.post(WEBHOOK_PATH, async (req, res) => {
        res.status(200).send('OK');
        handleTelegramUpdate(req.body, req);
    });
    
    app.get('/setup-webhook', async (req, res) => {
        try {
            const appUrl = getAppUrl(req);
            const webhookUrl = `${appUrl}${WEBHOOK_PATH}`;
            
            await telegramAxios.post('/deleteWebhook');
            
            const response = await telegramAxios.post('/setWebhook', {
                url: webhookUrl,
                allowed_updates: ['message', 'callback_query'],
                drop_pending_updates: true
            });
            
            res.json({
                success: true,
                webhook_url: webhookUrl,
                response: response.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.response?.data || error.message
            });
        }
    });
    
    app.get('/webhook-info', async (req, res) => {
        try {
            const [webhookInfo, botInfo] = await Promise.all([
                telegramAxios.get('/getWebhookInfo'),
                telegramAxios.get('/getMe')
            ]);
            
            res.json({
                webhook_info: webhookInfo.data,
                bot_info: botInfo.data
            });
        } catch (error) {
            res.status(500).json({ error: error.response?.data || error.message });
        }
    });
}

// Connect to MongoDB с оптимизацией
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferMaxEntries: 0,
            bufferCommands: false
        });
        console.log('✅ MongoDB connected');
    } catch (error) {
        console.error('❌ MongoDB error:', error);
        process.exit(1);
    }
};

// УСКОРЕННЫЙ Health check
app.get('/health', async (req, res) => {
    try {
        const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            database: dbState,
            cache_size: cache.size,
            telegram: !!BOT_TOKEN
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

// СУПЕР БЫСТРЫЕ API ROUTES с кэшированием

// Получить все публичные точки
app.get('/api/points', async (req, res) => {
    try {
        // Проверяем кэш
        let points = getFromCache('public_points');
        
        if (!points) {
            const now = new Date();
            
            // Оптимизированный запрос с lean()
            points = await ModelPoint.find({
                scheduledTime: { $lte: now }
            })
            .select('-qrSecret -__v')
            .lean()
            .exec();
            
            setCache('public_points', points, CACHE_TTL.points);
        }
        
        res.set({
            'Cache-Control': 'public, max-age=120',
            'X-Cache': points ? 'HIT' : 'MISS'
        });
        
        res.json(points);
    } catch (error) {
        console.error('❌ Points error:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Получить информацию о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { secret } = req.query;
        
        if (!secret) {
            return res.status(400).json({ error: 'Secret required' });
        }
        
        const cacheKey = `collect_${id}_${secret}`;
        let point = getFromCache(cacheKey);
        
        if (!point) {
            point = await ModelPoint.findOne({
                id: id.trim(),
                qrSecret: secret.trim()
            })
            .select('id name coordinates scheduledTime status')
            .lean()
            .exec();
            
            if (point) {
                setCache(cacheKey, point, CACHE_TTL.collect);
            }
        }
        
        if (!point) {
            return res.status(404).json({ error: 'Point not found' });
        }
        
        if (point.status === 'collected') {
            return res.status(409).json({ error: 'Already collected' });
        }
        
        const now = new Date();
        if (new Date(point.scheduledTime) > now) {
            return res.status(423).json({ 
                error: 'Not ready yet',
                scheduledTime: point.scheduledTime
            });
        }
        
        res.json({
            id: point.id,
            name: point.name,
            coordinates: point.coordinates,
            scheduledTime: point.scheduledTime
        });
    } catch (error) {
        console.error('❌ Collect info error:', error);
        res.status(500).json({ error: 'Failed to get point info' });
    }
});

// Собрать модель
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    try {
        const { id } = req.params;
        const { secret, name, signature, authMethod, telegramData } = req.body;
        
        if (!secret || !name) {
            return res.status(400).json({ error: 'Secret and name required' });
        }
        
        const point = await ModelPoint.findOne({
            id: id.trim(),
            qrSecret: secret.trim()
        });
        
        if (!point) {
            return res.status(404).json({ error: 'Point not found' });
        }
        
        if (point.status === 'collected') {
            return res.status(409).json({ error: 'Already collected' });
        }
        
        const now = new Date();
        if (new Date(point.scheduledTime) > now) {
            return res.status(423).json({ error: 'Not ready yet' });
        }
        
        const collectorInfo = {
            name: name.trim(),
            signature: signature?.trim() || '',
            authMethod: authMethod || 'manual'
        };
        
        if (authMethod === 'telegram' && telegramData) {
            try {
                const parsed = typeof telegramData === 'string' ? JSON.parse(telegramData) : telegramData;
                if (parsed.id && parsed.first_name) {
                    collectorInfo.telegramData = {
                        id: parsed.id,
                        first_name: parsed.first_name,
                        last_name: parsed.last_name || '',
                        username: parsed.username || '',
                        photo_url: parsed.photo_url || '',
                        auth_date: parsed.auth_date,
                        hash: parsed.hash || ''
                    };
                }
            } catch (e) {
                collectorInfo.authMethod = 'manual';
            }
        }
        
        if (req.file) {
            collectorInfo.selfie = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }
        
        point.status = 'collected';
        point.collectedAt = now;
        point.collectorInfo = collectorInfo;
        
        await point.save();
        
        // Инвалидируем кэш
        invalidateCache('public_points');
        invalidateCache('admin_points');
        invalidateCache('telegram_');
        
        console.log(`🎯 Collected: ${point.name} by ${collectorInfo.name}`);
        
        res.json({
            success: true,
            message: 'Collected successfully'
        });
    } catch (error) {
        console.error('❌ Collection error:', error);
        res.status(500).json({ error: 'Collection failed' });
    }
});

// ============== ADMIN ROUTES ==============

// Получить все точки для админа
app.get('/api/admin/points', async (req, res) => {
    try {
        if (!ultraFastPasswordCheck(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        let points = getFromCache('admin_points');
        
        if (!points) {
            points = await ModelPoint.find({})
                .select('-__v')
                .lean()
                .exec();
            
            setCache('admin_points', points, CACHE_TTL.admin);
        }
        
        res.json(points);
    } catch (error) {
        console.error('❌ Admin points error:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Создать новую точку (админ)
app.post('/api/admin/points', async (req, res) => {
    try {
        if (!ultraFastPasswordCheck(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, coordinates, delayMinutes } = req.body;
        
        if (!name || !coordinates?.lat || !coordinates?.lng) {
            return res.status(400).json({ error: 'Invalid data' });
        }

        const pointId = Date.now().toString();
        const qrSecret = crypto.randomBytes(16).toString('hex');
        
        const scheduledTime = new Date();
        if (delayMinutes && !isNaN(delayMinutes)) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        const appUrl = getAppUrl(req);
        const collectUrl = `${appUrl}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#FFFFFF' }
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
        
        // Инвалидируем кэш
        invalidateCache('admin_points');
        invalidateCache('public_points');
        
        console.log(`✅ Point created: ${name}`);
        res.json(newPoint);
    } catch (error) {
        console.error('❌ Point creation error:', error);
        res.status(500).json({ error: 'Creation failed' });
    }
});

// Удалить точку (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
    try {
        if (!ultraFastPasswordCheck(req)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { id } = req.params;
        const deletedPoint = await ModelPoint.findOneAndDelete({ id: id.trim() });
        
        if (!deletedPoint) {
            return res.status(404).json({ error: 'Point not found' });
        }

        // Инвалидируем кэш
        invalidateCache('admin_points');
        invalidateCache('public_points');
        
        console.log(`🗑️ Point deleted: ${deletedPoint.name}`);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete error:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

// ============== TELEGRAM LEADERBOARD ==============

// Получить лидерборд Telegram пользователей
app.get('/api/telegram/leaderboard', async (req, res) => {
    try {
        let data = getFromCache('telegram_leaderboard');
        
        if (!data) {
            const [leaderboard, stats] = await Promise.all([
                ModelPoint.aggregate([
                    {
                        $match: {
                            status: 'collected',
                            'collectorInfo.authMethod': 'telegram',
                            'collectorInfo.telegramData.id': { $exists: true, $ne: null }
                        }
                    },
                    {
                        $group: {
                            _id: '$collectorInfo.telegramData.id',
                            totalCollections: { $sum: 1 },
                            firstCollection: { $min: '$collectedAt' },
                            lastCollection: { $max: '$collectedAt' },
                            userData: { $first: '$collectorInfo.telegramData' }
                        }
                    },
                    {
                        $project: {
                            _id: 0,
                            totalCollections: 1,
                            firstCollection: 1,
                            lastCollection: 1,
                            id: '$userData.id',
                            first_name: '$userData.first_name',
                            last_name: '$userData.last_name',
                            username: '$userData.username',
                            photo_url: '$userData.photo_url'
                        }
                    },
                    {
                        $sort: { totalCollections: -1, firstCollection: 1 }
                    },
                    {
                        $limit: 50
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

            const statsResult = stats[0] || { totalCollections: 0, totalUsers: 0 };

            data = {
                leaderboard,
                stats: statsResult,
                timestamp: new Date().toISOString()
            };
            
            setCache('telegram_leaderboard', data, CACHE_TTL.leaderboard);
        }
        
        res.set('Cache-Control', 'public, max-age=300');
        res.json(data);
    } catch (error) {
        console.error('❌ Leaderboard error:', error);
        res.status(500).json({ error: 'Failed to load leaderboard' });
    }
});

// ============== STATIC FILES ==============

const staticRoutes = ['/', '/admin', '/admin.html', '/collect.html', '/leaderboard.html'];
staticRoutes.forEach(route => {
    app.get(route, (req, res) => {
        const file = route === '/' ? 'index.html' : route.endsWith('.html') ? route.slice(1) : route.slice(1) + '.html';
        res.sendFile(path.join(__dirname, 'public', file));
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((error, req, res, next) => {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
const startServer = async () => {
    try {
        await connectDB();
        
        app.listen(PORT, () => {
            console.log('🚀 PlasticBoy Server OPTIMIZED');
            console.log(`📍 URL: http://localhost:${PORT}`);
            console.log(`🛡️ Admin: http://localhost:${PORT}/admin.html`);
            console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
            console.log(`📱 Telegram: @${BOT_USERNAME}`);
            console.log(`💾 Cache: ${cache.size} entries`);
            
            if (BOT_TOKEN) {
                console.log(`🔗 Webhook: ${WEBHOOK_PATH}`);
                console.log(`🔧 Setup: http://localhost:${PORT}/setup-webhook`);
            }
        });
    } catch (error) {
        console.error('❌ Startup error:', error);
        process.exit(1);
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📛 Shutting down...');
    cache.clear();
    mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📛 Shutting down...');
    cache.clear();
    mongoose.connection.close();
    process.exit(0);
});

startServer();
