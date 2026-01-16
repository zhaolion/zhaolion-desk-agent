import type { UUID } from "@desk-agent/shared";

export type WebhookEventType =
  | "task.started"
  | "task.completed"
  | "task.failed"
  | "task.waiting_input";

export interface Webhook {
  id: UUID;
  userId: UUID;
  name: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  enabled: boolean;
  failureCount: number;
  lastTriggeredAt: Date | null;
  createdAt: Date;
}

export interface CreateWebhookInput {
  userId: UUID;
  name: string;
  url: string;
  events: WebhookEventType[];
}

export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEventType[];
  enabled?: boolean;
}
