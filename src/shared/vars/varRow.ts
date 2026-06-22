import type { VarDef } from "@/domain/types";
import { parseVarDraftRow, validateVarsDraft, type VarDraftInput, type VarDraftOutput, type VarFieldErrors } from "@/validation/varValidator";

export type VarRow =
  | { id: string; name: string; type: "number"; min: number | string; max: number | string; initial: number | string }
  | { id: string; name: string; type: "boolean"; initial: boolean };

export type VarRowErrors = VarFieldErrors;

/* Convierte un VarDef del dominio a su forma editable en UI */
export function varDefToRow(variable: VarDef): VarRow {
  return variable.type === "number"
    ? { id: variable.id, name: variable.name, type: "number", min: variable.min, max: variable.max, initial: variable.initial }
    : { id: variable.id, name: variable.name, type: "boolean", initial: variable.initial };
}

/* Genera un nombre por defecto para una nueva variable */
export function getDefaultVarName(rows: VarRow[]): string {
  return `Variable${rows.length + 1}`;
}

/* Adaptación UI -> draft validable */
export function varRowToDraftInput(row: VarRow): VarDraftInput {
  if (row.type === "number") {
    return { name: row.name, type: "number", min: row.min, max: row.max, initial: row.initial };
  }

  return { name: row.name, type: "boolean", initial: row.initial };
}

/* Asigna un mensaje de error a un campo concreto de la fila */
function setRowError(errors: VarRowErrors, field: keyof VarFieldErrors, message: string): void {
  switch (field) {
    case "name":
      errors.name ??= message;
      break;
    case "type":
      errors.type ??= message;
      break;
    case "min":
      errors.min ??= message;
      break;
    case "max":
      errors.max ??= message;
      break;
    case "initial":
      errors.initial ??= message;
      break;
  }
}

/* Convierte issues de Zod a errores orientados a una fila de UI */
function issuesToRowErrors(issues: { path: PropertyKey[]; message: string }[]): VarRowErrors {
  const errors: VarRowErrors = {};

  for (const issue of issues) {
    const field = issue.path[0];

    if (field === "name" || field === "type" || field === "min" || field === "max" || field === "initial") setRowError(errors, field, issue.message);
  }

  return errors;
}

/* Extrae los errores de colección que afectan a una fila concreta */
function getCollectionErrorsForRow(row: VarRow, allRows: VarRow[]): VarRowErrors | null {
  const rowIndex = allRows.findIndex((entry) => entry.id === row.id);
  if (rowIndex < 0) return null;

  const drafts = allRows.map(varRowToDraftInput);
  const errorsBag = validateVarsDraft({ vars: drafts });

  const rowErrors = errorsBag.varByIndex?.[rowIndex];
  if (!rowErrors) return null;

  const hasErrors = !!rowErrors.name || !!rowErrors.type || !!rowErrors.min || !!rowErrors.max || !!rowErrors.initial;

  return hasErrors ? rowErrors : null;
}

/* Convierte el resultado parseado a VarDef del dominio */
function parsedDraftToVarDef(rowId: string, draft: VarDraftOutput): VarDef {
  if (draft.type === "number") {
    return { id: rowId, name: draft.name, type: "number", min: draft.min, max: draft.max, initial: draft.initial };
  }

  return { id: rowId, name: draft.name, type: "boolean", initial: draft.initial };
}

/* Valida una fila UI y la convierte a VarDef listo para persistir */
export function rowToVarDefValidatedDetailed(row: VarRow, allRows: VarRow[]): { ok: true; value: VarDef } | { ok: false; errors: VarRowErrors } {
  const draft = varRowToDraftInput(row);
  const parsed = parseVarDraftRow(draft);

  if (!parsed.ok) return { ok: false, errors: issuesToRowErrors(parsed.issues) };

  const collectionErrors = getCollectionErrorsForRow(row, allRows);

  if (collectionErrors) return { ok: false, errors: collectionErrors };

  return { ok: true, value: parsedDraftToVarDef(row.id, parsed.value) };
}