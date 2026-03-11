import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Standard JSON API response helpers */
export function jsonOk<T>(data: T, status = 200) {
  return Response.json({ ok: true, data }, { status });
}

export function jsonError(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export function handleApiError(err: unknown) {
  if (err instanceof Error) {
    if (err.message === "UNAUTHORIZED") return jsonError("Not authenticated", 401);
    if (err.message === "FORBIDDEN") return jsonError("Access denied", 403);
    if (err.message === "ACCOUNT_DISABLED") return jsonError("Account disabled", 403);
    // Don't leak internal error messages — return generic 500
    console.error("[API Error]", err.message);
    return jsonError("Internal server error", 500);
  }
  return jsonError("Internal server error", 500);
}

/** Safely parse JSON with a fallback value */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    console.error("[safeJsonParse] Malformed JSON:", json.slice(0, 100));
    return fallback;
  }
}
