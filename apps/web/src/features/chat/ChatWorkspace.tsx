"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { checkHealth, type HealthResponse } from "@/lib/api/health";
import { deleteDocument, listDocuments, uploadDocument } from "@/lib/api/documents";
import { recognizeOcrImage } from "@/lib/api/ocr";
import { createPlotPreview } from "@/lib/api/plots";
import { deleteSession, getSession, listSessions } from "@/lib/api/sessions";
import { streamChat } from "@/lib/api/chatStream";
import { PlotViewer } from "@/features/plots/PlotViewer";
import type {
  AnswerMode,
  ChatMessage,
  DocumentSummary,
  MetadataEventData,
  OCRRecognizeResponse,
  PlotPreviewRequest,
  PlotPreviewResponse,
  QuestionType,
  RetrievedSource,
  SessionSummary,
  StartEventData
} from "@/types/chat";

const answerModes: Array<{
  value: AnswerMode;
  label: string;
  description: string;
}> = [
  { value: "guided", label: "分步引导", description: "先定位思路和下一步" },
  { value: "direct", label: "直接解答", description: "给出结论与关键步骤" },
  { value: "hint", label: "仅提示", description: "保留独立思考空间" }
];

const examples = [
  {
    label: "极限计算",
    prompt: "求 lim(x→0) sin(x)/x，并说明关键思路",
    mode: "guided" as AnswerMode
  },
  {
    label: "证明引导",
    prompt: "证明单调有界数列必有极限",
    mode: "guided" as AnswerMode
  },
  {
    label: "三维曲面",
    prompt: "画一下 z = sin(x*y) 的三维曲面，并解释形状",
    mode: "direct" as AnswerMode
  }
];

const questionTypeLabels: Record<QuestionType, string> = {
  conceptual: "概念理解",
  computational: "计算推导",
  proof: "证明思路",
  visualization: "图形直觉",
  mixed: "混合问题",
  ocr_derived: "图片题面",
  off_topic: "范围外",
  unknown: "待判断"
};

type HealthState =
  | { status: "checking" }
  | { status: "online"; data: HealthResponse }
  | { status: "offline"; message: string };

type ChatMetadata = {
  sessionId: string | null;
  answerMode: AnswerMode;
  questionType: QuestionType;
  shouldVisualize: boolean;
  finishReason: string | null;
  plotSuggestion: PlotPreviewRequest | null;
};

type AttachmentState =
  | { status: "idle" }
  | { status: "recognizing"; fileName: string; previewUrl: string | null }
  | {
      status: "ready";
      fileName: string;
      previewUrl: string | null;
      result: OCRRecognizeResponse;
      recognizedText: string;
    }
  | { status: "error"; message: string; fileName?: string; previewUrl?: string | null };

type PlotModalState = {
  plot: PlotPreviewResponse;
  title: string;
} | null;

type MaterialsState = {
  items: DocumentSummary[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
};

const initialMetadata: ChatMetadata = {
  sessionId: null,
  answerMode: "guided",
  questionType: "unknown",
  shouldVisualize: false,
  finishReason: null,
  plotSuggestion: null
};

export function ChatWorkspace() {
  const [answerMode, setAnswerMode] = useState<AnswerMode>("guided");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metadata, setMetadata] = useState<ChatMetadata>(initialMetadata);
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [materials, setMaterials] = useState<MaterialsState>({
    items: [],
    loading: true,
    uploading: false,
    error: null
  });
  const [attachment, setAttachment] = useState<AttachmentState>({ status: "idle" });
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plotModal, setPlotModal] = useState<PlotModalState>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const currentMode = useMemo(
    () => answerModes.find((mode) => mode.value === answerMode) ?? answerModes[0],
    [answerMode]
  );
  const currentSessionTitle =
    sessions.find((session) => session.id === metadata.sessionId)?.title ?? "新学习会话";
  const canSubmit = Boolean(input.trim()) && !isStreaming;

  useEffect(() => {
    refreshHealth();
    refreshSessions();
    refreshMaterials();
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages.length, isStreaming]);

  async function refreshHealth() {
    try {
      const data = await checkHealth();
      setHealth({ status: "online", data });
    } catch (caught: unknown) {
      setHealth({
        status: "offline",
        message: caught instanceof Error ? caught.message : "Health check failed"
      });
    }
  }

  async function refreshSessions() {
    try {
      setSessions(await listSessions());
    } catch {
      setSessions([]);
    }
  }

  async function refreshMaterials() {
    setMaterials((current) => ({ ...current, loading: true, error: null }));
    try {
      const items = await listDocuments();
      setMaterials((current) => ({ ...current, items, loading: false, error: null }));
    } catch (caught: unknown) {
      setMaterials((current) => ({
        ...current,
        loading: false,
        error: caught instanceof Error ? caught.message : "材料列表加载失败"
      }));
    }
  }

  async function loadSession(sessionId: string) {
    if (isStreaming) {
      return;
    }

    try {
      const detail = await getSession(sessionId);
      const assistantIds = detail.messages
        .filter((message) => message.role === "assistant")
        .map((message) => message.id);
      const plotLookup = buildPlotLookup(
        detail.artifacts.filter((artifact) => artifact.artifact_type === "plot_preview"),
        assistantIds
      );
      const suggestionLookup = buildPlotSuggestionLookup(
        detail.artifacts.filter((artifact) => artifact.artifact_type === "plot_suggestion"),
        assistantIds
      );
      const metadataLookup = buildChatMetadataLookup(
        detail.artifacts.filter((artifact) => artifact.artifact_type === "chat_metadata"),
        assistantIds
      );
      const loadedMessages: ChatMessage[] = detail.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: "done" as const,
        persisted: true,
        answerMode: message.answer_mode,
        questionType: message.question_type,
        source: message.source,
        plot: message.role === "assistant" ? plotLookup.get(message.id) ?? null : null,
        plotSuggestion:
          message.role === "assistant"
            ? suggestionLookup.get(message.id) ??
              metadataLookup.get(message.id)?.plot_suggestion ??
              null
            : null,
        retrievalAttempted:
          message.role === "assistant"
            ? metadataLookup.get(message.id)?.retrieval_attempted ?? false
            : false,
        retrievedSources:
          message.role === "assistant"
            ? metadataLookup.get(message.id)?.citations ??
              metadataLookup.get(message.id)?.retrieved_sources ??
              []
            : []
      }));

      setMessages(loadedMessages);
      setMetadata({
        ...initialMetadata,
        sessionId: detail.session.id,
        answerMode:
          detail.session.default_answer_mode === "direct" ||
          detail.session.default_answer_mode === "hint"
            ? detail.session.default_answer_mode
            : "guided",
        questionType: latestQuestionType(loadedMessages)
      });
      setError(null);
      setAttachment({ status: "idle" });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "会话加载失败");
    }
  }

  async function removeSession(sessionId: string) {
    if (isStreaming) {
      return;
    }

    try {
      await deleteSession(sessionId);
      if (metadata.sessionId === sessionId) {
        startNewSession();
      }
      await refreshSessions();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "会话删除失败");
    }
  }

  async function handlePdfPick(file: File | null) {
    if (!file) {
      return;
    }

    setMaterials((current) => ({ ...current, uploading: true, error: null }));
    try {
      const uploaded = await uploadDocument(file);
      setMaterials((current) => ({
        ...current,
        items: upsertDocument(current.items, uploaded),
        uploading: false,
        error: uploaded.status === "failed" ? uploaded.error_message ?? "PDF 未提取到可检索文本" : null
      }));
      await refreshMaterials();
    } catch (caught: unknown) {
      setMaterials((current) => ({
        ...current,
        uploading: false,
        error: caught instanceof Error ? caught.message : "PDF 上传失败"
      }));
    }
  }

  async function removeDocument(documentId: string) {
    setMaterials((current) => ({ ...current, error: null }));
    try {
      await deleteDocument(documentId);
      setMaterials((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== documentId)
      }));
    } catch (caught: unknown) {
      setMaterials((current) => ({
        ...current,
        error: caught instanceof Error ? caught.message : "材料删除失败"
      }));
    }
  }

  async function sendMessage(messageText: string, modeOverride = answerMode) {
    const actualText = messageText.trim();
    const cameFromOcr = attachment.status === "ready";

    if (!actualText || isStreaming) {
      return;
    }

    const previousTurns = messages
      .filter((item) => item.content.trim())
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: actualText,
      status: "done",
      persisted: false
    };
    const assistantId = createId("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      persisted: false
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setAttachment({ status: "idle" });
    setError(null);
    setMetadata({
      ...initialMetadata,
      sessionId: metadata.sessionId,
      answerMode: modeOverride
    });
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChat(
        {
          message: cameFromOcr ? "请帮我做这道 OCR 识别出来的题" : actualText,
          answer_mode: modeOverride,
          session_id: metadata.sessionId,
          confirmed_ocr_text: cameFromOcr ? actualText : null,
          context: {
            previous_turns: previousTurns,
            style: "default"
          }
        },
        {
          onStart: (data: StartEventData) => {
            setMetadata((current) => ({
              ...current,
              sessionId: data.session_id,
              answerMode: data.answer_mode
            }));
            if (data.user_message_id) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === userMessage.id
                    ? { ...item, id: data.user_message_id as string, persisted: true }
                    : item
                )
              );
            }
          },
          onMetadata: (data: MetadataEventData) => {
            const sources = data.citations ?? data.retrieved_sources ?? [];
            setMetadata((current) => ({
              ...current,
              questionType: data.question_type,
              shouldVisualize: data.should_visualize,
              plotSuggestion: data.plot_suggestion
            }));
            if (data.plot_suggestion || data.retrieval_attempted !== undefined || sources.length > 0) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? {
                        ...item,
                        plotSuggestion: data.plot_suggestion ?? item.plotSuggestion,
                        retrievalAttempted: data.retrieval_attempted ?? item.retrievalAttempted,
                        retrievedSources: sources.length > 0 ? sources : item.retrievedSources ?? []
                      }
                    : item
                )
              );
            }
          },
          onDelta: (data) => {
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? { ...item, content: item.content + data.text }
                  : item
              )
            );
          },
          onErrorEvent: (data) => {
            setError(data.message);
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId ? { ...item, status: "error" } : item
              )
            );
          },
          onDone: (data) => {
            setMetadata((current) => ({
              ...current,
              finishReason: data.finish_reason
            }));
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      id: data.assistant_message_id ?? item.id,
                      status: "done",
                      persisted: Boolean(data.assistant_message_id)
                    }
                  : item
              )
            );
          }
        },
        controller.signal
      );
      await refreshSessions();
    } catch (caught: unknown) {
      if (!controller.signal.aborted) {
        const messageText =
          caught instanceof Error ? caught.message : "Chat stream failed";
        setError(messageText);
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantId
              ? {
                  ...item,
                  content:
                    item.content ||
                    "暂时无法连接后端服务，请确认 FastAPI 已启动。",
                  status: "error"
                }
              : item
          )
        );
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsStreaming(false);
      }
      abortControllerRef.current = null;
    }
  }

  async function handleSubmit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    await sendMessage(input);
  }

  async function handleImagePick(file: File | null) {
    if (!file) {
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setAttachment({ status: "recognizing", fileName: file.name, previewUrl });
    setError(null);

    try {
      const result = await recognizeOcrImage(file);
      const recognizedText = result.recognized_text.trim();
      setAttachment({
        status: "ready",
        fileName: file.name,
        previewUrl,
        result,
        recognizedText
      });
      setInput((current) => (current.trim() ? `${current.trim()}\n\n${recognizedText}` : recognizedText));
    } catch (caught: unknown) {
      setAttachment({
        status: "error",
        fileName: file.name,
        previewUrl,
        message: caught instanceof Error ? caught.message : "OCR 识别失败"
      });
    }
  }

  async function generatePlot(messageId: string, request: PlotPreviewRequest) {
    const targetMessage = messages.find((message) => message.id === messageId);
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId ? { ...item, plotLoading: true, plotError: null } : item
      )
    );

    try {
      const plot = await createPlotPreview({
        ...request,
        session_id: metadata.sessionId,
        message_id: targetMessage?.persisted ? messageId : null
      });
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, plot, plotLoading: false } : item
        )
      );
    } catch (caught: unknown) {
      const plotError = caught instanceof Error ? caught.message : "图形生成失败";
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, plotError, plotLoading: false } : item
        )
      );
    }
  }

  function stopStreaming() {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setMessages((current) =>
      current.map((item) =>
        item.status === "streaming" ? { ...item, status: "done" } : item
      )
    );
  }

  function startNewSession() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setMessages([]);
    setInput("");
    setError(null);
    setIsStreaming(false);
    setAttachment({ status: "idle" });
    setMetadata({
      ...initialMetadata,
      answerMode
    });
  }

  return (
    <main className="h-dvh overflow-hidden bg-[#f4f5f0] text-neutral-950">
      <div className="flex h-full min-h-0">
        <SessionRail
          activeSessionId={metadata.sessionId}
          health={health}
          onDeleteSession={removeSession}
          onNewSession={startNewSession}
          onPickSession={loadSession}
          sessions={sessions}
        />

        <section className="flex min-w-0 flex-1 flex-col bg-[linear-gradient(180deg,#fbfbf8_0%,#f4f5f0_100%)]">
          <header className="shrink-0 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white shadow-sm">
                  M
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-emerald-700">
                    Math Agent
                  </p>
                  <h1 className="truncate text-base font-semibold tracking-normal text-neutral-950 sm:text-xl">
                    智能课程助教
                  </h1>
                </div>
              </div>
              <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
                <span className="max-w-[26rem] truncate rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 font-medium text-neutral-700">
                  {currentSessionTitle}
                </span>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-medium text-neutral-700">
                  {currentMode.label}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-medium text-emerald-800">
                  {questionTypeLabels[metadata.questionType]}
                </span>
              </div>
            </div>
          </header>

          <MobileSessionStrip
            activeSessionId={metadata.sessionId}
            onDeleteSession={removeSession}
            onNewSession={startNewSession}
            onPickSession={loadSession}
            sessions={sessions}
          />

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6" ref={transcriptRef}>
            <div className="mx-auto flex min-h-full max-w-5xl flex-col">
              {messages.length === 0 ? (
                <Starter
                  onPickExample={(example) => {
                    setAnswerMode(example.mode);
                    setInput(example.prompt);
                  }}
                />
              ) : (
                <div className="space-y-4 pb-6">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      onExpandPlot={(plot) =>
                        setPlotModal({ plot, title: getPlotTypeLabel(plot.plot_type) })
                      }
                      onGeneratePlot={(request) => generatePlot(message.id, request)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {error ? (
            <div className="shrink-0 border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700 sm:px-6">
              <div className="mx-auto max-w-6xl">{error}</div>
            </div>
          ) : null}

          <MaterialsStrip
            disabled={isStreaming}
            materials={materials}
            onDeleteDocument={removeDocument}
            onPdfPick={handlePdfPick}
          />

          <Composer
            answerMode={answerMode}
            attachment={attachment}
            canSubmit={canSubmit}
            disabled={isStreaming}
            input={input}
            onAnswerModeChange={setAnswerMode}
            onClearAttachment={() => setAttachment({ status: "idle" })}
            onImagePick={handleImagePick}
            onInputChange={setInput}
            onSubmit={handleSubmit}
            onStop={stopStreaming}
          />
        </section>
      </div>

      {plotModal ? (
        <PlotModal
          onClose={() => setPlotModal(null)}
          plot={plotModal.plot}
          title={plotModal.title}
        />
      ) : null}
    </main>
  );
}

function SessionRail({
  activeSessionId,
  health,
  onDeleteSession,
  onNewSession,
  onPickSession,
  sessions
}: {
  activeSessionId: string | null;
  health: HealthState;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onPickSession: (sessionId: string) => void;
  sessions: SessionSummary[];
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-neutral-200 bg-[#181a18] text-white lg:flex lg:flex-col">
      <div className="border-b border-white/10 p-4">
        <p className="text-xs font-semibold uppercase text-white/45">
          Local Sessions
        </p>
        <button
          className="mt-3 h-10 w-full rounded-md bg-white px-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-50"
          onClick={onNewSession}
          type="button"
        >
          新建会话
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <p className="rounded-md px-3 py-3 text-sm leading-6 text-white/50">
              发送第一条问题后会自动保存。
            </p>
          ) : (
            sessions.map((session) => (
              <SessionRow
                active={activeSessionId === session.id}
                key={session.id}
                onDelete={() => onDeleteSession(session.id)}
                onPick={() => onPickSession(session.id)}
                session={session}
              />
            ))
          )}
        </div>
      </div>
      <div className="border-t border-white/10 p-4">
        <HealthPill health={health} />
      </div>
    </aside>
  );
}

function SessionRow({
  active,
  onDelete,
  onPick,
  session
}: {
  active: boolean;
  onDelete: () => void;
  onPick: () => void;
  session: SessionSummary;
}) {
  return (
    <div
      className={`group flex items-start gap-2 rounded-md px-2.5 py-2.5 transition ${
        active
          ? "bg-white text-neutral-950 shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <button className="min-w-0 flex-1 text-left text-sm leading-5" onClick={onPick} type="button">
        <span className="line-clamp-2 font-medium">{session.title ?? "未命名会话"}</span>
        <span className={`mt-1 block text-xs ${active ? "text-neutral-500" : "text-white/40"}`}>
          {formatSessionTime(session.updated_at)}
        </span>
      </button>
      <button
        aria-label="删除会话"
        className={`h-7 w-7 shrink-0 rounded-md text-sm opacity-0 transition group-hover:opacity-100 focus:opacity-100 ${
          active ? "text-neutral-500 hover:bg-black/10" : "text-white/45 hover:bg-white/10 hover:text-white"
        }`}
        onClick={(event) => {
          event.stopPropagation();
          onDelete();
        }}
        title="删除会话"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

function HealthPill({ health }: { health: HealthState }) {
  if (health.status === "checking") {
    return <span className="text-sm text-white/55">服务连接中</span>;
  }

  if (health.status === "offline") {
    return (
      <span className="text-sm text-amber-200" title={health.message}>
        服务暂不可用
      </span>
    );
  }

  return <span className="text-sm text-emerald-200">服务已连接</span>;
}

function MobileSessionStrip({
  activeSessionId,
  onDeleteSession,
  onNewSession,
  onPickSession,
  sessions
}: {
  activeSessionId: string | null;
  onDeleteSession: (sessionId: string) => void;
  onNewSession: () => void;
  onPickSession: (sessionId: string) => void;
  sessions: SessionSummary[];
}) {
  return (
    <div className="shrink-0 border-b border-neutral-200 bg-white px-4 py-2 lg:hidden">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          className="h-9 shrink-0 rounded-md bg-neutral-950 px-3 text-sm font-semibold text-white"
          onClick={onNewSession}
          type="button"
        >
          新建
        </button>
        {sessions.length === 0 ? (
          <span className="shrink-0 text-sm text-neutral-500">发送后自动保存会话</span>
        ) : (
          sessions.slice(0, 8).map((session) => (
            <span
              className={`flex h-9 max-w-56 shrink-0 items-center gap-1 rounded-md border pl-3 pr-1 text-sm ${
                activeSessionId === session.id
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-neutral-200 bg-neutral-50 text-neutral-700"
              }`}
              key={session.id}
            >
              <button
                className="max-w-40 truncate"
                onClick={() => onPickSession(session.id)}
                type="button"
              >
                {session.title ?? "未命名会话"}
              </button>
              <button
                aria-label="删除会话"
                className="h-7 w-7 rounded text-neutral-500"
                onClick={() => onDeleteSession(session.id)}
                type="button"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function Starter({
  onPickExample
}: {
  onPickExample: (example: (typeof examples)[number]) => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 py-4 sm:py-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">新的学习回合</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal text-neutral-950 sm:text-3xl">
          直接提问，图片题面、推导和可视化会保存在同一段对话里
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {examples.map((example) => (
          <button
            className="min-h-24 rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
            key={example.label}
            onClick={() => onPickExample(example)}
            type="button"
          >
            <span className="text-sm font-semibold text-neutral-950">{example.label}</span>
            <span className="mt-2 block text-sm leading-6 text-neutral-600">
              {example.prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onExpandPlot,
  onGeneratePlot
}: {
  message: ChatMessage;
  onExpandPlot: (plot: PlotPreviewResponse) => void;
  onGeneratePlot: (request: PlotPreviewRequest) => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[94%] rounded-lg px-4 py-3 shadow-sm sm:max-w-[82%] ${
          isUser
            ? "bg-neutral-950 text-white"
            : "border border-neutral-200 bg-white text-neutral-900"
        }`}
      >
        <p className="text-xs font-semibold uppercase opacity-70">
          {isUser ? "You" : "Math Agent"}
        </p>
        <div className="mt-2">
          <MathMarkdown inverted={isUser}>
            {message.content ||
              (message.status === "streaming" ? "正在生成回答" : "暂无内容")}
          </MathMarkdown>
        </div>
        {message.status === "streaming" ? (
          <span className="mt-3 block h-1 w-16 overflow-hidden rounded-full bg-neutral-200">
            <span className="block h-full w-1/2 animate-pulse rounded-full bg-emerald-600" />
          </span>
        ) : null}
        {!isUser ? (
          <SourcesPanel
            retrievalAttempted={Boolean(message.retrievalAttempted)}
            sources={message.retrievedSources ?? []}
          />
        ) : null}
        {!isUser && message.plotSuggestion && !message.plot ? (
          <button
            className="mt-3 inline-flex h-9 items-center rounded-md border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
            disabled={Boolean(message.plotLoading) || message.status === "streaming"}
            onClick={() => onGeneratePlot(message.plotSuggestion as PlotPreviewRequest)}
            type="button"
          >
            {message.plotLoading
              ? "正在生成图形"
              : message.status === "streaming"
                ? "回答完成后可生成图形"
                : "生成可视化图形"}
          </button>
        ) : null}
        {message.plotError ? (
          <p className="mt-3 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
            {message.plotError}
          </p>
        ) : null}
        {message.plot ? (
          <PlotViewer
            className="mt-4"
            onExpand={() => onExpandPlot(message.plot as PlotPreviewResponse)}
            plot={message.plot}
          />
        ) : null}
      </div>
    </article>
  );
}

function SourcesPanel({
  retrievalAttempted,
  sources
}: {
  retrievalAttempted: boolean;
  sources: RetrievedSource[];
}) {
  if (!retrievalAttempted && sources.length === 0) {
    return null;
  }

  if (sources.length === 0) {
    return (
      <div className="mt-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        未在已上传材料中找到可引用依据。
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-emerald-100 bg-emerald-50/60 p-3">
      <p className="text-xs font-semibold uppercase text-emerald-800">引用材料</p>
      <div className="grid gap-2">
        {sources.slice(0, 4).map((source) => (
          <div
            className="rounded-md border border-white/70 bg-white px-3 py-2 text-sm shadow-sm"
            key={source.chunk_id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-emerald-700 px-1.5 text-xs font-semibold text-white">
                {source.source_index}
              </span>
              <span className="min-w-0 max-w-full truncate font-semibold text-neutral-950">
                {source.filename}
              </span>
              <span className="text-xs font-medium text-neutral-500">
                {formatPageRange(source)}
              </span>
              {source.section_title ? (
                <span className="max-w-full truncate rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600">
                  {source.section_title}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 line-clamp-2 leading-6 text-neutral-600">{source.snippet}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MaterialsStrip({
  disabled,
  materials,
  onDeleteDocument,
  onPdfPick
}: {
  disabled: boolean;
  materials: MaterialsState;
  onDeleteDocument: (documentId: string) => void;
  onPdfPick: (file: File | null) => void;
}) {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const readyCount = materials.items.filter((item) => item.status === "ready").length;

  return (
    <div className="shrink-0 border-t border-neutral-200 bg-[#f8f8f3] px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 text-sm">
        <button
          aria-label="上传 PDF 课程材料"
          className="inline-flex h-8 items-center rounded-md border border-neutral-300 bg-white px-3 font-semibold text-neutral-800 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || materials.uploading}
          onClick={() => pdfInputRef.current?.click()}
          title="上传 PDF 课程材料"
          type="button"
        >
          {materials.uploading ? "索引中" : "PDF 材料"}
        </button>
        <input
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={disabled || materials.uploading}
          onChange={(event) => {
            onPdfPick(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
          ref={pdfInputRef}
          type="file"
        />
        <span className="text-neutral-600">
          {materials.loading
            ? "正在读取材料"
            : readyCount > 0
              ? `${readyCount} 份材料可被自动检索`
              : "上传课程 PDF 后，相关问题会自动检索引用"}
        </span>
        {materials.items.slice(0, 3).map((item) => (
          <span
            className={`inline-flex max-w-64 items-center gap-1 rounded-md border px-2 py-1 ${
              item.status === "ready"
                ? "border-emerald-200 bg-white text-neutral-800"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
            key={item.id}
            title={item.error_message ?? item.filename}
          >
            <span className="truncate">{item.filename}</span>
            <span className="shrink-0 text-xs text-neutral-500">
              {item.status === "ready" ? `${item.chunk_count} 段` : "不可检索"}
            </span>
            <button
              aria-label={`删除材料 ${item.filename}`}
              className="ml-1 h-5 w-5 shrink-0 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              disabled={disabled}
              onClick={() => onDeleteDocument(item.id)}
              title="删除材料"
              type="button"
            >
              ×
            </button>
          </span>
        ))}
        {materials.items.length > 3 ? (
          <span className="text-xs font-medium text-neutral-500">+{materials.items.length - 3}</span>
        ) : null}
        {materials.error ? (
          <span className="min-w-0 flex-1 text-red-700">{materials.error}</span>
        ) : null}
      </div>
    </div>
  );
}

function Composer({
  answerMode,
  attachment,
  canSubmit,
  disabled,
  input,
  onAnswerModeChange,
  onClearAttachment,
  onImagePick,
  onInputChange,
  onSubmit,
  onStop
}: {
  answerMode: AnswerMode;
  attachment: AttachmentState;
  canSubmit: boolean;
  disabled: boolean;
  input: string;
  onAnswerModeChange: (mode: AnswerMode) => void;
  onClearAttachment: () => void;
  onImagePick: (file: File | null) => void;
  onInputChange: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onStop: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <form
      className="shrink-0 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.05)] backdrop-blur sm:px-6"
      onSubmit={onSubmit}
    >
      <div className="mx-auto max-w-5xl space-y-2.5">
        <ModeSelector answerMode={answerMode} disabled={disabled} onChange={onAnswerModeChange} />
        <AttachmentStatus attachment={attachment} onClear={onClearAttachment} />
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
            <button
              aria-label="上传图片"
              className="mb-1 h-9 w-9 shrink-0 rounded-md border border-neutral-200 text-lg font-semibold text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-700"
              disabled={disabled || attachment.status === "recognizing"}
              onClick={() => fileInputRef.current?.click()}
              title="上传图片"
              type="button"
            >
              +
            </button>
            <input
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => onImagePick(event.target.files?.[0] ?? null)}
              ref={fileInputRef}
              type="file"
            />
            <textarea
              className="max-h-36 min-h-14 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base leading-6 text-neutral-950 outline-none placeholder:text-neutral-400 disabled:text-neutral-400"
              disabled={disabled}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="输入数学分析问题、证明思路或函数表达式"
              value={input}
            />
          </div>
          <div className="flex w-24 shrink-0 flex-col gap-2 sm:w-28">
            <button
              className="h-11 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300"
              disabled={!canSubmit}
              type="submit"
            >
              发送
            </button>
            <button
              className="h-11 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
              disabled={!disabled}
              onClick={onStop}
              type="button"
            >
              停止
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function ModeSelector({
  answerMode,
  disabled,
  onChange
}: {
  answerMode: AnswerMode;
  disabled: boolean;
  onChange: (mode: AnswerMode) => void;
}) {
  return (
    <div className="inline-grid grid-cols-3 rounded-lg border border-neutral-200 bg-neutral-100 p-1">
      {answerModes.map((mode) => {
        const active = mode.value === answerMode;
        return (
          <button
            className={`h-9 rounded-md px-3 text-center text-sm transition disabled:cursor-not-allowed ${
              active
                ? "bg-white font-semibold text-neutral-950 shadow-sm"
                : "text-neutral-600 hover:text-neutral-950"
            }`}
            disabled={disabled}
            key={mode.value}
            onClick={() => onChange(mode.value)}
            type="button"
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

function AttachmentStatus({
  attachment,
  onClear
}: {
  attachment: AttachmentState;
  onClear: () => void;
}) {
  if (attachment.status === "idle") {
    return null;
  }

  const statusText =
    attachment.status === "recognizing"
      ? "正在识别"
      : attachment.status === "ready"
        ? "已识别为可编辑文本"
        : attachment.message;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm">
      <div className="min-w-0">
        <span className="font-semibold text-neutral-900">
          {attachment.fileName ?? "图片附件"}
        </span>
        <span
          className={`ml-2 ${
            attachment.status === "error" ? "text-red-700" : "text-neutral-600"
          }`}
        >
          {statusText}
        </span>
      </div>
      <button
        className="h-8 shrink-0 rounded-md border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700"
        onClick={onClear}
        type="button"
      >
        清除
      </button>
    </div>
  );
}

function PlotModal({
  onClose,
  plot,
  title
}: {
  onClose: () => void;
  plot: PlotPreviewResponse;
  title: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/55 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-6xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-950">{title}</p>
            <p className="text-xs text-neutral-500">放大查看图形细节</p>
          </div>
          <button
            className="h-9 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700"
            onClick={onClose}
            type="button"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <PlotViewer plot={plot} size="modal" />
        </div>
      </div>
    </div>
  );
}

function buildPlotLookup(
  artifacts: Array<{
    message_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>,
  assistantMessageIds: string[]
): Map<string, PlotPreviewResponse> {
  const lookup = new Map<string, PlotPreviewResponse>();
  const unlinkedPlots: PlotPreviewResponse[] = [];
  for (const artifact of [...artifacts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const plot = artifact.payload.plot;
    if (artifact.message_id && isPlotPreviewResponse(plot)) {
      lookup.set(artifact.message_id, plot);
    } else if (isPlotPreviewResponse(plot)) {
      unlinkedPlots.push(plot);
    }
  }
  for (const plot of unlinkedPlots) {
    const targetId = assistantMessageIds.find((id) => !lookup.has(id));
    if (targetId) {
      lookup.set(targetId, plot);
    }
  }
  return lookup;
}

function buildPlotSuggestionLookup(
  artifacts: Array<{
    message_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>,
  assistantMessageIds: string[]
): Map<string, PlotPreviewRequest> {
  const lookup = new Map<string, PlotPreviewRequest>();
  const unlinkedSuggestions: PlotPreviewRequest[] = [];
  for (const artifact of [...artifacts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const suggestion = artifact.payload.plot_suggestion;
    if (artifact.message_id && isPlotPreviewRequest(suggestion)) {
      lookup.set(artifact.message_id, suggestion);
    } else if (isPlotPreviewRequest(suggestion)) {
      unlinkedSuggestions.push(suggestion);
    }
  }
  for (const suggestion of unlinkedSuggestions) {
    const targetId = assistantMessageIds.find((id) => !lookup.has(id));
    if (targetId) {
      lookup.set(targetId, suggestion);
    }
  }
  return lookup;
}

type StoredChatMetadata = {
  question_type?: QuestionType;
  should_visualize?: boolean;
  plot_suggestion?: PlotPreviewRequest | null;
  retrieval_attempted?: boolean;
  retrieved_sources?: RetrievedSource[];
  citations?: RetrievedSource[];
};

function buildChatMetadataLookup(
  artifacts: Array<{
    message_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>,
  assistantMessageIds: string[]
): Map<string, StoredChatMetadata> {
  const lookup = new Map<string, StoredChatMetadata>();
  const unlinkedMetadata: StoredChatMetadata[] = [];
  for (const artifact of [...artifacts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const metadata = normalizeStoredChatMetadata(artifact.payload);
    if (!metadata) {
      continue;
    }
    if (artifact.message_id) {
      lookup.set(artifact.message_id, metadata);
    } else {
      unlinkedMetadata.push(metadata);
    }
  }
  for (const metadata of unlinkedMetadata) {
    const targetId = assistantMessageIds.find((id) => !lookup.has(id));
    if (targetId) {
      lookup.set(targetId, metadata);
    }
  }
  return lookup;
}

function normalizeStoredChatMetadata(payload: Record<string, unknown>): StoredChatMetadata | null {
  const retrievedSources = toRetrievedSources(payload.retrieved_sources);
  const citations = toRetrievedSources(payload.citations);
  const metadata: StoredChatMetadata = {
    question_type: isQuestionType(payload.question_type) ? payload.question_type : undefined,
    should_visualize:
      typeof payload.should_visualize === "boolean" ? payload.should_visualize : undefined,
    plot_suggestion: isPlotPreviewRequest(payload.plot_suggestion)
      ? payload.plot_suggestion
      : null,
    retrieval_attempted:
      typeof payload.retrieval_attempted === "boolean" ? payload.retrieval_attempted : undefined,
    retrieved_sources: retrievedSources,
    citations
  };
  if (
    metadata.question_type ||
    metadata.should_visualize !== undefined ||
    metadata.plot_suggestion ||
    metadata.retrieval_attempted !== undefined ||
    retrievedSources.length > 0 ||
    citations.length > 0
  ) {
    return metadata;
  }
  return null;
}

function isPlotPreviewResponse(value: unknown): value is PlotPreviewResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "plot_type" in value &&
    "renderer" in value &&
    "spec" in value &&
    "explanation" in value
  );
}

function isPlotPreviewRequest(value: unknown): value is PlotPreviewRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "plot_type" in value &&
    "expression" in value &&
    "variables" in value &&
    "ranges" in value
  );
}

function toRetrievedSources(value: unknown): RetrievedSource[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(isRetrievedSource);
}

function isRetrievedSource(value: unknown): value is RetrievedSource {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const source = value as Record<string, unknown>;
  return (
    typeof source.source_index === "number" &&
    typeof source.chunk_id === "string" &&
    typeof source.document_id === "string" &&
    typeof source.filename === "string" &&
    typeof source.page_start === "number" &&
    typeof source.page_end === "number" &&
    typeof source.snippet === "string"
  );
}

function latestQuestionType(messages: ChatMessage[]): QuestionType {
  const latest = [...messages]
    .reverse()
    .find((message) => typeof message.questionType === "string")?.questionType;
  return isQuestionType(latest) ? latest : "unknown";
}

function isQuestionType(value: unknown): value is QuestionType {
  return (
    value === "conceptual" ||
    value === "computational" ||
    value === "proof" ||
    value === "visualization" ||
    value === "mixed" ||
    value === "ocr_derived" ||
    value === "off_topic" ||
    value === "unknown"
  );
}

function getPlotTypeLabel(plotType: PlotPreviewResponse["plot_type"]) {
  if (plotType === "surface3d") {
    return "三维曲面";
  }
  if (plotType === "region2d") {
    return "二维区域";
  }
  return "二维函数";
}

function formatPageRange(source: RetrievedSource) {
  if (source.page_start === source.page_end) {
    return `p. ${source.page_start}`;
  }
  return `pp. ${source.page_start}-${source.page_end}`;
}

function upsertDocument(items: DocumentSummary[], document: DocumentSummary): DocumentSummary[] {
  const withoutExisting = items.filter((item) => item.id !== document.id);
  return [document, ...withoutExisting];
}

function formatSessionTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
