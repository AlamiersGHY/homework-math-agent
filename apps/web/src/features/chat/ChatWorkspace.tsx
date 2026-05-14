"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { checkHealth, type HealthResponse } from "@/lib/api/health";
import { streamChat } from "@/lib/api/chatStream";
import type {
  AnswerMode,
  ChatMessage,
  MetadataEventData,
  QuestionType,
  StartEventData
} from "@/types/chat";

const answerModes: Array<{
  value: AnswerMode;
  label: string;
  tone: string;
}> = [
  { value: "guided", label: "分步引导", tone: "学习节奏" },
  { value: "direct", label: "直接解答", tone: "快速核对" },
  { value: "hint", label: "仅提示", tone: "保留思考" }
];

const examples = [
  "求 lim(x→0) sin(x)/x，并说明关键思路",
  "证明单调有界数列必有极限",
  "画出 z = sin(xy) 的曲面并解释形状"
];

const questionTypeLabels: Record<QuestionType, string> = {
  conceptual: "概念类",
  computational: "计算类",
  proof: "证明类",
  visualization: "可视化类",
  unknown: "待判断"
};

const modeLabels: Record<AnswerMode, string> = {
  direct: "直接解答",
  guided: "分步引导",
  hint: "仅提示"
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
};

type FollowUpSuggestion = {
  label: string;
  prompt: string;
  answerMode: AnswerMode;
};

const initialMetadata: ChatMetadata = {
  sessionId: null,
  answerMode: "guided",
  questionType: "unknown",
  shouldVisualize: false,
  finishReason: null
};

export function ChatWorkspace() {
  const [answerMode, setAnswerMode] = useState<AnswerMode>("guided");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [metadata, setMetadata] = useState<ChatMetadata>(initialMetadata);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthState>({ status: "checking" });
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const currentMode = useMemo(
    () => answerModes.find((mode) => mode.value === answerMode) ?? answerModes[0],
    [answerMode]
  );
  const followUpSuggestions = useMemo(
    () =>
      createFollowUpSuggestions({
        answerMode,
        isStreaming,
        messages,
        metadata
      }),
    [answerMode, isStreaming, messages, metadata]
  );

  useEffect(() => {
    let mounted = true;

    checkHealth()
      .then((data) => {
        if (mounted) {
          setHealth({ status: "online", data });
        }
      })
      .catch((caught: unknown) => {
        if (mounted) {
          setHealth({
            status: "offline",
            message:
              caught instanceof Error ? caught.message : "Health check failed"
          });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [messages]);

  async function sendMessage(messageText: string, modeOverride = answerMode) {
    const message = messageText.trim();

    if (!message || isStreaming) {
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
      content: message,
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
    setMetadata({
      ...initialMetadata,
      answerMode: modeOverride
    });
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamChat(
        {
          message,
          answer_mode: modeOverride,
          session_id: metadata.sessionId,
          confirmed_ocr_text: null,
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
              shouldVisualize: data.should_visualize
            }));
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

  async function sendSuggestion(suggestion: FollowUpSuggestion) {
    setAnswerMode(suggestion.answerMode);
    await sendMessage(suggestion.prompt, suggestion.answerMode);
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
    setMetadata({
      ...initialMetadata,
      answerMode
    });
  }

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-neutral-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Math Agent
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal text-neutral-950">
              数学分析学习工作台
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusPill health={health} />
            <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-700">
              {currentMode.label}
            </span>
            <button
              className="rounded-full border border-neutral-300 bg-white px-3 py-1 font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
              disabled={isStreaming && messages.length === 0}
              onClick={startNewSession}
              type="button"
            >
              新会话
            </button>
          </div>
        </header>

        <div className="grid flex-1 gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
            <div
              className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
              ref={transcriptRef}
            >
              {messages.length === 0 ? (
                <EmptyChat onPickExample={setInput} />
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                </div>
              )}
            </div>

            {error ? (
              <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6">
                {error}
              </div>
            ) : null}

            <form
              className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-6"
              onSubmit={handleSubmit}
            >
              <ModeSelector
                answerMode={answerMode}
                disabled={isStreaming}
                onChange={setAnswerMode}
              />
              <FollowUpSuggestions
                disabled={isStreaming}
                onPick={sendSuggestion}
                suggestions={followUpSuggestions}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <textarea
                  className="min-h-24 flex-1 resize-none rounded-md border border-neutral-300 bg-white px-4 py-3 text-base leading-6 text-neutral-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-neutral-100"
                  disabled={isStreaming}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="输入数学分析问题、证明思路或函数表达式"
                  value={input}
                />
                <div className="flex w-full flex-row gap-2 sm:w-28 sm:flex-col">
                  <button
                    className="h-11 flex-1 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:flex-none"
                    disabled={!input.trim() || isStreaming}
                    type="submit"
                  >
                    发送
                  </button>
                  <button
                    className="h-11 flex-1 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300 sm:flex-none"
                    disabled={!isStreaming}
                    onClick={stopStreaming}
                    type="button"
                  >
                    停止
                  </button>
                </div>
              </div>
            </form>
          </section>

          <aside className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
            <PanelBlock title="学习状态">
              <InfoRow label="回答模式" value={modeLabels[metadata.answerMode]} />
              <InfoRow
                label="题型识别"
                value={questionTypeLabels[metadata.questionType]}
              />
              <InfoRow
                label="可视化建议"
                value={metadata.shouldVisualize ? "建议生成图形" : "暂无"}
              />
              <InfoRow
                label="流式状态"
                value={isStreaming ? "生成中" : metadata.finishReason ?? "待输入"}
              />
            </PanelBlock>

            <PanelBlock title="输入能力">
              <CapabilityItem label="文本问题" state="已启用" tone="ready" />
              <CapabilityItem label="OCR 图片" state="未启用" tone="muted" />
              <CapabilityItem label="函数图形" state="未启用" tone="muted" />
            </PanelBlock>

            <PanelBlock title="当前会话">
              <p className="break-all text-sm leading-6 text-neutral-600">
                {metadata.sessionId ?? "发送第一条消息后建立会话"}
              </p>
              {messages.length > 0 ? (
                <button
                  className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:text-neutral-300"
                  disabled={isStreaming}
                  onClick={startNewSession}
                  type="button"
                >
                  返回开始页
                </button>
              ) : null}
            </PanelBlock>
          </aside>
        </div>
      </div>
    </main>
  );
}

function StatusPill({ health }: { health: HealthState }) {
  if (health.status === "checking") {
    return (
      <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 font-medium text-neutral-500">
        API 检查中
      </span>
    );
  }

  if (health.status === "offline") {
    return (
      <span
        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-800"
        title={health.message}
      >
        API 未连接
      </span>
    );
  }

  return (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-medium text-emerald-800">
      API {health.data.version}
    </span>
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
            <span className="block text-xs text-neutral-500">{mode.tone}</span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyChat({
  onPickExample
}: {
  onPickExample: (example: string) => void;
}) {
  return (
    <div className="flex min-h-full flex-col justify-center gap-6 py-10">
      <div>
        <p className="text-sm font-semibold text-emerald-700">开始一道题</p>
        <h2 className="mt-2 max-w-xl text-3xl font-semibold tracking-normal text-neutral-950">
          选择一个示例，或直接输入你的数学分析问题
        </h2>
      </div>
      <div className="grid gap-3">
        {examples.map((example) => (
          <button
            className="rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm font-medium leading-6 text-neutral-800 transition hover:border-emerald-300 hover:bg-emerald-50"
            key={example}
            onClick={() => onPickExample(example)}
            type="button"
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <article className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-lg px-4 py-3 shadow-sm ${
          isUser
            ? "bg-neutral-950 text-white"
            : "border border-neutral-200 bg-neutral-50 text-neutral-900"
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
      </div>
    </article>
  );
}

function FollowUpSuggestions({
  disabled,
  onPick,
  suggestions
}: {
  disabled: boolean;
  onPick: (suggestion: FollowUpSuggestion) => void;
  suggestions: FollowUpSuggestion[];
}) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-sm font-medium text-emerald-900 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-neutral-300"
          disabled={disabled}
          key={suggestion.label}
          onClick={() => onPick(suggestion)}
          type="button"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

function PanelBlock({
  children,
  title
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="border-b border-neutral-200 pb-4 last:border-b-0 last:pb-0">
      <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-900">{value}</span>
    </div>
  );
}

function CapabilityItem({
  label,
  state,
  tone
}: {
  label: string;
  state: string;
  tone: "ready" | "muted";
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 px-3 py-2 text-sm">
      <span className="font-medium text-neutral-800">{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          tone === "ready"
            ? "bg-emerald-50 text-emerald-800"
            : "bg-neutral-100 text-neutral-500"
        }`}
      >
        {state}
      </span>
    </div>
  );
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createFollowUpSuggestions({
  answerMode,
  isStreaming,
  messages,
  metadata
}: {
  answerMode: AnswerMode;
  isStreaming: boolean;
  messages: ChatMessage[];
  metadata: ChatMetadata;
}): FollowUpSuggestion[] {
  if (isStreaming || messages.length === 0) {
    return [];
  }

  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role !== "assistant" || lastMessage.status !== "done") {
    return [];
  }

  const suggestions: FollowUpSuggestion[] = [];

  if (answerMode !== "guided") {
    suggestions.push({
      label: "分步重讲",
      prompt: "请用分步引导的方式重新讲这道题，先帮我找到下一步，不要一次性写成长篇完整答案。",
      answerMode: "guided"
    });
  }

  if (answerMode !== "direct") {
    suggestions.push({
      label: "直接给结论",
      prompt: "请直接给出这道题的最终答案和关键步骤，尽量简洁。",
      answerMode: "direct"
    });
  }

  if (answerMode !== "hint") {
    suggestions.push({
      label: "只给提示",
      prompt: "请只给我一个最关键的提示，不要给完整解答。",
      answerMode: "hint"
    });
  }

  const topicSuggestion = getTopicSuggestion(metadata.questionType);
  if (topicSuggestion) {
    suggestions.push(topicSuggestion);
  }

  return suggestions.slice(0, 4);
}

function getTopicSuggestion(questionType: QuestionType): FollowUpSuggestion | null {
  if (questionType === "proof") {
    return {
      label: "证明框架",
      prompt: "请先帮我拆出这道证明题的证明框架：已知什么、要证什么、关键桥梁是什么。",
      answerMode: "guided"
    };
  }

  if (questionType === "computational") {
    return {
      label: "类似练习",
      prompt: "请给我一道同类型但数字或表达式稍微变化的练习题，并先不要给答案。",
      answerMode: "hint"
    };
  }

  if (questionType === "conceptual") {
    return {
      label: "举个例子",
      prompt: "请用一个具体例子解释刚刚的概念，并指出最容易混淆的地方。",
      answerMode: "guided"
    };
  }

  if (questionType === "visualization") {
    return {
      label: "图像直觉",
      prompt: "请从图像直觉角度解释这个函数或区域，重点说清楚形状和变化趋势。",
      answerMode: "direct"
    };
  }

  return {
    label: "换个角度",
    prompt: "请换一个更容易理解的角度解释刚刚的回答。",
    answerMode: "guided"
  };
}
