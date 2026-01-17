import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { Redis } from "ioredis";
import { loadConfig, type Config } from "./config.js";
import { createDb, type Database } from "./db/index.js";
import { healthRoutes } from "./routes/health.js";
import { createTaskRunRoutes, createRunRoutes, createTasksRoutes } from "./routes/tasks/index.js";
import { createAgentsRoutes } from "./routes/agents/index.js";
import { createWebhookRoutes } from "./routes/webhooks/index.js";
import { createAuthRoutes } from "./routes/auth/index.js";
import { createApiKeyRoutes } from "./routes/api-keys/index.js";
import { createTeamsRoutes } from "./routes/teams/index.js";
import { createBillingRoutes } from "./routes/billing/index.js";
import { PgTaskRunRepository, PgTaskRepository, PgWebhookRepository, PgAgentRepository, PgUserRepository, PgApiKeyRepository, PgTeamRepository, PgPlanRepository, PgSubscriptionRepository, PgUsageRepository, PgInvoiceRepository } from "./repositories/index.js";
import { RedisStreamService } from "./services/redis-stream.service.js";
import { WebhookDispatcher } from "./services/webhook-dispatcher.js";
import { EventSubscriber } from "./services/event-subscriber.js";
import { StorageService } from "./services/storage.service.js";
import { JwtService } from "./services/jwt.service.js";
import { createAuthMiddleware } from "./middleware/index.js";

export interface AppDependencies {
  config: Config;
  db: Database;
  redis: Redis;
}

export function createApp(deps?: Partial<AppDependencies>) {
  const config = deps?.config ?? loadConfig();
  const db = deps?.db ?? createDb(config.databaseUrl);

  const app = new Hono();

  // Initialize repositories
  const taskRunRepository = new PgTaskRunRepository(db);
  const taskRepository = new PgTaskRepository(db);
  const webhookRepository = new PgWebhookRepository(db);
  const agentRepository = new PgAgentRepository(db);
  const userRepository = new PgUserRepository(db);
  const apiKeyRepository = new PgApiKeyRepository(db);
  const teamRepository = new PgTeamRepository(db);
  const planRepository = new PgPlanRepository(db);
  const subscriptionRepository = new PgSubscriptionRepository(db);
  const usageRepository = new PgUsageRepository(db);
  const invoiceRepository = new PgInvoiceRepository(db);

  // Initialize services
  const streamService = new RedisStreamService(config.redisUrl);
  const webhookDispatcher = new WebhookDispatcher(webhookRepository);
  const storageService = new StorageService();
  const jwtService = new JwtService(config.jwtSecret);

  // Create auth middleware with JWT service and API key repository
  const authMiddleware = createAuthMiddleware(jwtService, apiKeyRepository);

  // Middleware
  app.use("*", logger());
  app.use("*", cors());

  // Auth middleware for protected routes
  app.use("/tasks/*", authMiddleware);
  app.use("/runs/*", authMiddleware);
  app.use("/webhooks/*", authMiddleware);
  app.use("/agents/*", authMiddleware);
  app.use("/api-keys/*", authMiddleware);
  app.use("/teams/*", authMiddleware);
  app.use("/billing/*", authMiddleware);
  app.use("/auth/me", authMiddleware);

  // Routes
  app.route("/", healthRoutes);
  app.route("/auth", createAuthRoutes(userRepository, jwtService));
  app.route("/tasks", createTasksRoutes(taskRepository));
  app.route("/tasks", createTaskRunRoutes(taskRunRepository, streamService));
  app.route("/runs", createRunRoutes(taskRunRepository, streamService, storageService));
  app.route("/webhooks", createWebhookRoutes(webhookRepository, webhookDispatcher));
  app.route("/agents", createAgentsRoutes(agentRepository));
  app.route("/api-keys", createApiKeyRoutes(apiKeyRepository));
  app.route("/teams", createTeamsRoutes(teamRepository));
  app.route("/billing", createBillingRoutes({
    planRepository,
    subscriptionRepository,
    usageRepository,
    invoiceRepository,
  }));

  // 404 handler
  app.notFound((c) => {
    return c.json({ error: "Not Found" }, 404);
  });

  // Error handler
  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal Server Error" }, 500);
  });

  return app;
}

// Start server only when running directly (not in tests)
function startServer() {
  const config = loadConfig();
  const redis = new Redis(config.redisUrl);
  const db = createDb(config.databaseUrl);

  const app = createApp({ config, db, redis });

  // Create event subscriber for webhook integration
  const taskRunRepository = new PgTaskRunRepository(db);
  const webhookRepository = new PgWebhookRepository(db);
  const webhookDispatcher = new WebhookDispatcher(webhookRepository);
  const eventSubscriber = new EventSubscriber(
    config.redisUrl,
    taskRunRepository,
    webhookDispatcher
  );

  // Start event subscriber
  eventSubscriber.start().catch(console.error);

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await eventSubscriber.stop();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await eventSubscriber.stop();
    process.exit(0);
  });

  // Start server
  console.log(`Starting API server on ${config.host}:${config.port}`);
  serve({
    fetch: app.fetch,
    port: config.port,
    hostname: config.host,
  });
}

// Only start if this is the main module
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startServer();
}

export default createApp;
