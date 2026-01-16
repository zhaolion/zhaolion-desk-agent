import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, bigint } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  name: varchar("name", { length: 100 }),
  status: varchar("status", { length: 20 }).default("active"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }),
  keyHash: varchar("key_hash", { length: 255 }).notNull(),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  model: varchar("model", { length: 50 }).default("claude-sonnet-4-20250514"),
  systemPrompt: text("system_prompt"),
  maxTokens: integer("max_tokens").default(4096),
  tools: text("tools").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  prompt: text("prompt").notNull(),
  variables: jsonb("variables"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const taskRuns = pgTable("task_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").references(() => tasks.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  agentId: uuid("agent_id").references(() => agents.id).notNull(),
  prompt: text("prompt").notNull(),
  systemPrompt: text("system_prompt"),
  variables: jsonb("variables"),
  status: varchar("status", { length: 20 }).default("pending"),
  progress: integer("progress").default(0),
  result: text("result"),
  error: text("error"),
  tokensInput: bigint("tokens_input", { mode: "number" }).default(0),
  tokensOutput: bigint("tokens_output", { mode: "number" }).default(0),
  localPath: text("local_path"),
  s3Prefix: text("s3_prefix"),
  syncedAt: timestamp("synced_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  name: varchar("name", { length: 100 }),
  url: text("url").notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  events: text("events").array().notNull(),
  enabled: boolean("enabled").default(true),
  failureCount: integer("failure_count").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
