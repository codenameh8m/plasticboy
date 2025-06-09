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

// Function to send messages to Telegram
async function sendTelegramMessage(chatId, message, options = {}) {
  if (!BOT_TOKEN) return;
  
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
      ...options
    });
    console.log(`📱 Telegram message sent to chat ${chatId}`);
  } catch (error) {
    console.error('❌ Telegram message sending error:', error.response?.data || error.message);
  }
}

// Function to handle Telegram commands
async function handleTelegramUpdate(update) {
  try {
    console.log('📥 Received Telegram update:', JSON.stringify(update, null, 2));
    
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const text = message.text;
      const user = message.from;
      
      console.log(`💬 Message from ${user.first_name} (${user.id}): ${text}`);
      
      // Handle commands
      if (text && text.startsWith('/')) {
        const command = text.split(' ')[0].substring(1);
        
        switch (command) {
          case 'start':
            const welcomeMessage = `🎯 *PlasticBoy - Almight Edition*\n\nHello, ${user.first_name}! 👋\n\nWelcome to the 3D model collection hunt game in Almaty!\n\n🎮 *How to play:*\n• Find QR codes of models around the city\n• Scan them and collect your collection\n• Compete with other players\n\nHappy hunting! 🎯`;
            
            await sendTelegramMessage(chatId, welcomeMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Open Map', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [
                    { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                    { text: '📊 Statistics', callback_data: 'stats' }
                  ]
                ]
              }
            });
            break;
            
          case 'help':
            const helpMessage = `❓ *PlasticBoy Help*\n\n🎯 *Game goal:* Collect as many 3D models as possible!\n\n📱 *Commands:*\n/start - Main menu\n/map - Open map\n/leaderboard - Player rankings\n/stats - Game statistics\n/help - This help\n\nGood luck! 🚀`;
            await sendTelegramMessage(chatId, helpMessage);
            break;
            
          case 'map':
            const mapMessage = `🗺️ *PlasticBoy Map*\n\nOpen the interactive map to find 3D models in Almaty!\n\n🎯 On the map you will see:\n• 🟢 Available models\n• 🔴 Already collected models\n• 📍 Your location`;
            
            await sendTelegramMessage(chatId, mapMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Open Map', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [{ text: '📊 Statistics', callback_data: 'stats' }]
                ]
              }
            });
            break;
            
          case 'leaderboard':
            const leaderboardMessage = `🏆 *Collectors Leaderboard*\n\nCheck out the top PlasticBoy players!\n\n⭐ Only users authorized via Telegram participate in the rankings\n\n🥇🥈🥉 Who will collect the most models?`;
            
            await sendTelegramMessage(chatId, leaderboardMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏆 Open Leaderboard', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }],
                  [{ text: '🗺️ To Map', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
                ]
              }
            });
            break;
            
          case 'stats':
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
              
              const statsMessage = `📊 *PlasticBoy Statistics*\n\n📦 Total models: *${totalPoints}*\n🟢 Available: *${availablePoints}*\n🔴 Collected: *${collectedPoints}*\n\n📱 *Telegram players:*\n👥 Participants: *${telegramUsers}*\n🎯 Collected by them: *${telegramCollections}*\n\n🎮 Join the game!`;
              
              await sendTelegramMessage(chatId, statsMessage, {
                reply_markup: {
                  inline_keyboard: [
                    [{ text: '🗺️ Play', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                    [{ text: '🏆 Leaderboard', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }]
                  ]
                }
              });
            } catch (error) {
              await sendTelegramMessage(chatId, '❌ Statistics retrieval error');
            }
            break;
            
          default:
            const unknownMessage = `❓ Unknown command: /${command}\n\n📱 *Available commands:*\n/start - Main menu\n/map - Open map\n/leaderboard - Player rankings\n/stats - Game statistics\n/help - Help\n\n🎯 Use commands for navigation!`;
            await sendTelegramMessage(chatId, unknownMessage, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Open Map', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [
                    { text: '🏆 Leaderboard', callback_data: 'leaderboard' },
                    { text: '📊 Statistics', callback_data: 'stats' }
                  ]
                ]
              }
            });
        }
      } else if (text) {
        // Regular message
        await sendTelegramMessage(chatId, `Got your message: "${text}"\n\nUse /help for command list.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🗺️ Play', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
            ]
          }
        });
      }
    }
    
    // Handle callback buttons
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      const messageId = callbackQuery.message.message_id;
      
      console.log(`🔘 Callback: ${data} from ${callbackQuery.from.first_name}`);
      
      // Confirm callback
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
          callback_query_id: callbackQuery.id
        });
      } catch (error) {
        console.error('❌ answerCallbackQuery error:', error);
      }
      
      // Handle callback
      switch (data) {
        case 'leaderboard':
          await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: '🏆 *Collectors Leaderboard*\n\nOpen the web version to view the full player rankings!',
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🏆 Open Leaderboard', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }],
                [{ text: '🗺️ To Map', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }]
              ]
            }
          });
          break;
          
        case 'stats':
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
            
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
              chat_id: chatId,
              message_id: messageId,
              text: `📊 *Game Statistics*\n\n📦 Total models: *${totalPoints}*\n🟢 Available: *${availablePoints}*\n🔴 Collected: *${collectedPoints}*\n\n📱 *Telegram players:*\n👥 Participants: *${telegramUsers}*\n🎯 Collected by them: *${telegramCollections}*`,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🗺️ Play', web_app: { url: process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000' } }],
                  [{ text: '🏆 Leaderboard', url: `${process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000'}/leaderboard.html` }]
                ]
              }
            });
          } catch (error) {
            console.error('❌ Statistics retrieval error for callback:', error);
          }
          break;
      }
    }
    
  } catch (error) {
    console.error('❌ Telegram update handling error:', error);
  }
}

// === WEBHOOK ROUTE FOR TELEGRAM ===
if (BOT_TOKEN) {
  app.post(`/${BOT_TOKEN}`, async (req, res) => {
    console.log('📥 Webhook received from Telegram');
    
    try {
      await handleTelegramUpdate(req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Webhook handling error:', error);
      res.status(500).send('Error');
    }
  });
  
  console.log(`🔗 Telegram webhook route configured: /${BOT_TOKEN}`);
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

// Check admin password function
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
  console.log('🔐 Admin password check:', isValid ? 'SUCCESS' : 'ERROR');
  
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
      console.log(`📱 Telegram bot: ${process.env.TELEGRAM_BOT_USERNAME ? process.env.TELEGRAM_BOT_USERNAME : 'NOT CONFIGURED'}`);
      
      if (BOT_TOKEN) {
        console.log(`🔗 Telegram webhook: /${BOT_TOKEN}`);
        console.log(`📱 Telegram integration: ACTIVE`);
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
