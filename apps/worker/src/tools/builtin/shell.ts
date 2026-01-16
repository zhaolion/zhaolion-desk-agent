import { spawn } from "node:child_process";
import type { ToolHandler, ToolResult } from "../types.js";
import type { ToolExecutionContext } from "../../claude/types.js";

export interface ShellToolInput {
  command: string;
  args?: string[];
  cwd?: string;
  timeout?: number;
}

export const shellTool: ToolHandler = {
  definition: {
    name: "shell",
    description:
      "Execute a shell command. Use this to run system commands, scripts, or programs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string",
          description: "The command to execute",
        },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments to pass to the command",
        },
        cwd: {
          type: "string",
          description:
            "Working directory for the command. Defaults to task work directory.",
        },
        timeout: {
          type: "number",
          description: "Timeout in milliseconds. Defaults to 30000 (30 seconds).",
        },
      },
      required: ["command"],
    },
  },

  async execute(
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const { command, args = [], cwd, timeout = 30000 } = input as unknown as ShellToolInput;

    context.logger.log(`Executing: ${command} ${args.join(" ")}`);

    return new Promise((resolve) => {
      const workDir = cwd ?? context.workDir;
      const proc = spawn(command, args, {
        cwd: workDir,
        shell: true,
        timeout,
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: stdout || "(no output)",
          });
        } else {
          resolve({
            success: false,
            output: stdout,
            error: stderr || `Process exited with code ${code}`,
          });
        }
      });

      proc.on("error", (err) => {
        resolve({
          success: false,
          error: err.message,
        });
      });
    });
  },
};
