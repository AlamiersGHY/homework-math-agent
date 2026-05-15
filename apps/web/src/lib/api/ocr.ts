import { requestJson } from "./client";
import type { OCRRecognizeResponse } from "@/types/chat";

export async function recognizeOcrImage(file: File): Promise<OCRRecognizeResponse> {
  const form = new FormData();
  form.append("file", file);

  return requestJson<OCRRecognizeResponse>(
    "/ocr/recognize",
    { method: "POST", body: form },
    "OCR 识别失败"
  );
}
