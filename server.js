const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));

// Устанавливаем правильные заголовки для кириллицы
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

// MongoDB подключение
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

connectDB();

// Схема для точек на карте
const ModelPointSchema = new mongoose.Schema({
  id: { type: String, unique: true, required: true },
  name: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  status: { type: String, enum: ['available', 'collected'], default: 'available' },
  qrCode: { type: String, required: true },
  qrSecret: { type: String, required: true },
  scheduledTime: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  collectedAt: { type: Date },
  collectorInfo: {
    name: String,
    signature: String,
    selfie: String
  }
});

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Маршруты

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ИСПРАВЛЕННЫЙ роут получения точек для пользователей
app.get('/api/points', async (req, res) => {
  try {
    console.log('API /points called');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // Получаем только точки, которые должны быть доступны сейчас
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    }).select('-qrSecret');
    
    console.log(`Found ${points.length} points`);
    
    // Логируем каждую точку для отладки
    points.forEach((point, index) => {
      console.log(`Point ${index}: ${point.name}, scheduled: ${point.scheduledTime}, status: ${point.status}`);
    });
    
    // Убеждаемся что возвращаем валидный JSON
    const result = points.map(point => ({
      id: point.id,
      name: point.name,
      coordinates: {
        lat: point.coordinates.lat,
        lng: point.coordinates.lng
      },
      status: point.status,
      scheduledTime: point.scheduledTime,
      createdAt: point.createdAt,
      collectedAt: point.collectedAt,
      collectorInfo: point.collectorInfo
    }));
    
    console.log(`Returning ${result.length} points to client`);
    res.json(result);
    
  } catch (error) {
    console.error('Error in /api/points:', error);
    res.status(500).json({ 
      error: 'Ошибка получения точек',
      details: error.message 
    });
  }
});

// Получить все точки для админа
app.get('/api/admin/points', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const points = await ModelPoint.find({});
    res.json(points);
  } catch (error) {
    console.error('Error in /api/admin/points:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Создать новую точку (админ)
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
    const qrSecret = Math.random().toString(36).substring(7);
    
    const scheduledTime = new Date();
    if (delayMinutes && parseInt(delayMinutes) > 0) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Создаем URL для сканирования QR кода
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерируем QR код
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl);

    const newPoint = new ModelPoint({
      id: pointId,
      name,
      coordinates,
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    console.log(`Created new point: ${name} at ${coordinates.lat}, ${coordinates.lng}`);
    res.json(newPoint);
  } catch (error) {
    console.error('Error creating point:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Альтернативный роут для создания точки (через POST body)
app.post('/api/admin/points/create', async (req, res) => {
  try {
    const { name, coordinates, delayMinutes, adminPassword } = req.body;
    
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const pointId = Date.now().toString();
    const qrSecret = Math.random().toString(36).substring(7);
    
    const scheduledTime = new Date();
    if (delayMinutes && parseInt(delayMinutes) > 0) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Создаем URL для сканирования QR кода
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерируем QR код
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl);

    const newPoint = new ModelPoint({
      id: pointId,
      name,
      coordinates,
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    res.json(newPoint);
  } catch (error) {
    console.error('Error creating point:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Страница сбора модели
app.get('/collect.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// Получить информацию о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;

    console.log('Collect request - ID:', id, 'Secret:', secret);

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      console.log('Point not found or invalid secret');
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log('Point already collected');
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Проверяем время доступности
    const now = new Date();
    if (point.scheduledTime > now) {
      console.log('Point not yet available');
      return res.status(400).json({ error: 'This model is not yet available for collection' });
    }

    console.log('Point found:', point.name);
    res.json({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates
    });
  } catch (error) {
    console.error('Error getting collect info:', error);
    res.status(500).json({ error: 'Error getting point information' });
  }
});

// Собрать модель
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature } = req.body;

    console.log('Collect submission - ID:', id, 'Name:', name, 'Has selfie:', !!req.file);

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      console.log('Point not found for collection');
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log('Point already collected');
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Проверяем время доступности
    const now = new Date();
    if (point.scheduledTime > now) {
      console.log('Point not yet available for collection');
      return res.status(400).json({ error: 'This model is not yet available for collection' });
    }

    // Обработка селфи
    let selfieBase64 = null;
    if (req.file) {
      console.log('Processing selfie file:', req.file.originalname, req.file.size);
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Обновляем точку
    point.status = 'collected';
    point.collectedAt = new Date();
    point.collectorInfo = {
      name: name || 'Anonymous',
      signature: signature || '',
      selfie: selfieBase64
    };

    await point.save();
    console.log('Point successfully collected by:', name);
    
    res.json({ success: true, message: 'Model successfully collected!' });
  } catch (error) {
    console.error('Error collecting model:', error);
    res.status(500).json({ error: 'Error collecting model' });
  }
});

// Получить информацию о собранной точке
app.get('/api/point/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const point = await ModelPoint.findOne({ id }).select('-qrSecret');
    
    if (!point) {
      return res.status(404).json({ error: 'Точка не найдена' });
    }

    res.json(point);
  } catch (error) {
    console.error('Error getting point info:', error);
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
});

// Удалить точку (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { id } = req.params;
    const deletedPoint = await ModelPoint.findOneAndDelete({ id });
    
    if (!deletedPoint) {
      return res.status(404).json({ error: 'Point not found' });
    }

    console.log('Point deleted:', id);
    res.json({ success: true, message: 'Point deleted' });
  } catch (error) {
    console.error('Error deleting point:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Тестовый роут для создания примера точки
app.get('/api/test/create-sample', async (req, res) => {
  try {
    // Проверяем есть ли точки
    const existingPoints = await ModelPoint.countDocuments();
    
    if (existingPoints > 0) {
      return res.json({ message: 'Sample points already exist', count: existingPoints });
    }
    
    // Создаем тестовую точку
    const pointId = Date.now().toString();
    const qrSecret = Math.random().toString(36).substring(7);
    
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl);

    const samplePoint = new ModelPoint({
      id: pointId,
      name: 'Тестовая модель',
      coordinates: {
        lat: 43.2220,
        lng: 76.8512
      },
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime: new Date(), // Доступна сразу
      status: 'available'
    });

    await samplePoint.save();
    console.log('Sample point created');
    
    res.json({ 
      success: true, 
      message: 'Sample point created',
      point: {
        id: samplePoint.id,
        name: samplePoint.name,
        coordinates: samplePoint.coordinates
      }
    });
    
  } catch (error) {
    console.error('Error creating sample point:', error);
    res.status(500).json({ error: 'Failed to create sample point' });
  }
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Обработка несуществующих роутов
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`PlasticBoy сервер запущен на порту ${PORT}`);
  console.log(`Доступ к приложению: http://localhost:${PORT}`);
  console.log(`Админ панель: http://localhost:${PORT}/admin.html`);
  console.log(`Создать тестовую точку: http://localhost:${PORT}/api/test/create-sample`);
});
