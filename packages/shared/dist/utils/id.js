import { randomUUID } from "node:crypto";
export function generateId() {
    return randomUUID();
}
export function generatePrefixedId(prefix) {
    return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
//# sourceMappingURL=id.js.map