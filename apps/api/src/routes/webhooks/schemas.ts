import { z } from "zod";

const webhookEventTypes = ["task.started", "task.completed", "task.failed", "task.waiting_input"] as const;

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(webhookEventTypes)).min(1),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
  enabled: z.boolean().optional(),
});
