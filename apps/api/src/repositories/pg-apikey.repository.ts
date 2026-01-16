import { eq, and } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import type { Database } from "../db/index.js";
import { apiKeys } from "../db/schema.js";

export interface ApiKey {
  id: string;
  userId: string;
  name: string | null;
  keyPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface CreateApiKeyInput {
  userId: string;
  name?: string;
  expiresAt?: Date;
}

export interface ApiKeyWithSecret extends ApiKey {
  key: string; // Full key, only returned on creation
}

export class PgApiKeyRepository {
  constructor(private db: Database) {}

  async create(input: CreateApiKeyInput): Promise<ApiKeyWithSecret> {
    // Generate key: dsk_live_<32 random bytes hex>
    const randomPart = randomBytes(32).toString("hex");
    const fullKey = `dsk_live_${randomPart}`;
    const keyPrefix = fullKey.substring(0, 12);
    const keyHash = this.hashKey(fullKey);

    const [result] = await this.db.insert(apiKeys).values({
      userId: input.userId,
      name: input.name ?? null,
      keyHash,
      keyPrefix,
      expiresAt: input.expiresAt ?? null,
    }).returning();

    if (!result) {
      throw new Error("Failed to create API key");
    }

    return {
      id: result.id,
      userId: result.userId,
      name: result.name,
      keyPrefix: result.keyPrefix,
      lastUsedAt: result.lastUsedAt,
      expiresAt: result.expiresAt,
      createdAt: result.createdAt,
      key: fullKey, // Only returned once!
    };
  }

  async findByUserId(userId: string): Promise<ApiKey[]> {
    const results = await this.db.select().from(apiKeys).where(eq(apiKeys.userId, userId));
    return results.map(this.mapToApiKey);
  }

  async findById(id: string): Promise<ApiKey | null> {
    const [result] = await this.db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return result ? this.mapToApiKey(result) : null;
  }

  async verifyKey(key: string): Promise<{ userId: string; keyId: string } | null> {
    const keyHash = this.hashKey(key);
    const keyPrefix = key.substring(0, 12);

    const [result] = await this.db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.keyPrefix, keyPrefix)
      ));

    if (!result) return null;

    // Check expiration
    if (result.expiresAt && result.expiresAt < new Date()) {
      return null;
    }

    // Update last used
    await this.db.update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, result.id));

    return { userId: result.userId, keyId: result.id };
  }

  async delete(id: string, userId: string): Promise<boolean> {
    const result = await this.db.delete(apiKeys)
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  private hashKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
  }

  private mapToApiKey(row: typeof apiKeys.$inferSelect): ApiKey {
    return {
      id: row.id,
      userId: row.userId,
      name: row.name,
      keyPrefix: row.keyPrefix,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }
}
