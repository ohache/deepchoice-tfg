import type { ZodError } from "zod";

type IssueLike = {
  path?: readonly PropertyKey[];
  message: string;
};

export function pathKey(path: readonly PropertyKey[]): string {
  return (path ?? []).map((value) => (typeof value === "symbol" ? value.toString() : String(value))).join(".");
}

export function formatZodIssues(issues: readonly IssueLike[]): string {
  return issues
    .map((issue) => {
      const key = issue.path?.length ? pathKey(issue.path) : "";
      return key ? `${key}: ${issue.message}` : issue.message;
    }).join(" · ");
}

export function buildInlineErrorMapByPath(issues: readonly IssueLike[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) continue;

    const key = pathKey(issue.path);
    out[key] = out[key] ? `${out[key]} · ${issue.message}` : issue.message;
  }

  return out;
}

export function buildInlineErrorMapByFirst(issues: readonly IssueLike[]): Record<string, string> {
  const byFirst: Record<string, IssueLike[]> = {};

  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) continue;

    const first = issue.path[0];
    const key = typeof first === "symbol" ? first.toString() : String(first);

    byFirst[key] ??= [];
    byFirst[key].push(issue);
  }

  const out: Record<string, string> = {};

  for (const key of Object.keys(byFirst)) {
    out[key] = byFirst[key].map((issue) => issue.message).join(" · ");
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