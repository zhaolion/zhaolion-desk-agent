import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";

const config = loadConfig();
const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/", healthRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Internal Server Error" }, 500);
});

// Start server
console.log(`Starting API server on ${config.host}:${config.port}`);
serve({
  fetch: app.fetch,
  port: config.port,
  hostname: config.host,
});
