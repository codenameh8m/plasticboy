// bot-server.js - Упрощенная версия для Render.com Worker

const axios = require('axios');
require('dotenv').config();

console.log('🚀 =================================================');
console.log('🤖 PlasticBoy Telegram Bot Worker - ПРОСТАЯ ВЕРСИЯ');
console.log('🚀 =================================================');

// ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

console.log('🔍 Проверка конфигурации:');
console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅ есть' : '❌ НЕТ'}`);
console.log(`   TELEGRAM_BOT_USERNAME: ${BOT_USERNAME ? `✅ ${BOT_USERNAME}` : '❌ НЕТ'}`);
console.log(`   WEB_APP_URL: ${WEB_APP_URL}`);
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

// Основная функция настройки webhook
async function setupWebhook() {
    try {
        console.log('🔧 Настройка Telegram webhook...');
        
        // Получаем информацию о боте
        const botInfoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botInfo = botInfoResponse.data.result;
        
        console.log('✅ УСПЕШНОЕ ПОДКЛЮЧЕНИЕ К TELEGRAM!');
        console.log(`📱 Bot Username: @${botInfo.username}`);
        console.log(`📝 Bot Name: ${botInfo.first_name}`);
        console.log(`🆔 Bot ID: ${botInfo.id}`);
        
        // Удаляем старые webhook
        console.log('🗑️ Удаляем старые webhook...');
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
            console.log('✅ Старые webhook удалены');
        } catch (error) {
            console.log('⚠️ Не удалось удалить старые webhook (возможно их не было)');
        }

        if (IS_PRODUCTION) {
            // В production настраиваем webhook на основной веб-сервис
            console.log('🌐 PRODUCTION MODE - Настраиваем webhook на основной сервер');
            
            const baseUrl = WEB_APP_URL.endsWith('/') ? WEB_APP_URL.slice(0, -1) : WEB_APP_URL;
            const webhookPath = `/${BOT_TOKEN}`;
            const webhookUrl = `${baseUrl}${webhookPath}`;
            
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
                
                // Проверяем webhook
                const webhookInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
                console.log('📋 Webhook info:', {
                    url: webhookInfo.data.result.url,
                    has_custom_certificate: webhookInfo.data.result.has_custom_certificate,
                    pending_update_count: webhookInfo.data.result.pending_update_count,
                    last_error_date: webhookInfo.data.result.last_error_date,
                    last_error_message: webhookInfo.data.result.last_error_message
                });
                
            } catch (error) {
                console.error('❌ Ошибка установки webhook:', error.response?.data || error.message);
                throw error;
            }
            
        } else {
            console.log('🏠 DEVELOPMENT MODE - Webhook не настраиваем (используйте основной сервер)');
        }

        // Настраиваем команды бота
        console.log('⚙️ Настраиваем команды бота...');
        const commands = [
            {
                command: 'start',
                description: '🚀 Начать игру'
            },
            {
                command: 'map',
                description: '🗺️ Карта с моделями'
            },
            {
                command: 'leaderboard',
                description: '🏆 Рейтинг игроков'
            },
            {
                command: 'stats',
                description: '📊 Статистика игры'
            },
            {
                command: 'help',
                description: '❓ Помощь'
            }
        ];

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyCommands`, {
            commands: commands
        });
        console.log('✅ Команды бота настроены');

        // Настраиваем описание бота
        const description = `🎯 PlasticBoy - игра по сбору 3D моделей в Алматы!

🎮 Найди QR-коды моделей по городу, сканируй их и собирай коллекцию!
🏆 Соревнуйся с другими игроками в рейтинге
📱 Авторизуйся через Telegram для сохранения прогресса

Команды:
/start - Начать игру
/map - Карта с моделями  
/leaderboard - Рейтинг игроков
/stats - Статистика
/help - Помощь`;

        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyDescription`, {
            description: description
        });
        console.log('✅ Описание бота установлено');

        // Краткое описание
        const shortDescription = '🎯 Игра по сбору 3D моделей в Алматы. Найди QR-коды и собирай коллекцию!';
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
            short_description: shortDescription
        });
        console.log('✅ Краткое описание установлено');

        console.log('\n🎉 БОТ НАСТРОЕН УСПЕШНО!');
        console.log(`💬 Отправьте /start боту @${botInfo.username} для тестирования`);
        console.log(`🔗 Прямая ссылка: https://t.me/${botInfo.username}`);
        
        if (IS_PRODUCTION) {
            console.log('\n📋 ВАЖНО:');
            console.log('• Webhook настроен на основной веб-сервис');
            console.log('• Основной сервер должен быть запущен для работы бота');
            console.log('• Этот worker только настраивает бота, логика в основном сервере');
        }

    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА настройки webhook:', error);
        throw error;
    }
}

// Функция мониторинга
async function monitorBot() {
    try {
        console.log('🔍 Проверяем состояние бота...');
        
        // Получаем информацию о webhook
        const webhookInfo = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const info = webhookInfo.data.result;
        
        console.log('📊 Статус бота:');
        console.log(`   🔗 Webhook URL: ${info.url || 'не установлен'}`);
        console.log(`   📨 Pending updates: ${info.pending_update_count || 0}`);
        
        if (info.last_error_date) {
            const errorDate = new Date(info.last_error_date * 1000);
            console.log(`   ⚠️  Последняя ошибка: ${errorDate.toLocaleString()}`);
            console.log(`   📝 Сообщение ошибки: ${info.last_error_message}`);
        } else {
            console.log(`   ✅ Ошибок не обнаружено`);
        }
        
        // Проверяем доступность основного сервера
        if (WEB_APP_URL) {
            try {
                const healthResponse = await axios.get(`${WEB_APP_URL}/health`, {
                    timeout: 5000
                });
                console.log(`   🌐 Основной сервер: ✅ работает (${healthResponse.data.status})`);
            } catch (error) {
                console.log(`   🌐 Основной сервер: ❌ недоступен`);
            }
        }
        
    } catch (error) {
        console.error('❌ Ошибка мониторинга:', error.message);
    }
}

// Запуск
async function startWorker() {
    try {
        // Настраиваем webhook
        await setupWebhook();
        
        // Запускаем мониторинг каждые 5 минут
        setInterval(monitorBot, 5 * 60 * 1000);
        
        console.log('\n🔄 Worker активен, мониторинг каждые 5 минут...');
        
        // Graceful shutdown
        const gracefulShutdown = (signal) => {
            console.log(`\n📛 Получен сигнал ${signal}, завершаем worker...`);
            process.exit(0);
        };
        
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        
        // Держим worker живым
        setInterval(() => {
            console.log(`⏰ Worker работает - ${new Date().toLocaleTimeString()}`);
        }, 30 * 60 * 1000); // Каждые 30 минут
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА worker:', error);
        process.exit(1);
    }
}

// ЗАПУСК
startWorker();
