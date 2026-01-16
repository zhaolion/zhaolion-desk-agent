import type { UUID } from "@desk-agent/shared";

export interface Artifact {
  id: UUID;
  taskRunId: UUID;
  name: string;
  mimeType: string;
  sizeBytes: number;
  localPath: string | null;
  s3Key: string | null;
  createdAt: Date;
}

export interface LogFile {
  id: UUID;
  taskRunId: UUID;
  channel: string; // "agent", "tool", "error"
  localPath: string | null;
  s3Key: string | null;
  lineCount: number;
  sizeBytes: number;
  createdAt: Date;
}
