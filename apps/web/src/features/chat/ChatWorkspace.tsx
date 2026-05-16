"use client";

import {
  type FormEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
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
  ChatAttachmentSnapshot,
  ChatMessageAttachment,
  ChatMessage,
  DocumentSummary,
  MetadataEventData,
  PlotPreviewRequest,
  PlotPreviewResponse,
  QuestionType,
  RetrievedSource,
  SessionSummary,
  StartEventData
} from "@/types/chat";

const MAX_ATTACHMENT_SNAPSHOT_CHARS = 1_200_000;

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

type ImageAttachment = {
  id: string;
  file: File;
  fileName: string;
  previewUrl: string;
  annotatedBlob?: Blob;
  annotatedPreviewUrl?: string;
  ocrStatus: "idle" | "recognizing" | "ready" | "error";
  recognizedText?: string;
  error?: string;
};

type ImageEditorState = {
  attachmentId: string;
} | null;

type PlotModalState = {
  plot: PlotPreviewResponse;
  title: string;
} | null;

type MaterialsState = {
  items: DocumentSummary[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  notice: string | null;
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
    error: null,
    notice: null
  });
  const [imageAttachments, setImageAttachments] = useState<ImageAttachment[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plotModal, setPlotModal] = useState<PlotModalState>(null);
  const [imageEditor, setImageEditor] = useState<ImageEditorState>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<HTMLDivElement | null>(null);

  const currentMode = useMemo(
    () => answerModes.find((mode) => mode.value === answerMode) ?? answerModes[0],
    [answerMode]
  );
  const currentSessionTitle =
    sessions.find((session) => session.id === metadata.sessionId)?.title ?? "新学习会话";
  const canSubmit = (Boolean(input.trim()) || imageAttachments.length > 0) && !isStreaming;

  useEffect(() => {
    refreshHealth();
    refreshSessions();
    refreshMaterials();
  }, []);

  useEffect(() => {
    scrollTranscriptToBottom();
  }, [messages.length, isStreaming]);

  function scrollTranscriptToBottom() {
    window.requestAnimationFrame(() => {
      transcriptRef.current?.scrollTo({
        top: transcriptRef.current.scrollHeight,
        behavior: "smooth"
      });
    });
  }

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
      const attachmentLookup = buildAttachmentLookup(
        detail.artifacts.filter((artifact) => artifact.artifact_type === "message_attachments")
      );
      const loadedMessages: ChatMessage[] = detail.messages.map((message) => {
        const storedAttachments =
          message.role === "user" ? attachmentLookup.get(message.id) ?? [] : [];
        const legacyAttachments =
          message.role === "user" && storedAttachments.length === 0
            ? legacyOcrAttachmentsFromMessage(message)
            : [];
        const attachments = storedAttachments.length > 0 ? storedAttachments : legacyAttachments;
        return {
          id: message.id,
          role: message.role,
          content:
            message.role === "user"
              ? visibleStoredUserContent(message, legacyAttachments)
              : message.content,
          attachments,
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
        };
      });

      revokeMessageAttachmentUrls(messages);
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
      clearImageAttachments();
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

    setMaterials((current) => ({ ...current, uploading: true, error: null, notice: null }));
    try {
      const uploaded = await uploadDocument(file);
      const notice =
        uploaded.status === "ready"
          ? `已索引 ${uploaded.filename}，后续提问会自动检索并显示引用。`
          : null;
      setMaterials((current) => ({
        ...current,
        items: upsertDocument(current.items, uploaded),
        uploading: false,
        error: uploaded.status === "failed" ? uploaded.error_message ?? "PDF 未提取到可检索文本" : null,
        notice
      }));
      window.setTimeout(() => {
        setMaterials((current) => ({ ...current, notice: null }));
      }, 5000);
      await refreshMaterials();
    } catch (caught: unknown) {
      setMaterials((current) => ({
        ...current,
        uploading: false,
        error: caught instanceof Error ? caught.message : "PDF 上传失败",
        notice: null
      }));
    }
  }

  async function removeDocument(documentId: string) {
    setMaterials((current) => ({ ...current, error: null }));
    try {
      await deleteDocument(documentId);
      setMaterials((current) => ({
        ...current,
        items: current.items.filter((item) => item.id !== documentId),
        notice: null
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
    const attachmentsToSend = imageAttachments;

    if ((!actualText && attachmentsToSend.length === 0) || isStreaming) {
      return;
    }

    setIsStreaming(true);
    setError(null);

    let attachmentOcrText = "";
    try {
      attachmentOcrText = await recognizePendingAttachments(attachmentsToSend);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "图片识别失败，请稍后重试。");
      setIsStreaming(false);
      return;
    }

    const hasImageAttachments = attachmentsToSend.length > 0;
    const visibleText = actualText || "请根据图片内容帮我分析这道题";
    const userMessageAttachments = toMessageAttachments(attachmentsToSend);
    const attachmentSnapshots = await toAttachmentSnapshots(attachmentsToSend);

    const previousTurns = messages
      .filter((item) => item.content.trim())
      .map((item) => ({
        role: item.role,
        content: item.content
      }));
    const userMessage: ChatMessage = {
      id: createId("user"),
      role: "user",
      content: visibleText,
      attachments: userMessageAttachments,
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
    setImageAttachments([]);
    setImageEditor(null);
    setError(null);
    setMetadata({
      ...initialMetadata,
      sessionId: metadata.sessionId,
      answerMode: modeOverride
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let pendingPlotSuggestion: PlotPreviewRequest | null = null;
    let pendingSources: RetrievedSource[] = [];
    let pendingRetrievalAttempted = false;
    let activeSessionId = metadata.sessionId;

    try {
      await streamChat(
        {
          message: hasImageAttachments && !actualText ? visibleText : actualText,
          answer_mode: modeOverride,
          session_id: metadata.sessionId,
          confirmed_ocr_text: attachmentOcrText || null,
          attachments: attachmentSnapshots,
          context: {
            previous_turns: previousTurns,
            style: "default"
          }
        },
        {
          onStart: (data: StartEventData) => {
            activeSessionId = data.session_id;
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
            pendingPlotSuggestion = data.plot_suggestion ?? pendingPlotSuggestion;
            pendingSources = sources.length > 0 ? sources : pendingSources;
            pendingRetrievalAttempted =
              data.retrieval_attempted ?? pendingRetrievalAttempted;
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
                    ? {
                        ...item,
                        plotSuggestion: data.plot_suggestion ?? item.plotSuggestion
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
            const finalAssistantId = data.assistant_message_id ?? assistantId;
            setMetadata((current) => ({
              ...current,
              finishReason: data.finish_reason
            }));
            setMessages((current) =>
              current.map((item) =>
                item.id === assistantId
                  ? {
                      ...item,
                      id: finalAssistantId,
                      status: "done",
                      persisted: Boolean(data.assistant_message_id),
                      retrievalAttempted: pendingRetrievalAttempted,
                      retrievedSources: pendingSources
                    }
                  : item
              )
            );
            if (pendingPlotSuggestion) {
              void generatePlot(finalAssistantId, pendingPlotSuggestion, {
                persistedMessageId: Boolean(data.assistant_message_id),
                sessionId: activeSessionId
              });
            }
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

  function handleImagePick(files: FileList | null) {
    const pickedFiles = Array.from(files ?? []);
    if (pickedFiles.length === 0) {
      return;
    }

    const nextAttachments = pickedFiles.map((file) => ({
      id: createId("image"),
      file,
      fileName: file.name,
      previewUrl: URL.createObjectURL(file),
      ocrStatus: "idle" as const
    }));
    setImageAttachments((current) => [...current, ...nextAttachments]);
    setError(null);
  }

  async function recognizePendingAttachments(attachments: ImageAttachment[]): Promise<string> {
    const recognized: string[] = [];
    for (const attachment of attachments) {
      if (attachment.ocrStatus === "ready" && attachment.recognizedText?.trim()) {
        recognized.push(`[${attachment.fileName}]\n${attachment.recognizedText.trim()}`);
        continue;
      }

      setImageAttachments((current) =>
        current.map((item) =>
          item.id === attachment.id
            ? { ...item, ocrStatus: "recognizing", error: undefined }
            : item
        )
      );

      try {
        const fileForOcr = attachment.annotatedBlob
          ? new File([attachment.annotatedBlob], attachment.fileName, {
              type: attachment.annotatedBlob.type || attachment.file.type
            })
          : attachment.file;
        const result = await recognizeOcrImage(fileForOcr);
        const recognizedText = result.recognized_text.trim();
        setImageAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? {
                  ...item,
                  ocrStatus: "ready",
                  recognizedText,
                  error: undefined
                }
              : item
          )
        );
        if (recognizedText) {
          recognized.push(`[${attachment.fileName}]\n${recognizedText}`);
        }
      } catch (caught: unknown) {
        const message = caught instanceof Error ? caught.message : "OCR 识别失败";
        setImageAttachments((current) =>
          current.map((item) =>
            item.id === attachment.id
              ? { ...item, ocrStatus: "error", error: message }
              : item
          )
        );
        throw new Error(`图片 ${attachment.fileName} 识别失败：${message}`);
      }
    }

    return recognized.join("\n\n");
  }

  function removeImageAttachment(attachmentId: string) {
    setImageAttachments((current) => {
      const target = current.find((item) => item.id === attachmentId);
      if (target) {
        revokeAttachmentUrls(target);
      }
      return current.filter((item) => item.id !== attachmentId);
    });
    setImageEditor((current) =>
      current?.attachmentId === attachmentId ? null : current
    );
  }

  function updateImageAnnotation(attachmentId: string, blob: Blob, previewUrl: string) {
    setImageAttachments((current) =>
      current.map((item) => {
        if (item.id !== attachmentId) {
          return item;
        }
        if (item.annotatedPreviewUrl) {
          URL.revokeObjectURL(item.annotatedPreviewUrl);
        }
        return {
          ...item,
          annotatedBlob: blob,
          annotatedPreviewUrl: previewUrl,
          ocrStatus: "idle",
          recognizedText: undefined,
          error: undefined
        };
      })
    );
  }

  function clearImageAttachments() {
    setImageAttachments((current) => {
      current.forEach(revokeAttachmentUrls);
      return [];
    });
    setImageEditor(null);
  }

  function toMessageAttachments(attachments: ImageAttachment[]): ChatMessageAttachment[] {
    return attachments.map((attachment) => ({
      id: attachment.id,
      kind: "image",
      fileName: attachment.fileName,
      previewUrl: attachment.annotatedPreviewUrl ?? attachment.previewUrl,
      annotated: Boolean(attachment.annotatedPreviewUrl)
    }));
  }

  async function toAttachmentSnapshots(
    attachments: ImageAttachment[]
  ): Promise<ChatAttachmentSnapshot[]> {
    const snapshots = await Promise.all(
      attachments.map(async (attachment) => {
        const blob = attachment.annotatedBlob ?? attachment.file;
        return {
          id: attachment.id,
          kind: "image" as const,
          file_name: attachment.fileName,
          preview_data_url: await readAttachmentPreviewDataUrl(blob),
          annotated: Boolean(attachment.annotatedPreviewUrl)
        };
      })
    );
    return snapshots.filter((snapshot) => Boolean(snapshot.preview_data_url));
  }

  function revokeAttachmentUrls(attachment: ImageAttachment) {
    URL.revokeObjectURL(attachment.previewUrl);
    if (attachment.annotatedPreviewUrl) {
      URL.revokeObjectURL(attachment.annotatedPreviewUrl);
    }
  }

  async function generatePlot(
    messageId: string,
    request: PlotPreviewRequest,
    options?: { persistedMessageId?: boolean; sessionId?: string | null }
  ) {
    const targetMessage = messages.find((message) => message.id === messageId);
    setMessages((current) =>
      current.map((item) =>
        item.id === messageId ? { ...item, plotLoading: true, plotError: null } : item
      )
    );

    try {
      const plot = await createPlotPreview({
        ...request,
        session_id: options?.sessionId ?? metadata.sessionId,
        message_id: options?.persistedMessageId || targetMessage?.persisted ? messageId : null
      });
      setMessages((current) =>
        current.map((item) =>
          item.id === messageId ? { ...item, plot, plotLoading: false } : item
        )
      );
      scrollTranscriptToBottom();
    } catch (caught: unknown) {
      const plotError =
        caught instanceof Error
          ? formatPlotErrorMessage(caught.message)
          : "图形生成失败：当前题目没有可直接绘制的明确函数或曲面。";
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
    revokeMessageAttachmentUrls(messages);
    setMessages([]);
    setInput("");
    setError(null);
    setIsStreaming(false);
    clearImageAttachments();
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
                      onPlotRenderError={(plotError) =>
                        setMessages((current) =>
                          current.map((item) =>
                            item.id === message.id ? { ...item, plotError } : item
                          )
                        )
                      }
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
            onRetry={refreshMaterials}
          />

          <Composer
            answerMode={answerMode}
            canSubmit={canSubmit}
            disabled={isStreaming}
            imageAttachments={imageAttachments}
            input={input}
            onAnswerModeChange={setAnswerMode}
            onClearAttachments={clearImageAttachments}
            onEditImage={(attachmentId) => setImageEditor({ attachmentId })}
            onImagePick={handleImagePick}
            onInputChange={setInput}
            onRemoveImage={removeImageAttachment}
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
      {imageEditor ? (
        <ImageEditorModal
          attachment={imageAttachments.find((item) => item.id === imageEditor.attachmentId) ?? null}
          onClose={() => setImageEditor(null)}
          onSave={(blob, previewUrl) => {
            updateImageAnnotation(imageEditor.attachmentId, blob, previewUrl);
            setImageEditor(null);
          }}
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
  onGeneratePlot,
  onPlotRenderError
}: {
  message: ChatMessage;
  onExpandPlot: (plot: PlotPreviewResponse) => void;
  onGeneratePlot: (request: PlotPreviewRequest) => void;
  onPlotRenderError: (message: string) => void;
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
          {message.attachments && message.attachments.length > 0 ? (
            <MessageAttachments attachments={message.attachments} />
          ) : null}
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
            sources={message.status === "done" ? (message.retrievedSources ?? []) : []}
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
            key={plotViewerKey(message.id, message.plot)}
            onExpand={() => onExpandPlot(message.plot as PlotPreviewResponse)}
            onRenderError={(errorMessage) => onPlotRenderError(`图形渲染失败：${errorMessage}`)}
            plot={message.plot}
          />
        ) : null}
      </div>
    </article>
  );
}

function MessageAttachments({ attachments }: { attachments: ChatMessageAttachment[] }) {
  return (
    <div className="mb-3 flex max-w-full gap-2 overflow-x-auto pb-1">
      {attachments.map((attachment) => (
        <figure
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-md border border-white/15 bg-black/10"
          key={attachment.id}
        >
          <img
            alt={attachment.fileName}
            className="h-full w-full object-cover"
            src={attachment.previewUrl}
          />
          <figcaption className="absolute inset-x-0 bottom-0 truncate bg-neutral-950/70 px-1.5 py-1 text-[11px] font-medium text-white">
            {attachment.fileName}
          </figcaption>
          {attachment.annotated ? (
            <span className="absolute left-1 top-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              已标注
            </span>
          ) : null}
        </figure>
      ))}
    </div>
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
  onPdfPick,
  onRetry
}: {
  disabled: boolean;
  materials: MaterialsState;
  onDeleteDocument: (documentId: string) => void;
  onPdfPick: (file: File | null) => void;
  onRetry: () => void;
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
          <span className="inline-flex min-w-0 flex-1 items-center gap-2 text-red-700">
            <span className="truncate">{materials.error}</span>
            <button
              className="h-7 shrink-0 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700"
              disabled={disabled || materials.loading}
              onClick={onRetry}
              type="button"
            >
              重试
            </button>
          </span>
        ) : null}
        {!materials.error && materials.notice ? (
          <span className="min-w-0 flex-1 truncate text-emerald-700">{materials.notice}</span>
        ) : null}
      </div>
    </div>
  );
}

function Composer({
  answerMode,
  canSubmit,
  disabled,
  imageAttachments,
  input,
  onAnswerModeChange,
  onClearAttachments,
  onEditImage,
  onImagePick,
  onInputChange,
  onRemoveImage,
  onSubmit,
  onStop
}: {
  answerMode: AnswerMode;
  canSubmit: boolean;
  disabled: boolean;
  imageAttachments: ImageAttachment[];
  input: string;
  onAnswerModeChange: (mode: AnswerMode) => void;
  onClearAttachments: () => void;
  onEditImage: (attachmentId: string) => void;
  onImagePick: (files: FileList | null) => void;
  onInputChange: (value: string) => void;
  onRemoveImage: (attachmentId: string) => void;
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
        <AttachmentTray
          attachments={imageAttachments}
          disabled={disabled}
          onClearAll={onClearAttachments}
          onEdit={onEditImage}
          onRemove={onRemoveImage}
        />
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-end gap-2 rounded-lg border border-neutral-300 bg-white px-2.5 py-2 focus-within:border-emerald-600 focus-within:ring-2 focus-within:ring-emerald-100">
            <button
              aria-label="上传图片"
              className="mb-1 h-9 w-9 shrink-0 rounded-md border border-neutral-200 text-lg font-semibold text-neutral-600 transition hover:border-emerald-300 hover:text-emerald-700"
              disabled={disabled}
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
              multiple
              onChange={(event) => {
                onImagePick(event.target.files);
                event.currentTarget.value = "";
              }}
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

function AttachmentTray({
  attachments,
  disabled,
  onClearAll,
  onEdit,
  onRemove
}: {
  attachments: ImageAttachment[];
  disabled: boolean;
  onClearAll: () => void;
  onEdit: (attachmentId: string) => void;
  onRemove: (attachmentId: string) => void;
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-2">
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <span className="text-xs font-semibold uppercase text-neutral-500">
          图片附件
        </span>
        <button
          className="h-7 rounded-md border border-neutral-200 bg-white px-2 text-xs font-semibold text-neutral-600 disabled:opacity-50"
          disabled={disabled}
          onClick={onClearAll}
          type="button"
        >
          清空
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {attachments.map((attachment) => (
          <div
            className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-sm"
            key={attachment.id}
          >
            <button
              aria-label={`预览图片 ${attachment.fileName}`}
              className="h-full w-full"
              disabled={disabled}
              onClick={() => onEdit(attachment.id)}
              type="button"
            >
              <img
                alt={attachment.fileName}
                className="h-full w-full object-cover"
                src={attachment.annotatedPreviewUrl ?? attachment.previewUrl}
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-neutral-950/65 px-1.5 py-1 text-left text-[11px] font-medium text-white">
                {attachment.fileName}
              </span>
            </button>
            <span
              className={`absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                attachment.ocrStatus === "error"
                  ? "bg-red-600 text-white"
                  : attachment.ocrStatus === "recognizing"
                    ? "bg-amber-500 text-white"
                    : attachment.annotatedPreviewUrl
                      ? "bg-emerald-600 text-white"
                      : "bg-white/90 text-neutral-700"
              }`}
              title={attachment.error}
            >
              {attachment.ocrStatus === "recognizing"
                ? "识别中"
                : attachment.ocrStatus === "error"
                  ? "失败"
                  : attachment.annotatedPreviewUrl
                    ? "已标注"
                    : "附件"}
            </span>
            <button
              aria-label={`移除图片 ${attachment.fileName}`}
              className="absolute right-1 top-1 h-6 w-6 rounded bg-white/90 text-sm font-semibold text-neutral-700 opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
              disabled={disabled}
              onClick={() => onRemove(attachment.id)}
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageEditorModal({
  attachment,
  onClose,
  onSave
}: {
  attachment: ImageAttachment | null;
  onClose: () => void;
  onSave: (blob: Blob, previewUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const drawingRef = useRef(false);
  const [hasMarks, setHasMarks] = useState(false);

  if (!attachment) {
    return null;
  }

  const activeAttachment = attachment;
  const imageUrl = activeAttachment.annotatedPreviewUrl ?? activeAttachment.previewUrl;

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function prepareCanvas() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) {
      return;
    }
    const displayWidth = image.clientWidth || image.naturalWidth;
    const displayHeight = image.clientHeight || image.naturalHeight;
    canvas.width = Math.max(1, Math.round(displayWidth));
    canvas.height = Math.max(1, Math.round(displayHeight));
  }

  function beginDraw(event: PointerEvent<HTMLCanvasElement>) {
    prepareCanvas();
    const point = getCanvasPoint(event);
    const canvas = canvasRef.current;
    if (!point || !canvas) {
      return;
    }
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    context.strokeStyle = "#f97316";
    context.lineWidth = 5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    context.moveTo(point.x, point.y);
    setHasMarks(true);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) {
      return;
    }
    const point = getCanvasPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) {
      return;
    }
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function endDraw(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    canvasRef.current?.releasePointerCapture(event.pointerId);
  }

  function clearMarks() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setHasMarks(false);
  }

  async function saveAnnotation() {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) {
      onClose();
      return;
    }

    const output = document.createElement("canvas");
    output.width = image.naturalWidth;
    output.height = image.naturalHeight;
    const context = output.getContext("2d");
    if (!context) {
      onClose();
      return;
    }
    context.drawImage(image, 0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0, output.width, output.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      output.toBlob(resolve, activeAttachment.file.type || "image/png")
    );
    if (!blob) {
      onClose();
      return;
    }
    onSave(blob, URL.createObjectURL(blob));
  }

  return (
    <div
      aria-label="图片预览与标注"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-neutral-950/60 p-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="mx-auto flex h-full max-w-5xl flex-col rounded-lg bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-neutral-950">{activeAttachment.fileName}</p>
            <p className="text-xs text-neutral-500">可在图片上圈画重点后再发送</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="h-9 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700"
              disabled={!hasMarks}
              onClick={clearMarks}
              type="button"
            >
              清除标注
            </button>
            <button
              className="h-9 rounded-md bg-neutral-950 px-3 text-sm font-semibold text-white"
              onClick={saveAnnotation}
              type="button"
            >
              完成
            </button>
            <button
              className="h-9 rounded-md border border-neutral-200 px-3 text-sm font-semibold text-neutral-700"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-neutral-100 p-4">
          <div className="mx-auto flex h-full max-h-full max-w-full items-center justify-center overflow-hidden rounded-md bg-white">
            <div className="relative max-h-full max-w-full">
              <img
                alt={activeAttachment.fileName}
                className="block max-h-full max-w-full object-contain"
                onLoad={prepareCanvas}
                ref={imageRef}
                src={imageUrl}
              />
              <canvas
                aria-label="图片标注画布"
                className="absolute inset-0 h-full w-full touch-none"
                onPointerCancel={endDraw}
                onPointerDown={beginDraw}
                onPointerMove={draw}
                onPointerUp={endDraw}
                ref={canvasRef}
              />
            </div>
          </div>
        </div>
      </div>
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
          <PlotViewer key={plotViewerKey("modal", plot)} plot={plot} size="modal" />
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

function buildAttachmentLookup(
  artifacts: Array<{
    message_id: string | null;
    payload: Record<string, unknown>;
    created_at: string;
  }>
): Map<string, ChatMessageAttachment[]> {
  const lookup = new Map<string, ChatMessageAttachment[]>();
  for (const artifact of [...artifacts].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    if (!artifact.message_id) {
      continue;
    }
    const attachments = toStoredMessageAttachments(artifact.payload.attachments);
    if (attachments.length > 0) {
      lookup.set(artifact.message_id, attachments);
    }
  }
  return lookup;
}

function toStoredMessageAttachments(value: unknown): ChatMessageAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const attachment = item as Record<string, unknown>;
    if (
      attachment.kind !== "image" ||
      typeof attachment.file_name !== "string" ||
      typeof attachment.preview_data_url !== "string"
    ) {
      return [];
    }
    return [
      {
        id:
          typeof attachment.id === "string" && attachment.id.trim()
            ? attachment.id
            : createId("image"),
        kind: "image" as const,
        fileName: attachment.file_name,
        previewUrl: attachment.preview_data_url,
        annotated: attachment.annotated === true
      }
    ];
  });
}

function legacyOcrAttachmentsFromMessage(message: {
  content: string;
  source?: string | null;
}): ChatMessageAttachment[] {
  if (message.source !== "ocr") {
    return [];
  }
  const names = Array.from(message.content.matchAll(/\[([^\]\r\n]+?\.(?:png|jpe?g|webp|gif))\]/gi))
    .map((match) => match[1])
    .filter(Boolean);
  return [...new Set(names)].map((fileName) => ({
    id: createId("legacy-image"),
    kind: "image" as const,
    fileName,
    previewUrl: legacyAttachmentPlaceholderDataUrl(fileName)
  }));
}

function visibleStoredUserContent(
  message: { content: string; source?: string | null },
  legacyAttachments: ChatMessageAttachment[]
): string {
  if (message.source === "ocr" && legacyAttachments.length > 0) {
    return "请根据图片内容帮我分析这道题";
  }
  return message.content;
}

function legacyAttachmentPlaceholderDataUrl(fileName: string): string {
  const safeName = escapeHtml(fileName);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320"><rect width="320" height="320" rx="24" fill="#f5f5f4"/><rect x="72" y="76" width="176" height="128" rx="16" fill="#ffffff" stroke="#d6d3d1" stroke-width="6"/><circle cx="126" cy="124" r="20" fill="#a7f3d0"/><path d="M88 184l54-48 32 30 24-22 36 40z" fill="#10b981"/><text x="160" y="246" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#44403c">Image</text><text x="160" y="274" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#78716c">${safeName}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
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

function revokeMessageAttachmentUrls(messages: ChatMessage[]) {
  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      if (attachment.previewUrl.startsWith("data:")) {
        continue;
      }
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }
}

function readAttachmentPreviewDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (!blob.type.startsWith("image/")) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        resolve(null);
        return;
      }
      if (reader.result.length <= MAX_ATTACHMENT_SNAPSHOT_CHARS) {
        resolve(reader.result);
        return;
      }
      downscaleImageDataUrl(reader.result).then(resolve);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

function downscaleImageDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 720;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.78);
      resolve(compressed.length <= MAX_ATTACHMENT_SNAPSHOT_CHARS ? compressed : null);
    };
    image.onerror = () => resolve(null);
    image.src = dataUrl;
  });
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
  if (plotType === "implicit3d") {
    return "三维隐式曲面";
  }
  if (plotType === "surface3d") {
    return "三维曲面";
  }
  if (plotType === "region2d") {
    return "二维区域";
  }
  return "二维函数";
}

function plotViewerKey(messageId: string, plot: PlotPreviewResponse): string {
  const title =
    typeof plot.spec.layout?.title === "object" && plot.spec.layout.title !== null
      ? JSON.stringify(plot.spec.layout.title)
      : String(plot.spec.layout?.title ?? "");
  const dataSignature = JSON.stringify(plot.spec.data ?? []).slice(0, 240);
  return `${messageId}:${plot.plot_type}:${title}:${dataSignature}`;
}

function formatPageRange(source: RetrievedSource) {
  if (source.page_start === source.page_end) {
    return `第 ${source.page_start} 页`;
  }
  return `第 ${source.page_start}-${source.page_end} 页`;
}

function formatPlotErrorMessage(message: string): string {
  if (
    message.includes("Expression is not valid syntax") ||
    message.includes("incomplete LaTeX") ||
    message.includes("Expression is required")
  ) {
    return "图形生成失败：当前题目没有可直接绘制的明确函数或曲面，请补充类似 z = f(x,y) 或 x^2 + y^2 + z^2 = 1 的表达式。";
  }
  return `图形生成失败：${message}`;
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
