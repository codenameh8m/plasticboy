// bot.js - Telegram бот для PlasticBoy с улучшенной диагностикой
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
require('dotenv').config();

console.log('🤖 Запуск PlasticBoy Telegram бота...');

// Проверяем наличие токена
if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле');
    console.log('💡 Инструкция:');
    console.log('1. Найдите @BotFather в Telegram');
    console.log('2. Создайте нового бота командой /newbot');
    console.log('3. Скопируйте токен в .env файл');
    console.log('4. Перезапустите бота');
    process.exit(1);
}

console.log('✅ Токен найден:', process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...');

// Создаем бота с дополнительными настройками для диагностики
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            timeout: 10
        }
    },
    request: {
        agentOptions: {
            keepAlive: true,
            family: 4
        }
    }
});

console.log('✅ Telegram бот инициализирован');

// Тестируем соединение с Telegram API
bot.getMe().then((botInfo) => {
    console.log('✅ Успешное подключение к Telegram API');
    console.log('🤖 Информация о боте:', {
        id: botInfo.id,
        username: botInfo.username,
        first_name: botInfo.first_name,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages,
        supports_inline_queries: botInfo.supports_inline_queries
    });
}).catch((error) => {
    console.error('❌ Ошибка подключения к Telegram API:', error);
    console.log('💡 Проверьте:');
    console.log('1. Правильность токена');
    console.log('2. Подключение к интернету');
    console.log('3. Не заблокирован ли Telegram API');
    process.exit(1);
});

// Подключение к MongoDB (используем ту же базу что и основное приложение)
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('✅ Бот подключен к MongoDB');
}).catch(error => {
    console.error('❌ Ошибка подключения бота к MongoDB:', error);
    console.log('💡 Проверьте MONGODB_URI в .env файле');
    process.exit(1);
});

// Используем ту же схему модели что и в server.js
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

const ModelPoint = mongoose.model('ModelPoint', modelPointSchema);

// URL веб-приложения
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-domain.com';

// Логирование действий пользователей
function logBotAction(action, userId, username, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`🤖 [${timestamp}] ${action} - User: ${userId} (@${username}) - Data:`, JSON.stringify(data));
}

// Создание главной клавиатуры
function getMainKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                [
                    { 
                        text: '🎯 Открыть PlasticBoy', 
                        web_app: { url: WEB_APP_URL } 
                    }
                ],
                [
                    { text: '📦 Доступные модели' },
                    { text: '🏆 Топ игроков' }
                ]
            ],
            resize_keyboard: true,
            persistent: true
        }
    };
}

// ========== ОБРАБОТЧИКИ СОБЫТИЙ БОТА ==========

// Обработка всех входящих сообщений для диагностики
bot.on('message', (msg) => {
    console.log('📨 Получено сообщение:', {
        messageId: msg.message_id,
        chatId: msg.chat.id,
        userId: msg.from.id,
        username: msg.from.username,
        firstName: msg.from.first_name,
        text: msg.text,
        date: new Date(msg.date * 1000).toISOString()
    });
});

// Команда /start
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('🚀 Команда /start получена от:', {
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        chatId: chatId
    });
    
    logBotAction('START_COMMAND', user.id, user.username, { chatId });
    
    const welcomeMessage = `
🎯 *Добро пожаловать в PlasticBoy!*

Привет, ${user.first_name}! 👋

*PlasticBoy* — это игра по сбору 3D моделей в Алматы! 

🎮 *Как играть:*
• Найдите QR-коды в городе
• Отсканируйте их через веб-приложение
• Соберите все модели и станьте лидером!

🔥 *Доступные функции:*
🎯 *Открыть PlasticBoy* — запустить веб-приложение
📦 *Доступные модели* — список активных точек
🏆 *Топ игроков* — рейтинг лучших коллекторов

Используйте кнопки ниже для навигации! ⬇️
    `;
    
    try {
        const result = await bot.sendMessage(chatId, welcomeMessage, {
            parse_mode: 'Markdown',
            ...getMainKeyboard()
        });
        
        console.log('✅ Сообщение /start успешно отправлено:', {
            messageId: result.message_id,
            chatId: result.chat.id
        });
        
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения /start:', error);
        
        // Пробуем отправить простое сообщение без форматирования
        try {
            await bot.sendMessage(chatId, 'Добро пожаловать в PlasticBoy! Бот работает.');
            console.log('✅ Простое сообщение отправлено успешно');
        } catch (simpleError) {
            console.error('❌ Ошибка отправки простого сообщения:', simpleError);
        }
    }
});

// Команда /help
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('❓ Команда /help получена от:', user.username || user.first_name);
    logBotAction('HELP_COMMAND', user.id, user.username);
    
    const helpMessage = `
🤖 *Помощь по PlasticBoy Bot*

*Основные команды:*
/start — Начать работу с ботом
/help — Показать эту справку
/test — Проверить работу бота

*Кнопки меню:*
🎯 *Открыть PlasticBoy* — Запуск веб-приложения
📦 *Доступные модели* — Список точек для сбора
🏆 *Топ игроков* — Рейтинг лучших коллекторов

*Как играть:*
1. Нажмите "Открыть PlasticBoy" 
2. Найдите QR-код в городе
3. Отсканируйте его в приложении
4. Авторизуйтесь через Telegram
5. Заполните информацию о находке
6. Следите за рейтингом!

*Сайт:* ${WEB_APP_URL}
    `;
    
    try {
        await bot.sendMessage(chatId, helpMessage, {
            parse_mode: 'Markdown',
            ...getMainKeyboard()
        });
        console.log('✅ Сообщение /help отправлено');
    } catch (error) {
        console.error('❌ Ошибка отправки /help:', error);
    }
});

// Добавляем команду /test для диагностики
bot.onText(/\/test/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('🧪 Команда /test получена от:', user.username || user.first_name);
    
    const testMessage = `
🧪 *Тест PlasticBoy Bot*

✅ Бот работает!
📅 Время: ${new Date().toLocaleString('ru-RU')}
🆔 Ваш ID: ${user.id}
👤 Имя: ${user.first_name}
🔗 Username: ${user.username || 'не установлен'}
💬 Chat ID: ${chatId}

*Настройки:*
🌐 URL: ${WEB_APP_URL}
🤖 Bot Username: @${process.env.TELEGRAM_BOT_USERNAME || 'не настроен'}
    `;
    
    try {
        await bot.sendMessage(chatId, testMessage, {
            parse_mode: 'Markdown'
        });
        console.log('✅ Тест сообщение отправлено');
    } catch (error) {
        console.error('❌ Ошибка отправки тест сообщения:', error);
    }
});

// 1️⃣ ОБРАБОТКА КНОПКИ "ДОСТУПНЫЕ МОДЕЛИ"
bot.onText(/^📦 Доступные модели$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('📦 Запрос доступных моделей от:', user.username || user.first_name);
    logBotAction('AVAILABLE_MODELS_REQUEST', user.id, user.username);
    
    try {
        // Отправляем сообщение о загрузке
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Загружаю информацию о доступных моделях...', {
            ...getMainKeyboard()
        });
        
        const now = new Date();
        
        // Получаем доступные точки (время пришло и еще не собраны)
        const availablePoints = await ModelPoint.find({
            status: 'available',
            scheduledTime: { $lte: now }
        }).select('id name coordinates scheduledTime createdAt').lean().exec();
        
        // Получаем запланированные точки (время еще не пришло)
        const scheduledPoints = await ModelPoint.find({
            status: 'available',
            scheduledTime: { $gt: now }
        }).select('id name scheduledTime').lean().exec();
        
        // Удаляем сообщение загрузки
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        let responseMessage = '';
        
        if (availablePoints.length === 0 && scheduledPoints.length === 0) {
            responseMessage = `
📦 *Доступные модели*

😔 К сожалению, сейчас нет доступных моделей для сбора.

Попробуйте позже или обратитесь к администратору!
            `;
        } else {
            responseMessage = `📦 *Доступные модели*\n\n`;
            
            if (availablePoints.length > 0) {
                responseMessage += `🟢 *Готовы к сбору (${availablePoints.length}):*\n`;
                
                availablePoints.slice(0, 10).forEach((point, index) => {
                    const coords = `${point.coordinates.lat.toFixed(4)}, ${point.coordinates.lng.toFixed(4)}`;
                    responseMessage += `${index + 1}. *${point.name}*\n`;
                    responseMessage += `   📍 ${coords}\n`;
                    responseMessage += `   🆔 \`${point.id}\`\n\n`;
                });
                
                if (availablePoints.length > 10) {
                    responseMessage += `... и еще ${availablePoints.length - 10} моделей\n\n`;
                }
            }
            
            if (scheduledPoints.length > 0) {
                responseMessage += `🟡 *Скоро появятся (${scheduledPoints.length}):*\n`;
                
                scheduledPoints.slice(0, 5).forEach((point, index) => {
                    const scheduledTime = new Date(point.scheduledTime).toLocaleString('ru-RU', {
                        timeZone: 'Asia/Almaty',
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    responseMessage += `${index + 1}. *${point.name}*\n`;
                    responseMessage += `   ⏰ ${scheduledTime}\n\n`;
                });
                
                if (scheduledPoints.length > 5) {
                    responseMessage += `... и еще ${scheduledPoints.length - 5} моделей\n\n`;
                }
            }
            
            responseMessage += `🎯 Чтобы собрать модель, нажмите "Открыть PlasticBoy" и найдите QR-код!`;
        }
        
        await bot.sendMessage(chatId, responseMessage, {
            parse_mode: 'Markdown',
            ...getMainKeyboard()
        });
        
        console.log('✅ Информация о доступных моделях отправлена');
        logBotAction('AVAILABLE_MODELS_SENT', user.id, user.username, {
            availableCount: availablePoints.length,
            scheduledCount: scheduledPoints.length
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения доступных моделей:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке моделей. Попробуйте позже.', {
            ...getMainKeyboard()
        });
    }
});

// 2️⃣ ОБРАБОТКА КНОПКИ "ТОП ИГРОКОВ"
bot.onText(/^🏆 Топ игроков$/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('🏆 Запрос топа игроков от:', user.username || user.first_name);
    logBotAction('LEADERBOARD_REQUEST', user.id, user.username);
    
    try {
        // Отправляем сообщение о загрузке
        const loadingMsg = await bot.sendMessage(chatId, '⏳ Загружаю рейтинг игроков...', {
            ...getMainKeyboard()
        });
        
        // Получаем топ-3 Telegram пользователей
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
                    first_name: '$userData.first_name',
                    last_name: '$userData.last_name',
                    username: '$userData.username'
                }
            },
            {
                $sort: { totalCollections: -1, firstCollection: 1 }
            },
            {
                $limit: 3
            }
        ]);
        
        // Получаем общую статистику
        const totalStats = await ModelPoint.aggregate([
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
            }
        ]);
        
        const stats = totalStats[0] || { totalCollections: 0, uniqueUsers: [] };
        
        // Удаляем сообщение загрузки
        await bot.deleteMessage(chatId, loadingMsg.message_id);
        
        let responseMessage = '';
        
        if (leaderboard.length === 0) {
            responseMessage = `
🏆 *Рейтинг игроков*

😔 Пока никто не собрал модели через Telegram авторизацию.

Станьте первым! Нажмите "Открыть PlasticBoy" и начните собирать модели! 🎯
            `;
        } else {
            responseMessage = `🏆 *Топ игроков PlasticBoy*\n\n`;
            
            const medals = ['🥇', '🥈', '🥉'];
            
            leaderboard.forEach((player, index) => {
                const fullName = [player.first_name, player.last_name].filter(Boolean).join(' ');
                const username = player.username ? `@${player.username}` : '';
                const lastCollection = new Date(player.lastCollection).toLocaleDateString('ru-RU');
                
                responseMessage += `${medals[index]} *${index + 1}. ${fullName}*\n`;
                if (username) {
                    responseMessage += `   ${username}\n`;
                }
                responseMessage += `   📦 Собрано: *${player.totalCollections}* модел${player.totalCollections === 1 ? 'ь' : player.totalCollections < 5 ? 'и' : 'ей'}\n`;
                responseMessage += `   📅 Последний сбор: ${lastCollection}\n\n`;
            });
            
            responseMessage += `📊 *Общая статистика:*\n`;
            responseMessage += `👥 Всего игроков: ${stats.uniqueUsers.length}\n`;
            responseMessage += `📦 Всего сборов: ${stats.totalCollections}\n\n`;
            responseMessage += `🎯 Хотите попасть в топ? Собирайте больше моделей!`;
        }
        
        // Добавляем кнопку для просмотра полного рейтинга
        const keyboard = {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: '📊 Полный рейтинг',
                            url: `${WEB_APP_URL}/leaderboard.html`
                        }
                    ]
                ]
            }
        };
        
        await bot.sendMessage(chatId, responseMessage, {
            parse_mode: 'Markdown',
            ...keyboard
        });
        
        // Отправляем основную клавиатуру отдельным сообщением
        await bot.sendMessage(chatId, 'Выберите действие:', getMainKeyboard());
        
        console.log('✅ Рейтинг игроков отправлен');
        logBotAction('LEADERBOARD_SENT', user.id, user.username, {
            topPlayersCount: leaderboard.length,
            totalPlayers: stats.uniqueUsers.length,
            totalCollections: stats.totalCollections
        });
        
    } catch (error) {
        console.error('❌ Ошибка получения рейтинга:', error);
        await bot.sendMessage(chatId, 'Произошла ошибка при загрузке рейтинга. Попробуйте позже.', {
            ...getMainKeyboard()
        });
    }
});

// Обработка любых других текстовых сообщений
bot.on('message', async (msg) => {
    // Игнорируем сообщения, которые уже обработаны
    if (msg.text && (
        msg.text.startsWith('/') ||
        msg.text === '📦 Доступные модели' ||
        msg.text === '🏆 Топ игроков'
    )) {
        return;
    }
    
    const chatId = msg.chat.id;
    const user = msg.from;
    
    console.log('💬 Неизвестное сообщение от:', user.username || user.first_name, '- текст:', msg.text);
    logBotAction('UNKNOWN_MESSAGE', user.id, user.username, { text: msg.text });
    
    // Если сообщение содержит текст, отвечаем подсказкой
    if (msg.text && !msg.web_app_data) {
        try {
            await bot.sendMessage(chatId, 
                'Используйте кнопки меню ниже для навигации! 👇\n\nИли напишите /help для получения справки.', 
                getMainKeyboard()
            );
            console.log('✅ Подсказка отправлена');
        } catch (error) {
            console.error('❌ Ошибка отправки подсказки:', error);
        }
    }
});

// ========== ОБРАБОТКА ОШИБОК ==========

// Обработка ошибок бота
bot.on('error', (error) => {
    console.error('❌ Ошибка Telegram бота:', error);
});

// Обработка ошибок polling
bot.on('polling_error', (error) => {
    console.error('❌ Ошибка polling Telegram бота:', error);
    console.log('💡 Возможные причины:');
    console.log('1. Проблемы с интернет соединением');
    console.log('2. Неверный токен бота');
    console.log('3. Бот заблокирован Telegram');
    console.log('4. Превышен лимит запросов API');
});

// Обработка неопознанных обновлений
bot.on('webhook_error', (error) => {
    console.error('❌ Webhook ошибка:', error);
});

// ========== GRACEFUL SHUTDOWN ==========

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('📛 SIGTERM получен, останавливаем бота...');
    bot.stopPolling();
    mongoose.connection.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('📛 SIGINT получен, останавливаем бота...');
    bot.stopPolling();
    mongoose.connection.close();
    process.exit(0);
});

// Обработка неперехваченных исключений
process.on('uncaughtException', (error) => {
    console.error('❌ Неперехваченное исключение:', error);
    // Не завершаем процесс, пытаемся продолжить работу
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Неперехваченное отклонение Promise:', reason);
    // Не завершаем процесс, пытаемся продолжить работу
});

console.log(`🤖 PlasticBoy Telegram Bot запущен!`);
console.log(`📱 Bot username: @${process.env.TELEGRAM_BOT_USERNAME || 'UNKNOWN'}`);
console.log(`🌐 Web App URL: ${WEB_APP_URL}`);
console.log(`💡 Найдите бота в Telegram и отправьте /start для проверки`);
console.log(`🔧 Для тестирования используйте команду /test`);
