const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Оптимизированная конфигурация Express
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: true
}));

// Увеличиваем лимиты для больших изображений, но оптимизируем обработку
app.use(express.json({ 
  limit: '50mb',
  parameterLimit: 1000,
  extended: false
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb',
  parameterLimit: 1000
}));

// Статические файлы с кешированием
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Оптимизированные заголовки для кириллицы
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Добавляем заголовки для кеширования
  if (req.path.startsWith('/api/points') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, max-age=30'); // 30 секунд кеш для точек
  }
  next();
});

// Оптимизированная конфигурация Multer - убираем лимит размера
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  // Убираем fileSize лимит для селфи
  limits: { 
    fieldSize: 50 * 1024 * 1024, // 50MB для полей
    fields: 10,
    files: 1
  }
});

// Оптимизированное подключение к MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Оптимизации для производительности
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    });
    console.log(`MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

connectDB();

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
  collectedAt: { type: Date, index: true },
  collectorInfo: {
    name: String,
    signature: String,
    selfie: String // Храним как base64, но оптимизируем запросы
  }
}, {
  // Оптимизации схемы
  collection: 'modelpoints',
  timestamps: false // Используем свои поля для времени
});

// Создаем составной индекс для часто используемых запросов
ModelPointSchema.index({ scheduledTime: 1, status: 1 });
ModelPointSchema.index({ id: 1, qrSecret: 1 }); // Для быстрого поиска при сборе

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Кеш для часто запрашиваемых данных
let pointsCache = {
  data: null,
  timestamp: 0,
  ttl: 30000 // 30 секунд
};

// Функция для сжатия изображения на клиенте (будет использоваться в JS)
function getImageCompressionScript() {
  return `
    function compressImage(file, maxWidth = 1920, quality = 0.8) {
      return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
          // Вычисляем новые размеры с сохранением пропорций
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Рисуем сжатое изображение
          ctx.drawImage(img, 0, 0, width, height);
          
          // Конвертируем в base64 с нужным качеством
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        
        img.src = URL.createObjectURL(file);
      });
    }
  `;
}

// Маршруты

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Оптимизированное получение точек для пользователей с кешированием
app.get('/api/points', async (req, res) => {
  try {
    const now = Date.now();
    
    // Проверяем кеш
    if (pointsCache.data && (now - pointsCache.timestamp) < pointsCache.ttl) {
      return res.json(pointsCache.data);
    }
    
    const currentDate = new Date();
    
    // Оптимизированный запрос с проекцией (исключаем qrSecret и большие поля)
    const points = await ModelPoint.find({
      scheduledTime: { $lte: currentDate }
    }).select('-qrSecret -collectorInfo.selfie').lean(); // lean() для лучшей производительности
    
    // Обновляем кеш
    pointsCache.data = points;
    pointsCache.timestamp = now;
    
    res.json(points);
  } catch (error) {
    console.error('Error loading points:', error);
    res.status(500).json({ error: 'Ошибка получения точек' });
  }
});

// Админские точки без кеширования (нужны актуальные данные)
app.get('/api/admin/points', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    // Для админа загружаем все данные, но оптимизируем запрос
    const points = await ModelPoint.find({}).lean();
    res.json(points);
  } catch (error) {
    console.error('Error loading admin points:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Оптимизированное создание точки
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
    if (delayMinutes) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Оптимизированная генерация URL
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Асинхронная генерация QR кода с оптимизациями
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256
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
    
    // Инвалидируем кеш при создании новой точки
    pointsCache.data = null;
    
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

// Оптимизированное получение информации о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;

    // Используем составной индекс для быстрого поиска
    const point = await ModelPoint.findOne({ 
      id, 
      qrSecret: secret 
    }).select('id name coordinates status').lean();
    
    if (!point) {
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      return res.status(400).json({ error: 'This model has already been collected' });
    }

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

// Оптимизированный сбор модели
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature } = req.body;

    // Быстрый поиск с использованием индекса
    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Обработка селфи - оптимизированная, но без ограничений размера
    let selfieBase64 = null;
    if (req.file) {
      // Проверяем MIME тип для безопасности
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid image format' });
      }
      
      console.log(`Processing selfie: ${req.file.originalname}, size: ${(req.file.size / 1024 / 1024).toFixed(2)}MB`);
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Атомарное обновление
    const updateResult = await ModelPoint.updateOne(
      { id, qrSecret: secret, status: 'available' },
      {
        $set: {
          status: 'collected',
          collectedAt: new Date(),
          collectorInfo: {
            name: name || 'Anonymous',
            signature: signature || '',
            selfie: selfieBase64
          }
        }
      }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(400).json({ error: 'Model already collected or not found' });
    }

    // Инвалидируем кеш при изменении статуса
    pointsCache.data = null;
    
    res.json({ success: true, message: 'Model successfully collected!' });
  } catch (error) {
    console.error('Error collecting model:', error);
    res.status(500).json({ error: 'Error collecting model' });
  }
});

// Оптимизированное получение информации о точке
app.get('/api/point/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const point = await ModelPoint.findOne({ id }).select('-qrSecret').lean();
    
    if (!point) {
      return res.status(404).json({ error: 'Точка не найдена' });
    }

    res.json(point);
  } catch (error) {
    console.error('Error getting point info:', error);
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
});

// Альтернативный роут для создания точки
app.post('/api/admin/points/create', async (req, res) => {
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

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      width: 256
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
    
    // Инвалидируем кеш
    pointsCache.data = null;
    
    res.json(newPoint);
  } catch (error) {
    console.error('Error creating point:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Оптимизированное удаление точки
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

    // Инвалидируем кеш
    pointsCache.data = null;

    res.json({ success: true, message: 'Point deleted' });
  } catch (error) {
    console.error('Error deleting point:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Health check с информацией о кеше
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cache: {
      hasData: !!pointsCache.data,
      age: pointsCache.data ? Date.now() - pointsCache.timestamp : 0
    }
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Получен сигнал SIGINT. Закрываем сервер...');
  await mongoose.connection.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`PlasticBoy сервер запущен на порту ${PORT}`);
  console.log(`Режим: ${process.env.NODE_ENV || 'development'}`);
});
