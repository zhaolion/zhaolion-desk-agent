import { Redis } from "ioredis";
import type { TaskEvent } from "@desk-agent/domain";
import type { TaskRunRepository } from "@desk-agent/domain/task";
import type { WebhookDispatcher } from "./webhook-dispatcher.js";

export class EventSubscriber {
  private redis: Redis;
  private running = false;
  private activeSubscriptions = new Map<string, boolean>();

  constructor(
    redisUrl: string,
    private taskRunRepository: TaskRunRepository,
    private webhookDispatcher: WebhookDispatcher
  ) {
    this.redis = new Redis(redisUrl);
  }

  async start(): Promise<void> {
    this.running = true;
    console.log("[EventSubscriber] Started watching for task events");

    // Poll for active task runs and subscribe to their events
    this.pollActiveRuns();
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.redis.quit();
    console.log("[EventSubscriber] Stopped");
  }

  private async pollActiveRuns(): Promise<void> {
    while (this.running) {
      try {
        // Get all keys matching task event streams
        const keys = await this.redis.keys("stream:tasks:*:events");

        for (const key of keys) {
          const taskRunId = key.split(":")[2];
          if (taskRunId && !this.activeSubscriptions.has(taskRunId)) {
            this.subscribeToTaskEvents(taskRunId);
          }
        }
      } catch (error) {
        console.error("[EventSubscriber] Poll error:", error);
      }

      // Poll every 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  private async subscribeToTaskEvents(taskRunId: string): Promise<void> {
    if (this.activeSubscriptions.get(taskRunId)) return;

    this.activeSubscriptions.set(taskRunId, true);
    console.log(`[EventSubscriber] Subscribing to events for ${taskRunId}`);

    const streamKey = `stream:tasks:${taskRunId}:events`;
    let lastId = "0";

    while (this.running && this.activeSubscriptions.get(taskRunId)) {
      try {
        const results = await this.redis.xread(
          "BLOCK", 5000,
          "STREAMS", streamKey, lastId
        );

        if (!results) continue;

        for (const [, messages] of results as [string, [string, string[]][]][]) {
          for (const [id, fields] of messages) {
            lastId = id;

            const dataIndex = fields.indexOf("data");
            if (dataIndex === -1) continue;

            const eventData = fields[dataIndex + 1];
            if (!eventData) continue;

            const event = JSON.parse(eventData) as TaskEvent;
            await this.handleEvent(taskRunId, event);

            // Stop subscribing if task completed
            if (event.type === "TASK_COMPLETED" || event.type === "TASK_FAILED") {
              this.activeSubscriptions.delete(taskRunId);
              console.log(`[EventSubscriber] Task ${taskRunId} finished, unsubscribing`);
              return;
            }
          }
        }
      } catch (error) {
        console.error(`[EventSubscriber] Error for ${taskRunId}:`, error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private async handleEvent(taskRunId: string, event: TaskEvent): Promise<void> {
    try {
      // Get user ID from task run
      const taskRun = await this.taskRunRepository.findById(taskRunId);
      if (!taskRun) {
        console.warn(`[EventSubscriber] TaskRun ${taskRunId} not found`);
        return;
      }

      // Dispatch webhooks
      await this.webhookDispatcher.dispatch(taskRun.userId, event);
      console.log(`[EventSubscriber] Dispatched webhook for ${event.type}`);
    } catch (error) {
      console.error(`[EventSubscriber] Webhook dispatch error:`, error);
    }
  }
}
