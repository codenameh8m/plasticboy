// bot/setup-bot.js - Настройка Telegram бота для Render.com

const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

console.log('🤖 PlasticBoy Telegram Bot - Настройка для Render.com');
console.log('======================================================\n');

async function setupBot() {
    try {
        const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
        const WEB_APP_URL = process.env.WEB_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        
        if (!BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
            console.log('\n📋 Добавьте в переменные окружения:');
            console.log('TELEGRAM_BOT_TOKEN=ваш_токен_бота');
            console.log('TELEGRAM_BOT_USERNAME=имя_бота_без_@');
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
        console.log('\n📋 Информация:');
        console.log(`• Имя бота: @${botInfo.username}`);
        console.log(`• Web App: ${WEB_APP_URL}`);
        console.log(`• Ссылка: https://t.me/${botInfo.username}`);
        
        // Проверяем доступность Web App
        console.log('\n🌐 Проверяем доступность Web App...');
        try {
            const axios = require('axios');
            const response = await axios.get(`${WEB_APP_URL}/health`, { timeout: 10000 });
            console.log('✅ Web App доступно');
            console.log(`📊 Статус: ${response.data.status}`);
        } catch (error) {
            console.log('⚠️ Web App пока недоступно (это нормально при первом деплое)');
            console.log('   Оно станет доступно после запуска основного сервиса');
        }
        
        console.log('\n🚀 Готово! Бот готов к использованию на Render.com');
        console.log('\n📱 Для тестирования отправьте /start боту в Telegram');
        
    } catch (error) {
        console.error('❌ Ошибка настройки:', error.message);
        
        if (error.message.includes('401')) {
            console.log('\n💡 Проверьте токен бота в переменных окружения');
        } else if (error.message.includes('network')) {
            console.log('\n💡 Проверьте подключение к интернету');
        }
        
        process.exit(1);
    }
}

// Проверяем переменные окружения
const requiredVars = ['TELEGRAM_BOT_TOKEN'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.log('❌ Отсутствуют переменные окружения:');
    missingVars.forEach(varName => {
        console.log(`   - ${varName}`);
    });
    
    console.log('\n📋 Добавьте в Render Dashboard:');
    console.log('Environment Variables:');
    console.log('TELEGRAM_BOT_TOKEN = ваш_токен_от_botfather');
    console.log('TELEGRAM_BOT_USERNAME = имя_бота_без_@');
    console.log('\n🔗 Получить токен: https://t.me/botfather');
    
    process.exit(1);
}

console.log('✅ Переменные окружения найдены, запускаем настройку...\n');
setupBot();