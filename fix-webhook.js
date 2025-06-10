// fix-webhook.js - Quick webhook fix script
const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://your-app.onrender.com';

console.log('🔧 PlasticBoy Telegram Webhook Fix Script');
console.log('==========================================');

async function fixWebhook() {
  if (!BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN not found in environment variables');
    console.log('   Add it to your .env file or Render environment variables');
    process.exit(1);
  }

  console.log(`✅ Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
  console.log(`✅ App URL: ${APP_URL}`);

  const WEBHOOK_URL = `${APP_URL}/webhook/${BOT_TOKEN}`;

  console.log('\n1️⃣ Deleting existing webhook...');
  
  try {
    const deleteResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    console.log('✅ Old webhook deleted:', deleteResponse.data.description);
  } catch (error) {
    console.log('⚠️ Error deleting webhook (may not exist):', error.response?.data?.description);
  }

  console.log('\n2️⃣ Setting new webhook...');

  try {
    const setResponse = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      url: WEBHOOK_URL,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true
    });

    console.log('✅ Webhook set successfully!');
    console.log('Response:', setResponse.data);

  } catch (error) {
    console.log('❌ Failed to set webhook');
    console.log('Error:', error.response?.data);
    process.exit(1);
  }

  console.log('\n3️⃣ Verifying webhook...');

  try {
    const infoResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = infoResponse.data.result;

    console.log('📡 Webhook Status:');
    console.log(`   URL: ${webhookInfo.url}`);
    console.log(`   Pending Updates: ${webhookInfo.pending_update_count}`);
    console.log(`   Max Connections: ${webhookInfo.max_connections}`);
    
    if (webhookInfo.last_error_message) {
      console.log(`   ⚠️ Last Error: ${webhookInfo.last_error_message}`);
    } else {
      console.log('   ✅ No errors');
    }

  } catch (error) {
    console.log('❌ Failed to get webhook info');
    console.log('Error:', error.response?.data);
  }

  console.log('\n4️⃣ Testing bot...');

  try {
    const botResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botInfo = botResponse.data.result;

    console.log('🤖 Bot Info:');
    console.log(`   Username: @${botInfo.username}`);
    console.log(`   Name: ${botInfo.first_name}`);
    console.log(`   ID: ${botInfo.id}`);

  } catch (error) {
    console.log('❌ Failed to get bot info');
    console.log('Error:', error.response?.data);
  }

  console.log('\n🎯 Next Steps:');
  console.log('1. Send /start to @PlasticBoyBot in Telegram');
  console.log('2. Check if bot responds with English interface');
  console.log('3. Test buttons and commands');
  console.log(`4. Monitor logs at: ${APP_URL}/health`);
  
  console.log('\n✅ Webhook fix complete!');
}

fixWebhook().catch(error => {
  console.error('❌ Script failed:', error.message);
  process.exit(1);
});
