"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { checkHealth, type HealthResponse } from "@/lib/api/health";
import { recognizeOcrImage } from "@/lib/api/ocr";
import { createPlotPreview } from "@/lib/api/plots";
import { deleteSession, getSession, listSessions } from "@/lib/api/sessions";
import { streamChat } from "@/lib/api/chatStream";
import { PlotViewer } from "@/features/plots/PlotViewer";
import type {
  AnswerMode,
  ChatMessage,
  MetadataEventData,
  OCRRecognizeResponse,
  PlotPreviewRequest,
  PlotPreviewResponse,
  QuestionType,
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

  async function loadSession(sessionId: string) {
    if (isStreaming) {
      return;
    }

    try {
      const detail = await getSession(sessionId);
      const plotLookup = buildPlotLookup(
        detail.artifacts.filter((artifact) => artifact.artifact_type === "plot_preview")
      );
      const loadedMessages = detail.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        status: "done" as const,
        plot: message.role === "assistant" ? plotLookup.get(message.id) ?? null : null
      }));

      setMessages(loadedMessages);
      setMetadata({
        ...initialMetadata,
        sessionId: detail.session.id,
        answerMode:
          detail.session.default_answer_mode === "direct" ||
          detail.session.default_answer_mode === "hint"
            ? detail.session.default_answer_mode
            : "guided"
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
      status: "done"
    };
    const assistantId = createId("assistant");
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming"
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
                  item.id === userMessage.id ? { ...item, id: data.user_message_id as string } : item
                )
              );
            }
          },
          onMetadata: (data: MetadataEventData) => {
            setMetadata((current) => ({
              ...current,
              questionType: data.question_type,
              shouldVisualize: data.should_visualize,
              plotSuggestion: data.plot_suggestion
            }));
            if (data.plot_suggestion) {
              setMessages((current) =>
                current.map((item) =>
                  item.id === assistantId
                    ? { ...item, plotSuggestion: data.plot_suggestion }
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
                      status: "done"
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
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId ? { ...item, plotLoading: true, plotError: null } : item
      )
    );

    try {
      const plot = await createPlotPreview({
        ...request,
        session_id: metadata.sessionId,
        message_id: messageId.startsWith("msg-") ? messageId : null
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
    <main className="h-dvh overflow-hidden bg-[#f6f7f4] text-neutral-950">
      <div className="flex h-full min-h-0">
        <SessionRail
          activeSessionId={metadata.sessionId}
          health={health}
          onDeleteSession={removeSession}
          onNewSession={startNewSession}
          onPickSession={loadSession}
          sessions={sessions}
        />

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="shrink-0 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-950 text-sm font-semibold text-white">
                  M
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Math Agent
                  </p>
                  <h1 className="truncate text-lg font-semibold tracking-normal text-neutral-950 sm:text-2xl">
                    数学分析学习工作台
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
            <div className="mx-auto flex min-h-full max-w-6xl flex-col">
              {messages.length === 0 ? (
                <Starter
                  onPickExample={(example) => {
                    setAnswerMode(example.mode);
                    setInput(example.prompt);
                  }}
                />
              ) : (
                <div className="space-y-5 pb-6">
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
    <aside className="hidden w-80 shrink-0 border-r border-neutral-200 bg-[#111312] text-white lg:flex lg:flex-col">
      <div className="border-b border-white/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Sessions
        </p>
        <p className="mt-2 text-sm leading-6 text-white/70">
          本机学习记录，用于回看题目、回答和图形。
        </p>
        <button
          className="mt-4 h-11 w-full rounded-md bg-white px-3 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-50"
          onClick={onNewSession}
          type="button"
        >
          新建会话
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
      className={`group flex items-start gap-2 rounded-md px-2 py-2 transition ${
        active ? "bg-emerald-400 text-neutral-950" : "text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      <button className="min-w-0 flex-1 text-left text-sm leading-5" onClick={onPick} type="button">
        <span className="line-clamp-2 font-medium">{session.title ?? "未命名会话"}</span>
        <span className={`mt-1 block text-xs ${active ? "text-neutral-700" : "text-white/40"}`}>
          {formatSessionTime(session.updated_at)}
        </span>
      </button>
      <button
        aria-label="删除会话"
        className={`h-7 w-7 shrink-0 rounded text-sm transition ${
          active ? "text-neutral-700 hover:bg-black/10" : "text-white/45 hover:bg-white/10 hover:text-white"
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
    <div className="flex flex-1 flex-col justify-start gap-6 py-4 sm:justify-center sm:py-8">
      <div>
        <p className="text-sm font-semibold text-emerald-700">开始一个学习回合</p>
        <h2 className="mt-3 max-w-3xl text-2xl font-semibold tracking-normal text-neutral-950 sm:text-4xl">
          输入题目或上传图片，答案和图形都会留在同一条学习线索里
        </h2>
        <p className="mt-3 max-w-2xl text-base leading-7 text-neutral-600">
          图片会先被识别成可编辑文本，你确认后再发送；生成的图形会随会话保存。
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {examples.map((example) => (
          <button
            className="min-h-28 rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
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
        className={`max-w-[92%] rounded-lg px-4 py-3 shadow-sm sm:max-w-[78%] ${
          isUser
            ? "bg-neutral-950 text-white"
            : "border border-neutral-200 bg-white text-neutral-900"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">
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
        {!isUser && message.plotSuggestion && !message.plot ? (
          <button
            className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:opacity-60"
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
          <PlotViewer className="mt-4" onExpand={() => onExpandPlot(message.plot as PlotPreviewResponse)} plot={message.plot} />
        ) : null}
      </div>
    </article>
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
      <div className="mx-auto max-w-6xl space-y-3">
        <ModeSelector answerMode={answerMode} disabled={disabled} onChange={onAnswerModeChange} />
        <AttachmentStatus attachment={attachment} onClear={onClearAttachment} />
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
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
              className="max-h-40 min-h-16 flex-1 resize-none border-0 bg-transparent px-1 py-2 text-base leading-6 text-neutral-950 outline-none placeholder:text-neutral-400 disabled:text-neutral-400"
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
    <div className="grid grid-cols-3 gap-2">
      {answerModes.map((mode) => {
        const active = mode.value === answerMode;
        return (
          <button
            className={`min-h-11 rounded-md border px-2 py-2 text-center transition disabled:cursor-not-allowed sm:px-3 sm:text-left ${
              active
                ? "border-emerald-700 bg-emerald-50 text-emerald-950"
                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
            }`}
            disabled={disabled}
            key={mode.value}
            onClick={() => onChange(mode.value)}
            type="button"
          >
            <span className="block text-sm font-semibold">{mode.label}</span>
            <span className="hidden text-xs text-neutral-500 sm:block">{mode.description}</span>
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
  }>
): Map<string, PlotPreviewResponse> {
  const lookup = new Map<string, PlotPreviewResponse>();
  for (const artifact of [...artifacts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const plot = artifact.payload.plot;
    if (artifact.message_id && isPlotPreviewResponse(plot)) {
      lookup.set(artifact.message_id, plot);
    }
  }
  return lookup;
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

function getPlotTypeLabel(plotType: PlotPreviewResponse["plot_type"]) {
  if (plotType === "surface3d") {
    return "三维曲面";
  }
  if (plotType === "region2d") {
    return "二维区域";
  }
  return "二维函数";
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
