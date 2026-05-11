import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MAX_TOKENS, MODEL } from "@/lib/ai/client";
import type { StreamEvent, ToolContext, ToolDef } from "@/lib/ai/types";

const MAX_TOOL_TURNS = 8;

interface RunAgentOptions {
  systemPrompt: string;
  tools: ToolDef[];
  context: ToolContext;
  initialMessages: Anthropic.MessageParam[];
  onEvent: (e: StreamEvent) => void;
  /** Tool names that require explicit user approval; the loop pauses if called. */
  approvalRequired?: string[];
}

/**
 * Runs a Claude agent with multi-turn tool_use streaming.
 * Emits StreamEvent objects via onEvent; caller is responsible for transport (SSE).
 */
export async function runAgent(opts: RunAgentOptions): Promise<{
  finalMessages: Anthropic.MessageParam[];
  usage: { input_tokens: number; output_tokens: number };
}> {
  const client = getAnthropic();
  const messages: Anthropic.MessageParam[] = [...opts.initialMessages];
  const toolMap = new Map(opts.tools.map((t) => [t.name, t]));
  const totalUsage = { input_tokens: 0, output_tokens: 0 };

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: opts.systemPrompt,
      tools: opts.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      })),
      messages,
    });

    const assistantBlocks: Anthropic.ContentBlock[] = [];
    const pendingToolUses: { id: string; name: string; input: unknown }[] = [];

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          opts.onEvent({ type: "text", delta: event.delta.text });
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          opts.onEvent({
            type: "tool_use_start",
            id: event.content_block.id,
            name: event.content_block.name,
          });
        }
      }
    }

    const final = await stream.finalMessage();
    totalUsage.input_tokens += final.usage.input_tokens;
    totalUsage.output_tokens += final.usage.output_tokens;

    for (const block of final.content) {
      assistantBlocks.push(block);
      if (block.type === "tool_use") {
        pendingToolUses.push({ id: block.id, name: block.name, input: block.input });
        opts.onEvent({ type: "tool_use_input", id: block.id, input: block.input });
      }
    }

    messages.push({ role: "assistant", content: assistantBlocks });

    if (final.stop_reason !== "tool_use" || pendingToolUses.length === 0) {
      opts.onEvent({ type: "message_end", usage: totalUsage });
      return { finalMessages: messages, usage: totalUsage };
    }

    // Execute every requested tool, emit results, append a single tool_result block message
    const toolResultBlocks: Anthropic.ToolResultBlockParam[] = [];
    for (const call of pendingToolUses) {
      const def = toolMap.get(call.name);
      if (!def) {
        const err = `Unknown tool: ${call.name}`;
        opts.onEvent({ type: "tool_result", id: call.id, result: err, isError: true });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: err,
          is_error: true,
        });
        continue;
      }
      if (opts.approvalRequired?.includes(def.name)) {
        const msg = "Action en attente de validation humaine.";
        opts.onEvent({ type: "tool_result", id: call.id, result: msg, isError: true });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: msg,
          is_error: true,
        });
        continue;
      }
      try {
        const result = await def.handler(call.input as never, opts.context);
        opts.onEvent({ type: "tool_result", id: call.id, result });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: typeof result === "string" ? result : JSON.stringify(result),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        opts.onEvent({ type: "tool_result", id: call.id, result: msg, isError: true });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: call.id,
          content: msg,
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResultBlocks });
  }

  opts.onEvent({
    type: "error",
    message: `Max tool turns (${MAX_TOOL_TURNS}) exceeded`,
  });
  return { finalMessages: messages, usage: totalUsage };
}

/** Builds a Response that streams StreamEvents as SSE. */
export function streamAgentToSSE(
  build: (emit: (e: StreamEvent) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        await build(emit);
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
