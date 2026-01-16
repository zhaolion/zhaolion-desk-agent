import type { UUID } from "@desk-agent/shared";
import type { Webhook, CreateWebhookInput, UpdateWebhookInput } from "../entity/webhook.js";

export interface WebhookRepository {
  create(input: CreateWebhookInput): Promise<Webhook>;
  findById(id: UUID): Promise<Webhook | null>;
  findByUserId(userId: UUID): Promise<Webhook[]>;
  update(id: UUID, input: UpdateWebhookInput): Promise<Webhook>;
  delete(id: UUID): Promise<void>;
  incrementFailureCount(id: UUID): Promise<void>;
  resetFailureCount(id: UUID): Promise<void>;
}
