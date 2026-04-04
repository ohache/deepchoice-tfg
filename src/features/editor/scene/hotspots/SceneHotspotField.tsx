import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import type { Effect } from "@/domain/effects";
import { toast } from "@/shared/toast/toastStore";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import type { VarRowErrors } from "@/shared/vars/varRow";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { HotspotListPanel } from "@/features/editor/scene/hotspots/HotspotListPanel";
import { HotspotEditorPanel } from "@/features/editor/scene/hotspots/HotspotEditorPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { generateId } from "@/utils/id";
import type { Condition } from "@/domain/conditions";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { buildClickableRegions, normKey, useActiveSceneLayer, useFocusWhenEnabled } from "@/features/editor/scene/interactiveComponents/fieldHelpers";

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
};

export function SceneHotspotField({ label = "Hotspots", active, onToggle, layerId }: SceneHotspotFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const hotspotEditor = useEditorStore((s) => s.hotspotEditor);

  const startRedrawHotspotShape = useEditorStore((s) => s.startRedrawHotspotShape);
  const startDrawingHotspot = useEditorStore((s) => s.startDrawingHotspot);
  const editHotspot = useEditorStore((s) => s.editHotspot);
  const cancelHotspotDraft = useEditorStore((s) => s.cancelHotspotDraft);

  const setHotspotDraftLabel = useEditorStore((s) => s.setHotspotDraftLabel);
  const setHotspotDraftInitialState = useEditorStore((s) => s.setHotspotDraftInitialState);
  const setHotspotDraftVars = useEditorStore((s) => s.setHotspotDraftVars);
  const setHotspotDraftRules = useEditorStore((s) => s.setHotspotDraftRules);
  const setHotspotDraftShape = useEditorStore((s) => s.setHotspotDraftShape);
  const commitHotspotDraft = useEditorStore((s) => s.commitHotspotDraft);

  const removeHotspot = useEditorStore((s) => s.removeHotspot);
  const setActiveHotspots = useEditorStore((s) => s.setActiveHotspots);

  const selectedInteractionKind = useEditorStore((s) => s.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((s) => s.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((s) => s.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((s) => s.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((s) => s.clearInteractionSelection);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({
    active,
    layerId,
    activeLayerId,
    setActiveLayerId,
    layers,
  });

  const nodeId = nodeDraft?.id ?? "";

  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);
  const placedItems = useMemo<PlacedItem[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  const selectedId = selectedInteractionKind === "hotspot" ? selectedInteractionId : null;

  const draft = hotspotEditor.draft;
  const isDrawing = hotspotEditor.mode.type === "drawing";
  const isEditing = hotspotEditor.mode.type !== "idle";

  const collisionResetKey = `${layerId}:${draft?.id ?? "none"}:${hotspotEditor.mode.type}`;

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft) return null;

    return {
      kind: "hotspot",
      layerId,
      hotspotId: draft.id,
      hotspot: draft,
    };
  }, [draft, layerId]);

  const labelKey = normKey(draft?.label);
  const dupLabelInLayer = useMemo(() => {
    if (!draft || !labelKey) return false;

    return hotspots.some((h) => {
      if (h.id === draft.id) return false;
      return normKey(h.label) === labelKey;
    });
  }, [draft, labelKey, hotspots]);

  const isExistingHotspot = useMemo(() => {
    if (!draft?.id) return false;
    return hotspots.some((h) => h.id === draft.id);
  }, [draft?.id, hotspots]);

  const clickableRegions = useMemo(
    () =>
      buildClickableRegions({
        project,
        hotspots,
        placedItems,
        placedNpcs,
        placedPlayers,
      }),
    [project, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.id ? { kind: "hotspot", id: draft.id } : undefined,
    enabled: true,
    isDrawing,
    minRect: 0.02,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setHotspotDraftShape(null);
      startRedrawHotspotShape();
    },
    onCollision: (summary) => {
      setEditorError({
        kind: "panel",
        message: `Colisión con: ${summary}. Dibuja otra región o pulsa “Cancelar”.`,
      });
    },
  });

  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [editorError, setEditorError] = useState<HotspotEditorError>(null);

  const canFocusLabelNow = hasShape && !hasCollisions;
  const labelInputRef = useFocusWhenEnabled<HTMLInputElement>(canFocusLabelNow);

  const hasLabel = Boolean((draft?.label ?? "").trim());

  const hasAnyRules =
    Boolean((draft?.rules?.onClick?.length ?? 0) > 0) ||
    Boolean((draft?.rules?.onUseItem?.length ?? 0) > 0);

  const [varErrorsById, setVarErrorsById] = useState<Record<string, VarRowErrors | undefined>>({});

  const {
    draftVars: draftVarsUI,
    openVarId,
    varNameRefs,
    isDirtyVar,
    syncFromVars,
    updateVarRow,
    switchVarType,
    addVarRow,
    toggleVarOpen,
    removeVarRow,
    saveVarRow,
  } = useEntityVarsEditor({
    initialVars: draft?.vars ?? [],
    createId: generateId.var,
    useDirtyTracking: true,
    blockOpenIfDirty: true,
    onBlockedOpenDirty: () => {
      setEditorError({ kind: "vars", message: "Guarda o elimina la variable abierta antes de abrir otra." });
    },
    onPersistRemove: (varId) => {
      if (!draft) return;
      const nextPersisted = draft.vars.filter((v) => v.id !== varId);
      setHotspotDraftVars(nextPersisted);
    },
    onPersistSave: (variable, meta) => {
      if (!draft) return;

      const next = meta.existedBefore
        ? draft.vars.map((v) => (v.id === variable.id ? variable : v))
        : [...draft.vars, variable];

      setHotspotDraftVars(next);
    },
  });

  useEffect(() => {
    syncFromVars(draft?.vars ?? []);
    setVarErrorsById({});
  }, [draft?.id, syncFromVars]);

  const hasBlockingVarEdit = Boolean(openVarId && isDirtyVar(openVarId));

  const warnBlockingVarEdit = () => {
    setEditorError({ kind: "vars", message: "Guarda o elimina la variable abierta antes de continuar." });
  };

  const handleChangeVar = (
    id: string,
    patch: Parameters<typeof updateVarRow>[1],
    opts?: Parameters<typeof updateVarRow>[2],
  ) => {
    updateVarRow(id, patch, opts);

    setVarErrorsById((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      next[id] = undefined;
      return next;
    });
  };

  const handleDeleteVar = (id: string) => {
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

  const useItemSourceOptions = useMemo(
    () =>
      placedItems.map((p) => ({
        id: p.id,
        label: p.label?.trim() || p.id,
      })),
    [placedItems],
  );

  const {
    activeChannel,
    setActiveChannel,
    clickRules,
    useItemRulesForSelected,
    selectedUseItemId,
    ruleModalOpen,
    currentRuleValue,
    openAddClickRule,
    openEditClickRule,
    openAddUseItemRule,
    openEditUseItemRule,
    removeClickRule,
    removeUseItemRule,
    closeRuleModal,
    saveRule,
  } = useEntityRulesEditor({ rules: draft?.rules, onChangeRules: setHotspotDraftRules });

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

  const handleSaveRule = (rule: { id: ID; when?: Condition; effects: Effect[] }) => {
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
      setEditorError({
        kind: "panel",
        message: "El hotspot debe tener una etiqueta antes de guardarse.",
      });
      return;
    }

    if (!hasAnyRules) {
      setEditorError({ kind: "rules" });
      return;
    }

    if (dupLabelInLayer) {
      toast.warning("Etiqueta duplicada", "Ya existe un hotspot con esa etiqueta en esta capa.");
      return;
    }

    if (hasCollisions) {
      setEditorError({
        kind: "panel",
        message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.`,
      });
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
    toast.success("Hotspot guardado", "El hotspot ya forma parte de la escena.");
  };

  const handleDelete = (id: ID) => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    removeHotspot(id);

    const isSelectedHotspot = selectedInteractionKind === "hotspot" && selectedInteractionId === id;
    if (isSelectedHotspot) clearInteractionSelection();

    const isEditingThisDraft = draft?.id === id;
    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelHotspotDraft();
    }

    toast.success("Hotspot eliminado", "Se ha eliminado correctamente.");
  };

  const handleAskNukeAll = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    if (!hotspots.length) return;
    setConfirmNukeOpen(true);
  };

  const handleConfirmNukeAll = () => {
    if (hasBlockingVarEdit) {
      warnBlockingVarEdit();
      return;
    }

    setConfirmNukeOpen(false);
    setActiveHotspots([]);
    clearInteractionSelection();

    if (draft) {
      resetCollisionGuard();
      cancelHotspotDraft();
    }

    toast.success("Hotspots borrados", "Se han eliminado todos los hotspots de esta capa.");
  };

  useEffect(() => {
    if (!hasBlockingVarEdit && editorError?.kind === "vars") {
      setEditorError(null);
    }
  }, [hasBlockingVarEdit, editorError]);

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

  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setHotspotDraftInitialState({
        visible: false,
        reachable: false,
        notReachableText: "",
      });
      return;
    }
    setHotspotDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) setHotspotDraftInitialState({ reachable: true, notReachableText: "" });
    else setHotspotDraftInitialState({ reachable: false });
  };

  const initialVisible = draft?.initialState.visible ?? true;
  const initialReachable = draft?.initialState.reachable ?? true;
  const initialNotReachableText = draft?.initialState.notReachableText ?? "";

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);
  const disableAllEditorFields = !hasShape;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;
  const hasAnyVars = (draft?.vars ?? []).length > 0 || draftVarsUI.length > 0;

  const panelError = editorError?.kind === "panel" ? editorError.message : null;
  const varPanelError = editorError?.kind === "vars" ? editorError.message : null;
  const showRulesRequiredError = editorError?.kind === "rules";

  if (!layer) {
    return (
      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="mx-auto max-w-[420px] bg-slate-950/40 text-center mt-4 mb-2 text-xs text-white">
          No hay capa seleccionada.
        </div>
      </ToggleFieldBlock>
    );
  }

  return (
    <>
      <ConfirmDangerModal
        open={confirmNukeOpen}
        title="Borrar todos los hotspots"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar todos los hotspots de esta capa?"
        confirmText="Sí, borrar todos"
        cancelText="Cancelar"
        onConfirm={handleConfirmNukeAll}
        onCancel={() => setConfirmNukeOpen(false)}
      />

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
              hasAnyVars={hasAnyVars}
              hasAnyRules={hasAnyRules}
              panelError={panelError}
              varPanelError={varPanelError}
              showRulesRequiredError={showRulesRequiredError}
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
              onBindVarNameInputRef={(id, el) => {
                varNameRefs.current[id] = el;
              }}
              owner={owner}
              useItemSourceOptions={useItemSourceOptions}
              activeChannel={activeChannel}
              setActiveChannel={handleSetActiveChannel}
              clickRules={clickRules}
              useItemRulesForSelected={useItemRulesForSelected}
              selectedUseItemId={selectedUseItemId}
              ruleModalOpen={ruleModalOpen}
              currentRuleValue={currentRuleValue}
              nodeId={nodeId}
              project={project}
              onOpenAddClickRule={handleOpenAddClickRule}
              onOpenEditClickRule={handleOpenEditClickRule}
              onRemoveClickRule={handleRemoveClickRule}
              onOpenAddUseItemRule={handleOpenAddUseItemRule}
              onOpenEditUseItemRule={handleOpenEditUseItemRule}
              onRemoveUseItemRule={handleRemoveUseItemRule}
              onCloseRuleModal={handleCloseRuleModal}
              onSaveRule={handleSaveRule}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          ) : (
            <HotspotListPanel
              hotspots={hotspots}
              selectedId={selectedId}
              onCreate={handleNew}
              onEdit={handleEditHotspot}
              onDelete={handleDelete}
              onDeleteAll={handleAskNukeAll}
            />
          )}
        </div>
      </ToggleFieldBlock>
    </>
  );
}