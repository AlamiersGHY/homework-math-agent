export type AnswerMode = "direct" | "guided" | "hint";

export type QuestionType =
  | "conceptual"
  | "computational"
  | "proof"
  | "visualization"
  | "mixed"
  | "ocr_derived"
  | "off_topic"
  | "unknown";

export type PlotType = "function2d" | "surface3d" | "region2d" | "implicit3d";

export type ChatRole = "user" | "assistant";

export type ChatStyle = "default" | "playful" | "strict" | "custom";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  attachments?: ChatMessageAttachment[];
  status?: "streaming" | "done" | "error";
  persisted?: boolean;
  answerMode?: AnswerMode | string | null;
  questionType?: QuestionType | string | null;
  source?: string | null;
  retrievalAttempted?: boolean;
  retrievedSources?: RetrievedSource[];
  plotSuggestion?: PlotPreviewRequest | null;
  plot?: PlotPreviewResponse | null;
  plotLoading?: boolean;
  plotError?: string | null;
  quickReplies?: string[];
};

export type ChatMessageAttachment = {
  id: string;
  kind: "image";
  fileName: string;
  previewUrl: string;
  annotated?: boolean;
  isLegacyPlaceholder?: boolean;
};

export type ChatAttachmentSnapshot = {
  id: string;
  kind: "image";
  file_name: string;
  preview_data_url?: string | null;
  annotated?: boolean;
};

export type ChatStreamRequest = {
  message: string;
  answer_mode: AnswerMode;
  session_id?: string | null;
  confirmed_ocr_text?: string | null;
  attachments?: ChatAttachmentSnapshot[];
  context?: {
    previous_turns: Array<{
      role: ChatRole;
      content: string;
    }>;
    style: string;
    soul?: string | null;
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
  planner?: AgentPolicyPlan | null;
  retrieval_attempted?: boolean;
  retrieved_sources?: RetrievedSource[];
  citations?: RetrievedSource[];
  quick_replies?: string[];
  quick_reply_source?: "llm" | "fallback" | "pending";
};

export type AgentPolicyPlan = {
  question_type: QuestionType;
  needs_retrieval: boolean;
  needs_plot: boolean;
  needs_clarification: boolean;
  answer_mode: AnswerMode;
  retrieval_scope: "none" | "uploaded_course_materials";
  plot_type: PlotType | null;
  plot_suggestion: PlotPreviewRequest | null;
  memory_action: "none" | "record_weak_point" | "record_preference";
  input_source: "text" | "ocr";
  reason: string;
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

export type DocumentStatus = "ready" | "failed";

export type DocumentSummary = {
  id: string;
  filename: string;
  content_type: string;
  status: DocumentStatus;
  page_count: number | null;
  chunk_count: number;
  warnings: string[];
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentUploadResponse = {
  document: DocumentSummary;
};

export type RetrievedSource = {
  source_index: number;
  score?: number;
  chunk_id: string;
  document_id: string;
  filename: string;
  page_start: number;
  page_end: number;
  section_title?: string | null;
  snippet: string;
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
