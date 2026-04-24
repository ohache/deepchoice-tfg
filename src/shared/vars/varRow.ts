import type { VarDef } from "@/domain/types";
import type { z, ZodError } from "zod";
import type { VarDraftSchema } from "@/validation/varSchemas";
import { parseVarDraftRow, validateVarDraftRows, type VarsErrorBag } from "@/validation/varValidator";

export type VarDraftInput = z.input<typeof VarDraftSchema>;

export type VarRow =
  | {
    id: string;
    name: string;
    type: "number";
    min: number | string;
    max: number | string;
    initial: number | string;
  }
  | {
    id: string;
    name: string;
    type: "boolean";
    initial: boolean;
  };

export type VarRowErrors = {
  name?: string;
  min?: string;
  max?: string;
  initial?: string;
  form?: string;
};

/* Mensajes de validación de dominio reutilizados */
const DOMAIN_VALIDATION_MESSAGES = {
  duplicateVarName: "Nombre de variable duplicado.",
  minGreaterThanMax: "Min no puede ser mayor que Max ni viceversa.",
  initialOutOfRange: "Inicial debe estar entre Min y Max.",
} as const;

/* Convierte un VarDef del dominio a su forma editable en UI */
export function varDefToRow(variable: VarDef): VarRow {
  return variable.type === "number"
    ? {
      id: variable.id,
      name: variable.name,
      type: "number",
      min: variable.min,
      max: variable.max,
      initial: variable.initial
    }
    : {
      id: variable.id,
      name: variable.name,
      type: "boolean",
      initial: variable.initial
    };
}

export function getDefaultVarName(rows: VarRow[]): string {
  return `Variable${rows.length + 1}`;
}

/* Adaptación UI -> draft validable */
export function varRowToDraftInput(row: VarRow): VarDraftInput {
  if (row.type === "number") {
    return { name: row.name, type: "number", min: row.min, max: row.max, initial: row.initial } satisfies VarDraftInput;
  }

  return { name: row.name, type: "boolean", initial: row.initial } satisfies VarDraftInput;
}

/* Convierte issues de Zod a errores orientados a la UI */
function issuesToRowErrors(issues: ZodError["issues"]): VarRowErrors {
  const errors: VarRowErrors = {};

  for (const issue of issues) {
    const key = issue.path?.[0];
    const message = issue.message;

    if (key === "name") errors.name = errors.name ?? message;
    else if (key === "min") errors.min = errors.min ?? message;
    else if (key === "max") errors.max = errors.max ?? message;
    else if (key === "initial") errors.initial = errors.initial ?? message;
    else errors.form = errors.form ?? message;
  }

  return errors;
}

/* Extrae errores de dominio para una fila concreta */
function getDomainErrorsForRow(row: VarRow, allRows: VarRow[]): VarRowErrors | null {
  const errorsBag: VarsErrorBag = {};
  const drafts = allRows.map(varRowToDraftInput);

  validateVarDraftRows({ errors: errorsBag, vars: drafts, opts: { messages: DOMAIN_VALIDATION_MESSAGES } });

  const rowIndex = allRows.findIndex((entry) => entry.id === row.id);
  const entryErrors = rowIndex >= 0 ? errorsBag.varByIndex?.[rowIndex] : undefined;

  if (!entryErrors?.name && !entryErrors?.min && !entryErrors?.max && !entryErrors?.initial) return null;

  return { name: entryErrors.name, min: entryErrors.min, max: entryErrors.max, initial: entryErrors.initial };
}

/* Convierte el resultado parseado a VarDef del dominio */
function parsedDraftToVarDef(rowId: string, draft: VarDraftInput): VarDef {
  if (draft.type === "number") {
    return { id: rowId, name: draft.name, type: "number", min: Number(draft.min), max: Number(draft.max), initial: Number(draft.initial) };
  }

  return { id: rowId, name: draft.name, type: "boolean", initial: Boolean(draft.initial) };
}

/* Valida una fila UI y la convierte a VarDef listo para persistir */
export function rowToVarDefValidatedDetailed(row: VarRow, allRows: VarRow[]): { ok: true; value: VarDef } | { ok: false; errors: VarRowErrors } {
  const draft = varRowToDraftInput(row);
  const parsed = parseVarDraftRow(draft);

  if (!parsed.ok) return { ok: false, errors: issuesToRowErrors(parsed.issues) };

  const domainErrors = getDomainErrorsForRow(row, allRows);
  if (domainErrors) return { ok: false, errors: domainErrors };

  return { ok: true, value: parsedDraftToVarDef(row.id, parsed.value) };
}