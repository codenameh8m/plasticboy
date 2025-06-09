// bot-server.js - Отладочная версия с улучшенным логированием

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

console.log('🚀 =================================================');
console.log('🤖 PlasticBoy Telegram Bot - ОТЛАДОЧНАЯ ВЕРСИЯ');
console.log('🚀 =================================================');

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

console.log('🔍 Проверка переменных окружения:');
console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅ установлен' : '❌ НЕ УСТАНОВЛЕН'}`);
console.log(`   TELEGRAM_BOT_USERNAME: ${BOT_USERNAME ? `✅ ${BOT_USERNAME}` : '❌ НЕ УСТАНОВЛЕН'}`);
console.log(`   WEB_APP_URL: ${WEB_APP_URL}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);
console.log(`   RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL || 'не установлен'}`);

// Проверка обязательных переменных
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения!');
    console.log('📝 Добавьте в Render Dashboard Environment Variables:');
    console.log('   TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather');
    console.log('   TELEGRAM_BOT_USERNAME=имя_бота_без_@');
    process.exit(1);
}

console.log('\n🤖 Создаем бота...');

// Создаем бота с отладкой
const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 1000,
        autoStart: true
    }
});

console.log('✅ Бот создан, запускаем polling...');

// === ПРОСТЫЕ ОБРАБОТЧИКИ ДЛЯ ОТЛАДКИ ===

bot.on('polling_error', (error) => {
    console.error('❌ ОШИБКА POLLING:', error.code, error.message);
    if (error.response) {
        console.error('   Response:', error.response.statusCode, error.response.body);
    }
});

bot.on('error', (error) => {
    console.error('❌ ОШИБКА БОТА:', error);
});

// Простая команда /start для отладки
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name;
    
    console.log(`👋 ПОЛУЧЕН /START от ${userName} (ID: ${msg.from.id}, Chat: ${chatId})`);
    
    const message = `🎯 Привет, ${userName}! 

Бот работает! 🚀

Это отладочная версия PlasticBoy бота.

🔍 Информация:
• Bot ID: @${BOT_USERNAME}
• Chat ID: ${chatId}
• Время: ${new Date().toLocaleString()}

🎮 Основные команды:
/help - помощь
/test - тест бота
/info - информация о боте`;

    bot.sendMessage(chatId, message)
        .then(() => {
            console.log(`✅ Сообщение отправлено пользователю ${userName}`);
        })
        .catch((error) => {
            console.error(`❌ Ошибка отправки сообщения:`, error);
        });
});

// Команда /test
bot.onText(/\/test/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`🧪 ТЕСТ команда от ${msg.from.first_name}`);
    
    bot.sendMessage(chatId, '✅ Тест успешен! Бот работает правильно.')
        .then(() => console.log('✅ Тест сообщение отправлено'))
        .catch(error => console.error('❌ Ошибка тест сообщения:', error));
});

// Команда /info
bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`ℹ️ INFO команда от ${msg.from.first_name}`);
    
    const info = `📊 Информация о боте:

🤖 Username: @${BOT_USERNAME}
🌐 Web App: ${WEB_APP_URL}
⏰ Uptime: ${Math.floor(process.uptime())} секунд
💾 Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)} MB
🖥️ Platform: ${process.platform}
📍 Environment: ${process.env.NODE_ENV || 'development'}`;

    bot.sendMessage(chatId, info)
        .then(() => console.log('✅ Info сообщение отправлено'))
        .catch(error => console.error('❌ Ошибка info сообщения:', error));
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    console.log(`❓ HELP команда от ${msg.from.first_name}`);
    
    const help = `❓ Помощь PlasticBoy Bot

🚀 Доступные команды:
/start - Запуск бота
/test - Проверка работы
/info - Информация о боте
/help - Эта помощь

🎯 Игра PlasticBoy - сбор 3D моделей в Алматы!
Найди QR-коды и собирай коллекцию.

🌐 Web версия: ${WEB_APP_URL}`;

    bot.sendMessage(chatId, help)
        .then(() => console.log('✅ Help сообщение отправлено'))
        .catch(error => console.error('❌ Ошибка help сообщения:', error));
});

// Обработка всех сообщений для отладки
bot.on('message', (msg) => {
    console.log(`📨 СООБЩЕНИЕ получено:`, {
        from: msg.from.first_name,
        user_id: msg.from.id,
        chat_id: msg.chat.id,
        text: msg.text || msg.caption || '[не текст]',
        type: msg.chat.type,
        date: new Date(msg.date * 1000).toLocaleString()
    });
});

// === HEALTH CHECK ДЛЯ RENDER ===

const express = require('express');
const healthApp = express();
const HEALTH_PORT = process.env.PORT || 10000;

healthApp.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'PlasticBoy Telegram Bot (DEBUG)',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        botStatus: 'running',
        config: {
            botUsername: BOT_USERNAME,
            webAppUrl: WEB_APP_URL,
            nodeEnv: process.env.NODE_ENV
        }
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

healthApp.listen(HEALTH_PORT, () => {
    console.log(`💚 Health server запущен на порту ${HEALTH_PORT}`);
    console.log(`📊 Health check: http://localhost:${HEALTH_PORT}/health`);
});

// === ПРОВЕРКА СОЕДИНЕНИЯ ===

console.log('\n📡 Проверяем соединение с Telegram...');

bot.getMe()
    .then(botInfo => {
        console.log('✅ УСПЕШНОЕ ПОДКЛЮЧЕНИЕ К TELEGRAM!');
        console.log(`📱 Bot Username: @${botInfo.username}`);
        console.log(`📝 Bot Name: ${botInfo.first_name}`);
        console.log(`🆔 Bot ID: ${botInfo.id}`);
        console.log(`🔧 Can Join Groups: ${botInfo.can_join_groups}`);
        console.log(`📢 Can Read Messages: ${botInfo.can_read_all_group_messages}`);
        console.log(`🔗 Supports Inline: ${botInfo.supports_inline_queries}`);
        
        console.log('\n🚀 БОТ ГОТОВ К РАБОТЕ!');
        console.log(`💬 Отправьте /start боту @${botInfo.username} для проверки`);
        console.log(`🔗 Прямая ссылка: https://t.me/${botInfo.username}`);
    })
    .catch(error => {
        console.error('❌ ОШИБКА ПОДКЛЮЧЕНИЯ К TELEGRAM:', error);
        console.error('   Code:', error.code);
        console.error('   Message:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.statusCode);
            console.error('   Body:', error.response.body);
        }
        
        console.log('\n🔧 ВОЗМОЖНЫЕ РЕШЕНИЯ:');
        console.log('1. Проверьте токен бота в переменных окружения');
        console.log('2. Убедитесь что бот не заблокирован');
        console.log('3. Проверьте подключение к интернету');
        
        process.exit(1);
    });

// === GRACEFUL SHUTDOWN ===

const gracefulShutdown = (signal) => {
    console.log(`\n📛 Получен сигнал ${signal}, завершаем бота...`);
    
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

console.log('\n⏰ Бот запущен, ожидаем сообщения...');
console.log('📝 Все действия будут логироваться в консоль');
