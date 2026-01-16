import { pgTable, uuid, varchar, text, timestamp, integer, boolean, jsonb, bigint, primaryKey, decimal, date } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
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

export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamMembers = pgTable("team_members", {
  teamId: uuid("team_id").references(() => teams.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.teamId, table.userId] }),
]);

// Billing tables
export const plans = pgTable("plans", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }),
  limits: jsonb("limits").notNull(),
  features: text("features").array(),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  teamId: uuid("team_id").references(() => teams.id),
  planId: varchar("plan_id", { length: 50 }).references(() => plans.id).notNull(),
  status: varchar("status", { length: 20 }).default("active").notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAt: timestamp("cancel_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usageRecords = pgTable("usage_records", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  taskRunId: uuid("task_run_id").references(() => taskRuns.id),
  type: varchar("type", { length: 50 }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id),
  stripeInvoiceId: varchar("stripe_invoice_id", { length: 255 }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  periodStart: timestamp("period_start"),
  periodEnd: timestamp("period_end"),
  pdfUrl: text("pdf_url"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
