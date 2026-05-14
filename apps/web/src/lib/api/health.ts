import { API_BASE_URL } from "./config";

export type HealthResponse = {
  status: "ok";
  service: string;
  version: string;
};

export async function checkHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/health`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Health check failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
