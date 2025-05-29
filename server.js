const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Оптимизированные middleware
app.use(cors({
  origin: true,
  credentials: true
}));

// Сжатие JSON ответов
app.use(express.json({ 
  limit: '15mb', // Увеличили лимит для JSON
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Агрессивное кэширование статических файлов
app.use(express.static('public', {
  maxAge: '1d',
  etag: true,
  lastModified: true,
  immutable: true
}));

// Оптимизированное подключение к MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 3000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
      maxIdleTimeMS: 30000
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

connectDB();

// Супероптимизированная схема с индексами
const ModelPointSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true, index: true },
  name: { type: String, required: true, maxlength: 100 },
  coordinates: {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 }
  },
  status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
  qrCode: { type: String, required: true },
  qrSecret: { type: String, required: true, index: true },
  scheduledTime: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now },
  collectedAt: { type: Date, sparse: true },
  collectorInfo: {
    name: { type: String, maxlength: 50 },
    signature: { type: String, maxlength: 200 },
    selfie: String
  }
}, {
  collection: 'points',
  versionKey: false // Убираем __v поле
});

// Составные индексы для супербыстрого поиска
ModelPointSchema.index({ id: 1, qrSecret: 1 });
ModelPointSchema.index({ status: 1, scheduledTime: 1 });
ModelPointSchema.index({ scheduledTime: 1, status: 1 });

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Кэш в памяти
let pointsCache = null;
let adminPointsCache = null;
let cacheTimestamp = 0;
let adminCacheTimestamp = 0;
const CACHE_DURATION = 20000; // 20 секунд
const ADMIN_CACHE_DURATION = 10000; // 10 секунд для админа

// Функции очистки кэша
const clearCache = () => {
  pointsCache = null;
  adminPointsCache = null;
  cacheTimestamp = 0;
  adminCacheTimestamp = 0;
};

// Оптимизированный multer с увеличенным лимитом
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { 
    fileSize: 10 * 1024 * 1024, // Увеличили до 10MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Images only'), false);
    }
  }
});

// Роуты с кэшированием

// Главная страница
app.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/collect.html', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// Супербыстрое получение точек с кэшем
app.get('/api/points', async (req, res) => {
  try {
    const now = Date.now();
    
    // Проверяем кэш
    if (pointsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      res.setHeader('Cache-Control', 'public, max-age=20');
      return res.json(pointsCache);
    }
    
    // Получаем только нужные поля
    const points = await ModelPoint.find({
      scheduledTime: { $lte: new Date() }
    }, {
      id: 1,
      name: 1,
      coordinates: 1,
      status: 1,
      collectedAt: 1,
      'collectorInfo.name': 1
    }).lean().limit(100).exec();
    
    pointsCache = points;
    cacheTimestamp = now;
    
    res.setHeader('Cache-Control', 'public, max-age=20');
    res.json(points);
  } catch (error) {
    console.error('Points error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Админ точки с кэшем
app.get('/api/admin/points', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const now = Date.now();
    
    // Админ кэш
    if (adminPointsCache && (now - adminCacheTimestamp) < ADMIN_CACHE_DURATION) {
      return res.json(adminPointsCache);
    }
    
    const points = await ModelPoint.find({}).lean().limit(200).exec();
    adminPointsCache = points;
    adminCacheTimestamp = now;
    
    res.json(points);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load admin points' });
  }
});

// Супербыстрое создание точки
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
      return res.status(400).json({ error: 'Invalid data' });
    }
    
    const pointId = Date.now().toString();
    const qrSecret = Math.random().toString(36).substring(2, 8);
    
    const scheduledTime = new Date();
    if (delayMinutes && delayMinutes > 0) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    const protocol = req.get('x-forwarded-proto') || 'https';
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Быстрая генерация QR
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: 'L'
    });

    const newPoint = new ModelPoint({
      id: pointId,
      name: name.substring(0, 100),
      coordinates,
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    clearCache();
    
    res.json(newPoint);
  } catch (error) {
    console.error('Create point error:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Альтернативный метод создания
app.post('/api/admin/points/create', async (req, res) => {
  try {
    const { name, coordinates, delayMinutes, adminPassword } = req.body;
    
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const pointId = Date.now().toString();
    const qrSecret = Math.random().toString(36).substring(2, 8);
    
    const scheduledTime = new Date();
    if (delayMinutes && delayMinutes > 0) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    const protocol = req.get('x-forwarded-proto') || 'https';
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 150,
      margin: 1,
      errorCorrectionLevel: 'L'
    });

    const newPoint = new ModelPoint({
      id: pointId,
      name: name.substring(0, 100),
      coordinates,
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    clearCache();
    
    res.json(newPoint);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Быстрая проверка точки для сбора
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;

    const point = await ModelPoint.findOne(
      { id, qrSecret: secret }, 
      { name: 1, coordinates: 1, status: 1 }
    ).lean().exec();
    
    if (!point) {
      return res.status(404).json({ error: 'Point not found' });
    }

    if (point.status === 'collected') {
      return res.status(400).json({ error: 'Already collected' });
    }

    res.json({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates
    });
  } catch (error) {
    res.status(500).json({ error: 'Error getting point info' });
  }
});

// Супербыстрый сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature } = req.body;

    // Валидация
    if (!name || name.length > 50) {
      return res.status(400).json({ error: 'Invalid name' });
    }

    let selfieBase64 = null;
    if (req.file) { // Убрали ограничение на размер
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      console.log('Selfie processed, original size:', req.file.size);
    }

    // Атомарное обновление
    const updateResult = await ModelPoint.updateOne(
      { 
        id, 
        qrSecret: secret, 
        status: 'available' 
      },
      {
        $set: {
          status: 'collected',
          collectedAt: new Date(),
          collectorInfo: {
            name: name.substring(0, 50),
            signature: signature ? signature.substring(0, 200) : '',
            selfie: selfieBase64
          }
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(400).json({ error: 'Point not available' });
    }

    clearCache();
    res.json({ success: true, message: 'Collected successfully!' });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ error: 'Collection failed' });
  }
});

// Быстрая информация о точке
app.get('/api/point/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const point = await ModelPoint.findOne({ id }, { qrSecret: 0 }).lean().exec();
    
    if (!point) {
      return res.status(404).json({ error: 'Point not found' });
    }

    res.json(point);
  } catch (error) {
    res.status(500).json({ error: 'Error getting info' });
  }
});

// Быстрое удаление точки
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { id } = req.params;
    const result = await ModelPoint.deleteOne({ id });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Point not found' });
    }

    clearCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    uptime: Math.floor(process.uptime()),
    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
  });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size: 10MB' });
    }
  }
  console.error('Server error:', error);
  res.status(500).json({ error: 'Server error' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`PlasticBoy optimized server running on port ${PORT}`);
});
