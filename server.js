const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS без ограничений
app.use(cors({
  origin: true,
  credentials: true
}));

// Express с огромными лимитами
app.use(express.json({ 
  limit: '100mb'
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '100mb',
  parameterLimit: 50000
}));

// Статические файлы
app.use(express.static('public', {
  maxAge: '1d',
  etag: true
}));

// MongoDB подключение
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

connectDB();

// Схема без ограничений размера
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
  createdAt: { type: Date, default: Date.now },
  collectedAt: { type: Date },
  collectorInfo: {
    name: String,
    signature: String,
    selfie: String // Без ограничения размера
  }
}, {
  collection: 'points',
  versionKey: false,
  strict: false // Позволяет любые данные
});

// Индексы
ModelPointSchema.index({ id: 1, qrSecret: 1 });
ModelPointSchema.index({ status: 1, scheduledTime: 1 });

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// MULTER БЕЗ ОГРАНИЧЕНИЙ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Infinity, // БЕЗ ОГРАНИЧЕНИЙ!
    files: 10,
    parts: Infinity,
    headerPairs: Infinity
  }
  // Убрали fileFilter - принимаем любые файлы
});

// Кэш
let pointsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 20000;

function clearCache() {
  pointsCache = null;
  cacheTimestamp = 0;
}

// Роуты
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/collect.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// API точек
app.get('/api/points', async (req, res) => {
  try {
    const now = Date.now();
    
    if (pointsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json(pointsCache);
    }
    
    const points = await ModelPoint.find({
      scheduledTime: { $lte: new Date() }
    }, {
      id: 1,
      name: 1,
      coordinates: 1,
      status: 1,
      collectedAt: 1,
      'collectorInfo.name': 1
    }).lean().exec();
    
    pointsCache = points;
    cacheTimestamp = now;
    
    res.json(points);
  } catch (error) {
    console.error('Points error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Админ точки
app.get('/api/admin/points', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const points = await ModelPoint.find({}).lean().exec();
    res.json(points);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load admin points' });
  }
});

// Создание точки
app.post('/api/admin/points', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { name, coordinates, delayMinutes } = req.body;
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
      width: 200,
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
    clearCache();
    
    res.json(newPoint);
  } catch (error) {
    console.error('Create point error:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Альтернативное создание точки
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
      width: 200,
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
    clearCache();
    
    res.json(newPoint);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Получение информации о точке для сбора
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

// СБОР МОДЕЛИ БЕЗ ОГРАНИЧЕНИЙ
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    console.log('Collect request received');
    console.log('Body:', req.body);
    console.log('File:', req.file ? `${req.file.originalname} (${req.file.size} bytes)` : 'No file');
    
    const { id } = req.params;
    const { secret, name, signature } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }

    // ПРИНИМАЕМ ЛЮБОЙ ФАЙЛ ЛЮБОГО РАЗМЕРА
    let selfieBase64 = null;
    if (req.file) {
      console.log(`Processing file: ${req.file.originalname}, size: ${req.file.size} bytes, type: ${req.file.mimetype}`);
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      console.log('File converted to base64 successfully');
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
            name: name.trim(),
            signature: signature || '',
            selfie: selfieBase64
          }
        }
      }
    );

    console.log('Update result:', updateResult);

    if (updateResult.matchedCount === 0) {
      return res.status(400).json({ error: 'Point not available or already collected' });
    }

    clearCache();
    console.log('Point collected successfully');
    
    res.json({ success: true, message: 'Collected successfully!' });
  } catch (error) {
    console.error('Collect error:', error);
    res.status(500).json({ error: 'Collection failed: ' + error.message });
  }
});

// Информация о точке
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

// Удаление точки
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

// ОБРАБОТКА ОШИБОК БЕЗ ОГРАНИЧЕНИЙ
app.use((error, req, res, next) => {
  console.error('Error handler:', error);
  
  if (error instanceof multer.MulterError) {
    console.log('Multer error:', error.code, error.message);
    return res.status(400).json({ error: 'File upload error: ' + error.message });
  }
  
  if (error.type === 'entity.too.large') {
    console.log('Entity too large error');
    return res.status(400).json({ error: 'Request too large' });
  }
  
  res.status(500).json({ error: 'Server error: ' + error.message });
});

// 404 handler
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
  console.log(`PlasticBoy server running on port ${PORT} - NO FILE LIMITS!`);
});
