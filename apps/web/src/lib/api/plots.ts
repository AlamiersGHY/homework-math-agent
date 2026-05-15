import { requestJson } from "./client";
import type { PlotPreviewRequest, PlotPreviewResponse } from "@/types/chat";

export async function createPlotPreview(
  request: PlotPreviewRequest
): Promise<PlotPreviewResponse> {
  return requestJson<PlotPreviewResponse>(
    "/plots/preview",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    },
    "图形生成失败"
  );
}
