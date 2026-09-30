/** Only same-site relative paths. Rejects "//host", "/\host" (browsers treat "\" as "/") and control characters. */
export function safeNextPath(next: string | null | undefined): string | undefined {
  if (!next || typeof next !== "string" || next.length > 500) return undefined;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return undefined;
  return next;
}
