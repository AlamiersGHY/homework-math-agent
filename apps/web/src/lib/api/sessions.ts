import { API_BASE_URL } from "./config";
import type { SessionDetail, SessionSummary } from "@/types/chat";

export async function listSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_BASE_URL}/sessions`);
  if (!response.ok) {
    throw new Error(`Session list failed with ${response.status}`);
  }
  return (await response.json()) as SessionSummary[];
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  const response = await fetch(`${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error(`Session load failed with ${response.status}`);
  }
  return (await response.json()) as SessionDetail;
}
