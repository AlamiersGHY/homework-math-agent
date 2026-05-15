import { requestJson } from "./client";

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export async function checkHealth(): Promise<HealthResponse> {
  return requestJson<HealthResponse>(
    "/health",
    { headers: { Accept: "application/json" } },
    "Health check failed"
  );
}
