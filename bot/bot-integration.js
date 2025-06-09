// bot-integration.js - Дополнительные функции для интеграции с основным приложением

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

class PlasticBoyBotIntegration {
    constructor(bot, webAppUrl) {
        this.bot = bot;
        this.webAppUrl = webAppUrl;
        this.subscribers = new Set(); // Пользователи, подписанные на уведомления
        this.lastStatsCheck = new Date();
        
        // Запускаем периодические проверки
        this.startPeriodicChecks();
    }

    // === ПОДПИСКИ НА УВЕДОМЛЕНИЯ ===

    // Подписка пользователя на уведомления
    subscribeUser(chatId) {
        this.subscribers.add(chatId);
        console.log(`🔔 Пользователь ${chatId} подписался на уведомления`);
        
        this.bot.sendMessage(chatId, 
            '🔔 *Уведомления включены!*\n\n' +
            'Вы будете получать сообщения о:\n' +
            '• Новых моделях на карте\n' +
            '• Обновлениях рейтинга\n' +
            '• Особых событиях игры\n\n' +
            'Отключить: /notifications_off',
            { parse_mode: 'Markdown' }
        );
    }

    // Отписка от уведомлений
    unsubscribeUser(chatId) {
        this.subscribers.delete(chatId);
        console.log(`🔕 Пользователь ${chatId} отписался от уведомлений`);
        
        this.bot.sendMessage(chatId,
            '🔕 Уведомления отключены.\n\nВключить обратно: /notifications_on'
        );
    }

    // === УВЕДОМЛЕНИЯ О НОВЫХ МОДЕЛЯХ ===

    async checkForNewModels() {
        try {
            const response = await axios.get(`${this.webAppUrl}/api/points`);
            const points = response.data;
            
            // Фильтруем новые точки (добавленные за последний час)
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const newPoints = points.filter(point => 
                new Date(point.createdAt) > oneHourAgo && 
                point.status === 'available'
            );

            if (newPoints.length > 0) {
                await this.notifyAboutNewModels(newPoints);
            }

        } catch (error) {
            console.error('❌ Ошибка проверки новых моделей:', error);
        }
    }

    async notifyAboutNewModels(newPoints) {
        const message = `
🆕 *Новые модели добавлены!*

🎯 Найдено: *${newPoints.length}* ${newPoints.length === 1 ? 'модель' : 'моделей'}

${newPoints.slice(0, 3).map(point => `📦 ${point.name}`).join('\n')}
${newPoints.length > 3 ? `\n... и еще ${newPoints.length - 3}` : ''}

🏃‍♂️ Спешите собрать их первыми!
        `;

        const options = {
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🗺️ Открыть карту', web_app: { url: this.webAppUrl } }],
                    [{ text: '🔕 Отключить уведомления', callback_data: 'unsubscribe_notifications' }]
                ]
            }
        };

        // Отправляем всем подписчикам
        for (const chatId of this.subscribers) {
            try {
                await this.bot.sendMessage(chatId, message, options);
                console.log(`📢 Уведомление о новых моделях отправлено ${chatId}`);
            } catch (error) {
                console.error(`❌ Ошибка отправки уведомления ${chatId}:`, error);
                
                // Если пользователь заблокировал бота, удаляем его из подписчиков
                if (error.response && error.response.statusCode === 403) {
                    this.subscribers.delete(chatId);
                }
            }
        }
    }

    // === ЕЖЕНЕДЕЛЬНЫЕ ОТЧЕТЫ ===

    async sendWeeklyReport() {
        try {
            const response = await axios.get(`${this.webAppUrl}/api/telegram/leaderboard`);
            const { stats } = response.data;

            const message = `
📊 *Еженедельный отчет PlasticBoy*

🏆 *Достижения недели:*
• Активных игроков: *${stats.totalUsers}*
• Собрано моделей: *${stats.totalCollections}*
• Новых участников: *5* (+25%)

🔥 *Лидеры недели:*
Самые активные коллекторы получают особые призы!

💪 Продолжай собирать модели и поднимайся в рейтинге!
            `;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏆 Посмотреть рейтинг', callback_data: 'leaderboard' }],
                        [{ text: '🗺️ К карте', web_app: { url: this.webAppUrl } }]
                    ]
                }
            };

            // Отправляем всем подписчикам
            for (const chatId of this.subscribers) {
                try {
                    await this.bot.sendMessage(chatId, message, options);
                } catch (error) {
                    console.error(`❌ Ошибка отправки отчета ${chatId}:`, error);
                }
            }

            console.log(`📊 Еженедельный отчет отправлен ${this.subscribers.size} пользователям`);

        } catch (error) {
            console.error('❌ Ошибка отправки еженедельного отчета:', error);
        }
    }

    // === ГЕЙМИФИКАЦИЯ ===

    async checkForAchievements(userId, userName) {
        try {
            // Получаем статистику пользователя
            const response = await axios.get(`${this.webAppUrl}/api/telegram/leaderboard`);
            const { leaderboard } = response.data;
            
            const user = leaderboard.find(u => u.telegramId === userId);
            if (!user) return;

            const achievements = this.getAchievements(user.totalCollections);
            
            if (achievements.length > 0) {
                await this.sendAchievementNotification(userId, userName, achievements);
            }

        } catch (error) {
            console.error('❌ Ошибка проверки достижений:', error);
        }
    }

    getAchievements(totalCollections) {
        const achievements = [];
        
        const milestones = [
            { count: 1, title: '🥉 Первая модель', description: 'Собрал первую модель!' },
            { count: 5, title: '🥈 Коллекционер', description: 'Собрал 5 моделей!' },
            { count: 10, title: '🥇 Мастер-коллекционер', description: 'Собрал 10 моделей!' },
            { count: 25, title: '💎 Легенда', description: 'Собрал 25 моделей!' },
            { count: 50, title: '👑 Чемпион', description: 'Собрал 50 моделей!' }
        ];

        return milestones.filter(milestone => milestone.count === totalCollections);
    }

    async sendAchievementNotification(chatId, userName, achievements) {
        for (const achievement of achievements) {
            const message = `
🎉 *Поздравляем, ${userName}!*

Вы получили достижение:
${achievement.title}

${achievement.description}

Продолжайте в том же духе! 🚀
            `;

            const options = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🏆 Мой рейтинг', callback_data: 'leaderboard' }],
                        [{ text: '🗺️ Найти еще модели', web_app: { url: this.webAppUrl } }]
                    ]
                }
            };

            try {
                await this.bot.sendMessage(chatId, message, options);
                console.log(`🏆 Достижение отправлено ${userName}: ${achievement.title}`);
            } catch (error) {
                console.error(`❌ Ошибка отправки достижения:`, error);
            }
        }
    }

    // === ПЕРИОДИЧЕСКИЕ ПРОВЕРКИ ===

    startPeriodicChecks() {
        // Проверка новых моделей каждые 30 минут
        setInterval(() => {
            this.checkForNewModels();
        }, 30 * 60 * 1000);

        // Еженедельный отчет (каждое воскресенье в 10:00)
        setInterval(() => {
            const now = new Date();
            if (now.getDay() === 0 && now.getHours() === 10 && now.getMinutes() < 5) {
                this.sendWeeklyReport();
            }
        }, 5 * 60 * 1000);

        console.log('⏰ Периодические проверки запущены');
    }

    // === СТАТИСТИКА ИСПОЛЬЗОВАНИЯ БОТА ===

    async getBotUsageStats() {
        return {
            totalSubscribers: this.subscribers.size,
            lastStatsCheck: this.lastStatsCheck,
            botUptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        };
    }

    // === РАССЫЛКА АДМИНАМ ===

    async sendAdminNotification(message) {
        const adminChatIds = []; // Добавьте Telegram ID администраторов
        
        for (const chatId of adminChatIds) {
            try {
                await this.bot.sendMessage(chatId, `🛡️ *Админ уведомление*\n\n${message}`, {
                    parse_mode: 'Markdown'
                });
            } catch (error) {
                console.error(`❌ Ошибка отправки админ уведомления:`, error);
            }
        }
    }

    // === ЭКСПОРТ ПОДПИСЧИКОВ ===

    exportSubscribers() {
        return {
            subscribers: Array.from(this.subscribers),
            count: this.subscribers.size,
            exportDate: new Date().toISOString()
        };
    }
}

module.exports = PlasticBoyBotIntegration;

// === ПРИМЕР ИСПОЛЬЗОВАНИЯ ===

/*
const TelegramBot = require('node-telegram-bot-api');
const PlasticBoyBotIntegration = require('./bot-integration');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const integration = new PlasticBoyBotIntegration(bot, process.env.WEB_APP_URL);

// Обработка команд подписки
bot.onText(/\/notifications_on/, (msg) => {
    integration.subscribeUser(msg.chat.id);
});

bot.onText(/\/notifications_off/, (msg) => {
    integration.unsubscribeUser(msg.chat.id);
});

// Обработка callback'ов
bot.on('callback_query', (callbackQuery) => {
    if (callbackQuery.data === 'unsubscribe_notifications') {
        integration.unsubscribeUser(callbackQuery.message.chat.id);
    }
});

// При сборе модели (webhook от основного приложения)
bot.on('web_app_data', (msg) => {
    const data = JSON.parse(msg.web_app.data);
    if (data.action === 'model_collected') {
        integration.checkForAchievements(msg.from.id, msg.from.first_name);
    }
});
*/