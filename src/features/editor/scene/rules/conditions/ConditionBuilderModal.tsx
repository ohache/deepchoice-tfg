import { useEffect, useMemo, useState, useCallback } from "react";
import type { Project } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { conditionSchema } from "@/validation/rulesSchemas";
import { conditionToUiDraft, createDefaultRootCondition, pruneEmptyGroups, uiDraftToCondition, type UiDraft } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
import { ConditionGroups } from "@/features/editor/scene/rules/conditions/ConditionGroups";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { toast } from "@/shared/toast/toastStore";

type Props = {
  open: boolean;
  project: Project | null;
  currentNodeId?: string;
  value?: Condition | null;
  title?: string;
  onClose: () => void;
  onSave: (cond: Condition) => void;
  onApply?: (cond: Condition) => void;
};

/* Genera una firma mínima del draft para detectar cambios reales */
function signatureOfDraft(draft: UiDraft): string {
  const cleaned = pruneEmptyGroups(draft);

  const minimal = {
    groups: (cleaned.groups ?? []).map((group) => ({
      atoms: (group.atoms ?? []).map((atom) => ({ not: Boolean(atom.not), cond: atom.cond })),
    })),
  };

  return JSON.stringify(minimal);
}

/* Valida y transforma el draft actual en una condición final */
function parseConditionFromDraft(draft: UiDraft): Condition | null {
  const cleaned = pruneEmptyGroups(draft);
  const cond = uiDraftToCondition(cleaned);
  const parsed = conditionSchema.safeParse(cond);

  if (!parsed.success) return null;
  return parsed.data;
}

export function ConditionBuilderModal({ open, project, currentNodeId, value, title = "Condiciones", onClose, onSave, onApply }: Props) {

  const initialDraft = useMemo<UiDraft>(() => conditionToUiDraft(value ?? createDefaultRootCondition()), [value]);

  const initialSig = useMemo(() => signatureOfDraft(initialDraft), [initialDraft]);

  const [draft, setDraft] = useState<UiDraft>(initialDraft);
  const [isBusy, setIsBusy] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [confirmExitOpen, setConfirmExitOpen] = useState(false);

  const currentSig = useMemo(() => signatureOfDraft(draft), [draft]);
  const isDirty = currentSig !== initialSig;

  const hasSomethingToClear = useMemo(() => pruneEmptyGroups(draft).groups.some((group) => (group.atoms?.length ?? 0) > 0), [draft]);

  /* Reseteo al abrir */
  useEffect(() => {
    if (!open) return;

    setDraft(initialDraft);
    setConfirmClearOpen(false);
    setConfirmExitOpen(false);
  }, [open, initialDraft]);

  /* Actions */
  const handleSave = useCallback((): boolean => {
    const parsedCondition = parseConditionFromDraft(draft);

    if (!parsedCondition) {
      toast.error("Condición inválida", "Revisa los campos. Hay valores vacíos o no válidos.");
      return false;
    }

    onSave(parsedCondition);
    toast.success("Condición guardada", "La condición se ha aplicado correctamente.");
    onClose();
    return true;
  }, [draft, onSave, onClose]);

  const attemptClose = useCallback(() => {
    if (confirmClearOpen) return;

    if (isDirty) {
      setConfirmExitOpen(true);
      return;
    }

    onClose();
  }, [confirmClearOpen, isDirty, onClose]);

  const handleClear = useCallback(() => {
    if (!hasSomethingToClear || isBusy) return;
    setConfirmClearOpen(true);
  }, [hasSomethingToClear, isBusy]);

  const confirmClear = useCallback(() => {
    const emptyCondition = createDefaultRootCondition();
    const parsed = conditionSchema.safeParse(emptyCondition);

    if (!parsed.success) {
      toast.error("No se pudo borrar", "La condición vacía resultó inválida (schema).");
      setConfirmClearOpen(false);
      return;
    }

    setDraft(conditionToUiDraft(parsed.data));
    setConfirmClearOpen(false);

    (onApply ?? onSave)(parsed.data);
    toast.info("Condición reiniciada", "Has limpiado las condiciones.");
  }, [onApply, onSave]);

  const cancelClear = useCallback(() => { setConfirmClearOpen(false); }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-1000 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          if (confirmClearOpen || confirmExitOpen) return;
          attemptClose();
        }}
        aria-label="Cerrar"
      />

      <div className="relative w-[92%] max-w-[980px] rounded-xl border-3 border-slate-600 bg-slate-900 p-4 shadow-xl text-center">
        <h3 className="text-base font-semibold text-slate-50">{title}</h3>

        <div className="pt-3">
          <div className="rounded-lg border-2 border-slate-700 bg-slate-950/90 p-2 h-[60vh] overflow-y-auto editor-scroll">
            <ConditionGroups
              project={project}
              currentNodeId={currentNodeId}
              value={draft}
              onChange={setDraft}
              onBusyChange={setIsBusy}
            />
          </div>
        </div>

        <div
          className={ "mt-4 pt-3 border-t border-slate-700 flex justify-between sticky bottom-0 bg-slate-900 transition-opacity " +
            (isBusy ? "opacity-0 pointer-events-none" : "opacity-100") }
        >
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-danger text-[12px]"
            disabled={!hasSomethingToClear || isBusy}
          >
            Borrar todo
          </button>

          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setConfirmClearOpen(false);
                attemptClose();
              }}
              className="btn btn-cancel text-[12px]"
              disabled={isBusy}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="btn btn-create text-[12px]"
              disabled={!isDirty || isBusy}
              title={!isDirty ? "No hay cambios que guardar" : "Guardar"}
            >
              Guardar condición
            </button>
          </div>
        </div>
      </div>

      <ConfirmDangerModal
        open={confirmClearOpen}
        title="Borrar condiciones"
        description="¿Quieres eliminar todas las condiciones creadas?"
        confirmText="Sí, borrar todo"
        cancelText="Cancelar"
        onConfirm={confirmClear}
        onCancel={cancelClear}
      />

      <ConfirmExitModal
        open={confirmExitOpen}
        title="Salir"
        description="Hay cambios sin guardar. ¿Qué quieres hacer?"
        canSave={!isBusy}
        onSaveAndExit={() => {
          const ok = handleSave();
          if (!ok) return;
          setConfirmExitOpen(false);
        }}
        onDiscardAndExit={() => {
          setConfirmExitOpen(false);
          setDraft(initialDraft);
          onClose();
        }}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
}