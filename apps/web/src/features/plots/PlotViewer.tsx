"use client";

import { useEffect, useRef } from "react";
import type { PlotPreviewResponse } from "@/types/chat";

type PlotlyModule = {
  newPlot: (
    element: HTMLDivElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>
  ) => Promise<unknown>;
  purge: (element: HTMLDivElement) => void;
};

export function PlotViewer({
  className = "",
  onExpand,
  onRenderError,
  plot,
  size = "inline"
}: {
  className?: string;
  onExpand?: () => void;
  onRenderError?: (message: string) => void;
  plot: PlotPreviewResponse;
  size?: "inline" | "modal";
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onRenderErrorRef = useRef(onRenderError);
  const heightClass = size === "modal" ? "h-[62vh] min-h-[420px]" : "h-[280px] sm:h-[380px]";

  useEffect(() => {
    onRenderErrorRef.current = onRenderError;
  }, [onRenderError]);

  useEffect(() => {
    let cancelled = false;
    const element = containerRef.current;
    if (!element) {
      return;
    }

    async function renderPlot() {
      const plotly = (await import("plotly.js-dist-min")) as unknown as PlotlyModule;
      if (!cancelled && element) {
        await plotly.newPlot(
          element,
          Array.isArray(plot.spec.data) ? plot.spec.data : [],
          plot.spec.layout,
          {
            responsive: true,
            displaylogo: false,
            ...(plot.spec.config ?? {})
          }
        );
      }
    }

    renderPlot().catch((caught: unknown) => {
      const message =
        caught instanceof Error ? caught.message : "Plotly render failed";
      console.error("Plot render failed", caught);
      onRenderErrorRef.current?.(message);
      if (element) {
        element.textContent = `图形渲染失败：${message}`;
      }
    });

    return () => {
      cancelled = true;
      import("plotly.js-dist-min")
        .then((plotly) => {
          if (element) {
            (plotly as unknown as PlotlyModule).purge(element);
          }
        })
        .catch(() => undefined);
    };
  }, [plot]);

  return (
    <section className={`overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm ${className}`}>
      <div className="flex flex-col gap-1 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-950">可视化图形</p>
          <p className="text-xs text-neutral-500">{getPlotTypeLabel(plot.plot_type)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">可拖拽、缩放查看</span>
          {onExpand ? (
            <button
              className="h-8 rounded-md border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:border-emerald-300 hover:text-emerald-800"
              onClick={onExpand}
              type="button"
            >
              放大
            </button>
          ) : null}
        </div>
      </div>
      <div ref={containerRef} className={`${heightClass} w-full`} />
      <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
        {plot.explanation}
      </p>
    </section>
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
