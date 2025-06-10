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

// КЭШИРОВАНИЕ
const cache = new Map();
const CACHE_TTL = {
  POINTS: 2 * 60 * 1000,     // 2 минуты для точек
  ADMIN: 1 * 60 * 1000,      // 1 минута для админа
  LEADERBOARD: 5 * 60 * 1000 // 5 минут для рейтинга
};

function setCache(key, data, ttl = CACHE_TTL.POINTS) {
  cache.set(key, {
    data,
    expires: Date.now() + ttl
  });
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  
  if (Date.now() > item.expires) {
    cache.delete(key);
    return null;
  }
  
  return item.data;
}

function clearCache(pattern = null) {
  if (!pattern) {
    cache.clear();
    return;
  }
  
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// ОЧИСТКА КЭША КАЖДЫЕ 10 МИНУТ
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now > value.expires) {
      cache.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Middleware с оптимизацией
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : true,
  credentials: false
}));

app.use(express.json({ 
  limit: '10mb',
  type: ['application/json', 'text/plain']
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb'
}));

// СЖАТИЕ СТАТИЧЕСКИХ ФАЙЛОВ
app.use(express.static('public', {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0',
  etag: true,
  lastModified: true
}));

// Configure multer с оптимизацией
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB вместо 50MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images allowed'), false);
    }
  }
});

// === ТЕЛЕГРАМ БОТ ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

console.log('🤖 Telegram Bot Configuration:');
console.log('Token available:', !!BOT_TOKEN);
console.log('Bot username:', BOT_USERNAME);

// МОЛНИЕНОСНАЯ проверка пароля
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
function ultraFastPasswordCheck(req) {
  const password = req.headers.authorization || req.headers['x-admin-password'];
  return password === ADMIN_PASSWORD;
}

// HEAD endpoint для мгновенной проверки пароля
app.head('/api/admin/points', (req, res) => {
  res.status(ultraFastPasswordCheck(req) ? 200 : 401).end();
});

// ОПТИМИЗИРОВАННАЯ СХЕМА MONGODB - ИСПРАВЛЕННАЯ
const modelPointSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, index: 'text' },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  qrCode: { type: String, required: true },
  qrSecret: { type: String, required: true, index: true },
  status: { type: String, enum: ['available', 'collected'], default: 'available', index: true },
  createdAt: { type: Date, default: Date.now, index: true },
  scheduledTime: { type: Date, default: Date.now, index: true },
  collectedAt: { type: Date, sparse: true, index: true },
  collectorInfo: {
    name: String,
    signature: String,
    selfie: String,
    authMethod: { type: String, enum: ['manual', 'telegram'], default: 'manual', index: true },
    telegramData: {
      id: { type: Number, index: true },
      first_name: String,
      last_name: String,
      username: String,
      photo_url: String,
      auth_date: Number,
      hash: String
    }
  }
}, {
  // ОПТИМИЗАЦИИ MONGOOSE
  versionKey: false,
  minimize: false,
  strict: true
});

// СОСТАВНЫЕ ИНДЕКСЫ для ускорения запросов (БЕЗ геопространственного)
modelPointSchema.index({ status: 1, scheduledTime: 1 });
modelPointSchema.index({ id: 1, qrSecret: 1 });
modelPointSchema.index({ 'collectorInfo.telegramData.id': 1, collectedAt: -1 });
modelPointSchema.index({ 'collectorInfo.authMethod': 1, status: 1 });
modelPointSchema.index({ 'coordinates.lat': 1, 'coordinates.lng': 1 }); // Обычный составной индекс вместо 2dsphere

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// ПУЛЛ ЗАПРОСОВ К TELEGRAM API
const telegramQueue = [];
let telegramProcessing = false;

async function processTelegramQueue() {
  if (telegramProcessing || telegramQueue.length === 0) return;
  
  telegramProcessing = true;
  
  while (telegramQueue.length > 0) {
    const request = telegramQueue.shift();
    try {
      await request.execute();
    } catch (error) {
      console.error('❌ Telegram queue error:', error.message);
    }
    
    // Пауза между запросами для избежания rate limit
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  telegramProcessing = false;
}

// Быстрая отправка сообщений через очередь
function queueTelegramMessage(chatId, message, options = {}) {
  return new Promise((resolve, reject) => {
    telegramQueue.push({
      execute: async () => {
        try {
          const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: message,
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            ...options
          }, {
            timeout: 5000,
            headers: { 'Content-Type': 'application/json' }
          });
          resolve(response.data);
        } catch (error) {
          // Retry without markdown on parse error
          if (error.response?.data?.description?.includes('parse')) {
            try {
              const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                chat_id: chatId,
                text: message.replace(/[*_`\[\]]/g, ''),
                ...options,
                parse_mode: undefined
              });
              resolve(response.data);
            } catch (retryError) {
              reject(retryError);
            }
          } else {
            reject(error);
          }
        }
      }
    });
    
    // Запускаем обработку очереди
    processTelegramQueue();
  });
}

// Получение URL приложения с кэшированием
let cachedAppUrl = null;
function getAppUrl(req) {
  if (cachedAppUrl) return cachedAppUrl;
  
  if (process.env.RENDER_EXTERNAL_URL) {
    cachedAppUrl = process.env.RENDER_EXTERNAL_URL;
    return cachedAppUrl;
  }
  
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  cachedAppUrl = `${protocol}://${host}`;
  return cachedAppUrl;
}

// ОПТИМИЗИРОВАННАЯ обработка Telegram updates
async function handleTelegramUpdate(update, req) {
  try {
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const user = message.from;
      
      if (text?.startsWith('/')) {
        const command = text.split(' ')[0].substring(1).toLowerCase().replace(`@${BOT_USERNAME.toLowerCase()}`, '');
        const appUrl = getAppUrl(req);
        
        const commands = {
          start: () => queueTelegramMessage(chatId, `🎯 *PlasticBoy - Almighty Edition*

Hello, ${user.first_name}! 👋

Welcome to the 3D model collection hunt in Almaty!

🎮 *How to play:*
• Find QR codes around the city
• Scan them to collect models
• Compete with other players

🏆 Happy hunting!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Open Map', url: appUrl }],
                [
                  { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                  { text: '📊 Statistics', callback_data: 'stats' }
                ],
                [{ text: '❓ Help', callback_data: 'help' }]
              ]
            }
          }),
          
          help: () => queueTelegramMessage(chatId, `❓ *PlasticBoy Help*

🎯 *Game Goal:* Collect as many 3D models as possible!

📱 *Available Commands:*
/start - Main menu with buttons
/map - Open interactive map
/leaderboard - View player rankings
/stats - Game statistics
/help - Show this help

🎮 *How to Play:*
1. Find QR codes around Almaty
2. Scan them with your phone
3. Fill in your info (use Telegram login!)
4. Collect points and climb the leaderboard

🏆 Good luck, collector!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Start Playing', url: appUrl }],
                [{ text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` }]
              ]
            }
          }),
          
          map: () => queueTelegramMessage(chatId, `🗺️ *Interactive Map*

Open the map to find 3D models around Almaty!

🔍 *Map Legend:*
• 🟢 Available models (ready to collect)
• 🔴 Already collected models
• 📍 Your current location

💡 *Tip:* Use the location button to find nearby models!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Open Map', url: appUrl }],
                [
                  { text: '📊 Game Stats', callback_data: 'stats' },
                  { text: '🏆 Rankings', callback_data: 'leaderboard' }
                ]
              ]
            }
          }),
          
          leaderboard: () => queueTelegramMessage(chatId, `🏆 *Collectors Leaderboard*

Check out the top PlasticBoy players!

⭐ Only Telegram-authenticated users appear in rankings

🥇🥈🥉 Who will collect the most models?

💡 Use Telegram login when collecting to join the leaderboard!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 View Full Leaderboard', url: `${appUrl}/leaderboard.html` }],
                [
                  { text: '🗺️ Play Game', url: appUrl },
                  { text: '📊 Statistics', callback_data: 'stats' }
                ]
              ]
            }
          }),
          
          stats: async () => {
            try {
              const cached = getCache('telegram_stats');
              if (cached) {
                return queueTelegramMessage(chatId, cached.message, cached.options);
              }
              
              const [totalPoints, collectedPoints, telegramStats] = await Promise.all([
                ModelPoint.countDocuments(),
                ModelPoint.countDocuments({ status: 'collected' }),
                ModelPoint.aggregate([
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
                ])
              ]);
              
              const availablePoints = totalPoints - collectedPoints;
              const tgStats = telegramStats[0] || { telegramCollections: 0, uniqueTelegramUsers: [] };
              const telegramUsers = tgStats.uniqueTelegramUsers.length;
              const telegramCollections = tgStats.telegramCollections;
              
              const message = `📊 *Game Statistics*

📦 Total Models: *${totalPoints}*
🟢 Available: *${availablePoints}*
🔴 Collected: *${collectedPoints}*

📱 *Telegram Players:*
👥 Active Players: *${telegramUsers}*
🎯 Their Collections: *${telegramCollections}*

🏆 Join the competition - use Telegram login when collecting!`;
              
              const options = {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🗺️ Start Playing', url: appUrl }],
                    [
                      { text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` },
                      { text: '❓ Help', callback_data: 'help' }
                    ]
                  ]
                }
              };
              
              setCache('telegram_stats', { message, options }, 60000); // 1 минута
              return queueTelegramMessage(chatId, message, options);
            } catch (error) {
              console.error('❌ Stats command error:', error);
              return queueTelegramMessage(chatId, '❌ Unable to load statistics. Please try again later.');
            }
          }
        };
        
        if (commands[command]) {
          await commands[command]();
        } else {
          await queueTelegramMessage(chatId, `❓ Unknown command: /${command}

📱 *Available Commands:*
/start - Main menu
/map - Open map
/leaderboard - Rankings
/stats - Game statistics
/help - Detailed help

🎯 Use the buttons below for quick access!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Play Game', url: appUrl }],
                [
                  { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                  { text: '📊 Statistics', callback_data: 'stats' }
                ],
                [{ text: '❓ Help', callback_data: 'help' }]
              ]
            }
          });
        }
      } else if (text) {
        const appUrl = getAppUrl(req);
        const responses = ["Got your message! 📨", "Thanks for writing! 💬", "Hello there! 👋", "Nice to hear from you! 😊"];
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        await queueTelegramMessage(chatId, `${randomResponse}

Your message: "${text}"

Use /help to see available commands or click the buttons below!`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗺️ Start Playing', url: appUrl }],
              [
                { text: '❓ Help', callback_data: 'help' },
                { text: '📊 Stats', callback_data: 'stats' }
              ]
            ]
          }
        });
      }
    }
    
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, req);
    }
    
  } catch (error) {
    console.error('❌ Telegram update handling error:', error);
  }
}

// ОПТИМИЗИРОВАННАЯ обработка callback'ов
async function handleCallbackQuery(callbackQuery, req) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  
  // Быстрый ответ на callback
  axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    callback_query_id: callbackQuery.id,
    text: '✅'
  }).catch(() => {}); // Игнорируем ошибки
  
  const appUrl = getAppUrl(req);
  
  try {
    const callbacks = {
      help: () => axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: `❓ *PlasticBoy Help*

🎯 *Game Goal:* Collect 3D models around Almaty!

📱 *Commands:*
/start - Main menu
/map - Interactive map
/leaderboard - Player rankings
/stats - Game statistics

🎮 *How to Play:*
1. Find QR codes around the city
2. Scan with your phone camera
3. Use Telegram login for leaderboard
4. Collect points and compete!

🏆 Happy hunting!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗺️ Start Playing', url: appUrl }],
            [
              { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
              { text: '📊 Statistics', callback_data: 'stats' }
            ]
          ]
        }
      }),
      
      leaderboard: () => axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
        chat_id: chatId,
        message_id: messageId,
        text: `🏆 *Collectors Leaderboard*

View the top PlasticBoy players!

⭐ Only Telegram-authenticated users appear in rankings

🥇🥈🥉 Compete for the top spots!

💡 Use Telegram login when collecting models to join the leaderboard!`,
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🏆 View Full Leaderboard', url: `${appUrl}/leaderboard.html` }],
            [
              { text: '🗺️ Play Game', url: appUrl },
              { text: '📊 Statistics', callback_data: 'stats' }
            ],
            [{ text: '❓ Help', callback_data: 'help' }]
          ]
        }
      }),
      
      stats: async () => {
        try {
          const cached = getCache('callback_stats');
          if (cached) {
            return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              chat_id: chatId,
              message_id: messageId,
              ...cached
            });
          }
          
          const [totalPoints, collectedPoints, telegramStats] = await Promise.all([
            ModelPoint.countDocuments(),
            ModelPoint.countDocuments({ status: 'collected' }),
            ModelPoint.aggregate([
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
            ])
          ]);
          
          const availablePoints = totalPoints - collectedPoints;
          const tgStats = telegramStats[0] || { telegramCollections: 0, uniqueTelegramUsers: [] };
          const telegramUsers = tgStats.uniqueTelegramUsers.length;
          const telegramCollections = tgStats.telegramCollections;
          
          const response = {
            text: `📊 *Game Statistics*

📦 Total Models: *${totalPoints}*
🟢 Available: *${availablePoints}*
🔴 Collected: *${collectedPoints}*

📱 *Telegram Players:*
👥 Active Players: *${telegramUsers}*
🎯 Their Collections: *${telegramCollections}*

🏆 Join the competition!`,
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗺️ Start Playing', url: appUrl }],
                [
                  { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                  { text: '❓ Help', callback_data: 'help' }
                ]
              ]
            }
          };
          
          setCache('callback_stats', response, 60000); // 1 минута
          
          return axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            ...response
          });
        } catch (error) {
          console.error('❌ Statistics callback error:', error);
          return queueTelegramMessage(chatId, '❌ Unable to load statistics. Please try again later.');
        }
      }
    };
    
    if (callbacks[data]) {
      await callbacks[data]();
    }
  } catch (error) {
    console.error('❌ Callback handling error:', error);
  }
}

// WEBHOOK РОУТЫ С ОПТИМИЗАЦИЕЙ
if (BOT_TOKEN) {
  app.post(WEBHOOK_PATH, async (req, res) => {
    res.status(200).send('OK'); // Быстрый ответ
    
    // Обработка в фоне
    setImmediate(() => {
      handleTelegramUpdate(req.body, req).catch(error => {
        console.error('❌ Webhook background error:', error);
      });
    });
  });
  
  app.get('/setup-webhook', async (req, res) => {
    try {
      const appUrl = getAppUrl(req);
      const webhookUrl = `${appUrl}${WEBHOOK_PATH}`;
      
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
      
      const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true
      });
      
      res.json({
        success: true,
        webhook_url: webhookUrl,
        telegram_response: response.data
      });
    } catch (error) {
      console.error('❌ Webhook setup error:', error);
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  });
  
  app.get('/webhook-info', async (req, res) => {
    try {
      const [webhookInfo, botInfo] = await Promise.all([
        axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`),
        axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`)
      ]);
      
      res.json({
        webhook_info: webhookInfo.data,
        bot_info: botInfo.data,
        status: webhookInfo.data.result.url ? 'Webhook is set' : 'No webhook configured'
      });
    } catch (error) {
      res.status(500).json({ error: error.response?.data || error.message });
    }
  });
}

// ПОДКЛЮЧЕНИЕ К MONGODB с оптимизацией
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      w: 'majority'
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// ЛОГИРОВАНИЕ с оптимизацией
function logUserAction(action, data, req) {
  if (process.env.NODE_ENV === 'development') {
    const timestamp = new Date().toISOString();
    const ip = req.ip || 'unknown';
    console.log(`📝 [${timestamp}] ${action} - IP: ${ip}`);
  }
}

// HEALTH CHECK с кэшированием
app.get('/health', async (req, res) => {
  try {
    const cached = getCache('health_check');
    if (cached) {
      return res.json(cached);
    }
    
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const totalPoints = await ModelPoint.countDocuments();
    
    let telegramStatus = 'not_configured';
    if (BOT_TOKEN) {
      try {
        const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, { timeout: 3000 });
        telegramStatus = botInfo.data.ok ? 'working' : 'error';
      } catch (error) {
        telegramStatus = 'error';
      }
    }
    
    const response = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbState,
      totalPoints,
      environment: process.env.NODE_ENV || 'development',
      cache: {
        size: cache.size,
        entries: Array.from(cache.keys())
      },
      telegramBot: {
        configured: !!BOT_TOKEN,
        status: telegramStatus,
        username: BOT_USERNAME
      }
    };
    
    setCache('health_check', response, 30000); // 30 секунд
    res.json(response);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ПОЛУЧЕНИЕ ТОЧЕК С АГРЕССИВНЫМ КЭШИРОВАНИЕМ
app.get('/api/points', async (req, res) => {
  try {
    const cacheKey = 'public_points';
    const cached = getCache(cacheKey);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    const now = new Date();
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    })
    .select('-qrSecret -collectorInfo.telegramData.hash -collectorInfo.selfie')
    .lean()
    .exec();
    
    setCache(cacheKey, points, CACHE_TTL.POINTS);
    
    res.set('X-Cache', 'MISS');
    res.json(points);
    
    logUserAction('POINTS_LOADED', { count: points.length }, req);
  } catch (error) {
    console.error('❌ Points loading error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// ПОЛУЧЕНИЕ ИНФОРМАЦИИ О ТОЧКЕ (оптимизировано)
app.get('/api/collect/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { secret } = req.query;
    
    if (!secret) {
      return res.status(400).json({ error: 'Secret is required' });
    }
    
    const cacheKey = `collect_${id}_${secret}`;
    const cached = getCache(cacheKey);
    
    if (cached) {
      if (cached.error) {
        return res.status(cached.status).json({ error: cached.error });
      }
      return res.json(cached);
    }
    
    const point = await ModelPoint.findOne({
      id: id.trim(),
      qrSecret: secret.trim()
    })
    .select('id name coordinates status scheduledTime')
    .lean()
    .exec();
    
    if (!point) {
      const errorResponse = { error: 'Point not found or invalid secret', status: 404 };
      setCache(cacheKey, errorResponse, 60000); // Кэшируем ошибки на 1 минуту
      return res.status(404).json({ error: errorResponse.error });
    }
    
    if (point.status === 'collected') {
      const errorResponse = { error: 'Point already collected', status: 409 };
      setCache(cacheKey, errorResponse, 300000); // 5 минут для собранных точек
      return res.status(409).json({ error: errorResponse.error });
    }
    
    const now = new Date();
    if (new Date(point.scheduledTime) > now) {
      const errorResponse = { 
        error: 'Point not ready yet',
        status: 423,
        scheduledTime: point.scheduledTime
      };
      setCache(cacheKey, errorResponse, 60000);
      return res.status(423).json({ 
        error: errorResponse.error,
        scheduledTime: point.scheduledTime
      });
    }
    
    const response = {
      id: point.id,
      name: point.name,
      coordinates: point.coordinates,
      scheduledTime: point.scheduledTime
    };
    
    setCache(cacheKey, response, 300000); // 5 минут
    res.json(response);
    
    logUserAction('COLLECT_INFO_VIEWED', { pointId: id }, req);
  } catch (error) {
    console.error('❌ Point info retrieval error:', error);
    res.status(500).json({ error: 'Failed to get point info' });
  }
});

// СБОР МОДЕЛИ (оптимизировано)
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, telegramData } = req.body;
    
    if (!secret || !name) {
      return res.status(400).json({ error: 'Secret and name are required' });
    }
    
    // Быстрая проверка без кэша для актуальности
    const point = await ModelPoint.findOne({
      id: id.trim(),
      qrSecret: secret.trim()
    }).exec();
    
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
    
    // Обработка Telegram данных
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
        } else {
          collectorInfo.authMethod = 'manual';
        }
      } catch (error) {
        console.error('❌ Telegram data parsing error:', error);
        collectorInfo.authMethod = 'manual';
      }
    }
    
    // Обработка селфи
    if (req.file && req.file.size < 5 * 1024 * 1024) { // Максимум 5MB
      try {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        collectorInfo.selfie = base64Image;
      } catch (error) {
        console.error('❌ Selfie processing error:', error);
      }
    }
    
    // Атомарное обновление
    const updatedPoint = await ModelPoint.findOneAndUpdate(
      { 
        _id: point._id,
        status: 'available' // Защита от race condition
      },
      {
        $set: {
          status: 'collected',
          collectedAt: now,
          collectorInfo: collectorInfo
        }
      },
      { new: true }
    );
    
    if (!updatedPoint) {
      return res.status(409).json({ error: 'Point was collected by someone else' });
    }
    
    // Очистка кэша
    clearCache('points');
    clearCache('leaderboard');
    clearCache('stats');
    clearCache(`collect_${id}`);
    
    const logData = {
      pointId: id,
      pointName: point.name,
      collectorName: collectorInfo.name,
      authMethod: collectorInfo.authMethod,
      telegramUserId: collectorInfo.telegramData?.id
    };
    
    logUserAction('COLLECT_SUCCESS', logData, req);
    
    res.json({
      success: true,
      message: 'Point collected successfully',
      point: {
        id: point.id,
        name: point.name,
        collectedAt: now,
        collectorName: collectorInfo.name
      }
    });
  } catch (error) {
    console.error('❌ Model collection error:', error);
    res.status(500).json({ error: 'Failed to collect point' });
  }
});

// АДМИН РОУТЫ С ОПТИМИЗАЦИЕЙ

// Получение точек для админа
app.get('/api/admin/points', async (req, res) => {
  try {
    if (!ultraFastPasswordCheck(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    const cacheKey = 'admin_points';
    const cached = getCache(cacheKey);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    const points = await ModelPoint.find({})
      .select('-collectorInfo.selfie') // Исключаем тяжелые поля
      .lean()
      .exec();
    
    setCache(cacheKey, points, CACHE_TTL.ADMIN);
    
    res.set('X-Cache', 'MISS');
    res.json(points);
    
    logUserAction('ADMIN_POINTS_LOADED', { count: points.length }, req);
  } catch (error) {
    console.error('❌ Admin points loading error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Создание точки (админ)
app.post('/api/admin/points', async (req, res) => {
  try {
    if (!ultraFastPasswordCheck(req)) {
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

    const appUrl = cachedAppUrl || getAppUrl(req);
    const collectUrl = `${appUrl}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
    // Генерация QR кода с оптимизацией
    const qrCodeDataUrl = await QRCode.toDataURL(collectUrl, {
      width: 300, // Уменьшено с 400
      margin: 1,   // Уменьшено с 2
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M' // Средний уровень коррекции
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
    
    // Очистка кэша
    clearCache('points');
    clearCache('admin');
    
    logUserAction('ADMIN_POINT_CREATED', { 
      pointId, 
      name: name.trim(),
      scheduledTime: scheduledTime.toISOString()
    }, req);
    
    res.json(newPoint);
  } catch (error) {
    console.error('❌ Point creation error:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Удаление точки (админ)
app.delete('/api/admin/points/:id', async (req, res) => {
  try {
    if (!ultraFastPasswordCheck(req)) {
      return res.status(401).json({ error: 'Invalid admin password' });
    }

    const { id } = req.params;
    const deletedPoint = await ModelPoint.findOneAndDelete({ id: id.trim() });
    
    if (!deletedPoint) {
      return res.status(404).json({ error: 'Point not found' });
    }

    // Очистка кэша
    clearCache('points');
    clearCache('admin');
    clearCache('leaderboard');
    
    logUserAction('ADMIN_POINT_DELETED', { 
      pointId: id, 
      pointName: deletedPoint.name 
    }, req);
    
    res.json({ success: true, message: 'Point deleted successfully' });
  } catch (error) {
    console.error('❌ Point deletion error:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// РЕЙТИНГ TELEGRAM ПОЛЬЗОВАТЕЛЕЙ (с агрессивным кэшированием)
app.get('/api/telegram/leaderboard', async (req, res) => {
  try {
    const cacheKey = 'telegram_leaderboard';
    const cached = getCache(cacheKey);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    const [leaderboard, stats] = await Promise.all([
      ModelPoint.aggregate([
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
      ]),
      
      ModelPoint.aggregate([
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
      ])
    ]);

    const statsResult = stats[0] || { totalCollections: 0, totalUsers: 0 };

    const response = {
      leaderboard,
      stats: statsResult,
      timestamp: new Date().toISOString()
    };

    setCache(cacheKey, response, CACHE_TTL.LEADERBOARD);
    
    res.set('X-Cache', 'MISS');
    res.json(response);
    
    logUserAction('TELEGRAM_LEADERBOARD_VIEWED', { 
      leaderboardCount: leaderboard.length,
      ...statsResult 
    }, req);
  } catch (error) {
    console.error('❌ Leaderboard loading error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// СТАТИЧЕСКИЕ ФАЙЛЫ (оптимизировано)
const staticRoutes = {
  '/': 'index.html',
  '/admin': 'admin.html',
  '/admin.html': 'admin.html',
  '/collect.html': 'collect.html',
  '/leaderboard.html': 'leaderboard.html'
};

Object.entries(staticRoutes).forEach(([route, file]) => {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', file), {
      maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0',
      etag: true,
      lastModified: true
    });
  });
});

// 404 обработчик
app.use((req, res) => {
  res.status(404).json({ error: 'Page not found' });
});

// Обработчик ошибок
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// ЗАПУСК СЕРВЕРА
const startServer = async () => {
  try {
    await connectDB();
    
    // Создание индексов при старте - ТОЛЬКО ЕСЛИ НЕ СУЩЕСТВУЮТ
    try {
      await ModelPoint.createIndexes();
      console.log('✅ Database indexes ready');
    } catch (indexError) {
      console.warn('⚠️ Index creation warning:', indexError.message);
      // Продолжаем работу даже если индексы не создались
    }
    
    app.listen(PORT, () => {
      console.log('🚀 PlasticBoy Server started (OPTIMIZED)');
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🛡️ Admin panel: http://localhost:${PORT}/admin.html`);
      console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
      console.log(`🔐 Admin password: ${ADMIN_PASSWORD ? 'set' : 'NOT SET!'}`);
      console.log(`📱 Telegram bot: @${BOT_USERNAME}`);
      console.log(`💾 Cache system: ACTIVE`);
      
      if (BOT_TOKEN) {
        console.log(`🔗 Telegram webhook: ${WEBHOOK_PATH}`);
        console.log(`📱 Telegram integration: OPTIMIZED`);
        console.log(`🔧 Setup webhook: http://localhost:${PORT}/setup-webhook`);
      } else {
        console.log(`📱 Telegram integration: NOT CONFIGURED`);
      }
    });
  } catch (error) {
    console.error('❌ Server startup error:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📛 SIGTERM received, shutting down...');
  cache.clear();
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, shutting down...');
  cache.clear();
  mongoose.connection.close();
  process.exit(0);
});

startServer();
