/**
 * Flo Faction Bot Test Script
 * Tests connectivity for all 20 bots
 * 
 * Usage: npm test
 * Or: node scripts/test-bots.js
 */

require('dotenv').config();
const axios = require('axios');

const BOTS = [
  { id: 'claudette', name: 'Claudette', role: 'Core AI orchestrator', token: process.env.CLAUDETTE_TOKEN },
  { id: 'quantum', name: 'QuantumClaw', role: 'Lead orchestrator', token: process.env.QUANTUM_CLAW_TOKEN },
  { id: 'zero', name: 'ZeroClaw', role: 'System monitor', token: process.env.ZERO_CLAW_TOKEN },
  { id: 'gigaclaw', name: 'GigaClaw', role: 'Content generation', token: process.env.GIGA_CLAW_TOKEN },
  { id: 'grant', name: 'FloFactionGrant', role: 'Grant research', token: process.env.FLOFACTION_GRANT_TOKEN },
  { id: 'terra', name: 'TerraClaw', role: 'Real estate', token: process.env.TERRA_CLAW_TOKEN },
  { id: 'hackathon', name: 'FloFactionHackathon', role: 'Dev challenges', token: process.env.FLOFACTION_HACKATHON_TOKEN },
  { id: 'ultra', name: 'UltraClaw', role: 'Insurance quotes', token: process.env.ULTRA_CLAW_TOKEN },
  { id: 'alpha', name: 'AlphaClaw', role: 'Financial analysis', token: process.env.ALPHA_CLAW_TOKEN },
  { id: 'ninja', name: 'NinjaClaw', role: 'Security scanning', token: process.env.NINJA_CLAW_TOKEN },
  { id: 'nemo', name: 'NemoClaw', role: 'Music licensing', token: process.env.NEMO_CLAW_TOKEN },
  { id: 'dojo', name: 'DojoClaw', role: 'Training', token: process.env.DOJO_CLAW_TOKEN },
  { id: 'mega', name: 'MegaClaw', role: 'Analytics', token: process.env.MEGA_CLAW_TOKEN },
  { id: 'openclaw', name: 'OpenClaw', role: 'Main assistant', token: process.env.OPEN_CLAW_TOKEN },
  { id: 'nanoclaw', name: 'NanoClaw', role: 'Micro-automation', token: process.env.NANO_CLAW_TOKEN },
  { id: 'nanoclawios', name: 'NanoClawios', role: 'iOS automation', token: process.env.NANO_CLAW_IOS_TOKEN },
  { id: 'microclaw', name: 'MicroClaw', role: 'API manager', token: process.env.MICRO_CLAW_TOKEN },
  { id: 'omega', name: 'OmegaClaw', role: 'Backup/DR', token: process.env.OMEGA_CLAW_TOKEN },
  { id: 'flofactionopenclaw', name: 'FloFactionOpenClaw', role: 'OSS manager', token: process.env.FLOFACTION_OPEN_CLAW_TOKEN },
  { id: 'taxclaw', name: 'TaxClaw', role: 'Tax & compliance', token: process.env.TAX_CLAW_TOKEN },
  { id: 'lexclaw', name: 'LexClaw', role: 'Legal research', token: process.env.LEX_CLAW_TOKEN }
];

console.log('🧪 Flo Faction Bot Connectivity Test');
console.log('=====================================');

async function testBot(bot) {
  if (!bot.token) {
    return { status: 'no_token', name: bot.name, error: 'Token not configured' };
  }

  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${bot.token}/getMe`,
      { timeout: 10000 }
    );

    if (response.data.ok) {
      const botInfo = response.data.result;
      return {
        status: 'online',
        name: bot.name,
        role: bot.role,
        username: botInfo.username,
        id: botInfo.id,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages
      };
    } else {
      return { status: 'error', name: bot.name, error: response.data.description };
    }
  } catch (error) {
    return { status: 'error', name: bot.name, error: error.message };
  }
}

async function main() {
  const results = [];

  for (const bot of BOTS) {
    const result = await testBot(bot);
    results.push(result);
    
    const icon = result.status === 'online' ? '🟢' : 
                 result.status === 'no_token' ? '⚪' : '🔴';
    const status = result.status === 'online' ? 'Online' : 
                   result.status === 'no_token' ? 'No Token' : 'Error';
    console.log(`${icon} ${bot.name.padEnd(20)} ${status}`);
    
    if (result.status === 'online') {
      console.log(`   @${result.username} | ID: ${result.id}`);
    } else if (result.error && result.status !== 'no_token') {
      console.log(`   Error: ${result.error}`);
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('');
  console.log('=====================================');
  
  const online = results.filter(r => r.status === 'online').length;
  const noToken = results.filter(r => r.status === 'no_token').length;
  const errors = results.filter(r => r.status === 'error').length;
  
  console.log(`Summary: ${online} online | ${noToken} no token | ${errors} errors`);
  
  if (online === 20) {
    console.log('✅ All bots connected successfully!');
    process.exit(0);
  } else if (errors > 0) {
    console.log('⚠️  Some bots have connection issues');
    process.exit(1);
  } else {
    console.log('ℹ️  Some bots need tokens configured');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
