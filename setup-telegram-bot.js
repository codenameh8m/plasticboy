// setup-telegram-bot.js - Скрипт для первоначальной настройки бота

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;

if (!BOT_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN не найден в переменных окружения!');
    process.exit(1);
}

async function setupBot() {
    try {
        console.log('🤖 Настройка Telegram бота...\n');

        // 1. Проверяем подключение к боту
        console.log('1️⃣ Проверяем подключение к боту...');
        const botInfoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
        const botInfo = botInfoResponse.data.result;
        
        console.log(`✅ Бот найден: @${botInfo.username}`);
        console.log(`📝 Имя: ${botInfo.first_name}`);
        console.log(`🆔 ID: ${botInfo.id}\n`);

        // 2. Удаляем старые webhook
        console.log('2️⃣ Удаляем старые webhook...');
        try {
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
            console.log('✅ Старые webhook удалены\n');
        } catch (error) {
            console.log('⚠️ Не удалось удалить webhook (возможно их не было)\n');
        }

        // 3. Проверяем статус webhook
        console.log('3️⃣ Проверяем текущий статус webhook...');
        const webhookInfoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const webhookInfo = webhookInfoResponse.data.result;
        
        console.log('📋 Информация о webhook:');
        console.log(`   URL: ${webhookInfo.url || 'не установлен'}`);
        console.log(`   Pending updates: ${webhookInfo.pending_update_count || 0}`);
        if (webhookInfo.last_error_date) {
            console.log(`   ⚠️ Последняя ошибка: ${webhookInfo.last_error_message}`);
        }
        console.log('');

        // 4. Настраиваем команды бота
        console.log('4️⃣ Настраиваем команды бота...');
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
        console.log('✅ Команды бота настроены\n');

        // 5. Настраиваем описание бота
        console.log('5️⃣ Настраиваем описание бота...');
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
        console.log('✅ Описание бота установлено\n');

        // 6. Краткое описание
        const shortDescription = '🎯 Игра по сбору 3D моделей в Алматы. Найди QR-коды и собирай коллекцию!';
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setMyShortDescription`, {
            short_description: shortDescription
        });
        console.log('✅ Краткое описание установлено\n');

        // 7. Тестируем отправку сообщения (если есть chat_id для теста)
        console.log('6️⃣ Готово! Бот настроен и готов к работе\n');

        console.log('📊 ИТОГОВАЯ ИНФОРМАЦИЯ:');
        console.log(`🤖 Имя бота: @${botInfo.username}`);
        console.log(`🔗 Ссылка: https://t.me/${botInfo.username}`);
        console.log(`💬 Для тестирования отправьте /start боту`);
        
        // Проверяем соответствие USERNAME в .env
        if (BOT_USERNAME && BOT_USERNAME !== botInfo.username) {
            console.log(`\n⚠️  ВНИМАНИЕ: TELEGRAM_BOT_USERNAME в .env (${BOT_USERNAME}) не соответствует реальному username бота (${botInfo.username})`);
            console.log(`🔧 Обновите TELEGRAM_BOT_USERNAME в .env файле или в переменных окружения Render`);
        }

        console.log('\n🎉 Настройка завершена успешно!');
        console.log('\n📋 Что делать дальше:');
        console.log('1. Запустите основной сервер (npm start)');
        console.log('2. Запустите бот-сервер (npm run bot)');
        console.log('3. Отправьте /start боту для проверки');

    } catch (error) {
        console.error('❌ Ошибка настройки бота:', error.response?.data || error.message);
        
        if (error.response?.status === 401) {
            console.log('\n💡 Проверьте правильность TELEGRAM_BOT_TOKEN');
            console.log('🔗 Получить новый токен: https://t.me/botfather');
        }
        
        process.exit(1);
    }
}

setupBot();
