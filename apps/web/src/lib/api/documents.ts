import { requestJson, requestNoContent } from "./client";
import type { DocumentSummary, DocumentUploadResponse } from "@/types/chat";

export async function uploadDocument(file: File): Promise<DocumentSummary> {
  const form = new FormData();
  form.append("file", file);

  const payload = await requestJson<DocumentUploadResponse>(
    "/documents/upload",
    { method: "POST", body: form },
    "PDF 上传失败"
  );
  return payload.document;
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  return requestJson<DocumentSummary[]>("/documents", undefined, "材料列表加载失败");
}

export async function deleteDocument(documentId: string): Promise<void> {
  await requestNoContent(
    `/documents/${encodeURIComponent(documentId)}`,
    { method: "DELETE" },
    "材料删除失败"
  );
}
