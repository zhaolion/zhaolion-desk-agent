// apps/worker/src/claude/message-handler.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ExecutionContext } from "../executor/context.js";

export interface ToolCallResult {
  toolUseId: string;
  toolName: string;
  content: string;
  isError: boolean;
}

export async function handleToolCalls(
  content: Anthropic.ContentBlock[],
  ctx: ExecutionContext
): Promise<Anthropic.ToolResultBlockParam[]> {
  const toolUseBlocks = content.filter(
    (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
  );

  const results: Anthropic.ToolResultBlockParam[] = [];

  for (const toolUse of toolUseBlocks) {
    // Publish step started event
    await ctx.streamService.publishEvent(ctx.taskRunId, {
      type: "STEP_STARTED",
      taskRunId: ctx.taskRunId,
      step: {
        name: toolUse.name,
        input: toolUse.input as Record<string, unknown>,
      },
    });

    await ctx.logger.tool(toolUse.name, `Executing with input: ${JSON.stringify(toolUse.input)}`);

    try {
      // Execute tool
      const toolResult = await ctx.toolRegistry.execute(
        toolUse.name,
        toolUse.input as Record<string, unknown>,
        {
          taskRunId: ctx.taskRunId,
          workDir: ctx.workDir,
          logger: ctx.logger,
        }
      );

      const content = toolResult.success
        ? toolResult.output || "(no output)"
        : `Error: ${toolResult.error}`;

      await ctx.logger.tool(toolUse.name, `Result: ${content.slice(0, 500)}`);

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content,
        is_error: !toolResult.success,
      });

      // Publish step completed event
      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "STEP_COMPLETED",
        taskRunId: ctx.taskRunId,
        step: {
          name: toolUse.name,
          output: toolResult.success ? toolResult.output : toolResult.error,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.logger.error(`Tool ${toolUse.name} failed: ${message}`);

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: `Error: ${message}`,
        is_error: true,
      });
    }
  }

  return results;
}

export function extractTextContent(content: Anthropic.ContentBlock[]): string | undefined {
  const textBlock = content.find(
    (c): c is Anthropic.TextBlock => c.type === "text"
  );
  return textBlock?.text;
}
