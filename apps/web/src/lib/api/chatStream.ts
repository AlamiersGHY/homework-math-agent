import { apiFetch, extractErrorMessage, readJson } from "./client";
import type {
  ChatStreamEvent,
  ChatStreamRequest,
  DeltaEventData,
  DoneEventData,
  ErrorEventData,
  MetadataEventData,
  StartEventData
} from "@/types/chat";

type ChatStreamHandlers = {
  onEvent?: (event: ChatStreamEvent) => void;
  onStart?: (data: StartEventData) => void;
  onMetadata?: (data: MetadataEventData) => void;
  onDelta?: (data: DeltaEventData) => void;
  onDone?: (data: DoneEventData) => void;
  onErrorEvent?: (data: ErrorEventData) => void;
};

export async function streamChat(
  request: ChatStreamRequest,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const response = await apiFetch("/chat/stream", {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request),
    signal
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(extractErrorMessage(payload, `Chat stream failed with ${response.status}`));
  }

  if (!response.body) {
    throw new Error("Chat stream response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      const event = parseSseBlock(block);
      if (event) {
        dispatchEvent(event, handlers);
      }
    }
  }

  buffer += decoder.decode();
  const trailingEvent = parseSseBlock(buffer);
  if (trailingEvent) {
    dispatchEvent(trailingEvent, handlers);
  }
}

function parseSseBlock(block: string): ChatStreamEvent | null {
  const lines = block.split(/\r?\n/);
  let eventName = "";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (!eventName || dataLines.length === 0) {
    return null;
  }

  const data = JSON.parse(dataLines.join("\n")) as unknown;

  switch (eventName) {
    case "start":
      return { event: "start", data: data as StartEventData };
    case "metadata":
      return { event: "metadata", data: data as MetadataEventData };
    case "delta":
      return { event: "delta", data: data as DeltaEventData };
    case "done":
      return { event: "done", data: data as DoneEventData };
    case "error":
      return { event: "error", data: data as ErrorEventData };
    default:
      return null;
  }
}

function dispatchEvent(
  event: ChatStreamEvent,
  handlers: ChatStreamHandlers
): void {
  handlers.onEvent?.(event);

  if (event.event === "start") {
    handlers.onStart?.(event.data);
  }

  if (event.event === "metadata") {
    handlers.onMetadata?.(event.data);
  }

  if (event.event === "delta") {
    handlers.onDelta?.(event.data);
  }

  if (event.event === "done") {
    handlers.onDone?.(event.data);
  }

  if (event.event === "error") {
    handlers.onErrorEvent?.(event.data);
  }
}
