import type Anthropic from "@anthropic-ai/sdk";
import type { ToolExecutionContext } from "../claude/types.js";
import type { ToolHandler, ToolResult } from "./types.js";

export class ToolRegistry {
  private handlers: Map<string, ToolHandler> = new Map();

  register(handler: ToolHandler): void {
    if (this.handlers.has(handler.definition.name)) {
      throw new Error(
        `Tool "${handler.definition.name}" is already registered`
      );
    }
    this.handlers.set(handler.definition.name, handler);
  }

  unregister(name: string): boolean {
    return this.handlers.delete(name);
  }

  get(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  getToolDefinitions(): Anthropic.Tool[] {
    return Array.from(this.handlers.values()).map((handler) => ({
      name: handler.definition.name,
      description: handler.definition.description,
      input_schema: handler.definition.inputSchema,
    }));
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const handler = this.handlers.get(toolName);
    if (!handler) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    try {
      return await handler.execute(input, context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      context.logger.error(`Tool "${toolName}" failed: ${message}`);
      return {
        success: false,
        error: message,
      };
    }
  }

  listTools(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}
