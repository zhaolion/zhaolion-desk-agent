import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { TaskRepository } from "@desk-agent/domain/task";
import type { Task } from "@desk-agent/domain";

const variableDefinitionSchema = z.object({
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.unknown().optional(),
});

const createTaskSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  prompt: z.string().min(1),
  agentId: z.string().uuid(),
  variables: z.record(z.string(), variableDefinitionSchema).optional(),
});

const updateTaskSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  prompt: z.string().min(1).optional(),
  variables: z.record(z.string(), variableDefinitionSchema).optional(),
});

export function createTasksRoutes(repository: TaskRepository): Hono {
  const routes = new Hono();

  // GET /tasks - List user's tasks
  routes.get("/", async (c) => {
    const auth = c.get("auth");
    const tasks = await repository.findByUserId(auth.userId);
    return c.json(tasks.map(serializeTask));
  });

  // POST /tasks - Create task
  routes.post("/", zValidator("json", createTaskSchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");
    const task = await repository.create({
      userId: auth.userId,
      agentId: body.agentId,
      name: body.name,
      description: body.description,
      prompt: body.prompt,
      variables: body.variables,
    });
    return c.json(serializeTask(task), 201);
  });

  // GET /tasks/:id - Get task
  routes.get("/:id", async (c) => {
    const auth = c.get("auth");
    const task = await repository.findById(c.req.param("id"));
    if (!task || task.userId !== auth.userId) {
      return c.json({ error: "Task not found" }, 404);
    }
    return c.json(serializeTask(task));
  });

  // PATCH /tasks/:id - Update task
  routes.patch("/:id", zValidator("json", updateTaskSchema), async (c) => {
    const auth = c.get("auth");
    const task = await repository.findById(c.req.param("id"));
    if (!task || task.userId !== auth.userId) {
      return c.json({ error: "Task not found" }, 404);
    }
    const updated = await repository.update(task.id, c.req.valid("json"));
    return c.json(serializeTask(updated));
  });

  // DELETE /tasks/:id - Delete task
  routes.delete("/:id", async (c) => {
    const auth = c.get("auth");
    const task = await repository.findById(c.req.param("id"));
    if (!task || task.userId !== auth.userId) {
      return c.json({ error: "Task not found" }, 404);
    }
    await repository.delete(task.id);
    return c.json({ success: true });
  });

  return routes;
}

function serializeTask(task: Task): Record<string, unknown> {
  return {
    ...task,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}
