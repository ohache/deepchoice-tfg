import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, ID, ItemDef, ItemInstance, PlacedNpc, PlacedPlayer, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared"; 
import { useEditorStore } from "@/store/editorStore";
import { PlacedItemEditorPanel } from "@/features/editor/scene/placedItems/PlacedItemEditorPanel";
import { InteractiveListPanel, type InteractiveListEntry } from "@/features/editor/scene/interactiveComponents/InteractiveListPanel";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { useEntityCollisionGuard } from "@/features/editor/scene/useEntityCollisionGuard";
import { DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";
import { buildClickableRegions, buildProjectWithNodeDraft, useActiveSceneLayer, useFocusWhenEnabled } from "@/features/editor/scene/interactiveComponents/interactiveFieldHelpers";
import { buildGameItemOptions } from "@/features/editor/scene/interactiveComponents/gameItemOptions";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";
import { toast } from "@/shared/toast/toastStore";


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

export function ScenePlacedItemField({ label = "Objetos", active, onToggle, layerId }: ScenePlacedItemFieldProps) {
  const project = useEditorStore((state) => state.project ?? null);
  const nodeDraft = useEditorStore((state) => state.nodeDraft);

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayerId = useEditorStore((state) => state.setActiveLayerId);

  const placedItemEditor = useEditorStore((state) => state.placedItemEditor);

  const startPlacingPlacedItem = useEditorStore((state) => state.startPlacingPlacedItem);
  const startRedrawPlacedItemShape = useEditorStore((state) => state.startRedrawPlacedItemShape);
  const editPlacedItem = useEditorStore((state) => state.editPlacedItem);
  const cancelPlacedItemDraft = useEditorStore((state) => state.cancelPlacedItemDraft);

  const setPlacedItemDraftItemId = useEditorStore((state) => state.setPlacedItemDraftItemId);
  const setPlacedItemDraftLabel = useEditorStore((state) => state.setPlacedItemDraftLabel);
  const setPlacedItemDraftInitialState = useEditorStore((state) => state.setPlacedItemDraftInitialState);
  const setPlacedItemDraftRules = useEditorStore((state) => state.setPlacedItemDraftRules);
  const setPlacedItemDraftShape = useEditorStore((state) => state.setPlacedItemDraftShape);
  const commitPlacedItemDraft = useEditorStore((state) => state.commitPlacedItemDraft);

  const removePlacedItem = useEditorStore((state) => state.removePlacedItem);

  const selectedInteractionKind = useEditorStore((state) => state.selectedInteractionKind);
  const selectedInteractionId = useEditorStore((state) => state.selectedInteractionId);
  const setSelectedInteractionKind = useEditorStore((state) => state.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((state) => state.setSelectedInteractionId);
  const clearInteractionSelection = useEditorStore((state) => state.clearInteractionSelection);

  const [selectedCatalogItemId, setSelectedCatalogItemId] = useState<ID | "">("");
  const [isCreatingPlacedItem, setIsCreatingPlacedItem] = useState(false);
  const [editorError, setEditorError] = useState<PlacedItemEditorError>(null);

  const notReachableInputRef = useRef<HTMLInputElement | null>(null);

  /* ---------------------------- Datos del proyecto --------------------------- */
  const effectiveProject = useMemo(() => buildProjectWithNodeDraft(project, nodeDraft), [project, nodeDraft]);

  const projectItems = useMemo<ItemDef[]>(() => effectiveProject?.items ?? [], [effectiveProject?.items]);

  useEffect(() => {
    if (!projectItems.length) {
      setSelectedCatalogItemId("");
      return;
    }

    if (!selectedCatalogItemId) return;

    const exists = projectItems.some((item) => item.id === selectedCatalogItemId);
    if (!exists) setSelectedCatalogItemId("");
  }, [projectItems, selectedCatalogItemId]);

  /* ------------------------------- Capa activa ------------------------------- */
  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const { layer } = useActiveSceneLayer({ active, layerId, activeLayerId, setActiveLayerId, layers });

  const nodeId = nodeDraft?.id ?? "";

  /* ---------------------------- Entidades de la capa --------------------------- */
  const hotspots = useMemo<Hotspot[]>(() => layer?.hotspots ?? [], [layer?.hotspots]);

  const placedItems = useMemo<ItemInstance[]>(() => layer?.placedItems ?? [], [layer?.placedItems]);

  const placedNpcs = useMemo<PlacedNpc[]>(() => layer?.placedNpcs ?? [], [layer?.placedNpcs]);

  const placedPlayers = useMemo<PlacedPlayer[]>(() => layer?.placedPlayers ?? [], [layer?.placedPlayers]);

  /* ------------------------------ Estado del draft ---------------------------- */
  const draft = placedItemEditor.draft;
  const isDrawing = placedItemEditor.mode.type === "drawing";
  const isDraftActive = placedItemEditor.mode.type !== "idle";

  const draftItemInstanceId = draft?.itemInstanceId ?? null;
  const draftShape = draft?.placement?.shape ?? null;
  const draftInitialState = draft?.placement?.initialState;

  /* ------------------------------- Derivados UI ------------------------------- */
  const selectedId = selectedInteractionKind === "placedItem" ? selectedInteractionId : null;

  const dupLabel = useMemo(() => {
    if (!effectiveProject || !draft) return false;

    return hasDuplicatedItemInstanceLabel(effectiveProject, draft.label, draft.itemInstanceId);
  }, [effectiveProject, draft]);

  const isExistingPlacedItem = useMemo(() => {
    if (!draftItemInstanceId) return false;

    return placedItems.some((placedItem) => placedItem.itemInstanceId === draftItemInstanceId);
  }, [draftItemInstanceId, placedItems]);

  const placedItemListEntries = useMemo<InteractiveListEntry[]>(() =>
      placedItems.map((placedItem) => ({ id: placedItem.itemInstanceId, label: placedItem.label })),
    [placedItems],
  );

  /* --------------------------- Reglas / owner / items ------------------------- */
  const useItemSourceOptions = useMemo(() => buildGameItemOptions(effectiveProject, draftItemInstanceId ?? undefined),
    [effectiveProject, draftItemInstanceId],
  );

  const owner = useMemo<EffectOwner | null>(() => {
    if (!draft || !draftShape || !draftInitialState) return null;

    return { kind: "placedItem", layerId, itemInstanceId: draft.itemInstanceId,
      item: { itemInstanceId: draft.itemInstanceId, itemId: draft.itemId, label: draft.label, rules: draft.rules,
        placement: { shape: draftShape, initialState: draftInitialState },
      },
    };
  }, [draft, draftShape, draftInitialState, layerId]);

  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule, openEditClickRule,
    openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule } = useEntityRulesEditor({
    rules: draft?.rules, onChangeRules: setPlacedItemDraftRules });

  /* -------------------------------- Colisiones -------------------------------- */
  const collisionResetKey = `${layerId}:${draftItemInstanceId ?? "none"}`;

  const clickableRegions = useMemo(() =>
      buildClickableRegions({ project: effectiveProject, hotspots, placedItems, placedNpcs, placedPlayers }),
    [effectiveProject, hotspots, placedItems, placedNpcs, placedPlayers],
  );

  const { hasShape, hasCollisions, collisionSummary, collisionLock, resetCollisionGuard } = useEntityCollisionGuard({
    shape: draftShape,
    clickableRegions,
    ignore: draftItemInstanceId ? { kind: "item", id: draftItemInstanceId } : undefined,
    enabled: true,
    isDrawing,
    minRect: DEFAULT_MIN_RECT_01,
    resetKey: collisionResetKey,
    onRejectShape: () => {
      setPlacedItemDraftShape(null);
      startRedrawPlacedItemShape();
    },
  });

  /* ----------------------------- Valores del panel ---------------------------- */
  const canFocusLabelNow = hasShape && !hasCollisions;
  const labelInputRef = useFocusWhenEnabled<HTMLInputElement>(canFocusLabelNow);

  const hasLabel = Boolean((draft?.label ?? "").trim());

  const initialVisible = draftInitialState?.visible ?? true;
  const initialReachable = draftInitialState?.reachable ?? true;
  const initialNotReachableText = draftInitialState?.notReachableText ?? "";

  const disableAllEditorFields = Boolean(draft) && !hasShape;
  const disableRulesEditor = disableAllEditorFields || dupLabel;
  const disableReachable = disableAllEditorFields || !initialVisible;
  const disableNotReachableText = disableAllEditorFields || !initialVisible || initialReachable;

  const panelError = editorError?.kind === "panel" ? editorError.message : null;

  /* -------------------------------- Handlers -------------------------------- */
  const beginPlacedItemPlacement = (itemId: ID | "") => {
    if (!itemId) {
      toast.warning("Selecciona un objeto", "Debes seleccionar un objeto del catálogo.");
      return;
    }

    const selectedItem = projectItems.find((item) => item.id === itemId) ?? null;
    const initialLabel = selectedItem?.name?.trim() || "Objeto";

    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();

    startPlacingPlacedItem({ itemId, label: initialLabel });

    toast.info("Dibuja una región", "Arrastra sobre la imagen de la derecha para definir el objeto.");
  };

  const handleStartAddingPlacedItem = () => {
    setEditorError(null);
    resetCollisionGuard();
    clearInteractionSelection();
    setSelectedCatalogItemId("");
    setIsCreatingPlacedItem(true);
  };

  const handleSelectedCatalogItemIdChange = (itemId: ID | "") => {
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
      setEditorError({ kind: "panel", message: "El objeto debe tener una etiqueta antes de guardarse." });
      return;
    }

    if (dupLabel) {
      toast.warning("Etiqueta duplicada", "Ya existe un objeto con esa etiqueta en la aventura.");
      return;
    }

    if (hasCollisions) {
      setEditorError({ kind: "panel", message: `Colisión con: ${collisionSummary}. Ajusta la región para que no se solape.` });
      return;
    }

    const result = commitPlacedItemDraft();

    if (!result.ok) {
      if ((result.error ?? "").toLowerCase().includes("additem")) {
        setEditorError({ kind: "pickupRule" });
      }

      toast.error("No se ha podido guardar", result.error ?? "Revisa el objeto.");
      return;
    }

    if (result.placedItemId) {
      setSelectedInteractionKind("placedItem");
      setSelectedInteractionId(result.placedItemId);
    }

    setEditorError(null);
    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");

    toast.success("Objeto guardado", "El objeto ya forma parte de la escena.");
  };

  const handleDelete = (id: ID) => {
    removePlacedItem(id, { withConfirmation: true });

    const isSelectedPlacedItem = selectedInteractionKind === "placedItem" && selectedInteractionId === id;

    if (isSelectedPlacedItem) clearInteractionSelection();

    const isEditingThisDraft = draft?.itemInstanceId === id;

    if (isEditingThisDraft) {
      resetCollisionGuard();
      cancelPlacedItemDraft();
    }

    setIsCreatingPlacedItem(false);
    setSelectedCatalogItemId("");

    toast.success("Objeto eliminado", "Se ha eliminado correctamente.");
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

    handleDelete(draft.itemInstanceId);
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

    toast.info("Cancelado", "Has salido del editor de objeto.");
  };

  const handleStartRedrawShape = () => {
    setEditorError(null);
    resetCollisionGuard();
    startRedrawPlacedItemShape();

    toast.info("Redibuja la región", "Arrastra sobre la imagen para actualizar el área del objeto.");
  };

  const handleVisibleChange = (checked: boolean) => {
    if (!checked) {
      setPlacedItemDraftInitialState({ visible: false, reachable: false, notReachableText: "" });
      return;
    }

    setPlacedItemDraftInitialState({ visible: true });
  };

  const handleReachableChange = (checked: boolean) => {
    if (checked) {
      setPlacedItemDraftInitialState({ reachable: true, notReachableText: "" });
      return;
    }

    setPlacedItemDraftInitialState({ reachable: false });
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
              useItemSourceOptions={useItemSourceOptions}
              onDelete={handleDeleteDraft}
              onCancel={handleCancelDraft}
              onCommit={handleCommit}
            />
          ) : (
            <InteractiveListPanel
              items={placedItemListEntries}
              selectedId={selectedId}
              itemTitle="Editar objeto"
              editTitle="Editar"
              editAriaLabel="Editar objeto"
              deleteAriaLabel="Eliminar objeto"
              createLabel="+ Añadir objeto"
              onCreate={handleStartAddingPlacedItem}
              onEdit={handleEditPlacedItem}
              onDelete={handleDelete}
            />
          )}
        </div>
      </ToggleFieldBlock>
  );
}