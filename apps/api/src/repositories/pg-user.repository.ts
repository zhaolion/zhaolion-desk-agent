import { eq } from "drizzle-orm";
import { hash, compare } from "bcrypt";
import type { Database } from "../db/index.js";
import { users } from "../db/schema.js";

export interface User {
  id: string;
  email: string;
  name: string | null;
  status: string;
  createdAt: Date;
}

export interface CreateUserInput {
  email: string;
  password: string;
  name?: string;
}

export class PgUserRepository {
  constructor(private db: Database) {}

  async create(input: CreateUserInput): Promise<User> {
    const passwordHash = await hash(input.password, 10);

    const [result] = await this.db.insert(users).values({
      email: input.email,
      name: input.name ?? null,
      passwordHash,
    }).returning();

    if (!result) {
      throw new Error("Failed to create user");
    }

    return this.mapToUser(result);
  }

  async findByEmail(email: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.email, email));
    return result ? this.mapToUser(result) : null;
  }

  async findById(id: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.id, id));
    return result ? this.mapToUser(result) : null;
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const [result] = await this.db.select().from(users).where(eq(users.email, email));
    if (!result || !result.passwordHash) return null;

    const valid = await compare(password, result.passwordHash);
    return valid ? this.mapToUser(result) : null;
  }

  private mapToUser(row: typeof users.$inferSelect): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      status: row.status ?? "active",
      createdAt: row.createdAt,
    };
  }
}
