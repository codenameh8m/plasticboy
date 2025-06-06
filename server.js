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

// Схема для пользователей
const UserSchema = new mongoose.Schema({
  instagramUsername: { type: String, unique: true, required: true },
  displayName: { type: String },
  profilePicture: { type: String },
  collectedCount: { type: Number, default: 0 },
  collectedPoints: [{ type: String }], // массив ID собранных точек
  firstCollectedAt: { type: Date },
  lastCollectedAt: { type: Date },
  badges: [{ type: String }], // достижения
  createdAt: { type: Date, default: Date.now }
});

// Добавляем индексы для быстрого поиска
UserSchema.index({ collectedCount: -1 });
UserSchema.index({ instagramUsername: 1 });

const User = mongoose.model('User', UserSchema);

// Схема для точек на карте (обновленная)
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
    instagramUsername: String,
    displayName: String,
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

// Получить рейтинг пользователей
app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const topUsers = await User.find({ collectedCount: { $gt: 0 } })
      .sort({ collectedCount: -1, firstCollectedAt: 1 })
      .limit(limit)
      .skip(skip)
      .select('instagramUsername displayName profilePicture collectedCount badges');

    const totalUsers = await User.countDocuments({ collectedCount: { $gt: 0 } });

    res.json({
      users: topUsers,
      totalUsers,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit)
    });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Ошибка получения рейтинга' });
  }
});

// Получить профиль пользователя
app.get('/api/user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ instagramUsername: username });
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Получаем информацию о собранных моделях
    const collectedModels = await ModelPoint.find({
      id: { $in: user.collectedPoints }
    }).select('name collectedAt coordinates');

    res.json({
      user: {
        instagramUsername: user.instagramUsername,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        collectedCount: user.collectedCount,
        badges: user.badges,
        firstCollectedAt: user.firstCollectedAt,
        lastCollectedAt: user.lastCollectedAt
      },
      collectedModels
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

// Проверить Instagram username
app.post('/api/instagram/verify', async (req, res) => {
  try {
    const { username } = req.body;
    
    // Простая валидация username
    if (!username || !username.match(/^[a-zA-Z0-9._]+$/)) {
      return res.status(400).json({ error: 'Неверный формат Instagram username' });
    }

    // Проверяем или создаем пользователя
    let user = await User.findOne({ instagramUsername: username });
    
    if (!user) {
      user = new User({
        instagramUsername: username,
        displayName: username // По умолчанию используем username
      });
      await user.save();
    }

    res.json({
      success: true,
      user: {
        instagramUsername: user.instagramUsername,
        displayName: user.displayName,
        collectedCount: user.collectedCount,
        badges: user.badges
      }
    });
  } catch (error) {
    console.error('Error verifying Instagram:', error);
    res.status(500).json({ error: 'Ошибка проверки пользователя' });
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

// Собрать модель (обновленный метод)
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, instagramUsername, signature } = req.body;

    console.log('Collect submission - ID:', id, 'Instagram:', instagramUsername, 'Has selfie:', !!req.file);

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      console.log('Point not found for collection');
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log('Point already collected');
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Валидация Instagram username
    if (!instagramUsername || !instagramUsername.match(/^[a-zA-Z0-9._]+$/)) {
      return res.status(400).json({ error: 'Неверный формат Instagram username' });
    }

    // Обработка селфи
    let selfieBase64 = null;
    if (req.file) {
      console.log('Processing selfie file:', req.file.originalname, req.file.size);
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Находим или создаем пользователя
    let user = await User.findOne({ instagramUsername });
    if (!user) {
      user = new User({
        instagramUsername,
        displayName: instagramUsername
      });
    }

    // Обновляем статистику пользователя
    user.collectedCount += 1;
    user.collectedPoints.push(point.id);
    user.lastCollectedAt = new Date();
    if (!user.firstCollectedAt) {
      user.firstCollectedAt = new Date();
    }

    // Проверяем достижения
    const badges = [];
    if (user.collectedCount === 1) badges.push('first_collect');
    if (user.collectedCount === 5) badges.push('collector_5');
    if (user.collectedCount === 10) badges.push('collector_10');
    if (user.collectedCount === 25) badges.push('collector_25');
    if (user.collectedCount === 50) badges.push('collector_50');
    if (user.collectedCount === 100) badges.push('collector_100');

    badges.forEach(badge => {
      if (!user.badges.includes(badge)) {
        user.badges.push(badge);
      }
    });

    await user.save();

    // Обновляем точку
    point.status = 'collected';
    point.collectedAt = new Date();
    point.collectorInfo = {
      instagramUsername,
      displayName: user.displayName,
      signature: signature || '',
      selfie: selfieBase64
    };

    await point.save();
    console.log('Point successfully collected by:', instagramUsername);
    
    res.json({ 
      success: true, 
      message: 'Model successfully collected!',
      userStats: {
        collectedCount: user.collectedCount,
        newBadges: badges
      }
    });
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
