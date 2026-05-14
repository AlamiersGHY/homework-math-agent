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
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div ref={containerRef} className="h-[320px] w-full sm:h-[420px]" />
      <p className="border-t border-neutral-100 px-4 py-3 text-sm leading-6 text-neutral-600">
        {plot.explanation}
      </p>
    </div>
  );
}
