import { useCallback, useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import { buildInlineErrorMapByPath } from "@/shared/zodIssues";
import type { ID, Project, RulePhrase, Speaker } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { baseInteractionRuleSchema, conditionSchema } from "@/validation/rulesSchemas";
import { conditionToUiDraft, createDefaultRootCondition, pruneEmptyGroups, uiDraftToCondition, type UiDraft } from "@/features/editor/scene/rules/conditions/conditionDraftMapper";
import { ConditionGroups } from "@/features/editor/scene/rules/conditions/ConditionGroups";
import { createProjectIndex } from "@/features/editor/scene/rules/effects/effectProjectIndex";
import type { EffectCtx, EffectOwner, FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import { isEnabledEffect, type EnabledEffect } from "@/features/editor/scene/rules/effects/effectFactory";
import { EffectPanel } from "@/features/editor/scene/rules/effects/EffectPanel";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { toast } from "@/shared/toast/toastStore";
import { Select } from "@/components/Select";

type BaseRuleFromSchema = z.infer<typeof baseInteractionRuleSchema>;

type RulePayload = {
  id: ID;
  label: string;
  when?: Condition;
  phrase?: RulePhrase;
  effects: Effect[];
};

type RuleDraft = Omit<BaseRuleFromSchema, "when" | "phrase" | "effects"> & {
  when: Condition | null;
  phrase: RulePhrase;
  effects: EnabledEffect[];
};

type Props = {
  open: boolean;
  title?: string;
  project: Project | null;
  nodeId: ID;
  owner: EffectOwner;
  interactionKind?: "onClick" | "onUseItem";
  value?: { id: ID; label?: string; when?: Condition | null; phrase?: RulePhrase; effects?: unknown[] } | null;
  onClose: () => void;
  onSave: (rule: { id: ID; label: string; when?: Condition; phrase?: RulePhrase; effects: Effect[] }) => void;
};

/* Firma estable del estado de la regla */
function signatureOfRule(draft: RuleDraft, condDraft: UiDraft): string {
  const cleaned = pruneEmptyGroups(condDraft);

  const minimalCond = {
    groups: (cleaned.groups ?? []).map((group) => ({ atoms: (group.atoms ?? []).map((atom) => ({ not: Boolean(atom.not), cond: atom.cond })) })),
  };

  return JSON.stringify({ label: draft.label, cond: minimalCond, phrase: draft.phrase, effects: draft.effects ?? [] });
}

/*Normaliza el valor inicial recibido desde fuera para trabajar siempre con un draft consistente en UI */
function makeInitialDraft(value: Props["value"]): RuleDraft {
  const rawEffects = value?.effects ?? [];

  const effects = rawEffects.filter((effect): effect is EnabledEffect => isEnabledEffect(effect as Effect));

  return {
    id: value?.id ?? (crypto.randomUUID() as ID), label: normalizeRuleLabel(value?.label),
    when: value?.when ?? null, phrase: normalizePhrase(value?.phrase), effects
  };
}

function normalizeRuleLabel(label?: string | null): string {
  return (label ?? "").trim() || "Regla";
}

function normalizePhrase(phrase?: RulePhrase): RulePhrase {
  return { text: phrase?.text ?? "", speaker: phrase?.speaker ?? { kind: "narrator" } };
}

function getOwnerLayerId(owner: EffectOwner): ID | null {
  return "layerId" in owner && typeof owner.layerId === "string" ? owner.layerId : null;
}

function speakerToOptionId(factory: FactoryCtx, speaker?: Speaker): string {
  if (!speaker || speaker.kind === "narrator") return factory.idx.formatMessageSpeakerOption({ speakerKind: "narrator" });

  if (speaker.kind === "player") return factory.idx.formatMessageSpeakerOption({ speakerKind: "player", speakerId: speaker.playerId });

  return factory.idx.formatMessageSpeakerOption({ speakerKind: "npc", speakerId: speaker.npcId });
}

function speakerFromOptionId(factory: FactoryCtx, value: string): Speaker {
  const parsed = factory.idx.parseMessageSpeakerOption(value as never);

  if (parsed.speakerKind === "player") return { kind: "player", playerId: parsed.speakerId ?? "" };

  if (parsed.speakerKind === "npc") return { kind: "npc", npcId: parsed.speakerId ?? "" };

  return { kind: "narrator" };
}

const singleGoToNodeMessage = "Cada regla solo puede tener como máximo un efecto de tipo Ir a escena.";

function hasTooManyGoToNodeEffects(effects: Effect[]): boolean {
  return effects.filter((effect) => effect.type === "goToNode").length > 1;
}

export function RuleBuilderModal({ open, project, nodeId, owner, interactionKind, value, onClose, onSave }: Props) {
  const idx = useMemo(() => createProjectIndex(project), [project]);

  const factory = useMemo<FactoryCtx>(() => ({ idx, ctx: { project, nodeId, owner } satisfies EffectCtx }), [idx, project, nodeId, owner]);

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

  const ownerLayerId = useMemo(() => getOwnerLayerId(owner), [owner]);

  const phraseSpeakerOptions = useMemo(() => factory.idx.getMessageSpeakerOptions({ nodeId, layerId: ownerLayerId }), [factory.idx, nodeId, ownerLayerId]);

  const selectedPhraseSpeakerId = useMemo(() => speakerToOptionId(factory, draft.phrase.speaker), [factory, draft.phrase.speaker]);

  const hasSomethingToClear = hasCond || Boolean(draft.phrase.text.trim()) || (draft.effects?.length ?? 0) > 0;

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
    if (interactionKind === "onClick" && !hasCond && draft.phrase.text) setDraft((prev) => ({ ...prev, phrase: { text: "", speaker: { kind: "narrator" } } }));
  }, [interactionKind, hasCond, draft.phrase.text]);

  /* Actions */
  const attemptClose = useCallback(() => {
    if (confirmClearOpen) return;
    if (isDirty) {
      setConfirmExitOpen(true);
      return;
    }
    onClose();
  }, [confirmClearOpen, isDirty, onClose]);

  const validateAndBuild = useCallback((): RulePayload | null => {
    if (condBusy) {
      toast.warning("Condición en edición", "Termina de editar la condición antes de guardar.");
      return null;
    }

    const cleanedCond = pruneEmptyGroups(condDraft);

    const hasCondValue = (cleanedCond.groups ?? []).some((group) => (group.atoms ?? []).some((atom) => atom.cond != null));

    let whenForPayload: Condition | undefined;

    if (hasCondValue) {
      const cond = uiDraftToCondition(cleanedCond);
      const parsedCond = conditionSchema.safeParse(cond);

      if (!parsedCond.success) {
        setInlineErrorsByPath((prev) => ({ ...prev, when: "Condición inválida. Revisa los campos." }));

        toast.error("Condición inválida", "Revisa los campos. Hay valores vacíos o no válidos.");
        return null;
      }

      whenForPayload = parsedCond.data;
    }

    const trimmedLabel = draft.label.trim();
    const trimmedPhrase = draft.phrase.text.trim();

    const payload: RulePayload = {
      id: draft.id, label: trimmedLabel, when: whenForPayload,
      phrase: trimmedPhrase ? { text: trimmedPhrase, speaker: draft.phrase.speaker ?? { kind: "narrator" } } : undefined,
      effects: draft.effects ?? [],
    };

    if (hasTooManyGoToNodeEffects(payload.effects)) {
      setInlineErrorsByPath((prev) => ({ ...prev, effects: singleGoToNodeMessage }));
      toast.warning("Destino duplicado", singleGoToNodeMessage);

      return null;
    }

    const parsed = baseInteractionRuleSchema.safeParse(payload);

    if (!parsed.success) {
      setInlineErrorsByPath(buildInlineErrorMapByPath(parsed.error.issues));
      return null;
    }

    if (effectsRequired && (parsed.data.effects?.length ?? 0) === 0) {
      setInlineErrorsByPath((prev) => ({ ...prev, effects: "Añade al menos un efecto." }));

      return null;
    }

    setInlineErrorsByPath({});

    return {
      id: parsed.data.id, label: parsed.data.label, when: parsed.data.when as Condition | undefined,
      phrase: parsed.data.phrase as RulePhrase | undefined, effects: parsed.data.effects as Effect[]
    };
  }, [condBusy, condDraft, draft.id, draft.label, draft.phrase, draft.effects, effectsRequired]);

  const handleSave = useCallback((): boolean => {
    const result = validateAndBuild();

    if (!result) {
      toast.error("Regla inválida", "Revisa el nombre, la condición, la phrase o los efectos antes de guardar.");
      return false;
    }

    onSave(result);

    toast.success("Regla guardada", "La regla se ha aplicado correctamente.");
    onClose();

    return true;
  }, [validateAndBuild, onSave, onClose]);

  const handleClear = useCallback(() => {
    if (!hasSomethingToClear) return;
    setConfirmClearOpen(true);
  }, [hasSomethingToClear]);

  const confirmClear = useCallback(() => {
    setDraft((prev) => ({ ...prev, when: null, phrase: { text: "", speaker: { kind: "narrator" } }, effects: [] }));
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

        {!isDialogue ? (
          <div className="mx-auto rounded-lg border-2 border-slate-600 bg-slate-950/90 p-3">
            <label className="mx-auto grid max-w-[400px] grid-cols-[auto_minmax(0,1fr)] items-center gap-3">
              <span className="text-[14px] font-semibold text-slate-100">
                Nombre
              </span>

              <input
                value={draft.label}
                onChange={(event) => {
                  const value = event.currentTarget.value;

                  setDraft((prev) => ({ ...prev, label: value }));

                  if (inlineErrorsByPath["label"]) {
                    setInlineErrorsByPath((prev) => {
                      const next = { ...prev };
                      delete next.label;
                      return next;
                    });
                  }
                }}
                placeholder="Ej: Abrir puerta con llave"
                className="w-full rounded-md border-2 border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 
                  focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
              />
            </label>

            {inlineErrorsByPath["label"] ? (
              <div className="mx-auto max-w-[560px] pt-2 text-right text-[12px] text-rose-300">
                {inlineErrorsByPath["label"]}
              </div>
            ) : null}
          </div>
        ) : null}

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

                <div className="pt-2 space-y-3">
                  <textarea
                    value={draft.phrase.text}
                    onChange={(e) => {
                      const value = e.currentTarget.value;

                      setDraft((prev) => ({ ...prev, phrase: { ...prev.phrase, text: value } }));
                    }}
                    placeholder="Ej: Se necesita una llave para abrir esa puerta."
                    rows={3}
                    disabled={!phraseEnabled}
                    className="input-conditions py-2 h-[84px] resize-none overflow-y-auto editor-scroll disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  <div className="space-y-1">
                    <div className="text-[12px] text-slate-300">
                      Emisor de la frase
                    </div>

                    <Select<string>
                      value={selectedPhraseSpeakerId}
                      onChange={(value) => { setDraft((prev) => ({ ...prev, phrase: { ...prev.phrase, speaker: speakerFromOptionId(factory, value) } })) }}
                      options={phraseSpeakerOptions}
                      placeholder="Selecciona emisor"
                      disabled={!phraseEnabled}
                      className="w-full"
                      buttonClassName="border-slate-700 bg-slate-900/70 py-2"
                      menuClassName="border-slate-700"
                    />
                  </div>
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
        description="¿Está seguro de que quiere eliminar esta regla?"
        confirmText="Sí, borrar"
        cancelText="Cancelar"
        onConfirm={confirmClear}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <ConfirmExitModal
        open={confirmExitOpen}
        title="Salir"
        description="Hay cambios sin guardar en la regla. ¿Qué quieres hacer?"
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