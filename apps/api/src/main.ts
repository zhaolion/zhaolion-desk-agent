import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRunRoutes, createRunRoutes } from "./routes/tasks/index.js";
import { RedisTaskRunRepository } from "./repositories/index.js";
import { RedisStreamService } from "./services/redis-stream.service.js";

const config = loadConfig();
const app = new Hono();

// Initialize dependencies
const redis = new Redis(config.redisUrl);
const taskRunRepository = new RedisTaskRunRepository(redis);
const streamService = new RedisStreamService(config.redisUrl);

// Middleware
app.use("*", logger());
app.use("*", cors());

// Routes
app.route("/", healthRoutes);
app.route("/tasks", createTaskRunRoutes(taskRunRepository, streamService));
app.route("/runs", createRunRoutes(taskRunRepository, streamService));

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
