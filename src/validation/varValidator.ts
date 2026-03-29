// src/validation/varValidator.ts
import type { z, ZodError } from "zod";
import { VarDraftSchema, type VarDraftInput, type VarDraftOutput } from "@/validation/varSchemas";

/** Errores por fila (sin id, el índice es la clave) */
export type VarFieldErrors = {
  name?: string;
  type?: string;
  min?: string;
  max?: string;
  initial?: string;
};

export type VarsErrorBag = {
  vars?: string;
  varByIndex?: Record<number, VarFieldErrors>;
};

function ensureVarErr(errors: VarsErrorBag, idx: number): VarFieldErrors {
  errors.varByIndex ??= {};
  errors.varByIndex[idx] ??= {};
  return errors.varByIndex[idx]!;
}

/** Mapea un issue de Zod dentro de vars[] a un error por índice */
export function applyVarZodIssue(args: { errors: VarsErrorBag; issuePath: readonly PropertyKey[]; issueMessage: string }) {
  const { errors, issuePath, issueMessage } = args;

  const idxKey = issuePath[1];
  const fieldKey = issuePath[2];

  if (typeof idxKey !== "number") {
    errors.vars = errors.vars ?? issueMessage;
    return;
  }

  if (typeof fieldKey !== "string") {
    errors.vars = errors.vars ?? "Hay errores en las variables.";
    return;
  }

  const vErr = ensureVarErr(errors, idxKey);

  switch (fieldKey) {
    case "name":
      vErr.name = issueMessage;
      break;
    case "type":
      vErr.type = issueMessage;
      break;
    case "min":
      vErr.min = issueMessage;
      break;
    case "max":
      vErr.max = issueMessage;
      break;
    case "initial":
      vErr.initial = issueMessage;
      break;
    default:
      errors.vars = errors.vars ?? "Hay errores en las variables.";
      break;
  }
}

export type ValidateVarDraftRowsOptions = {
  /** Para validar duplicados contra el catálogo existente  */
  existingNamesLower?: Set<string>;
  messages?: { duplicateVarName?: string; minGreaterThanMax?: string; initialOutOfRange?: string; };
};

/** Reglas extra para filas draft */
export function validateVarDraftRows(args: { errors: VarsErrorBag; vars?: VarDraftInput[] | undefined; opts?: ValidateVarDraftRowsOptions; }) {
  const { errors } = args;
  const vars = args.vars ?? [];
  if (vars.length === 0) return;

  const messages = {
    duplicateVarName: "Nombre de variable duplicado.",
    minGreaterThanMax: "Min no puede ser mayor que Max ni Max menor que Min.",
    initialOutOfRange: "Inicial debe estar entre Min y Max.",
    ...(args.opts?.messages ?? {}),
  };

  const seen = new Set<string>();
  const existing = args.opts?.existingNamesLower;

  vars.forEach((v, idx) => {
    const name = (v.name ?? "").trim();
    if (!name) return;

    const key = name.toLowerCase();

    if (seen.has(key)) ensureVarErr(errors, idx).name = messages.duplicateVarName;
    else seen.add(key);

    if (existing?.has(key)) ensureVarErr(errors, idx).name = messages.duplicateVarName;

    if (v.type === "number") {
      const min = Number(v.min);
      const max = Number(v.max);
      const initial = Number(v.initial);

      if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
        const e = ensureVarErr(errors, idx);
        e.min = messages.minGreaterThanMax;
        e.max = messages.minGreaterThanMax;
      }

      if (Number.isFinite(min) && Number.isFinite(max) && Number.isFinite(initial)) {
        if (initial < min || initial > max) ensureVarErr(errors, idx).initial = messages.initialOutOfRange;
      }
    }
  });
}

/* Valida un row suelto */
export function parseVarDraftRow( row: unknown ): { ok: true; value: VarDraftOutput } | { ok: false; issues: z.ZodIssue[] } {
  const r = VarDraftSchema.safeParse(row);
  if (!r.success) return { ok: false, issues: r.error.issues };
  return { ok: true, value: r.data };
}

/* Valida el draft completo (útil al guardar) */
export function validateVarsDraft(args: { vars: VarDraftInput[] | undefined; zodError?: ZodError; opts?: ValidateVarDraftRowsOptions; }): VarsErrorBag {
  const { vars, zodError, opts } = args;

  const errors: VarsErrorBag = {};

  // Errores estructurales de Zod (required, min/max de string, etc.)
  if (zodError) {
    for (const issue of zodError.issues) {
      if (issue.path[0] !== "vars") continue;

      applyVarZodIssue({ errors, issuePath: issue.path, issueMessage: issue.message });
    }
  }

  // Validaciones de dominio
  validateVarDraftRows({ errors, vars, opts });

  return errors;
}