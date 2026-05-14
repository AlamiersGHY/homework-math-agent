declare module "plotly.js-dist-min" {
  export function newPlot(
    element: HTMLDivElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>
  ): Promise<unknown>;

  export function purge(element: HTMLDivElement): void;
}
