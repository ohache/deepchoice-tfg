// shared/validation/zodIssues.ts
import type { ZodError } from "zod";

export type ZodIssue = ZodError["issues"][number];

export function pathKey(path: PropertyKey[]): string {
  return (path ?? []).map((x) => (typeof x === "symbol" ? x.toString() : String(x))).join(".");
}

export function formatZodIssues(issues: ZodIssue[]): string {
  return issues
    .map((i) => {
      const p = i.path?.length ? pathKey(i.path) : "";
      return p ? `${p}: ${i.message}` : i.message;
    })
    .join(" · ");
}

export function buildInlineErrorMapByPath(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const it of issues) {
    if (!it.path || it.path.length === 0) continue;
    const k = pathKey(it.path);
    out[k] = out[k] ? `${out[k]} · ${it.message}` : it.message;
  }
  return out;
}

export function buildInlineErrorMapByFirst(issues: ZodIssue[]): Record<string, string> {
  const byFirst: Record<string, ZodIssue[]> = {};

  for (const it of issues) {
    if (!it.path || it.path.length === 0) continue;
    const first = it.path[0];
    const key = typeof first === "symbol" ? first.toString() : String(first);
    byFirst[key] ??= [];
    byFirst[key].push(it);
  }

  const out: Record<string, string> = {};
  for (const k of Object.keys(byFirst)) {
    out[k] = byFirst[k].map((x) => x.message).join(" · ");
  }
  return out;
}

export function issuesToFieldErrors<T extends Record<string, string | undefined>>(zodError: ZodError | undefined, initialErrors: T): T {
  const errors = { ...initialErrors };

  if (!zodError) return errors;

  for (const issue of zodError.issues) {
    const top = issue.path[0];
    if (typeof top !== "string") continue;
    if (!(top in errors)) continue;

    const key = top as keyof T;

    if (errors[key] == null) errors[key] = issue.message as T[keyof T];
  }

  return errors;
}
