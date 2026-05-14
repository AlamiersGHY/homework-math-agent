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

export function PlotViewer({ plot }: { plot: PlotPreviewResponse }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

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

    renderPlot().catch(() => {
      if (element) {
        element.textContent = "图形渲染失败";
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
    <section className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex flex-col gap-1 border-b border-neutral-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-950">可视化图形</p>
          <p className="text-xs text-neutral-500">{getPlotTypeLabel(plot.plot_type)}</p>
        </div>
        <span className="text-xs font-medium text-neutral-500">可拖拽、缩放查看</span>
      </div>
      <div ref={containerRef} className="h-[340px] w-full sm:h-[460px]" />
      <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-700">
        {plot.explanation}
      </p>
    </section>
  );
}

function getPlotTypeLabel(plotType: PlotPreviewResponse["plot_type"]) {
  if (plotType === "surface3d") {
    return "三维曲面";
  }
  if (plotType === "region2d") {
    return "二维区域";
  }
  return "二维函数";
}
