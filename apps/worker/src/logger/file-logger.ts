import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "../claude/types.js";

export interface FileLoggerOptions {
  runDir: string;
  channels?: string[];
}

export class FileLogger implements Logger {
  private runDir: string;
  private initialized = false;

  constructor(options: FileLoggerOptions) {
    this.runDir = options.runDir;
  }

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    try {
      await mkdir(join(this.runDir, "logs"), { recursive: true });
      this.initialized = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to create log directory: ${message}`);
    }
  }

  private formatLine(message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] ${message}\n`;
  }

  private async writeLog(message: string, channel: string): Promise<void> {
    await this.ensureDir();
    const logPath = join(this.runDir, "logs", `${channel}.log`);
    await appendFile(logPath, this.formatLine(message));
  }

  async log(message: string): Promise<void> {
    await this.writeLog(message, "agent");
  }

  async error(message: string): Promise<void> {
    await Promise.all([
      this.writeLog(message, "error"),
      this.writeLog(`[ERROR] ${message}`, "agent"),
    ]);
  }

  async tool(toolName: string, message: string): Promise<void> {
    await Promise.all([
      this.writeLog(`[${toolName}] ${message}`, "tool"),
      this.writeLog(`[TOOL:${toolName}] ${message}`, "agent"),
    ]);
  }

  getLogPath(channel = "agent"): string {
    return join(this.runDir, "logs", `${channel}.log`);
  }
}

export function createFileLogger(runDir: string): FileLogger {
  return new FileLogger({ runDir });
}
