/**
 * Flo Faction Telegram Bot Handler
 * Express server managing 18 Telegram bots on Render
 * 
 * Bots:
 * - QuantumClaw: Lead orchestrator / task router
 * - ZeroClaw: System monitor / health checker
 * - GigaClaw: Content generation / marketing
 * - FloFactionGrant: Grant research / funding opportunities
 * - TerraClaw: Real estate / property research
 * - FloFactionHackathon: Dev challenges / hackathon info
 * - UltraClaw: Insurance quoting assistant
 * - AlphaClaw: Financial analysis / trading signals
 * - NinjaClaw: Security scanning / threat detection
 * - NemoClaw: Music production / sync licensing
 * - DojoClaw: Training / onboarding assistant
 * - MegaClaw: Data aggregation / analytics
 * - OpenClaw: Main Flo Faction assistant
 * - NanoClaw: Micro-task automation
 * - NanoClawios: iOS/mobile automation
 * - MicroClaw: API integration manager
 * - OmegaClaw: Backup / disaster recovery
 * - FloFactionOpenClaw: Open source project manager
 */

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const TelegramBot = require('node-telegram-bot-api');

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Bot configuration with roles and descriptions
const BOT_CONFIG = {
  quantum: {
    name: 'QuantumClaw',
    token: process.env.QUANTUM_CLAW_TOKEN,
    role: 'Lead orchestrator / task router',
    description: 'QuantumClaw - Flo Faction Lead Orchestrator',
    features: ['Task routing', 'Bot coordination', 'Workflow management', 'Cross-bot communication'],
    color: '🟣',
    priority: 1
  },
  zero: {
    name: 'ZeroClaw',
    token: process.env.ZERO_CLAW_TOKEN,
    role: 'System monitor / health checker',
    description: 'ZeroClaw - System Health Monitor',
    features: ['Health checks', 'System monitoring', 'Alert management', 'Performance metrics'],
    color: '⚫',
    priority: 2
  },
  gigaclaw: {
    name: 'GigaClaw',
    token: process.env.GIGA_CLAW_TOKEN,
    role: 'Content generation / marketing',
    description: 'GigaClaw - Content & Marketing Engine',
    features: ['Content creation', 'Marketing campaigns', 'Social media posts', 'SEO optimization'],
    color: '🟢',
    priority: 3
  },
  grant: {
    name: 'FloFactionGrant',
    token: process.env.FLOFACTION_GRANT_TOKEN,
    role: 'Grant research / funding opportunities',
    description: 'FloFactionGrant - Grant Research Bot',
    features: ['Grant discovery', 'Funding alerts', 'Application tracking', 'Deadline reminders'],
    color: '💰',
    priority: 4
  },
  terra: {
    name: 'TerraClaw',
    token: process.env.TERRA_CLAW_TOKEN,
    role: 'Real estate / property research',
    description: 'TerraClaw - Real Estate Intelligence',
    features: ['Property search', 'Market analysis', 'Investment opportunities', 'Rent comparisons'],
    color: '🏠',
    priority: 5
  },
  hackathon: {
    name: 'FloFactionHackathon',
    token: process.env.FLOFACTION_HACKATHON_TOKEN,
    role: 'Dev challenges / hackathon info',
    description: 'FloFactionHackathon - Hackathon Hub',
    features: ['Hackathon listings', 'Team formation', 'Challenge updates', 'Submission reminders'],
    color: '💻',
    priority: 6
  },
  ultra: {
    name: 'UltraClaw',
    token: process.env.ULTRA_CLAW_TOKEN,
    role: 'Insurance quoting assistant',
    description: 'UltraClaw - Insurance Intelligence',
    features: ['Quote generation', 'Policy comparison', 'Coverage analysis', 'Carrier research'],
    color: '🛡️',
    priority: 7
  },
  alpha: {
    name: 'AlphaClaw',
    token: process.env.ALPHA_CLAW_TOKEN,
    role: 'Financial analysis / trading signals',
    description: 'AlphaClaw - Financial Intelligence',
    features: ['Market analysis', 'Trading signals', 'Portfolio tracking', 'Risk assessment'],
    color: '📈',
    priority: 8
  },
  ninja: {
    name: 'NinjaClaw',
    token: process.env.NINJA_CLAW_TOKEN,
    role: 'Security scanning / threat detection',
    description: 'NinjaClaw - Security Guardian',
    features: ['Threat detection', 'Security scans', 'Vulnerability alerts', 'Incident response'],
    color: '🥷',
    priority: 9
  },
  nemo: {
    name: 'NemoClaw',
    token: process.env.NEMO_CLAW_TOKEN,
    role: 'Music production / sync licensing',
    description: 'NemoClaw - Music & Sync Licensing',
    features: ['Sync opportunities', 'Music licensing', 'Production tips', 'Industry contacts'],
    color: '🎵',
    priority: 10
  },
  dojo: {
    name: 'DojoClaw',
    token: process.env.DOJO_CLAW_TOKEN,
    role: 'Training / onboarding assistant',
    description: 'DojoClaw - Training & Onboarding',
    features: ['Training materials', 'Onboarding guides', 'Skill assessments', 'Learning paths'],
    color: '🥋',
    priority: 11
  },
  mega: {
    name: 'MegaClaw',
    token: process.env.MEGA_CLAW_TOKEN,
    role: 'Data aggregation / analytics',
    description: 'MegaClaw - Data & Analytics Hub',
    features: ['Data aggregation', 'Analytics reports', 'Trend analysis', 'Custom dashboards'],
    color: '📊',
    priority: 12
  },
  openclaw: {
    name: 'OpenClaw',
    token: process.env.OPEN_CLAW_TOKEN,
    role: 'Main Flo Faction assistant',
    description: 'OpenClaw - Flo Faction Main Assistant',
    features: ['General assistance', 'Information lookup', 'Coordination', 'Communication hub'],
    color: '🐾',
    priority: 13
  },
  nanoclaw: {
    name: 'NanoClaw',
    token: process.env.NANO_CLAW_TOKEN,
    role: 'Micro-task automation',
    description: 'NanoClaw - Micro-Task Automation',
    features: ['Quick tasks', 'Automation scripts', 'Lightweight operations', 'Instant responses'],
    color: '⚡',
    priority: 14
  },
  nanoclawios: {
    name: 'NanoClawios',
    token: process.env.NANO_CLAW_IOS_TOKEN,
    role: 'iOS/mobile automation',
    description: 'NanoClawios - iOS & Mobile Automation',
    features: ['iOS shortcuts', 'Mobile automation', 'App integrations', 'Phone-based tasks'],
    color: '📱',
    priority: 15
  },
  microclaw: {
    name: 'MicroClaw',
    token: process.env.MICRO_CLAW_TOKEN,
    role: 'API integration manager',
    description: 'MicroClaw - API Integration Manager',
    features: ['API connections', 'Service integrations', 'Data sync', 'Webhook management'],
    color: '🔗',
    priority: 16
  },
  omega: {
    name: 'OmegaClaw',
    token: process.env.OMEGA_CLAW_TOKEN,
    role: 'Backup / disaster recovery',
    description: 'OmegaClaw - Backup & Disaster Recovery',
    features: ['Backup management', 'Disaster recovery', 'Data restoration', 'Failover operations'],
    color: '🔁',
    priority: 17
  },
  flofactionopenclaw: {
    name: 'FloFactionOpenClaw',
    token: process.env.FLOFACTION_OPEN_CLAW_TOKEN,
    role: 'Open source project manager',
    description: 'FloFactionOpenClaw - Open Source Manager',
    features: ['OSS project tracking', 'Contributor management', 'Release monitoring', 'Community engagement'],
    color: '🌐',
    priority: 18
  }
};

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || `http://localhost:${PORT}`;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/webhook/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  const botStatus = Object.entries(BOT_CONFIG).map(([key, config]) => {
    const token = config.token;
    return {
      id: key,
      name: config.name,
      configured: !!token,
      role: config.role,
      priority: config.priority
    };
  }).sort((a, b) => a.priority - b.priority);

  const healthy = botStatus.every(b => b.configured);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalBots: Object.keys(BOT_CONFIG).length,
    configuredBots: botStatus.filter(b => b.configured).length,
    bots: botStatus,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Flo Faction Telegram Bot Handler',
    version: '1.0.0',
    bots: Object.values(BOT_CONFIG).map(b => ({
      name: b.name,
      role: b.role,
      webhook: `/webhook/${Object.keys(BOT_CONFIG).find(k => BOT_CONFIG[k].name === b.name)}`
    })),
    endpoints: {
      health: '/health',
      webhooks: '/webhook/:botId',
      botStatus: '/bot-status'
    },
    documentation: 'https://github.com/flofaction/bots'
  });
});

// Bot status endpoint
app.get('/bot-status', (req, res) => {
  const status = Object.entries(BOT_CONFIG).map(([key, config]) => ({
    id: key,
    ...config,
    token: config.token ? '✓ Configured' : '✗ Missing',
    webhookUrl: `${BASE_URL}/webhook/${key}`
  }));
  res.json({ bots: status });
});

// Store bot instances
const botInstances = {};

// Initialize Telegram bots
Object.entries(BOT_CONFIG).forEach(([botId, config]) => {
  if (!config.token) {
    logger.warn(`Bot ${config.name} (${botId}) has no token configured`);
    return;
  }

  // Create bot instance in webhook mode
  const bot = new TelegramBot(config.token, { webHook: true });
  botInstances[botId] = bot;

  // Welcome message handler
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    logger.info(`[${config.name}] /start from ${username} (${chatId})`);
    
    const welcomeMessage = `
${config.color} <b>${config.name}</b> ${config.color}

<b>${config.role}</b>

${config.description}

<b>Available Commands:</b>
/start - Show this welcome message
/status - Check system status
/help - List all commands
/info - About this bot

<b>Features:</b>
${config.features.map(f => `• ${f}`).join('\n')}

<i>Flo Faction Bot #${config.priority}/18</i>
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
  });

  // Status handler
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    logger.info(`[${config.name}] /status from ${username} (${chatId})`);
    
    const statusMessage = `
${config.color} <b>${config.name} Status</b> ${config.color}

<b>Bot Health:</b> ✅ Operational
<b>Uptime:</b> ${formatUptime(process.uptime())}
<b>Webhook:</b> ${BASE_URL}/webhook/${botId}
<b>Connected:</b> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST

<i>All systems operational</i>
    `;
    
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
  });

  // Help handler
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    logger.info(`[${config.name}] /help from ${username} (${chatId})`);
    
    const helpMessage = `
${config.color} <b>${config.name} Commands</b> ${config.color}

<b>Core Commands:</b>
/start - Welcome message & bot info
/status - System health & status
/help - This help message
/info - Detailed bot information

<b>Feature Commands:</b>
${config.features.map((f, i) => `/${f.toLowerCase().replace(/[^a-z]/g, '')} - ${f}`).join('\n')}

<b>Special Commands:</b>
/quantum - Contact QuantumClaw (Lead)
/alert - Send alert to ZeroClaw
/sync - Sync with all bots

<i>Type any command to begin</i>
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
  });

  // Info handler
  bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    
    const infoMessage = `
${config.color} <b>About ${config.name}</b> ${config.color}

<b>Role:</b> ${config.role}
<b>Priority:</b> #${config.priority}
<b>Part of:</b> Flo Faction Bot Network

<b>Description:</b>
${config.description}

<b>Capabilities:</b>
${config.features.map(f => `✓ ${f}`).join('\n')}

<b>Network:</b>
18 bots | Unified Command | Distributed Processing

<i>Flo Faction - Infinite Possibilities</i>
    `;
    
    bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
  });

  // Quantum command - routes to QuantumClaw
  bot.onText(/\/quantum/, (msg) => {
    if (botId === 'quantum') {
      bot.sendMessage(msg.chat.id, `⚛️ <b>QuantumClaw Lead Mode</b>\n\nReady to orchestrate tasks across the Flo Faction bot network.\n\nUse /delegate to assign tasks to other bots.`, { parse_mode: 'HTML' });
    } else {
      bot.sendMessage(msg.chat.id, `🔗 <b>Connecting to QuantumClaw...</b>\n\nUse @QuantumClaw_FloBot for orchestration.`, { parse_mode: 'HTML' });
    }
  });

  // Log all messages
  bot.on('message', (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    
    logger.info({
      event: 'message',
      bot: config.name,
      botId: botId,
      user: msg.from.username || msg.from.first_name,
      userId: msg.from.id,
      chatId: msg.chat.id,
      text: msg.text,
      timestamp: new Date().toISOString()
    });
    
    // Auto-reply for non-command messages
    bot.sendMessage(msg.chat.id, `🤖 I received your message!\n\nFor full functionality, use:\n/start - Introduction\n/help - All commands\n/status - System status\n\n<i>${config.name} at your service</i>`, { parse_mode: 'HTML' });
  });

  logger.info(`Initialized bot: ${config.name} (${botId})`);
});

// Webhook endpoint handler
app.post('/webhook/:botId', (req, res) => {
  const { botId } = req.params;
  const bot = botInstances[botId];
  
  if (!bot) {
    logger.warn(`Webhook received for unknown bot: ${botId}`);
    return res.status(404).json({ error: 'Bot not found' });
  }
  
  // Log webhook receipt
  logger.debug({
    event: 'webhook_received',
    botId: botId,
    timestamp: new Date().toISOString()
  });
  
  // Process webhook update
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Format uptime helper
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Error handling
app.use((err, req, res, next) => {
  logger.error({
    event: 'server_error',
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  logger.info(`========================================`);
  logger.info(`Flo Faction Bot Handler Started`);
  logger.info(`Port: ${PORT}`);
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`========================================`);
  logger.info(`Bots initialized: ${Object.keys(botInstances).length}/18`);
  Object.entries(botInstances).forEach(([id, bot]) => {
    const config = BOT_CONFIG[id];
    logger.info(`  ✓ ${config.name} (#${config.priority}) - ${config.role}`);
  });
  logger.info(`========================================`);
});

module.exports = { app, BOT_CONFIG, botInstances };
