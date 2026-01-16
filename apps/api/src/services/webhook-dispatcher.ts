import { createHmac } from "node:crypto";
import type { WebhookRepository, Webhook, WebhookEventType } from "@desk-agent/domain/notify";
import type { TaskEvent } from "@desk-agent/domain";

export interface WebhookPayload {
  id: string;
  timestamp: string;
  event: WebhookEventType;
  data: Record<string, unknown>;
}

export class WebhookDispatcher {
  constructor(private repository: WebhookRepository) {}

  async dispatch(userId: string, event: TaskEvent): Promise<void> {
    const webhookEvent = this.mapEventType(event.type);
    if (!webhookEvent) return;

    const webhooks = await this.repository.findByUserId(userId);
    const eligibleWebhooks = webhooks.filter(
      (w) => w.enabled && w.events.includes(webhookEvent)
    );

    await Promise.allSettled(
      eligibleWebhooks.map((webhook) => this.send(webhook, webhookEvent, event))
    );
  }

  private async send(
    webhook: Webhook,
    eventType: WebhookEventType,
    event: TaskEvent
  ): Promise<void> {
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: eventType,
      data: event as unknown as Record<string, unknown>,
    };

    const signature = this.sign(JSON.stringify(payload), webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Id": webhook.id,
          "X-Webhook-Signature": signature,
          "User-Agent": "DeskAgent-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        await this.repository.resetFailureCount(webhook.id);
      } else {
        console.error(`Webhook ${webhook.id} failed: ${response.status}`);
        await this.repository.incrementFailureCount(webhook.id);
      }
    } catch (error) {
      console.error(`Webhook ${webhook.id} error:`, error);
      await this.repository.incrementFailureCount(webhook.id);
    }
  }

  private sign(payload: string, secret: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
  }

  private mapEventType(type: TaskEvent["type"]): WebhookEventType | null {
    const mapping: Record<string, WebhookEventType> = {
      TASK_STARTED: "task.started",
      TASK_COMPLETED: "task.completed",
      TASK_FAILED: "task.failed",
      HUMAN_INPUT_NEEDED: "task.waiting_input",
    };
    return mapping[type] ?? null;
  }

  // For testing webhooks
  async testWebhook(webhookId: string, userId: string): Promise<{ success: boolean; status?: number; error?: string }> {
    const webhook = await this.repository.findById(webhookId);
    if (!webhook || webhook.userId !== userId) {
      return { success: false, error: "Webhook not found" };
    }

    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      event: "task.started",
      data: { taskRunId: "test-run-id", test: true },
    };

    const signature = this.sign(JSON.stringify(payload), webhook.secret);

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Id": webhook.id,
          "X-Webhook-Signature": signature,
          "User-Agent": "DeskAgent-Webhook/1.0",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      return { success: response.ok, status: response.status };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }
}
