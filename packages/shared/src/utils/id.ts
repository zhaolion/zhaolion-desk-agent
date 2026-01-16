import { randomUUID } from "node:crypto";

export function generateId(): string {
  return randomUUID();
}

export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
