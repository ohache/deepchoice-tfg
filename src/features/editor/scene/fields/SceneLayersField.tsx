import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer } from "@/domain/types";
import { type Condition } from "@/domain/conditions";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { SceneVariantLabelField } from "@/features/editor/scene/fields/SceneVariantLabelField";
import { SceneImageField } from "@/features/editor/scene/fields/SceneImageField";
import { SceneTextField } from "@/features/editor/scene/fields/SceneTextField";
import { SceneHotspotField } from "@/features/editor/scene/hotspots/SceneHotspotField";
import { ScenePlacedItemField } from "@/features/editor/scene/placedItems/ScenePlacedItemField";
import { ScenePlacedPlayerField } from "@/features/editor/scene/placedPlayers/ScenePlacedPlayerField";
import { ScenePlacedNpcField } from "@/features/editor/scene/placedNpcs/ScenePlacedNpcField";
import { SceneMusicField } from "@/features/editor/scene/music/SceneMusicField";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { SceneVariantList } from "@/components/SceneVariantsSection";
import { buildVariantItems, cloneLayer, emptyCondition, findLayerById, getPendingField, hasDuplicateLayerLabel, hasRealLayerCondition,
  isBaseLayer, layerSnapshotPatch, pendingTargetExists, sameId } from "@/features/editor/scene/fields/layerHelpers";
import { isEmptyCondition } from "@/shared/helpers";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { commitActiveInteractiveDrafts } from "@/features/editor/scene/interactiveComponents/interactiveDraftGuards";
import { toast } from "@/shared/toast/toastStore";

type SceneLayersFieldProps = {
  active: boolean;
  onToggle: () => void;
  onTextPreview?: (text: string | null) => void;
  onClearTextPreview?: () => void;
};

export function SceneLayersField({ active, onToggle, onTextPreview, onClearTextPreview }: SceneLayersFieldProps) {
  const nodeDraft = useEditorStore((state) => state.nodeDraft);
  const project = useEditorStore((state) => state.project);

  const removeBackgroundAsset = useEditorStore((state) => state.removeBackgroundAsset);

  const activeLayerId = useEditorStore((state) => state.activeLayerId);
  const setActiveLayerId = useEditorStore((state) => state.setActiveLayerId);

  const layerEditSession = useEditorStore((state) => state.layerEditSession);
  const setLayerEditSession = useEditorStore((state) => state.setLayerEditSession);
  const clearLayerEditSession = useEditorStore((state) => state.clearLayerEditSession);

  const activeLayerField = useEditorStore((state) => state.activeLayerField);
  const setActiveLayerField = useEditorStore((state) => state.setActiveLayerField);

  const addNodeLayer = useEditorStore((state) => state.addNodeLayer);
  const updateNodeLayer = useEditorStore((state) => state.updateNodeLayer);
  const removeNodeLayer = useEditorStore((state) => state.removeNodeLayer);
  const reorderNodeLayers = useEditorStore((state) => state.reorderNodeLayers);

  const setLayerLabel = useEditorStore((state) => state.setLayerLabel);
  const setLayerAssetId = useEditorStore((state) => state.setLayerAssetId);
  const setLayerDock = useEditorStore((state) => state.setLayerDock);

  const hotspotEditor = useEditorStore((state) => state.hotspotEditor);
  const placedItemEditor = useEditorStore((state) => state.placedItemEditor);
  const placedNpcEditor = useEditorStore((state) => state.placedNpcEditor);
  const placedPlayerEditor = useEditorStore((state) => state.placedPlayerEditor);

  const commitHotspotDraft = useEditorStore((state) => state.commitHotspotDraft);
  const commitPlacedItemDraft = useEditorStore((state) => state.commitPlacedItemDraft);
  const commitPlacedNpcDraft = useEditorStore((state) => state.commitPlacedNpcDraft);
  const commitPlacedPlayerDraft = useEditorStore((state) => state.commitPlacedPlayerDraft);

  const pendingInteractiveOpen = useEditorStore((state) => state.pendingInteractiveOpen);
  const clearPendingInteractiveOpen = useEditorStore((state) => state.clearPendingInteractiveOpen);

  const editHotspot = useEditorStore((state) => state.editHotspot);
  const editPlacedItem = useEditorStore((state) => state.editPlacedItem);
  const editPlacedNpc = useEditorStore((state) => state.editPlacedNpc);
  const editPlacedPlayer = useEditorStore((state) => state.editPlacedPlayer);

  const setSelectedInteractionKind = useEditorStore((state) => state.setSelectedInteractionKind);
  const setSelectedInteractionId = useEditorStore((state) => state.setSelectedInteractionId);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const layerLabelInputRef = useRef<HTMLInputElement | null>(null);
  const layerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const [openLayerCondModal, setOpenLayerCondModal] = useState(false);
  const [layerCondDraft, setLayerCondDraft] = useState<Condition>(emptyCondition);

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);
  const baseLayerId = layers[0]?.id ?? null;

  const isEditing = layerEditSession.mode === "editing";
  const isNewEditing = isEditing && layerEditSession.isNew;
  const editingLayerId = isEditing ? layerEditSession.layerId : null;

  const editingLayer = useMemo(() => findLayerById(layers, editingLayerId), [layers, editingLayerId]);

  const editorOpen = creating || isEditing;
  const isLocked = editorOpen;

  const currentLabel = creating ? draftLabel : (editingLayer?.label ?? "");
  const canShowLayerContent = Boolean(editingLayer?.assetId);
  const variantItems = useMemo(() => buildVariantItems(layers), [layers]);

  const editingLayerIsBase = isBaseLayer(editingLayer?.id ?? null, baseLayerId);
  const editingLayerHasCondition = hasRealLayerCondition(editingLayer);

  const hasDuplicateCurrentLabel = useMemo(() => hasDuplicateLayerLabel(layers, currentLabel, editingLayerId), [layers, currentLabel, editingLayerId]);

  const liveProject = useMemo(() => {
    if (!project) return null;
    if (!nodeDraft) return project;

    const nodes = project.nodes ?? [];
    const index = nodes.findIndex((node) => sameId(node.id, nodeDraft.id));

    if (index < 0) return { ...project, nodes: [...nodes, nodeDraft] };

    const nextNodes = [...nodes];
    nextNodes[index] = nodeDraft;

    return { ...project, nodes: nextNodes };
  }, [project, nodeDraft]);

  /* Mantiene una capa activa válida al cambiar la lista */
  useEffect(() => {
    if (!active || editorOpen) return;

    if (!layers.length) {
      if (activeLayerId) setActiveLayerId(null);
      return;
    }

    const activeLayerStillExists = layers.some((layer) => sameId(layer.id, activeLayerId));

    if (!activeLayerStillExists) {
      setActiveLayerId(layers[0]!.id);
      setActiveLayerField(null);
    }
  }, [active, editorOpen, layers, activeLayerId, setActiveLayerId, setActiveLayerField]);

  /* Mientras se edita una capa, esa capa debe ser la activa */
  useEffect(() => {
    if (!active || !isEditing || !editingLayerId) return;
    if (!sameId(activeLayerId, editingLayerId)) setActiveLayerId(editingLayerId);
  }, [active, isEditing, editingLayerId, activeLayerId, setActiveLayerId]);

  /* Si una capa en edición desaparece tras confirmar su borrado, cierra la sesión de edición */
  useEffect(() => {
    if (!active || !isEditing || !editingLayerId) return;

    const stillExists = layers.some((layer) => sameId(layer.id, editingLayerId));
    if (stillExists) return;

    setCreating(false);
    setDraftLabel("");
    clearLayerEditSession();
    setActiveLayerField(null);
    onClearTextPreview?.();

    const nextActiveLayerId = layers[0]?.id ?? null;
    setActiveLayerId(nextActiveLayerId);
  }, [active, isEditing, editingLayerId, layers, clearLayerEditSession, setActiveLayerField, setActiveLayerId, onClearTextPreview]);

  useEffect(() => {
    if (!active || !editorOpen || activeLayerField !== "name") return;

    requestAnimationFrame(() => {
      layerLabelInputRef.current?.focus();
      layerLabelInputRef.current?.select();
    });
  }, [active, editorOpen, activeLayerField]);

  useEffect(() => {
    if (!active || !editorOpen || activeLayerField !== "text") return;

    requestAnimationFrame(() => {
      layerTextAreaRef.current?.focus();
      layerTextAreaRef.current?.select();
    });
  }, [active, editorOpen, activeLayerField]);

  /* Sincroniza el draft de condición con la capa en edición */
  useEffect(() => {
    if (!editorOpen) return;
    setLayerCondDraft(editingLayer?.when ?? emptyCondition());
  }, [editorOpen, editingLayer?.id, editingLayer?.when]);

  /* Abrir un subpanel de una capa guardada entra automáticamente en edición */
  useEffect(() => {
    if (!active || !activeLayerId || !activeLayerField) return;
    if (creating || isEditing) return;

    const targetLayer = findLayerById(layers, activeLayerId);
    if (!targetLayer) return;

    setLayerEditSession({ mode: "editing", layerId: activeLayerId, isNew: false, snapshot: cloneLayer(targetLayer) });
  }, [active, activeLayerId, activeLayerField, creating, isEditing, layers, setLayerEditSession]);

  /* Tras crear un elemento interactivo, abre su editor dentro del subpanel correspondiente */
  useEffect(() => {
    if (!active || !pendingInteractiveOpen || !activeLayerId) return;
    if (!editorOpen || !isEditing || !editingLayer) return;
    if (!sameId(editingLayer.id, activeLayerId)) return;

    const targetField = getPendingField(pendingInteractiveOpen.kind);
    if (activeLayerField !== targetField) return;

    const exists = pendingTargetExists(editingLayer, pendingInteractiveOpen);
    clearPendingInteractiveOpen();
    if (!exists) return;

    setSelectedInteractionKind(pendingInteractiveOpen.kind);
    setSelectedInteractionId(pendingInteractiveOpen.id);

    switch (pendingInteractiveOpen.kind) {
      case "hotspot":
        editHotspot(pendingInteractiveOpen.id);
        return;
      case "placedItem":
        editPlacedItem(pendingInteractiveOpen.id);
        return;
      case "placedNpc":
        editPlacedNpc(pendingInteractiveOpen.id);
        return;
      case "placedPlayer":
        editPlacedPlayer(pendingInteractiveOpen.id);
        return;
    }
  }, [active, pendingInteractiveOpen, activeLayerId, editorOpen, isEditing, activeLayerField, editingLayer, setSelectedInteractionKind, setSelectedInteractionId,
    editHotspot, editPlacedItem, editPlacedNpc, editPlacedPlayer, clearPendingInteractiveOpen]);

  function cleanupBackgroundAssetSafe(assetId: ID | null | undefined): void {
    if (!assetId) return;

    try { removeBackgroundAsset(assetId) }
    catch { }
  }

  function commitCurrentInteractiveDraft(): boolean {
    return commitActiveInteractiveDrafts({
      hotspotEditorMode: hotspotEditor.mode,
      placedItemEditorMode: placedItemEditor.mode,
      placedNpcEditorMode: placedNpcEditor.mode,
      placedPlayerEditorMode: placedPlayerEditor.mode,

      hasHotspotDraft: Boolean(hotspotEditor.draft),
      hasPlacedItemDraft: Boolean(placedItemEditor.draft),
      hasPlacedNpcDraft: Boolean(placedNpcEditor.draft),
      hasPlacedPlayerDraft: Boolean(placedPlayerEditor.draft),

      commitHotspotDraft,
      commitPlacedItemDraft,
      commitPlacedNpcDraft,
      commitPlacedPlayerDraft,
    });
  }

  function ensureLayerConditionIfRequired(): boolean {
    if (!editingLayer || isBaseLayer(editingLayer.id, baseLayerId)) return true;

    if (editingLayer.when && !isEmptyCondition(editingLayer.when)) return true;

    toast.error("Falta condición", "En capas no-base necesitas añadir al menos una condición para poder guardar.");
    return false;
  }

  function ensureCurrentLayerHasImage(): boolean {
    if (!editingLayer || editingLayer.assetId) return true;

    toast.error("Falta imagen", "La capa necesita una imagen.");
    return false;
  }

  function canLeaveCurrentLayerField(): boolean {
    if (!editingLayer) return true;

    switch (activeLayerField) {
      case "image":
        return ensureCurrentLayerHasImage();

      case "hotspots":
      case "placedItems":
      case "placedNpcs":
      case "placedPlayers":
        return commitCurrentInteractiveDraft();

      case "name":
      case "text":
      case "music":
      default:
        return true;
    }
  }

  function canLeaveCurrentLayerEditor(): boolean {
    if (!editorOpen) return true;
    if (!commitCurrentInteractiveDraft()) return false;
    if (!ensureCurrentLayerHasImage()) return false;
    return ensureLayerConditionIfRequired();
  }

  function handleToggleLayerField(nextField: LayerToggleFieldId) {
    if (!editorOpen) {
      setActiveLayerField(activeLayerField === nextField ? null : nextField);
      return;
    }

    if (activeLayerField === nextField) {
      if (!canLeaveCurrentLayerField()) return;
      setActiveLayerField(null);
      return;
    }

    if (!canLeaveCurrentLayerField()) return;
    setActiveLayerField(nextField);
  }

  function enterEdit(layerId: ID, isNew: boolean) {
    const layer = findLayerById(layers, layerId);
    if (!layer) return;

    setActiveLayerId(layerId);
    if (!activeLayerField) setActiveLayerField("name");

    setLayerEditSession({ mode: "editing", layerId, isNew, snapshot: cloneLayer(layer) });
  }

  function exitEdit() {
    setCreating(false);
    setDraftLabel("");
    clearLayerEditSession();
    setActiveLayerField(null);
    onClearTextPreview?.();
  }

  function handleAdd() {
    if (isLocked) return;

    setDraftLabel(`Capa ${layers.length + 1}`);
    setCreating(true);
    setActiveLayerField("name");
  }

  function handleCancelCreation() {
    setCreating(false);
    setDraftLabel("");
    setActiveLayerField(null);
    onClearTextPreview?.();
  }

  function restoreExistingLayerSnapshot(layerId: ID, snapshot: SceneImageLayer) {
    updateNodeLayer(layerId, layerSnapshotPatch(snapshot));
  }

  function handleCancelExistingEdit() {
    if (layerEditSession.mode !== "editing") {
      exitEdit();
      return;
    }

    if (layerEditSession.isNew) {
      const current = findLayerById(layers, layerEditSession.layerId);
      cleanupBackgroundAssetSafe(current?.assetId);
      removeNodeLayer(layerEditSession.layerId, { withConfirmation: false });
      exitEdit();
      return;
    }

    const snapshot = layerEditSession.snapshot;
    const current = findLayerById(layers, layerEditSession.layerId);

    const currentAssetId = current?.assetId ?? null;
    const snapshotAssetId = snapshot.assetId ?? null;

    if (currentAssetId && currentAssetId !== snapshotAssetId) cleanupBackgroundAssetSafe(currentAssetId);

    restoreExistingLayerSnapshot(layerEditSession.layerId, snapshot);
    exitEdit();
  }

  function handleCancel() {
    if (creating) {
      handleCancelCreation();
      return;
    }

    if (!isEditing) {
      exitEdit();
      return;
    }

    handleCancelExistingEdit();
  }

  function handleSave() {
    if (!commitCurrentInteractiveDraft()) return;

    const nextLabel = currentLabel.trim();

    if (!nextLabel) {
      toast.error("Falta etiqueta", "La capa necesita una etiqueta.");
      return;
    }

    if (hasDuplicateCurrentLabel) {
      toast.error("Etiqueta duplicada", "Ya existe una capa con esa etiqueta en esta escena.");
      return;
    }

    if (creating && !editingLayer) {
      toast.warning("Falta imagen", "Selecciona una imagen para crear la capa.");
      return;
    }

    if (!ensureCurrentLayerHasImage()) return;
    if (!ensureLayerConditionIfRequired()) return;

    exitEdit();
  }

  function handleDelete() {
    if (layerEditSession.mode !== "editing") return;
    removeNodeLayer(layerEditSession.layerId, { withConfirmation: true });
  }

  function getFreshLayer(layerId: ID): SceneImageLayer | null {
    return findLayerById(useEditorStore.getState().nodeDraft?.layers ?? [], layerId);
  }

  function handleCommitAssetId(nextAssetId: ID) {
    if (creating) {
      const label = draftLabel.trim() || `Capa ${layers.length + 1}`;
      const createdId = addNodeLayer({ assetId: nextAssetId, label });
      if (!createdId) return;

      const freshLayer = getFreshLayer(createdId);
      if (!freshLayer) return;

      setActiveLayerId(createdId);
      setLayerEditSession({ mode: "editing", layerId: createdId, isNew: true, snapshot: cloneLayer(freshLayer) });

      setCreating(false);
      setDraftLabel("");
      setActiveLayerField("image");
      return;
    }

    if (!editingLayer) return;

    const prevAssetId = editingLayer.assetId ?? null;
    const snapshotAssetId = isEditing ? (layerEditSession.snapshot.assetId ?? null) : null;
    const prevWasSnapshotAsset = Boolean(snapshotAssetId && prevAssetId === snapshotAssetId);

    if (prevAssetId && prevAssetId !== nextAssetId && (isNewEditing || !prevWasSnapshotAsset)) cleanupBackgroundAssetSafe(prevAssetId);

    setLayerAssetId(nextAssetId);
  }

  function handleReorderLayers(fromIndex: number, toIndex: number) {
    if (fromIndex === 0 || toIndex === 0) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= layers.length || toIndex >= layers.length) return;

    reorderNodeLayers(fromIndex, toIndex);
    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las capas.");
  }

  function handleSelectVariant(id: ID) {
    if (!canLeaveCurrentLayerEditor()) return;
    setActiveLayerId(id);
    setActiveLayerField(null);
    onClearTextPreview?.();
  }

  function handleEditVariant(id: ID) {
    if (!canLeaveCurrentLayerEditor()) return;
    enterEdit(id, false);
  }

  function handleSaveLayerCondition(nextCondition: Condition) {
    if (!editingLayer) {
      toast.error("No se pudo guardar", "No hay capa activa.");
      setOpenLayerCondModal(false);
      return;
    }

    const whenToSave = isEmptyCondition(nextCondition) ? undefined : nextCondition;
    updateNodeLayer(editingLayer.id, { when: whenToSave });

    setLayerCondDraft(nextCondition);
    setOpenLayerCondModal(false);

    toast.success("Condición guardada", "La condición se ha aplicado a la capa.");
  }

  function handleLabelChange(next: string) {
    if (creating) setDraftLabel(next);
    else setLayerLabel(next);
  }

  return (
    <>
      <ToggleFieldBlock
        label="Variantes"
        active={active}
        onToggle={onToggle}
        contentClassName={editorOpen ? "!bg-slate-800" : undefined}
      >
        <div className="pt-2 space-y-3">
          {!isLocked ? (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                className="btn btn-create-condition text-[13px]"
                onClick={handleAdd}
              >
                + Añadir variante
              </button>
            </div>
          ) : null}

          {!isLocked && layers.length > 0 ? (
            <SceneVariantList
              title="Variantes guardadas"
              variants={variantItems}
              isItemDraggable={(id) => !isBaseLayer(id, baseLayerId)}
              onReorder={handleReorderLayers}
              onSelectVariant={handleSelectVariant}
              onEditVariant={handleEditVariant}
            />
          ) : null}

          {editorOpen ? (
            <div className="bg-slate-800 rounded-lg space-y-3">
              <SceneVariantLabelField
                label="Nombre"
                value={currentLabel}
                active={activeLayerField === "name"}
                onToggle={() => handleToggleLayerField("name")}
                inputRef={layerLabelInputRef}
                onChange={handleLabelChange}
                onEnterDone={() => handleToggleLayerField("image")}
              />

              <SceneImageField
                label="Imagen"
                value={creating ? undefined : editingLayer?.assetId}
                active={activeLayerField === "image"}
                onToggle={() => handleToggleLayerField("image")}
                fileInputRef={fileInputRef}
                onCommitAssetId={handleCommitAssetId}
                dock={editingLayer?.dock ?? "bottom"}
                onDockChange={setLayerDock}
                showAddCondition={Boolean(canShowLayerContent && editingLayer && !editingLayerIsBase)}
                addConditionLabel={editingLayerHasCondition ? "Editar condición" : "+ Añadir condición"}
                addConditionTitle={editingLayerHasCondition ? "Editar condición de la capa" : "Añadir condición (obligatoria en capas no-base)"}
                onAddCondition={() => setOpenLayerCondModal(true)}
              />

              {canShowLayerContent && editingLayer ? (
                <>
                  <SceneTextField
                    active={activeLayerField === "text"}
                    onToggle={() => handleToggleLayerField("text")}
                    textareaRef={layerTextAreaRef}
                    layerId={editingLayer.id}
                    onPreview={(preview) => onTextPreview?.(preview.text ?? null)}
                    onClearPreview={onClearTextPreview ?? (() => { })}
                  />

                  <SceneHotspotField
                    active={activeLayerField === "hotspots"}
                    onToggle={() => handleToggleLayerField("hotspots")}
                    layerId={editingLayer.id}
                  />

                  <ScenePlacedItemField
                    active={activeLayerField === "placedItems"}
                    onToggle={() => handleToggleLayerField("placedItems")}
                    layerId={editingLayer.id}
                  />

                  <ScenePlacedNpcField
                    active={activeLayerField === "placedNpcs"}
                    onToggle={() => handleToggleLayerField("placedNpcs")}
                    layerId={editingLayer.id}
                  />

                  <ScenePlacedPlayerField
                    active={activeLayerField === "placedPlayers"}
                    onToggle={() => handleToggleLayerField("placedPlayers")}
                    layerId={editingLayer.id}
                  />

                  <SceneMusicField
                    label="Música"
                    active={activeLayerField === "music"}
                    onToggle={() => handleToggleLayerField("music")}
                    layerId={editingLayer.id}
                  />
                </>
              ) : null}

              <div className="flex items-center justify-between text-[12px] border-t-2 border-slate-600 pt-3">
                <div>
                  {!creating && isEditing && !isNewEditing ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="px-2.5 py-1.5 rounded-md border border-rose-700 bg-rose-950/40 text-white hover:bg-rose-900/50"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-2.5 py-1.5 rounded-md border border-slate-500 bg-slate-900/20 text-white hover:bg-slate-700"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-2.5 py-1.5 rounded-md border border-emerald-600 bg-emerald-900/50 text-white hover:bg-emerald-900"
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </ToggleFieldBlock>

      <ConditionBuilderModal
        open={openLayerCondModal}
        project={liveProject}
        value={layerCondDraft}
        onClose={() => setOpenLayerCondModal(false)}
        onSave={handleSaveLayerCondition}
      />
    </>
  );
}
