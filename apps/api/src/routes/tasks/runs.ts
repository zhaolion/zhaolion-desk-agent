import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { zValidator } from "@hono/zod-validator";
import type { TaskRunRepository, TaskStreamService } from "@desk-agent/domain/task";
import type { TaskRun, Artifact, LogFile } from "@desk-agent/domain";
import { createTaskRunSchema, humanInputSchema } from "./schemas.js";
import type { AuthContext } from "../../middleware/index.js";
import type { StorageService } from "../../services/storage.service.js";

// Default agent ID - will be replaced with proper agent resolution later
const DEFAULT_AGENT_ID = "agent-default";

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

      const auth = c.get("auth");
      const taskRun = await repository.create({
        taskId,
        userId: auth.userId,
        agentId: DEFAULT_AGENT_ID,
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
  streamService: TaskStreamService,
  storageService: StorageService
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

  // POST /runs/:runId/input - Submit human input
  routes.post(
    "/:runId/input",
    zValidator("json", humanInputSchema),
    async (c) => {
      const runId = c.req.param("runId");
      const body = c.req.valid("json");

      const taskRun = await repository.findById(runId);
      if (!taskRun) {
        return c.json({ error: "Task run not found" }, 404);
      }

      if (taskRun.status !== "waiting_input") {
        return c.json({ error: "Task is not waiting for input" }, 400);
      }

      await streamService.publishInput(runId, {
        approved: body.approved,
        value: body.value,
        reason: body.reason,
      });

      return c.json({ success: true });
    }
  );

  // POST /runs/:runId/cancel - Cancel task execution
  routes.post("/:runId/cancel", async (c) => {
    const runId = c.req.param("runId");

    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    const terminalStatuses = ["completed", "failed", "cancelled"];
    if (terminalStatuses.includes(taskRun.status)) {
      return c.json({ error: "Task is already in terminal state" }, 400);
    }

    // Update status to cancelled
    const updated = await repository.update(runId, {
      status: "cancelled",
      completedAt: new Date(),
    });

    // Publish cancel event
    await streamService.publishEvent(runId, {
      type: "TASK_FAILED",
      taskRunId: runId,
      error: "Cancelled by user",
    });

    return c.json(serializeTaskRun(updated));
  });

  // GET /runs/:runId/logs - List log files
  routes.get("/:runId/logs", async (c) => {
    const runId = c.req.param("runId");
    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    const logs = await storageService.listLogs(runId);
    return c.json(logs.map(serializeLogFile));
  });

  // GET /runs/:runId/logs/:channel - Get log content
  routes.get("/:runId/logs/:channel", async (c) => {
    const runId = c.req.param("runId");
    const channel = c.req.param("channel");
    const tail = c.req.query("tail");

    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    const content = await storageService.getLog(runId, channel, tail ? parseInt(tail) : undefined);

    if (content === null) {
      return c.json({ error: "Log not found" }, 404);
    }

    return c.text(content);
  });

  // GET /runs/:runId/artifacts - List artifacts
  routes.get("/:runId/artifacts", async (c) => {
    const runId = c.req.param("runId");
    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    const artifacts = await storageService.listArtifacts(runId);
    return c.json(artifacts.map(serializeArtifact));
  });

  // GET /runs/:runId/artifacts/:name - Download artifact
  routes.get("/:runId/artifacts/:name", async (c) => {
    const runId = c.req.param("runId");
    const name = c.req.param("name");

    const taskRun = await repository.findById(runId);
    if (!taskRun) {
      return c.json({ error: "Task run not found" }, 404);
    }

    const data = await storageService.getArtifact(runId, name);

    if (data === null) {
      return c.json({ error: "Artifact not found" }, 404);
    }

    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
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

function serializeLogFile(log: LogFile): Record<string, unknown> {
  return {
    ...log,
    createdAt: log.createdAt.toISOString(),
  };
}

function serializeArtifact(artifact: Artifact): Record<string, unknown> {
  return {
    ...artifact,
    createdAt: artifact.createdAt.toISOString(),
  };
}
