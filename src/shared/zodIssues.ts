import type { ZodError } from "zod";

export type IssueLike = {
  path?: readonly PropertyKey[];
  message: string;
};

/* Convierte una ruta de Zod en una clave textual */
function pathKey(path: readonly PropertyKey[]): string {
  return path.map((value) => (typeof value === "symbol" ? value.toString() : String(value))).join(".");
}

/* Convierte una lista de errores en un único string legible */
export function formatZodIssues(issues: readonly IssueLike[]): string {
  return issues.map((issue) => {
      const key = issue.path?.length ? pathKey(issue.path) : "";
      return key ? `${key}: ${issue.message}` : issue.message;
    }).join(" · ");
}

/* Construye un mapa de errores usando la ruta completa como clave */
export function buildInlineErrorMapByPath(issues: readonly IssueLike[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) continue;

    const key = pathKey(issue.path);
    out[key] = out[key] ? `${out[key]} · ${issue.message}` : issue.message;
  }

  return out;
}

/* Construye un mapa de errores agrupando el primer segmento del path */
export function buildInlineErrorMapByFirst(issues: readonly IssueLike[]): Record<string, string> {
  const out: Record<string, string> = {};

  for (const issue of issues) {
    if (!issue.path || issue.path.length === 0) continue;

    const first = issue.path[0];
    const key = typeof first === "symbol" ? first.toString() : String(first);

    out[key] = out[key] ? `${out[key]} · ${issue.message}` : issue.message;
  }

  return out;
}

/* Convierte los errores de Zod en un objeto de errores de formulario */
export function issuesToFieldErrors<T extends Record<string, string | undefined>>(zodError: ZodError | undefined, initialErrors: T): T {
  const errors: Record<string, string | undefined> = { ...initialErrors };

  if (!zodError) return errors as T;

  for (const issue of zodError.issues) {
    const top = issue.path[0];

    if (typeof top !== "string") continue;
    if (!(top in errors)) continue;
    if (errors[top] !== undefined) continue;

    errors[top] = issue.message;

  }

  return errors as T;
}

/* Convierte errores de Zod en errores de formulario usando una lista cerrada de campos permitidos */
export function issuesToAllowedFieldErrors<T extends Record<string, string | undefined>>(zodError: ZodError | undefined, allowedFields: readonly (keyof T)[]): T {
  const errors: Partial<T> = {};

  if (!zodError) return errors as T;

  for (const issue of zodError.issues) {
    const top = issue.path[0];

    if (typeof top !== "string") continue;

    const field = top as keyof T;

    if (!allowedFields.includes(field)) continue;
    if (errors[field] !== undefined) continue;

    errors[field] = issue.message as T[keyof T];
  }

  return errors as T;
}