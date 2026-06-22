import { useCallback, useEffect, useMemo, useState } from "react";
import { buildInlineErrorMapByPath } from "@/shared/zodIssues";
import { effectSchema } from "@/validation/rulesSchemas";
import type { FactoryCtx } from "@/features/editor/scene/rules/effects/effectShared";
import {
  createDefaultEffect, effectFamilyOf, effectLabel, summarizeEffect, type EffectFamilyId,
  type EnabledEffect, type EnabledEffectType
} from "@/features/editor/scene/rules/effects/effectFactory";
import { getAvailableEffectFamilies } from "@/features/editor/scene/rules/effects/effectFamilies";
import { EffectLeafEditor } from "@/features/editor/scene/rules/effects/EffectLeafEditor";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";
import { Select, type Option } from "@/components/Select";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "@/shared/toast/toastStore";

type Props = {
  factory: FactoryCtx;
  effects: EnabledEffect[];
  onChange: (next: EnabledEffect[]) => void;
  inlineErrorsByPath: Record<string, string>;
  setInlineErrorsByPath: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
};

type CreateEditorState = {
  mode: "create";
  family: EffectFamilyId | "";
  draft: EnabledEffect | null;
  showErrors: boolean;
};

type EditEditorState = {
  mode: "edit";
  index: number;
  family: EffectFamilyId;
  draft: EnabledEffect | null;
  showErrors: boolean;
};

type ActiveEditorState = CreateEditorState | EditEditorState | null;

type ValidationResult = { ok: true; data: EnabledEffect } | { ok: false };

/* Helpers */
function buildPrefixedErrors(prefix: string, issues: readonly { path?: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const base = buildInlineErrorMapByPath(issues);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(base)) out[`${prefix}.${key}`] = value;

  return out;
}

function removePrefixedErrors(map: Record<string, string>, prefix: string): Record<string, string> {
  const next: Record<string, string> = {};

  for (const [key, value] of Object.entries(map)) {
    if (!key.startsWith(`${prefix}.`) && key !== prefix) next[key] = value;
  }

  return next;
}

function replacePrefixedErrors(map: Record<string, string>, prefix: string, errors: Record<string, string>): Record<string, string> {
  return { ...removePrefixedErrors(map, prefix), ...errors };
}

function isItemCreationEffect(effect: EnabledEffect): effect is Extract<EnabledEffect, { type: "combineItems" | "transformItem" }> {
  return effect.type === "combineItems" || effect.type === "transformItem";
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function validateEffectWithContext(factory: FactoryCtx, draft: EnabledEffect, errorPrefix: string, siblingEffects: EnabledEffect[], editingIndex?: number): Record<string, string> {
  const project = factory.ctx.project;
  if (!project) return {};
  if (!isItemCreationEffect(draft)) return {};

  const label = draft.resultItemLabel?.trim() ?? "";

  if (!label) return { [`${errorPrefix}.resultItemLabel`]: "El nombre del nuevo item no puede estar vacío." };

  if (hasDuplicatedItemInstanceLabel(project, label, draft.resultItemInstanceId)) {
    return { [`${errorPrefix}.resultItemLabel`]: "Ya existe un item instanciado con ese nombre." };
  }

  const normalized = normalizeLabel(label);

  const duplicatedInCurrentDraft = siblingEffects.some((effect, index) => {
    if (editingIndex !== undefined && index === editingIndex) return false;
    if (!isItemCreationEffect(effect)) return false;
    if (effect.resultItemInstanceId === draft.resultItemInstanceId) return false;

    return normalizeLabel(effect.resultItemLabel ?? "") === normalized;
  });

  if (duplicatedInCurrentDraft) return { [`${errorPrefix}.resultItemLabel`]: "Ya existe otro efecto que crea un item con ese nombre." };

  return {};
}

function shouldWarnAboutVariableBounds(effect: EnabledEffect): boolean {
  return (effect.type === "setPlayerVar" || effect.type === "incPlayerVar" || effect.type === "decPlayerVar" || effect.type === "setNpcVar" ||
    effect.type === "incNpcVar" || effect.type === "decNpcVar" || effect.type === "setHotspotVar" || effect.type === "incHotspotVar" || effect.type === "decHotspotVar");
}

function showVariableBoundsToastIfNeeded(effect: EnabledEffect): void {
  if (!shouldWarnAboutVariableBounds(effect)) return;

  toast.info("Valores limitados", "Durante la partida, el juego respetará el mínimo y el máximo permitidos para esa variable.");
}

function getEffectPanelScopeKey(factory: FactoryCtx): string {
  const owner = factory.ctx.owner;
  const base = `${factory.ctx.nodeId}::${owner.kind}`;

  switch (owner.kind) {
    case "hotspot":
      return `${base}::${owner.layerId}::${owner.hotspotId}`;

    case "placedItem":
      return `${base}::${owner.layerId}::${owner.itemInstanceId}`;

    case "placedNpc":
      return `${base}::${owner.layerId}::${owner.npcId}`;

    case "dialogueLine":
      return `${base}::${owner.dialogueId}::${owner.lineId}`;

    case "playerInventoryItem":
      return `${base}::${owner.playerId}::${owner.itemInstance.itemInstanceId}`;

    case "npcInventoryItem":
      return `${base}::${owner.npcId}::${owner.itemInstance.itemInstanceId}`;
  }
}

function copyCommonFields(prev: EnabledEffect, next: EnabledEffect, fields: string[]): EnabledEffect {
  const out: Record<string, unknown> = { ...next };
  const prevRecord = prev as unknown as Record<string, unknown>;

  for (const field of fields) {
    if (field in prev && field in next) out[field] = prevRecord[field];
  }

  return out as EnabledEffect;
}

function getPrimaryItemInstanceId(effect: EnabledEffect): string {
  if (effect.type === "combineItems") return effect.itemAInstanceId;
  if ("itemInstanceId" in effect) return effect.itemInstanceId;
  return "";
}

function carryOverItemFields(prev: EnabledEffect, next: EnabledEffect): EnabledEffect {
  const primaryItemInstanceId = getPrimaryItemInstanceId(prev);
  const out: Record<string, unknown> = { ...next };

  if ("playerId" in prev && "playerId" in next) out.playerId = prev.playerId;

  if ("itemInstanceId" in next) out.itemInstanceId = primaryItemInstanceId;

  if (next.type === "combineItems") {
    out.itemAInstanceId = primaryItemInstanceId;

    if (prev.type === "combineItems") out.itemBInstanceId = prev.itemBInstanceId;
  }

  if (isItemCreationEffect(prev) && isItemCreationEffect(next)) {
    out.resultItemId = prev.resultItemId;
    out.resultItemInstanceId = prev.resultItemInstanceId;
    out.resultItemLabel = prev.resultItemLabel;
  }

  return out as EnabledEffect;
}

/* Mantiene la selección principal al cambiar de tipo dentro de una misma familia. */
function carryOverCommonFields(prev: EnabledEffect | null, next: EnabledEffect): EnabledEffect {
  if (!prev) return next;

  switch (next.type) {
    case "showMessage":
      return prev.type === "showMessage" ? copyCommonFields(prev, next, ["text", "speaker"]) : next;

    case "addItem":
    case "removeItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
    case "transformItem":
    case "combineItems": {
      const prevIsItemEffect = prev.type === "addItem" || prev.type === "removeItem" || prev.type === "setPlacedItemVisible" ||
        prev.type === "setPlacedItemReachable" || prev.type === "transformItem" || prev.type === "combineItems";

      return prevIsItemEffect ? carryOverItemFields(prev, next) : next;
    }

    case "setHotspotVisible":
    case "setHotspotReachable":
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return prev.type === "setHotspotVisible" || prev.type === "setHotspotReachable" || prev.type === "setHotspotVar" || prev.type === "toggleHotspotVar" ||
        prev.type === "incHotspotVar" || prev.type === "decHotspotVar" ? copyCommonFields(prev, next, ["hotspotId", "varId"]) : next;

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable":
    case "giveItemToNpc":
    case "receiveItemFromNpc":
    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return prev.type === "setPlacedNpcVisible" || prev.type === "setPlacedNpcReachable" || prev.type === "giveItemToNpc" || prev.type === "receiveItemFromNpc" ||
        prev.type === "setNpcVar" || prev.type === "toggleNpcVar" || prev.type === "incNpcVar" || prev.type === "decNpcVar"
        ? copyCommonFields(prev, next, ["npcId", "nodeId", "layerId", "varId", "itemInstanceId"]) : next;

    case "setPlacedPlayerVisible":
    case "setPlacedPlayerImage":
    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return prev.type === "setPlacedPlayerVisible" || prev.type === "setPlacedPlayerImage" || prev.type === "setPlayerVar" || prev.type === "togglePlayerVar" ||
        prev.type === "incPlayerVar" || prev.type === "decPlayerVar"
        ? copyCommonFields(prev, next, ["playerId", "nodeId", "layerId", "varId", "imageId"]) : next;

    case "playSfx":
      return prev.type === "playSfx" ? copyCommonFields(prev, next, ["sfxId"]) : next;

    case "playMusic":
      return prev.type === "playMusic" || prev.type === "stopMusic" ? copyCommonFields(prev, next, ["trackId", "startAt"]) : next;

    case "stopMusic":
      return prev.type === "playMusic" || prev.type === "stopMusic" ? copyCommonFields(prev, next, ["trackId"]) : next;

    case "startDialogue":
      return prev.type === "startDialogue" ? copyCommonFields(prev, next, ["nodeDialogueId"]) : next;

    case "setMapRegionAvailable":
      return prev.type === "setMapRegionAvailable" ? copyCommonFields(prev, next, ["mapId", "regionId", "value"]) : next;

    case "endGame":
      return prev.type === "endGame" ? copyCommonFields(prev, next, ["ending"]) : next;

    case "goToNode":
    case "endDialogue":
      return next;
  }
}

function getPreferredTypeForFamily(family: EffectFamilyId, availableTypes: EnabledEffectType[]): EnabledEffectType | undefined {
  const preferredByFamily: Partial<Record<EffectFamilyId, EnabledEffectType>> =
    { message: "showMessage", hotspot: "setHotspotVisible", item: "addItem", npc: "setPlacedNpcVisible", player: "setPlacedPlayerVisible", audio: "playSfx", ending: "endGame" };

  if (family === "dialogue") {
    if (availableTypes.includes("startDialogue")) return "startDialogue";
    if (availableTypes.includes("endDialogue")) return "endDialogue";
    return undefined;
  }

  const preferred = preferredByFamily[family];
  return preferred && availableTypes.includes(preferred) ? preferred : availableTypes[0];
}

function shouldWaitForTypeSelection(family: EffectFamilyId, typeCount: number): boolean {
  return (family === "progress" || family === "item") && typeCount > 1;
}

function makeInitialDraftForFamily(factory: FactoryCtx, family: EffectFamilyId, availableTypes: EnabledEffectType[]): EnabledEffect | null {
  if (shouldWaitForTypeSelection(family, availableTypes.length)) return null;

  const preferredType = getPreferredTypeForFamily(family, availableTypes);
  return preferredType ? createDefaultEffect(factory, preferredType) : null;
}

export function EffectPanel({ factory, effects, onChange, inlineErrorsByPath, setInlineErrorsByPath }: Props) {
  const [activeEditor, setActiveEditor] = useState<ActiveEditorState>(null);

  const editorScopeKey = getEffectPanelScopeKey(factory);

  useEffect(() => setActiveEditor(null), [editorScopeKey]);

  const availableFamilies = useMemo(() => getAvailableEffectFamilies(factory), [factory]);

  const familyOptions = useMemo<Option<EffectFamilyId>[]>(() => availableFamilies.map((family) => ({ id: family.id, label: family.label })), [availableFamilies]);

  const clearNewEffectErrors = useCallback(() => {
    setInlineErrorsByPath((map) => removePrefixedErrors(map, "newEffect"));
  }, [setInlineErrorsByPath]);

  const clearAllEffectErrors = useCallback(() => {
    setInlineErrorsByPath((map) => removePrefixedErrors(map, "effects"));
  }, [setInlineErrorsByPath]);

  const clearEffectErrorsForIndex = useCallback(
    (index: number) => {
      setInlineErrorsByPath((map) => removePrefixedErrors(map, `effects.${index}`));
    }, [setInlineErrorsByPath],
  );

  const clearEditorErrors = useCallback(
    (editor: ActiveEditorState) => {
      if (!editor) return;
      if (editor.mode === "create") clearNewEffectErrors();
      if (editor.mode === "edit") clearEffectErrorsForIndex(editor.index);
    }, [clearNewEffectErrors, clearEffectErrorsForIndex],
  );

  const clearActiveEditorErrors = useCallback(() => {
    clearEditorErrors(activeEditor);
  }, [activeEditor, clearEditorErrors]);

  const openCreateEffect = useCallback(() => {
    clearActiveEditorErrors();

    setActiveEditor({ mode: "create", family: "", draft: null, showErrors: false });
  }, [clearActiveEditorErrors]);

  const openEditEffect = useCallback(
    (index: number) => {
      const effect = effects[index];
      if (!effect) return;

      clearNewEffectErrors();

      setActiveEditor({ mode: "edit", index, family: effectFamilyOf(effect.type), draft: effect, showErrors: false });
    }, [effects, clearNewEffectErrors],
  );

  const closeEditor = useCallback(() => {
    clearActiveEditorErrors();
    setActiveEditor(null);
  }, [clearActiveEditorErrors]);

  const setEffectAt = useCallback(
    (index: number, effect: EnabledEffect) => {
      const next = [...effects];
      next[index] = effect;
      onChange(next);
    }, [effects, onChange],
  );

  const removeEffectAt = useCallback(
    (index: number) => {
      const next = [...effects];
      next.splice(index, 1);
      onChange(next);

      clearAllEffectErrors();

      if (activeEditor?.mode === "edit" && activeEditor.index === index) setActiveEditor(null);
    }, [effects, onChange, clearAllEffectErrors, activeEditor],
  );

  const validateEffectDraft = useCallback((draft: EnabledEffect, errorPrefix: string, editingIndex?: number): ValidationResult => {
    const parsed = effectSchema.safeParse(draft);

    if (!parsed.success) {
      const errors = buildPrefixedErrors(errorPrefix, parsed.error.issues);

      setInlineErrorsByPath((map) => replacePrefixedErrors(map, errorPrefix, errors));

      return { ok: false };
    }

    const parsedEffect = parsed.data as EnabledEffect;
    const contextErrors = validateEffectWithContext(factory, parsedEffect, errorPrefix, effects, editingIndex);

    if (Object.keys(contextErrors).length > 0) {
      setInlineErrorsByPath((map) => replacePrefixedErrors(map, errorPrefix, contextErrors));

      return { ok: false };
    }

    setInlineErrorsByPath((map) => removePrefixedErrors(map, errorPrefix));

    return { ok: true, data: parsedEffect };
  }, [factory, effects, setInlineErrorsByPath],
  );

  const handleCreate = useCallback(() => {
    if (!activeEditor || activeEditor.mode !== "create" || !activeEditor.draft) return;

    const result = validateEffectDraft(activeEditor.draft, "newEffect");

    if (!result.ok) {
      setActiveEditor((prev) => (prev ? { ...prev, showErrors: true } : prev));
      return;
    }

    clearNewEffectErrors();
    onChange([...(effects ?? []), result.data]);
    setActiveEditor(null);

    showVariableBoundsToastIfNeeded(result.data);
  }, [activeEditor, validateEffectDraft, clearNewEffectErrors, onChange, effects]);

  const handleSaveEdit = useCallback(() => {
    if (!activeEditor || activeEditor.mode !== "edit" || !activeEditor.draft)
      return;

    const result = validateEffectDraft(activeEditor.draft, `effects.${activeEditor.index}`, activeEditor.index);

    if (!result.ok) {
      setActiveEditor((prev) => (prev ? { ...prev, showErrors: true } : prev));
      return;
    }

    clearEffectErrorsForIndex(activeEditor.index);
    setEffectAt(activeEditor.index, result.data);
    setActiveEditor(null);

    showVariableBoundsToastIfNeeded(result.data);
  }, [activeEditor, validateEffectDraft, clearEffectErrorsForIndex, setEffectAt]);

  const handleChangeEditorFamily = useCallback((family: EffectFamilyId | "") => {
    clearActiveEditorErrors();

    if (!family) {
      setActiveEditor((prev): ActiveEditorState => {
        if (!prev) return prev;

        if (prev.mode === "edit") return prev;

        return { ...prev, family: "", draft: null, showErrors: false};
      });

      return;
    }

    const familySpec = availableFamilies.find((item) => item.id === family);
    const firstDraft = makeInitialDraftForFamily(factory, family, familySpec?.effectTypes ?? []);

    setActiveEditor((prev) => {
      if (!prev) return prev;

      return { ...prev, family, draft: firstDraft, showErrors: false } as ActiveEditorState;
    });
  }, [availableFamilies, clearActiveEditorErrors, factory],
  );

  const handleChangeEditorType = useCallback(
    (picked: EnabledEffectType) => {
      clearActiveEditorErrors();

      setActiveEditor((prev) => {
        if (!prev) return prev;

        const nextBase = createDefaultEffect(factory, picked);
        const next = carryOverCommonFields(prev.draft, nextBase);
        const family = effectFamilyOf(picked);

        return { ...prev, family, draft: next, showErrors: false } as ActiveEditorState;
      });
    }, [clearActiveEditorErrors, factory],
  );

  const handleChangeEditorDraft = useCallback((next: EnabledEffect) => {
    setActiveEditor((prev) => (prev ? { ...prev, draft: next } : prev));
  }, []);

  const editorErrorPrefix = activeEditor?.mode === "create" ? "newEffect" : activeEditor?.mode === "edit" ? `effects.${activeEditor.index}` : "";

  const editorEffect = activeEditor?.draft ?? null;
  const editorFamily = activeEditor?.family ?? "";
  const editorHasDraft = Boolean(editorEffect);

  const editorTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!editorFamily) return [];

    const family = availableFamilies.find((item) => item.id === editorFamily);
    if (!family) return [];

    return family.effectTypes.map((type) => ({ id: type, label: effectLabel(type) }));
  }, [availableFamilies, editorFamily]);

  return (
    <div className="rounded-lg border-2 border-slate-600 bg-slate-950/90 p-3 h-[72vh] overflow-y-auto editor-scroll">
      <div className="text-[16px] font-semibold text-slate-100 pb-3">
        Efectos
      </div>

      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b-2 border-slate-800 py-2 flex justify-center mt-2">
        {!activeEditor ? (
          <button
            type="button"
            className="btn btn-add-condition"
            onClick={openCreateEffect}
            title="Añadir efecto"
          >
            + Añadir efecto
          </button>
        ) : null}
      </div>

      <div className="pt-3">
        {activeEditor ? (
          <div className="mt-3 bg-slate-950/35 p-3">
            <div className="h-full overflow-y-auto editor-scroll p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-12 ml-1.5 min-w-62">
                  <Select<EffectFamilyId | "">
                    value={editorFamily}
                    placeholder="Selecciona la familia del efecto"
                    onChange={handleChangeEditorFamily}
                    options={familyOptions}
                  />
                </div>
              </div>

              {editorFamily ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-12 ml-1.5">
                    <div className="bg-slate-950/25 p-2">
                      <div onClick={(event) => event.stopPropagation()}>
                        <EffectLeafEditor
                          factory={factory}
                          eff={editorEffect}
                          selectedFamily={editorFamily}
                          familyTypeOptions={editorTypeOptions}
                          onChangeType={handleChangeEditorType}
                          onChange={handleChangeEditorDraft}
                          errorsByPath={activeEditor.mode === "create" && !activeEditor.showErrors ? {} : inlineErrorsByPath}
                          errorPrefix={editorErrorPrefix}
                          showLocalErrors={activeEditor.showErrors}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center mt-3">
              <div className="md:col-span-12 ml-1.5 flex items-center justify-between">
                <div className="flex items-center">
                  <button
                    type="button"
                    className={"btn btn-danger-condition " +
                      (activeEditor.mode !== "edit" ? "opacity-40" : "")}
                    onClick={() => {
                      if (activeEditor.mode !== "edit") return;
                      removeEffectAt(activeEditor.index);
                    }}
                    disabled={activeEditor.mode !== "edit"}
                    title={activeEditor.mode === "edit" ? "Eliminar efecto" : "Solo disponible al editar un efecto existente"}
                  >
                    Eliminar
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-close-condition"
                    onClick={closeEditor}
                  >
                    Cerrar
                  </button>

                  {activeEditor.mode === "create" ? (
                    <button
                      type="button"
                      className={"btn btn-create-condition " +
                        (!editorHasDraft ? "opacity-40" : "")}
                      onClick={handleCreate}
                      disabled={!editorHasDraft}
                      title={!editorHasDraft ? "Selecciona una opción de efecto" : "Crear efecto"}
                    >
                      Crear efecto
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={"btn btn-create-condition " +
                        (!editorHasDraft ? "opacity-40" : "")}
                      onClick={handleSaveEdit}
                      disabled={!editorHasDraft}
                      title={!editorHasDraft ? "No hay cambios que guardar" : "Guardar"}
                    >
                      Guardar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!activeEditor ? (
          <div className="space-y-3 mt-6">
            {(effects ?? []).map((effect, index) => (
              <div
                key={`${effect.type}-${index}`}
                className="rounded-lg border-2 border-slate-700 bg-slate-900/40 p-2 cursor-pointer hover:bg-fuchsia-950/30 hover:border-fuchsia-900"
                onClick={() => openEditEffect(index)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ")
                    openEditEffect(index);
                }}
                title="Click para editar"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-50 mt-1 ml-2">
                      {effectLabel(effect.type)}:
                      <span className="font-normal text-slate-300">
                        {" "}
                        {summarizeEffect(factory, effect)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-close-condition bg-slate-950 hover:bg-slate-800 text-[12px] px-2"
                      onClick={() => openEditEffect(index)}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger-condition text-[12px] px-2"
                      onClick={() => removeEffectAt(index)}
                      title="Eliminar"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {inlineErrorsByPath.effects ? (
          <div className="pt-2 text-[12px] text-rose-300">
            {inlineErrorsByPath.effects}
          </div>
        ) : null}
      </div>
    </div>
  );
}
