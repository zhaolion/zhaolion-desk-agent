import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AgentRepository } from "@desk-agent/domain/agent";
import type { Agent } from "@desk-agent/domain";

const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(z.string()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  tools: z.array(z.string()).optional(),
});

export function createAgentsRoutes(repository: AgentRepository): Hono {
  const routes = new Hono();

  // GET /agents - List user's agents
  routes.get("/", async (c) => {
    const auth = c.get("auth");
    const agents = await repository.findByUserId(auth.userId);
    return c.json(agents.map(serializeAgent));
  });

  // POST /agents - Create agent
  routes.post("/", zValidator("json", createAgentSchema), async (c) => {
    const auth = c.get("auth");
    const body = c.req.valid("json");
    const agent = await repository.create({
      userId: auth.userId,
      name: body.name,
      description: body.description,
      model: body.model,
      systemPrompt: body.systemPrompt,
      maxTokens: body.maxTokens,
      tools: body.tools,
    });
    return c.json(serializeAgent(agent), 201);
  });

  // GET /agents/:id - Get agent
  routes.get("/:id", async (c) => {
    const auth = c.get("auth");
    const agent = await repository.findById(c.req.param("id"));
    if (!agent || agent.userId !== auth.userId) {
      return c.json({ error: "Agent not found" }, 404);
    }
    return c.json(serializeAgent(agent));
  });

  // PATCH /agents/:id - Update agent
  routes.patch("/:id", zValidator("json", updateAgentSchema), async (c) => {
    const auth = c.get("auth");
    const agent = await repository.findById(c.req.param("id"));
    if (!agent || agent.userId !== auth.userId) {
      return c.json({ error: "Agent not found" }, 404);
    }
    const updated = await repository.update(agent.id, c.req.valid("json"));
    return c.json(serializeAgent(updated));
  });

  // DELETE /agents/:id - Delete agent
  routes.delete("/:id", async (c) => {
    const auth = c.get("auth");
    const agent = await repository.findById(c.req.param("id"));
    if (!agent || agent.userId !== auth.userId) {
      return c.json({ error: "Agent not found" }, 404);
    }
    await repository.delete(agent.id);
    return c.json({ success: true });
  });

  return routes;
}

function serializeAgent(agent: Agent): Record<string, unknown> {
  return {
    ...agent,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}
