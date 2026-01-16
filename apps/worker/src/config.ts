export interface Config {
  redisUrl: string;
  databaseUrl: string;
  anthropicApiKey: string;
  dataDir: string;
  consumerGroup: string;
  consumerId: string;
  nodeEnv: "development" | "production" | "test";
}

export function loadConfig(): Config {
  const anthropicApiKey = process.env["ANTHROPIC_API_KEY"];
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is required");
  }

  return {
    redisUrl: process.env["REDIS_URL"] ?? "redis://localhost:6379",
    databaseUrl: process.env["DATABASE_URL"] ?? "postgresql://localhost:5432/desk_agent",
    anthropicApiKey,
    dataDir: process.env["DATA_DIR"] ?? "/data/desk-agent",
    consumerGroup: process.env["CONSUMER_GROUP"] ?? "workers",
    consumerId: process.env["CONSUMER_ID"] ?? `worker-${process.pid}`,
    nodeEnv: (process.env["NODE_ENV"] as Config["nodeEnv"]) ?? "development",
  };
}
