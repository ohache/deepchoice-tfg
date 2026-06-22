import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, ID, NpcDef, ItemInstance, PlacedNpc, PlacedPlayer, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { useEditorStore } from "@/store/editorStore";
import { PlacedNpcEditorPanel } from "@/features/editor/scene/placedNpcs/PlacedNpcEditorPanel";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";
import { buildClickableRegions, buildProjectWithNodeDraft, useActiveSceneLayer } from "@/features/editor/scene/interactiveComponents/interactiveFieldHelpers";
import { buildGameItemOptions } from "@/features/editor/scene/interactiveComponents/gameItemOptions";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { toast } from "@/shared/toast/toastStore";

type PlacedNpcEditorError =
  | { kind: "panel"; message: string }
  | { kind: "rules" }
  | null;

type ScenePlacedNpcFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
};

export function ScenePlacedNpcField({ label = "PNJs", active, onToggle, layerId }: ScenePlacedNpcFieldProps) {
  const project = useEditorStore((state) => state.project ?? null);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayerId = useEditorStore((state) => state.setActiveLayerId);

  const placedNpcEditor = useEditorStore((state) => state.placedNpcEditor);

  const startPlacingPlacedNpc = useEditorStore((state) => state.startPlacingPlacedNpc);
  const startRedrawPlacedNpcShape = useEditorStore((state) => state.startRedrawPlacedNpcShape);
  const editPlacedNpc = useEditorStore((state) => state.editPlacedNpc);
  const cancelPlacedNpcDraft = useEditorStore((state) => state.cancelPlacedNpcDraft);

  const setPlacedNpcDraftNpcId = useEditorStore((state) => state.setPlacedNpcDraftNpcId);
  const setPlacedNpcDraftInitialState = useEditorStore((state) => state.setPlacedNpcDraftInitialState);
  const setPlacedNpcDraftRules = useEditorStore((state) => state.setPlacedNpcDraftRules);
  const setPlacedNpcDraftShape = useEditorStore((state) => state.setPlacedNpcDraftShape);
  const commitPlacedNpcDraft = useEditorStore((state) => state.commitPlacedNpcDraft);

  const removePlacedNpc = useEditorStore((state) => state.removePlacedNpc);

  const selectedInteractionKind = useEditorStore((state) => state.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((state) => state.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((state) => state.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((state) => state.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((state) => state.clearInteractionSelection);

  const [selectedCatalogNpcId, setSelectedCatalogNpcId] = useState<ID | "">("");
  const [isCreatingPlacedNpc, setIsCreatingPlacedNpc] = useState(false);
  const [editorError, setEditorError] = useState<PlacedNpcEditorError>(null);

  /* ---------------------------- Datos del proyecto --------------------------- */
  const projectNpcs = useMemo<NpcDef[]>(() => project?.npcs ?? [], [project?.npcs]);

  useEffect(() => {
    if (!projectNpcs.length) {
      setSelectedCatalogNpcId("");
      return;
    }

    if (!selectedCatalogNpcId) return;

    const exists = projectNpcs.some((npc) => npc.id === selectedCatalogNpcId);
    if (!exists) setSelectedCatalogNpcId("");
  }, [projectNpcs, selectedCatalogNpcId]);

  /* ------------------------------- Capa activa ------------------------------- */
  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const nodeId = nodeDraft?.id ?? "";

  const liveProject = useMemo(() => buildProjectWithNodeDraft(project, nodeDraft), [project, nodeDraft]);

  /* ---------------------------- Entidades de la capa --------------------------- */
  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);

  const placedItems = useMemo<ItemInstance[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);

  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);

  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  /* ------------------------------ Estado del draft ---------------------------- */
  const draft = placedNpcEditor.draft;
  const isDrawing = placedNpcEditor.mode.type === "drawing";
  const isDraftActive = placedNpcEditor.mode.type !== "idle";

  /* ------------------------------- Derivados UI ------------------------------- */
  const selectedId = selectedInteractionKind === "placedNpc" ? selectedInteractionId : null;

  const isExistingPlacedNpc = useMemo(() => {
    if (!draft?.npcId) return false;
    return placedNpcs.some((placedNpc) => placedNpc.npcId === draft.npcId);
  }, [draft?.npcId, placedNpcs]);

  const placedNpcListEntries = useMemo<InteractiveListEntry[]>(() => placedNpcs.map((placedNpc) => {
        const npcDef = projectNpcs.find((def) => def.id === placedNpc.npcId) ?? null;

        return { id: placedNpc.npcId, label: npcDef?.name?.trim() || placedNpc.npcId };
      }), [placedNpcs, projectNpcs],
  );

  /* --------------------------- Reglas / owner / items ------------------------- */
  const useItemSourceOptions = useMemo(() => buildGameItemOptions(liveProject), [liveProject]);

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft || !draft.shape) return null;

    return { kind: "placedNpc", layerId, npcId: draft.npcId,
      npc: { npcId: draft.npcId, shape: draft.shape, initialState: draft.initialState, rules: draft.rules },
    };
  }, [draft, layerId]);


  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule, openEditClickRule,
    openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule } = useEntityRulesEditor({
    rules: draft?.rules, onChangeRules: setPlacedNpcDraftRules });

  /* -------------------------------- Colisiones -------------------------------- */
  const collisionResetKey = `${layerId}:${draft?.npcId ?? "none"}`;

  const clickableRegions = useMemo(() =>
      buildClickableRegions({ project: liveProject, hotspots, placedItems, placedNpcs, placedPlayers }),
    [liveProject, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.npcId ? { kind: "npc", id: draft.npcId } : undefined,
    enabled: true,
    isDrawing,
    minRect: DEFAULT_MIN_RECT_01,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedNpcDraftShape(null);
      startRedrawPlacedNpcShape();
    },
  });

  /* ----------------------------- Valores del panel ---------------------------- */
  const initialVisible = draft?.initialState.visible ?? true;
  const initialReachable = draft?.initialState.reachable ?? true;
  const initialNotReachableText = draft?.initialState.notReachableText ?? "";

  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);

  const panelError = editorError?.kind === "panel" ? editorError.message : null;
  const showRulesRequiredError = editorError?.kind === "rules";

  /* -------------------------------- Handlers -------------------------------- */
  const beginPlacedNpcPlacement = (npcId: ID | "") => {
    if (!npcId) {
      toast.warning("Selecciona un PNJ", "Debes seleccionar un PNJ del catálogo.");
      return;
    }

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedNpc({ npcId });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el PNJ.");
  };

  const handleStartAddingPlacedNpc = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogNpcId("");
    setIsCreatingPlacedNpc(true);
  };

  const handleSelectedCatalogNpcIdChange = (npcId: ID | "") => {
    setSelectedCatalogNpcId(npcId);

    if (!npcId) return;
    if (!isCreatingPlacedNpc) return;
    if (isDraftActive) return;

    beginPlacedNpcPlacement(npcId);
  };

  const handleCommit = () => {
    if (!draft) return;

    setEditorError(null);

    if (hasCollisions) {
      setEditorError({ kind: "panel", message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.` });
      return;
    }

    const result = commitPlacedNpcDraft();

    if (!result.ok) {
      toast.error("No se ha podido guardar", result.error ?? "Revisa el PNJ.");
      return;
    }

    if (result.npcId) {
      setSelectedInteractionKind("placedNpc");
      setSelectedInteractionId(result.npcId);
    }

    setEditorError(null);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");

    toast.success("PNJ guardado", "El PNJ ya forma parte de la escena.");
  };

  const handleDelete = (npcId: ID) => {
    removePlacedNpc(npcId, { withConfirmation: true });

    const isSelectedPlacedNpc = selectedInteractionKind === "placedNpc" && selectedInteractionId === npcId;

    if (isSelectedPlacedNpc) clearInteractionSelection();

    const isEditingThisDraft = draft?.npcId === npcId;

    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedNpcDraft();
    }

    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
  };

  const handleEditPlacedNpc = (npcId: ID) => {
    setEditorError(null);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
    setSelectedInteractionKind("placedNpc");
    setSelectedInteractionId(npcId);
    editPlacedNpc(npcId);
  };

  const handleDeleteDraft = () => {
    if (!draft) return;

    handleDelete(draft.npcId);
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");
  };

  const handleCancelDraft = () => {
    setEditorError(null);
    resetCollisionGuard();
    cancelPlacedNpcDraft();
    clearInteractionSelection();
    setIsCreatingPlacedNpc(false);
    setSelectedCatalogNpcId("");

    toast.info("Cancelado", "Has salido del editor de PNJ.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedNpcShape();

    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del PNJ.");
  };

  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setPlacedNpcDraftInitialState({ visible: false, reachable: false, notReachableText: "" });
      return;
    }

    setPlacedNpcDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) {
      setPlacedNpcDraftInitialState({ reachable: true, notReachableText: "" });
      return;
    }

    setPlacedNpcDraftInitialState({ reachable: false });
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
          {!isDraftActive && !isCreatingPlacedNpc ? (
            <InteractiveListPanel
              items={placedNpcListEntries}
              selectedId={selectedId}
              itemTitle="Editar PNJ"
              editTitle="Editar"
              editAriaLabel="Editar PNJ"
              deleteAriaLabel="Eliminar PNJ"
              createLabel="+ Añadir PNJ"
              onCreate={handleStartAddingPlacedNpc}
              onEdit={handleEditPlacedNpc}
              onDelete={handleDelete}
            />
          ) : (
            <PlacedNpcEditorPanel
              draft={draft ?? null}
              selectedCatalogNpcId={selectedCatalogNpcId}
              projectNpcs={projectNpcs}
              onSelectedCatalogNpcIdChange={handleSelectedCatalogNpcIdChange}
              isDrawing={isDrawing}
              hasShape={hasShape}
              isExistingPlacedNpc={isExistingPlacedNpc}
              hasCollisions={hasCollisions}
              collisionSummary={collisionSummary}
              collisionLock={collisionLock}
              disableAllEditorFields={disableAllEditorFields}
              disableReachable={disableReachable}
              disableNotReachableText={disableNotReachableText}
              initialVisible={initialVisible}
              initialReachable={initialReachable}
              initialNotReachableText={initialNotReachableText}
              notReachableInputRef={notReachableInputRef}
              onNpcChange={setPlacedNpcDraftNpcId}
              onStartRedrawShape={handleStartRedrawShape}
              onVisibleChange={handleVisibleChange}
              onReachableChange={handleReachableChange}
              onNotReachableTextChange={(value) => setPlacedNpcDraftInitialState({ notReachableText: value })}
              owner={owner}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              clickRules={clickRules}
              useItemRulesForSelected={useItemRulesForSelected}
              ruleModalOpen={ruleModalOpen}
              currentRuleValue={currentRuleValue}
              nodeId={nodeId}
              project={liveProject}
              onOpenAddClickRule={openAddClickRule}
              onOpenEditClickRule={openEditClickRule}
              onRemoveClickRule={(index) => {
                removeClickRule(index);
                toast.success("Regla eliminada", "Se ha eliminado la regla.");
              }}
              onOpenAddUseItemRule={openAddUseItemRule}
              onOpenEditUseItemRule={openEditUseItemRule}
              onRemoveUseItemRule={(itemId, index) => {
                removeUseItemRule(itemId, index);
                toast.success("Regla eliminada", "Se ha eliminado la regla.");
              }}
              onCloseRuleModal={closeRuleModal}
              onSaveRule={(rule: { id: ID; when?: Condition; effects: Effect[] }) => saveRule(rule)}
              panelError={panelError}
              showRulesRequiredError={showRulesRequiredError}
              useItemSourceOptions={useItemSourceOptions}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          )}
        </div>
      </ToggleFieldBlock>
  );
}