import { Redis } from "ioredis";
const STREAM_KEYS = {
    TASKS_PENDING: "stream:tasks:pending",
    taskEvents: (taskRunId) => `stream:tasks:${taskRunId}:events`,
    taskInput: (taskRunId) => `stream:tasks:${taskRunId}:input`,
};
export class RedisStreamService {
    redis;
    subscriber;
    constructor(redisUrl) {
        this.redis = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);
    }
    async enqueueTask(taskRun) {
        const id = await this.redis.xadd(STREAM_KEYS.TASKS_PENDING, "*", "taskRunId", taskRun.id, "payload", JSON.stringify(taskRun));
        return id;
    }
    async consumeTasks(groupName, consumerId, count = 1, blockMs = 5000) {
        const results = await this.redis.xreadgroup("GROUP", groupName, consumerId, "COUNT", count, "BLOCK", blockMs, "STREAMS", STREAM_KEYS.TASKS_PENDING, ">");
        if (!results)
            return [];
        return this.parseStreamResults(results);
    }
    async ackTask(messageId) {
        await this.redis.xack(STREAM_KEYS.TASKS_PENDING, "workers", messageId);
    }
    async publishEvent(taskRunId, event) {
        const id = await this.redis.xadd(STREAM_KEYS.taskEvents(taskRunId), "*", "type", event.type, "data", JSON.stringify(event));
        return id;
    }
    async subscribeEvents(taskRunId, lastId = "$", blockMs = 0) {
        const results = await this.redis.xread("BLOCK", blockMs, "STREAMS", STREAM_KEYS.taskEvents(taskRunId), lastId);
        if (!results)
            return [];
        return this.parseStreamResults(results);
    }
    async getEventHistory(taskRunId, fromId = "-", count = 100) {
        const results = await this.redis.xrange(STREAM_KEYS.taskEvents(taskRunId), fromId, "+", "COUNT", count);
        return results.map(([id, fields]) => ({
            id,
            data: JSON.parse(fields[fields.indexOf("data") + 1]),
        }));
    }
    async publishInput(taskRunId, input) {
        const id = await this.redis.xadd(STREAM_KEYS.taskInput(taskRunId), "*", "data", JSON.stringify(input));
        return id;
    }
    async waitForInput(taskRunId, timeoutMs = 3600000) {
        const results = await this.redis.xread("BLOCK", timeoutMs, "STREAMS", STREAM_KEYS.taskInput(taskRunId), "$");
        if (!results)
            return null;
        const messages = this.parseStreamResults(results);
        return messages[0]?.data ?? null;
    }
    async createConsumerGroup(groupName) {
        try {
            await this.redis.xgroup("CREATE", STREAM_KEYS.TASKS_PENDING, groupName, "0", "MKSTREAM");
        }
        catch (error) {
            // Group already exists, ignore
            if (!(error instanceof Error) || !error.message.includes("BUSYGROUP")) {
                throw error;
            }
        }
    }
    async close() {
        await this.redis.quit();
        await this.subscriber.quit();
    }
    parseStreamResults(results) {
        const messages = [];
        for (const [, entries] of results) {
            for (const [id, fields] of entries) {
                const dataIndex = fields.indexOf("data");
                const payloadIndex = fields.indexOf("payload");
                const jsonIndex = dataIndex !== -1 ? dataIndex : payloadIndex;
                if (jsonIndex !== -1) {
                    messages.push({
                        id,
                        data: JSON.parse(fields[jsonIndex + 1]),
                    });
                }
            }
        }
        return messages;
    }
}
//# sourceMappingURL=redis-stream.service.js.map