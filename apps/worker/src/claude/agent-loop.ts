// apps/worker/src/claude/agent-loop.ts
import type Anthropic from "@anthropic-ai/sdk";
import type { ExecutionContext, ExecutionResult } from "../executor/context.js";
import type { AgentConfig } from "./types.js";
import { handleToolCalls, extractTextContent } from "./message-handler.js";

export interface AgentLoopOptions {
  client: Anthropic;
  config: AgentConfig;
  ctx: ExecutionContext;
  initialPrompt: string;
}

export async function runAgentLoop(options: AgentLoopOptions): Promise<ExecutionResult> {
  const { client, config, ctx, initialPrompt } = options;

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: initialPrompt },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Publish task started event
  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "TASK_STARTED",
    taskRunId: ctx.taskRunId,
    timestamp: new Date().toISOString(),
  });

  await ctx.logger.log("Agent loop started");
  await ctx.logger.log(`Initial prompt: ${initialPrompt.slice(0, 200)}...`);

  let iterationCount = 0;
  const maxIterations = 50; // Safety limit

  while (iterationCount < maxIterations) {
    iterationCount++;

    // Check for abort signal
    if (ctx.abortSignal?.aborted) {
      await ctx.logger.log("Task cancelled by user");
      return {
        status: "cancelled",
        error: "Task cancelled",
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }

    await ctx.logger.log(`[Iteration ${iterationCount}] Calling Claude API...`);

    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: config.systemPrompt,
        tools: config.tools,
        messages,
      });

      // Track token usage
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      await ctx.logger.log(
        `[Iteration ${iterationCount}] Response: stop_reason=${response.stop_reason}, ` +
        `tokens=${response.usage.input_tokens}/${response.usage.output_tokens}`
      );

      // Add assistant message to history
      const assistantMessage: Anthropic.MessageParam = {
        role: "assistant",
        content: response.content,
      };
      messages.push(assistantMessage);

      // Check if done
      if (response.stop_reason === "end_turn") {
        const output = extractTextContent(response.content);
        await ctx.logger.log(`Agent completed: ${output?.slice(0, 200)}...`);

        await ctx.streamService.publishEvent(ctx.taskRunId, {
          type: "TASK_COMPLETED",
          taskRunId: ctx.taskRunId,
          result: output || "",
        });

        return {
          status: "completed",
          output,
          tokensInput: totalInputTokens,
          tokensOutput: totalOutputTokens,
        };
      }

      // Handle tool use
      if (response.stop_reason === "tool_use") {
        const toolResults = await handleToolCalls(response.content, ctx);

        messages.push({
          role: "user",
          content: toolResults,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ctx.logger.error(`Claude API error: ${message}`);

      await ctx.streamService.publishEvent(ctx.taskRunId, {
        type: "TASK_FAILED",
        taskRunId: ctx.taskRunId,
        error: message,
      });

      return {
        status: "failed",
        error: message,
        tokensInput: totalInputTokens,
        tokensOutput: totalOutputTokens,
      };
    }
  }

  // Max iterations reached
  const error = `Max iterations (${maxIterations}) reached`;
  await ctx.logger.error(error);

  await ctx.streamService.publishEvent(ctx.taskRunId, {
    type: "TASK_FAILED",
    taskRunId: ctx.taskRunId,
    error,
  });

  return {
    status: "failed",
    error,
    tokensInput: totalInputTokens,
    tokensOutput: totalOutputTokens,
  };
}
