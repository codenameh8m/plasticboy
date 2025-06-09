const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('public'));

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// === TELEGRAM BOT INTEGRATION ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Функция для отправки сообщений в Telegram
async function sendTelegramMessage(chatId, message, options = {}) {
  if (!BOT_TOKEN) return;
  
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      ...options
    });
    console.log(`📱 Telegram сообщение отправлено в чат ${chatId}`);
  } catch (error) {
    console.error('❌ Ошибка отправки Telegram сообщения:', error.response?.data || error.message);
  }
}

// Функция обработки Telegram команд
async function handleTelegramUpdate(update) {
  try {
    console.log('📥 Получено обновление Telegram:', JSON.stringify(update, null, 2));
    
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const user = message.from;
      
      console.log(`💬 Сообщение от ${user.first_name} (${user.id}): ${text}`);
      
      // Обработка команд
      if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].substring(1);
        
        switch (command) {
          case 'start':
            const welcomeMessage = `🎯 *PlasticBoy - Almaty Edition*\n\nПривет, ${user.first_name}! 👋\n\nДобро пожаловать в игру по сбору 3D моделей в Алматы!\n\n🎮 *Как играть:*\n• Найди QR-коды моделей по городу\n• Отсканируй их и собери коллекцию\n• Соревнуйся с другими игроками\n\nУдачной охоты! 🎯`;
            
            await sendTelegramMessage(chatId, welcomeMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Открыть карту', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [
                    { text: '🏆 Рейтинг', callback_data: 'leaderboard' },
                    { text: '📊 Статистика', callback_data: 'stats' }
                  ]
                ]
              }
            });
            break;
            
          case 'help':
            const helpMessage = `❓ *Помощь PlasticBoy*\n\n🎯 *Цель игры:* Собери как можно больше 3D моделей!\n\n📱 *Команды:*\n/start - Главное меню\n/map - Открыть карту\n/leaderboard - Рейтинг игроков\n/stats - Статистика игры\n/help - Эта помощь\n\nУдачи! 🚀`;
            await sendTelegramMessage(chatId, helpMessage);
            break;
            
          case 'map':
            const mapMessage = `🗺️ *Карта PlasticBoy*\n\nОткройте интерактивную карту для поиска 3D моделей в Алматы!\n\n🎯 На карте вы увидите:\n• 🟢 Доступные модели\n• 🔴 Уже собранные модели\n• 📍 Ваше местоположение`;
            
            await sendTelegramMessage(chatId, mapMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Открыть карту', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [{ text: '📊 Статистика', callback_data: 'stats' }]
                ]
              }
            });
            break;
            
          case 'leaderboard':
            const leaderboardMessage = `🏆 *Рейтинг коллекторов*\n\nПосмотрите топ игроков PlasticBoy!\n\n⭐ В рейтинге участвуют только пользователи, авторизованные через Telegram\n\n🥇🥈🥉 Кто соберет больше всех моделей?`;
            
            await sendTelegramMessage(chatId, leaderboardMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏆 Открыть рейтинг', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }],
                  [{ text: '🗺️ К карте', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
                ]
              }
            });
            break;
            
          case 'stats':
            try {
              const totalPoints = await ModelPoint.countDocuments();
              const collectedPoints = await ModelPoint.countDocuments({ status: 'collected' });
              const availablePoints = totalPoints - collectedPoints;
              
              // Получаем статистику Telegram пользователей
              const telegramStats = await ModelPoint.aggregate([
                {
                  $match: {
                    status: 'collected',
                    'collectorInfo.authMethod': 'telegram'
                  }
                },
                {
                  $group: {
                    _id: null,
                    telegramCollections: { $sum: 1 },
                    uniqueTelegramUsers: { $addToSet: '$collectorInfo.telegramData.id' }
                  }
                }
              ]);
              
              const tgStats = telegramStats[0] || { telegramCollections: 0, uniqueTelegramUsers: [] };
              const telegramUsers = tgStats.uniqueTelegramUsers.length;
              const telegramCollections = tgStats.telegramCollections;
              
              const statsMessage = `📊 *Статистика PlasticBoy*\n\n📦 Всего моделей: *${totalPoints}*\n🟢 Доступно: *${availablePoints}*\n🔴 Собрано: *${collectedPoints}*\n\n📱 *Telegram игроки:*\n👥 Участников: *${telegramUsers}*\n🎯 Собрано ими: *${telegramCollections}*\n\n🎮 Присоединяйся к игре!`;
              
              await sendTelegramMessage(chatId, statsMessage, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🗺️ Играть', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                    [{ text: '🏆 Рейтинг', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }]
                  ]
                }
              });
            } catch (error) {
              await sendTelegramMessage(chatId, '❌ Ошибка получения статистики');
            }
            break;
            
          default:
            const unknownMessage = `❓ Неизвестная команда: /${command}\n\n📱 *Доступные команды:*\n/start - Главное меню\n/map - Открыть карту\n/leaderboard - Рейтинг игроков\n/stats - Статистика игры\n/help - Помощь\n\n🎯 Используйте команды для навигации!`;
            await sendTelegramMessage(chatId, unknownMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Открыть карту', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [
                    { text: '🏆 Рейтинг', callback_data: 'leaderboard' },
                    { text: '📊 Статистика', callback_data: 'stats' }
                  ]
                ]
              }
            });
        }
      } else if (text) {
        // Обычное сообщение
        await sendTelegramMessage(chatId, `Получил ваше сообщение: "${text}"\n\nИспользуйте /help для списка команд.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗺️ Играть', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
            ]
          }
        });
      }
    }
    
    // Обработка callback кнопок
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;
      
      console.log(`🔘 Callback: ${data} от ${callbackQuery.from.first_name}`);
      
      // Подтверждаем callback
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id
        });
      } catch (error) {
        console.error('❌ Ошибка answerCallbackQuery:', error);
      }
      
      // Обрабатываем callback
      switch (data) {
        case 'leaderboard':
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: '🏆 *Рейтинг коллекторов*\n\nОткройте веб-версию для просмотра полного рейтинга игроков!',
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 Открыть рейтинг', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }],
                [{ text: '🗺️ К карте', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
              ]
            }
          });
          break;
          
        case 'stats':
          try {
            const totalPoints = await ModelPoint.countDocuments();
            const collectedPoints = await ModelPoint.countDocuments({ status: 'collected' });
            const availablePoints = totalPoints - collectedPoints;
            
            // Получаем статистику Telegram пользователей
            const telegramStats = await ModelPoint.aggregate([
              {
                $match: {
                  status: 'collected',
                  'collectorInfo.authMethod': 'telegram'
                }
              },
              {
                $group: {
                  _id: null,
                  telegramCollections: { $sum: 1 },
                  uniqueTelegramUsers: { $addToSet: '$collectorInfo.telegramData.id' }
                }
              }
            ]);
            
            const tgStats = telegramStats[0] || { telegramCollections: 0, uniqueTelegramUsers: [] };
            const telegramUsers = tgStats.uniqueTelegramUsers.length;
            const telegramCollections = tgStats.telegramCollections;
            
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              chat_id: chatId,
              message_id: messageId,
              text: `📊 *Статистика игры*\n\n📦 Всего моделей: *${totalPoints}*\n🟢 Доступно: *${availablePoints}*\n🔴 Собрано: *${collectedPoints}*\n\n📱 *Telegram игроки:*\n👥 Участников: *${telegramUsers}*\n🎯 Собрано ими: *${telegramCollections}*`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Играть', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [{ text: '🏆 Рейтинг', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }]
                ]
              }
            });
          } catch (error) {
            console.error('❌ Ошибка получения статистики для callback:', error);
          }
          break;
      }
    }
    
  } catch (error) {
    console.error('❌ Ошибка обработки Telegram обновления:', error);
  }
}

// === WEBHOOK МАРШРУТ ДЛЯ TELEGRAM ===
if (BOT_TOKEN) {
  app.post(`/${BOT_TOKEN}`, async (req, res) => {
    console.log('📥 Webhook получен от Telegram');
    
    try {
      await handleTelegramUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Ошибка обработки webhook:', error);
      res.status(500).send('Error');
    }
  });
  
  console.log(`🔗 Telegram webhook маршрут настроен: /${BOT_TOKEN}`);
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN не найден, webhook не настроен');
}

// Подключение к MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB подключена');
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error);
    process.exit(1);
  }
};

// Модель точки сбора
const modelPointSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  qrCode: { type: String, required: true },
  qrSecret: { type: String, required: true, index: true },
  status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  scheduledTime: { type: Date, default: Date.now, index: true },
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

// Индексы для оптимизации
modelPointSchema.index({ id: 1, qrSecret: 1 });
modelPointSchema.index({ status: 1, scheduledTime: 1 });
modelPointSchema.index({ collectedAt: 1 });
modelPointSchema.index({ 'collectorInfo.telegramData.id': 1 });

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// Логирование действий пользователей
function logUserAction(action, data, req) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`📝 [${timestamp}] ${action} - IP: ${ip} - Data:`, JSON.stringify(data));
}

// Функция проверки админского пароля
function checkAdminPassword(req) {
  let password = null;
  
  if (req.headers.authorization) {
    password = req.headers.authorization;
  }
  
  if (!password && req.headers['x-admin-password']) {
    password = decodeURIComponent(req.headers['x-admin-password']);
  }
  
  if (!password && req.get('Authorization')) {
    password = req.get('Authorization');
  }
  
  const isValid = password && password === process.env.ADMIN_PASSWORD;
  console.log('🔐 Проверка админского пароля:', isValid ? 'УСПЕХ' : 'ОШИБКА');
  
  return isValid;
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const totalPoints = await ModelPoint.countDocuments();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbState,
      totalPoints,
      environment: process.env.NODE_ENV || 'development',
      telegramWebhook: BOT_TOKEN ? 'configured' : 'not configured'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Получить все публичные точки
app.get('/api/points', async (req, res) => {
  try {
    const now = new Date();
    
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    })
    .select('-qrSecret')
    .lean()
    .exec();
    
    logUserAction('POINTS_LOADED', { count: points.length }, req);
    console.log(`📍 Загружено ${points.length} публичных точек`);
    
    res.json(points);
  } catch (error) {
    console.error('❌ Ошибка загрузки точек:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Получить информацию о точке для сбора
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;
    
    if (!secret) {
      return res.status(400).json({ error: 'Secret is required' });
    }
    
    const point = await ModelPoint.findOne({
      id: id.trim(),
      qrSecret: secret.trim()
    }).lean().exec();
    
    if (!point) {
      logUserAction('COLLECT_NOT_FOUND', { pointId: id }, req);
      return res.status(404).json({ error: 'Point not found or invalid secret' });
    }
    
    if (point.status === 'collected') {
      logUserAction('COLLECT_ALREADY_COLLECTED', { pointId: id }, req);
      return res.status(409).json({ error: 'Point already collected' });
    }
    
    const now = new Date();
    if (new Date(point.scheduledTime) > now) {
      logUserAction('COLLECT_NOT_READY', { 
        pointId: id, 
        scheduledTime: point.scheduledTime,
        currentTime: now
      }, req);
      return res.status(423).json({ 
        error: 'Point not ready yet',
        scheduledTime: point.scheduledTime
      });
    }
    
    logUserAction('COLLECT_INFO_VIEWED', { pointId: id }, req);
    
    res.json({
      id: point.id,
      name: point.name,
      coordinates: point.coordinates,
      scheduledTime: point.scheduledTime
    });
  } catch (error) {
    console.error('❌ Ошибка получения информации о точке:', error);
    res.status(500).json({ error: 'Failed to get point info' });
  }
});

// Собрать модель
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, telegramData } = req.body;
    
    console.log('📦 Начинаем сбор модели:', { id, authMethod });
    
    if (!secret || !name) {
      return res.status(400).json({ error: 'Secret and name are required' });
    }
    
    const point = await ModelPoint.findOne({
      id: id.trim(),
      qrSecret: secret.trim()
    });
    
    if (!point) {
      logUserAction('COLLECT_FAILED_NOT_FOUND', { pointId: id }, req);
      return res.status(404).json({ error: 'Point not found or invalid secret' });
    }
    
    if (point.status === 'collected') {
      logUserAction('COLLECT_FAILED_ALREADY_COLLECTED', { pointId: id }, req);
      return res.status(409).json({ error: 'Point already collected' });
    }
    
    const now = new Date();
    if (new Date(point.scheduledTime) > now) {
      logUserAction('COLLECT_FAILED_NOT_READY', { 
        pointId: id, 
        scheduledTime: point.scheduledTime 
      }, req);
      return res.status(423).json({ 
        error: 'Point not ready yet',
        scheduledTime: point.scheduledTime
      });
    }
    
    const collectorInfo = {
      name: name.trim(),
      signature: signature ? signature.trim() : '',
      authMethod: authMethod || 'manual'
    };
    
    if (authMethod === 'telegram' && telegramData) {
      try {
        const parsedTelegramData = typeof telegramData === 'string' 
          ? JSON.parse(telegramData) 
          : telegramData;
        
        if (parsedTelegramData.id && parsedTelegramData.first_name && parsedTelegramData.auth_date) {
          collectorInfo.telegramData = {
            id: parsedTelegramData.id,
            first_name: parsedTelegramData.first_name,
            last_name: parsedTelegramData.last_name || '',
            username: parsedTelegramData.username || '',
            photo_url: parsedTelegramData.photo_url || '',
            auth_date: parsedTelegramData.auth_date,
            hash: parsedTelegramData.hash || ''
          };
          
          console.log('✅ Telegram данные обработаны для пользователя:', parsedTelegramData.first_name);
        } else {
          console.warn('⚠️ Неполные Telegram данные, используем ручной режим');
          collectorInfo.authMethod = 'manual';
        }
      } catch (error) {
        console.error('❌ Ошибка парсинга Telegram данных:', error);
        collectorInfo.authMethod = 'manual';
      }
    }
    
    if (req.file) {
      try {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        collectorInfo.selfie = base64Image;
        console.log('📸 Селфи обработано, размер:', req.file.size);
      } catch (error) {
        console.error('❌ Ошибка обработки селфи:', error);
      }
    }
    
    point.status = 'collected';
    point.collectedAt = now;
    point.collectorInfo = collectorInfo;
    
    await point.save();
    
    const logData = {
      pointId: id,
      pointName: point.name,
      collectorName: collectorInfo.name,
      authMethod: collectorInfo.authMethod,
      hasSelfie: !!collectorInfo.selfie,
      telegramUserId: collectorInfo.telegramData?.id
    };
    
    logUserAction('COLLECT_SUCCESS', logData, req);
    console.log(`🎯 Модель собрана: ${point.name} пользователем ${collectorInfo.name}`);
    
    res.json({
      success: true,
      message: 'Point collected successfully',
      point: {
        id: point.id,
        name: point.name,
        collectedAt: point.collectedAt,
        collectorName: collectorInfo.name
      }
    });
  } catch (error) {
    console.error('❌ Ошибка сбора модели:', error);
    res.status(500).json({ error: 'Failed to collect point' });
  }
});

// ============== АДМИНСКИЕ МАРШРУТЫ ==============

// Получить все точки для админа
app.get('/api/admin/points', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_ACCESS_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
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
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_CREATE_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { name, coordinates, delayMinutes } = req.body;
    
    if (!name || !coordinates || typeof coordinates.lat !== 'number' || typeof coordinates.lng !== 'number') {
      return res.status(400).json({ error: 'Invalid point data' });
    }

    const pointId = Date.now().toString();
    const qrSecret = crypto.randomBytes(16).toString('hex');
    
    const scheduledTime = new Date();
    if (delayMinutes && !isNaN(delayMinutes)) {
      scheduledTime.setMinutes(scheduledTime.getMinutes() + parseInt(delayMinutes));
    }

    const protocol = req.get('x-forwarded-proto') || req.protocol;
    const host = req.get('host');
    const collectUrl = `${protocol}://${host}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
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

// Удалить точку (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_DELETE_DENIED', { ip: req.ip, pointId: req.params.id }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
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
    res.json({ success: true, message: 'Point deleted successfully' });
  } catch (error) {
    console.error('❌ Ошибка удаления точки:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// ============== TELEGRAM МАРШРУТЫ ==============

// Получить рейтинг Telegram пользователей
app.get('/api/telegram/leaderboard', async (req, res) => {
  try {
    console.log('🏆 Загружаем рейтинг Telegram пользователей...');
    
    const leaderboard = await ModelPoint.aggregate([
      {
        $match: {
          status: 'collected',
          'collectorInfo.authMethod': 'telegram',
          'collectorInfo.telegramData.id': { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$collectorInfo.telegramData.id',
          totalCollections: { $sum: 1 },
          firstCollection: { $min: '$collectedAt' },
          lastCollection: { $max: '$collectedAt' },
          userData: { $first: '$collectorInfo.telegramData' }
        }
      },
      {
        $project: {
          _id: 0,
          telegramId: '$_id',
          totalCollections: 1,
          firstCollection: 1,
          lastCollection: 1,
          id: '$userData.id',
          first_name: '$userData.first_name',
          last_name: '$userData.last_name',
          username: '$userData.username',
          photo_url: '$userData.photo_url'
        }
      },
      {
        $sort: { totalCollections: -1, firstCollection: 1 }
      },
      {
        $limit: 50
      }
    ]);

    const stats = await ModelPoint.aggregate([
      {
        $match: {
          status: 'collected',
          'collectorInfo.authMethod': 'telegram'
        }
      },
      {
        $group: {
          _id: null,
          totalCollections: { $sum: 1 },
          uniqueUsers: { $addToSet: '$collectorInfo.telegramData.id' }
        }
      },
      {
        $project: {
          _id: 0,
          totalCollections: 1,
          totalUsers: { $size: '$uniqueUsers' }
        }
      }
    ]);

    const statsResult = stats[0] || { totalCollections: 0, totalUsers: 0 };

    const response = {
      leaderboard,
      stats: statsResult,
      timestamp: new Date().toISOString()
    };

    logUserAction('TELEGRAM_LEADERBOARD_VIEWED', { 
      leaderboardCount: leaderboard.length,
      ...statsResult 
    }, req);
    
    console.log(`🏆 Рейтинг загружен: ${leaderboard.length} пользователей, ${statsResult.totalCollections} сборов`);
    
    res.json(response);
  } catch (error) {
    console.error('❌ Ошибка загрузки рейтинга:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ============== СТАТИЧЕСКИЕ ФАЙЛЫ ==============

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/collect.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'collect.html'));
});

app.get('/leaderboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'leaderboard.html'));
});

// Обработка 404
app.use((req, res) => {
  console.log('❌ 404 - Страница не найдена:', req.url);
  res.status(404).json({ error: 'Page not found' });
});

// Обработка ошибок
app.use((error, req, res, next) => {
  console.error('❌ Серверная ошибка:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Запуск сервера
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log('🚀 PlasticBoy Server запущен');
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🛡️ Админ панель: http://localhost:${PORT}/admin.html`);
      console.log(`🏆 Рейтинг: http://localhost:${PORT}/leaderboard.html`);
      console.log(`🔐 Админ пароль: ${process.env.ADMIN_PASSWORD ? 'установлен' : 'НЕ УСТАНОВЛЕН!'}`);
      console.log(`📱 Telegram бот: ${process.env.TELEGRAM_BOT_USERNAME ? process.env.TELEGRAM_BOT_USERNAME : 'НЕ НАСТРОЕН'}`);
      
      if (BOT_TOKEN) {
        console.log(`🔗 Telegram webhook: /${BOT_TOKEN}`);
        console.log(`📱 Telegram интеграция: АКТИВНА`);
      } else {
        console.log(`📱 Telegram интеграция: НЕ НАСТРОЕНА`);
      }
    });
  } catch (error) {
    console.error('❌ Ошибка запуска сервера:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM получен, завершаем сервер...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT получен, завершаем сервер...');
  mongoose.connection.close();
  process.exit(0);
});

startServer();
