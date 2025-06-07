const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');

// Загружаем переменные окружения
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware - УБРАНЫ ОГРАНИЧЕНИЯ ПО РАЗМЕРУ
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Увеличили лимит для больших изображений
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Увеличили лимит
app.use(express.static('public'));

// Устанавливаем правильные заголовки для кириллицы
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// Multer для загрузки файлов - УБРАНЫ ВСЕ ОГРАНИЧЕНИЯ ПО РАЗМЕРУ
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage
  // Убрали все limits - теперь файлы любого размера принимаются
});

// MongoDB подключение
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB подключена: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    process.exit(1);
  }
};

connectDB();

// Обновленная схема для точек на карте с расширенной поддержкой Telegram
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
    name: { type: String, required: true },
    signature: String,
    selfie: String, // Убрали ограничения - теперь может быть любого размера
    authMethod: { type: String, enum: ['manual', 'telegram'], default: 'manual' },
    telegramData: {
      id: Number,
      first_name: String,
      last_name: String,
      username: String,
      photo_url: String,
      auth_date: Number,
      hash: String,
      language_code: String
    },
    ipAddress: String,
    userAgent: String,
    location: {
      lat: Number,
      lng: Number,
      accuracy: Number
    }
  }
});

// Индексы для оптимизации запросов
ModelPointSchema.index({ status: 1, scheduledTime: 1 });
ModelPointSchema.index({ id: 1, qrSecret: 1 });
ModelPointSchema.index({ createdAt: 1 });
ModelPointSchema.index({ collectedAt: 1 });
ModelPointSchema.index({ 'collectorInfo.telegramData.id': 1 });

const ModelPoint = mongoose.model('ModelPoint', ModelPointSchema);

// Функция проверки подлинности данных Telegram
function verifyTelegramAuth(data, botToken) {
  try {
    // Если токен не установлен, выводим предупреждение и разрешаем (для разработки)
    if (!botToken) {
      console.warn('⚠️ TELEGRAM_BOT_TOKEN не установлен, пропускаем проверку подлинности');
      return true;
    }

    // Проверяем наличие обязательных полей
    if (!data.hash || !data.auth_date || !data.id) {
      console.error('❌ Отсутствуют обязательные поля в данных Telegram');
      return false;
    }

    // Создаем строку для проверки
    const checkDataKeys = Object.keys(data)
      .filter(key => key !== 'hash')
      .sort();
    
    if (checkDataKeys.length === 0) {
      console.error('❌ Нет данных для проверки');
      return false;
    }

    const checkString = checkDataKeys
      .map(key => `${key}=${data[key]}`)
      .join('\n');

    // Создаем секретный ключ
    const secret = crypto.createHash('sha256').update(botToken).digest();
    
    // Создаем HMAC
    const hmac = crypto.createHmac('sha256', secret).update(checkString).digest('hex');
    
    // Сравниваем хеши
    const isValid = hmac === data.hash;
    
    if (!isValid) {
      console.error('❌ Неверная подпись Telegram данных');
      console.log('Expected:', hmac);
      console.log('Received:', data.hash);
      console.log('Check string:', checkString);
    } else {
      console.log('✅ Telegram данные прошли проверку подлинности');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Ошибка при проверке Telegram данных:', error);
    return false;
  }
}

// Функция логирования действий пользователей
function logUserAction(action, data, req) {
  const logData = {
    timestamp: new Date().toISOString(),
    action,
    data,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    referer: req.get('Referer')
  };
  
  console.log(`📝 USER ACTION: ${JSON.stringify(logData)}`);
}

// Middleware для логирования запросов
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? '❌' : '✅';
    console.log(`${logLevel} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});

// Маршруты

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Админ панель
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Страница сбора модели
app.get('/collect.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

// Получить все точки для пользователей (только активные и по времени)
app.get('/api/points', async (req, res) => {
  try {
    const now = new Date();
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    })
    .select('-qrSecret -collectorInfo.telegramData.hash -collectorInfo.ipAddress -collectorInfo.userAgent')
    .lean()
    .exec();
    
    console.log(`📊 Загружено ${points.length} публичных точек`);
    res.json(points);
  } catch (error) {
    console.error('❌ Ошибка получения точек:', error);
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
      logUserAction('ADMIN_ACCESS_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const points = await ModelPoint.find({}).lean().exec();
    
    logUserAction('ADMIN_POINTS_LOADED', { count: points.length }, req);
    console.log(`🛡️ Админ загрузил ${points.length} точек`);
    
    res.json(points);
  } catch (error) {
    console.error('❌ Ошибка загрузки точек для админа:', error);
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
      logUserAction('ADMIN_CREATE_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { name, coordinates, delayMinutes } = req.body;
    
    // Валидация данных
    if (!name || !coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid point data' });
    }

    const pointId = Date.now().toString();
    const qrSecret = crypto.randomBytes(16).toString('hex');
    
    const scheduledTime = new Date();
    if (delayMinutes && !isNaN(delayMinutes)) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Создаем URL для сканирования QR кода
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерируем QR код
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    const newPoint = new ModelPoint({
      id: pointId,
      name: name.trim(),
      coordinates: {
        lat: parseFloat(coordinates.lat),
        lng: parseFloat(coordinates.lng)
      },
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    
    logUserAction('ADMIN_POINT_CREATED', { 
      pointId, 
      name: name.trim(),
      scheduledTime: scheduledTime.toISOString()
    }, req);
    
    console.log(`✅ Создана новая точка: ${name} (ID: ${pointId})`);
    res.json(newPoint);
  } catch (error) {
    console.error('❌ Ошибка создания точки:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Альтернативный роут для создания точки (через POST body)
app.post('/api/admin/points/create', async (req, res) => {
  try {
    const { name, coordinates, delayMinutes, adminPassword } = req.body;
    
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      logUserAction('ADMIN_CREATE_ALT_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid password' });
    }

    // Валидация данных
    if (!name || !coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid point data' });
    }

    const pointId = Date.now().toString();
    const qrSecret = crypto.randomBytes(16).toString('hex');
    
    const scheduledTime = new Date();
    if (delayMinutes && !isNaN(delayMinutes)) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    // Создаем URL для сканирования QR кода
    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерируем QR код
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 400,
      margin: 2
    });

    const newPoint = new ModelPoint({
      id: pointId,
      name: name.trim(),
      coordinates: {
        lat: parseFloat(coordinates.lat),
        lng: parseFloat(coordinates.lng)
      },
      qrCode: qrCodeDataUrl,
      qrSecret,
      scheduledTime
    });

    await newPoint.save();
    
    logUserAction('ADMIN_POINT_CREATED_ALT', { 
      pointId, 
      name: name.trim()
    }, req);
    
    console.log(`✅ Создана новая точка (alt): ${name} (ID: ${pointId})`);
    res.json(newPoint);
  } catch (error) {
    console.error('❌ Ошибка создания точки (alt):', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Получить информацию о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;

    console.log(`🔍 Запрос информации о точке - ID: ${id}`);

    // Валидация параметров
    if (!id || !secret) {
      return res.status(400).json({ error: 'Missing point ID or secret' });
    }

    const point = await ModelPoint.findOne({ 
      id: id.trim(), 
      qrSecret: secret.trim() 
    }).lean().exec();
    
    if (!point) {
      console.log(`❌ Точка не найдена или неверный секрет: ID ${id}`);
      logUserAction('COLLECT_INVALID_QR', { pointId: id }, req);
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log(`⚠️ Точка уже собрана: ${point.name} (ID: ${id})`);
      logUserAction('COLLECT_ALREADY_COLLECTED', { 
        pointId: id, 
        pointName: point.name,
        collectedAt: point.collectedAt 
      }, req);
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Проверяем, доступна ли точка по времени
    const now = new Date();
    if (point.scheduledTime > now) {
      const minutesLeft = Math.ceil((point.scheduledTime - now) / (1000 * 60));
      console.log(`⏰ Точка еще не доступна: ${point.name}, осталось ${minutesLeft} минут`);
      return res.status(400).json({ 
        error: `This model will be available in ${minutesLeft} minutes` 
      });
    }

    console.log(`✅ Информация о точке найдена: ${point.name} (ID: ${id})`);
    logUserAction('COLLECT_INFO_LOADED', { 
      pointId: id, 
      pointName: point.name 
    }, req);
    
    res.json({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates
    });
  } catch (error) {
    console.error('❌ Ошибка получения информации о точке:', error);
    res.status(500).json({ error: 'Error getting point information' });
  }
});

// Собрать модель с расширенной поддержкой Telegram авторизации - УБРАНЫ ВСЕ ОГРАНИЧЕНИЯ ПО РАЗМЕРУ
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, telegramData } = req.body;

    console.log(`📦 Попытка сбора модели - ID: ${id}, Имя: ${name}, Метод: ${authMethod}`);

    // Валидация основных параметров
    if (!id || !secret || !name?.trim()) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const point = await ModelPoint.findOne({ 
      id: id.trim(), 
      qrSecret: secret.trim() 
    });
    
    if (!point) {
      console.log(`❌ Точка не найдена для сбора: ID ${id}`);
      logUserAction('COLLECT_FAILED_NOT_FOUND', { pointId: id }, req);
      return res.status(404).json({ error: 'Point not found or invalid QR code' });
    }

    if (point.status === 'collected') {
      console.log(`❌ Точка уже собрана: ${point.name} (ID: ${id})`);
      logUserAction('COLLECT_FAILED_ALREADY_COLLECTED', { 
        pointId: id, 
        pointName: point.name 
      }, req);
      return res.status(400).json({ error: 'This model has already been collected' });
    }

    // Проверяем доступность по времени
    const now = new Date();
    if (point.scheduledTime > now) {
      const minutesLeft = Math.ceil((point.scheduledTime - now) / (1000 * 60));
      return res.status(400).json({ 
        error: `This model will be available in ${minutesLeft} minutes` 
      });
    }

    // Обработка селфи - УБРАНЫ ВСЕ ОГРАНИЧЕНИЯ ПО РАЗМЕРУ
    let selfieBase64 = null;
    if (req.file) {
      console.log(`📸 Обработка селфи: ${req.file.originalname}, размер: ${req.file.size} байт (без ограничений)`);
      
      // Проверяем только тип файла, размер не ограничиваем
      if (!req.file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Invalid file type, please upload an image' });
      }
      
      selfieBase64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      console.log(`✅ Селфи обработано успешно, размер в base64: ${Math.round(selfieBase64.length / 1024)} КБ`);
    }

    // Подготавливаем данные коллектора
    const collectorInfo = {
      name: name.trim(),
      signature: signature?.trim() || '',
      selfie: selfieBase64,
      authMethod: authMethod || 'manual',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    // Обработка Telegram данных
    if (authMethod === 'telegram' && telegramData) {
      try {
        const parsedTelegramData = JSON.parse(telegramData);
        
        console.log(`🔐 Проверка Telegram данных для пользователя: ${parsedTelegramData.first_name}`);
        
        // Проверяем обязательные поля
        if (!parsedTelegramData.id || !parsedTelegramData.first_name || !parsedTelegramData.auth_date) {
          console.error('❌ Отсутствуют обязательные поля в Telegram данных');
          return res.status(400).json({ error: 'Invalid Telegram data: missing required fields' });
        }

        // Проверяем подлинность данных Telegram
        const isValid = verifyTelegramAuth(parsedTelegramData, process.env.TELEGRAM_BOT_TOKEN);
        if (!isValid && process.env.TELEGRAM_BOT_TOKEN) {
          console.error('❌ Неверная подпись Telegram данных');
          logUserAction('COLLECT_TELEGRAM_INVALID', { 
            pointId: id,
            telegramId: parsedTelegramData.id 
          }, req);
          return res.status(400).json({ error: 'Invalid Telegram authentication signature' });
        }

        // Проверяем, что данные не старше 24 часов
        const authAge = Date.now() / 1000 - parsedTelegramData.auth_date;
        if (authAge > 86400) {
          console.error(`❌ Telegram данные слишком старые: ${authAge} секунд`);
          return res.status(400).json({ error: 'Telegram authentication data is too old' });
        }

        // Проверяем, не использовал ли этот Telegram аккаунт уже другую точку
        const existingCollection = await ModelPoint.findOne({
          'collectorInfo.telegramData.id': parsedTelegramData.id,
          status: 'collected'
        });

        if (existingCollection) {
          console.log(`⚠️ Telegram пользователь ${parsedTelegramData.id} уже собирал точку ${existingCollection.id}`);
          // Не блокируем, но логируем для анализа
          logUserAction('COLLECT_TELEGRAM_REUSE', {
            pointId: id,
            telegramId: parsedTelegramData.id,
            previousPoint: existingCollection.id
          }, req);
        }

        // Сохраняем Telegram данные (без hash для безопасности)
        collectorInfo.telegramData = {
          id: parsedTelegramData.id,
          first_name: parsedTelegramData.first_name,
          last_name: parsedTelegramData.last_name,
          username: parsedTelegramData.username,
          photo_url: parsedTelegramData.photo_url,
          auth_date: parsedTelegramData.auth_date,
          language_code: parsedTelegramData.language_code,
          hash: parsedTelegramData.hash // Сохраняем для возможной дополнительной проверки
        };

        console.log(`✅ Telegram пользователь прошел проверку: ${parsedTelegramData.first_name} ${parsedTelegramData.last_name} (@${parsedTelegramData.username})`);
        
      } catch (error) {
        console.error('❌ Ошибка обработки Telegram данных:', error);
        return res.status(400).json({ error: 'Invalid Telegram data format' });
      }
    }

    // Обновляем точку
    point.status = 'collected';
    point.collectedAt = new Date();
    point.collectorInfo = collectorInfo;

    await point.save();
    
    // Логируем успешный сбор
    logUserAction('COLLECT_SUCCESS', {
      pointId: id,
      pointName: point.name,
      collectorName: collectorInfo.name,
      authMethod: authMethod,
      telegramId: collectorInfo.telegramData?.id,
      telegramUsername: collectorInfo.telegramData?.username,
      hasSelfie: !!selfieBase64,
      selfieSize: selfieBase64 ? Math.round(selfieBase64.length / 1024) + 'KB' : 'none'
    }, req);
    
    console.log(`🎉 Точка успешно собрана: ${point.name} (ID: ${id}) пользователем ${collectorInfo.name} через ${authMethod}`);
    
    res.json({ 
      success: true, 
      message: 'Model successfully collected!',
      pointName: point.name,
      collectorName: collectorInfo.name
    });
    
  } catch (error) {
    console.error('❌ Ошибка сбора модели:', error);
    logUserAction('COLLECT_ERROR', { 
      pointId: req.params.id, 
      error: error.message 
    }, req);
    res.status(500).json({ error: 'Error collecting model' });
  }
});

// Удалить точку (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      logUserAction('ADMIN_DELETE_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { id } = req.params;
    const deletedPoint = await ModelPoint.findOneAndDelete({ id: id.trim() });
    
    if (!deletedPoint) {
      return res.status(404).json({ error: 'Point not found' });
    }

    logUserAction('ADMIN_POINT_DELETED', { 
      pointId: id, 
      pointName: deletedPoint.name 
    }, req);
    
    console.log(`🗑️ Точка удалена: ${deletedPoint.name} (ID: ${id})`);
    res.json({ success: true, message: 'Point deleted' });
  } catch (error) {
    console.error('❌ Ошибка удаления точки:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// Получить расширенную статистику
app.get('/api/admin/stats', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const now = new Date();
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
          scheduled: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'available'] },
                    { $gt: ['$scheduledTime', now] }
                  ]
                },
                1,
                0
              ]
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
          },
          withSelfie: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', 'collected'] },
                    { $ne: ['$collectorInfo.selfie', null] },
                    { $ne: ['$collectorInfo.selfie', ''] }
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
      scheduled: 0,
      manualAuth: 0,
      telegramAuth: 0,
      withSelfie: 0
    };

    // Дополнительная статистика
    const recentCollections = await ModelPoint.find({
      status: 'collected',
      collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).countDocuments();

    result.recentCollections = recentCollections;

    logUserAction('ADMIN_STATS_VIEWED', result, req);
    console.log(`📊 Статистика загружена: ${result.total} всего, ${result.collected} собрано`);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Получить информацию о собранной точке с расширенными данными
app.get('/api/point/:id/info', async (req, res) => {
  try {
    const { id } = req.params;
    const point = await ModelPoint.findOne({ id: id.trim() })
      .select('-qrSecret -collectorInfo.telegramData.hash -collectorInfo.ipAddress -collectorInfo.userAgent')
      .lean()
      .exec();
    
    if (!point) {
      return res.status(404).json({ error: 'Точка не найдена' });
    }

    logUserAction('POINT_INFO_VIEWED', { pointId: id }, req);
    res.json(point);
  } catch (error) {
    console.error('❌ Ошибка получения информации о точке:', error);
    res.status(500).json({ error: 'Ошибка получения информации' });
  }
});

// Обработка Telegram авторизации (webhook endpoint)
app.post('/telegram-auth', (req, res) => {
  try {
    console.log('📨 Telegram auth webhook получен:', req.body);
    
    // Проверяем данные
    if (req.body && req.body.id) {
      logUserAction('TELEGRAM_AUTH_WEBHOOK', {
        telegramId: req.body.id,
        firstName: req.body.first_name,
        username: req.body.username
      }, req);
      
      console.log(`✅ Telegram webhook обработан для пользователя: ${req.body.first_name}`);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Ошибка обработки Telegram auth webhook:', error);
    res.status(500).json({ error: 'Error processing authentication' });
  }
});

// Получить топ коллекторов
app.get('/api/admin/top-collectors', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const topCollectors = await ModelPoint.aggregate([
      { $match: { status: 'collected' } },
      {
        $group: {
          _id: {
            name: '$collectorInfo.name',
            telegramId: '$collectorInfo.telegramData.id',
            authMethod: '$collectorInfo.authMethod'
          },
          count: { $sum: 1 },
          lastCollection: { $max: '$collectedAt' },
          firstCollection: { $min: '$collectedAt' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    logUserAction('ADMIN_TOP_COLLECTORS_VIEWED', { count: topCollectors.length }, req);
    res.json(topCollectors);
  } catch (error) {
    console.error('❌ Ошибка получения топа коллекторов:', error);
    res.status(500).json({ error: 'Failed to get top collectors' });
  }
});

// Получить активность по дням
app.get('/api/admin/activity', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { days = 7 } = req.query;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    const activity = await ModelPoint.aggregate([
      {
        $match: {
          $or: [
            { createdAt: { $gte: daysAgo } },
            { collectedAt: { $gte: daysAgo } }
          ]
        }
      },
      {
        $facet: {
          created: [
            { $match: { createdAt: { $gte: daysAgo } } },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ],
          collected: [
            { 
              $match: { 
                status: 'collected',
                collectedAt: { $gte: daysAgo } 
              } 
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: '%Y-%m-%d', date: '$collectedAt' }
                },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ]
        }
      }
    ]);

    logUserAction('ADMIN_ACTIVITY_VIEWED', { days: parseInt(days) }, req);
    res.json(activity[0]);
  } catch (error) {
    console.error('❌ Ошибка получения активности:', error);
    res.status(500).json({ error: 'Failed to get activity data' });
  }
});

// Экспорт данных (админ)
app.get('/api/admin/export', async (req, res) => {
  try {
    const password = req.headers['x-admin-password'] 
      ? decodeURIComponent(req.headers['x-admin-password'])
      : req.headers.authorization;
      
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const { format = 'json' } = req.query;
    
    const points = await ModelPoint.find({})
      .select('-qrSecret -collectorInfo.telegramData.hash')
      .lean()
      .exec();

    logUserAction('ADMIN_DATA_EXPORTED', { 
      format, 
      pointsCount: points.length 
    }, req);

    if (format === 'csv') {
      // Простой CSV экспорт
      const csvHeader = 'ID,Name,Status,Created,Collected,Collector,AuthMethod,Lat,Lng\n';
      const csvData = points.map(point => {
        return [
          point.id,
          `"${point.name}"`,
          point.status,
          point.createdAt?.toISOString() || '',
          point.collectedAt?.toISOString() || '',
          `"${point.collectorInfo?.name || ''}"`,
          point.collectorInfo?.authMethod || '',
          point.coordinates.lat,
          point.coordinates.lng
        ].join(',');
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="plasticboy-export.csv"');
      res.send(csvHeader + csvData);
    } else {
      res.json({
        exportDate: new Date().toISOString(),
        totalPoints: points.length,
        data: points
      });
    }
  } catch (error) {
    console.error('❌ Ошибка экспорта данных:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Проверка работоспособности с расширенной информацией
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    environment: process.env.NODE_ENV || 'development',
    features: {
      telegramAuth: {
        enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        botUsername: process.env.TELEGRAM_BOT_USERNAME || 'not configured',
        configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
      },
      mongodb: {
        connected: mongoose.connection.readyState === 1,
        host: mongoose.connection.host,
        name: mongoose.connection.name
      },
      admin: {
        configured: !!process.env.ADMIN_PASSWORD
      },
      uploads: {
        sizeLimits: 'removed',
        allowedFormats: 'all images',
        maxFileSize: 'unlimited'
      }
    },
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    nodeVersion: process.version
  });
});

// Обработка 404 ошибок
app.use('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Глобальная обработка ошибок
app.use((error, req, res, next) => {
  console.error('❌ Глобальная ошибка:', error);
  
  // Логируем серьезные ошибки
  logUserAction('SERVER_ERROR', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  }, req);

  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM получен, завершаем работу...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB соединение закрыто');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при завершении:', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT получен, завершаем работу...');
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB соединение закрыто');
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при завершении:', error);
    process.exit(1);
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('🚀 ==========================================');
  console.log(`🎯 PlasticBoy v2.1.0 запущен на порту ${PORT}`);
  console.log('🚀 ==========================================');
  
  // Проверяем конфигурацию
  console.log('\n📋 Конфигурация:');
  console.log(`   🌐 URL: http://localhost:${PORT}`);
  console.log(`   🗄️  MongoDB: ${process.env.MONGODB_URI ? '✅ настроена' : '❌ не настроена'}`);
  console.log(`   🛡️  Админ: ${process.env.ADMIN_PASSWORD ? '✅ настроен' : '❌ не настроен'}`);
  console.log(`   📸 Ограничения селфи: ❌ убраны (принимаются файлы любого размера)`);
  
  // Проверяем Telegram конфигурацию
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME) {
    console.log('   ✅ Telegram авторизация полностью настроена');
    console.log(`      🤖 Bot: @${process.env.TELEGRAM_BOT_USERNAME}`);
    console.log(`      🔑 Token: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
  } else if (process.env.TELEGRAM_BOT_TOKEN) {
    console.log('   ⚠️  Telegram BOT_TOKEN установлен, но BOT_USERNAME отсутствует');
  } else if (process.env.TELEGRAM_BOT_USERNAME) {
    console.log('   ⚠️  Telegram BOT_USERNAME установлен, но BOT_TOKEN отсутствует');
  } else {
    console.log('   ⚠️  Telegram авторизация не настроена');
    console.log('      📚 См. инструкции по настройке в README.md');
  }
  
  console.log('\n🔗 Полезные ссылки:');
  console.log(`   🏠 Главная: http://localhost:${PORT}`);
  console.log(`   🛡️  Админ: http://localhost:${PORT}/admin.html`);
  console.log(`   ❤️  Health: http://localhost:${PORT}/health`);
  console.log('🚀 ==========================================\n');
});

module.exports = app;
