/**
 * Flo Faction Bot Webhook Setup Script
 * Registers webhooks for all 18 bots with Telegram
 * 
 * Usage: npm run setup-webhooks
 * Or: node scripts/setup-webhooks.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL;

if (!BASE_URL) {
  console.error('❌ ERROR: BASE_URL or RENDER_EXTERNAL_URL environment variable required');
  console.error('Example: BASE_URL=https://your-app.onrender.com');
  process.exit(1);
}

// Bot configuration
const BOTS = [
  { id: 'quantum', name: 'QuantumClaw', token: process.env.QUANTUM_CLAW_TOKEN },
  { id: 'zero', name: 'ZeroClaw', token: process.env.ZERO_CLAW_TOKEN },
  { id: 'gigaclaw', name: 'GigaClaw', token: process.env.GIGA_CLAW_TOKEN },
  { id: 'grant', name: 'FloFactionGrant', token: process.env.FLOFACTION_GRANT_TOKEN },
  { id: 'terra', name: 'TerraClaw', token: process.env.TERRA_CLAW_TOKEN },
  { id: 'hackathon', name: 'FloFactionHackathon', token: process.env.FLOFACTION_HACKATHON_TOKEN },
  { id: 'ultra', name: 'UltraClaw', token: process.env.ULTRA_CLAW_TOKEN },
  { id: 'alpha', name: 'AlphaClaw', token: process.env.ALPHA_CLAW_TOKEN },
  { id: 'ninja', name: 'NinjaClaw', token: process.env.NINJA_CLAW_TOKEN },
  { id: 'nemo', name: 'NemoClaw', token: process.env.NEMO_CLAW_TOKEN },
  { id: 'dojo', name: 'DojoClaw', token: process.env.DOJO_CLAW_TOKEN },
  { id: 'mega', name: 'MegaClaw', token: process.env.MEGA_CLAW_TOKEN },
  { id: 'openclaw', name: 'OpenClaw', token: process.env.OPEN_CLAW_TOKEN },
  { id: 'nanoclaw', name: 'NanoClaw', token: process.env.NANO_CLAW_TOKEN },
  { id: 'nanoclawios', name: 'NanoClawios', token: process.env.NANO_CLAW_IOS_TOKEN },
  { id: 'microclaw', name: 'MicroClaw', token: process.env.MICRO_CLAW_TOKEN },
  { id: 'omega', name: 'OmegaClaw', token: process.env.OMEGA_CLAW_TOKEN },
  { id: 'flofactionopenclaw', name: 'FloFactionOpenClaw', token: process.env.FLOFACTION_OPEN_CLAW_TOKEN }
];

console.log('🤖 Flo Faction Bot Webhook Setup');
console.log('================================');
console.log(`Base URL: ${BASE_URL}`);
console.log('');

async function setupWebhook(bot) {
  if (!bot.token) {
    console.log(`⚠️  ${bot.name}: No token configured, skipping`);
    return { success: false, bot: bot.name, error: 'No token' };
  }

  const webhookUrl = `${BASE_URL}/webhook/${bot.id}`;
  const telegramUrl = `https://api.telegram.org/bot${bot.token}/setWebhook`;

  try {
    const response = await axios.post(telegramUrl, {
      url: webhookUrl,
      max_connections: 40,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
      drop_pending_updates: true
    });

    if (response.data.ok) {
      console.log(`✅ ${bot.name}: Webhook registered`);
      console.log(`   URL: ${webhookUrl}`);
      return { success: true, bot: bot.name, webhook: webhookUrl };
    } else {
      console.log(`❌ ${bot.name}: ${response.data.description}`);
      return { success: false, bot: bot.name, error: response.data.description };
    }
  } catch (error) {
    console.log(`❌ ${bot.name}: ${error.message}`);
    return { success: false, bot: bot.name, error: error.message };
  }
}

async function getWebhookInfo(bot) {
  if (!bot.token) return null;
  
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${bot.token}/getWebhookInfo`
    );
    return response.data;
  } catch (error) {
    return null;
  }
}

async function main() {
  const results = [];
 
  for (const bot of BOTS) {
    const result = await setupWebhook(bot);
    results.push(result);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log('================================');
  console.log('Setup Complete');
  console.log('================================');
  
  const success = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success && r.error !== 'No token').length;
  const skipped = results.filter(r => r.error === 'No token').length;
  
  console.log(`✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Skipped (no token): ${skipped}`);
  console.log('');

  if (failed > 0) {
    console.log('Failed bots:');
    results.filter(r => !r.success && r.error !== 'No token').forEach(r => {
      console.log(`  - ${r.bot}: ${r.error}`);
    });
  }

  // Show webhook info for configured bots
  console.log('');
  console.log('Current Webhook Status:');
  for (const bot of BOTS) {
    if (!bot.token) continue;
    const info = await getWebhookInfo(bot);
    if (info && info.ok) {
      const w = info.result;
      console.log(`  ${bot.name}: ${w.url ? '✅ Active' : '❌ None'} ${w.pending_update_count > 0 ? `(${w.pending_update_count} pending)` : ''}`);
    }
  }
}

main().catch(console.error);
