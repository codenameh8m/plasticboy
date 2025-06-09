const TelegramBot = require('node-telegram-bot-api');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('🤖 PlasticBoy Telegram Bot - Настройка');
console.log('=====================================\n');

async function setupBot() {
    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const WEB_APP_URL = process.env.WEB_APP_URL || 'http://localhost:3000';
        
        if (!BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN не найден в .env файле!');
            console.log('\n📋 Добавьте в .env файл:');
            console.log('TELEGRAM_BOT_TOKEN=ваш_токен_бота');
            console.log('WEB_APP_URL=https://ваш_домен.com');
            console.log('\n🔗 Получить токен: https://t.me/botfather');
            process.exit(1);
        }
        
        console.log('✅ Токен бота найден');
        console.log(`🌐 Web App URL: ${WEB_APP_URL}`);
        
        const bot = new TelegramBot(BOT_TOKEN);
        
        // Получаем информацию о боте
        console.log('\n📡 Проверяем соединение с Telegram...');
        const botInfo = await bot.getMe();
        
        console.log(`✅ Бот подключен: @${botInfo.username}`);
        console.log(`📝 Имя: ${botInfo.first_name}`);
        console.log(`🆔 ID: ${botInfo.id}`);
        
        // Настраиваем команды бота
        console.log('\n⚙️ Настраиваем команды бота...');
        
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
        
        await bot.setMyCommands(commands);
        console.log('✅ Команды настроены');
        
        // Настраиваем Menu Button для Web App
        console.log('\n🎮 Настраиваем Menu Button...');
        await bot.setChatMenuButton({
            menu_button: {
                type: 'web_app',
                text: '🎯 PlasticBoy',
                web_app: {
                    url: WEB_APP_URL
                }
            }
        });
        console.log('✅ Menu Button настроена');
        
        // Настраиваем описание бота
        console.log('\n📄 Настраиваем описание бота...');
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

        await bot.setMyDescription(description);
        console.log('✅ Описание установлено');
        
        // Краткое описание
        const shortDescription = '🎯 Игра по сбору 3D моделей в Алматы. Найди QR-коды и собирай коллекцию!';
        await bot.setMyShortDescription(shortDescription);
        console.log('✅ Краткое описание установлено');
        
        console.log('\n🎉 Бот успешно настроен!');
        console.log('\n📋 Следующие шаги:');
        console.log('1. npm start - запустить бота');
        console.log('2. Протестируйте бота, отправив /start');
        console.log(`3. Поделитесь ссылкой: https://t.me/${botInfo.username}`);
        
        // Проверяем доступность Web App
        console.log('\n🌐 Проверяем доступность Web App...');
        try {
            const axios = require('axios');
            const response = await axios.get(`${WEB_APP_URL}/health`, { timeout: 5000 });
            console.log('✅ Web App доступно');
        } catch (error) {
            console.log('⚠️ Web App недоступно, убедитесь что сервер запущен');
        }
        
        console.log('\n🚀 Готово! Бот готов к использованию.');
        
    } catch (error) {
        console.error('❌ Ошибка настройки:', error.message);
        
        if (error.message.includes('401')) {
            console.log('\n💡 Проверьте токен бота в .env файле');
        } else if (error.message.includes('network')) {
            console.log('\n💡 Проверьте подключение к интернету');
        }
    }
    
    rl.close();
}

// Проверяем .env файл
console.log('🔍 Проверяем конфигурацию...\n');

const requiredVars = ['TELEGRAM_BOT_TOKEN'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ Отсутствуют обязательные переменные в .env:');
    missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    
    console.log('\n📋 Создайте .env файл с содержимым:');
    console.log('TELEGRAM_BOT_TOKEN=ваш_токен_от_botfather');
    console.log('TELEGRAM_BOT_USERNAME=имя_бота_без_@');
    console.log('WEB_APP_URL=https://ваш_домен.com');
    console.log('\n🔗 Получить токен: https://t.me/botfather');
    
    rl.close();
    process.exit(1);
}

console.log('✅ Конфигурация найдена, запускаем настройку...\n');
setupBot();
