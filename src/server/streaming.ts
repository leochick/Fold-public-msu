import type Anthropic from "@anthropic-ai/sdk";

type StreamArgs = Omit<Anthropic.MessageCreateParamsStreaming, "stream">;

export type StreamEvent =
  | { type: "start" }
  | { type: "tool_use_partial"; partial: string }
  | { type: "tool_use_complete"; input: unknown; name: string }
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export function anthropicSseStream(
  client: Anthropic,
  args: StreamArgs
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      try {
        send({ type: "start" });
        const stream = client.messages.stream({ ...args, stream: true });
        let toolName = "";
        let partial = "";
        for await (const event of stream) {
          if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
            toolName = event.content_block.name;
            partial = "";
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "input_json_delta") {
              partial += event.delta.partial_json;
              send({ type: "tool_use_partial", partial });
            } else if (event.delta.type === "text_delta") {
              send({ type: "text", text: event.delta.text });
            }
          }
        }
        const finalMessage = await stream.finalMessage();
        for (const block of finalMessage.content) {
          if (block.type === "tool_use") {
            send({ type: "tool_use_complete", input: block.input, name: toolName || block.name });
          }
        }
        send({ type: "done" });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "stream failed" });
      } finally {
        controller.close();
      }
    },
  });
}

export function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
