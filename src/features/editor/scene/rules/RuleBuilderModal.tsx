import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { buildInlineErrorMapByPath } from "@/shared/zodIssues";
import type { ID, Project } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { IdSchema } from "@/validation/genericSchemas";
import { conditionSchema, effectSchema } from "@/validation/rulesSchemas";
import { conditionToUiDraft, createDefaultRootCondition, pruneEmptyGroups, uiDraftToCondition, type UiDraft } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
import { ConditionGroups } from "@/features/editor/scene/rules/conditions/ConditionGroups";
import { type EffectCtx, type EffectOwner, type FactoryCtx, createProjectIndex, isEnabledEffect, type EnabledEffect } from "@/features/editor/scene/rules/effects/effectFactory";
import { EffectPanel } from "@/features/editor/scene/rules/effects/EffectPanel";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { toast } from "@/shared/toast/toastStore";

/* Schema */
const RuleSchema = z.object({
  id: IdSchema,
  when: conditionSchema.optional(),
  phrase: z.string().trim().optional(),
  effects: z.array(effectSchema).default([]),
});

type RuleDraft = {
  id: ID;
  when: Condition | null;
  phrase: string;
  effects: EnabledEffect[];
};

type Props = {
  open: boolean;
  title?: string;
  project: Project | null;
  nodeId: ID;
  owner: EffectOwner;
  interactionKind?: "onClick" | "onUseItem";
  value?: { id: ID; when?: Condition | null; phrase?: string; effects?: unknown[] } | null;
  onClose: () => void;
  onSave: (rule: { id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => void;
  onApply?: (rule: { id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => void;
};

type ValidateRuleResult =
  | { ok: false }
  | { ok: true; data: { id: ID; when?: Condition; phrase?: string; effects: EnabledEffect[] } };

/* Firma estable del estado de la regla */
function signatureOfRule(draft: RuleDraft, condDraft: UiDraft): string {
  const cleaned = pruneEmptyGroups(condDraft);

  const minimalCond = {
    groups: (cleaned.groups ?? []).map((group) => ({
      atoms: (group.atoms ?? []).map((atom) => ({ not: Boolean(atom.not), cond: atom.cond })),
    })),
  };

  return JSON.stringify({ cond: minimalCond, phrase: draft.phrase ?? "", effects: draft.effects ?? [] });
}

/*Normaliza el valor inicial recibido desde fuera para trabajar siempre con un draft consistente en UI */
function makeInitialDraft(value: Props["value"]): RuleDraft {
  const rawEffects = value?.effects ?? [];
  const effects = rawEffects.filter((effect): effect is EnabledEffect => isEnabledEffect(effect as Effect));

  return { id: value?.id ?? "", when: value?.when ?? null, phrase: value?.phrase ?? "", effects };
}

export function RuleBuilderModal({ open, project, nodeId, owner, interactionKind, value, onClose, onSave, onApply }: Props) {
  const idx = useMemo(() => createProjectIndex(project), [project]);

  const factory = useMemo<FactoryCtx>(() => ({ idx, ctx: { project, nodeId, owner } satisfies EffectCtx}), [idx, project, nodeId, owner]);

  const initialDraft = useMemo(() => makeInitialDraft(value), [value]);

  const initialCondDraft = useMemo<UiDraft>(() => conditionToUiDraft(initialDraft.when ?? createDefaultRootCondition()), [initialDraft.when]);

  const [draft, setDraft] = useState<RuleDraft>(initialDraft);
  const [condDraft, setCondDraft] = useState<UiDraft>(initialCondDraft);

  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const [inlineErrorsByPath, setInlineErrorsByPath] = useState<Record<string, string>>({});
  const [condBusy, setCondBusy] = useState(false);

  const initialSig = useMemo(() => signatureOfRule(initialDraft, initialCondDraft), [initialDraft, initialCondDraft]);

  const currentSig = useMemo(() => signatureOfRule(draft, condDraft), [draft, condDraft]);

  const isDirty = currentSig !== initialSig;

  const isDialogue = owner.kind === "dialogueLine";
  const effectsRequired = !isDialogue;

  const hasCond = useMemo(() => {
    const cleaned = pruneEmptyGroups(condDraft);
    return cleaned.groups?.some((group) => (group.atoms?.length ?? 0) > 0) ?? false;
  }, [condDraft]);

  const phraseEnabled = interactionKind === "onUseItem" || hasCond;

  const hasSomethingToClear = hasCond || Boolean(draft.phrase.trim()) || (draft.effects?.length ?? 0) > 0;

  /* Sincronizar al abrir */
  useEffect(() => {
    if (!open) return;

    setDraft(initialDraft);
    setCondDraft(initialCondDraft);
    setInlineErrorsByPath({});
    setConfirmExitOpen(false);
    setConfirmClearOpen(false);
    setCondBusy(false);
  }, [open, initialDraft, initialCondDraft]);

  /*En onClick, la phrase solo tiene sentido si hay condición */
  useEffect(() => {
    if (interactionKind === "onClick" && !hasCond && draft.phrase) setDraft((prev) => ({ ...prev, phrase: "" }));
  }, [interactionKind, hasCond, draft.phrase]);

  /* Actions */
  const attemptClose = useCallback(() => {
    if (confirmClearOpen) return;
    if (isDirty) {
      setConfirmExitOpen(true);
      return;
    }
    onClose();
  }, [confirmClearOpen, isDirty, onClose]);

  const validateAndBuild = useCallback((): ValidateRuleResult => {
    if (condBusy) {
      toast.warning("Condición en edición", "Termina de editar la condición antes de guardar.");
      return { ok: false };
    }

    const cleanedCond = pruneEmptyGroups(condDraft);
    const hasCondValue = (cleanedCond.groups ?? []).some((group) => (group.atoms ?? []).some((atom) => atom.cond != null));

    let whenForPayload: Condition | undefined;

    if (hasCondValue) {
      const cond = uiDraftToCondition(cleanedCond);
      const parsedCond = conditionSchema.safeParse(cond);

      if (!parsedCond.success) {
        setInlineErrorsByPath((prev) => ({
          ...prev,
          when: "Condición inválida. Revisa los campos.",
        }));
        toast.error("Condición inválida", "Revisa los campos. Hay valores vacíos o no válidos.");
        return { ok: false };
      }

      whenForPayload = parsedCond.data;
    }

    const trimmedPhrase = draft.phrase.trim();

    const payload = {
      id: draft.id || ("rule" as ID),
      when: whenForPayload,
      phrase: trimmedPhrase || undefined,
      effects: draft.effects ?? [],
    };

    const parsed = RuleSchema.safeParse(payload);

    if (!parsed.success) {
      setInlineErrorsByPath(buildInlineErrorMapByPath(parsed.error.issues));
      return { ok: false };
    }

    if (effectsRequired && (parsed.data.effects?.length ?? 0) === 0) {
      setInlineErrorsByPath((prev) => ({
        ...prev,
        effects: "Añade al menos un efecto.",
      }));
      return { ok: false };
    }

    setInlineErrorsByPath({});
    return {
      ok: true,
      data: {
        id: parsed.data.id,
        when: parsed.data.when,
        phrase: parsed.data.phrase,
        effects: parsed.data.effects as EnabledEffect[],
      },
    };
  }, [condBusy, condDraft, draft.id, draft.phrase, draft.effects, effectsRequired]);

  const handleSave = useCallback((): boolean => {
    const result = validateAndBuild();

    if (!result.ok) {
      toast.error("Regla inválida", "Revisa la condición, la phrase o los efectos antes de guardar.");
      return false;
    }

    const normalized = {
      id: result.data.id,
      when: result.data.when,
      phrase: result.data.phrase,
      effects: result.data.effects as Effect[],
    };

    onSave(normalized);
    if (onApply) onApply(normalized);

    toast.success("Regla guardada", "La regla se ha aplicado correctamente.");
    onClose();
    return true;
  }, [validateAndBuild, onSave, onApply, onClose]);

  const handleClear = useCallback(() => {
    if (!hasSomethingToClear) return;
    setConfirmClearOpen(true);
  }, [hasSomethingToClear]);

  const confirmClear = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      when: null,
      phrase: "",
      effects: [],
    }));
    setCondDraft(conditionToUiDraft(createDefaultRootCondition()));
    setInlineErrorsByPath({});
    setConfirmClearOpen(false);

    toast.info("Regla reiniciada", "Has limpiado la condición, la phrase y los efectos.");
  }, []);

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

      <div className="relative w-[98%] max-w-[1360px] rounded-xl border-2 border-slate-600 bg-slate-900 p-5 shadow-xl">
        <div className="pt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-lg border-2 border-slate-600 bg-slate-950/90 p-3 h-[72vh] overflow-hidden flex flex-col">
            <div className="text-[16px] font-semibold text-slate-100">Condiciones</div>

            <div className="pt-2 text-[12px] text-slate-200">
              {inlineErrorsByPath["when"] ? (
                <div className="pt-2 text-rose-300">{inlineErrorsByPath["when"]}</div>
              ) : null}
            </div>

            <div className="pt-3 flex-1 min-h-0 overflow-y-auto editor-scroll">
              <ConditionGroups
                project={project}
                currentNodeId={nodeId}
                value={condDraft}
                onChange={setCondDraft}
                onBusyChange={setCondBusy}
              />
            </div>

            {!isDialogue ? (
              <div className="pt-2 border-t-2 border-t-slate-700">
                <div className="pt-2 text-[12px] text-slate-300 mb-2">
                  Mensaje que se mostrará cuando no se cumplan las condiciones de esta regla
                </div>

                <div className="pt-2">
                  <textarea
                    value={draft.phrase}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setDraft((prev) => ({ ...prev, phrase: value }));
                    }}
                    placeholder="Ej: Se necesita una llave para abrir esa puerta."
                    rows={3}
                    disabled={!phraseEnabled}
                    className="input-conditions py-2 h-[84px] resize-none overflow-y-auto editor-scroll disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {inlineErrorsByPath["phrase"] ? (
                  <div className="pt-2 text-[12px] text-rose-300">
                    {inlineErrorsByPath["phrase"]}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <EffectPanel
            factory={factory}
            effects={draft.effects}
            onChange={(next) => setDraft((prev) => ({ ...prev, effects: next }))}
            inlineErrorsByPath={inlineErrorsByPath}
            setInlineErrorsByPath={setInlineErrorsByPath}
          />
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-danger bg-red-950 hover:bg-red-800 text-[12px]"
            disabled={!hasSomethingToClear}
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
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="btn btn-add-rule text-[12px]"
              disabled={!isDirty}
              title={!isDirty ? "No hay cambios que guardar" : "Guardar"}
            >
              Guardar regla
            </button>
          </div>
        </div>
      </div>

      <ConfirmDangerModal
        open={confirmClearOpen}
        title="Borrar regla"
        description="¿Quieres eliminar la condición, la phrase y todos los efectos de esta regla?"
        confirmText="Sí, borrar todo"
        cancelText="Cancelar"
        onConfirm={confirmClear}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <ConfirmExitModal
        open={confirmExitOpen}
        title="Salir"
        description="Hay cambios sin guardar. ¿Qué quieres hacer?"
        canSave={true}
        onSaveAndExit={() => {
          const ok = handleSave();
          if (!ok) return;
          setConfirmExitOpen(false);
        }}
        onDiscardAndExit={() => {
          setConfirmExitOpen(false);
          setDraft(initialDraft);
          setCondDraft(initialCondDraft);
          onClose();
        }}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
}