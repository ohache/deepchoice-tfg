import type { VarDef } from "@/domain/types";
import type { z, ZodError } from "zod";
import type { VarDraftSchema } from "@/validation/varSchemas";
import { parseVarDraftRow, validateVarDraftRows, type VarsErrorBag } from "@/validation/varValidator";

export type VarDraftInput = z.input<typeof VarDraftSchema>;

export type VarRow =
  | { id: string; name: string; type: "number"; min: number | string; max: number | string; initial: number | string }
  | { id: string; name: string; type: "boolean"; initial: boolean };

export type VarRowErrors = {
  name?: string;
  min?: string;
  max?: string;
  initial?: string;
  form?: string;
};

export function varDefToRow(v: VarDef): VarRow {
  return v.type === "number"
    ? { id: v.id, name: v.name, type: "number", min: v.min, max: v.max, initial: v.initial }
    : { id: v.id, name: v.name, type: "boolean", initial: v.initial };
}

export function getDefaultVarName(rows: VarRow[]) {
  return `Variable${rows.length + 1}`;
}

/* Adaptación UI -> Draft (*/
export function varRowToDraftInput(row: VarRow): VarDraftInput {
  if (row.type === "number") {
    const draft = { name: row.name, type: "number", min: row.min, max: row.max, initial: row.initial } satisfies VarDraftInput;
    return draft;
  }

  const draft = { name: row.name, type: "boolean", initial: row.initial } satisfies VarDraftInput;
  return draft;
}

/* Mapear issues de Zod a errores para UI */
function issuesToRowErrors(issues: ZodError["issues"]): VarRowErrors {
  const errors: VarRowErrors = {};

  for (const issue of issues) {
    const key = issue.path?.[0];
    const msg = issue.message;

    if (key === "name") errors.name = errors.name ?? msg;
    else if (key === "min") errors.min = errors.min ?? msg;
    else if (key === "max") errors.max = errors.max ?? msg;
    else if (key === "initial") errors.initial = errors.initial ?? msg;
    else errors.form = errors.form ?? msg;
  }

  return errors;
}

/* Valida y convierte fila UI -> VarDef */
export function rowToVarDefValidatedDetailed(row: VarRow, allRows: VarRow[]): { ok: true; value: VarDef } | { ok: false; errors: VarRowErrors } {
  // Estructura (Zod)
  const draft = varRowToDraftInput(row);
  const parsed = parseVarDraftRow(draft);
  if (!parsed.ok) return { ok: false, errors: issuesToRowErrors(parsed.issues) };

  // Reglas “de dominio” (duplicados y rangos) reutilizando validateVarDraftRows
  const bag: VarsErrorBag = {};
  const drafts = allRows.map(varRowToDraftInput);

  validateVarDraftRows({
    errors: bag, vars: drafts,
    opts: {
      messages: {
        duplicateVarName: "Nombre de variable duplicado.",
        minGreaterThanMax: "Min no puede ser mayor que Max ni Max menor que Min.",
        initialOutOfRange: "Inicial debe estar entre Min y Max.",
      },
    },
  });

  const idx = allRows.findIndex((r) => r.id === row.id);
  const e = idx >= 0 ? bag.varByIndex?.[idx] : undefined;

  if (e?.name || e?.min || e?.max || e?.initial) {
    const out: VarRowErrors = {};
    if (e.name) out.name = e.name;
    if (e.min) out.min = e.min;
    if (e.max) out.max = e.max;
    if (e.initial) out.initial = e.initial;

    return { ok: false, errors: out };
  }

  const v = parsed.value;

  if (v.type === "number") {
    const min = Number(v.min);
    const max = Number(v.max);
    const initial = Number(v.initial);

    return {
      ok: true,
      value: { id: row.id, name: v.name, type: "number", min, max, initial }
    };
  }

  return {
    ok: true,
    value: { id: row.id, name: v.name, type: "boolean", initial: Boolean(v.initial) },
  };
}