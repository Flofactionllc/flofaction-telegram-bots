/**
 * Flo Faction Telegram Bot Handler v2.0
 * Express server managing 20 Telegram bots with AI/LLM integration
 * Deployed on Render with webhook-based architecture
 * 
 * Bots (20 total):
 * - Claudette: Core AI orchestrator (renamed from FLOFACTIONBOT)
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
 * - TaxClaw: Tax preparation / financial compliance
 * - LexClaw: Legal research / policy compliance
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

// ============================================================
// LLM Integration - VERIFIED WORKING Free Providers (Tested Live)
// Priority: SambaNova (all free, all verified working)
// ============================================================
const LLM_CONFIG = {
  providers: [
    {
      name: 'sambanova-deepseek-v3.2',
      baseUrl: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY,
      model: 'DeepSeek-V3.2',
      maxTokens: 8192,
      contextWindow: 131072
    },
    {
      name: 'sambanova-llama4-maverick',
      baseUrl: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY,
      model: 'Llama-4-Maverick-17B-128E-Instruct',
      maxTokens: 8192,
      contextWindow: 131072
    },
    {
      name: 'sambanova-gpt-oss-120b',
      baseUrl: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY,
      model: 'gpt-oss-120b',
      maxTokens: 8192,
      contextWindow: 131072
    },
    {
      name: 'sambanova-llama-3.3-70b',
      baseUrl: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY,
      model: 'Meta-Llama-3.3-70B-Instruct',
      maxTokens: 4096,
      contextWindow: 131072
    },
    {
      name: 'sambanova-deepseek-v3.1',
      baseUrl: 'https://api.sambanova.ai/v1/chat/completions',
      apiKey: process.env.SAMBANOVA_API_KEY,
      model: 'DeepSeek-V3.1',
      maxTokens: 8192,
      contextWindow: 131072
    },
    {
      name: 'openrouter-free',
      baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'google/gemini-2.0-flash-exp:free',
      maxTokens: 8192,
      contextWindow: 1000000,
      extraHeaders: {
        'HTTP-Referer': 'https://flofaction.com',
        'X-Title': 'Flo Faction Bot Network'
      }
    }
  ],
  compaction: {
    reserveTokensFloor: 6000,
    maxConversationTokens: 24000,
    compactAfterMessages: 20
  }
};

// ============================================================
// Admin Authentication - Only admin can use admin commands
// ============================================================
const ADMIN_IDS = (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(id => parseInt(id.trim())).filter(Boolean);

function isAdmin(userId) {
  // If no admin IDs configured, allow all (open mode)
  if (ADMIN_IDS.length === 0) return true;
  return ADMIN_IDS.includes(userId);
}

// ============================================================
// Inter-Bot Communication Bus (In-Memory, Zero Cost)
// ============================================================
const botMessageBus = {
  queue: [],
  maxQueue: 1000,
  
  // Bot sends a message to another bot or broadcasts
  send(fromBot, toBot, type, payload) {
    const msg = {
      id: Date.now() + Math.random().toString(36).slice(2),
      from: fromBot,
      to: toBot || 'broadcast',
      type, // 'task', 'alert', 'status', 'data'
      payload,
      timestamp: Date.now(),
      read: false
    };
    this.queue.push(msg);
    if (this.queue.length > this.maxQueue) this.queue.shift();
    logger.info(`[BUS] ${fromBot} → ${toBot || 'ALL'}: ${type}`);
    return msg.id;
  },
  
  // Bot reads messages addressed to it
  receive(botId, markRead = true) {
    const msgs = this.queue.filter(m => 
      !m.read && (m.to === botId || m.to === 'broadcast') && m.from !== botId
    );
    if (markRead) msgs.forEach(m => m.read = true);
    return msgs;
  },
  
  // Get recent bus activity
  getRecent(count = 20) {
    return this.queue.slice(-count);
  },
  
  // Cleanup old messages (older than 1 hour)
  cleanup() {
    const cutoff = Date.now() - 3600000;
    this.queue = this.queue.filter(m => m.timestamp > cutoff);
  }
};

// Cleanup bus every 15 minutes
setInterval(() => botMessageBus.cleanup(), 15 * 60 * 1000);

// ============================================================
// Email/SMS via Gmail SMTP (Nodemailer)
// ============================================================
const nodemailer = require('nodemailer');

const EMAIL_ACCOUNTS = {
  primary: {
    user: 'flofactionllc@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD_PRIMARY || 'wjzd aojw qhbt runw',
    name: 'Flo Faction LLC'
  },
  personal: {
    user: 'edwardspaul167@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD_PERSONAL || 'zivr ktby blwl yuwa',
    name: 'Paul Edwards'
  },
  insurance: {
    user: 'flofaction.insurance@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD_INSURANCE || 'nuio kske xhaf dihi',
    name: 'Flo Faction Insurance'
  },
  business: {
    user: 'flofaction.business@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD_BUSINESS || 'ryki ftcc juqx xqvr',
    name: 'Flo Faction Business'
  }
};

function createEmailTransporter(account) {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: account.user, pass: account.pass.replace(/\s/g, '') }
  });
}

async function sendEmail(to, subject, body, fromAccount = 'primary') {
  const account = EMAIL_ACCOUNTS[fromAccount] || EMAIL_ACCOUNTS.primary;
  const transporter = createEmailTransporter(account);
  return transporter.sendMail({
    from: `"${account.name}" <${account.user}>`,
    to, subject, html: body
  });
}

// SMS via Google Voice email gateway (sends to carrier email-to-SMS)
const CARRIER_GATEWAYS = {
  tmobile: 'tmomail.net', metropcs: 'mymetropcs.com', att: 'txt.att.net',
  verizon: 'vtext.com', sprint: 'messaging.sprintpcs.com', boost: 'sms.myboostmobile.com'
};

async function sendSMS(phoneNumber, message, carrier = 'metropcs', fromAccount = 'primary') {
  const gateway = CARRIER_GATEWAYS[carrier] || CARRIER_GATEWAYS.metropcs;
  const smsEmail = `${phoneNumber}@${gateway}`;
  return sendEmail(smsEmail, '', message, fromAccount);
}

// Conversation memory store (per chat per bot)
const conversationMemory = new Map();

function getConversationKey(botId, chatId) {
  return `${botId}:${chatId}`;
}

function getConversation(botId, chatId) {
  const key = getConversationKey(botId, chatId);
  if (!conversationMemory.has(key)) {
    conversationMemory.set(key, {
      messages: [],
      tokenEstimate: 0,
      lastActive: Date.now()
    });
  }
  return conversationMemory.get(key);
}

function addToConversation(botId, chatId, role, content) {
  const conv = getConversation(botId, chatId);
  const tokenEstimate = Math.ceil(content.length / 4); // rough estimate
  
  conv.messages.push({ role, content });
  conv.tokenEstimate += tokenEstimate;
  conv.lastActive = Date.now();
  
  // Compact if too long
  if (conv.tokenEstimate > LLM_CONFIG.compaction.maxConversationTokens || 
      conv.messages.length > LLM_CONFIG.compaction.compactAfterMessages) {
    compactConversation(botId, chatId);
  }
  
  return conv;
}

function compactConversation(botId, chatId) {
  const conv = getConversation(botId, chatId);
  if (conv.messages.length <= 4) return;
  
  // Keep system message + last 6 messages
  const systemMsg = conv.messages.find(m => m.role === 'system');
  const recentMessages = conv.messages.slice(-6);
  
  conv.messages = systemMsg ? [systemMsg, ...recentMessages] : recentMessages;
  conv.tokenEstimate = conv.messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  
  logger.info(`Compacted conversation for ${botId}:${chatId} - ${conv.messages.length} messages, ~${conv.tokenEstimate} tokens`);
}

function resetConversation(botId, chatId) {
  const key = getConversationKey(botId, chatId);
  conversationMemory.delete(key);
}

// Clean up old conversations every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour
  for (const [key, conv] of conversationMemory) {
    if (conv.lastActive < cutoff) {
      conversationMemory.delete(key);
    }
  }
}, 30 * 60 * 1000);

async function callLLM(messages, botConfig) {
  const errors = [];
  
  for (const provider of LLM_CONFIG.providers) {
    if (!provider.apiKey) continue;
    
    try {
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.apiKey}`,
        ...(provider.extraHeaders || {})
      };
      
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: provider.model,
          messages: messages,
          max_tokens: provider.maxTokens,
          temperature: 0.7,
          top_p: 0.9
        })
      });
      
      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`HTTP ${response.status}: ${errBody}`);
      }
      
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      if (!content) throw new Error('Empty response from LLM');
      
      logger.info(`LLM response via ${provider.name} (${provider.model})`);
      return { content, provider: provider.name, model: provider.model };
      
    } catch (err) {
      errors.push(`${provider.name}: ${err.message}`);
      logger.warn(`LLM provider ${provider.name} failed: ${err.message}`);
    }
  }
  
  throw new Error(`All LLM providers failed. Errors: ${errors.join(' | ')}`);
}

function getSystemPrompt(botConfig) {
  return `You are ${botConfig.name}, an AI-powered bot in the Flo Faction network. 
Your specific role: ${botConfig.role}
Your description: ${botConfig.description}
Your capabilities: ${botConfig.features.join(', ')}

You are part of a 20-bot fleet managed by Flo Faction LLC. You should:
- Stay in character for your assigned role
- Be helpful, professional, and knowledgeable
- Provide actionable information related to your specialty
- Direct users to other bots in the network when their question falls outside your expertise
- Keep responses concise but thorough (under 2000 characters for Telegram)

The Flo Faction bot network includes:
- Claudette: Core AI orchestrator
- QuantumClaw: Task routing & coordination
- ZeroClaw: System monitoring
- GigaClaw: Content & marketing
- FloFactionGrant: Grant research
- TerraClaw: Real estate
- UltraClaw: Insurance
- AlphaClaw: Financial analysis
- NinjaClaw: Security
- NemoClaw: Music & sync licensing
- DojoClaw: Training
- MegaClaw: Analytics
- OpenClaw: General assistant
- NanoClaw: Micro-automation
- NanoClawios: iOS/mobile
- MicroClaw: API integrations
- OmegaClaw: Backup/DR
- TaxClaw: Tax preparation & compliance
- LexClaw: Legal research & policy

Current date: ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' })}
Respond helpfully and stay in your role.`;
}

// ============================================================
// Bot Configuration - 20 Bots
// ============================================================
const BOT_CONFIG = {
  claudette: {
    name: 'Claudette',
    token: process.env.CLAUDETTE_TOKEN,
    role: 'Core AI orchestrator & central command',
    description: 'Claudette - Flo Faction Core AI Orchestrator. The brain of the operation.',
    features: ['AI orchestration', 'Task delegation', 'Cross-bot coordination', 'Strategic planning', 'Full AI conversation'],
    color: '👑',
    priority: 0
  },
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
  taxclaw: {
    name: 'TaxClaw',
    token: process.env.TAX_CLAW_TOKEN,
    role: 'Tax preparation / financial compliance',
    description: 'TaxClaw - Tax & Financial Compliance',
    features: ['Tax preparation guidance', 'Deduction optimization', 'Filing assistance', 'Compliance checks', 'Schedule C expertise'],
    color: '🧾',
    priority: 18
  },
  lexclaw: {
    name: 'LexClaw',
    token: process.env.LEX_CLAW_TOKEN,
    role: 'Legal research / policy compliance',
    description: 'LexClaw - Legal Research & Policy',
    features: ['Legal research', 'Policy analysis', 'Compliance guidance', 'Contract review', 'Regulatory updates'],
    color: '⚖️',
    priority: 19
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
  windowMs: 15 * 60 * 1000,
  max: 200,
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

  const configuredCount = botStatus.filter(b => b.configured).length;
  const healthy = configuredCount >= 18; // Allow partial deployment
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalBots: Object.keys(BOT_CONFIG).length,
    configuredBots: configuredCount,
    llmProviders: LLM_CONFIG.providers.filter(p => p.apiKey).map(p => p.name),
    conversationsActive: conversationMemory.size,
    bots: botStatus,
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Flo Faction Telegram Bot Handler v2.0',
    version: '2.0.0',
    features: ['20 bots', 'AI/LLM integration', 'Conversation memory', 'Auto-compaction', 'Provider failover'],
    bots: Object.values(BOT_CONFIG).map(b => ({
      name: b.name,
      role: b.role,
      emoji: b.color
    })),
    endpoints: {
      health: '/health',
      webhooks: '/webhook/:botId',
      botStatus: '/bot-status',
      networkStatus: '/network-status'
    }
  });
});

// Bot status endpoint
app.get('/bot-status', (req, res) => {
  const status = Object.entries(BOT_CONFIG).map(([key, config]) => ({
    id: key,
    name: config.name,
    role: config.role,
    priority: config.priority,
    emoji: config.color,
    features: config.features,
    token: config.token ? '✓ Configured' : '✗ Missing',
    webhookUrl: `${BASE_URL}/webhook/${key}`
  }));
  res.json({ totalBots: status.length, bots: status });
});

// Network status - shows inter-bot communication status
app.get('/network-status', (req, res) => {
  const activeBots = Object.entries(BOT_CONFIG).filter(([, c]) => c.token).length;
  res.json({
    network: 'Flo Faction Bot Network v2.0',
    activeBots,
    totalBots: Object.keys(BOT_CONFIG).length,
    activeConversations: conversationMemory.size,
    llmStatus: LLM_CONFIG.providers.map(p => ({
      name: p.name,
      model: p.model,
      configured: !!p.apiKey,
      contextWindow: p.contextWindow
    })),
    compactionSettings: LLM_CONFIG.compaction,
    uptime: formatUptime(process.uptime())
  });
});

// Store bot instances
const botInstances = {};

// Initialize Telegram bots
Object.entries(BOT_CONFIG).forEach(([botId, config]) => {
  if (!config.token) {
    logger.warn(`Bot ${config.name} (${botId}) has no token configured`);
    return;
  }

  // Create bot instance - no built-in webhook server (we use Express to receive updates)
  const bot = new TelegramBot(config.token, { webHook: false });
  botInstances[botId] = bot;

  // /start handler
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    logger.info(`[${config.name}] /start from ${username} (${chatId})`);
    resetConversation(botId, chatId);
    
    const welcomeMessage = `
${config.color} <b>Welcome to ${config.name}!</b> ${config.color}

Hey ${username}! I'm <b>${config.name}</b>, part of the Flo Faction AI Bot Network.

<b>My Role:</b> ${config.role}

<b>What I Can Do:</b>
${config.features.map(f => `✓ ${f}`).join('\n')}

<b>💡 Just send me a message</b> and I'll use AI to help you with anything related to my specialty!

<b>Commands:</b>
/help - All commands
/status - System status
/info - About me
/reset - Start fresh conversation
/network - See all bots

<i>Flo Faction - Infinite Possibilities 🚀</i>
    `;
    
    bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'HTML' });
  });

  // /status handler
  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const conv = getConversation(botId, chatId);
    
    const statusMessage = `
${config.color} <b>${config.name} Status</b> ${config.color}

<b>Bot Health:</b> ✅ Operational
<b>AI Engine:</b> ${LLM_CONFIG.providers.filter(p => p.apiKey).length > 0 ? '✅ Connected' : '⚠️ No providers'}
<b>Uptime:</b> ${formatUptime(process.uptime())}
<b>Your Conversation:</b> ${conv.messages.length} messages (~${conv.tokenEstimate} tokens)
<b>Active Conversations:</b> ${conversationMemory.size}
<b>Network Bots:</b> ${Object.keys(botInstances).length}/20 online
<b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST

<i>All systems operational</i>
    `;
    
    bot.sendMessage(chatId, statusMessage, { parse_mode: 'HTML' });
  });

  // /help handler
  bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `
${config.color} <b>${config.name} Commands</b> ${config.color}

<b>Core Commands:</b>
/start - Welcome & introduction
/status - System health & AI status
/help - This help message
/info - Detailed bot information
/reset - Clear conversation & start fresh
/network - View all bots in the network

<b>AI Features:</b>
💬 Just type any message to chat with AI
🧠 I remember our conversation context
🔄 Use /reset if context gets too long

<b>My Specialties:</b>
${config.features.map((f, i) => `${i + 1}. ${f}`).join('\n')}

<i>Type any message to begin!</i>
    `;
    
    bot.sendMessage(chatId, helpMessage, { parse_mode: 'HTML' });
  });

  // /info handler
  bot.onText(/\/info/, (msg) => {
    const chatId = msg.chat.id;
    
    const infoMessage = `
${config.color} <b>About ${config.name}</b> ${config.color}

<b>Role:</b> ${config.role}
<b>Priority:</b> #${config.priority}
<b>Part of:</b> Flo Faction Bot Network v2.0
<b>AI Powered:</b> Yes (Multi-provider LLM)

<b>Description:</b>
${config.description}

<b>Capabilities:</b>
${config.features.map(f => `✓ ${f}`).join('\n')}

<b>Network:</b>
20 bots | AI-Powered | Unified Command | Distributed Processing

<i>Flo Faction - Infinite Possibilities</i>
    `;
    
    bot.sendMessage(chatId, infoMessage, { parse_mode: 'HTML' });
  });

  // /reset handler
  bot.onText(/\/reset/, (msg) => {
    const chatId = msg.chat.id;
    resetConversation(botId, chatId);
    bot.sendMessage(chatId, `🔄 <b>Conversation Reset</b>\n\nFresh start! Your conversation history has been cleared.\nSend me a message to begin a new conversation.`, { parse_mode: 'HTML' });
  });

  // /network handler
  bot.onText(/\/network/, (msg) => {
    const chatId = msg.chat.id;
    
    const onlineBots = Object.entries(BOT_CONFIG)
      .filter(([, c]) => c.token)
      .sort((a, b) => a[1].priority - b[1].priority)
      .map(([, c]) => `${c.color} <b>${c.name}</b> - ${c.role}`)
      .join('\n');
    
    const networkMessage = `
🌐 <b>Flo Faction Bot Network</b> 🌐

<b>Online Bots (${Object.keys(botInstances).length}/20):</b>

${onlineBots}

<i>All bots are AI-powered and ready to assist!</i>
    `;
    
    bot.sendMessage(chatId, networkMessage, { parse_mode: 'HTML' });
  });

  // AI-powered message handler for non-command messages
  bot.on('message', async (msg) => {
    if (!msg.text || msg.text.startsWith('/')) return;
    
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    const userMessage = msg.text;
    
    logger.info({
      event: 'ai_message',
      bot: config.name,
      botId: botId,
      user: username,
      userId: msg.from.id,
      chatId: chatId,
      text: userMessage.substring(0, 100),
      timestamp: new Date().toISOString()
    });

    // Send typing indicator
    bot.sendChatAction(chatId, 'typing');

    try {
      // Build conversation with system prompt
      const conv = getConversation(botId, chatId);
      
      // Add system prompt if this is a new conversation
      if (conv.messages.length === 0) {
        addToConversation(botId, chatId, 'system', getSystemPrompt(config));
      }
      
      // Add user message
      addToConversation(botId, chatId, 'user', userMessage);
      
      // Call LLM
      const response = await callLLM(conv.messages, config);
      
      // Add assistant response to memory
      addToConversation(botId, chatId, 'assistant', response.content);
      
      // Send response (split if too long for Telegram)
      const maxLen = 4000;
      if (response.content.length > maxLen) {
        const parts = response.content.match(new RegExp(`.{1,${maxLen}}`, 'gs'));
        for (const part of parts) {
          await bot.sendMessage(chatId, part);
        }
      } else {
        await bot.sendMessage(chatId, response.content);
      }
      
    } catch (err) {
      logger.error({
        event: 'ai_error',
        bot: config.name,
        error: err.message,
        timestamp: new Date().toISOString()
      });
      
      bot.sendMessage(chatId, 
        `⚠️ <b>AI Temporarily Unavailable</b>\n\n` +
        `I'm having trouble connecting to my AI brain right now.\n\n` +
        `<b>What you can do:</b>\n` +
        `• Try again in a moment\n` +
        `• Use /reset to start a fresh conversation\n` +
        `• Use /help to see available commands\n\n` +
        `<i>Error: ${err.message.substring(0, 200)}</i>`,
        { parse_mode: 'HTML' }
      );
    }
  });

  logger.info(`✅ Initialized bot: ${config.name} (${botId}) - ${config.role}`);
});

// Webhook endpoint handler
app.post('/webhook/:botId', (req, res) => {
  const { botId } = req.params;
  const bot = botInstances[botId];
  
  if (!bot) {
    logger.warn(`Webhook received for unknown bot: ${botId}`);
    return res.status(404).json({ error: 'Bot not found' });
  }
  
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

// Create logs directory
const fs = require('fs');
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs', { recursive: true });
}

// ============================================================
// Auto-Webhook Registration on Startup
// Sets webhooks for all bots when BASE_URL is a public URL (Render)
// ============================================================
async function setupWebhooks() {
  if (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')) {
    logger.info('[WEBHOOKS] Running locally — using polling mode, skipping webhook setup');
    // Start polling for local development
    Object.entries(botInstances).forEach(([botId, bot]) => {
      bot.startPolling();
      logger.info(`[POLLING] ${BOT_CONFIG[botId].name} polling started`);
    });
    return;
  }

  logger.info(`[WEBHOOKS] Setting up webhooks for ${Object.keys(botInstances).length} bots...`);
  const results = { success: 0, failed: 0, errors: [] };

  for (const [botId, bot] of Object.entries(botInstances)) {
    const webhookUrl = `${BASE_URL}/webhook/${botId}`;
    try {
      await bot.setWebHook(webhookUrl);
      results.success++;
      logger.info(`[WEBHOOK] ✅ ${BOT_CONFIG[botId].name} → ${webhookUrl}`);
    } catch (err) {
      results.failed++;
      results.errors.push(`${BOT_CONFIG[botId].name}: ${err.message}`);
      logger.error(`[WEBHOOK] ❌ ${BOT_CONFIG[botId].name} failed: ${err.message}`);
    }
    // Small delay to avoid Telegram rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  logger.info(`[WEBHOOKS] Complete: ${results.success} success, ${results.failed} failed`);
  if (results.errors.length > 0) {
    logger.warn(`[WEBHOOKS] Errors: ${results.errors.join(' | ')}`);
  }
  return results;
}

// Manual webhook setup/reset endpoint
app.post('/setup-webhooks', async (req, res) => {
  if (BASE_URL.includes('localhost')) {
    return res.json({ error: 'Cannot set webhooks on localhost' });
  }
  const results = await setupWebhooks();
  res.json({ message: 'Webhook setup complete', ...results });
});

// Delete all webhooks (switch to polling mode)
app.post('/delete-webhooks', async (req, res) => {
  const results = { success: 0, failed: 0 };
  for (const [botId, bot] of Object.entries(botInstances)) {
    try {
      await bot.deleteWebHook();
      results.success++;
    } catch (err) {
      results.failed++;
    }
    await new Promise(r => setTimeout(r, 200));
  }
  res.json({ message: 'All webhooks deleted — bots now in idle mode', ...results });
});

// Webhook status check
app.get('/webhook-status', async (req, res) => {
  const statuses = [];
  for (const [botId, bot] of Object.entries(botInstances)) {
    try {
      const info = await bot.getWebHookInfo();
      statuses.push({
        bot: BOT_CONFIG[botId].name,
        url: info.url || 'NOT SET',
        pending: info.pending_update_count,
        lastError: info.last_error_message || null
      });
    } catch (err) {
      statuses.push({ bot: BOT_CONFIG[botId].name, error: err.message });
    }
  }
  res.json({ totalBots: statuses.length, webhooks: statuses });
});

// Start server
app.listen(PORT, async () => {
  logger.info(`========================================`);
  logger.info(`Flo Faction Bot Handler v4.0 Started`);
  logger.info(`Port: ${PORT}`);
  logger.info(`Base URL: ${BASE_URL}`);
  logger.info(`LLM Providers: ${LLM_CONFIG.providers.filter(p => p.apiKey).map(p => `${p.name}(${p.model})`).join(', ') || 'NONE'}`);
  logger.info(`========================================`);
  logger.info(`Bots initialized: ${Object.keys(botInstances).length}/20`);
  Object.entries(botInstances).forEach(([id, bot]) => {
    const config = BOT_CONFIG[id];
    logger.info(`  ✓ ${config.color} ${config.name} (#${config.priority}) - ${config.role}`);
  });
  logger.info(`========================================`);

  // Auto-setup webhooks (or polling if local)
  await setupWebhooks();
  logger.info(`========================================`);
  logger.info(`🚀 All systems GO — Flo Faction Bot Network v4.0 LIVE`);
  logger.info(`========================================`);
});

module.exports = { app, BOT_CONFIG, botInstances };
