import type { z, ZodError } from "zod";
import { VarDraftSchema } from "@/validation/varSchemas";

const VAR_FIELDS = ["name", "type", "min", "max", "initial"] as const;

export type VarDraftInput = z.input<typeof VarDraftSchema>;
export type VarDraftOutput = z.output<typeof VarDraftSchema>;

type VarField = typeof VAR_FIELDS[number];

/* Errores por fila */
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

type ValidateVarDraftRowsOptions = {
  existingNamesLower?: Set<string>;
  duplicateVarName?: string;
};

function ensureVarErr(errors: VarsErrorBag, index: number): VarFieldErrors {
  errors.varByIndex ??= {};
  errors.varByIndex[index] ??= {};
  return errors.varByIndex[index]!;
}

function isVarField(value: unknown): value is VarField {
  return typeof value === "string" && VAR_FIELDS.includes(value as VarField);
}

function setVarFieldError(errors: VarsErrorBag, index: number, field: VarField, message: string): void {
  const rowErrors = ensureVarErr(errors, index);

  switch (field) {
    case "name":
      rowErrors.name = message;
      break;
    case "type":
      rowErrors.type = message;
      break;
    case "min":
      rowErrors.min = message;
      break;
    case "max":
      rowErrors.max = message;
      break;
    case "initial":
      rowErrors.initial = message;
      break;
  }
}

/* Mapea un issue de Zod dentro de vars[] a un error por índice */
function applyVarZodIssue(args: { errors: VarsErrorBag; issuePath: readonly PropertyKey[]; issueMessage: string }): void {
  const { errors, issuePath, issueMessage } = args;

  const index = issuePath[1];
  const field = issuePath[2];

  if (typeof index !== "number") {
    errors.vars ??= issueMessage;
    return;
  }

  if (!isVarField(field)) {
    errors.vars ??= "Hay errores en las variables.";
    return;
  }

  setVarFieldError(errors, index, field, issueMessage);
}

/* Añade al error bag los errores Zod correspondientes a vars[] */
function collectVarZodErrors(errors: VarsErrorBag, zodError?: ZodError): void {
  if (!zodError) return;

  for (const issue of zodError.issues) {
    if (issue.path[0] !== "vars") continue;

    applyVarZodIssue({ errors, issuePath: issue.path, issueMessage: issue.message });
  }
}

/* Valida nombres duplicados dentro del conjunto de variables */
function validateDuplicatedVarNames(args: { errors: VarsErrorBag; vars?: VarDraftInput[]; opts?: ValidateVarDraftRowsOptions }): void {
  const vars = args.vars ?? [];
  if (!vars.length) return;

  const duplicateMessage = args.opts?.duplicateVarName ?? "Nombre de variable duplicado.";

  const seen = new Set<string>();
  const existing = args.opts?.existingNamesLower;

  for (let index = 0; index < vars.length; index++) {
    const name = vars[index]?.name?.trim();
    if (!name) continue;

    const key = name.toLowerCase();

    if (seen.has(key) || existing?.has(key)) {
      setVarFieldError(args.errors, index, "name", duplicateMessage);
      continue;
    }

    seen.add(key);
  }
}

/* Valida un row suelto */
export function parseVarDraftRow(row: unknown): { ok: true; value: VarDraftOutput } | { ok: false; issues: ZodError["issues"] } {
  const result = VarDraftSchema.safeParse(row);

  if (!result.success) return { ok: false, issues: result.error.issues };

  return { ok: true, value: result.data };
}

/* Valida el draft completo de variables */
export function validateVarsDraft(args: { vars: VarDraftInput[] | undefined; zodError?: ZodError; opts?: ValidateVarDraftRowsOptions }): VarsErrorBag {
  const errors: VarsErrorBag = {};

  collectVarZodErrors(errors, args.zodError);

  validateDuplicatedVarNames({ errors, vars: args.vars, opts: args.opts });

  return errors;
}