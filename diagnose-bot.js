// diagnose-bot.js - Telegram Bot Diagnostics Script
const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'PlasticBoyBot';

console.log('🔍 PlasticBoy Telegram Bot Diagnostics');
console.log('=====================================');

async function runDiagnostics() {
  console.log('\n1️⃣ Checking environment variables...');
  
  if (!BOT_TOKEN) {
    console.log('❌ TELEGRAM_BOT_TOKEN is not set!');
    console.log('   Add it to your .env file or environment variables');
    return;
  }
  
  console.log('✅ BOT_TOKEN is set');
  console.log(`✅ BOT_USERNAME is set to: @${BOT_USERNAME}`);
  
  console.log('\n2️⃣ Testing bot connection...');
  
  try {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const botInfo = response.data.result;
    
    console.log('✅ Bot connection successful!');
    console.log(`🤖 Bot Info:`);
    console.log(`   - ID: ${botInfo.id}`);
    console.log(`   - Username: @${botInfo.username}`);
    console.log(`   - First Name: ${botInfo.first_name}`);
    console.log(`   - Can Join Groups: ${botInfo.can_join_groups}`);
    console.log(`   - Can Read All Group Messages: ${botInfo.can_read_all_group_messages}`);
    console.log(`   - Supports Inline Queries: ${botInfo.supports_inline_queries}`);
    
    if (botInfo.username !== BOT_USERNAME) {
      console.log(`⚠️  WARNING: Bot username (${botInfo.username}) doesn't match BOT_USERNAME (${BOT_USERNAME})`);
      console.log(`   Update your .env file: TELEGRAM_BOT_USERNAME=${botInfo.username}`);
    }
    
  } catch (error) {
    console.log('❌ Bot connection failed!');
    console.log(`   Error: ${error.response?.data?.description || error.message}`);
    
    if (error.response?.status === 401) {
      console.log('   This usually means your BOT_TOKEN is invalid');
      console.log('   Get a new token from @BotFather on Telegram');
    }
    return;
  }
  
  console.log('\n3️⃣ Checking webhook status...');
  
  try {
    const webhookResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const webhookInfo = webhookResponse.data.result;
    
    console.log('📡 Webhook Info:');
    console.log(`   - URL: ${webhookInfo.url || 'Not set'}`);
    console.log(`   - Has Custom Certificate: ${webhookInfo.has_custom_certificate}`);
    console.log(`   - Pending Updates: ${webhookInfo.pending_update_count}`);
    console.log(`   - Max Connections: ${webhookInfo.max_connections}`);
    console.log(`   - Allowed Updates: ${webhookInfo.allowed_updates?.join(', ') || 'All'}`);
    
    if (webhookInfo.last_error_date) {
      console.log(`   ⚠️  Last Error: ${webhookInfo.last_error_message}`);
      console.log(`   ⚠️  Error Date: ${new Date(webhookInfo.last_error_date * 1000).toISOString()}`);
    }
    
    if (!webhookInfo.url) {
      console.log('   ℹ️  No webhook is currently set');
      console.log('   ℹ️  You need to set up a webhook for the bot to work in production');
    } else {
      console.log('   ✅ Webhook is configured');
    }
    
  } catch (error) {
    console.log('❌ Failed to get webhook info');
    console.log(`   Error: ${error.response?.data?.description || error.message}`);
  }
  
  console.log('\n4️⃣ Testing bot commands...');
  
  // Get updates to see if bot is receiving messages
  try {
    const updatesResponse = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?limit=5`);
    const updates = updatesResponse.data.result;
    
    console.log(`📨 Recent Updates: ${updates.length} updates found`);
    
    if (updates.length > 0) {
      const lastUpdate = updates[updates.length - 1];
      console.log(`   Last update ID: ${lastUpdate.update_id}`);
      
      if (lastUpdate.message) {
        console.log(`   Last message from: ${lastUpdate.message.from.first_name} (@${lastUpdate.message.from.username || 'no_username'})`);
        console.log(`   Message text: "${lastUpdate.message.text}"`);
        console.log(`   Message date: ${new Date(lastUpdate.message.date * 1000).toISOString()}`);
      }
    } else {
      console.log('   ℹ️  No recent updates found');
      console.log('   ℹ️  Try sending /start to your bot');
    }
    
  } catch (error) {
    console.log('❌ Failed to get updates');
    console.log(`   Error: ${error.response?.data?.description || error.message}`);
  }
  
  console.log('\n5️⃣ Bot setup recommendations...');
  
  console.log('📋 To make your bot work properly:');
  console.log('');
  console.log('1. Make sure your server is running');
  console.log('2. Set up the webhook by visiting: your-app-url/setup-webhook');
  console.log('3. Test the bot by sending /start to @' + BOT_USERNAME);
  console.log('4. Check webhook status at: your-app-url/webhook-info');
  console.log('');
  
  console.log('🧪 Quick test commands:');
  console.log('- Send /start to @' + BOT_USERNAME);
  console.log('- Send /help to @' + BOT_USERNAME);
  console.log('- Send /stats to @' + BOT_USERNAME);
  console.log('');
  
  console.log('🔧 If bot is not responding:');
  console.log('1. Check that webhook URL is accessible from internet');
  console.log('2. Check server logs for webhook errors');
  console.log('3. Verify BOT_TOKEN is correct');
  console.log('4. Try deleting and setting webhook again');
  console.log('');
  
  console.log('✅ Diagnostics complete!');
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error('❌ Diagnostics failed:', error);
  process.exit(1);
});
