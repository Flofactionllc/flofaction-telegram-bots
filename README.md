# 🤖 Flo Faction Telegram Bot Handler

**18 Telegram Bots. One Express Server. Render Deployed.**

A unified webhook handler for the Flo Faction bot network, designed to run on Render's free tier.

## 🌐 Live Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check for all 18 bots |
| `GET /bot-status` | Detailed bot configuration status |
| `GET /` | API documentation |
| `POST /webhook/:botId` | Telegram webhook receiver |

## 🤖 Bot Roster

| # | Bot | Role | Emoji |
|---|-----|------|-------|
| 1 | **QuantumClaw** | Lead orchestrator / task router | 🟣 |
| 2 | **ZeroClaw** | System monitor / health checker | ⚫ |
| 3 | **GigaClaw** | Content generation / marketing | 🟢 |
| 4 | **FloFactionGrant** | Grant research / funding | 💰 |
| 5 | **TerraClaw** | Real estate / property | 🏠 |
| 6 | **FloFactionHackathon** | Dev challenges / hackathons | 💻 |
| 7 | **UltraClaw** | Insurance quoting | 🛡️ |
| 8 | **AlphaClaw** | Financial analysis / trading | 📈 |
| 9 | **NinjaClaw** | Security scanning | 🥷 |
| 10 | **NemoClaw** | Music / sync licensing | 🎵 |
| 11 | **DojoClaw** | Training / onboarding | 🥋 |
| 12 | **MegaClaw** | Data aggregation | 📊 |
| 13 | **OpenClaw** | Main Flo Faction assistant | 🐾 |
| 14 | **NanoClaw** | Micro-task automation | ⚡ |
| 15 | **NanoClawios** | iOS/mobile automation | 📱 |
| 16 | **MicroClaw** | API integration | 🔗 |
| 17 | **OmegaClaw** | Backup / disaster recovery | 🔁 |
| 18 | **FloFactionOpenClaw** | Open source manager | 🌐 |

## 🚀 Quick Deploy to Render

### 1. Fork/Create Repository

Push these files to a GitHub repository:

```bash
git init
git add .
git commit -m "Initial Flo Faction bots deployment"
git push origin main
```

### 2. Create Render Service

**Option A: Deploy from Dashboard**
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Select **Node** runtime
5. Configure:
   - **Name**: `flofaction-bots`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

**Option B: Deploy with render.yaml (Blueprints)**
1. Push `render.yaml` to your repo
2. On Render dashboard, click "Blueprints"
3. Connect repo → Render reads `render.yaml`

### 3. Set Environment Variables

In Render Dashboard → Service → Environment:

```
QUANTUM_CLAW_TOKEN=8720815792:AAFXRMXVJW1MEzKlK4QZbq6XHAford5F9hY
ZERO_CLAW_TOKEN=8659052007:AAEEqll4OnOr0bC2Nk2HeDCAnHdLIsZLcVE
GIGA_CLAW_TOKEN=8348155508:AAGCizRPr5Txqf89iJwY6IzMqTwHo7errqE
FLOFACTION_GRANT_TOKEN=8770039909:AAHrXNP4zmCOMYD2iYbdxxJNSmfTCqdi7Ds
TERRA_CLAW_TOKEN=8551301025:AAFMOGQ3Q4Jgw27EqX9q4IwKpckGhOUsxEs
FLOFACTION_HACKATHON_TOKEN=8225502384:AAHEPdMdkgXZfk-d6Uy-tVITody8alhXaYM
ULTRA_CLAW_TOKEN=8773061553:AAEEMbidlizlvRA7GzDaQDpUT5DeMDgE0dE
ALPHA_CLAW_TOKEN=8682992408:AAEKw5CZ0Pv86UQFTXju52-S3d0icnr_EVs
NINJA_CLAW_TOKEN=8339233462:AAEbXq-iJEg5zZhrRSn21zaF-okFW3BBO2M
NEMO_CLAW_TOKEN=8723331240:AAGnvFHz32CNwu2_TCwFEQoXhBMl8ILxH0Y
DOJO_CLAW_TOKEN=8711112650:AAHkKMuR6T35Fj9coVNm_ZLHKl8ZOwf8Rro
MEGA_CLAW_TOKEN=8706490401:AAFrwMDl94xuWkRXqanQN7QIWO-rq2kPuk4
OPEN_CLAW_TOKEN=8509164034:AAFq6wihzqyrX4CmISBtRGWHCDCPcBf0zgw
NANO_CLAW_TOKEN=8599512507:AAHtFRkR5J1rohf_Z1Cfn9hIhitRt95MdRw
NANO_CLAW_IOS_TOKEN=8760478007:AAGzv-JTmQnrGZ0WhzKE9BXMjOTQ5OlRO2I
MICRO_CLAW_TOKEN=8630096336:AAFu6di5s3A8KLLCNAA-k9OIZODUm0GwJeM
OMEGA_CLAW_TOKEN=8417796719:AAESCK8qN5EdBaftFD47bq6-GRz4bOti_tI
FLOFACTION_OPEN_CLAW_TOKEN=8254269964:AAH_pOE1VqqUFU2EtVa_xOrOK0KbCRoGUtg
```

### 4. Register Webhooks

Once deployed, register webhooks for all bots:

**Via Render Shell:**
```bash
npm run setup-webhooks
```

**Or locally (after setting BASE_URL):**
```bash
export BASE_URL=https://your-app.onrender.com
npm run setup-webhooks
```

**Or manually per bot:**
```bash
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://your-app.onrender.com/webhook/{botId}"}'
```

## 📁 Project Structure

```
flofaction-bots/
├── server.js              # Main Express server
├── package.json           # Dependencies
├── render.yaml            # Render deployment config
├── Dockerfile             # Container config
├── .env.example           # Environment template
├── README.md             # You are here
├── scripts/
│   ├── setup-webhooks.js  # Webhook registration
│   └── test-bots.js       # Connectivity test
└── logs/
    └── *.log              # Runtime logs
```

## 🛠️ Local Development

```bash
# Clone the repository
git clone <your-repo>
cd flofaction-bots

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your bot tokens

# Set base URL (for webhooks - use ngrok for local testing)
npx ngrok http 3000
export BASE_URL=https://your-ngrok-url.ngrok.io

# Start server
npm run dev

# In another terminal, setup webhooks
npm run setup-webhooks

# Test bot connectivity
npm test
```

## 🔐 Security

- All tokens stored as Render environment variables
- Rate limiting: 100 requests/15min per IP
- Helmet.js for security headers
- CORS enabled
- No tokens logged to console

## 📊 Monitoring

- **Health Check**: `GET /health`
- **Logs**: Render dashboard → Logs
- **Uptime**: Render dashboard → Metrics

## 🔄 Webhook Flow

```
User Messages Bot → Telegram → POST /webhook/:botId → Express Handler → Bot Response
```

Each bot has dedicated webhook route:
- `/webhook/quantum` → QuantumClaw
- `/webhook/zero` → ZeroClaw
- etc.

## 📝 Bot Commands

All bots support:

| Command | Description |
|---------|-------------|
| `/start` | Welcome message with bot info |
| `/status` | System health/status |
| `/help` | List available commands |
| `/info` | Detailed bot information |
| `/quantum` | Contact lead orchestrator |

## 🐛 Troubleshooting

**Bot not responding?**
```bash
# Check webhook is set
curl "https://api.telegram.org/bot{TOKEN}/getWebhookInfo"

# Check health
https://your-app.onrender.com/health

# Test bot directly
https://api.telegram.org/bot{TOKEN}/getMe
```

**Webhook errors?**
- Ensure BASE_URL is correct (must be HTTPS for production)
- Check Render service is running
- Verify token is correct
- Check logs in Render dashboard

## 📦 Render Free Tier Limits

- 512 MB RAM
- 0.1 CPU
- 750 hours/month uptime
- Web services sleep after 15 min inactivity
- Auto-wakes on request (cold start ~30s)

**Note**: For 18 active bots, consider:
- Upgrading to Starter plan ($7/month) for always-on
- Or setup ping service to keep alive

## 🚀 Future Enhancements

- [ ] Bot-to-bot communication via internal API
- [ ] Task queue (Redis/Bull)
- [ ] Analytics dashboard
- [ ] Bot performance metrics
- [ ] Automated health checks
- [ ] Backup/restore bot configs

## 📜 License

MIT - Flo Faction

---

**Flo Faction - Infinite Possibilities** 🐾
