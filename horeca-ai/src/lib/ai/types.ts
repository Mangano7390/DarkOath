export interface ToolInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  [k: string]: unknown;
}

export interface ToolDef<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  input_schema: ToolInputSchema;
  handler: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
  /** When true, the tool mutates persistent state and is subject to HITL approval. */
  mutates?: boolean;
}

export interface ToolContext {
  userId: string;
  conversationId?: string;
  locale: string;
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input"; id: string; input: unknown }
  | { type: "tool_result"; id: string; result: unknown; isError?: boolean }
  | { type: "message_end"; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "error"; message: string };
