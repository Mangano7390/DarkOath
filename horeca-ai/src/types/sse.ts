export type SSEEvent =
  | { type: "text"; delta: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_use_input"; id: string; input: unknown }
  | { type: "tool_result"; id: string; result: unknown; isError?: boolean }
  | { type: "message_end"; usage?: { input_tokens: number; output_tokens: number } }
  | { type: "error"; message: string };
