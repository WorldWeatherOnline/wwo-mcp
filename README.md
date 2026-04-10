# World Weather Online — MCP Server (Railway)

MCP server for World Weather Online. Lets AI assistants like Claude, Cursor,
and others call WWO weather data directly as tools.

## Deploy to Railway

### Step 1 — Push to GitHub

1. Create a new repository on github.com (call it `wwo-mcp-server`)
2. Open Terminal in this folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/wwo-mcp-server.git
git push -u origin main
```

### Step 2 — Deploy on Railway

1. Go to https://railway.app and sign up / log in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `wwo-mcp-server` repository
4. Railway detects Node.js automatically and deploys

Your server will be live at a URL like:
```
https://wwo-mcp-server-production.up.railway.app
```

### Step 3 — Add Custom Domain

1. In Railway dashboard → your project → **Settings** → **Networking** → **Custom Domain**
2. Type `mcp.worldweatheronline.com` and click **Add**
3. Railway shows you a CNAME value like:
   ```
   wwo-mcp-server-production.up.railway.app
   ```
4. Go to your DNS provider and add:

   | Type  | Name | Value                                          |
   |-------|------|------------------------------------------------|
   | CNAME | mcp  | wwo-mcp-server-production.up.railway.app       |

5. SSL certificate is provisioned automatically within minutes

### Step 4 — Test

Visit your health endpoint:
```
https://mcp.worldweatheronline.com/health
```

Test in MCP Inspector:
```
https://mcp.worldweatheronline.com/mcp?key=YOUR_WWO_API_KEY
```

---

## Connecting AI Clients

### Claude Desktop
Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "world-weather-online": {
      "url": "https://mcp.worldweatheronline.com/mcp?key=YOUR_API_KEY"
    }
  }
}
```

### Cursor / Windsurf
Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "world-weather-online": {
      "url": "https://mcp.worldweatheronline.com/mcp?key=YOUR_API_KEY"
    }
  }
}
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `get_weather` | Current conditions + 14-day forecast |
| `get_historical_weather` | Past weather from 2008 onwards |
| `get_marine_weather` | Swell, tides, water temperature |
| `get_ski_weather` | Top/mid/base elevation forecasts |
| `search_location` | Location autocomplete |
| `get_astronomy` | Sunrise, sunset, moon phase |
| `get_timezone` | Local time + UTC offset |
| `get_climate_averages` | Monthly 12-year climate averages |

---

## Local Development

```bash
npm install
npm run dev
```

Server runs at `http://localhost:3000`
