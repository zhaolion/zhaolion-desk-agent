import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import type { ToolHandler, ToolResult } from "../types.js";
import type { ToolExecutionContext } from "../../claude/types.js";

export interface ReadFileInput {
  path: string;
  encoding?: string;
}

export interface WriteFileInput {
  path: string;
  content: string;
  encoding?: string;
}

export interface ListDirInput {
  path?: string;
}

export const readFileTool: ToolHandler = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to read (relative to workspace)",
        },
        encoding: {
          type: "string",
          description: "File encoding (default: utf-8)",
        },
      },
      required: ["path"],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path, encoding = "utf-8" } = input as unknown as ReadFileInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    const relativePath = relative(resolve(context.workDir), fullPath);
    if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Reading file: ${path}`);
      const content = await readFile(fullPath, encoding as BufferEncoding);
      return {
        success: true,
        output: content,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.logger.error(`read_file failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  },
};

export const writeFileTool: ToolHandler = {
  definition: {
    name: "write_file",
    description: "Write content to a file (creates directories if needed)",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the file to write (relative to workspace)",
        },
        content: {
          type: "string",
          description: "Content to write to the file",
        },
        encoding: {
          type: "string",
          description: "File encoding (default: utf-8)",
        },
      },
      required: ["path", "content"],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path, content, encoding = "utf-8" } = input as unknown as WriteFileInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    const relativePath = relative(resolve(context.workDir), fullPath);
    if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Writing file: ${path}`);
      await mkdir(dirname(fullPath), { recursive: true });
      await writeFile(fullPath, content, encoding as BufferEncoding);
      return {
        success: true,
        output: `File written: ${path}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.logger.error(`write_file failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  },
};

export const listDirTool: ToolHandler = {
  definition: {
    name: "list_directory",
    description: "List contents of a directory",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description: "Path to the directory (relative to workspace, default: .)",
        },
      },
      required: [],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { path = "." } = input as unknown as ListDirInput;
    const fullPath = resolve(context.workDir, path);

    // Security: ensure path is within workDir
    const relativePath = relative(resolve(context.workDir), fullPath);
    if (relativePath.startsWith("..") || relativePath.startsWith("/")) {
      return {
        success: false,
        error: "Path traversal not allowed",
      };
    }

    try {
      context.logger.log(`Listing directory: ${path}`);
      const entries = await readdir(fullPath, { withFileTypes: true });
      const result = entries.map((e) => ({
        name: e.name,
        type: e.isDirectory() ? "directory" : "file",
      }));
      return {
        success: true,
        output: JSON.stringify(result, null, 2),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      context.logger.error(`list_directory failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  },
};
