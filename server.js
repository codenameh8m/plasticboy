// Исправления для server.js - основные части
// Добавьте эти исправления в ваш существующий server.js

// Улучшенная обработка CORS и заголовков
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Password', 'Accept']
}));

// Улучшенный middleware для заголовков
app.use((req, res, next) => {
  // Устанавливаем правильные заголовки для кириллицы
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  // Добавляем заголовки для отладки
  res.setHeader('X-Powered-By', 'PlasticBoy-v2.1.0');
  
  // Логируем все входящие запросы
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  
  next();
});

// Улучшенный endpoint для получения точек с детальным логированием
app.get('/api/points', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('📍 Запрос получения точек...');
    
    const now = new Date();
    const points = await ModelPoint.find({
      scheduledTime: { $lte: now }
    })
    .select('-qrSecret -collectorInfo.telegramData.hash -collectorInfo.ipAddress -collectorInfo.userAgent')
    .lean()
    .exec();
    
    const duration = Date.now() - startTime;
    
    console.log(`✅ Загружено ${points.length} публичных точек за ${duration}ms`);
    
    // Добавляем заголовки для отладки
    res.setHeader('X-Points-Count', points.length);
    res.setHeader('X-Response-Time', duration + 'ms');
    res.setHeader('X-Cache', 'MISS'); // Указываем что данные свежие
    
    res.json(points);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Ошибка получения точек за ${duration}ms:`, error);
    
    res.status(500).json({ 
      error: 'Ошибка получения точек',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
});

// Улучшенный health check с детальной диагностикой
app.get('/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Проверяем соединение с MongoDB
    const mongoStatus = mongoose.connection.readyState;
    const mongoStatusText = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    }[mongoStatus] || 'unknown';
    
    // Тестируем запрос к базе данных
    let dbTestResult = null;
    let dbTestError = null;
    
    try {
      const testStart = Date.now();
      const pointsCount = await ModelPoint.countDocuments();
      const dbTestDuration = Date.now() - testStart;
      
      dbTestResult = {
        success: true,
        pointsCount,
        responseTime: dbTestDuration + 'ms'
      };
    } catch (error) {
      dbTestError = {
        success: false,
        error: error.message,
        responseTime: (Date.now() - startTime) + 'ms'
      };
    }
    
    const totalDuration = Date.now() - startTime;
    
    const healthData = { 
      status: mongoStatus === 1 && !dbTestError ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      environment: process.env.NODE_ENV || 'development',
      responseTime: totalDuration + 'ms',
      features: {
        telegramAuth: {
          enabled: !!process.env.TELEGRAM_BOT_TOKEN,
          botUsername: process.env.TELEGRAM_BOT_USERNAME || 'not configured',
          configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
        },
        mongodb: {
          connected: mongoStatus === 1,
          status: mongoStatusText,
          host: mongoose.connection.host,
          name: mongoose.connection.name,
          test: dbTestResult || dbTestError
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
    };
    
    console.log(`💓 Health check завершен за ${totalDuration}ms - статус: ${healthData.status}`);
    
    // Устанавливаем соответствующий HTTP статус
    res.status(healthData.status === 'OK' ? 200 : 503);
    res.json(healthData);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Ошибка health check за ${duration}ms:`, error);
    
    res.status(503).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: duration + 'ms'
    });
  }
});

// Улучшенная обработка статических файлов с логированием
app.use(express.static('public', {
  setHeaders: (res, path, stat) => {
    console.log(`📂 Статический файл: ${path}`);
    
    // Устанавливаем правильные заголовки кэширования
    if (path.endsWith('.css') || path.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 час для CSS/JS
    } else if (path.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache'); // Не кэшируем HTML
    }
    
    // Устанавливаем правильный charset для HTML
    if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
  }
}));

// Улучшенная обработка ошибок подключения к MongoDB
const connectDB = async () => {
  try {
    console.log('🔌 Подключение к MongoDB...');
    console.log(`📡 URI: ${process.env.MONGODB_URI ? process.env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@') : 'mongodb://localhost:27017/plasticboy'}`);
    
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/plasticboy', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 секунд таймаут
      socketTimeoutMS: 45000, // 45 секунд для операций
    });
    
    console.log(`✅ MongoDB подключена успешно: ${conn.connection.host}`);
    console.log(`📊 База данных: ${conn.connection.name}`);
    
    // Проверяем количество точек в базе
    try {
      const pointsCount = await ModelPoint.countDocuments();
      console.log(`📍 Точек в базе данных: ${pointsCount}`);
    } catch (error) {
      console.warn('⚠️ Не удалось подсчитать точки:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка подключения к MongoDB:', error.message);
    console.error('🔧 Проверьте:');
    console.error('   1. Правильность MONGODB_URI в .env файле');
    console.error('   2. Доступность MongoDB сервера');
    console.error('   3. Сетевые настройки и firewall');
    console.error('   4. Права доступа к базе данных');
    
    // В development режиме выводим полную ошибку
    if (process.env.NODE_ENV === 'development') {
      console.error('📝 Полная ошибка:', error);
    }
    
    // Выходим с кодом ошибки
    process.exit(1);
  }
};

// Улучшенный middleware для логирования запросов
app.use((req, res, next) => {
  const start = Date.now();
  
  // Сохраняем оригинальные методы для перехвата
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    const duration = Date.now() - start;
    const size = data ? Buffer.byteLength(data, 'utf8') : 0;
    logRequest(req, res, duration, size);
    return originalSend.call(this, data);
  };
  
  res.json = function(obj) {
    const duration = Date.now() - start;
    const data = JSON.stringify(obj);
    const size = Buffer.byteLength(data, 'utf8');
    logRequest(req, res, duration, size);
    return originalJson.call(this, obj);
  };
  
  next();
});

function logRequest(req, res, duration, size) {
  const logLevel = res.statusCode >= 400 ? '❌' : res.statusCode >= 300 ? '⚠️' : '✅';
  const sizeStr = size > 1024 ? `${Math.round(size / 1024)}KB` : `${size}B`;
  
  console.log(`${logLevel} ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms - ${sizeStr}`);
  
  // Логируем медленные запросы
  if (duration > 1000) {
    console.warn(`🐌 МЕДЛЕННЫЙ ЗАПРОС: ${req.method} ${req.path} занял ${duration}ms`);
  }
  
  // Логируем большие ответы
  if (size > 1024 * 1024) { // > 1MB
    console.warn(`📦 БОЛЬШОЙ ОТВЕТ: ${req.method} ${req.path} - ${sizeStr}`);
  }
}

// Добавьте перед запуском сервера проверку окружения
console.log('🔍 Проверка конфигурации...');
console.log(`📍 PORT: ${PORT}`);
console.log(`🗄️ MONGODB_URI: ${process.env.MONGODB_URI ? '✅ установлен' : '❌ не установлен'}`);
console.log(`🛡️ ADMIN_PASSWORD: ${process.env.ADMIN_PASSWORD ? '✅ установлен' : '❌ не установлен'}`);
console.log(`🤖 TELEGRAM_BOT_TOKEN: ${process.env.TELEGRAM_BOT_TOKEN ? '✅ установлен' : '❌ не установлен'}`);
console.log(`📱 TELEGRAM_BOT_USERNAME: ${process.env.TELEGRAM_BOT_USERNAME ? '✅ установлен' : '❌ не установлен'}`);
console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);

// Запуск подключения к БД
connectDB();
