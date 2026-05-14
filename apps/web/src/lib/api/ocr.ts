import { API_BASE_URL } from "./config";
import type { OCRRecognizeResponse } from "@/types/chat";

export async function recognizeOcrImage(file: File): Promise<OCRRecognizeResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/ocr/recognize`, {
    method: "POST",
    body: form
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `OCR failed with ${response.status}`));
  }

  return payload as OCRRecognizeResponse;
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
