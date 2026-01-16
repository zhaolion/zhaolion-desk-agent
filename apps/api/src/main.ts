import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRunRoutes, createRunRoutes, createTasksRoutes } from "./routes/tasks/index.js";
import { createAgentsRoutes } from "./routes/agents/index.js";
import { createWebhookRoutes } from "./routes/webhooks/index.js";
import { RedisTaskRunRepository, RedisTaskRepository, RedisWebhookRepository, RedisAgentRepository } from "./repositories/index.js";
import { RedisStreamService } from "./services/redis-stream.service.js";
import { WebhookDispatcher } from "./services/webhook-dispatcher.js";
import { authMiddleware } from "./middleware/index.js";

const config = loadConfig();
const app = new Hono();

// Initialize dependencies
const redis = new Redis(config.redisUrl);
const taskRunRepository = new RedisTaskRunRepository(redis);
const taskRepository = new RedisTaskRepository(redis);
const webhookRepository = new RedisWebhookRepository(redis);
const agentRepository = new RedisAgentRepository(redis);
const streamService = new RedisStreamService(config.redisUrl);
const webhookDispatcher = new WebhookDispatcher(webhookRepository);

// Middleware
app.use("*", logger());
app.use("*", cors());

// Auth middleware for protected routes
app.use("/tasks/*", authMiddleware);
app.use("/runs/*", authMiddleware);
app.use("/webhooks/*", authMiddleware);
app.use("/agents/*", authMiddleware);

// Routes
app.route("/", healthRoutes);
app.route("/tasks", createTasksRoutes(taskRepository));
app.route("/tasks", createTaskRunRoutes(taskRunRepository, streamService));
app.route("/runs", createRunRoutes(taskRunRepository, streamService));
app.route("/webhooks", createWebhookRoutes(webhookRepository, webhookDispatcher));
app.route("/agents", createAgentsRoutes(agentRepository));

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
