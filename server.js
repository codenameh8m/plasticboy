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

// Обновленная схема для точек на карте с поддержкой Instagram
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
    selfie: String,
    authMethod: { type: String, enum: ['manual', 'instagram'], default: 'manual' },
    instagram: {
      username: String,
      full_name: String,
      profile_picture: String,
      posts_count: Number,
      followers_count: Number,
      following_count: Number,
      is_verified: Boolean,
      verified_at: Date
    }
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

// API для проверки Instagram аккаунта (mock implementation)
app.post('/api/instagram/verify', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'Username is required' });
    }
    
    // Валидация username
    if (!/^[a-zA-Z0-9._]+$/.test(username)) {
      return res.status(400).json({ error: 'Invalid username format' });
    }
    
    // В реальном приложении здесь был бы запрос к Instagram API
    // Сейчас симулируем случайную задержку и возвращаем мок-данные
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
    
    // Симулируем, что некоторые аккаунты не найдены
    if (username === 'nonexistent' || Math.random() < 0.1) {
      return res.status(404).json({ error: 'Instagram account not found' });
    }
    
    // Генерируем мок-данные профиля
    const mockProfile = {
      username: username,
      full_name: generateMockFullName(username),
      profile_picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}&background=random`,
      posts_count: Math.floor(Math.random() * 500) + 50,
      followers_count: Math.floor(Math.random() * 1000) + 100,
      following_count: Math.floor(Math.random() * 300) + 50,
      is_verified: Math.random() > 0.8,
      bio: `Bio for ${username}`
    };
    
    res.json(mockProfile);
    
  } catch (error) {
    console.error('Error verifying Instagram account:', error);
    res.status(500).json({ error: 'Error verifying Instagram account' });
  }
});

// Собрать модель (обновлено для поддержки Instagram)
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, instagramData } = req.body;

    console.log('Collect submission - ID:', id, 'Name:', name, 'Auth method:', authMethod, 'Has selfie:', !!req.file);

    const point = await ModelPoint.findOne({ id, qrSecret: secret });
    
    if (!point) {
      console.log('Point not found for collection');
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log('Point already collected');
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Обработка селфи
    let selfieBase64 = null;
    if (req.file) {
      console.log('Processing selfie file:', req.file.originalname, req.file.size);
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    // Подготавливаем информацию о сборщике
    const collectorInfo = {
      name: name || 'Anonymous',
      signature: signature || '',
      selfie: selfieBase64,
      authMethod: authMethod || 'manual'
    };

    // Если использовался Instagram, добавляем данные профиля
    if (authMethod === 'instagram' && instagramData) {
      try {
        const parsedInstagramData = JSON.parse(instagramData);
        collectorInfo.instagram = {
          username: parsedInstagramData.username,
          full_name: parsedInstagramData.full_name,
          profile_picture: parsedInstagramData.profile_picture,
          posts_count: parsedInstagramData.posts_count,
          followers_count: parsedInstagramData.followers_count,
          following_count: parsedInstagramData.following_count,
          is_verified: parsedInstagramData.is_verified,
          verified_at: new Date()
        };
        console.log('Instagram data saved for user:', parsedInstagramData.username);
      } catch (error) {
        console.error('Error parsing Instagram data:', error);
      }
    }

    // Обновляем точку
    point.status = 'collected';
    point.collectedAt = new Date();
    point.collectorInfo = collectorInfo;

    await point.save();
    console.log('Point successfully collected by:', name, authMethod === 'instagram' ? '(via Instagram)' : '(manual)');
    
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

// Получить статистику Instagram пользователей
app.get('/api/admin/instagram-stats', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const stats = await ModelPoint.aggregate([
      { $match: { status: 'collected' } },
      {
        $group: {
          _id: '$collectorInfo.authMethod',
          count: { $sum: 1 },
          totalFollowers: { 
            $sum: { 
              $cond: [
                { $eq: ['$collectorInfo.authMethod', 'instagram'] },
                '$collectorInfo.instagram.followers_count',
                0
              ]
            }
          },
          avgFollowers: {
            $avg: {
              $cond: [
                { $eq: ['$collectorInfo.authMethod', 'instagram'] },
                '$collectorInfo.instagram.followers_count',
                null
              ]
            }
          }
        }
      }
    ]);

    const instagramUsers = await ModelPoint.find({
      status: 'collected',
      'collectorInfo.authMethod': 'instagram'
    }).select('collectorInfo.instagram collectedAt').sort({ collectedAt: -1 });

    res.json({
      stats: stats,
      instagramUsers: instagramUsers.map(point => ({
        username: point.collectorInfo.instagram.username,
        full_name: point.collectorInfo.instagram.full_name,
        followers_count: point.collectorInfo.instagram.followers_count,
        is_verified: point.collectorInfo.instagram.is_verified,
        collected_at: point.collectedAt
      }))
    });

  } catch (error) {
    console.error('Error getting Instagram stats:', error);
    res.status(500).json({ error: 'Failed to get Instagram stats' });
  }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    features: ['instagram_auth', 'manual_auth', 'file_upload']
  });
});

// Вспомогательные функции
function generateMockFullName(username) {
  const firstNames = ['Александр', 'Мария', 'Дмитрий', 'Анна', 'Максим', 'Елена', 'Сергей', 'Ольга', 'Андрей', 'Татьяна'];
  const lastNames = ['Иванов', 'Петрова', 'Сидоров', 'Козлова', 'Волков', 'Смирнова', 'Попов', 'Лебедева', 'Новиков', 'Морозова'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return `${firstName} ${lastName}`;
}

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`PlasticBoy сервер с Instagram интеграцией запущен на порту ${PORT}`);
  console.log('Доступные функции: Instagram авторизация, ручной ввод имени, загрузка файлов');
});
