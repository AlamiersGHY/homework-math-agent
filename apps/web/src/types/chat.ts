export type AnswerMode = "direct" | "guided" | "hint";

export type QuestionType =
  | "conceptual"
  | "computational"
  | "proof"
  | "visualization"
  | "unknown";

export type PlotType = "function2d" | "surface3d" | "region2d";

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  status?: "streaming" | "done" | "error";
  plotSuggestion?: PlotPreviewRequest | null;
  plot?: PlotPreviewResponse | null;
  plotLoading?: boolean;
  plotError?: string | null;
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
  user_message_id?: string | null;
};

export type MetadataEventData = {
  question_type: QuestionType;
  should_visualize: boolean;
  plot_suggestion: PlotPreviewRequest | null;
};

export type DeltaEventData = {
  text: string;
};

export type DoneEventData = {
  finish_reason: string;
  assistant_message_id?: string | null;
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

export type SessionSummary = {
  id: string;
  title: string | null;
  default_answer_mode: AnswerMode | string;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  role: ChatRole;
  content: string;
  answer_mode: AnswerMode | string | null;
  question_type: QuestionType | string | null;
  source: string | null;
  created_at: string;
};

export type SessionDetail = {
  session: SessionSummary;
  messages: StoredMessage[];
  artifacts: Array<{
    id: string;
    artifact_type: string;
    payload: Record<string, unknown>;
    message_id: string | null;
    created_at: string;
  }>;
};

export type OCRRecognizeResponse = {
  recognized_text: string;
  confidence: number | null;
  provider: string;
  warnings: string[];
};

export type PlotPreviewRequest = {
  plot_type: PlotType;
  expression: string;
  variables: string[];
  ranges: Record<string, [number, number]>;
  source?: string;
  session_id?: string | null;
  message_id?: string | null;
};

export type PlotPreviewResponse = {
  plot_type: PlotType;
  renderer: "plotly";
  spec: {
    data?: unknown[];
    layout?: Record<string, unknown>;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
  explanation: string;
};
