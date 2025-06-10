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

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

// === TELEGRAM BOT INTEGRATION ===
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN}`;

console.log('🤖 Telegram Bot Configuration:');
console.log('Token available:', !!BOT_TOKEN);
console.log('Bot username:', BOT_USERNAME);
console.log('Webhook path:', WEBHOOK_PATH);

// Function to send messages to Telegram
async function sendTelegramMessage(chatId, message, options = {}) {
  if (!BOT_TOKEN) {
    console.log('⚠️ BOT_TOKEN not available, cannot send message');
    return;
  }
  
  try {
    console.log(`📤 Sending message to chat ${chatId}:`, message.substring(0, 100) + '...');
    
    const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...options
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Message sent successfully to chat ${chatId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Telegram message error:', error.response?.data || error.message);
    
    // Try sending without markdown if parsing failed
    if (error.response?.data?.description?.includes('parse')) {
      try {
        console.log('🔄 Retrying without markdown...');
        const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: message.replace(/[*_`\[\]]/g, ''), // Remove markdown
          ...options,
          parse_mode: undefined
        });
        console.log(`✅ Message sent without markdown to chat ${chatId}`);
        return response.data;
      } catch (retryError) {
        console.error('❌ Retry also failed:', retryError.response?.data || retryError.message);
      }
    }
    throw error;
  }
}

// Function to get app URL
function getAppUrl(req) {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL;
  }
  
  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host');
  return `${protocol}://${host}`;
}

// Function to handle Telegram commands
async function handleTelegramUpdate(update, req) {
  try {
    console.log('📥 Processing Telegram update:', JSON.stringify(update, null, 2));
    
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const user = message.from;
      
      console.log(`💬 Message from ${user.first_name} (${user.id}): ${text}`);
      
      // Handle commands
      if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].substring(1).toLowerCase();
        // Remove bot username if present (e.g., /start@PlasticBoyBot -> start)
        const cleanCommand = command.replace(`@${BOT_USERNAME.toLowerCase()}`, '');
        console.log(`🔧 Processing command: /${cleanCommand}`);
        
        const appUrl = getAppUrl(req);
        
        switch (cleanCommand) {
          case 'start':
            const welcomeMessage = `🎯 *PlasticBoy - Almighty Edition*

Hello, ${user.first_name}! 👋

Welcome to the 3D model collection hunt in Almaty!

🎮 *How to play:*
• Find QR codes around the city
• Scan them to collect models
• Compete with other players

🏆 Happy hunting!`;
            
            await sendTelegramMessage(chatId, welcomeMessage, {
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
            });
            break;
            
          case 'help':
            const helpMessage = `❓ *PlasticBoy Help*

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

🏆 Good luck, collector!`;
            
            await sendTelegramMessage(chatId, helpMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Start Playing', url: appUrl }],
                  [{ text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` }]
                ]
              }
            });
            break;
            
          case 'map':
            const mapMessage = `🗺️ *Interactive Map*

Open the map to find 3D models around Almaty!

🔍 *Map Legend:*
• 🟢 Available models (ready to collect)
• 🔴 Already collected models
• 📍 Your current location

💡 *Tip:* Use the location button to find nearby models!`;
            
            await sendTelegramMessage(chatId, mapMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Open Map', url: appUrl }],
                  [
                    { text: '📊 Game Stats', callback_data: 'stats' },
                    { text: '🏆 Rankings', callback_data: 'leaderboard' }
                  ]
                ]
              }
            });
            break;
            
          case 'leaderboard':
            const leaderboardMessage = `🏆 *Collectors Leaderboard*

Check out the top PlasticBoy players!

⭐ Only Telegram-authenticated users appear in rankings

🥇🥈🥉 Who will collect the most models?

💡 Use Telegram login when collecting to join the leaderboard!`;
            
            await sendTelegramMessage(chatId, leaderboardMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏆 View Full Leaderboard', url: `${appUrl}/leaderboard.html` }],
                  [
                    { text: '🗺️ Play Game', url: appUrl },
                    { text: '📊 Statistics', callback_data: 'stats' }
                  ]
                ]
              }
            });
            break;
            
          case 'stats':
            await handleStatsCommand(chatId, appUrl);
            break;
            
          default:
            console.log(`❓ Unknown command: /${cleanCommand}`);
            const unknownMessage = `❓ Unknown command: /${cleanCommand}

📱 *Available Commands:*
/start - Main menu
/map - Open map
/leaderboard - Rankings
/stats - Game statistics
/help - Detailed help

🎯 Use the buttons below for quick access!`;
            
            await sendTelegramMessage(chatId, unknownMessage, {
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
        // Handle regular messages
        console.log(`💭 Regular message from ${user.first_name}: ${text}`);
        const appUrl = getAppUrl(req);
        
        const responses = [
          "Got your message! 📨",
          "Thanks for writing! 💬", 
          "Hello there! 👋",
          "Nice to hear from you! 😊"
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        
        await sendTelegramMessage(chatId, `${randomResponse}

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
    
    // Handle callback buttons
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, req);
    }
    
  } catch (error) {
    console.error('❌ Telegram update handling error:', error);
    
    // Try to send error message to user
    if (update.message?.chat?.id) {
      try {
        await sendTelegramMessage(update.message.chat.id, 
          "Sorry, something went wrong! Please try again or use /start");
      } catch (sendError) {
        console.error('❌ Failed to send error message:', sendError);
      }
    }
  }
}

// Handle statistics command
async function handleStatsCommand(chatId, appUrl) {
  try {
    const totalPoints = await ModelPoint.countDocuments();
    const collectedPoints = await ModelPoint.countDocuments({ status: 'collected' });
    const availablePoints = totalPoints - collectedPoints;
    
    // Get Telegram users statistics
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
    
    const statsMessage = `📊 *Game Statistics*

📦 Total Models: *${totalPoints}*
🟢 Available: *${availablePoints}*
🔴 Collected: *${collectedPoints}*

📱 *Telegram Players:*
👥 Active Players: *${telegramUsers}*
🎯 Their Collections: *${telegramCollections}*

🏆 Join the competition - use Telegram login when collecting!`;
    
    await sendTelegramMessage(chatId, statsMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🗺️ Start Playing', url: appUrl }],
          [
            { text: '🏆 View Leaderboard', url: `${appUrl}/leaderboard.html` },
            { text: '❓ Help', callback_data: 'help' }
          ]
        ]
      }
    });
  } catch (error) {
    console.error('❌ Stats command error:', error);
    await sendTelegramMessage(chatId, '❌ Unable to load statistics. Please try again later.');
  }
}

// Handle callback queries
async function handleCallbackQuery(callbackQuery, req) {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;
  const messageId = callbackQuery.message.message_id;
  const user = callbackQuery.from;
  
  console.log(`🔘 Callback: ${data} from ${user.first_name} (${user.id})`);
  
  // Always answer callback query first
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      callback_query_id: callbackQuery.id,
      text: '✅ Processing...'
    });
  } catch (error) {
    console.error('❌ answerCallbackQuery error:', error.response?.data || error.message);
  }
  
  const appUrl = getAppUrl(req);
  
  try {
    switch (data) {
      case 'help':
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
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
        });
        break;
        
      case 'leaderboard':
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
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
        });
        break;
        
      case 'stats':
        try {
          const totalPoints = await ModelPoint.countDocuments();
          const collectedPoints = await ModelPoint.countDocuments({ status: 'collected' });
          const availablePoints = totalPoints - collectedPoints;
          
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
          });
        } catch (error) {
          console.error('❌ Statistics callback error:', error);
          await sendTelegramMessage(chatId, '❌ Unable to load statistics. Please try again later.');
        }
        break;
        
      default:
        console.log(`❓ Unknown callback data: ${data}`);
        await sendTelegramMessage(chatId, 'Unknown action. Please use /start to see available options.');
    }
  } catch (error) {
    console.error('❌ Callback handling error:', error.response?.data || error.message);
    
    // Fallback: send new message if edit fails
    try {
      await sendTelegramMessage(chatId, `Sorry, something went wrong with that action.

Use /start to return to the main menu.`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗺️ Start Playing', url: appUrl }]
          ]
        }
      });
    } catch (fallbackError) {
      console.error('❌ Fallback message also failed:', fallbackError);
    }
  }
}

// === WEBHOOK ROUTE FOR TELEGRAM ===
if (BOT_TOKEN) {
  // Webhook route
  app.post(WEBHOOK_PATH, async (req, res) => {
    console.log('📥 Webhook received from Telegram');
    console.log('📋 Update body:', JSON.stringify(req.body, null, 2));
    
    try {
      await handleTelegramUpdate(req.body, req);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Webhook handling error:', error);
      res.status(200).send('OK'); // Always return 200 to prevent Telegram retries
    }
  });
  
  // Webhook setup route
  app.get('/setup-webhook', async (req, res) => {
    try {
      const appUrl = getAppUrl(req);
      const webhookUrl = `${appUrl}${WEBHOOK_PATH}`;
      
      console.log('🔧 Setting up webhook:', webhookUrl);
      
      // First, delete existing webhook
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
        console.log('🗑️ Previous webhook deleted');
      } catch (deleteError) {
        console.log('⚠️ No previous webhook to delete');
      }
      
      // Set new webhook
      const response = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true // Clear any pending updates
      });
      
      console.log('✅ Webhook set successfully:', response.data);
      
      // Test the bot
      try {
        const meInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        console.log('🤖 Bot info:', meInfo.data.result);
      } catch (meError) {
        console.error('❌ Failed to get bot info:', meError.response?.data);
      }
      
      res.json({
        success: true,
        webhook_url: webhookUrl,
        telegram_response: response.data,
        instructions: {
          message: "Webhook set successfully!",
          test_bot: `Send /start to @${BOT_USERNAME} in Telegram`,
          check_status: `${appUrl}/webhook-info`
        }
      });
    } catch (error) {
      console.error('❌ Webhook setup error:', error.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message,
        instructions: {
          message: "Webhook setup failed!",
          check_token: "Verify your TELEGRAM_BOT_TOKEN",
          check_bot: `Make sure @${BOT_USERNAME} is correct`
        }
      });
    }
  });
  
  // Check webhook status
  app.get('/webhook-info', async (req, res) => {
    try {
      const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
      const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
      
      res.json({
        webhook_info: response.data,
        bot_info: botInfo.data,
        status: response.data.result.url ? 'Webhook is set' : 'No webhook configured',
        last_error: response.data.result.last_error_message || 'No errors'
      });
    } catch (error) {
      console.error('❌ Webhook info error:', error.response?.data || error.message);
      res.status(500).json({
        error: error.response?.data || error.message
      });
    }
  });
  
  // Test bot endpoint
  app.get('/test-bot', async (req, res) => {
    try {
      const testChatId = req.query.chat_id;
      if (!testChatId) {
        return res.status(400).json({
          error: 'Please provide chat_id parameter',
          example: `/test-bot?chat_id=YOUR_CHAT_ID`
        });
      }
      
      await sendTelegramMessage(testChatId, `🧪 Test message from PlasticBoy Bot!

This is a test to verify the bot is working correctly.

Time: ${new Date().toISOString()}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🗺️ Open Game', url: getAppUrl(req) }]
          ]
        }
      });
      
      res.json({
        success: true,
        message: 'Test message sent successfully!'
      });
    } catch (error) {
      console.error('❌ Test bot error:', error);
      res.status(500).json({
        success: false,
        error: error.response?.data || error.message
      });
    }
  });
  
  console.log(`🔗 Telegram webhook route configured: ${WEBHOOK_PATH}`);
  console.log(`🔧 Webhook setup available at: /setup-webhook`);
  console.log(`ℹ️ Webhook info available at: /webhook-info`);
  console.log(`🧪 Bot test available at: /test-bot?chat_id=YOUR_CHAT_ID`);
} else {
  console.log('⚠️ TELEGRAM_BOT_TOKEN not found, webhook not configured');
}

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Collection point model
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

// Indexes for optimization
modelPointSchema.index({ id: 1, qrSecret: 1 });
modelPointSchema.index({ status: 1, scheduledTime: 1 });
modelPointSchema.index({ collectedAt: 1 });
modelPointSchema.index({ 'collectorInfo.telegramData.id': 1 });

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// Log user actions
function logUserAction(action, data, req) {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`📝 [${timestamp}] ${action} - IP: ${ip} - Data:`, JSON.stringify(data));
}

// ОПТИМИЗИРОВАННАЯ проверка пароля администратора
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
  console.log('🔐 Admin password check:', isValid ? 'SUCCESS' : 'FAILED');
  
  return isValid;
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const totalPoints = await ModelPoint.countDocuments();
    
    // Test Telegram bot
    let telegramStatus = 'not_configured';
    if (BOT_TOKEN) {
      try {
        const botInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        telegramStatus = botInfo.data.ok ? 'working' : 'error';
      } catch (error) {
        telegramStatus = 'error';
      }
    }
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbState,
      totalPoints,
      environment: process.env.NODE_ENV || 'development',
      telegramBot: {
        configured: !!BOT_TOKEN,
        status: telegramStatus,
        username: BOT_USERNAME,
        webhookPath: BOT_TOKEN ? WEBHOOK_PATH : null
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Get all public points
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
    console.log(`📍 Loaded ${points.length} public points`);
    
    res.json(points);
  } catch (error) {
    console.error('❌ Points loading error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Get point information for collection
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
    console.error('❌ Point info retrieval error:', error);
    res.status(500).json({ error: 'Failed to get point info' });
  }
});

// Collect model
app.post('/api/collect/:id', upload.single('selfie'), async (req, res) => {
  try {
    const { id } = req.params;
    const { secret, name, signature, authMethod, telegramData } = req.body;
    
    console.log('📦 Starting model collection:', { id, authMethod });
    
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
          
          console.log('✅ Telegram data processed for user:', parsedTelegramData.first_name);
        } else {
          console.warn('⚠️ Incomplete Telegram data, using manual mode');
          collectorInfo.authMethod = 'manual';
        }
      } catch (error) {
        console.error('❌ Telegram data parsing error:', error);
        collectorInfo.authMethod = 'manual';
      }
    }
    
    if (req.file) {
      try {
        const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
        collectorInfo.selfie = base64Image;
        console.log('📸 Selfie processed, size:', req.file.size);
      } catch (error) {
        console.error('❌ Selfie processing error:', error);
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
    console.log(`🎯 Model collected: ${point.name} by user ${collectorInfo.name}`);
    
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
    console.error('❌ Model collection error:', error);
    res.status(500).json({ error: 'Failed to collect point' });
  }
});

// ============== ADMIN ROUTES ==============

// БЫСТРАЯ проверка пароля админа - HEAD запрос без загрузки данных
app.head('/api/admin/points', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_PASSWORD_CHECK_FAILED', { ip: req.ip }, req);
      return res.status(401).end();
    }
    
    logUserAction('ADMIN_PASSWORD_CHECK_SUCCESS', { ip: req.ip }, req);
    res.status(200).end();
  } catch (error) {
    console.error('❌ Admin password check error:', error);
    res.status(500).end();
  }
});

// Get all points for admin
app.get('/api/admin/points', async (req, res) => {
  try {
    if (!checkAdminPassword(req)) {
      logUserAction('ADMIN_ACCESS_DENIED', { ip: req.ip }, req);
      return res.status(401).json({ error: 'Invalid admin password' });
    }
    
    const points = await ModelPoint.find({}).lean().exec();
    
    logUserAction('ADMIN_POINTS_LOADED', { count: points.length }, req);
    console.log(`🛡️ Admin loaded ${points.length} points`);
    
    res.json(points);
  } catch (error) {
    console.error('❌ Admin points loading error:', error);
    res.status(500).json({ error: 'Failed to load points' });
  }
});

// Create new point (admin)
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

    const appUrl = getAppUrl(req);
    const collectUrl = `${appUrl}/collect.html?id=${pointId}&secret=${qrSecret}`;
    
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
    
    console.log(`✅ New point created: ${name} (ID: ${pointId})`);
    res.json(newPoint);
  } catch (error) {
    console.error('❌ Point creation error:', error);
    res.status(500).json({ error: 'Failed to create point' });
  }
});

// Delete point (admin)
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
    
    console.log(`🗑️ Point deleted: ${deletedPoint.name} (ID: ${id})`);
    res.json({ success: true, message: 'Point deleted successfully' });
  } catch (error) {
    console.error('❌ Point deletion error:', error);
    res.status(500).json({ error: 'Failed to delete point' });
  }
});

// ============== TELEGRAM ROUTES ==============

// Get Telegram users leaderboard
app.get('/api/telegram/leaderboard', async (req, res) => {
  try {
    console.log('🏆 Loading Telegram users leaderboard...');
    
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
    
    console.log(`🏆 Leaderboard loaded: ${leaderboard.length} users, ${statsResult.totalCollections} collections`);
    
    res.json(response);
  } catch (error) {
    console.error('❌ Leaderboard loading error:', error);
    res.status(500).json({ error: 'Failed to load leaderboard' });
  }
});

// ============== STATIC FILES ==============

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

// Handle 404
app.use((req, res) => {
  console.log('❌ 404 - Page not found:', req.url);
  res.status(404).json({ error: 'Page not found' });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('❌ Server error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    await connectDB();
    
    app.listen(PORT, () => {
      console.log('🚀 PlasticBoy Server started');
      console.log(`📍 URL: http://localhost:${PORT}`);
      console.log(`🛡️ Admin panel: http://localhost:${PORT}/admin.html`);
      console.log(`🏆 Leaderboard: http://localhost:${PORT}/leaderboard.html`);
      console.log(`🔐 Admin password: ${process.env.ADMIN_PASSWORD ? 'set' : 'NOT SET!'}`);
      console.log(`📱 Telegram bot: @${BOT_USERNAME}`);
      
      if (BOT_TOKEN) {
        console.log(`🔗 Telegram webhook: ${WEBHOOK_PATH}`);
        console.log(`📱 Telegram integration: ACTIVE`);
        console.log(`🔧 Setup webhook: http://localhost:${PORT}/setup-webhook`);
        console.log(`ℹ️ Webhook info: http://localhost:${PORT}/webhook-info`);
        console.log(`🧪 Test bot: http://localhost:${PORT}/test-bot?chat_id=YOUR_CHAT_ID`);
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
  console.log('📛 SIGTERM received, shutting down server...');
  mongoose.connection.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📛 SIGINT received, shutting down server...');
  mongoose.connection.close();
  process.exit(0);
});

startServer();
