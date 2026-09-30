"use client";

export type ApiFailure = { ok: false; status: number; code: string; message: string; details?: unknown };
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** JSON fetch wrapper that never throws; always returns a typed result. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      signal: init.signal,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        code: json?.error?.code ?? "HTTP_" + res.status,
        message: json?.error?.message ?? "Something went wrong. Please try again.",
        details: json?.error?.details,
      };
    }
    return { ok: true, data: json?.data as T };
  } catch (err) {
    if ((err as Error).name === "AbortError") return { ok: false, status: 0, code: "ABORTED", message: "Cancelled" };
    return { ok: false, status: 0, code: "NETWORK", message: "You appear to be offline. Check your connection and try again." };
  }
}

export function fieldErrors(r: ApiFailure): Record<string, string> {
  if (r.code === "VALIDATION_ERROR" && r.details && typeof r.details === "object") return r.details as Record<string, string>;
  if (r.details && typeof r.details === "object" && !Array.isArray(r.details)) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.details as Record<string, unknown>)) if (typeof v === "string") out[k] = v;
    return out;
  }
  return {};
}
