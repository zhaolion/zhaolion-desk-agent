// apps/worker/src/main.ts
import { Redis } from "ioredis";
import { loadConfig } from "./config.js";
import { createClaudeClient } from "./claude/client.js";
import { createTaskExecutor } from "./executor/index.js";
import { RedisStreamService } from "./services/redis-stream.service.js";
async function main() {
    const config = loadConfig();
    console.log(`Starting Worker ${config.consumerId}`);
    console.log(`Consumer Group: ${config.consumerGroup}`);
    console.log(`Data Directory: ${config.dataDir}`);
    // Initialize Redis
    const redis = new Redis(config.redisUrl);
    // Initialize Claude client
    const claude = createClaudeClient(config.anthropicApiKey);
    // Initialize stream service
    const streamService = new RedisStreamService(redis, config.consumerGroup);
    // Ensure consumer group exists
    await streamService.createConsumerGroup(config.consumerGroup);
    // Initialize task executor
    const executor = createTaskExecutor({
        client: claude,
        streamService,
        dataDir: config.dataDir,
    });
    console.log("Worker started, waiting for tasks...");
    // Graceful shutdown handling
    let running = true;
    const shutdown = async () => {
        console.log("Shutting down worker...");
        running = false;
        try {
            await Promise.race([
                streamService.close(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Shutdown timeout")), 5000))
            ]);
        }
        catch (error) {
            console.error("Error during shutdown:", error);
            process.exit(1);
        }
        process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    // Circuit breaker for consecutive errors
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 10;
    // Main consumption loop
    while (running) {
        try {
            const messages = await streamService.consumeTasks(config.consumerGroup, config.consumerId, 1, 5000 // 5 second block
            );
            consecutiveErrors = 0; // Reset on success
            for (const message of messages) {
                console.log(`Processing task: ${message.data.id}`);
                try {
                    const result = await executor.execute(message.data);
                    console.log(`Task ${message.data.id} completed: ${result.status}`);
                    // Acknowledge the message
                    await streamService.ackTask(message.id);
                }
                catch (error) {
                    console.error(`Task ${message.data.id} failed:`, error);
                    // Still acknowledge to prevent infinite retries
                    // In production, you might want to move to a dead-letter queue
                    await streamService.ackTask(message.id);
                }
            }
        }
        catch (error) {
            consecutiveErrors++;
            console.error("Error consuming tasks:", error);
            if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                console.error(`Max consecutive errors (${MAX_CONSECUTIVE_ERRORS}) reached, shutting down`);
                running = false;
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
//# sourceMappingURL=main.js.map