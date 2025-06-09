// bot-server.js - ИСПРАВЛЕННАЯ ВЕРСИЯ для Render.com

const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
require('dotenv').config();

console.log('🚀 =================================================');
console.log('🤖 PlasticBoy Telegram Bot - ИСПРАВЛЕННАЯ ВЕРСИЯ');
console.log('🚀 =================================================');

// ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const PORT = process.env.PORT || 10000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

console.log('🔍 Проверка конфигурации:');
console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅ есть' : '❌ НЕТ'}`);
console.log(`   TELEGRAM_BOT_USERNAME: ${BOT_USERNAME ? `✅ ${BOT_USERNAME}` : '❌ НЕТ'}`);
console.log(`   WEB_APP_URL: ${WEB_APP_URL}`);
console.log(`   PORT: ${PORT}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}`);
console.log(`   IS_PRODUCTION: ${IS_PRODUCTION}`);

// ПРОВЕРКА ОБЯЗАТЕЛЬНЫХ ПЕРЕМЕННЫХ
if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
    console.error('🔧 Добавьте переменную в Render Dashboard Environment Variables');
    process.exit(1);
}

if (!BOT_USERNAME) {
    console.error('❌ TELEGRAM_BOT_USERNAME не найден!');
    console.error('🔧 Добавьте переменную в Render Dashboard Environment Variables');
    process.exit(1);
}

// EXPRESS СЕРВЕР ДЛЯ WEBHOOK И HEALTH CHECK
const app = express();
app.use(express.json());

// HEALTH CHECK ENDPOINT
app.get('/', (req, res) => {
    res.json({
        status: 'OK',
        service: 'PlasticBoy Telegram Bot',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: Math.round(process.memoryUsage().rss / 1024 / 1024) + ' MB',
        bot: BOT_USERNAME,
        mode: IS_PRODUCTION ? 'webhook' : 'polling',
        webAppUrl: WEB_APP_URL
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        bot: BOT_USERNAME,
        timestamp: new Date().toISOString()
    });
});

// СОЗДАНИЕ БОТА И НАСТРОЙКА
let bot;

async function createBot() {
    try {
        console.log('🤖 Создаем бота...');
        
        // Сначала удаляем любые существующие webhook
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
            console.log('🗑️ Старые webhook удалены');
        } catch (error) {
            console.log('⚠️ Не удалось удалить старые webhook (возможно их не было)');
        }
        
        if (IS_PRODUCTION) {
            console.log('🌐 PRODUCTION MODE - Настраиваем webhook');
            
            // В продакшене используем webhook
            bot = new TelegramBot(BOT_TOKEN, { 
                polling: false,
                webHook: false
            });
            
            // Убираем двойной слеш в URL
            const webhookPath = `/${BOT_TOKEN}`;
            const baseUrl = WEB_APP_URL.endsWith('/') ? WEB_APP_URL.slice(0, -1) : WEB_APP_URL;
            const webhookUrl = `${baseUrl}${webhookPath}`;
            
            // Добавляем обработчик webhook
            app.post(webhookPath, (req, res) => {
                console.log('📥 Webhook получен:', JSON.stringify(req.body, null, 2));
                bot.processUpdate(req.body);
                res.sendStatus(200);
            });
            
            console.log(`🔗 Base URL: ${baseUrl}`);
            console.log(`🔗 Webhook path: ${webhookPath}`);
            console.log(`🔗 Final webhook URL: ${webhookUrl}`);
            
            // Устанавливаем webhook через API
            try {
                const webhookResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
                    url: webhookUrl,
                    allowed_updates: ['message', 'callback_query']
                });
                
                console.log('✅ Webhook установлен:', webhookResponse.data);
            } catch (error) {
                console.error('❌ Ошибка установки webhook:', error.response?.data || error.message);
            }
            
        } else {
            console.log('🏠 DEVELOPMENT MODE - Используем polling');
            
            // В разработке используем polling
            bot = new TelegramBot(BOT_TOKEN, { 
                polling: {
                    interval: 2000,
                    autoStart: true,
                    params: {
                        timeout: 10
                    }
                }
            });
        }
        
        // Получаем информацию о боте
        const botInfo = await bot.getMe();
        console.log('✅ УСПЕШНОЕ ПОДКЛЮЧЕНИЕ К TELEGRAM!');
        console.log(`📱 Bot Username: @${botInfo.username}`);
        console.log(`📝 Bot Name: ${botInfo.first_name}`);
        console.log(`🆔 Bot ID: ${botInfo.id}`);
        
        // Настраиваем обработчики команд
        setupBotHandlers();
        
        return botInfo;
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА создания бота:', error);
        throw error;
    }
}

// ОБРАБОТЧИКИ КОМАНД БОТА
function setupBotHandlers() {
    console.log('⚙️ Настраиваем обработчики команд...');
    
    // Команда /start
    bot.onText(/\/start/, async (msg) => {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name;
        const userId = msg.from.id;
        
        console.log(`👋 /start от ${firstName} (ID: ${userId}, Chat: ${chatId})`);
        
        const welcomeMessage = `
🎯 *PlasticBoy - Almaty Edition*

Привет, ${firstName}! 👋

Добро пожаловать в игру по сбору 3D моделей в Алматы!

🎮 *Как играть:*
• Найди QR-коды моделей по городу
• Отсканируй их и собери коллекцию
• Соревнуйся с другими игроками

🚀 *Доступные команды:*
/map - Открыть карту с моделями
/leaderboard - Рейтинг коллекторов
/stats - Статистика игры
/help - Помощь

Удачной охоты! 🎯
        `;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: '🗺️ Открыть карту', web_app: { url: WEB_APP_URL } }
                    ],
                    [
                        { text: '🏆 Рейтинг', callback_data: 'leaderboard' },
                        { text: '📊 Статистика', callback_data: 'stats' }
                    ],
                    [
                        { text: '❓ Помощь', callback_data: 'help' }
                    ]
                ]
            }
        };
        
        try {
            await bot.sendMessage(chatId, welcomeMessage, options);
            console.log(`✅ Приветствие отправлено ${firstName}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки приветствия:`, error);
        }
    });

    // Команда /help
    bot.onText(/\/help/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`❓ /help от ${msg.from.first_name}`);
        
        const helpMessage = `
❓ *Помощь PlasticBoy*

🎯 *Цель игры:*
Собери как можно больше 3D моделей, разбросанных по Алматы!

📱 *Как играть:*
1. Используй /map для просмотра карты
2. Найди QR-код модели в реальном мире
3. Отсканируй его или перейди по ссылке
4. Заполни информацию о себе
5. Сделай селфи с места находки
6. Получи очки и место в рейтинге!

🏆 *Авторизация через Telegram:*
• Быстрый вход без ввода данных
• Автоматическое заполнение профиля
• Участие в рейтинге игроков
• Сохранение твоих достижений

🗺️ *Команды бота:*
/start - Главное меню
/map - Карта с моделями
/leaderboard - Рейтинг игроков
/stats - Статистика игры
/help - Эта помощь

🎮 *Советы:*
• Чаще проверяй карту - появляются новые модели
• Авторизуйся через Telegram для участия в рейтинге
• Делись находками с друзьями!

Удачи в коллекционировании! 🚀
        `;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ Начать игру', web_app: { url: WEB_APP_URL } }]
                ]
            }
        };
        
        try {
            await bot.sendMessage(chatId, helpMessage, options);
            console.log(`✅ Помощь отправлена ${msg.from.first_name}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки помощи:`, error);
        }
    });

    // Команда /map
    bot.onText(/\/map/, async (msg) => {
        const chatId = msg.chat.id;
        console.log(`🗺️ /map от ${msg.from.first_name}`);
        
        const mapMessage = `
🗺️ *Карта PlasticBoy*

Здесь ты можешь увидеть все доступные модели в Алматы!

🟢 Зеленые точки - доступны для сбора
🔴 Красные точки - уже собраны

Нажми кнопку ниже, чтобы открыть интерактивную карту:
        `;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ Открыть карту', web_app: { url: WEB_APP_URL } }],
                    [{ text: '🔄 Обновить', callback_data: 'refresh_map' }]
                ]
            }
        };
        
        try {
            await bot.sendMessage(chatId, mapMessage, options);
            console.log(`✅ Карта отправлена ${msg.from.first_name}`);
        } catch (error) {
            console.error(`❌ Ошибка отправки карты:`, error);
        }
    });

    // Обработка callback кнопок
    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;
        
        console.log(`🔘 Callback: ${data} от ${callbackQuery.from.first_name}`);
        
        // Подтверждаем callback
        try {
            await bot.answerCallbackQuery(callbackQuery.id);
        } catch (error) {
            console.error('❌ Ошибка answerCallbackQuery:', error);
        }
        
        // Обрабатываем разные типы callback'ов
        try {
            switch (data) {
                case 'leaderboard':
                    await bot.editMessageText(
                        `🏆 *Рейтинг коллекторов*\n\nОткройте веб-версию для просмотра полного рейтинга.`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🏆 Открыть рейтинг', url: `${WEB_APP_URL}/leaderboard.html` }],
                                    [{ text: '🔙 Назад в меню', callback_data: 'back_to_menu' }]
                                ]
                            }
                        }
                    );
                    break;
                    
                case 'stats':
                    await bot.editMessageText(
                        `📊 *Статистика игры*\n\nОткройте веб-версию для просмотра подробной статистики.`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '📊 Открыть статистику', web_app: { url: WEB_APP_URL } }],
                                    [{ text: '🔙 Назад в меню', callback_data: 'back_to_menu' }]
                                ]
                            }
                        }
                    );
                    break;
                    
                case 'help':
                    await bot.editMessageText(
                        `❓ *Помощь*\n\nИспользуйте /help для подробной информации.`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🔙 Назад в меню', callback_data: 'back_to_menu' }]
                                ]
                            }
                        }
                    );
                    break;
                    
                case 'refresh_map':
                    await bot.editMessageText(
                        `🔄 *Карта обновлена!*\n\nНажмите кнопку ниже для просмотра актуальной карты:`,
                        {
                            chat_id: chatId,
                            message_id: messageId,
                            parse_mode: 'Markdown',
                            reply_markup: {
                                inline_keyboard: [
                                    [{ text: '🗺️ Открыть карту', web_app: { url: WEB_APP_URL } }]
                                ]
                            }
                        }
                    );
                    break;
                    
                case 'back_to_menu':
                    const welcomeMessage = `
🎯 *PlasticBoy - Almaty Edition*

Главное меню бота. Выберите действие:
                    `;
                    
                    await bot.editMessageText(welcomeMessage, {
                        chat_id: chatId,
                        message_id: messageId,
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🗺️ Открыть карту', web_app: { url: WEB_APP_URL } }],
                                [
                                    { text: '🏆 Рейтинг', callback_data: 'leaderboard' },
                                    { text: '📊 Статистика', callback_data: 'stats' }
                                ]
                            ]
                        }
                    });
                    break;
            }
        } catch (error) {
            console.error(`❌ Ошибка обработки callback ${data}:`, error);
        }
    });

    // Обработка всех сообщений для отладки
    bot.on('message', (msg) => {
        if (!msg.text || msg.text.startsWith('/')) return; // Пропускаем команды
        
        console.log(`📨 Сообщение от ${msg.from.first_name}: ${msg.text}`);
        
        // Простой ответ на сообщения
        bot.sendMessage(msg.chat.id, `Получил ваше сообщение: "${msg.text}"\n\nИспользуйте /help для списка команд.`);
    });

    // ОБРАБОТКА ОШИБОК
    bot.on('polling_error', (error) => {
        console.error('❌ POLLING ERROR:', error);
    });

    bot.on('webhook_error', (error) => {
        console.error('❌ WEBHOOK ERROR:', error);
    });

    bot.on('error', (error) => {
        console.error('❌ BOT ERROR:', error);
    });
    
    console.log('✅ Обработчики команд настроены');
}

// ТЕСТИРОВАНИЕ БОТА
async function testBot() {
    try {
        console.log('🧪 Тестируем бота...');
        
        // Проверяем, что бот отвечает
        const botInfo = await bot.getMe();
        console.log('✅ Бот отвечает:', botInfo.username);
        
        // Проверяем webhook (если production)
        if (IS_PRODUCTION) {
            try {
                const webhookInfo = await bot.getWebHookInfo();
                console.log('📋 Webhook info:', {
                    url: webhookInfo.url,
                    has_custom_certificate: webhookInfo.has_custom_certificate,
                    pending_update_count: webhookInfo.pending_update_count,
                    last_error_date: webhookInfo.last_error_date,
                    last_error_message: webhookInfo.last_error_message
                });
            } catch (error) {
                console.error('❌ Ошибка получения информации о webhook:', error);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка тестирования бота:', error);
    }
}

// ЗАПУСК СЕРВЕРА И БОТА
async function startBot() {
    try {
        // Сначала запускаем HTTP сервер
        const server = app.listen(PORT, () => {
            console.log(`🌐 HTTP сервер запущен на порту ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
        });
        
        // Создаем и настраиваем бота
        await createBot();
        
        // Небольшая задержка перед тестированием
        setTimeout(testBot, 2000);
        
        console.log('\n🎉 БОТ ГОТОВ К РАБОТЕ!');
        console.log(`💬 Отправьте /start боту @${BOT_USERNAME} для тестирования`);
        console.log(`🔗 Прямая ссылка: https://t.me/${BOT_USERNAME}`);
        
        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n📛 Получен сигнал ${signal}, завершаем...`);
            
            if (server) {
                server.close(() => {
                    console.log('✅ HTTP сервер остановлен');
                });
            }
            
            if (bot && !IS_PRODUCTION) {
                bot.stopPolling()
                    .then(() => {
                        console.log('✅ Polling остановлен');
                        process.exit(0);
                    })
                    .catch((error) => {
                        console.error('❌ Ошибка при остановке polling:', error);
                        process.exit(1);
                    });
            } else {
                process.exit(0);
            }
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА запуска бота:', error);
        process.exit(1);
    }
}

// ЗАПУСК
startBot();
