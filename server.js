const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Кэш для быстрой отдачи точек
let pointsCache = null;
let cacheUpdateTime = 0;
const CACHE_TTL = 10000; // 10 секунд кэша

// Middleware с оптимизациями
app.use(cors({
    origin: '*',
    credentials: false,
    optionsSuccessStatus: 200,
    maxAge: 86400 // Кэш CORS на сутки
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы с кэшированием
app.use(express.static('public', {
    maxAge: '1d', // Кэш на сутки
    etag: true,
    lastModified: true
}));

// Оптимизированные заголовки для быстрой отдачи
app.use((req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    
    // Заголовки для быстрой загрузки
    if (req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-cache, must-revalidate');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Response-Time', Date.now());
    }
    
    next();
});

// Multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images allowed'));
        }
    }
});

// Исправленное подключение к MongoDB (совместимые опции)
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
            // Только совместимые опции
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxIdleTimeMS: 30000
        });
        
        console.log(`MongoDB подключена БЫСТРО: ${conn.connection.host}`);
        
        // Предзагружаем точки в кэш
        await updatePointsCache();
        
    } catch (error) {
        console.error('Ошибка подключения к MongoDB:', error.message);
        process.exit(1);
    }
};

// Оптимизированная схема с индексами для быстрых запросов
const ModelPointSchema = new mongoose.Schema({
    id: { type: String, unique: true, required: true, index: true },
    name: { type: String, required: true, index: true },
    coordinates: {
        lat: { type: Number, required: true, index: true },
        lng: { type: Number, required: true, index: true }
    },
    status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
    qrCode: { type: String, required: true },
    qrSecret: { type: String, required: true, index: true },
    scheduledTime: { type: Date, default: Date.now, index: true },
    createdAt: { type: Date, default: Date.now, index: true },
    collectedAt: { type: Date, index: true },
    collectorInfo: {
        name: String,
        signature: String,
        selfie: String
    }
}, {
    // Оптимизации схемы
    versionKey: false,
    minimize: false,
    collection: 'modelpoints'
});

// Составной индекс для быстрых запросов
ModelPointSchema.index({ scheduledTime: 1, status: 1 });
ModelPointSchema.index({ id: 1, qrSecret: 1 });

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Функция обновления кэша
async function updatePointsCache() {
    try {
        const now = new Date();
        const points = await ModelPoint.find({
            scheduledTime: { $lte: now }
        })
        .select('-qrSecret') // Исключаем секретные данные
        .lean() // Быстрее обработка
        .exec();
        
        pointsCache = points;
        cacheUpdateTime = Date.now();
        
        console.log(`⚡ Кэш обновлен: ${points.length} точек`);
        return points;
    } catch (error) {
        console.error('Ошибка обновления кэша:', error);
        return pointsCache || [];
    }
}

// Автоматическое обновление кэша каждые 30 секунд
setInterval(updatePointsCache, 30000);

connectDB();

// МАРШРУТЫ

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// СУПЕР-БЫСТРОЕ получение точек для пользователей
app.get('/api/points', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        // Проверяем актуальность кэша
        const now = Date.now();
        const cacheAge = now - cacheUpdateTime;
        
        let points;
        if (pointsCache && cacheAge < CACHE_TTL) {
            // Используем кэш для максимальной скорости
            points = pointsCache;
            res.setHeader('X-Cache', 'HIT');
        } else {
            // Обновляем кэш
            points = await updatePointsCache();
            res.setHeader('X-Cache', 'MISS');
        }
        
        // Дополнительная фильтрация по времени (быстрая)
        const currentTime = new Date();
        const filteredPoints = points.filter(point => 
            new Date(point.scheduledTime) <= currentTime
        );
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // в миллисекундах
        
        res.setHeader('X-Response-Time-Ms', responseTime.toFixed(2));
        res.setHeader('X-Points-Count', filteredPoints.length);
        
        console.log(`⚡ БЫСТРО отдано ${filteredPoints.length} точек за ${responseTime.toFixed(2)}ms`);
        
        res.json(filteredPoints);
        
    } catch (error) {
        console.error('Ошибка получения точек:', error);
        
        // Возвращаем кэш даже при ошибке
        if (pointsCache) {
            res.setHeader('X-Cache', 'ERROR-FALLBACK');
            res.json(pointsCache);
        } else {
            res.status(500).json({ 
                error: 'Ошибка получения точек',
                timestamp: new Date().toISOString()
            });
        }
    }
});

// Быстрое получение всех точек для админа
app.get('/api/admin/points', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Быстрый запрос всех точек с оптимизацией
        const points = await ModelPoint.find({})
            .lean() // Быстрее обработка
            .sort({ createdAt: -1 }) // Сортировка на уровне БД
            .exec();
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        res.setHeader('X-Response-Time-Ms', responseTime.toFixed(2));
        res.setHeader('X-Points-Count', points.length);
        
        console.log(`⚡ АДМИН: отдано ${points.length} точек за ${responseTime.toFixed(2)}ms`);
        
        res.json(points);
    } catch (error) {
        console.error('Ошибка получения точек для админа:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// Быстрое создание новой точки (админ)
app.post('/api/admin/points', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const { name, coordinates, delayMinutes } = req.body;
        const pointId = Date.now().toString();
        const qrSecret = Math.random().toString(36).substring(7);
        
        const scheduledTime = new Date();
        if (delayMinutes) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        // Создаем URL для сканирования QR кода
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        // Быстрая генерация QR кода
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
            width: 256,
            margin: 1,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        const newPoint = new ModelPoint({
            id: pointId,
            name,
            coordinates,
            qrCode: qrCodeDataUrl,
            qrSecret,
            scheduledTime
        });

        await newPoint.save();
        
        // Обновляем кэш асинхронно
        setImmediate(updatePointsCache);
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        console.log(`⚡ СОЗДАНА точка ${pointId} за ${responseTime.toFixed(2)}ms`);
        
        res.json(newPoint);
    } catch (error) {
        console.error('Ошибка создания точки:', error);
        res.status(500).json({ error: 'Failed to create point' });
    }
});

// Страница сбора модели
app.get('/collect.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// Быстрое получение информации о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { id } = req.params;
        const { secret } = req.query;

        console.log('⚡ БЫСТРЫЙ запрос сбора - ID:', id, 'Secret:', secret?.substring(0, 3) + '...');

        // Быстрый запрос с индексом
        const point = await ModelPoint.findOne({ id, qrSecret: secret })
            .select('id name coordinates status')
            .lean()
            .exec();
        
        if (!point) {
            console.log('❌ Точка не найдена или неверный секрет');
            return res.status(404).json({ error: 'Point not found or invalid QR code' });
        }

        if (point.status === 'collected') {
            console.log('❌ Точка уже собрана');
            return res.status(400).json({ error: 'This model has already been collected' });
        }

        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        console.log(`⚡ НАЙДЕНА точка ${point.name} за ${responseTime.toFixed(2)}ms`);
        
        res.json({
            id: point.id,
            name: point.name,
            coordinates: point.coordinates
        });
    } catch (error) {
        console.error('Ошибка получения информации для сбора:', error);
        res.status(500).json({ error: 'Error getting point information' });
    }
});

// Быстрый сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { id } = req.params;
        const { secret, name, signature } = req.body;

        console.log('⚡ БЫСТРАЯ отправка сбора - ID:', id, 'Name:', name, 'Has selfie:', !!req.file);

        // Быстрый поиск точки
        const point = await ModelPoint.findOne({ id, qrSecret: secret }).exec();
        
        if (!point) {
            console.log('❌ Точка не найдена для сбора');
            return res.status(404).json({ error: 'Point not found or invalid QR code' });
        }

        if (point.status === 'collected') {
            console.log('❌ Точка уже собрана');
            return res.status(400).json({ error: 'This model has already been collected' });
        }

        // Быстрая обработка селфи
        let selfieBase64 = null;
        if (req.file) {
            console.log(`⚡ Обработка селфи: ${req.file.originalname}, ${Math.round(req.file.size/1024)}KB`);
            selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        // Быстрое обновление точки
        const updateData = {
            status: 'collected',
            collectedAt: new Date(),
            collectorInfo: {
                name: name || 'Anonymous',
                signature: signature || '',
                selfie: selfieBase64
            }
        };

        await ModelPoint.updateOne({ _id: point._id }, updateData).exec();
        
        // Асинхронное обновление кэша
        setImmediate(updatePointsCache);
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        console.log(`⚡ СОБРАНА точка ${id} пользователем ${name} за ${responseTime.toFixed(2)}ms`);
        
        res.json({ 
            success: true, 
            message: 'Model successfully collected!',
            responseTime: responseTime.toFixed(2) + 'ms'
        });
    } catch (error) {
        console.error('Ошибка сбора модели:', error);
        res.status(500).json({ error: 'Error collecting model' });
    }
});

// Быстрое получение информации о собранной точке
app.get('/api/point/:id/info', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { id } = req.params;
        
        // Быстрый поиск с оптимизацией
        const point = await ModelPoint.findOne({ id })
            .select('-qrSecret')
            .lean()
            .exec();
        
        if (!point) {
            return res.status(404).json({ error: 'Точка не найдена' });
        }

        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        res.setHeader('X-Response-Time-Ms', responseTime.toFixed(2));
        
        console.log(`⚡ ИНФОРМАЦИЯ о точке ${id} за ${responseTime.toFixed(2)}ms`);
        
        res.json(point);
    } catch (error) {
        console.error('Ошибка получения информации:', error);
        res.status(500).json({ error: 'Ошибка получения информации' });
    }
});

// Альтернативный роут для создания точки (через POST body)
app.post('/api/admin/points/create', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { name, coordinates, delayMinutes, adminPassword } = req.body;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const pointId = Date.now().toString();
        const qrSecret = Math.random().toString(36).substring(7);
        
        const scheduledTime = new Date();
        if (delayMinutes) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        // Создаем URL для сканирования QR кода
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        // Быстрая генерация QR кода
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
            width: 256,
            margin: 1
        });

        const newPoint = new ModelPoint({
            id: pointId,
            name,
            coordinates,
            qrCode: qrCodeDataUrl,
            qrSecret,
            scheduledTime
        });

        await newPoint.save();
        
        // Асинхронное обновление кэша
        setImmediate(updatePointsCache);
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        console.log(`⚡ СОЗДАНА точка ${pointId} (альт) за ${responseTime.toFixed(2)}ms`);
        
        res.json(newPoint);
    } catch (error) {
        console.error('Ошибка создания точки:', error);
        res.status(500).json({ error: 'Failed to create point' });
    }
});

// Быстрое удаление точки (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const { id } = req.params;
        const deletedPoint = await ModelPoint.findOneAndDelete({ id }).exec();
        
        if (!deletedPoint) {
            return res.status(404).json({ error: 'Point not found' });
        }

        // Асинхронное обновление кэша
        setImmediate(updatePointsCache);
        
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;
        
        console.log(`⚡ УДАЛЕНА точка ${id} за ${responseTime.toFixed(2)}ms`);
        
        res.json({ 
            success: true, 
            message: 'Point deleted',
            responseTime: responseTime.toFixed(2) + 'ms'
        });
    } catch (error) {
        console.error('Ошибка удаления точки:', error);
        res.status(500).json({ error: 'Failed to delete point' });
    }
});

// Быстрая проверка работоспособности
app.get('/health', (req, res) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: `${Math.floor(uptime)}s`,
        memory: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
        pointsCache: pointsCache ? pointsCache.length : 0,
        cacheAge: `${Math.round((Date.now() - cacheUpdateTime) / 1000)}s`
    });
});

// Быстрый эндпоинт для сброса кэша (для отладки)
app.post('/api/admin/cache/reset', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        await updatePointsCache();
        
        res.json({ 
            success: true, 
            message: 'Cache reset',
            pointsCount: pointsCache ? pointsCache.length : 0
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset cache' });
    }
});

// Обработка ошибок
app.use((error, req, res, next) => {
    console.error('Серверная ошибка:', error);
    
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large' });
        }
    }
    
    res.status(500).json({ 
        error: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// Обработка несуществующих маршрутов
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM получен, graceful shutdown...');
    mongoose.connection.close(() => {
        console.log('MongoDB соединение закрыто');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT получен, graceful shutdown...');
    mongoose.connection.close(() => {
        console.log('MongoDB соединение закрыто');
        process.exit(0);
    });
});

app.listen(PORT, () => {
    console.log(`🚀 PlasticBoy БЫСТРЫЙ сервер запущен на порту ${PORT}`);
    console.log(`⚡ Оптимизации: кэширование, индексы, lean queries`);
    console.log(`💾 Кэш точек обновляется каждые 30 секунд`);
    console.log(`📊 Мониторинг производительности включен`);
});
