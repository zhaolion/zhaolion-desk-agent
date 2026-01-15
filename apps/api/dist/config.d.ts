export interface Config {
    port: number;
    host: string;
    redisUrl: string;
    databaseUrl: string;
    nodeEnv: "development" | "production" | "test";
}
export declare function loadConfig(): Config;
//# sourceMappingURL=config.d.ts.map