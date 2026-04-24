import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, ID, ItemDef, PlacedItem, PlacedNpc, PlacedPlayer, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { toast } from "@/shared/toast/toastStore";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { PlacedItemEditorPanel } from "@/features/editor/scene/placedItems/PlacedItemEditorPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { buildClickableRegions, normKey, useActiveSceneLayer, useFocusWhenEnabled } from "@/features/editor/scene/interactiveComponents/fieldHelpers";

type PlacedItemEditorError =
  | { kind: "panel"; message: string }
  | { kind: "pickupRule" }
  | null;

type ScenePlacedItemFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId: ID;
};

function buildProjectWithNodeDraft( project: NonNullable<ReturnType<typeof useEditorStore.getState>["project"]> | null,
  nodeDraft: NonNullable<ReturnType<typeof useEditorStore.getState>["nodeDraft"]> | null,
) {
  if (!project) return null;
  if (!nodeDraft) return project;

  const nextNodes = [...(project.nodes ?? [])];
  const nodeIndex = nextNodes.findIndex((node) => node.id === nodeDraft.id);

  if (nodeIndex >= 0) nextNodes[nodeIndex] = nodeDraft;
  else nextNodes.push(nodeDraft);

  return {
    ...project,
    nodes: nextNodes,
  };
}

export function ScenePlacedItemField({ label = "Items", active, onToggle, layerId }: ScenePlacedItemFieldProps) {
  const project = useEditorStore((state) => state.project ?? null);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayerId = useEditorStore((state) => state.setActiveLayerId);

  const placedItemEditor = useEditorStore((state) => state.placedItemEditor);

  const startRedrawPlacedItemShape = useEditorStore((state) => state.startRedrawPlacedItemShape);
  const startPlacingPlacedItem = useEditorStore((state) => state.startPlacingPlacedItem);
  const editPlacedItem = useEditorStore((state) => state.editPlacedItem);
  const cancelPlacedItemDraft = useEditorStore((state) => state.cancelPlacedItemDraft);

  const setPlacedItemDraftLabel = useEditorStore((state) => state.setPlacedItemDraftLabel);
  const setPlacedItemDraftItemId = useEditorStore((state) => state.setPlacedItemDraftItemId);
  const setPlacedItemDraftInitialState = useEditorStore((state) => state.setPlacedItemDraftInitialState);
  const setPlacedItemDraftRules = useEditorStore((state) => state.setPlacedItemDraftRules);
  const setPlacedItemDraftShape = useEditorStore((state) => state.setPlacedItemDraftShape);
  const commitPlacedItemDraft = useEditorStore((state) => state.commitPlacedItemDraft);

  const removePlacedItem = useEditorStore((state) => state.removePlacedItem);
  const setActivePlacedItems = useEditorStore((state) => state.setActivePlacedItems);

  const selectedInteractionKind = useEditorStore((state) => state.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((state) => state.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((state) => state.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((state) => state.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((state) => state.clearInteractionSelection);

  const effectiveProject = useMemo(() => buildProjectWithNodeDraft(project, nodeDraft), [project, nodeDraft]);

  const projectItems = useMemo<ItemDef[]>(() => effectiveProject?.items ?? [], [effectiveProject?.items]);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>("");
  const [isCreatingPlacedItem, setIsCreatingPlacedItem] = useState(false);

  useEffect(() => {
    if (!projectItems.length) {
      setSelectedCatalogItemId("");
      return;
    }

    if (!selectedCatalogItemId) return;

    const exists = projectItems.some((item) => item.id === selectedCatalogItemId);
    if (!exists) setSelectedCatalogItemId("");
  }, [projectItems, selectedCatalogItemId]);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const nodeId = nodeDraft?.id ?? "";

  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);
  const placedItems = useMemo<PlacedItem[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  const selectedId = selectedInteractionKind === "placedItem" ? selectedInteractionId : null;

  const draft = placedItemEditor.draft;
  const isDrawing = placedItemEditor.mode.type === "drawing";
  const isDraftActive = placedItemEditor.mode.type !== "idle";

  const collisionResetKey = `${layerId}:${draft?.id ?? "none"}:${placedItemEditor.mode.type}`;

  const useItemSourceOptions = useMemo(() => {
    const allPlacedItems = effectiveProject?.nodes?.flatMap((node) =>
        (node.layers ?? []).flatMap((sceneLayer) => sceneLayer.placedItems ?? [])) ?? [];

    return allPlacedItems.filter((placedItem) => !draft || placedItem.id !== draft.id)
      .map((placedItem) => ({ id: placedItem.id, label: placedItem.label?.trim() || placedItem.id }));
  }, [effectiveProject, draft]);

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft || !draft.shape) return null;

    return { kind: "placedItem", layerId, placedItemId: draft.id,
      item: { id: draft.id, itemId: draft.itemId, label: draft.label,
        shape: draft.shape, initialState: draft.initialState, rules: draft.rules }};
  }, [draft, layerId]);

  const labelKey = normKey(draft?.label);

  const dupLabel = useMemo(() => {
    if (!draft || !labelKey) return false;

    return (
      effectiveProject?.nodes.some((node) =>
        node.layers.some((sceneLayer) =>
          (sceneLayer.placedItems ?? []).some((item) => {
            if (item.id === draft.id) return false;
            return normKey(item.label) === labelKey;
          }),
        ),
      ) ?? false
    );
  }, [draft, labelKey, effectiveProject?.nodes]);

  const isExistingPlacedItem = useMemo(() => {
    if (!draft?.id) return false;
    return placedItems.some((placedItem) => placedItem.id === draft.id);
  }, [draft?.id, placedItems]);


  const clickableRegions = useMemo(() =>
      buildClickableRegions({ project: effectiveProject, hotspots, placedItems, placedNpcs, placedPlayers }),
    [effectiveProject, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draft?.shape,
    clickableRegions,
    ignore: draft?.id ? { kind: "item", id: draft.id } : undefined,
    enabled: true,
    isDrawing,
    minRect: 0.02,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedItemDraftShape(null);
      startRedrawPlacedItemShape();
    },
    onCollision: (summary) => {
      setEditorError({ kind: "panel", message: `Colisión con: ${summary}. Dibuja otra región o pulsa “Cancelar”.` });
    },
  });

  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [editorError, setEditorError] = useState<PlacedItemEditorError>(null);

  const canFocusLabelNow = hasShape && !hasCollisions;
  const labelInputRef = useFocusWhenEnabled<HTMLInputElement>(canFocusLabelNow);

  const hasLabel = Boolean((draft?.label ?? "").trim());

  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule,
    openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule,
  } = useEntityRulesEditor({ rules: draft?.rules, onChangeRules: setPlacedItemDraftRules });

  const placedItemListEntries = useMemo<InteractiveListEntry[]>(() =>
      placedItems.map((placedItem) => ({ id: placedItem.id, label: placedItem.label })),
    [placedItems],
  );

  const beginPlacedItemPlacement = (itemId: string) => {
    if (!itemId) {
      toast.warning("Selecciona un item", "Debes seleccionar un item del catálogo.");
      return;
    }

    const selectedItem = projectItems.find((item) => item.id === itemId) ?? null;
    const initialLabel = selectedItem?.name?.trim() || "Item";

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedItem({ itemId, label: initialLabel });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el item.");
  };

  const handleStartAddingPlacedItem = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogItemId("");
    setIsCreatingPlacedItem(true);
  };

  const handleSelectedCatalogItemIdChange = (itemId: string) => {
    setSelectedCatalogItemId(itemId);

    if (!itemId) return;
    if (!isCreatingPlacedItem) return;
    if (isDraftActive) return;

    beginPlacedItemPlacement(itemId);
  };

  const handleCommit = () => {
    if (!draft) return;

    setEditorError(null);

    if (!hasLabel) {
      setEditorError({ kind: "panel", message: "El item debe tener una etiqueta antes de guardarse." });
      return;
    }

    if (dupLabel) {
      toast.warning("Etiqueta duplicada", "Ya existe un item con esa etiqueta en la aventura.");
      return;
    }

    if (hasCollisions) {
      setEditorError({ kind: "panel", message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.` });
      return;
    }

    const result = commitPlacedItemDraft();

    if (!result.ok) {
      if ((result.error ?? "").toLowerCase().includes("additem")) setEditorError({ kind: "pickupRule" });

      toast.error("No se ha podido guardar", result.error ?? "Revisa el item.");
      return;
    }

    if (result.placedItemId) {
      setSelectedInteractionKind("placedItem");
      setSelectedInteractionId(result.placedItemId);
    }

    setEditorError(null);
    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");

    toast.success("Item guardado", "El item ya forma parte de la escena.");
  };

  const handleDelete = (id: ID) => {
    removePlacedItem(id);

    const isSelectedPlacedItem =
      selectedInteractionKind === "placedItem" && selectedInteractionId === id;

    if (isSelectedPlacedItem) clearInteractionSelection();

    const isEditingThisDraft = draft?.id === id;
    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedItemDraft();
    }

    toast.success("Item eliminado", "Se ha eliminado correctamente.");
  };

  const handleAskNukeAll = () => {
    if (!placedItems.length) return;
    setConfirmNukeOpen(true);
  };

  const handleConfirmNukeAll = () => {
    setConfirmNukeOpen(false);
    setActivePlacedItems([]);
    clearInteractionSelection();

    if (draft) {
      resetCollisionGuard();
      cancelPlacedItemDraft();
    }

    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");

    toast.success("Items borrados", "Se han eliminado todos los items de esta capa.");
  };

  const handleEditPlacedItem = (placedItemId: ID) => {
    setEditorError(null);
    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");
    setSelectedInteractionKind("placedItem");
    setSelectedInteractionId(placedItemId);
    editPlacedItem(placedItemId);
  };

  const handleDeleteDraft = () => {
    if (!draft) return;
    handleDelete(draft.id);
    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");
  };

  const handleCancelDraft = () => {
    setEditorError(null);
    resetCollisionGuard();
    cancelPlacedItemDraft();
    clearInteractionSelection();
    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");
    toast.info("Cancelado", "Has salido del editor de item.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedItemShape();
    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del item.");
  };

  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setPlacedItemDraftInitialState({ visible: false, reachable: false, notReachableText: "" });
      return;
    }

    setPlacedItemDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) setPlacedItemDraftInitialState({ reachable: true, notReachableText: "" });
    else setPlacedItemDraftInitialState({ reachable: false });
  };

  const initialVisible = draft?.initialState.visible ?? true;
  const initialReachable = draft?.initialState.reachable ?? true;
  const initialNotReachableText = draft?.initialState.notReachableText ?? "";

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);

  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const disableRulesEditor = disableAllEditorFields || dupLabel;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;

  const panelError = editorError?.kind === "panel" ? editorError.message : null;
  const showPickupRuleRequiredError = editorError?.kind === "pickupRule";

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
    <>
      <ConfirmDangerModal
        open={confirmNukeOpen}
        title="Borrar todos los items"
        description="Esta acción no se puede deshacer. ¿Quieres eliminar todos los items de esta capa?"
        confirmText="Sí, borrar todos"
        cancelText="Cancelar"
        onConfirm={handleConfirmNukeAll}
        onCancel={() => setConfirmNukeOpen(false)}
      />

      <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
        <div className="space-y-3">
          {isDraftActive || isCreatingPlacedItem ? (
            <PlacedItemEditorPanel
              draft={draft ?? null}
              selectedCatalogItemId={selectedCatalogItemId}
              projectItems={projectItems}
              onSelectedCatalogItemIdChange={handleSelectedCatalogItemIdChange}
              isDrawing={isDrawing}
              hasShape={hasShape}
              isExistingPlacedItem={isExistingPlacedItem}
              dupLabel={dupLabel}
              hasCollisions={hasCollisions}
              collisionSummary={collisionSummary}
              collisionLock={collisionLock}
              disableAllEditorFields={disableAllEditorFields}
              disableReachable={disableReachable}
              disableNotReachableText={disableNotReachableText}
              disableRulesEditor={disableRulesEditor}
              initialVisible={initialVisible}
              initialReachable={initialReachable}
              initialNotReachableText={initialNotReachableText}
              labelInputRef={labelInputRef}
              notReachableInputRef={notReachableInputRef}
              onItemChange={(itemId) => {setPlacedItemDraftItemId(itemId)}}
              onLabelChange={setPlacedItemDraftLabel}
              onStartRedrawShape={handleStartRedrawShape}
              onVisibleChange={handleVisibleChange}
              onReachableChange={handleReachableChange}
              onNotReachableTextChange={(value) => setPlacedItemDraftInitialState({ notReachableText: value })}
              owner={owner}
              activeChannel={activeChannel}
              setActiveChannel={setActiveChannel}
              clickRules={clickRules}
              useItemRulesForSelected={useItemRulesForSelected}
              ruleModalOpen={ruleModalOpen}
              currentRuleValue={currentRuleValue}
              nodeId={nodeId}
              project={effectiveProject}
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
              showPickupRuleRequiredError={showPickupRuleRequiredError}
              useItemSourceOptions={useItemSourceOptions}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          ) : (
            <InteractiveListPanel
              items={placedItemListEntries}
              selectedId={selectedId}
              itemTitle="Editar item"
              editTitle="Editar"
              editAriaLabel="Editar item"
              deleteAriaLabel="Eliminar item"
              createLabel="+ Añadir item"
              onCreate={handleStartAddingPlacedItem}
              onEdit={handleEditPlacedItem}
              onDelete={handleDelete}
              onDeleteAll={handleAskNukeAll}
            />
          )}
        </div>
      </ToggleFieldBlock>
    </>
  );
}