export function loadConfig() {
    return {
        port: parseInt(process.env["API_PORT"] ?? "3000", 10),
        host: process.env["API_HOST"] ?? "0.0.0.0",
        redisUrl: process.env["REDIS_URL"] ?? "redis://localhost:6379",
        databaseUrl: process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/desk_agent",
        nodeEnv: process.env["NODE_ENV"] ?? "development",
    };
}
//# sourceMappingURL=config.js.map