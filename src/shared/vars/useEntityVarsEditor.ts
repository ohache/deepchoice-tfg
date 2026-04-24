import { useCallback, useEffect, useRef, useState } from "react";
import type { VarDef } from "@/domain/types";
import { generateId } from "@/utils/id";
import { type VarRow, type VarRowErrors, getDefaultVarName, rowToVarDefValidatedDetailed, varDefToRow } from "@/shared/vars/varRow";

type PersistSaveMeta = {
  existedBefore: boolean;
};

type UseEntityVarsEditorArgs = {
  initialVars: VarDef[];
  createId?: () => string;
  onPersistRemove?: (varId: string) => void;
  onPersistSave?: (variable: VarDef, meta: PersistSaveMeta) => void;
  useDirtyTracking?: boolean;
  blockOpenIfDirty?: boolean;
  onBlockedOpenDirty?: () => void;
};

type SaveVarResult =
  | { ok: true; variable: VarDef }
  | { ok: false; errors: VarRowErrors };

export type UseEntityVarsEditorResult = {
  draftVars: VarRow[];
  openVarId: string | null;
  varNameRefs: React.RefObject<Record<string, HTMLInputElement | null>>;
  dirtyVarIds: Set<string>;

  setDraftVars: React.Dispatch<React.SetStateAction<VarRow[]>>;
  setOpenVarId: React.Dispatch<React.SetStateAction<string | null>>;

  isDirtyVar: (id: string) => boolean;
  markDirty: (id: string) => void;
  clearDirty: (id: string) => void;

  syncFromVars: (vars: VarDef[]) => void;
  computeRowErrors: (row: VarRow) => VarRowErrors | undefined;

  updateVarRow: (id: string, patch: Partial<VarRow>, opts?: { dirty?: boolean }) => void;
  switchVarType: (id: string, nextType: "number" | "boolean") => void;
  addVarRow: () => string;
  toggleVarOpen: (id: string) => void;
  removeVarRow: (id: string) => void;
  saveVarRow: (row: VarRow) => SaveVarResult;
};

/* Hook reutilizable para editar colecciones de variables de entidad */
export function useEntityVarsEditor({ initialVars, createId = () => generateId.var(), onPersistRemove, onPersistSave, useDirtyTracking = false,
  blockOpenIfDirty = false, onBlockedOpenDirty }: UseEntityVarsEditorArgs): UseEntityVarsEditorResult {
  const [draftVars, setDraftVars] = useState<VarRow[]>(() => initialVars.map(varDefToRow));
  const [openVarId, setOpenVarId] = useState<string | null>(null);
  const [dirtyVarIds, setDirtyVarIds] = useState<Set<string>>(new Set());
  const varNameRefs = useRef<Record<string, HTMLInputElement | null>>({});

  /* Marca una variable como modificada */
  const markDirty = useCallback((id: string) => {
      if (!useDirtyTracking) return;

      setDirtyVarIds((prev) => {
        if (prev.has(id)) return prev;

        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }, [useDirtyTracking],
  );

  /* Limpia el estado dirty de una variable */
  const clearDirty = useCallback((id: string) => {
      if (!useDirtyTracking) return;

      setDirtyVarIds((prev) => {
        if (!prev.has(id)) return prev;

        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, [useDirtyTracking],
  );

  /* Indica si una variable concreta está marcada como modificada */
  const isDirtyVar = useCallback((id: string) => {
      if (!useDirtyTracking) return false;
      return dirtyVarIds.has(id);
    }, [dirtyVarIds, useDirtyTracking],
  );

  const syncFromVars = useCallback((vars: VarDef[]) => {
    setDraftVars(vars.map(varDefToRow));
    setOpenVarId(null);
    setDirtyVarIds(new Set());
  }, []);

  useEffect(() => {
    if (!openVarId) return;

    const input = varNameRefs.current[openVarId];
    if (!input) return;

    requestAnimationFrame(() => {
      input.focus();

      try {
        input.select();
      } catch {
        try {
          const len = input.value.length;
          input.setSelectionRange(0, len);
        } catch {}
      }
    });
  }, [openVarId]);

  /* Calcula los errores actuales de una fila usando el conjunto draft completo */
  const computeRowErrors = useCallback(
    (row: VarRow) => {
      const result = rowToVarDefValidatedDetailed(row, draftVars);
      return result.ok ? undefined : result.errors;
    }, [draftVars],
  );

  /* Actualiza parcialmente una fila */
  const updateVarRow = useCallback(
    (id: string, patch: Partial<VarRow>, opts?: { dirty?: boolean }) => {
      setDraftVars((prev) => prev.map((variable) => variable.id === id ? ({ ...variable, ...patch } as VarRow) : variable ));

      if (opts?.dirty !== false) markDirty(id);
    }, [markDirty],
  );

  /* Cambia el tipo de una variable entre number y boolean */
  const switchVarType = useCallback(
    (id: string, nextType: "number" | "boolean") => {
      setDraftVars((prev) =>
        prev.map((variable) => {
          if (variable.id !== id) return variable;
          if (variable.type === nextType) return variable;

          return nextType === "number"
            ? { id: variable.id, name: variable.name, type: "number", min: 1, max: 10, initial: 5 }
            : { id: variable.id, name: variable.name, type: "boolean", initial: true };
        }),
      );

      markDirty(id);
    }, [markDirty],
  );

  const addVarRow = useCallback(() => {
    const id = createId();

    setDraftVars((prev) => {
      const name = getDefaultVarName(prev);
      const nextRow: VarRow = { id, name, type: "number", min: 1, max: 10, initial: 5 };

      return [...prev, nextRow];
    });

    setOpenVarId(id);
    markDirty(id);

    return id;
  }, [createId, markDirty]);

  const toggleVarOpen = useCallback(
    (id: string) => {
      if (blockOpenIfDirty && openVarId && openVarId !== id && isDirtyVar(openVarId)) {
        onBlockedOpenDirty?.();
        return;
      }

      setOpenVarId((prev) => (prev === id ? null : id));
    }, [blockOpenIfDirty, openVarId, isDirtyVar, onBlockedOpenDirty],
  );

  const removeVarRow = useCallback(
    (id: string) => {
      setDraftVars((prev) => prev.filter((variable) => variable.id !== id));
      setOpenVarId((prev) => (prev === id ? null : prev));
      clearDirty(id);
      onPersistRemove?.(id);
    }, [clearDirty, onPersistRemove],
  );

  const saveVarRow = useCallback(
    (row: VarRow): SaveVarResult => {
      if (useDirtyTracking && !isDirtyVar(row.id)) {
        setOpenVarId(null);

        const currentRow = draftVars.find((variable) => variable.id === row.id);
        if (!currentRow) return { ok: false, errors: { name: "La variable no existe." } };

        const parsedCurrent = rowToVarDefValidatedDetailed(currentRow, draftVars);
        if (!parsedCurrent.ok) return { ok: false, errors: parsedCurrent.errors };

        return { ok: true, variable: parsedCurrent.value };
      }

      const parsed = rowToVarDefValidatedDetailed(row, draftVars);
      if (!parsed.ok) return { ok: false, errors: parsed.errors };

      const variable = parsed.value;
      const existedBefore = initialVars.some((persistedVar) => persistedVar.id === variable.id);

      setDraftVars((prev) => prev.map((currentVar) => currentVar.id === variable.id ? varDefToRow(variable) : currentVar));

      clearDirty(variable.id);
      setOpenVarId(null);
      onPersistSave?.(variable, { existedBefore });

      return { ok: true, variable };
    }, [useDirtyTracking, isDirtyVar, draftVars, initialVars, clearDirty, onPersistSave],
  );

  return { draftVars, openVarId, varNameRefs, dirtyVarIds, setDraftVars, setOpenVarId, isDirtyVar, markDirty, clearDirty, syncFromVars, computeRowErrors,
    updateVarRow, switchVarType, addVarRow, toggleVarOpen, removeVarRow, saveVarRow };
}