const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
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

// Обновленная схема для точек на карте с поддержкой Telegram
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
    authMethod: { type: String, enum: ['manual', 'telegram'], default: 'manual' },
    telegramData: {
      id: Number,
      first_name: String,
      last_name: String,
      username: String,
      photo_url: String,
      auth_date: Number,
      hash: String
    }
  }
});

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Функция проверки подлинности данных Telegram
function verifyTelegramAuth(data, botToken) {
  const secret = crypto.createHash('sha256').update(botToken).digest();
  const checkString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');
  
  const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
  return hmac === data.hash;
}

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
    }).select('-qrSecret -collectorInfo.telegramData.hash');
    
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

// Собрать модель с поддержкой Telegram авторизации
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, telegramData } = req.body;

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

    // Подготавливаем данные коллектора
    const collectorInfo = {
      name: name || 'Anonymous',
      signature: signature || '',
      selfie: selfieBase64,
      authMethod: authMethod || 'manual'
    };

    // Обработка Telegram данных
    if (authMethod === 'telegram' && telegramData) {
      try {
        const parsedTelegramData = JSON.parse(telegramData);
        
        // Проверяем подлинность данных Telegram (если установлен токен бота)
        if (process.env.TELEGRAM_BOT_TOKEN) {
          const isValid = verifyTelegramAuth(parsedTelegramData, process.env.TELEGRAM_BOT_TOKEN);
          if (!isValid) {
            console.log('Invalid Telegram authentication data');
            return res.status(400).json({ error: 'Invalid Telegram authentication' });
          }
        }

        // Проверяем, что данные не старше 1 дня
        const authAge = Date.now() / 1000 - parsedTelegramData.auth_date;
        if (authAge > 86400) { // 24 часа
          console.log('Telegram auth data is too old');
          return res.status(400).json({ error: 'Telegram authentication data is too old' });
        }

        collectorInfo.telegramData = {
          id: parsedTelegramData.id,
          first_name: parsedTelegramData.first_name,
          last_name: parsedTelegramData.last_name,
          username: parsedTelegramData.username,
          photo_url: parsedTelegramData.photo_url,
          auth_date: parsedTelegramData.auth_date,
          hash: parsedTelegramData.hash
        };

        console.log('Telegram user authenticated:', parsedTelegramData.first_name, parsedTelegramData.last_name);
      } catch (error) {
        console.error('Error parsing Telegram data:', error);
        return res.status(400).json({ error: 'Invalid Telegram data format' });
      }
    }

    // Обновляем точку
    point.status = 'collected';
    point.collectedAt = new Date();
    point.collectorInfo = collectorInfo;

    await point.save();
    console.log('Point successfully collected by:', name, 'via', authMethod);
    
    res.json({ success: true, message: 'Model successfully collected!' });
  } catch (error) {
    console.error('Error collecting model:', error);
    res.status(500).json({ error: 'Error collecting model' });
  }
});

// Обработка Telegram авторизации (webhook endpoint)
app.post('/telegram-auth', (req, res) => {
  try {
    console.log('Telegram auth webhook received:', req.body);
    
    // В реальном приложении здесь можно сохранить данные в сессию
    // или выполнить другие действия после успешной авторизации
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error processing Telegram auth:', error);
    res.status(500).json({ error: 'Error processing authentication' });
  }
});

// Получить информацию о собранной точке с расширенными данными
app.get('/api/point/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const point = await ModelPoint.findOne({ id }).select('-qrSecret -collectorInfo.telegramData.hash');
    
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

// Получить статистику сборов с разбивкой по методам авторизации
app.get('/api/admin/stats', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const stats = await ModelPoint.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          collected: {
            $sum: {
              $cond: [{ $eq: ['$status', 'collected'] }, 1, 0]
            }
          },
          available: {
            $sum: {
              $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
            }
          },
          manualAuth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $eq: ['$collectorInfo.authMethod', 'manual'] }
                  ]
                },
                1,
                0
              ]
            }
          },
          telegramAuth: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $eq: ['$collectorInfo.authMethod', 'telegram'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const result = stats[0] || {
      total: 0,
      collected: 0,
      available: 0,
      manualAuth: 0,
      telegramAuth: 0
    };

    res.json(result);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Проверка работоспособности
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    telegramAuth: !!process.env.TELEGRAM_BOT_TOKEN
  });
});

app.listen(PORT, () => {
  console.log(`PlasticBoy сервер запущен на порту ${PORT}`);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('✅ Telegram авторизация активна');
  } else {
    console.log('⚠️ Telegram BOT_TOKEN не установлен. Авторизация будет работать без проверки подлинности.');
  }
});

module.exports = app;
