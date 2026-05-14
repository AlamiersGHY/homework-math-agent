import { API_BASE_URL } from "./config";
import type { PlotPreviewRequest, PlotPreviewResponse } from "@/types/chat";

export async function createPlotPreview(
  request: PlotPreviewRequest
): Promise<PlotPreviewResponse> {
  const response = await fetch(`${API_BASE_URL}/plots/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `Plot preview failed with ${response.status}`));
  }

  return payload as PlotPreviewResponse;
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
