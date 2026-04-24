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
// LLM Integration - Free Tier Providers with Failover
// ============================================================
const LLM_CONFIG = {
  providers: [
    {
      name: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile',
      maxTokens: 4096,
      contextWindow: 32768
    },
    {
      name: 'openai-compatible',
      baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4.1-nano',
      maxTokens: 4096,
      contextWindow: 128000
    }
  ],
  compaction: {
    reserveTokensFloor: 6000,
    maxConversationTokens: 24000,
    compactAfterMessages: 20
  }
};

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
      const response = await fetch(provider.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.apiKey}`
        },
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

// Start server
app.listen(PORT, () => {
  logger.info(`========================================`);
  logger.info(`Flo Faction Bot Handler v2.0 Started`);
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
});

module.exports = { app, BOT_CONFIG, botInstances };
