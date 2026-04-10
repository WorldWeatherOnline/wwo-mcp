import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ─── Config ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const BASE_URL = "https://api.worldweatheronline.com/premium/v1";

// ─── CORS middleware ──────────────────────────────────────────────────────────

function corsMiddleware(req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-WWO-Key, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
}

// ─── WWO API helper ───────────────────────────────────────────────────────────

async function callWWO(apiKey, path, params) {
  const url = new URL(`${BASE_URL}/${path}`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("format", "json");
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`WWO API error ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Build MCP server (one per request, apiKey captured in closure) ───────────

function buildMcpServer(apiKey) {
  const server = new McpServer({
    name: "world-weather-online",
    version: "1.0.0",
    description:
      "Real-time weather, forecasts, historical data, marine, ski, astronomy and timezone data — World Weather Online.",
  });

  // ── get_weather ─────────────────────────────────────────────────────────────
  server.tool(
    "get_weather",
    "Get current weather and up to 14-day forecast for any location. Includes temperature, wind, precipitation, humidity, UV index, and optionally air quality and weather alerts.",
    {
      location: z.string().describe(
        "Location. Examples: 'London,UK', 'New York,NY', '48.85,2.35', 'SW1A', '90210'"
      ),
      days: z.number().int().min(1).max(14).default(3).describe(
        "Forecast days (1-14). Default 3."
      ),
      interval: z.enum(["1", "3", "6", "12", "24"]).default("3").describe(
        "Hourly interval. Default 3."
      ),
      include_air_quality: z.boolean().default(false).describe(
        "Include CO, O3, NO2, PM2.5, PM10, EPA/DEFRA indices."
      ),
      include_alerts: z.boolean().default(false).describe(
        "Include government weather alerts."
      ),
    },
    async ({ location, days, interval, include_air_quality, include_alerts }) => {
      try {
        const data = await callWWO(apiKey, "weather.ashx", {
          q: location, num_of_days: days, tp: interval,
          aqi: include_air_quality ? "yes" : "no",
          alerts: include_alerts ? "yes" : "no",
          includelocation: "yes",
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_historical_weather ──────────────────────────────────────────────────
  server.tool(
    "get_historical_weather",
    "Get historical weather for any location from July 2008 onwards. Up to 30-day date ranges with hourly breakdowns.",
    {
      location: z.string().describe("Location. Examples: 'Paris,France', '51.5,-0.12'"),
      start_date: z.string().describe("Start date yyyy-MM-dd. From 2008-07-01."),
      end_date: z.string().optional().describe("End date yyyy-MM-dd. Max 30-day range."),
      interval: z.enum(["1", "3", "6", "12", "24"]).default("3").describe(
        "Time interval in hours."
      ),
    },
    async ({ location, start_date, end_date, interval }) => {
      try {
        const data = await callWWO(apiKey, "past-weather.ashx", {
          q: location, date: start_date, enddate: end_date,
          tp: interval, includelocation: "yes",
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_marine_weather ──────────────────────────────────────────────────────
  server.tool(
    "get_marine_weather",
    "Get 7-day marine forecasts: swell height, direction, period, water temperature, and tides.",
    {
      location: z.string().describe(
        "Coastal location. Examples: 'Cornwall,UK', '50.1,-5.5', 'Sydney Harbour'"
      ),
      include_tides: z.boolean().default(true).describe("Include tidal high/low data."),
      interval: z.enum(["1", "3", "6", "12", "24"]).default("3"),
    },
    async ({ location, include_tides, interval }) => {
      try {
        const data = await callWWO(apiKey, "marine.ashx", {
          q: location, tide: include_tides ? "yes" : "no", tp: interval,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_ski_weather ─────────────────────────────────────────────────────────
  server.tool(
    "get_ski_weather",
    "Get ski resort forecasts with top, mid, and base elevation breakdowns.",
    {
      location: z.string().describe(
        "Ski resort. Examples: 'Chamonix,France', 'Verbier,Switzerland', 'Aspen,Colorado'"
      ),
      interval: z.enum(["3", "6", "12", "24"]).default("3"),
    },
    async ({ location, interval }) => {
      try {
        const data = await callWWO(apiKey, "ski.ashx", { q: location, tp: interval });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── search_location ─────────────────────────────────────────────────────────
  server.tool(
    "search_location",
    "Autocomplete and search location names. Returns coordinates, country, and region.",
    {
      query: z.string().describe("Partial name. Examples: 'Lond', 'New Y', 'SW1'"),
      max_results: z.number().int().min(1).max(10).default(5),
    },
    async ({ query, max_results }) => {
      try {
        const data = await callWWO(apiKey, "search.ashx", {
          q: query, num_of_results: max_results,
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_astronomy ───────────────────────────────────────────────────────────
  server.tool(
    "get_astronomy",
    "Get sunrise, sunset, moonrise, moonset, moon phase, and moon illumination for any location and date.",
    {
      location: z.string().describe("Location. Examples: 'Edinburgh,UK', '55.95,-3.19'"),
      date: z.string().optional().describe("Date yyyy-MM-dd. Defaults to today."),
    },
    async ({ location, date }) => {
      try {
        const data = await callWWO(apiKey, "astronomy.ashx", { q: location, date });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_timezone ────────────────────────────────────────────────────────────
  server.tool(
    "get_timezone",
    "Get local time, timezone name, and UTC offset for any location worldwide.",
    {
      location: z.string().describe(
        "Location. Examples: 'Tokyo,Japan', 'Los Angeles,CA', '-33.87,151.21'"
      ),
    },
    async ({ location }) => {
      try {
        const data = await callWWO(apiKey, "tz.ashx", { q: location });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  // ── get_climate_averages ────────────────────────────────────────────────────
  server.tool(
    "get_climate_averages",
    "Get monthly climate averages (12-year average): min/max temperatures, rainfall, snow days, fog days, UV index. Ideal for travel planning.",
    {
      location: z.string().describe(
        "Location. Examples: 'Barcelona,Spain', 'Cape Town,South Africa'"
      ),
    },
    async ({ location }) => {
      try {
        const data = await callWWO(apiKey, "weather.ashx", {
          q: location, fx: "no", cc: "no", mca: "yes",
        });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: e.message }] };
      }
    }
  );

  return server;
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use(corsMiddleware);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "World Weather Online MCP Server",
    version: "1.0.0",
    signup: "https://www.worldweatheronline.com/weather-api/",
    usage: "Connect to /mcp?key=YOUR_API_KEY",
  });
});

// MCP endpoint — Streamable HTTP
app.post("/mcp", async (req, res) => {
  const apiKey =
    req.query.key ||
    req.headers["x-wwo-key"] ||
    null;

  if (!apiKey) {
    return res.status(401).json({
      error: "Missing API key",
      message: "Get a free key at https://www.worldweatheronline.com/weather-api/",
      usage: "Connect to /mcp?key=YOUR_API_KEY",
    });
  }

  try {
    const server = buildMcpServer(apiKey);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless — no session tracking needed
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (e) {
    console.error("MCP error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e.message });
    }
  }
});

// GET /mcp — required by MCP spec for session resumption (return 405 for stateless)
app.get("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed. Use POST /mcp" });
});

// DELETE /mcp — required by MCP spec (return 405 for stateless)
app.delete("/mcp", (req, res) => {
  res.status(405).json({ error: "Method not allowed." });
});

// Root
app.get("/", (req, res) => {
  res.type("text").send([
    "World Weather Online MCP Server",
    "",
    "Connect AI agents to real-time global weather data.",
    "",
    "USAGE",
    "  POST /mcp?key=YOUR_API_KEY",
    "",
    "GET YOUR FREE API KEY",
    "  https://www.worldweatheronline.com/weather-api/",
    "",
    "AVAILABLE TOOLS",
    "  get_weather, get_historical_weather, get_marine_weather,",
    "  get_ski_weather, search_location, get_astronomy,",
    "  get_timezone, get_climate_averages",
  ].join("\n"));
});

// Start
app.listen(PORT, () => {
  console.log(`WWO MCP Server running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`MCP:    http://localhost:${PORT}/mcp?key=YOUR_API_KEY`);
});
