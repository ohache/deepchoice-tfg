import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer, Hotspot, PlacedItem, PlacedNpc, PlacedPlayer, ItemDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import type { Effect } from "@/domain/effects";
import { toast } from "@/shared/toast/toastStore";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { PlacedItemListPanel, type PlacedItemListEntry } from "@/features/editor/scene/placedItems/PlacedItemListPanel";
import { PlacedItemEditorPanel } from "@/features/editor/scene/placedItems/PlacedItemEditorPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import type { Condition } from "@/domain/conditions";
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

export function ScenePlacedItemField({ label = "Items", active, onToggle, layerId }: ScenePlacedItemFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const placedItemEditor = useEditorStore((s) => s.placedItemEditor);

  const startRedrawPlacedItemShape = useEditorStore((s) => s.startRedrawPlacedItemShape);
  const startPlacingPlacedItem = useEditorStore((s) => s.startPlacingPlacedItem);
  const editPlacedItem = useEditorStore((s) => s.editPlacedItem);
  const cancelPlacedItemDraft = useEditorStore((s) => s.cancelPlacedItemDraft);

  const setPlacedItemDraftLabel = useEditorStore((s) => s.setPlacedItemDraftLabel);
  const setPlacedItemDraftInitialState = useEditorStore((s) => s.setPlacedItemDraftInitialState);
  const setPlacedItemDraftRules = useEditorStore((s) => s.setPlacedItemDraftRules);
  const setPlacedItemDraftShape = useEditorStore((s) => s.setPlacedItemDraftShape);
  const commitPlacedItemDraft = useEditorStore((s) => s.commitPlacedItemDraft);
  
  const removePlacedItem = useEditorStore((s) => s.removePlacedItem);
  const setActivePlacedItems = useEditorStore((s) => s.setActivePlacedItems);

  const selectedInteractionKind = useEditorStore((s) => s.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((s) => s.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((s) => s.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((s) => s.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((s) => s.clearInteractionSelection);

  const setPlacedItemDraftItemId = useEditorStore((s) => s.setPlacedItemDraftItemId);

  const projectItems = useMemo<ItemDef[]>(() => project?.items ?? [], [project?.items]);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<string>("");
  const [isCreatingPlacedItem, setIsCreatingPlacedItem] = useState(false);

  useEffect(() => {
    if (!projectItems.length) {
      setSelectedCatalogItemId("");
      return;
    }

    if (selectedCatalogItemId === "") return;

    const exists = projectItems.some((it) => it.id === selectedCatalogItemId);
    if (!exists) setSelectedCatalogItemId("");
  }, [projectItems, selectedCatalogItemId]);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({
    active,
    layerId,
    activeLayerId,
    setActiveLayerId,
    layers,
  });

  const nodeId = nodeDraft?.id ?? ("" as ID);

  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);
  const placedItems = useMemo<PlacedItem[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);
  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);
  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  const selectedId = selectedInteractionKind === "placedItem" ? selectedInteractionId : null;

  const draft = placedItemEditor.draft;
const isDrawing = placedItemEditor.mode.type === "drawing";
const isDraftActive = placedItemEditor.mode.type !== "idle";

  const collisionResetKey = `${layerId}:${draft?.id ?? "none"}:${placedItemEditor.mode.type}`;

  const useItemSourceOptions = useMemo(
    () =>
      placedItems
        .filter((p) => !draft || p.id !== draft.id)
        .map((p) => ({
          id: p.id,
          label: p.label?.trim() || p.id,
        })),
    [placedItems, draft],
  );

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft || !draft.shape) return null;

    return {
      kind: "placedItem",
      layerId,
      placedItemId: draft.id,
      item: {
        id: draft.id,
        itemId: draft.itemId,
        label: draft.label,
        shape: draft.shape,
        initialState: draft.initialState,
        rules: draft.rules,
      },
    };
  }, [draft, layerId]);

  const labelKey = normKey(draft?.label);

  const dupLabel = useMemo(() => {
    if (!draft || !labelKey) return false;

    return project?.nodes.some((node) =>
      node.layers.some((layer) =>
        (layer.placedItems ?? []).some((item) => {
          if (item.id === draft.id) return false;
          return normKey(item.label) === labelKey;
        })
      )
    ) ?? false;
  }, [draft, labelKey, project?.nodes]);

  const isExistingPlacedItem = useMemo(() => {
    if (!draft?.id) return false;
    return placedItems.some((p) => p.id === draft.id);
  }, [draft?.id, placedItems]);

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

  const {
    hasShape,
    hasCollisions,
    collisionSummary,
    collisionLock,
    resetCollisionGuard,
  } = useEntityCollisionGuard({
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
      setEditorError({
        kind: "panel",
        message: `Colisión con: ${summary}. Dibuja otra región o pulsa “Cancelar”.`,
      });
    },
  });

  const [confirmNukeOpen, setConfirmNukeOpen] = useState(false);
  const [editorError, setEditorError] = useState<PlacedItemEditorError>(null);

  const canFocusLabelNow = hasShape && !hasCollisions;
  const labelInputRef = useFocusWhenEnabled<HTMLInputElement>(canFocusLabelNow);

  const hasLabel = Boolean((draft?.label ?? "").trim());

  const {
    activeChannel,
    setActiveChannel,
    clickRules,
    useItemRulesForSelected,
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
  } = useEntityRulesEditor({
    rules: draft?.rules,
    onChangeRules: setPlacedItemDraftRules,
  });

  const placedItemListEntries = useMemo<PlacedItemListEntry[]>(
    () =>
      placedItems.map((p) => ({
        id: p.id,
        label: p.label,
      })),
    [placedItems],
  );

  const beginPlacedItemPlacement = (itemId: string) => {
    if (!itemId) {
      toast.warning("Selecciona un item", "Debes seleccionar un item del catálogo.");
      return;
    }

    const selectedItem = projectItems.find((it) => it.id === itemId) ?? null;
    const initialLabel = selectedItem?.name?.trim() || "Item";

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedItem({
      itemId,
      label: initialLabel,
    });

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
    setEditorError({
      kind: "panel",
      message: "El item debe tener una etiqueta antes de guardarse.",
    });
    return;
  }

  if (dupLabel) {
    toast.warning("Etiqueta duplicada", "Ya existe un item con esa etiqueta en la aventura.");
    return;
  }

  if (hasCollisions) {
    setEditorError({
      kind: "panel",
      message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.`,
    });
    return;
  }

  const result = commitPlacedItemDraft();

  if (!result.ok) {
    if ((result.error ?? "").toLowerCase().includes("additem")) {
      setEditorError({ kind: "pickupRule" });
    }
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
      setPlacedItemDraftInitialState({
        visible: false,
        reachable: false,
        notReachableText: "",
      });
      return;
    }
    setPlacedItemDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) {
      setPlacedItemDraftInitialState({
        reachable: true,
        notReachableText: "",
      });
    } else {
      setPlacedItemDraftInitialState({ reachable: false });
    }
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
              onItemChange={(itemId) => {
                setPlacedItemDraftItemId(itemId);
              }}
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
              project={project}
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
            <>
              <div className="flex justify-center">
                <button
                  type="button"
                  className="btn btn-create-condition mt-2"
                  onClick={handleStartAddingPlacedItem}
                  title="Añadir item"
                >
                  + Añadir item
                </button>
              </div>

              <PlacedItemListPanel
                placedItems={placedItemListEntries}
                selectedId={selectedId}
                onEdit={handleEditPlacedItem}
                onDelete={handleDelete}
                onDeleteAll={handleAskNukeAll}
              />
            </>
          )}
        </div>
      </ToggleFieldBlock>
    </>
  );
}