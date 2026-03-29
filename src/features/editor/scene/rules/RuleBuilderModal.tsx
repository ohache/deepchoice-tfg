import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { buildInlineErrorMapByPath, type ZodIssue } from "@/shared/zodIssues";
import type { ID, Project } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { IdSchema } from "@/validation/genericSchemas";
import { conditionSchema } from "@/validation/rulesSchemas";
import { effectSchema } from "@/validation/rulesSchemas";
import { conditionToUiDraft, createDefaultRootCondition, pruneEmptyGroups, uiDraftToCondition, type UiDraft } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
import { ConditionGroups } from "@/features/editor/scene/rules/conditions/ConditionGroups";
import { type EffectCtx, type EffectOwner, type FactoryCtx, createProjectIndex, isEnabledEffect, type EnabledEffect } from "@/features/editor/scene/rules/effects/effectFactory";
import { EffectPanel } from "@/features/editor/scene/rules/effects/EffectPanel";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { toast } from "@/shared/toast/toastStore";

const RuleSchema = z.object({
  id: IdSchema,
  when: conditionSchema.optional(),
  effects: z.array(effectSchema).default([]),
});

type RuleDraft = {
  id: ID;
  when: Condition | null;
  effects: EnabledEffect[];
};

type Props = {
  open: boolean;
  title?: string;
  project: Project | null;
  nodeId: ID;
  owner: EffectOwner;
  value?: { id: ID; when?: Condition | null; effects?: unknown[] } | null;

  onClose: () => void;
  onSave: (rule: { id: ID; when?: Condition; effects: Effect[] }) => void;
  onApply?: (rule: { id: ID; when?: Condition; effects: Effect[] }) => void;
};

type ValidateRuleResult =
  | { ok: false }
  | {
    ok: true;
    data: {
      id: ID;
      when?: Condition;
      effects: EnabledEffect[];
    };
  };

function signatureOfRule(d: RuleDraft, condDraft: UiDraft): string {
  const cleaned = pruneEmptyGroups(condDraft);
  const minimalCond = {
    groups: (cleaned.groups ?? []).map((g) => ({
      atoms: (g.atoms ?? []).map((a) => ({ not: Boolean(a.not), cond: a.cond })),
    })),
  };

  return JSON.stringify({
    cond: minimalCond,
    effects: d.effects ?? [],
  });
}

function makeInitialDraft(value: Props["value"]): RuleDraft {
  const rawEffs = value?.effects ?? [];
  const effects = rawEffs.filter((e): e is EnabledEffect => isEnabledEffect(e as Effect));

  return {
    id: value?.id ?? ("" as ID),
    when: value?.when ?? null,
    effects,
  };
}

export function RuleBuilderModal({ open, project, nodeId, owner, value, onClose, onSave, onApply }: Props) {
  const idx = useMemo(() => createProjectIndex(project), [project]);

  const factory = useMemo<FactoryCtx>(
    () => ({
      idx,
      ctx: { project, nodeId, owner } satisfies EffectCtx,
    }),
    [idx, project, nodeId, owner]
  );

  const initialDraft = useMemo(() => makeInitialDraft(value), [value]);

  const initialCondDraft = useMemo<UiDraft>(
    () => conditionToUiDraft(initialDraft.when ?? createDefaultRootCondition()),
    [initialDraft.when]
  );

  const [draft, setDraft] = useState<RuleDraft>(initialDraft);

  const [confirmExitOpen, setConfirmExitOpen] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const [inlineErrorsByPath, setInlineErrorsByPath] = useState<Record<string, string>>({});

  const [condDraft, setCondDraft] = useState<UiDraft>(initialCondDraft);
  const [condBusy, setCondBusy] = useState(false);

  const initialSig = useMemo(() => signatureOfRule(initialDraft, initialCondDraft), [initialDraft, initialCondDraft]);
  const currentSig = useMemo(() => signatureOfRule(draft, condDraft), [draft, condDraft]);
  const isDirty = currentSig !== initialSig;

  const effectsRequired = owner.kind !== "dialogueLine";

  const hasCond = useMemo(() => {
    const cleaned = pruneEmptyGroups(condDraft);
    return cleaned.groups?.some((g) => (g.atoms?.length ?? 0) > 0) ?? false;
  }, [condDraft]);

  const hasSomethingToClear = hasCond || (draft.effects?.length ?? 0) > 0;

  useEffect(() => {
    if (!open) return;

    setDraft(initialDraft);
    setInlineErrorsByPath({});
    setConfirmExitOpen(false);
    setConfirmClearOpen(false);
    setCondDraft(initialCondDraft);
    setCondBusy(false);
  }, [open, initialDraft, initialCondDraft]);

  const attemptClose = useCallback(() => {
    if (confirmClearOpen) return;
    if (isDirty) return setConfirmExitOpen(true);
    onClose();
  }, [confirmClearOpen, isDirty, onClose]);

  const validateAndBuild = useCallback((): ValidateRuleResult => {
    if (condBusy) {
      toast.warning("Condición en edición", "Termina de editar la condición antes de guardar.");
      return { ok: false };
    }

    const cleanedCond = pruneEmptyGroups(condDraft);
    const hasCondValue = (cleanedCond.groups ?? []).some((g) => (g.atoms ?? []).some((a) => a.cond != null));

    let whenForPayload: Condition | undefined;

    if (hasCondValue) {
      const cond = uiDraftToCondition(cleanedCond);
      const parsedCond = conditionSchema.safeParse(cond);

      if (!parsedCond.success) {
        setInlineErrorsByPath((m) => ({ ...m, when: "Condición inválida. Revisa los campos." }));
        toast.error("Condición inválida", "Revisa los campos. Hay valores vacíos o no válidos.");
        return { ok: false };
      }

      whenForPayload = parsedCond.data;
    }

    const payload = {
      id: draft.id || ("rule" as ID),
      when: whenForPayload,
      effects: draft.effects ?? [],
    };

    const parsed = RuleSchema.safeParse(payload);

    if (!parsed.success) {
      const issues = parsed.error.issues as ZodIssue[];
      setInlineErrorsByPath(buildInlineErrorMapByPath(issues));
      return { ok: false };
    }

    if (effectsRequired && (parsed.data.effects?.length ?? 0) === 0) {
      setInlineErrorsByPath((m) => ({ ...m, effects: "Añade al menos un efecto." }));
      return { ok: false };
    }

    setInlineErrorsByPath({});
    return {
      ok: true,
      data: {
        id: parsed.data.id,
        when: parsed.data.when,
        effects: parsed.data.effects as EnabledEffect[],
      },
    };
  }, [condBusy, condDraft, draft.id, draft.effects, effectsRequired]);

  const handleSave = useCallback((): boolean => {
    const res = validateAndBuild();
    if (!res.ok) {
      toast.error("Regla inválida", "Revisa la condición o los efectos antes de guardar.");
      return false;
    }

    const normalized = {
      id: res.data.id,
      when: res.data.when,
      effects: res.data.effects as Effect[],
    };

    onSave(normalized);
    if (onApply) onApply(normalized);

    toast.success("Regla guardada", "La regla se ha aplicado correctamente.");
    onClose();
    return true;
  }, [validateAndBuild, onSave, onApply, onClose]);

  const handleClear = () => {
    if (!hasSomethingToClear) return;
    setConfirmClearOpen(true);
  };

  const confirmClear = () => {
    setDraft((d) => ({ ...d, when: null, effects: [] }));
    setInlineErrorsByPath({});
    setConfirmClearOpen(false);
    toast.info("Regla reiniciada", "Has limpiado la condición y los efectos.");
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-1000 flex items-center justify-center" role="dialog" aria-modal="true">
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
          <div className="rounded-lg bg-slate-950/90 p-3 h-[72vh] overflow-hidden flex flex-col">
            <div className="text-sm font-semibold text-slate-100">Condiciones</div>
            <div className="pt-2 text-[12px] text-slate-200">
              {inlineErrorsByPath["when"] ? <div className="pt-2 text-rose-300">{inlineErrorsByPath["when"]}</div> : null}
            </div>

            <div className="pt-3 flex-1 min-h-0 overflow-y-auto editor-scroll">
              <ConditionGroups project={project} currentNodeId={nodeId} value={condDraft} onChange={setCondDraft} onBusyChange={setCondBusy} />
            </div>
          </div>

          <EffectPanel
            factory={factory}
            effects={draft.effects}
            onChange={(next) => setDraft((d) => ({ ...d, effects: next }))}
            inlineErrorsByPath={inlineErrorsByPath}
            setInlineErrorsByPath={setInlineErrorsByPath}
          />
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700 flex justify-between sticky bottom-0 bg-slate-900">
          <button
            type="button"
            onClick={handleClear}
            className="btn btn-danger text-[12px]"
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
              className="btn btn-create text-[12px]"
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
        description="¿Quieres eliminar la condición y todos los efectos de esta regla?"
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
          onClose();
        }}
        onCancel={() => setConfirmExitOpen(false)}
      />
    </div>
  );
}