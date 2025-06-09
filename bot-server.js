// bot-server.js - Отдельный сервер для Telegram бота на Render.com

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

// Проверка обязательных переменных
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения!');
    console.log('📝 Добавьте в Render Dashboard:');
    console.log('   TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather');
    console.log('   TELEGRAM_BOT_USERNAME=имя_бота_без_@');
    process.exit(1);
}

console.log('🤖 PlasticBoy Telegram Bot - Запуск на Render.com');
console.log(`📱 Bot Username: @${BOT_USERNAME}`);
console.log(`🌐 Web App URL: ${WEB_APP_URL}`);

// Создаем бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Подключаем основной функционал бота
require('./bot/bot.js')(bot, WEB_APP_URL);

// === ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ RENDER ===

// Health check для Render.com
const express = require('express');
const healthApp = express();
const HEALTH_PORT = process.env.PORT || 10000;

healthApp.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'PlasticBoy Telegram Bot',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        botStatus: 'running'
    });
});

healthApp.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_USERNAME,
        webApp: WEB_APP_URL,
        timestamp: new Date().toISOString()
    });
});

// Webhook endpoint для уведомлений от основного приложения
healthApp.use(express.json());
healthApp.post('/webhook/notification', (req, res) => {
    const { type, data } = req.body;
    
    console.log(`📬 Webhook получен: ${type}`, data);
    
    // Здесь можно добавить логику обработки уведомлений
    // Например, отправка сообщений пользователям о новых моделях
    
    res.json({ status: 'received', type, timestamp: new Date().toISOString() });
});

healthApp.listen(HEALTH_PORT, () => {
    console.log(`💚 Health server запущен на порту ${HEALTH_PORT}`);
});

// === ОБРАБОТКА ОШИБОК БОТА ===

bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
    
    // Уведомляем основное приложение об ошибке
    if (WEB_APP_URL) {
        axios.post(`${WEB_APP_URL}/api/bot/error`, {
            error: error.message,
            timestamp: new Date().toISOString()
        }).catch(err => {
            console.log('⚠️ Не удалось отправить ошибку в основное приложение');
        });
    }
});

bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
    
    // При критических ошибках пытаемся перезапустить polling
    if (error.code === 'ETELEGRAM' && error.response?.statusCode >= 500) {
        console.log('🔄 Пытаемся перезапустить polling через 30 секунд...');
        setTimeout(() => {
            bot.stopPolling().then(() => {
                bot.startPolling();
            });
        }, 30000);
    }
});

// === GRACEFUL SHUTDOWN ===

const gracefulShutdown = (signal) => {
    console.log(`📛 Получен сигнал ${signal}, завершаем бота...`);
    
    bot.stopPolling()
        .then(() => {
            console.log('✅ Polling остановлен');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Ошибка при остановке polling:', error);
            process.exit(1);
        });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// === МОНИТОРИНГ СОЕДИНЕНИЯ ===

// Проверяем соединение с Telegram каждые 5 минут
setInterval(async () => {
    try {
        await bot.getMe();
        console.log('💚 Соединение с Telegram OK');
    } catch (error) {
        console.error('❌ Проблема с соединением Telegram:', error.message);
    }
}, 5 * 60 * 1000);

// Проверяем доступность основного приложения каждые 10 минут
setInterval(async () => {
    try {
        const response = await axios.get(`${WEB_APP_URL}/health`, { timeout: 10000 });
        console.log('💚 Основное приложение доступно');
    } catch (error) {
        console.warn('⚠️ Основное приложение недоступно:', error.message);
    }
}, 10 * 60 * 1000);

// === СТАТИСТИКА ДЛЯ МОНИТОРИНГА ===

let botStats = {
    startTime: new Date(),
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    lastActivity: new Date()
};

// Отслеживаем активность
bot.on('message', () => {
    botStats.messagesReceived++;
    botStats.lastActivity = new Date();
});

// Endpoint для статистики (для мониторинга)
healthApp.get('/stats', (req, res) => {
    res.json({
        ...botStats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: {
            nodeVersion: process.version,
            platform: process.platform,
            renderService: process.env.RENDER_SERVICE_NAME || 'local'
        }
    });
});

console.log('🚀 PlasticBoy Telegram Bot запущен и готов к работе!');
console.log('📊 Мониторинг доступен на /stats');
console.log('💚 Health check на /health');

// Проверяем начальное соединение
bot.getMe()
    .then(botInfo => {
        console.log(`✅ Бот подключен: @${botInfo.username} (ID: ${botInfo.id})`);
        console.log(`📝 Имя: ${botInfo.first_name}`);
    })
    .catch(error => {
        console.error('❌ Ошибка подключения к Telegram:', error);
    });
