const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ОПТИМИЗИРОВАННЫЕ Middleware для максимальной скорости
app.use(cors({
    origin: true,
    credentials: true,
    optionsSuccessStatus: 200 // Для старых браузеров
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы с кэшированием
app.use(express.static('public', {
    maxAge: '1d', // Кэш на день для статики
    etag: true,
    lastModified: true
}));

// Компрессия ответов
app.use(require('compression')());

// Кэш для точек в памяти для МГНОВЕННОЙ отдачи
let pointsCache = {
    public: null,      // Кэш для пользователей
    admin: null,       // Кэш для админов
    lastUpdate: 0,     // Время последнего обновления
    etag: null         // ETag для кэширования
};

// Multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Только изображения разрешены'));
        }
    }
});

// ОПТИМИЗИРОВАННОЕ MongoDB подключение
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
            maxPoolSize: 10,        // Максимум 10 соединений
            serverSelectionTimeoutMS: 5000, // Быстрый таймаут
            socketTimeoutMS: 45000, // Таймаут сокета
            maxIdleTimeMS: 30000,   // Время жизни неактивных соединений
            retryWrites: true,      // Повторные попытки записи
            w: 'majority'           // Подтверждение записи
        });
        console.log(`⚡ MongoDB подключена БЫСТРО: ${conn.connection.host}`);
        
        // Инициализируем кэш при подключении
        await initializeCache();
    } catch (error) {
        console.error('❌ Ошибка подключения к MongoDB:', error.message);
        
        // Пытаемся подключиться с минимальными настройками
        try {
            console.log('🔄 Пробуем подключение с базовыми настройками...');
            const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy');
            console.log(`✅ MongoDB подключена (базовые настройки): ${conn.connection.host}`);
            await initializeCache();
        } catch (fallbackError) {
            console.error('💥 Критическая ошибка подключения к MongoDB:', fallbackError.message);
            process.exit(1);
        }
    }
};

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

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// МГНОВЕННАЯ инициализация кэша
async function initializeCache() {
    try {
        console.log('⚡ Инициализация МГНОВЕННОГО кэша...');
        const success = await updatePointsCache();
        if (success) {
            console.log('✅ Кэш готов для мгновенной отдачи');
        } else {
            console.log('⚠️ Кэш будет инициализирован при первом запросе');
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации кэша:', error);
        console.log('🔄 Кэш будет создан при первом обращении к данным');
    }
}

// БЫСТРОЕ обновление кэша
async function updatePointsCache() {
    try {
        const startTime = Date.now();
        
        // Проверяем состояние подключения к БД
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️ База данных не подключена, пропускаем обновление кэша');
            return false;
        }
        
        // Параллельные запросы для скорости
        const [allPoints, publicPoints] = await Promise.all([
            ModelPoint.find({}).lean().exec(), // lean() для скорости
            ModelPoint.find({
                scheduledTime: { $lte: new Date() }
            }).select('-qrSecret').lean().exec()
        ]);
        
        // Обновляем кэш
        pointsCache.admin = allPoints;
        pointsCache.public = publicPoints;
        pointsCache.lastUpdate = Date.now();
        pointsCache.etag = `"${Date.now()}-${allPoints.length}"`;
        
        const updateTime = Date.now() - startTime;
        console.log(`⚡ Кэш обновлен за ${updateTime}ms (${allPoints.length} точек)`);
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка обновления кэша:', error);
        return false;
    }
}

// Автообновление кэша каждые 30 секунд
setInterval(updatePointsCache, 30000);

// Обновление кэша при изменениях
function invalidateCache() {
    pointsCache.lastUpdate = 0; // Принудительное обновление
    updatePointsCache();
}

connectDB();

// МАРШРУТЫ

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// МГНОВЕННОЕ получение точек для пользователей
app.get('/api/points', async (req, res) => {
    try {
        // Проверяем свежесть кэша
        if (!pointsCache.public || (Date.now() - pointsCache.lastUpdate > 60000)) {
            console.log('🔄 Обновляем кэш точек...');
            await updatePointsCache();
        }
        
        // Если кэш доступен - используем его
        if (pointsCache.public) {
            // Устанавливаем заголовки для кэширования
            res.set({
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'public, max-age=30', // Кэш на 30 секунд
                'ETag': pointsCache.etag,
                'Last-Modified': new Date(pointsCache.lastUpdate).toUTCString()
            });
            
            // Проверяем If-None-Match для 304 ответа
            if (req.get('If-None-Match') === pointsCache.etag) {
                return res.status(304).end();
            }
            
            // МГНОВЕННАЯ отдача из кэша
            return res.json(pointsCache.public);
        }
        
        // Если кэш недоступен - делаем прямой запрос к БД
        console.log('⚠️ Кэш недоступен, прямой запрос к БД');
        const now = new Date();
        const points = await ModelPoint.find({
            scheduledTime: { $lte: now }
        }).select('-qrSecret').lean().exec();
        
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'public, max-age=10' // Короткий кэш при проблемах
        });
        
        res.json(points || []);
        
    } catch (error) {
        console.error('❌ Ошибка получения точек:', error);
        
        // Возвращаем кэшированные данные если есть
        if (pointsCache.public) {
            console.log('📦 Возвращаем устаревшие данные из кэша');
            return res.json(pointsCache.public);
        }
        
        // Иначе возвращаем пустой массив
        res.status(500).json([]);
    }
});

// БЫСТРОЕ получение точек для админа
app.get('/api/admin/points', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }
        
        // Проверяем свежесть кэша
        if (!pointsCache.admin || (Date.now() - pointsCache.lastUpdate > 60000)) {
            await updatePointsCache();
        }
        
        res.set({
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'private, max-age=10' // Короткий кэш для админа
        });
        
        // МГНОВЕННАЯ отдача админских данных
        res.json(pointsCache.admin || []);
        
    } catch (error) {
        console.error('❌ Ошибка получения админских точек:', error);
        res.status(500).json({ error: 'Failed to load points' });
    }
});

// БЫСТРОЕ создание новой точки (админ)
app.post('/api/admin/points', async (req, res) => {
    try {
        const password = req.headers['x-admin-password'] 
            ? decodeURIComponent(req.headers['x-admin-password'])
            : req.headers.authorization;
            
        if (password !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const { name, coordinates, delayMinutes } = req.body;
        
        // Валидация
        if (!name || !coordinates || !coordinates.lat || !coordinates.lng) {
            return res.status(400).json({ error: 'Неверные данные' });
        }
        
        const pointId = Date.now().toString();
        const qrSecret = Math.random().toString(36).substring(7);
        
        const scheduledTime = new Date();
        if (delayMinutes && !isNaN(delayMinutes)) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        // Определяем протокол и хост
        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        // Быстрая генерация QR кода
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
            name,
            coordinates: {
                lat: parseFloat(coordinates.lat),
                lng: parseFloat(coordinates.lng)
            },
            qrCode: qrCodeDataUrl,
            qrSecret,
            scheduledTime
        });

        // Быстрое сохранение
        await newPoint.save();
        
        // МГНОВЕННОЕ обновление кэша
        invalidateCache();
        
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

// Альтернативный роут для создания точки
app.post('/api/admin/points/create', async (req, res) => {
    try {
        const { name, coordinates, delayMinutes, adminPassword } = req.body;
        
        if (adminPassword !== process.env.ADMIN_PASSWORD) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        // Валидация
        if (!name || !coordinates) {
            return res.status(400).json({ error: 'Неверные данные' });
        }

        const pointId = Date.now().toString();
        const qrSecret = Math.random().toString(36).substring(7);
        
        const scheduledTime = new Date();
        if (delayMinutes && !isNaN(delayMinutes)) {
            scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
        }

        const protocol = req.get('x-forwarded-proto') || req.protocol;
        const host = req.get('host');
        const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
        
        const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
            width: 300,
            margin: 2
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
        invalidateCache();
        
        res.status(201).json(newPoint);
        
    } catch (error) {
        console.error('❌ Ошибка создания точки (альт):', error);
        res.status(500).json({ error: 'Ошибка создания точки' });
    }
});

// Страница сбора модели
app.get('/collect.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// БЫСТРОЕ получение информации о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { secret } = req.query;

        if (!id || !secret) {
            return res.status(400).json({ error: 'Неверные параметры' });
        }

        console.log(`⚡ Запрос сбора - ID: ${id}`);

        // Быстрый поиск с индексом
        const point = await ModelPoint.findOne({ 
            id, 
            qrSecret: secret 
        }).lean().exec();
        
        if (!point) {
            console.log('❌ Точка не найдена или неверный секрет');
            return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
        }

        if (point.status === 'collected') {
            console.log('⚠️ Точка уже собрана');
            return res.status(400).json({ error: 'Эта модель уже собрана' });
        }

        console.log(`✅ Точка найдена: ${point.name}`);
        
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

// БЫСТРЫЙ сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
    try {
        const { id } = req.params;
        const { secret, name, signature } = req.body;

        if (!id || !secret || !name) {
            return res.status(400).json({ error: 'Не все данные заполнены' });
        }

        console.log(`⚡ Попытка сбора - ID: ${id}, Имя: ${name}`);

        // Быстрый поиск
        const point = await ModelPoint.findOne({ 
            id, 
            qrSecret: secret 
        }).exec();
        
        if (!point) {
            console.log('❌ Точка не найдена для сбора');
            return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
        }

        if (point.status === 'collected') {
            console.log('⚠️ Точка уже собрана');
            return res.status(400).json({ error: 'Эта модель уже собрана' });
        }

        // Быстрая обработка селфи
        let selfieBase64 = null;
        if (req.file) {
            console.log(`📸 Обработка селфи: ${req.file.size} байт`);
            selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        }

        // БЫСТРОЕ обновление точки
        point.status = 'collected';
        point.collectedAt = new Date();
        point.collectorInfo = {
            name: name.trim(),
            signature: signature ? signature.trim() : '',
            selfie: selfieBase64
        };

        await point.save();
        
        // МГНОВЕННОЕ обновление кэша
        invalidateCache();
        
        console.log(`✅ Точка успешно собрана: ${name}`);
        
        res.json({ success: true, message: 'Модель успешно собрана!' });
        
    } catch (error) {
        console.error('❌ Ошибка сбора модели:', error);
        res.status(500).json({ error: 'Ошибка сбора модели' });
    }
});

// БЫСТРОЕ получение информации о собранной точке с кэшем
const detailsCache = new Map();

app.get('/api/point/:id/info', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Проверяем кэш деталей
        const cacheKey = `details_${id}`;
        const cached = detailsCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 минут кэш
            return res.json(cached.data);
        }
        
        const point = await ModelPoint.findOne({ id })
            .select('-qrSecret')
            .lean()
            .exec();
        
        if (!point) {
            return res.status(404).json({ error: 'Точка не найдена' });
        }

        // Кэшируем результат
        detailsCache.set(cacheKey, {
            data: point,
            timestamp: Date.now()
        });
        
        // Очищаем старые записи из кэша
        if (detailsCache.size > 100) {
            const oldEntries = Array.from(detailsCache.entries())
                .filter(([key, value]) => Date.now() - value.timestamp > 600000);
            oldEntries.forEach(([key]) => detailsCache.delete(key));
        }

        res.json(point);
        
    } catch (error) {
        console.error('❌ Ошибка получения информации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// БЫСТРОЕ удаление точки (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
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
            return res.status(404).json({ error: 'Точка не найдена' });
        }

        // МГНОВЕННОЕ обновление кэша
        invalidateCache();
        
        // Очищаем кэш деталей
        detailsCache.delete(`details_${id}`);

        res.json({ success: true, message: 'Точка удалена' });
        
    } catch (error) {
        console.error('❌ Ошибка удаления точки:', error);
        res.status(500).json({ error: 'Ошибка удаления' });
    }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: Math.floor(uptime),
        memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        },
        cache: {
            publicPoints: pointsCache.public ? pointsCache.public.length : 0,
            adminPoints: pointsCache.admin ? pointsCache.admin.length : 0,
            lastUpdate: new Date(pointsCache.lastUpdate).toISOString(),
            detailsCacheSize: detailsCache.size
        }
    });
});

// Админ панель
app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Обработка ошибок 404
app.use((req, res) => {
    res.status(404).json({ error: 'Страница не найдена' });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('💥 Глобальная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('⚡ Получен SIGTERM, завершение работы...');
    await mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('⚡ Получен SIGINT, завершение работы...');
    await mongoose.connection.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`⚡ PlasticBoy сервер запущен МОЛНИЕНОСНО на порту ${PORT}`);
    console.log(`🚀 Кэширование включено для максимальной скорости`);
});
