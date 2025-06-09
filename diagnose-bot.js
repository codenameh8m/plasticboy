// diagnose-bot.js - Диагностика состояния Telegram бота

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME;
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000';

console.log('🔍 ДИАГНОСТИКА TELEGRAM БОТА');
console.log('================================\n');

async function diagnosBot() {
    try {
        // Проверка переменных окружения
        console.log('1️⃣ ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ:');
        console.log(`   TELEGRAM_BOT_TOKEN: ${BOT_TOKEN ? '✅ установлен' : '❌ НЕ УСТАНОВЛЕН'}`);
        console.log(`   TELEGRAM_BOT_USERNAME: ${BOT_USERNAME || '❌ НЕ УСТАНОВЛЕН'}`);
        console.log(`   WEB_APP_URL: ${WEB_APP_URL}`);
        console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'не установлен'}\n`);

        if (!BOT_TOKEN) {
            console.error('❌ КРИТИЧЕСКАЯ ОШИБКА: TELEGRAM_BOT_TOKEN не найден!');
            console.log('🔧 Добавьте токен в .env файл или переменные окружения');
            return;
        }

        // Проверка подключения к Telegram API
        console.log('2️⃣ ПОДКЛЮЧЕНИЕ К TELEGRAM API:');
        try {
            const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`, {
                timeout: 10000
            });
            
            if (response.data.ok) {
                const botInfo = response.data.result;
                console.log(`   ✅ Подключение успешно`);
                console.log(`   🤖 Имя бота: ${botInfo.first_name}`);
                console.log(`   📱 Username: @${botInfo.username}`);
                console.log(`   🆔 ID: ${botInfo.id}`);
                console.log(`   🔐 Can join groups: ${botInfo.can_join_groups}`);
                console.log(`   👥 Can read all group messages: ${botInfo.can_read_all_group_messages}`);
                console.log(`   🎯 Supports inline queries: ${botInfo.supports_inline_queries}\n`);

                // Проверяем соответствие username
                if (BOT_USERNAME && BOT_USERNAME !== botInfo.username) {
                    console.log(`   ⚠️  НЕСООТВЕТСТВИЕ: Ожидался @${BOT_USERNAME}, получен @${botInfo.username}`);
                    console.log(`   🔧 Обновите TELEGRAM_BOT_USERNAME в переменных окружения\n`);
                }
            } else {
                console.log(`   ❌ Ошибка API: ${response.data.description}`);
            }
        } catch (error) {
            console.log(`   ❌ Ошибка подключения: ${error.message}`);
            if (error.response?.status === 401) {
                console.log(`   💡 Проверьте правильность токена бота`);
            }
            console.log('');
        }

        // Проверка статуса webhook
        console.log('3️⃣ СТАТУС WEBHOOK:');
        try {
            const webhookResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
            const webhookInfo = webhookResponse.data.result;
            
            console.log(`   🔗 URL: ${webhookInfo.url || 'не установлен'}`);
            console.log(`   📨 Pending updates: ${webhookInfo.pending_update_count || 0}`);
            console.log(`   ✅ Has custom certificate: ${webhookInfo.has_custom_certificate || false}`);
            console.log(`   🔄 Allowed updates: ${webhookInfo.allowed_updates?.join(', ') || 'все'}`);
            
            if (webhookInfo.last_error_date) {
                const errorDate = new Date(webhookInfo.last_error_date * 1000);
                console.log(`   ⚠️  Последняя ошибка: ${errorDate.toLocaleString()}`);
                console.log(`   📝 Сообщение ошибки: ${webhookInfo.last_error_message}`);
            } else {
                console.log(`   ✅ Ошибок не обнаружено`);
            }
            console.log('');
        } catch (error) {
            console.log(`   ❌ Ошибка получения информации о webhook: ${error.message}\n`);
        }

        // Проверка команд бота
        console.log('4️⃣ КОМАНДЫ БОТА:');
        try {
            const commandsResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMyCommands`);
            const commands = commandsResponse.data.result;
            
            if (commands.length > 0) {
                console.log(`   ✅ Настроено команд: ${commands.length}`);
                commands.forEach(cmd => {
                    console.log(`   /${cmd.command} - ${cmd.description}`);
                });
            } else {
                console.log(`   ⚠️  Команды не настроены`);
            }
            console.log('');
        } catch (error) {
            console.log(`   ❌ Ошибка получения команд: ${error.message}\n`);
        }

        // Проверка доступности Web App URL
        console.log('5️⃣ ДОСТУПНОСТЬ WEB APP:');
        try {
            const webAppResponse = await axios.get(`${WEB_APP_URL}/health`, {
                timeout: 10000
            });
            
            console.log(`   ✅ Web App доступен`);
            console.log(`   📊 Статус: ${webAppResponse.data.status}`);
            console.log(`   🕐 Время ответа: ${webAppResponse.data.timestamp}`);
            if (webAppResponse.data.totalPoints !== undefined) {
                console.log(`   📍 Точек в базе: ${webAppResponse.data.totalPoints}`);
            }
        } catch (error) {
            console.log(`   ❌ Web App недоступен: ${error.message}`);
            console.log(`   💡 Убедитесь что основной сервер запущен`);
        }
        console.log('');

        // Проверка последних обновлений (только для polling режима)
        console.log('6️⃣ ПОСЛЕДНИЕ ОБНОВЛЕНИЯ:');
        try {
            // Сначала проверяем, установлен ли webhook
            const webhookResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
            const webhookInfo = webhookResponse.data.result;
            
            if (webhookInfo.url) {
                console.log(`   ℹ️  Webhook активен, getUpdates недоступен`);
                console.log(`   📨 Pending updates в webhook: ${webhookInfo.pending_update_count || 0}`);
            } else {
                console.log(`   🔄 Пробуем получить последние обновления...`);
                const updatesResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5`);
                const updates = updatesResponse.data.result;
                
                if (updates.length > 0) {
                    console.log(`   📬 Найдено обновлений: ${updates.length}`);
                    updates.forEach((update, i) => {
                        const updateType = Object.keys(update).find(key => key !== 'update_id') || 'unknown';
                        console.log(`   ${i + 1}. Update ID: ${update.update_id}, Type: ${updateType}`);
                    });
                } else {
                    console.log(`   📭 Новых обновлений нет`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Ошибка получения обновлений: ${error.message}`);
        }
        console.log('');

        // Итоговая диагностика
        console.log('7️⃣ РЕКОМЕНДАЦИИ:');
        
        // Проверяем основные проблемы
        if (!BOT_TOKEN) {
            console.log('   🔧 Установите TELEGRAM_BOT_TOKEN');
        }
        
        // Проверяем режим работы
        const webhookResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const webhookInfo = webhookResponse.data.result;
        
        if (process.env.NODE_ENV === 'production') {
            if (!webhookInfo.url) {
                console.log('   🔧 В production должен быть настроен webhook');
                console.log('   💡 Запустите bot-server.js для автонастройки webhook');
            } else {
                console.log('   ✅ Webhook настроен для production');
            }
        } else {
            if (webhookInfo.url) {
                console.log('   🔧 В development режиме лучше использовать polling');
                console.log('   💡 Удалите webhook: curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook');
            } else {
                console.log('   ✅ Polling режим подходит для development');
            }
        }

        console.log('\n🎯 ДЛЯ ТЕСТИРОВАНИЯ:');
        console.log(`   1. Откройте https://t.me/${BOT_USERNAME || 'your_bot_username'}`);
        console.log(`   2. Отправьте команду /start`);
        console.log(`   3. Проверьте логи bot-server.js`);

    } catch (error) {
        console.error('❌ Критическая ошибка диагностики:', error.message);
    }
}

// Запуск диагностики
diagnosBot().then(() => {
    console.log('\n✅ Диагностика завершена');
}).catch(error => {
    console.error('❌ Ошибка:', error.message);
});
