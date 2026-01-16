import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Artifact, LogFile } from "@desk-agent/domain";
import { generateId } from "@desk-agent/shared";

const DATA_DIR = process.env["WORKER_DATA_DIR"] || "/data/desk-agent";

export class StorageService {
  async getRunDir(taskRunId: string): Promise<string> {
    return join(DATA_DIR, "runs", taskRunId);
  }

  async listArtifacts(taskRunId: string): Promise<Artifact[]> {
    const artifactsDir = join(DATA_DIR, "runs", taskRunId, "artifacts");
    try {
      const files = await readdir(artifactsDir);
      const artifacts: Artifact[] = [];

      for (const file of files) {
        const filePath = join(artifactsDir, file);
        const stats = await stat(filePath);
        artifacts.push({
          id: generateId(),
          taskRunId,
          name: file,
          mimeType: this.getMimeType(file),
          sizeBytes: stats.size,
          localPath: filePath,
          s3Key: null,
          createdAt: stats.birthtime,
        });
      }

      return artifacts;
    } catch {
      return [];
    }
  }

  async getArtifact(taskRunId: string, name: string): Promise<Buffer | null> {
    const filePath = join(DATA_DIR, "runs", taskRunId, "artifacts", name);
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  async listLogs(taskRunId: string): Promise<LogFile[]> {
    const logsDir = join(DATA_DIR, "runs", taskRunId, "logs");
    try {
      const files = await readdir(logsDir);
      const logs: LogFile[] = [];

      for (const file of files) {
        if (!file.endsWith(".log")) continue;
        const filePath = join(logsDir, file);
        const stats = await stat(filePath);
        const content = await readFile(filePath, "utf-8");
        const lineCount = content.split("\n").filter(Boolean).length;

        logs.push({
          id: generateId(),
          taskRunId,
          channel: file.replace(".log", ""),
          localPath: filePath,
          s3Key: null,
          lineCount,
          sizeBytes: stats.size,
          createdAt: stats.birthtime,
        });
      }

      return logs;
    } catch {
      return [];
    }
  }

  async getLog(taskRunId: string, channel: string, tail?: number): Promise<string | null> {
    const filePath = join(DATA_DIR, "runs", taskRunId, "logs", `${channel}.log`);
    try {
      const content = await readFile(filePath, "utf-8");
      if (tail) {
        const lines = content.split("\n");
        return lines.slice(-tail).join("\n");
      }
      return content;
    } catch {
      return null;
    }
  }

  private getMimeType(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      json: "application/json",
      csv: "text/csv",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      html: "text/html",
      md: "text/markdown",
    };
    return mimeTypes[ext || ""] || "application/octet-stream";
  }
}
