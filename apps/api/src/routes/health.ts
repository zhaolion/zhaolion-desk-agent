import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

healthRoutes.get("/health/ready", (c) => {
  // TODO: Check database and redis connections
  return c.json({
    status: "ok",
    checks: {
      database: "ok",
      redis: "ok",
    },
  });
});
