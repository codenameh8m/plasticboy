// fix-webhook.js - Быстрое исправление webhook с двойным слешем

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.WEB_APP_URL || 'http://localhost:3000';

console.log('🔧 ИСПРАВЛЕНИЕ WEBHOOK');
console.log('====================\n');

async function fixWebhook() {
    try {
        if (!BOT_TOKEN) {
            console.error('❌ TELEGRAM_BOT_TOKEN не найден!');
            return;
        }

        console.log('1️⃣ Проверяем текущий webhook...');
        
        // Получаем информацию о текущем webhook
        const webhookInfoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const webhookInfo = webhookInfoResponse.data.result;
        
        console.log(`📋 Текущий webhook URL: ${webhookInfo.url || 'не установлен'}`);
        console.log(`📨 Pending updates: ${webhookInfo.pending_update_count || 0}`);
        
        if (webhookInfo.last_error_date) {
            const errorDate = new Date(webhookInfo.last_error_date * 1000);
            console.log(`⚠️  Последняя ошибка: ${errorDate.toLocaleString()}`);
            console.log(`📝 Сообщение ошибки: ${webhookInfo.last_error_message}`);
        }

        // Проверяем наличие двойного слеша
        if (webhookInfo.url && webhookInfo.url.includes('//') && !webhookInfo.url.includes('http://') && !webhookInfo.url.includes('https://')) {
            console.log('❌ ОБНАРУЖЕН ДВОЙНОЙ СЛЕШ В URL!\n');
        }

        console.log('\n2️⃣ Удаляем старый webhook...');
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
        console.log('✅ Старый webhook удален');

        // Создаем правильный URL без двойного слеша
        console.log('\n3️⃣ Создаем правильный webhook URL...');
        
        const baseUrl = WEB_APP_URL.endsWith('/') ? WEB_APP_URL.slice(0, -1) : WEB_APP_URL;
        const webhookPath = `/${BOT_TOKEN}`;
        const correctWebhookUrl = `${baseUrl}${webhookPath}`;
        
        console.log(`🔗 Base URL: ${baseUrl}`);
        console.log(`🔗 Webhook path: ${webhookPath}`);
        console.log(`🔗 Исправленный URL: ${correctWebhookUrl}`);

        // Устанавливаем исправленный webhook
        console.log('\n4️⃣ Устанавливаем исправленный webhook...');
        
        const setWebhookResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
            url: correctWebhookUrl,
            allowed_updates: ['message', 'callback_query']
        });

        if (setWebhookResponse.data.ok) {
            console.log('✅ Webhook успешно установлен!');
        } else {
            console.log('❌ Ошибка установки webhook:', setWebhookResponse.data.description);
        }

        // Проверяем результат
        console.log('\n5️⃣ Проверяем новый webhook...');
        const newWebhookInfoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
        const newWebhookInfo = newWebhookInfoResponse.data.result;
        
        console.log(`📋 Новый webhook URL: ${newWebhookInfo.url}`);
        console.log(`📨 Pending updates: ${newWebhookInfo.pending_update_count || 0}`);
        
        if (newWebhookInfo.last_error_date) {
            const errorDate = new Date(newWebhookInfo.last_error_date * 1000);
            console.log(`⚠️  Есть ошибки: ${errorDate.toLocaleString()}`);
            console.log(`📝 Сообщение: ${newWebhookInfo.last_error_message}`);
        } else {
            console.log('✅ Ошибок нет!');
        }

        console.log('\n🎯 РЕЗУЛЬТАТ:');
        
        // Проверяем, исправлена ли проблема
        if (newWebhookInfo.url && !newWebhookInfo.url.includes('//') || (newWebhookInfo.url.includes('://') && newWebhookInfo.url.split('://')[1].indexOf('//') === -1)) {
            console.log('✅ Двойной слеш исправлен!');
        } else {
            console.log('❌ Двойной слеш все еще присутствует');
        }

        console.log('\n📱 ДЛЯ ТЕСТИРОВАНИЯ:');
        console.log('1. Отправьте /start боту в Telegram');
        console.log('2. Проверьте логи bot-server.js');
        console.log('3. Если есть проблемы, перезапустите bot-server.js');

    } catch (error) {
        console.error('❌ Ошибка исправления webhook:', error.response?.data || error.message);
    }
}

fixWebhook();
