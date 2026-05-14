export type AnswerMode = "direct" | "guided" | "hint";

export type QuestionType =
  | "conceptual"
  | "computational"
  | "proof"
  | "visualization"
  | "unknown";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "streaming" | "done" | "error";
};

export type ChatStreamRequest = {
  message: string;
  answer_mode: AnswerMode;
  session_id?: string | null;
  confirmed_ocr_text?: string | null;
  context?: {
    previous_turns: Array<{
      role: ChatRole;
      content: string;
    }>;
    style: string;
  };
};

export type StartEventData = {
  session_id: string;
  answer_mode: AnswerMode;
};

export type MetadataEventData = {
  question_type: QuestionType;
  should_visualize: boolean;
  plot_suggestion: Record<string, unknown> | null;
};

export type DeltaEventData = {
  text: string;
};

export type DoneEventData = {
  finish_reason: string;
};

export type ErrorEventData = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ChatStreamEvent =
  | { event: "start"; data: StartEventData }
  | { event: "metadata"; data: MetadataEventData }
  | { event: "delta"; data: DeltaEventData }
  | { event: "done"; data: DoneEventData }
  | { event: "error"; data: ErrorEventData };
