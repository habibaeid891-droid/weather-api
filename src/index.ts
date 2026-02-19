import express from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Redis } from "@upstash/redis";
import admin from "firebase-admin";


const app = express();
app.use(express.json());

const server = new McpServer({
  name: "weather",
  version: "1.0.0",
});

const NWS_API_BASE = "https://api.weather.gov";
const USER_AGENT = "weather-app/1.0";

// helper
async function makeNWSRequest<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/geo+json",
      },
    });

    if (!response.ok) throw new Error("Request failed");
    return (await response.json()) as T;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// tool
server.tool(
  "get-forecast",
  "Get weather forecast for coordinates",
  {
    latitude: z.number(),
    longitude: z.number(),
  },
  async ({ latitude, longitude }) => {
    const pointsUrl = `${NWS_API_BASE}/points/${latitude},${longitude}`;
    const points = await makeNWSRequest<any>(pointsUrl);

    if (!points?.properties?.forecast) {
      return { content: [{ type: "text", text: "Location not supported" }] };
    }

    const forecast = await makeNWSRequest<any>(
      points.properties.forecast
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(forecast.properties.periods.slice(0, 5), null, 2),
        },
      ],
    };
  }
);

// HTTP transport
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});

await server.connect(transport);

app.post("/mcp", async (req, res) => {
  await transport.handleRequest(req, res, req.body);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`MCP HTTP Server running on port ${PORT}`);
});
