import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, ID, ItemInstance, PlacedNpc, PlacedPlayer, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { useEditorStore } from "@/store/editorStore";
import { buildGameItemOptions } from "@/features/editor/scene/interactiveComponents/gameItemOptions";
import { HotspotEditorPanel } from "@/features/editor/scene/hotspots/HotspotEditorPanel";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { buildClickableRegions, buildLiveProjectWithInteractiveDraft,
  normKey, useActiveSceneLayer, useFocusWhenEnabled } from "@/features/editor/scene/interactiveComponents/interactiveFieldHelpers";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import type { VarRowErrors } from "@/shared/vars/varRow";
import { generateId } from "@/utils/id";
import { toast } from "@/shared/toast/toastStore";

type HotspotEditorError =
  | { kind: "panel"; message: string }
  | { kind: "vars"; message: string }
  | { kind: "rules" }
  | null;

type SceneHotspotFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
  onSaveSceneDraft?: () => boolean;
};

export function SceneHotspotField({ label = "Hotspots", active, onToggle, layerId, onSaveSceneDraft }: SceneHotspotFieldProps) {
  const project = useEditorStore((state) => state.project ?? null);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayerId = useEditorStore((state) => state.setActiveLayerId);

  const hotspotEditor = useEditorStore((state) => state.hotspotEditor);

  const startDrawingHotspot = useEditorStore((state) => state.startDrawingHotspot);
  const startRedrawHotspotShape = useEditorStore((state) => state.startRedrawHotspotShape);
  const editHotspot = useEditorStore((state) => state.editHotspot);
  const cancelHotspotDraft = useEditorStore((state) => state.cancelHotspotDraft);

  const setHotspotDraftLabel = useEditorStore((state) => state.setHotspotDraftLabel);
  const setHotspotDraftInitialState = useEditorStore((state) => state.setHotspotDraftInitialState);
  const setHotspotDraftVars = useEditorStore((state) => state.setHotspotDraftVars);
  const removeHotspotVar = useEditorStore((state) => state.removeHotspotVar);
  const setHotspotDraftRules = useEditorStore((state) => state.setHotspotDraftRules);
  const setHotspotDraftShape = useEditorStore((state) => state.setHotspotDraftShape);
  const commitHotspotDraft = useEditorStore((state) => state.commitHotspotDraft);

  const removeHotspot = useEditorStore((state) => state.removeHotspot);

  const selectedInteractionKind = useEditorStore((state) => state.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((state) => state.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((state) => state.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((state) => state.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((state) => state.clearInteractionSelection);

  const [editorError, setEditorError] = useState<HotspotEditorError>(null);
  const [varErrorsById, setVarErrorsById] = useState<Record<string, VarRowErrors | undefined>>({});

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);

  /* ------------------------------- Capa activa ------------------------------- */
  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const nodeId = nodeDraft?.id ?? "";

  const liveProject = useMemo(() =>
    buildLiveProjectWithInteractiveDraft({ project, nodeDraft, interactiveDraft: hotspotEditor.draft ? { kind: "hotspot", layerId, draft: hotspotEditor.draft } : null }),
  [project, nodeDraft, layerId, hotspotEditor.draft],
);

  /* ---------------------------- Entidades de la capa --------------------------- */
  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);

  const placedItems = useMemo<ItemInstance[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);

  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);

  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  /* ------------------------------ Estado del draft ---------------------------- */
  const draft = hotspotEditor.draft;
  const isDrawing = hotspotEditor.mode.type === "drawing";
  const isEditing = hotspotEditor.mode.type !== "idle";

  /* ------------------------------- Derivados UI ------------------------------- */
  const selectedId = selectedInteractionKind === "hotspot" ? selectedInteractionId : null;

  const hotspotListItems = useMemo<InteractiveListEntry[]>(() => hotspots.map((hotspot) => ({ id: hotspot.id, label: hotspot.label })), [hotspots]);

  const labelKey = normKey(draft?.label);

  const dupLabelInLayer = useMemo(() => {
    if (!draft || !labelKey) return false;

    return hotspots.some((hotspot) => {
      if (hotspot.id === draft.id) return false;
      return normKey(hotspot.label) === labelKey;
    });
  }, [draft, labelKey, hotspots]);

  const isExistingHotspot = useMemo(() => {
    if (!draft?.id) return false;
    return hotspots.some((hotspot) => hotspot.id === draft.id);
  }, [draft?.id, hotspots]);

  const hasLabel = Boolean((draft?.label ?? "").trim());

  /* ------------------------------- Variables -------------------------------- */
  const { draftVars: draftVarsUI, openVarId, varNameRefs, isDirtyVar, syncFromVars, updateVarRow, switchVarType, addVarRow, toggleVarOpen, removeVarRow, saveVarRow } = useEntityVarsEditor({
    initialVars: draft?.vars ?? [],
    createId: generateId.var,
    useDirtyTracking: true,
    blockOpenIfDirty: true,

    onBlockedOpenDirty: () => { setEditorError({ kind: "vars", message: "Guarda o elimina la variable abierta antes de abrir otra." }) },

    onPersistRemove: (varId) => {
      if (!draft) return;

      const nextPersisted = draft.vars.filter((variable) => variable.id !== varId);
      setHotspotDraftVars(nextPersisted);
    },

    onPersistSave: (variable, existedBefore) => {
      if (!draft) return;

      const nextPersisted = existedBefore ? draft.vars.map((currentVar) => (currentVar.id === variable.id ? variable : currentVar)) : [...draft.vars, variable];

      setHotspotDraftVars(nextPersisted);
    },
  });

  useEffect(() => {
    syncFromVars(draft?.vars ?? []);
    setVarErrorsById({});
  }, [draft?.id, draft?.vars, syncFromVars]);

  const hasBlockingVarEdit = Boolean(openVarId && isDirtyVar(openVarId));

  useEffect(() => {
    if (!hasBlockingVarEdit && editorError?.kind === "vars") {
      setEditorError(null);
    }
  }, [hasBlockingVarEdit, editorError?.kind]);

  /* --------------------------- Reglas / owner / items ------------------------- */
  const useItemSourceOptions = useMemo(() => buildGameItemOptions(liveProject), [liveProject]);

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft) return null;

    return { kind: "hotspot", layerId, hotspotId: draft.id, hotspot: draft };
  }, [draft, layerId]);

  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule, openEditClickRule, openAddUseItemRule,
    openEditUseItemRule, removeClickRule, moveClickRule, removeUseItemRule, moveUseItemRule, closeRuleModal, saveRule } = useEntityRulesEditor({
      rules: draft?.rules,
      onChangeRules: setHotspotDraftRules,
    });

  /* -------------------------------- Colisiones -------------------------------- */
  const collisionResetKey = `${layerId}:${draft?.id ?? "none"}`;

  const clickableRegions = useMemo(() =>
    buildClickableRegions({ project: liveProject, hotspots, placedItems, placedNpcs, placedPlayers }),
    [liveProject, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.id ? { kind: "hotspot", id: draft.id } : undefined,
    enabled: true,
    isDrawing,
    minRect: DEFAULT_MIN_RECT_01,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setHotspotDraftShape(null);
      startRedrawHotspotShape();
    },
  });

  /* ----------------------------- Valores del panel ---------------------------- */
  const canFocusLabelNow = hasShape && !hasCollisions;
  const labelInputRef = useFocusWhenEnabled<HTMLInputElement>(canFocusLabelNow);

  const initialVisible = draft?.initialState.visible ?? true;
  const initialReachable = draft?.initialState.reachable ?? true;
  const initialNotReachableText = draft?.initialState.notReachableText ?? "";

  const disableAllEditorFields = !hasShape;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;

  const panelError = editorError?.kind === "panel" ? editorError.message : null;
  const varPanelError = editorError?.kind === "vars" ? editorError.message : null;

  /* -------------------------------- Helpers -------------------------------- */
  const warnBlockingVarEdit = () => { setEditorError({ kind: "vars", message: "Guarda o elimina la variable abierta antes de continuar." })};

  /* ---------------------------- Handlers: variables --------------------------- */
  const handleChangeVar = (id: string, patch: Parameters<typeof updateVarRow>[1], opts?: Parameters<typeof updateVarRow>[2]) => {
    updateVarRow(id, patch, opts);

    setVarErrorsById((prev) => {
      if (!prev[id]) return prev;

      const next = { ...prev };
      next[id] = undefined;
      return next;
    });
  };

  const handleSaveVar = (row: Parameters<typeof saveVarRow>[0]) => {
    const result = saveVarRow(row);

    if (!result.ok) {
      setVarErrorsById((prev) => ({ ...prev, [row.id]: result.errors }));
      return;
    }

    setVarErrorsById((prev) => {
      if (!prev[row.id]) return prev;

      const next = { ...prev };
      next[row.id] = undefined;
      return next;
    });

    setEditorError((prev) => (prev?.kind === "vars" ? null : prev));
    toast.success("Variable guardada", `“${result.variable.name}”`);
  };

  const handleDeleteVar = (id: string) => {
    const savedHotspot = draft?.id ? hotspots.find((hotspot) => hotspot.id === draft.id) : null;

    const existsInSavedHotspot = Boolean(savedHotspot?.vars.some((variable) => variable.id === id));

    if (existsInSavedHotspot) {
      removeHotspotVar(id, { withConfirmation: true });

      setVarErrorsById((prev) => {
        if (!prev[id]) return prev;

        const next = { ...prev };
        next[id] = undefined;
        return next;
      });

      setEditorError((prev) => (prev?.kind === "vars" ? null : prev));

      return;
    }

    removeVarRow(id);

    setVarErrorsById((prev) => {
      if (!prev[id]) return prev;

      const next = { ...prev };
      next[id] = undefined;
      return next;
    });

    setEditorError((prev) => (prev?.kind === "vars" ? null : prev));
    toast.success("Variable eliminada", "Se ha eliminado correctamente.");
  };

  /* ------------------------------ Handlers: reglas ---------------------------- */
  const handleSetActiveChannel = (channel: typeof activeChannel) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setActiveChannel(channel);
  };

  const handleOpenAddClickRule = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    openAddClickRule();
  };

  const handleOpenEditClickRule = (index: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    openEditClickRule(index);
  };

  const handleOpenAddUseItemRule = (itemId: ID) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    openAddUseItemRule(itemId);
  };

  const handleOpenEditUseItemRule = (itemId: ID, indexInFiltered: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    openEditUseItemRule(itemId, indexInFiltered);
  };

  const handleRemoveClickRule = (index: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    removeClickRule(index);
    toast.success("Regla eliminada", "Se ha eliminado la regla.");
  };

  const handleRemoveUseItemRule = (itemId: ID, indexInFiltered: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    removeUseItemRule(itemId, indexInFiltered);
    toast.success("Regla eliminada", "Se ha eliminado la regla.");
  };

  const handleMoveClickRule = (fromIndex: number, toIndex: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    moveClickRule(fromIndex, toIndex);
    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las reglas.");
  };

  const handleMoveUseItemRule = (itemId: ID, fromIndex: number, toIndex: number) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    moveUseItemRule(itemId, fromIndex, toIndex);
    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las reglas.");
  };

  const handleSaveRule = (rule: { id: ID; label: string; when?: Condition; effects: Effect[] }) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    saveRule(rule);
  };

  const handleCloseRuleModal = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    closeRuleModal();
  };

  /* ----------------------------- Handlers: CRUD ------------------------------- */
  const handleNew = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startDrawingHotspot();

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el hotspot.");
  };

  const handleCommit = () => {
    if (!draft) return;

    setEditorError(null);

    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    if (!hasLabel) {
      setEditorError({ kind: "panel", message: "El hotspot debe tener un nombre antes de guardarse." });
      return;
    }

    if (dupLabelInLayer) {
      toast.warning("Nombre duplicado", "Ya existe un hotspot con ese nombre en esta capa.");
      return;
    }

    if (hasCollisions) {
      setEditorError({ kind: "panel", message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.` });
      return;
    }

    const result = commitHotspotDraft();

    if (!result.ok) {
      toast.error("No se ha podido guardar", result.error ?? "Revisa el hotspot.");
      return;
    }

    if (result.hotspotId) {
      setSelectedInteractionKind("hotspot");
      setSelectedInteractionId(result.hotspotId);
    }

    setEditorError(null);
    onSaveSceneDraft?.();
  };

  const handleDelete = (id: ID) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    removeHotspot(id, { withConfirmation: true });

    const isSelectedHotspot = selectedInteractionKind === "hotspot" && selectedInteractionId === id;

    if (isSelectedHotspot) clearInteractionSelection();

    const isEditingThisDraft = draft?.id === id;

    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelHotspotDraft();
    }
  };

  const handleEditHotspot = (hotspotId: ID) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setEditorError(null);
    setSelectedInteractionKind("hotspot");
    setSelectedInteractionId(hotspotId);
    editHotspot(hotspotId);
  };

  const handleDeleteDraft = () => {
    if (!draft) return;
    handleDelete(draft.id);
  };

  const handleCancelDraft = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    cancelHotspotDraft();
    clearInteractionSelection();

    toast.info("Cancelado", "Has salido del editor de hotspot.");
  };

  const handleStartRedrawShape = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setEditorError(null);
    resetCollisionGuard();

    startRedrawHotspotShape();

    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del hotspot.");
  };

  /* -------------------------- Handlers: estado inicial ------------------------- */
  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setHotspotDraftInitialState({ visible: false, reachable: false, notReachableText: "" });
      return;
    }

    setHotspotDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) {
      setHotspotDraftInitialState({ reachable: true, notReachableText: "" });
      return;
    }

    setHotspotDraftInitialState({ reachable: false });
  };

  if (!layer) {
    return (
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="mx-auto mt-4 mb-2 max-w-[420px] bg-slate-950/40 text-center text-xs text-white">
          No hay capa seleccionada.
        </div>
      </ToggleFieldBlock>
    );
  }

  return (
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {isEditing && draft ? (
            <HotspotEditorPanel
              draft={draft}
              isDrawing={isDrawing}
              hasShape={hasShape}
              isExistingHotspot={isExistingHotspot}
              dupLabelInLayer={dupLabelInLayer}
              hasCollisions={hasCollisions}
              collisionSummary={collisionSummary}
              collisionLock={collisionLock}
              disableAllEditorFields={disableAllEditorFields}
              disableReachable={disableReachable}
              disableNotReachableText={disableNotReachableText}
              initialVisible={initialVisible}
              initialReachable={initialReachable}
              initialNotReachableText={initialNotReachableText}
              labelInputRef={labelInputRef}
              notReachableInputRef={notReachableInputRef}
              onLabelChange={setHotspotDraftLabel}
              onStartRedrawShape={handleStartRedrawShape}
              onVisibleChange={handleVisibleChange}
              onReachableChange={handleReachableChange}
              onNotReachableTextChange={(value) => setHotspotDraftInitialState({ notReachableText: value })}
              panelError={panelError}
              varPanelError={varPanelError}
              draftVarsUI={draftVarsUI}
              openVarId={openVarId}
              varErrorsById={varErrorsById}
              onAddVar={() => {
                if (disableAllEditorFields || openVarId) return;
                addVarRow();
              }}
              onToggleVarOpen={toggleVarOpen}
              onChangeVar={handleChangeVar}
              onSwitchVarType={switchVarType}
              onSaveVar={handleSaveVar}
              onDeleteVar={handleDeleteVar}
              onBindVarNameInputRef={(id, element) => { varNameRefs.current[id] = element }}
              owner={owner}
              useItemSourceOptions={useItemSourceOptions}
              activeChannel={activeChannel}
              setActiveChannel={handleSetActiveChannel}
              clickRules={clickRules}
              useItemRulesForSelected={useItemRulesForSelected}
              ruleModalOpen={ruleModalOpen}
              currentRuleValue={currentRuleValue}
              nodeId={nodeId}
              project={liveProject}
              onOpenAddClickRule={handleOpenAddClickRule}
              onOpenEditClickRule={handleOpenEditClickRule}
              onRemoveClickRule={handleRemoveClickRule}
              onMoveClickRule={handleMoveClickRule}
              onOpenAddUseItemRule={handleOpenAddUseItemRule}
              onOpenEditUseItemRule={handleOpenEditUseItemRule}
              onRemoveUseItemRule={handleRemoveUseItemRule}
              onMoveUseItemRule={handleMoveUseItemRule}
              onCloseRuleModal={handleCloseRuleModal}
              onSaveRule={handleSaveRule}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          ) : (
            <InteractiveListPanel
              items={hotspotListItems}
              selectedId={selectedId}
              itemTitle="Editar hotspot"
              editTitle="Editar"
              editAriaLabel="Editar hotspot"
              deleteAriaLabel="Eliminar hotspot"
              createLabel="+ Añadir hotspot"
              onCreate={handleNew}
              onEdit={handleEditHotspot}
              onDelete={handleDelete}
            />
          )}
        </div>
      </ToggleFieldBlock>
  );
}