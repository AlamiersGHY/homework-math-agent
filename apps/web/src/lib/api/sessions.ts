import { requestJson, requestNoContent } from "./client";
import type { SessionDetail, SessionSummary } from "@/types/chat";

export async function listSessions(): Promise<SessionSummary[]> {
  return requestJson<SessionSummary[]>("/sessions", undefined, "会话列表加载失败");
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return requestJson<SessionDetail>(
    `/sessions/${encodeURIComponent(sessionId)}`,
    undefined,
    "会话加载失败"
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await requestNoContent(
    `/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
    "会话删除失败"
  );
}
