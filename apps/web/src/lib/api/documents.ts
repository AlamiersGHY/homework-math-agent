import { API_BASE_URL } from "./config";
import type { DocumentSummary, DocumentUploadResponse } from "@/types/chat";

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/documents/upload`, {
    method: "POST",
    body: form
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Document upload failed with ${response.status}`));
  }

  return (payload as DocumentUploadResponse).document;
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const response = await fetch(`${API_BASE_URL}/documents`);
  if (!response.ok) {
    throw new Error(`Document list failed with ${response.status}`);
  }
  return (await response.json()) as DocumentSummary[];
}

export async function deleteDocument(documentId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(documentId)}`, {
    method: "DELETE"
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as unknown;
    throw new Error(extractErrorMessage(payload, `Document delete failed with ${response.status}`));
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}
