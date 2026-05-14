"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { checkHealth, type HealthResponse } from "@/lib/api/health";
import { recognizeOcrImage } from "@/lib/api/ocr";
import { createPlotPreview } from "@/lib/api/plots";
import { getSession, listSessions } from "@/lib/api/sessions";
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

const modeLabels: Record<AnswerMode, string> = {
  direct: "直接解答",
  guided: "分步引导",
  hint: "仅提示"
};

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

type InputMode = "text" | "image";

type ChatMetadata = {
  sessionId: string | null;
  answerMode: AnswerMode;
  questionType: QuestionType;
  shouldVisualize: boolean;
  finishReason: string | null;
  plotSuggestion: PlotPreviewRequest | null;
};

type OCRState =
  | { status: "idle" }
  | { status: "recognizing"; fileName: string; previewUrl: string | null }
  | {
      status: "ready";
      fileName: string;
      previewUrl: string | null;
      result: OCRRecognizeResponse;
      editableText: string;
    }
  | { status: "error"; message: string; fileName?: string; previewUrl?: string | null };

type PlotState =
  | { status: "idle" }
  | { status: "loading"; request: PlotPreviewRequest }
  | { status: "ready"; request: PlotPreviewRequest; plot: PlotPreviewResponse }
  | { status: "error"; request: PlotPreviewRequest; message: string };

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
  const [inputMode, setInputMode] = useState<InputMode>("text");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metadata, setMetadata] = useState<ChatMetadata>(initialMetadata);
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [ocrState, setOcrState] = useState<OCRState>({ status: "idle" });
  const [plotState, setPlotState] = useState<PlotState>({ status: "idle" });
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const currentMode = useMemo(
    () => answerModes.find((mode) => mode.value === answerMode) ?? answerModes[0],
    [answerMode]
  );
  const latestAssistant = [...messages].reverse().find((message) => message.role === "assistant");
  const activePlotSuggestion = latestAssistant?.plotSuggestion ?? metadata.plotSuggestion;

  useEffect(() => {
    refreshHealth();
    refreshSessions();
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages, plotState]);

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
      setMessages(
        detail.messages.map((message) => ({
          id: message.id,
          role: message.role,
          content: message.content,
          status: "done"
        }))
      );
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
      setPlotState({ status: "idle" });
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "会话加载失败");
    }
  }

  async function sendMessage(
    messageText: string,
    modeOverride = answerMode,
    confirmedOcrText: string | null = null
  ) {
    const message = messageText.trim();
    const actualText = (confirmedOcrText ?? message).trim();

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
    setError(null);
    setPlotState({ status: "idle" });
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
          message: confirmedOcrText ? "请帮我做这道 OCR 识别出来的题" : message,
          answer_mode: modeOverride,
          session_id: metadata.sessionId,
          confirmed_ocr_text: confirmedOcrText,
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
                item.id === assistantId ? { ...item, status: "done" } : item
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
    setOcrState({ status: "recognizing", fileName: file.name, previewUrl });
    setError(null);

    try {
      const result = await recognizeOcrImage(file);
      setOcrState({
        status: "ready",
        fileName: file.name,
        previewUrl,
        result,
        editableText: result.recognized_text
      });
    } catch (caught: unknown) {
      setOcrState({
        status: "error",
        fileName: file.name,
        previewUrl,
        message: caught instanceof Error ? caught.message : "OCR 识别失败"
      });
    }
  }

  async function submitOcrText() {
    if (ocrState.status !== "ready") {
      return;
    }
    await sendMessage(ocrState.editableText, answerMode, ocrState.editableText);
    setOcrState({ status: "idle" });
    setInputMode("text");
  }

  async function generatePlot(request: PlotPreviewRequest) {
    setPlotState({ status: "loading", request });
    try {
      const plot = await createPlotPreview(request);
      setPlotState({ status: "ready", request, plot });
    } catch (caught: unknown) {
      setPlotState({
        status: "error",
        request,
        message: caught instanceof Error ? caught.message : "图形生成失败"
      });
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
    setOcrState({ status: "idle" });
    setPlotState({ status: "idle" });
    setMetadata({
      ...initialMetadata,
      answerMode
    });
  }

  return (
    <main className="min-h-screen bg-[#f4f3ee] text-neutral-950">
      <div className="flex min-h-screen">
        <SessionRail
          activeSessionId={metadata.sessionId}
          health={health}
          onNewSession={startNewSession}
          onPickSession={loadSession}
          sessions={sessions}
        />

        <section className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="border-b border-neutral-200 bg-white/85 px-4 py-4 backdrop-blur sm:px-6">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                  Math Agent
                </p>
                <h1 className="mt-1 text-2xl font-semibold tracking-normal">
                  数学分析学习工作台
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 font-medium text-neutral-700">
                  {currentMode.label}
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
                  {questionTypeLabels[metadata.questionType]}
                </span>
              </div>
            </div>
          </header>

          <div
            className="mx-auto flex w-full max-w-5xl flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-6"
            ref={transcriptRef}
          >
            {messages.length === 0 ? (
              <Starter
                onPickExample={(example) => {
                  setAnswerMode(example.mode);
                  setInput(example.prompt);
                }}
              />
            ) : (
              <div className="space-y-5">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onGeneratePlot={generatePlot}
                  />
                ))}
                <PlotPanel
                  activePlotSuggestion={activePlotSuggestion}
                  onGeneratePlot={generatePlot}
                  plotState={plotState}
                />
              </div>
            )}
          </div>

          {error ? (
            <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
              <div className="mx-auto max-w-5xl">{error}</div>
            </div>
          ) : null}

          <Composer
            answerMode={answerMode}
            disabled={isStreaming}
            input={input}
            inputMode={inputMode}
            ocrState={ocrState}
            onAnswerModeChange={setAnswerMode}
            onImagePick={handleImagePick}
            onInputChange={setInput}
            onInputModeChange={setInputMode}
            onOcrTextChange={(value) => {
              setOcrState((current) =>
                current.status === "ready" ? { ...current, editableText: value } : current
              );
            }}
            onSubmit={handleSubmit}
            onSubmitOcr={submitOcrText}
            onStop={stopStreaming}
          />
        </section>
      </div>
    </main>
  );
}

function SessionRail({
  activeSessionId,
  health,
  onNewSession,
  onPickSession,
  sessions
}: {
  activeSessionId: string | null;
  health: HealthState;
  onNewSession: () => void;
  onPickSession: (sessionId: string) => void;
  sessions: SessionSummary[];
}) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-neutral-200 bg-neutral-950 text-white lg:flex lg:flex-col">
      <div className="border-b border-white/10 p-4">
        <button
          className="w-full rounded-md bg-white px-3 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-emerald-50"
          onClick={onNewSession}
          type="button"
        >
          新建学习会话
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/45">
          最近会话
        </p>
        <div className="space-y-1">
          {sessions.length === 0 ? (
            <p className="rounded-md px-2 py-3 text-sm leading-6 text-white/50">
              发送第一条问题后会自动保存到本机。
            </p>
          ) : (
            sessions.map((session) => (
              <button
                className={`w-full rounded-md px-3 py-2 text-left text-sm leading-5 transition ${
                  activeSessionId === session.id
                    ? "bg-emerald-500 text-neutral-950"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                key={session.id}
                onClick={() => onPickSession(session.id)}
                type="button"
              >
                <span className="line-clamp-2">{session.title ?? "未命名会话"}</span>
              </button>
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

function HealthPill({ health }: { health: HealthState }) {
  if (health.status === "checking") {
    return <span className="text-sm text-white/55">API 检查中</span>;
  }

  if (health.status === "offline") {
    return (
      <span className="text-sm text-amber-200" title={health.message}>
        API 未连接
      </span>
    );
  }

  return <span className="text-sm text-emerald-200">API {health.data.version}</span>;
}

function Starter({
  onPickExample
}: {
  onPickExample: (example: (typeof examples)[number]) => void;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-8 py-12">
      <div>
        <p className="text-sm font-semibold text-emerald-700">开始一个学习回合</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-semibold tracking-normal text-neutral-950">
          输入题目、上传图片，或直接生成函数图形来理解直觉
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {examples.map((example) => (
          <button
            className="rounded-lg border border-neutral-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:shadow-md"
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
  onGeneratePlot
}: {
  message: ChatMessage;
  onGeneratePlot: (request: PlotPreviewRequest) => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-lg px-4 py-3 shadow-sm ${
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
        {!isUser && message.plotSuggestion ? (
          <button
            className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            onClick={() => onGeneratePlot(message.plotSuggestion as PlotPreviewRequest)}
            type="button"
          >
            生成可视化图形
          </button>
        ) : null}
      </div>
    </article>
  );
}

function PlotPanel({
  activePlotSuggestion,
  onGeneratePlot,
  plotState
}: {
  activePlotSuggestion: PlotPreviewRequest | null;
  onGeneratePlot: (request: PlotPreviewRequest) => void;
  plotState: PlotState;
}) {
  if (plotState.status === "ready") {
    return <PlotViewer plot={plotState.plot} />;
  }

  if (plotState.status === "loading") {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        正在生成图形...
      </div>
    );
  }

  if (plotState.status === "error") {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
        {plotState.message}
      </div>
    );
  }

  if (!activePlotSuggestion) {
    return null;
  }

  return (
    <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-neutral-950">这道题适合配合图形理解</p>
      <p className="mt-1 text-sm leading-6 text-neutral-600">
        将生成 {activePlotSuggestion.plot_type === "surface3d" ? "三维曲面" : "二维函数"}：
        <span className="font-medium text-neutral-900">{activePlotSuggestion.expression}</span>
      </p>
      <button
        className="mt-3 rounded-md bg-neutral-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800"
        onClick={() => onGeneratePlot(activePlotSuggestion)}
        type="button"
      >
        生成图形
      </button>
    </div>
  );
}

function Composer({
  answerMode,
  disabled,
  input,
  inputMode,
  ocrState,
  onAnswerModeChange,
  onImagePick,
  onInputChange,
  onInputModeChange,
  onOcrTextChange,
  onSubmit,
  onSubmitOcr,
  onStop
}: {
  answerMode: AnswerMode;
  disabled: boolean;
  input: string;
  inputMode: InputMode;
  ocrState: OCRState;
  onAnswerModeChange: (mode: AnswerMode) => void;
  onImagePick: (file: File | null) => void;
  onInputChange: (value: string) => void;
  onInputModeChange: (mode: InputMode) => void;
  onOcrTextChange: (value: string) => void;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => void;
  onSubmitOcr: () => void;
  onStop: () => void;
}) {
  return (
    <form className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-6" onSubmit={onSubmit}>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <ModeSelector answerMode={answerMode} disabled={disabled} onChange={onAnswerModeChange} />
          <div className="grid grid-cols-2 rounded-md border border-neutral-200 bg-neutral-50 p-1 text-sm">
            {(["text", "image"] as InputMode[]).map((mode) => (
              <button
                className={`rounded px-3 py-1.5 font-semibold transition ${
                  inputMode === mode ? "bg-white text-neutral-950 shadow-sm" : "text-neutral-500"
                }`}
                key={mode}
                onClick={() => onInputModeChange(mode)}
                type="button"
              >
                {mode === "text" ? "文本输入" : "图片识别"}
              </button>
            ))}
          </div>
        </div>

        {inputMode === "text" ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <textarea
              className="min-h-24 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-4 py-3 text-base leading-6 text-neutral-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-neutral-100"
              disabled={disabled}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder="输入数学分析问题、证明思路或函数表达式"
              value={input}
            />
            <ComposerActions
              canSubmit={Boolean(input.trim())}
              disabled={disabled}
              onStop={onStop}
            />
          </div>
        ) : (
          <OCRComposer
            disabled={disabled}
            ocrState={ocrState}
            onImagePick={onImagePick}
            onSubmitOcr={onSubmitOcr}
            onTextChange={onOcrTextChange}
          />
        )}
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
    <div className="grid gap-2 sm:grid-cols-3">
      {answerModes.map((mode) => {
        const active = mode.value === answerMode;
        return (
          <button
            className={`rounded-md border px-3 py-2 text-left transition disabled:cursor-not-allowed ${
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
            <span className="block text-xs text-neutral-500">{mode.description}</span>
          </button>
        );
      })}
    </div>
  );
}

function ComposerActions({
  canSubmit,
  disabled,
  onStop
}: {
  canSubmit: boolean;
  disabled: boolean;
  onStop: () => void;
}) {
  return (
    <div className="flex w-full flex-row gap-2 sm:w-28 sm:flex-col">
      <button
        className="h-11 flex-1 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:flex-none"
        disabled={!canSubmit || disabled}
        type="submit"
      >
        发送
      </button>
      <button
        className="h-11 flex-1 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 sm:flex-none"
        disabled={!disabled}
        onClick={onStop}
        type="button"
      >
        停止
      </button>
    </div>
  );
}

function OCRComposer({
  disabled,
  ocrState,
  onImagePick,
  onSubmitOcr,
  onTextChange
}: {
  disabled: boolean;
  ocrState: OCRState;
  onImagePick: (file: File | null) => void;
  onSubmitOcr: () => void;
  onTextChange: (value: string) => void;
}) {
  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_128px]">
      <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-center text-sm text-neutral-600 transition hover:border-emerald-300 hover:bg-emerald-50">
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => onImagePick(event.target.files?.[0] ?? null)}
          type="file"
        />
        上传题目图片
        <span className="mt-1 text-xs text-neutral-500">PNG / JPG / WEBP</span>
      </label>

      <div className="rounded-md border border-neutral-200 bg-white p-3">
        {ocrState.status === "idle" ? (
          <p className="text-sm leading-6 text-neutral-500">
            图片识别结果会先显示在这里，你可以修改后再发送给 Agent。
          </p>
        ) : null}
        {ocrState.status === "recognizing" ? (
          <p className="text-sm leading-6 text-emerald-800">正在识别 {ocrState.fileName}...</p>
        ) : null}
        {ocrState.status === "error" ? (
          <p className="text-sm leading-6 text-red-700">{ocrState.message}</p>
        ) : null}
        {ocrState.status === "ready" ? (
          <div className="space-y-2">
            <textarea
              className="min-h-28 w-full resize-none rounded-md border border-neutral-300 px-3 py-2 text-sm leading-6 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => onTextChange(event.target.value)}
              value={ocrState.editableText}
            />
            {ocrState.result.warnings.length > 0 ? (
              <p className="text-xs leading-5 text-amber-700">{ocrState.result.warnings[0]}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        className="h-11 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 lg:self-end"
        disabled={disabled || ocrState.status !== "ready" || !ocrState.editableText.trim()}
        onClick={onSubmitOcr}
        type="button"
      >
        确认并提问
      </button>
    </div>
  );
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
