import { API_BASE_FALLBACKS, API_BASE_URL } from "./config";

const API_BASE_STORAGE_KEY = "math-agent-api-base-url";

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const candidates = getApiBaseCandidates();
  const attempted: string[] = [];
  let lastError: unknown = null;

  for (const baseUrl of candidates) {
    const url = `${baseUrl}${path}`;
    attempted.push(url);
    try {
      const response = await fetch(url, init);
      rememberApiBase(baseUrl);
      return response;
    } catch (caught: unknown) {
      if (init?.signal instanceof AbortSignal && init.signal.aborted) {
        throw caught;
      }
      lastError = caught;
    }
  }

  throw new Error(formatNetworkError(attempted, lastError));
}

export async function requestJson<T>(
  path: string,
  init: RequestInit | undefined,
  fallbackMessage: string
): Promise<T> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers
    }
  });
  const payload = await readJson(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(payload, `${fallbackMessage} (${response.status})`));
  }

  return payload as T;
}

export async function requestNoContent(
  path: string,
  init: RequestInit | undefined,
  fallbackMessage: string
): Promise<void> {
  const response = await apiFetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = await readJson(response);
    throw new Error(extractErrorMessage(payload, `${fallbackMessage} (${response.status})`));
  }
}

export async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function extractErrorMessage(payload: unknown, fallback: string): string {
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

function getApiBaseCandidates(): string[] {
  const candidates = [
    readRememberedApiBase(),
    API_BASE_URL,
    ...API_BASE_FALLBACKS
  ].filter((value): value is string => Boolean(value));

  return [...new Set(candidates.map((value) => value.replace(/\/$/, "")))];
}

function readRememberedApiBase(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(API_BASE_STORAGE_KEY);
}

function rememberApiBase(baseUrl: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(API_BASE_STORAGE_KEY, baseUrl);
}

function formatNetworkError(attempted: string[], _lastError: unknown): string {
  return `无法连接后端 API。请确认 FastAPI 已启动，并检查 NEXT_PUBLIC_API_BASE_URL。已尝试：${attempted.join("，")}。`;
}
