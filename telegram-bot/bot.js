const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Токен бота из .env файла
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле!');
    process.exit(1);
}

// Создаем бота
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 PlasticBoy Telegram Bot запущен!');
console.log(`📱 Bot Username: @${BOT_USERNAME}`);

// === КОМАНДЫ БОТА ===

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name;
    
    console.log(`👋 Новый пользователь: ${firstName} (ID: ${msg.from.id})`);
    
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
    
    bot.sendMessage(chatId, welcomeMessage, options);
});

// Команда /map
bot.onText(/\/map/, (msg) => {
    const chatId = msg.chat.id;
    
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
    
    bot.sendMessage(chatId, mapMessage, options);
});

// Команда /leaderboard
bot.onText(/\/leaderboard/, async (msg) => {
    const chatId = msg.chat.id;
    await sendLeaderboard(chatId);
});

// Команда /stats
bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    await sendStats(chatId);
});

// Команда /help
bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
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
                [{ text: '🗺️ Начать игру', web_app: { url: WEB_APP_URL } }],
                [{ text: '📞 Связаться', url: 'https://t.me/your_support_bot' }]
            ]
        }
    };
    
    bot.sendMessage(chatId, helpMessage, options);
});

// === CALLBACK HANDLERS ===

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const data = callbackQuery.data;
    const messageId = callbackQuery.message.message_id;
    
    console.log(`🔘 Callback: ${data} от ${callbackQuery.from.first_name}`);
    
    // Подтверждаем callback
    bot.answerCallbackQuery(callbackQuery.id);
    
    switch (data) {
        case 'leaderboard':
            await sendLeaderboard(chatId, messageId);
            break;
            
        case 'stats':
            await sendStats(chatId, messageId);
            break;
            
        case 'help':
            bot.editMessageText(
                `❓ *Помощь*\n\nИспользуй /help для подробной информации.`,
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
            bot.editMessageText(
                `🔄 *Карта обновлена!*\n\nНажми кнопку ниже для просмотра актуальной карты:`,
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

Главное меню бота. Выбери действие:
            `;
            
            bot.editMessageText(welcomeMessage, {
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
});

// === ФУНКЦИИ ОТПРАВКИ ДАННЫХ ===

async function sendLeaderboard(chatId, messageId = null) {
    try {
        console.log('🏆 Загружаем рейтинг...');
        
        // Показываем индикатор загрузки
        if (messageId) {
            bot.editMessageText('🏆 Загружаем рейтинг...', {
                chat_id: chatId,
                message_id: messageId
            });
        } else {
            const loadingMsg = await bot.sendMessage(chatId, '🏆 Загружаем рейтинг...');
            messageId = loadingMsg.message_id;
        }
        
        const response = await axios.get(`${WEB_APP_URL}/api/telegram/leaderboard`, {
            timeout: 10000
        });
        
        const { leaderboard, stats } = response.data;
        
        let message = `🏆 *Рейтинг коллекторов*\n\n`;
        message += `👥 Всего игроков: *${stats.totalUsers}*\n`;
        message += `📦 Собрано моделей: *${stats.totalCollections}*\n\n`;
        
        if (leaderboard && leaderboard.length > 0) {
            message += `🥇 *Топ-10 игроков:*\n\n`;
            
            leaderboard.slice(0, 10).forEach((user, index) => {
                const position = index + 1;
                let emoji = '';
                
                if (position === 1) emoji = '🥇';
                else if (position === 2) emoji = '🥈';  
                else if (position === 3) emoji = '🥉';
                else emoji = `${position}.`;
                
                const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
                const username = user.username ? ` (@${user.username})` : '';
                
                message += `${emoji} *${name}*${username}\n`;
                message += `   📦 ${user.totalCollections} моделей\n\n`;
            });
        } else {
            message += `🤷‍♂️ Пока никто не играл через Telegram!\n\n`;
            message += `Стань первым - авторизуйся через Telegram при сборе модели! 🚀`;
        }
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ К карте', web_app: { url: WEB_APP_URL + '/leaderboard.html' } }],
                    [
                        { text: '🔄 Обновить', callback_data: 'leaderboard' },
                        { text: '🔙 Меню', callback_data: 'back_to_menu' }
                    ]
                ]
            }
        };
        
        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки рейтинга:', error);
        
        const errorMessage = `❌ *Ошибка загрузки рейтинга*\n\nПопробуйте позже или откройте веб-версию.`;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌐 Открыть веб-версию', url: WEB_APP_URL + '/leaderboard.html' }],
                    [{ text: '🔄 Попробовать снова', callback_data: 'leaderboard' }]
                ]
            }
        };
        
        if (messageId) {
            bot.editMessageText(errorMessage, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } else {
            bot.sendMessage(chatId, errorMessage, options);
        }
    }
}

async function sendStats(chatId, messageId = null) {
    try {
        console.log('📊 Загружаем статистику...');
        
        // Показываем индикатор загрузки
        if (messageId) {
            bot.editMessageText('📊 Загружаем статистику...', {
                chat_id: chatId,
                message_id: messageId
            });
        } else {
            const loadingMsg = await bot.sendMessage(chatId, '📊 Загружаем статистику...');
            messageId = loadingMsg.message_id;
        }
        
        // Загружаем общую статистику точек
        const pointsResponse = await axios.get(`${WEB_APP_URL}/api/points`, {
            timeout: 10000
        });
        
        // Загружаем Telegram статистику
        const telegramResponse = await axios.get(`${WEB_APP_URL}/api/telegram/leaderboard`, {
            timeout: 10000
        });
        
        const points = pointsResponse.data;
        const telegramStats = telegramResponse.data.stats;
        
        const availablePoints = points.filter(p => p.status === 'available').length;
        const collectedPoints = points.filter(p => p.status === 'collected').length;
        const totalPoints = points.length;
        
        // Подсчитываем статистику по методам авторизации
        const manualCollections = points.filter(p => 
            p.status === 'collected' && 
            (!p.collectorInfo?.authMethod || p.collectorInfo.authMethod === 'manual')
        ).length;
        
        const percentage = totalPoints > 0 ? Math.round((collectedPoints / totalPoints) * 100) : 0;
        
        let message = `📊 *Статистика PlasticBoy*\n\n`;
        
        message += `🎯 *Общая статистика:*\n`;
        message += `• Всего моделей: *${totalPoints}*\n`;
        message += `• Доступно для сбора: *${availablePoints}* 🟢\n`;
        message += `• Уже собрано: *${collectedPoints}* 🔴\n`;
        message += `• Прогресс: *${percentage}%*\n\n`;
        
        message += `🤖 *Telegram игроки:*\n`;
        message += `• Авторизованных: *${telegramStats.totalUsers}*\n`;
        message += `• Их сборов: *${telegramStats.totalCollections}*\n`;
        message += `• Ручных сборов: *${manualCollections}*\n\n`;
        
        if (availablePoints > 0) {
            message += `🎮 *Активность сегодня:*\n`;
            message += `Найди ${availablePoints > 5 ? '5+' : availablePoints} доступных моделей!\n\n`;
        }
        
        message += `🔥 Присоединяйся к игре и собирай модели!`;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ К карте', web_app: { url: WEB_APP_URL } }],
                    [
                        { text: '🏆 Рейтинг', callback_data: 'leaderboard' },
                        { text: '🔄 Обновить', callback_data: 'stats' }
                    ],
                    [{ text: '🔙 Меню', callback_data: 'back_to_menu' }]
                ]
            }
        };
        
        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
        
        const errorMessage = `❌ *Ошибка загрузки статистики*\n\nПопробуйте позже или откройте веб-версию.`;
        
        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌐 Открыть веб-версию', url: WEB_APP_URL }],
                    [{ text: '🔄 Попробовать снова', callback_data: 'stats' }]
                ]
            }
        };
        
        if (messageId) {
            bot.editMessageText(errorMessage, {
                chat_id: chatId,
                message_id: messageId,
                ...options
            });
        } else {
            bot.sendMessage(chatId, errorMessage, options);
        }
    }
}

// === ОБРАБОТКА WEB APP ДАННЫХ ===

bot.on('web_app_data', (msg) => {
    const chatId = msg.chat.id;
    const webAppData = JSON.parse(msg.web_app.data);
    
    console.log('📱 Web App Data получена:', webAppData);
    
    // Можно обработать данные из веб-приложения
    bot.sendMessage(chatId, `✅ Данные получены: ${JSON.stringify(webAppData)}`);
});

// === ОБРАБОТКА ОШИБОК ===

bot.on('error', (error) => {
    console.error('❌ Ошибка бота:', error);
});

bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling:', error);
});

// === GRACEFUL SHUTDOWN ===

process.on('SIGINT', () => {
    console.log('📛 Получен SIGINT, завершаем бота...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('📛 Получен SIGTERM, завершаем бота...');
    bot.stopPolling();
    process.exit(0);
});

console.log('🤖 Бот готов к работе! Отправьте /start для начала.');
