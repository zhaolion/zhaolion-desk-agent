export interface Config {
    redisUrl: string;
    databaseUrl: string;
    anthropicApiKey: string;
    dataDir: string;
    consumerGroup: string;
    consumerId: string;
    nodeEnv: "development" | "production" | "test";
}
export declare function loadConfig(): Config;
//# sourceMappingURL=config.d.ts.map