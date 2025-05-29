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

// Получить все точки для пользователей (только активные и по времени)
app.get('/api/points', async (req, res) => {
  try {
    const now = new Date();
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    }).select('-qrSecret');
    
    res.json(points);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения точек' });
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
    if (delayMinutes) {
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

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
    }

    if (point.status === 'collected') {
      return res.status(400).json({ error: 'Эта модель уже была собрана' });
    }

    res.json({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения информации о точке' });
  }
});

// Собрать модель
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature } = req.body;

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      return res.status(404).json({ error: 'Точка не найдена или неверный QR код' });
    }

    if (point.status === 'collected') {
      return res.status(400).json({ error: 'Эта модель уже была собрана' });
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
      name: name || 'Аноним',
      signature: signature || '',
      selfie: selfieBase64
    };

    await point.save();
    
    res.json({ success: true, message: 'Модель успешно собрана!' });
  } catch (error) {
    console.error('Ошибка сбора модели:', error);
    res.status(500).json({ error: 'Ошибка сбора модели' });
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
    res.status(500).json({ error: 'Ошибка получения информации' });
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
    if (delayMinutes) {
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

    res.json({ success: true, message: 'Point deleted' });
  } catch (error) {
    console.error('Error deleting point:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`PlasticBoy сервер запущен на порту ${PORT}`);
});
