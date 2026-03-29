import { useEffect, useMemo, useState } from "react";
import { buildInlineErrorMapByPath, type ZodIssue } from "@/shared/zodIssues";
import { effectSchema } from "@/validation/rulesSchemas";
import {
  type FactoryCtx,
  effectFamilyOf,
  effectLabel,
  createDefaultEffect,
  summarizeEffect,
  type EnabledEffect,
  type EnabledEffectType,
} from "@/features/editor/scene/rules/effects/effectFactory";
import {
  getAvailableEffectFamilies,
  type EffectFamilyId,
} from "@/features/editor/scene/rules/effects/effectFamilies";
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
    draft: EnabledEffect;
    showErrors: boolean;
    typeTouched: boolean;
  }
  | null;

function buildPrefixedErrors(prefix: string, issues: ZodIssue[]): Record<string, string> {
  const base = buildInlineErrorMapByPath(issues);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(base)) out[`${prefix}.${k}`] = v;
  return out;
}

function removePrefixedErrors(map: Record<string, string>, prefix: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (!k.startsWith(prefix + ".") && k !== prefix) next[k] = v;
  }
  return next;
}

function carryOverCommonFields(prev: EnabledEffect | null, next: EnabledEffect): EnabledEffect {
  if (!prev) return next;

  switch (next.type) {
    case "addItem":
    case "removeItem":
    case "setPlacedItemVisible":
    case "setPlacedItemReachable":
      if (
        prev.type === "addItem" ||
        prev.type === "removeItem" ||
        prev.type === "setPlacedItemVisible" ||
        prev.type === "setPlacedItemReachable"
      ) {
        return { ...next, placedItemId: prev.placedItemId } as EnabledEffect;
      }
      return next;

    case "setHotspotVisible":
    case "setHotspotReachable":
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      if (
        prev.type === "setHotspotVisible" ||
        prev.type === "setHotspotReachable" ||
        prev.type === "setHotspotVar" ||
        prev.type === "toggleHotspotVar" ||
        prev.type === "incHotspotVar" ||
        prev.type === "decHotspotVar"
      ) {
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
      if (
        prev.type === "setPlacedNpcVisible" ||
        prev.type === "setPlacedNpcReachable" ||
        prev.type === "giveItemToNpc" ||
        prev.type === "receiveItemFromNpc" ||
        prev.type === "setNpcVar" ||
        prev.type === "toggleNpcVar" ||
        prev.type === "incNpcVar" ||
        prev.type === "decNpcVar"
      ) {
        return {
          ...next,
          npcId: prev.npcId,
          ...("varId" in next && "varId" in prev ? { varId: prev.varId } : {}),
          ...("placedItemId" in next && "placedItemId" in prev ? { placedItemId: prev.placedItemId } : {}),
        } as EnabledEffect;
      }
      return next;

    case "setPlacedPlayerVisible":
    case "setPlacedPlayerImage":
    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      if (
        prev.type === "setPlacedPlayerVisible" ||
        prev.type === "setPlacedPlayerImage" ||
        prev.type === "setPlayerVar" ||
        prev.type === "togglePlayerVar" ||
        prev.type === "incPlayerVar" ||
        prev.type === "decPlayerVar"
      ) {
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
      if (prev.type === "setMapRegionAvailable" && next.type === "setMapRegionAvailable") {
        return { ...next, mapId: prev.mapId, regionId: prev.regionId } as EnabledEffect;
      }
      return next;

    default:
      return next;
  }
}

export function EffectPanel({
  factory,
  effects,
  onChange,
  inlineErrorsByPath,
  setInlineErrorsByPath,
}: Props) {
  const availableFamilies = useMemo(() => getAvailableEffectFamilies(factory), [factory]);

  const familyOptions = useMemo<Option<EffectFamilyId>[]>(
    () => availableFamilies.map((family) => ({ id: family.id, label: family.label })),
    [availableFamilies]
  );

  const [activeEditor, setActiveEditor] = useState<ActiveEditorState>(null);

  useEffect(() => setActiveEditor(null), [factory]);

  const clearNewEffectErrors = () =>
    setInlineErrorsByPath((m) => removePrefixedErrors(m, "newEffect"));

  const clearEffectErrorsForIndex = (index: number) =>
    setInlineErrorsByPath((m) => removePrefixedErrors(m, `effects.${index}`));

  const clearActiveEditorErrors = () => {
    if (!activeEditor) return;
    if (activeEditor.mode === "create") clearNewEffectErrors();
    if (activeEditor.mode === "edit") clearEffectErrorsForIndex(activeEditor.index);
  };

  const openCreateEffect = () => {
    clearActiveEditorErrors();
    setActiveEditor({
      mode: "create",
      family: "",
      draft: null,
      showErrors: false,
      typeTouched: false,
    });
  };

  const openEditEffect = (index: number) => {
    const eff = effects[index];
    if (!eff) return;

    clearNewEffectErrors();

    setActiveEditor({
      mode: "edit",
      index,
      family: effectFamilyOf(eff.type),
      draft: eff,
      showErrors: false,
      typeTouched: true,
    });
  };

  const closeEditor = () => {
    clearActiveEditorErrors();
    setActiveEditor(null);
  };

  const setEffectAt = (index: number, eff: EnabledEffect) => {
    const next = [...effects];
    next[index] = eff;
    onChange(next);
  };

  const removeEffectAt = (index: number) => {
    const next = [...effects];
    next.splice(index, 1);
    onChange(next);

    clearEffectErrorsForIndex(index);

    if (activeEditor?.mode === "edit" && activeEditor.index === index) {
      setActiveEditor(null);
    }
  };

  const validateEffectDraft = (draft: EnabledEffect, errorPrefix: string) => {
    const parsed = effectSchema.safeParse(draft);

    if (!parsed.success) {
      setInlineErrorsByPath((m) => ({
        ...m,
        ...buildPrefixedErrors(errorPrefix, parsed.error.issues as ZodIssue[]),
      }));
      return { ok: false as const };
    }

    return { ok: true as const, data: parsed.data as EnabledEffect };
  };

  const handleCreate = () => {
    if (!activeEditor || activeEditor.mode !== "create" || !activeEditor.draft) return;

    const res = validateEffectDraft(activeEditor.draft, "newEffect");
    if (!res.ok) return;

    clearNewEffectErrors();
    onChange([...(effects ?? []), res.data]);
    setActiveEditor(null);
    toast.success("Efecto creado", "Se ha añadido el efecto.");
  };

  const handleSaveEdit = () => {
    if (!activeEditor || activeEditor.mode !== "edit") return;

    const res = validateEffectDraft(activeEditor.draft, `effects.${activeEditor.index}`);
    if (!res.ok) return;

    clearEffectErrorsForIndex(activeEditor.index);
    setEffectAt(activeEditor.index, res.data);
    setActiveEditor(null);
    toast.success("Efecto guardado", "Se ha actualizado el efecto.");
  };

  const handleChangeEditorFamily = (family: EffectFamilyId) => {
    clearActiveEditorErrors();

    const familySpec = availableFamilies.find((f) => f.id === family);

    const preferredTypeByFamily: Partial<Record<EffectFamilyId, EnabledEffectType>> = {
      message: "showMessage",
      progress: "goToNode",
      item: "addItem",
      hotspot: "setHotspotVisible",
      npc: "setPlacedNpcVisible",
      player: "setPlacedPlayerVisible",
      audio: "playSfx",
      dialogue:
        familySpec?.effectTypes.includes("startDialogue")
          ? "startDialogue"
          : familySpec?.effectTypes.includes("endDialogue")
            ? "endDialogue"
            : undefined,
      ending: "endGame",
    };

    const preferredType = preferredTypeByFamily[family];
    const firstType =
      preferredType && familySpec?.effectTypes.includes(preferredType)
        ? preferredType
        : familySpec?.effectTypes[0];

    const firstDraft = firstType ? createDefaultEffect(factory, firstType) : null;

    setActiveEditor((prev) => {
      if (!prev) return prev;

      const nextTypeTouched = family === "audio" ? false : true;

      if (prev.mode === "create") {
        return {
          ...prev,
          family,
          draft: firstDraft,
          showErrors: false,
          typeTouched: nextTypeTouched,
        };
      }

      return {
        ...prev,
        family,
        draft: firstDraft as never,
        showErrors: false,
        typeTouched: nextTypeTouched,
      };
    });
  };

  const handleChangeEditorType = (picked: EnabledEffectType) => {
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
  };

  const handleChangeEditorDraft = (next: EnabledEffect) => {
    setActiveEditor((prev) => {
      if (!prev) return prev;
      return { ...prev, draft: next };
    });
  };

  const editorErrorPrefix =
    activeEditor?.mode === "create"
      ? "newEffect"
      : activeEditor?.mode === "edit"
        ? `effects.${activeEditor.index}`
        : "";

  const editorEffect = activeEditor?.draft ?? null;
  const editorFamily = activeEditor?.family ?? "";

  const editorTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!editorFamily) return [];

    const family = availableFamilies.find((item) => item.id === editorFamily);
    if (!family) return [];

    return family.effectTypes.map((type) => ({ id: type, label: effectLabel(type) }));
  }, [availableFamilies, editorFamily]);

  return (
    <div className="rounded-lg bg-slate-950/90 p-3 h-[72vh] overflow-y-auto editor-scroll">
      <div className="text-sm font-semibold text-slate-100 pb-3">Efectos</div>

      <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-slate-800/70 py-2 flex justify-center mt-2">
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
                    onChange={(v) => handleChangeEditorFamily(v as EffectFamilyId)}
                    options={familyOptions}
                  />
                </div>
              </div>

              {editorEffect ? (
                <>
                  {activeEditor.mode === "edit" ? (
                    <div className="ml-1.5 text-[12px] font-semibold text-slate-50">
                      {effectLabel(editorEffect.type)}{" "}
                      <span className="font-normal text-slate-300">
                        · {summarizeEffect(factory, editorEffect)}
                      </span>
                    </div>
                  ) : null}

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
                            errorsByPath={
                              activeEditor.mode === "create"
                                ? activeEditor.showErrors
                                  ? inlineErrorsByPath
                                  : {}
                                : inlineErrorsByPath
                            }
                            errorPrefix={editorErrorPrefix}
                            showLocalErrors={activeEditor.showErrors}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
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
                      className={"btn btn-create-condition " + (!editorEffect ? "opacity-40 pointer-events-none" : "")}
                      onClick={handleCreate}
                      title={!editorEffect ? "Selecciona una familia de efecto" : "Crear efecto"}
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
          <div className="space-y-2">
            {(effects ?? []).map((eff, i) => (
              <div
                key={`${eff.type}-${i}`}
                className="rounded-lg border border-slate-700 bg-slate-900/50 p-2 cursor-pointer"
                onClick={() => openEditEffect(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openEditEffect(i);
                }}
                title="Click para editar"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-slate-50">
                      {effectLabel(eff.type)}{" "}
                      <span className="font-normal text-slate-300">
                        · {summarizeEffect(factory, eff)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="btn btn-close-condition text-[12px] px-2"
                      onClick={() => openEditEffect(i)}
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger-condition text-[12px] px-2"
                      onClick={() => removeEffectAt(i)}
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
          <div className="pt-2 text-[12px] text-rose-300">{inlineErrorsByPath["effects"]}</div>
        ) : null}
      </div>
    </div>
  );
}