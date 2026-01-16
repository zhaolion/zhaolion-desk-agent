import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import type { TaskRunRepository, TaskStreamService } from "@desk-agent/domain/task";
import type { TaskRun } from "@desk-agent/domain";
import { createTaskRunSchema } from "./schemas.js";

// Temporary mock - will be replaced with auth middleware
const MOCK_USER_ID = "user-123";
const MOCK_AGENT_ID = "agent-123";

export function createTaskRunRoutes(
  repository: TaskRunRepository,
  streamService: TaskStreamService
): Hono {
  const routes = new Hono();

  // POST /tasks/:id/runs - Create a new task run
  routes.post(
    "/:id/runs",
    zValidator("json", createTaskRunSchema),
    async (c) => {
      const taskId = c.req.param("id");
      const body = c.req.valid("json");

      const taskRun = await repository.create({
        taskId,
        userId: MOCK_USER_ID,
        agentId: MOCK_AGENT_ID,
        prompt: body.prompt,
        variables: body.variables,
      });

      // Enqueue for processing
      await streamService.enqueueTask(taskRun);

      return c.json(serializeTaskRun(taskRun), 201);
    }
  );

  return routes;
}

export function createRunRoutes(
  repository: TaskRunRepository,
  streamService: TaskStreamService
): Hono {
  const routes = new Hono();

  // GET /runs/:runId - Get task run by ID
  routes.get("/:runId", async (c) => {
    const runId = c.req.param("runId");

    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    return c.json(serializeTaskRun(taskRun));
  });

  // GET /runs/:runId/events - SSE stream
  routes.get("/:runId/events", async (c) => {
    const runId = c.req.param("runId");

    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    return streamSSE(c, async (stream) => {
      let lastId = "0";

      // Send historical events first
      const history = await streamService.getEventHistory(runId);
      for (const msg of history) {
        await stream.writeSSE({
          id: msg.id,
          event: msg.data.type,
          data: JSON.stringify(msg.data),
        });
        lastId = msg.id;
      }

      // Check if task is already completed
      const currentRun = await repository.findById(runId);
      if (
        currentRun?.status === "completed" ||
        currentRun?.status === "failed" ||
        currentRun?.status === "cancelled"
      ) {
        return;
      }

      // Stream new events
      const MAX_POLL_TIME = 30000; // 30 seconds
      const startTime = Date.now();

      while (Date.now() - startTime < MAX_POLL_TIME) {
        const events = await streamService.subscribeEvents(runId, lastId, 5000);

        for (const msg of events) {
          await stream.writeSSE({
            id: msg.id,
            event: msg.data.type,
            data: JSON.stringify(msg.data),
          });
          lastId = msg.id;

          // Stop if task completed
          if (
            msg.data.type === "TASK_COMPLETED" ||
            msg.data.type === "TASK_FAILED"
          ) {
            return;
          }
        }
      }
    });
  });

  return routes;
}

function serializeTaskRun(taskRun: TaskRun): Record<string, unknown> {
  return {
    ...taskRun,
    createdAt: taskRun.createdAt.toISOString(),
    startedAt: taskRun.startedAt?.toISOString() ?? null,
    completedAt: taskRun.completedAt?.toISOString() ?? null,
    syncedAt: taskRun.syncedAt?.toISOString() ?? null,
  };
}
