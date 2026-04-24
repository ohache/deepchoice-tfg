import { useEffect, useMemo, useState, useCallback } from "react";
import { buildInlineErrorMapByPath } from "@/shared/zodIssues";
import { effectSchema } from "@/validation/rulesSchemas";
import { type FactoryCtx, effectFamilyOf, effectLabel, createDefaultEffect, summarizeEffect,
  type EnabledEffect, type EnabledEffectType } from "@/features/editor/scene/rules/effects/effectFactory";
import { getAvailableEffectFamilies, type EffectFamilyId } from "@/features/editor/scene/rules/effects/effectFamilies";
import { EffectLeafEditor } from "@/features/editor/scene/rules/effects/EffectLeafEditor";
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

type ActiveEditorState =
  | {
      mode: "create";
      family: EffectFamilyId | "";
      draft: EnabledEffect | null;
      showErrors: boolean;
      typeTouched: boolean;
    }
  | {
      mode: "edit";
      index: number;
      family: EffectFamilyId;
      draft: EnabledEffect | null;
      showErrors: boolean;
      typeTouched: boolean;
    }
  | null;

/* Helpers */
function buildPrefixedErrors(prefix: string, issues: readonly { path?: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const base = buildInlineErrorMapByPath(issues);
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(base)) {
    out[`${prefix}.${key}`] = value;
  }

  return out;
}

function removePrefixedErrors(map: Record<string, string>, prefix: string): Record<string, string> {
  const next: Record<string, string> = {};

  for (const [key, value] of Object.entries(map)) {
    if (!key.startsWith(prefix + ".") && key !== prefix) next[key] = value;
  }

  return next;
}

/* Mantiene la selección principal al cambiar de tipo dentro de una misma familia o de familias cercanas */
function carryOverCommonFields(prev: EnabledEffect | null, next: EnabledEffect): EnabledEffect {
  if (!prev) return next;

  switch (next.type) {
    case "addItem":
    case "removeItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      if (prev.type === "addItem" || prev.type === "removeItem" || prev.type === "setPlacedItemVisible" || prev.type === "setPlacedItemReachable") {
        return { ...next, placedItemId: prev.placedItemId } as EnabledEffect;
      }
      return next;

    case "setHotspotVisible":
    case "setHotspotReachable":
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      if (prev.type === "setHotspotVisible" || prev.type === "setHotspotReachable" || prev.type === "setHotspotVar" || prev.type === "toggleHotspotVar" ||
        prev.type === "incHotspotVar" || prev.type === "decHotspotVar") {
        return {
          ...next,
          hotspotId: prev.hotspotId,
          ...("varId" in next && "varId" in prev ? { varId: prev.varId } : {}),
        } as EnabledEffect;
      }
      return next;

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable":
    case "giveItemToNpc":
    case "receiveItemFromNpc":
    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      if (prev.type === "setPlacedNpcVisible" || prev.type === "setPlacedNpcReachable" || prev.type === "giveItemToNpc" || prev.type === "receiveItemFromNpc" ||
        prev.type === "setNpcVar" || prev.type === "toggleNpcVar" || prev.type === "incNpcVar" || prev.type === "decNpcVar") {
        return {
          ...next,
          npcId: prev.npcId,
          ...("varId" in next && "varId" in prev ? { varId: prev.varId } : {}),
          ...( "placedItemId" in next && "placedItemId" in prev ? { placedItemId: prev.placedItemId } : {}),
        } as EnabledEffect;
      }
      return next;

    case "setPlacedPlayerVisible":
    case "setPlacedPlayerImage":
    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      if (prev.type === "setPlacedPlayerVisible" || prev.type === "setPlacedPlayerImage" || prev.type === "setPlayerVar" || prev.type === "togglePlayerVar" ||
        prev.type === "incPlayerVar" || prev.type === "decPlayerVar") {
        return {
          ...next,
          playerId: prev.playerId,
          ...("varId" in next && "varId" in prev ? { varId: prev.varId } : {}),
          ...("imageId" in next && "imageId" in prev ? { imageId: prev.imageId } : {}),
        } as EnabledEffect;
      }
      return next;

    case "goToNode":
    case "setMapRegionAvailable":
      if (prev.type === "setMapRegionAvailable" && next.type === "setMapRegionAvailable") return { ...next, mapId: prev.mapId, regionId: prev.regionId } as EnabledEffect;
      
      return next;

    default:
      return next;
  }
}

function getPreferredTypeForFamily(family: EffectFamilyId, availableTypes: EnabledEffectType[]): EnabledEffectType | undefined {
  const preferredByFamily: Partial<Record<EffectFamilyId, EnabledEffectType>> = {
    message: "showMessage",
    item: "addItem",
    hotspot: "setHotspotVisible",
    npc: "setPlacedNpcVisible",
    player: "setPlacedPlayerVisible",
    audio: "playSfx",
    ending: "endGame",
  };

  if (family === "dialogue") {
    if (availableTypes.includes("startDialogue")) return "startDialogue";
    if (availableTypes.includes("endDialogue")) return "endDialogue";
    return undefined;
  }

  const preferred = preferredByFamily[family];
  return preferred && availableTypes.includes(preferred) ? preferred : availableTypes[0];
}

export function EffectPanel({ factory, effects, onChange, inlineErrorsByPath, setInlineErrorsByPath }: Props) {
  const availableFamilies = useMemo(() => getAvailableEffectFamilies(factory), [factory]);

  const familyOptions = useMemo<Option<EffectFamilyId>[]>(() =>
      availableFamilies.map((family) => ({ id: family.id, label: family.label })), [availableFamilies]
  );

  const [activeEditor, setActiveEditor] = useState<ActiveEditorState>(null);

  useEffect(() => { setActiveEditor(null) }, [factory]);

  /* Error helpers */
  const clearNewEffectErrors = useCallback(() => {
    setInlineErrorsByPath((map) => removePrefixedErrors(map, "newEffect"));
  }, [setInlineErrorsByPath]);

  const clearEffectErrorsForIndex = useCallback((index: number) => {
      setInlineErrorsByPath((map) => removePrefixedErrors(map, `effects.${index}`));
    }, [setInlineErrorsByPath]
  );

  const clearActiveEditorErrors = useCallback(() => {
    if (!activeEditor) return;

    if (activeEditor.mode === "create") clearNewEffectErrors();
    if (activeEditor.mode === "edit") clearEffectErrorsForIndex(activeEditor.index);
  }, [activeEditor, clearNewEffectErrors, clearEffectErrorsForIndex]);

  /* Editor open / close */
  const openCreateEffect = useCallback(() => {
    clearActiveEditorErrors();

    setActiveEditor({
      mode: "create",
      family: "",
      draft: null,
      showErrors: false,
      typeTouched: false,
    });
  }, [clearActiveEditorErrors]);

  const openEditEffect = useCallback(
    (index: number) => {
      const effect = effects[index];
      if (!effect) return;

      clearNewEffectErrors();

      setActiveEditor({
        mode: "edit",
        index,
        family: effectFamilyOf(effect.type),
        draft: effect,
        showErrors: false,
        typeTouched: true,
      });
    }, [effects, clearNewEffectErrors]
  );

  const closeEditor = useCallback(() => {
    clearActiveEditorErrors();
    setActiveEditor(null);
  }, [clearActiveEditorErrors]);

  /* Effects mutations*/
  const setEffectAt = useCallback(
    (index: number, effect: EnabledEffect) => {
      const next = [...effects];
      next[index] = effect;
      onChange(next);
    }, [effects, onChange]
  );

  const removeEffectAt = useCallback(
    (index: number) => {
      const next = [...effects];
      next.splice(index, 1);
      onChange(next);

      clearEffectErrorsForIndex(index);

      if (activeEditor?.mode === "edit" && activeEditor.index === index) setActiveEditor(null);
    }, [effects, onChange, clearEffectErrorsForIndex, activeEditor]
  );

  /* Validation */
  const validateEffectDraft = useCallback(
    (draft: EnabledEffect, errorPrefix: string) => {
      const parsed = effectSchema.safeParse(draft);

      if (!parsed.success) {
        setInlineErrorsByPath((map) => ({
          ...map,
          ...buildPrefixedErrors(errorPrefix, parsed.error.issues),
        }));
        return { ok: false as const };
      }

      return { ok: true as const, data: parsed.data as EnabledEffect };
    }, [setInlineErrorsByPath]
  );

  /* Save / create */
  const handleCreate = useCallback(() => {
    if (!activeEditor || activeEditor.mode !== "create" || !activeEditor.draft) return;

    const result = validateEffectDraft(activeEditor.draft, "newEffect");
    if (!result.ok) return;

    clearNewEffectErrors();
    onChange([...(effects ?? []), result.data]);
    setActiveEditor(null);
    toast.success("Efecto creado", "Se ha añadido el efecto.");
  }, [activeEditor, validateEffectDraft, clearNewEffectErrors, onChange, effects]);

  const handleSaveEdit = useCallback(() => {
    if (!activeEditor || activeEditor.mode !== "edit" || !activeEditor.draft) return;

    const result = validateEffectDraft(activeEditor.draft, `effects.${activeEditor.index}`);
    if (!result.ok) return;

    clearEffectErrorsForIndex(activeEditor.index);
    setEffectAt(activeEditor.index, result.data);
    setActiveEditor(null);
    toast.success("Efecto guardado", "Se ha actualizado el efecto.");
  }, [activeEditor, validateEffectDraft, clearEffectErrorsForIndex, setEffectAt]);

  const handleChangeEditorFamily = useCallback(
    (family: EffectFamilyId) => {
      clearActiveEditorErrors();

      const familySpec = availableFamilies.find((item) => item.id === family);
      const preferredType = getPreferredTypeForFamily(family, familySpec?.effectTypes ?? []);

      const firstDraft = family === "progress" ? null : preferredType ? createDefaultEffect(factory, preferredType) : null;

      setActiveEditor((prev) => {
        if (!prev) return prev;

        const nextTypeTouched = family === "audio" || family === "progress" ? false : true;

        return {
          ...prev,
          family,
          draft: firstDraft,
          showErrors: false,
          typeTouched: nextTypeTouched,
        };
      });
    }, [availableFamilies, clearActiveEditorErrors, factory]
  );

  const handleChangeEditorType = useCallback(
    (picked: EnabledEffectType) => {
      clearActiveEditorErrors();

      setActiveEditor((prev) => {
        if (!prev) return prev;

        const nextBase = createDefaultEffect(factory, picked);
        const next = carryOverCommonFields(prev.draft, nextBase);
        const family = effectFamilyOf(picked);

        return {
          ...prev,
          family,
          draft: next,
          showErrors: false,
          typeTouched: true,
        } as ActiveEditorState;
      });
    }, [clearActiveEditorErrors, factory]
  );

  const handleChangeEditorDraft = useCallback((next: EnabledEffect) => {
    setActiveEditor((prev) => {
      if (!prev) return prev;
      return { ...prev, draft: next };
    });
  }, []);

  const editorErrorPrefix = activeEditor?.mode === "create"
      ? "newEffect" : activeEditor?.mode === "edit" ? `effects.${activeEditor.index}` : "";

  const editorEffect = activeEditor?.draft ?? null;
  const editorFamily = activeEditor?.family ?? "";

  const editorTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!editorFamily) return [];

    const family = availableFamilies.find((item) => item.id === editorFamily);
    if (!family) return [];

    return family.effectTypes.map((type) => ({ id: type, label: effectLabel(type) }));
  }, [availableFamilies, editorFamily]);

  return (
    <div className="rounded-lg border-2 border-slate-600 bg-slate-950/90 p-3 h-[72vh] overflow-y-auto editor-scroll">
      <div className="text-[16px] font-semibold text-slate-100 pb-3">Efectos</div>

      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b-2 border-slate-800 py-2 flex justify-center mt-2">
        {!activeEditor && (
          <button
            type="button"
            className="btn btn-add-condition"
            onClick={openCreateEffect}
            title="Añadir efecto"
          >
            + Añadir efecto
          </button>
        )}
      </div>

      <div className="pt-3">
        {activeEditor ? (
          <div className="mt-3 bg-slate-950/35 p-3">
            <div className="h-full overflow-y-auto editor-scroll p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-12 ml-1.5 min-w-62">
                  <Select<EffectFamilyId>
                    value={editorFamily as EffectFamilyId}
                    placeholder="Selecciona la familia del efecto"
                    onChange={(value) => handleChangeEditorFamily(value as EffectFamilyId)}
                    options={familyOptions}
                  />
                </div>
              </div>

              {editorFamily ? (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                  <div className="md:col-span-12 ml-1.5">
                    <div className="bg-slate-950/25 p-2">
                      <div onClick={(e) => e.stopPropagation()}>
                        <EffectLeafEditor
                          factory={factory}
                          eff={editorEffect}
                          selectedFamily={editorFamily}
                          familyTypeOptions={editorTypeOptions}
                          onChangeType={handleChangeEditorType}
                          onChange={handleChangeEditorDraft}
                          errorsByPath={activeEditor.mode === "create" ? activeEditor.showErrors ? inlineErrorsByPath : {} : inlineErrorsByPath }
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
                  {activeEditor.mode === "edit" ? (
                    <div
                      className="btn btn-danger-condition"
                      onClick={() => removeEffectAt(activeEditor.index)}
                      title="Eliminar efecto"
                    >
                      Eliminar
                    </div>
                  ) : (
                    <div
                      className="btn btn-danger-condition opacity-40 pointer-events-none"
                      title="Solo disponible al editar un efecto existente"
                    >
                      Eliminar
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="btn btn-close-condition" onClick={closeEditor}>
                    Cerrar
                  </div>

                  {activeEditor.mode === "create" ? (
                    <div
                      className={"btn btn-create-condition " +
                        (!editorEffect ? "opacity-40 pointer-events-none" : "")}
                      onClick={handleCreate}
                      title={!editorEffect ? "Selecciona una opción de efecto" : "Crear efecto"}
                    >
                      Crear efecto
                    </div>
                  ) : (
                    <div
                      className={"btn btn-create-condition " + (!editorEffect ? "opacity-40 pointer-events-none" : "")}
                      onClick={handleSaveEdit}
                      title={!editorEffect ? "No hay cambios que guardar" : "Guardar"}
                    >
                      Guardar
                    </div>
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
                onKeyDown={(e) => {if (e.key === "Enter" || e.key === " ") openEditEffect(index)}}
                title="Click para editar"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-50 mt-1 ml-2">
                      {effectLabel(effect.type)}:
                      <span className="font-normal text-slate-300">
                        {" "}{summarizeEffect(factory, effect)}
                      </span>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
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

        {inlineErrorsByPath["effects"] ? (
          <div className="pt-2 text-[12px] text-rose-300">
            {inlineErrorsByPath["effects"]}
          </div>
        ) : null}
      </div>
    </div>
  );
}