import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { SceneVariantLabelField } from "@/features/editor/scene/fields/SceneVariantLabelField";
import { SceneImageField } from "@/features/editor/scene/fields/SceneImageField";
import { SceneTextField } from "@/features/editor/scene/fields/SceneTextField";
import { SceneHotspotField } from "@/features/editor/scene/hotspots/SceneHotspotField";
import { ScenePlacedItemField } from "@/features/editor/scene/placedItems/ScenePlacedItemField";
import { type LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { SceneVariantList } from "@/components/SceneVariantsSection";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";
import { ConditionBuilder, type Condition } from "@/domain/conditions";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { ScenePlacedPlayerField } from "@/features/editor/scene/placedPlayers/ScenePlacedPlayerField";
import { ScenePlacedNpcField } from "@/features/editor/scene/placedNpcs/ScenePlacedNpcField";
import { SceneMusicField } from "@/features/editor/scene/music/SceneMusicField";
import { commitActiveInteractiveDrafts } from "@/features/editor/scene/interactiveComponents/interactiveDraftGuards";
import { toast } from "@/shared/toast/toastStore";

type SceneLayersFieldProps = {
  active: boolean;
  onToggle: () => void;
  onTextPreview?: (text: string | null) => void;
  onClearTextPreview?: () => void;
};

/* Clonado seguro del snapshot de una capa para restaurarla al cancelar */
function cloneLayer(layer: SceneImageLayer): SceneImageLayer {
  return JSON.parse(JSON.stringify(layer));
}

/* Busca una capa por id dentro de la lista actual */
function findLayerById(layers: SceneImageLayer[], layerId: ID | null): SceneImageLayer | null {
  if (!layerId) return null;
  return layers.find((layer) => String(layer.id) === String(layerId)) ?? null;
}

function normalizeLayerLabel(label: string | null | undefined): string {
  return (label ?? "").trim().toLowerCase();
}

function isBaseLayer(layerId: ID | null, baseLayerId: ID | null): boolean {
  return Boolean(layerId && baseLayerId && String(layerId) === String(baseLayerId));
}

function hasRealLayerCondition(layer: SceneImageLayer | null): boolean {
  return Boolean(layer?.when && !isEmptyCondition(layer.when));
}

/* Convierte capas guardadas a items para la lista visual */
function buildVariantItems(layers: SceneImageLayer[]) {
  return layers.map((layer) => ({ id: layer.id, label: layer.label ?? "" }));
}

/* Detecta duplicados de nombre excluyendo la capa que se está editando */
function hasDuplicateLayerLabel(layers: SceneImageLayer[], currentLabel: string, editingLayerId: ID | null): boolean {
  const normalizedCurrentLabel = normalizeLayerLabel(currentLabel);
  if (!normalizedCurrentLabel) return false;

  return layers.some((layer) => {
    if (editingLayerId && String(layer.id) === String(editingLayerId)) return false;
    return normalizeLayerLabel(layer.label) === normalizedCurrentLabel;
  });
}

function getPendingField(kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer"): LayerToggleFieldId {
  switch (kind) {
    case "hotspot": return "hotspots";
    case "placedItem": return "placedItems";
    case "placedNpc": return "placedNpcs";
    case "placedPlayer": return "placedPlayers";
  }
}

function pendingTargetExists(layer: SceneImageLayer, pending: { kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer"; id: ID }): boolean {
  switch (pending.kind) {
    case "hotspot": return (layer.hotspots ?? []).some((item) => String(item.id) === String(pending.id));
    case "placedItem": return (layer.placedItems ?? []).some((item) => String(item.id) === String(pending.id));
    case "placedNpc": return (layer.placedNpcs ?? []).some((item) => String(item.npcId) === String(pending.id));
    case "placedPlayer": return (layer.placedPlayers ?? []).some((item) => String(item.playerId) === String(pending.id));
  }
}

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

  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const [openLayerCondModal, setOpenLayerCondModal] = useState(false);
  const [layerCondDraft, setLayerCondDraft] = useState<Condition>(ConditionBuilder.and());

  const layers = useMemo<SceneImageLayer[]>(() => nodeDraft?.layers ?? [], [nodeDraft?.layers]);

  const baseLayerId = layers[0]?.id ?? null;

  const isEditing = layerEditSession.mode === "editing";
  const isNewEditing = isEditing && layerEditSession.isNew;
  const editingLayerId = layerEditSession.mode === "editing" ? layerEditSession.layerId : null;

  const editingLayer = useMemo(() => findLayerById(layers, editingLayerId), [layers, editingLayerId]);

  const activeLayer = useMemo(() => findLayerById(layers, activeLayerId), [layers, activeLayerId]);

  const editorOpen = creating || isEditing;
  const isLocked = editorOpen;

  const currentLayer = editorOpen ? editingLayer : activeLayer;
  const layerLabelInputRef = useRef<HTMLInputElement | null>(null);
  const layerTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const currentLabel = creating ? draftLabel : editingLayer?.label ?? "";
  const canShowRest = Boolean(editingLayer?.assetId);
  const variantItems = useMemo(() => buildVariantItems(layers), [layers]);

  const currentLayerIsBase = isBaseLayer(currentLayer?.id ?? null, baseLayerId);
  const editingLayerHasCondition = hasRealLayerCondition(editingLayer);

  const hasDuplicateCurrentLabel = useMemo(() => hasDuplicateLayerLabel(layers, currentLabel, editingLayerId), [layers, currentLabel, editingLayerId]);

  /* Mantiene una capa activa válida al cambiar la lista */
  useEffect(() => {
    if (!active) return;
    if (editorOpen) return;

    if (!layers.length) {
      if (activeLayerId) setActiveLayerId(null);
      return;
    }

    const exists = activeLayerId && layers.some((layer) => String(layer.id) === String(activeLayerId));

    if (!exists) {
      setActiveLayerId(layers[0]!.id);
      setActiveLayerField(null);
    }
  }, [active, editorOpen, layers, activeLayerId, setActiveLayerId, setActiveLayerField]);

  useEffect(() => {
    if (!active) return;
    if (!isEditing) return;
    if (!editingLayerId) return;

    if (String(activeLayerId) !== String(editingLayerId)) setActiveLayerId(editingLayerId);
  }, [active, isEditing, editingLayerId, activeLayerId, setActiveLayerId]);

  /* Al abrir el editor de capa, foco al nombre */
  useEffect(() => {
    if (!active || !editorOpen) return;
    if (activeLayerField !== "name") return;

    requestAnimationFrame(() => {
      layerLabelInputRef.current?.focus();
      layerLabelInputRef.current?.select();
    });
  }, [active, editorOpen, activeLayerField]);

  /* Al abrir el bloque de texto, foco al textarea */
  useEffect(() => {
    if (!active || !editorOpen) return;
    if (activeLayerField !== "text") return;

    requestAnimationFrame(() => {
      layerTextAreaRef.current?.focus();
      layerTextAreaRef.current?.select();
    });
  }, [active, editorOpen, activeLayerField]);

  /* Sincroniza el draft de condición con la capa en edición */
  useEffect(() => {
    if (!editorOpen) return;

    if (editingLayer) {
      setLayerCondDraft(editingLayer.when ?? ConditionBuilder.and());
      return;
    }

    setLayerCondDraft(ConditionBuilder.and());
  }, [editorOpen, editingLayer?.id, editingLayer?.when]);

  useEffect(() => {
    if (!active) return;
    if (!activeLayerId) return;
    if (!activeLayerField) return;
    if (creating || isEditing) return;

    const targetLayer = findLayerById(layers, activeLayerId);
    if (!targetLayer) return;

    setLayerEditSession({ mode: "editing", layerId: activeLayerId, isNew: false, snapshot: cloneLayer(targetLayer) });
  }, [active, activeLayerId, activeLayerField, creating, isEditing, layers, setLayerEditSession]);

  useEffect(() => {
    if (!active) return;
    if (!pendingInteractiveOpen) return;
    if (!activeLayerId) return;
    if (!editorOpen || !isEditing) return;
    if (!editingLayer) return;
    if (String(editingLayer.id) !== String(activeLayerId)) return;

    const targetField = getPendingField(pendingInteractiveOpen.kind);
    if (activeLayerField !== targetField) return;

    const exists = pendingTargetExists(editingLayer, pendingInteractiveOpen);
    clearPendingInteractiveOpen();
    if (!exists) return;

    switch (pendingInteractiveOpen.kind) {
      case "hotspot":
        setSelectedInteractionKind("hotspot");
        setSelectedInteractionId(pendingInteractiveOpen.id);
        editHotspot(pendingInteractiveOpen.id);
        return;

      case "placedItem":
        setSelectedInteractionKind("placedItem");
        setSelectedInteractionId(pendingInteractiveOpen.id);
        editPlacedItem(pendingInteractiveOpen.id);
        return;

      case "placedNpc":
        setSelectedInteractionKind("placedNpc");
        setSelectedInteractionId(pendingInteractiveOpen.id);
        editPlacedNpc(pendingInteractiveOpen.id);
        return;

      case "placedPlayer":
        setSelectedInteractionKind("placedPlayer");
        setSelectedInteractionId(pendingInteractiveOpen.id);
        editPlacedPlayer(pendingInteractiveOpen.id);
        return;
    }
  }, [active, pendingInteractiveOpen, activeLayerId, editorOpen, isEditing, activeLayerField, editingLayer, setSelectedInteractionKind,
    setSelectedInteractionId, editHotspot, editPlacedItem, editPlacedNpc, editPlacedPlayer, clearPendingInteractiveOpen]);

  /* Limpieza segura de asset huérfano */
  function cleanupAssetSafe(assetId: ID | null | undefined) {
    if (!assetId) return;

    try { removeBackgroundAsset(assetId) }
    catch { }
  }

  /* Intenta consolidar drafts interactivos antes de cambiar de subpanel */
  function commitActiveInteractiveDraft(): boolean {
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

  /* En capas no-base la condición es obligatoria */
  function ensureLayerConditionIfRequired(): boolean {
    if (!editingLayer) return true;
    if (isBaseLayer(editingLayer.id, baseLayerId)) return true;

    const when = editingLayer.when ?? null;
    if (when && !isEmptyCondition(when)) return true;

    toast.error("Falta condición", "En capas no-base necesitas añadir al menos una condición para poder guardar.");
    return false;
  }

  /* Valida si se puede abandonar el subpanel actual */
  function canLeaveCurrentLayerField(): boolean {
    if (!editingLayer) return true;

    switch (activeLayerField) {
      case "image":
        if (!editingLayer.assetId) {
          toast.error("Falta imagen", "La capa necesita una imagen.");
          return false;
        }
        return true;

      case "hotspots":
      case "placedItems":
      case "placedNpcs":
      case "placedPlayers":
        return commitActiveInteractiveDraft();

      case "name":
      case "text":
      case "music":
      default:
        return true;
    }
  }

  /* Valida si se puede abandonar el editor local de capa */
  function canLeaveCurrentLayerEditor(): boolean {
    if (!editorOpen) return true;
    if (!commitActiveInteractiveDraft()) return false;

    if (editingLayer && !editingLayer.assetId) {
      toast.error("Falta imagen", "La capa necesita una imagen.");
      return false;
    }

    if (editingLayer && !ensureLayerConditionIfRequired()) return false;

    return true;
  }

  /* Toggle seguro de subpaneles internos */
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

  /* Entra en edición de una capa ya existente */
  function enterEdit(layerId: ID, isNew: boolean) {
    const layer = findLayerById(layers, layerId);
    if (!layer) return;

    setActiveLayerId(layerId);
    if (!activeLayerField) setActiveLayerField("name");
    setLayerEditSession({ mode: "editing", layerId, isNew, snapshot: cloneLayer(layer) });
  }

  /* Cierra el editor local y limpia estado efímero */
  function exitEdit() {
    setCreating(false);
    setDraftLabel("");
    clearLayerEditSession();
    setActiveLayerField(null);
  }

  /* Arranca creación de nueva capa */
  function handleAdd() {
    if (isLocked) return;

    setDraftLabel(`Capa ${layers.length + 1}`);
    setCreating(true);
    setActiveLayerField("name");
  }

  /* Cancela edición local y restaura snapshot si procede */
  function handleCancel() {
    if (creating) {
      setCreating(false);
      setDraftLabel("");
      setActiveLayerField(null);
      return;
    }

    if (!isEditing) {
      exitEdit();
      return;
    }

    if (layerEditSession.mode !== "editing") {
      exitEdit();
      return;
    }

    if (layerEditSession.isNew) {
      const current = findLayerById(layers, layerEditSession.layerId);
      cleanupAssetSafe(current?.assetId);

      removeNodeLayer(layerEditSession.layerId);
      exitEdit();
      return;
    }

    const snapshot = layerEditSession.snapshot;
    const current = findLayerById(layers, layerEditSession.layerId);

    const currentAssetId = current?.assetId ?? null;
    const snapshotAssetId = snapshot.assetId ?? null;

    if (currentAssetId && currentAssetId !== snapshotAssetId) cleanupAssetSafe(currentAssetId);

    updateNodeLayer(layerEditSession.layerId, {
      assetId: snapshot.assetId,
      label: snapshot.label,
      when: snapshot.when,
      dock: snapshot.dock,
      text: snapshot.text,
      hotspots: snapshot.hotspots,
      placedItems: snapshot.placedItems,
      placedNpcs: snapshot.placedNpcs,
      placedPlayers: snapshot.placedPlayers,
      musicTrackId: snapshot.musicTrackId,
    });

    exitEdit();
  }

  /* Guarda la capa actual */
  function handleSave() {
    if (!commitActiveInteractiveDraft()) return;

    const nextLabel = (creating ? draftLabel : editingLayer?.label ?? "").trim();

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

    if (editingLayer && !ensureLayerConditionIfRequired()) return;

    exitEdit();
  }

  /* Borra la capa actualmente editada */
  function handleDelete() {
    if (layerEditSession.mode !== "editing") return;

    removeNodeLayer(layerEditSession.layerId);
    setActiveLayerId(layers[0]?.id ?? null);
    exitEdit();
  }

  /* Recibe un asset ya subido/seleccionado para la capa */
  function handleCommitAssetId(nextAssetId: ID) {
    if (creating) {
      const label = draftLabel.trim() || `Capa ${layers.length + 1}`;
      const createdId = addNodeLayer({ assetId: nextAssetId, label });
      if (!createdId) return;

      setActiveLayerId(createdId);

      const freshLayer = findLayerById(
        useEditorStore.getState().nodeDraft?.layers ?? [],
        createdId
      );
      if (!freshLayer) return;

      setLayerEditSession({ mode: "editing", layerId: createdId, isNew: true, snapshot: cloneLayer(freshLayer) });

      setCreating(false);
      setDraftLabel("");
      setActiveLayerField("image");
      return;
    }

    if (!editingLayer) return;

    const prevAssetId = editingLayer.assetId ?? null;

    if (isNewEditing && prevAssetId && prevAssetId !== nextAssetId) cleanupAssetSafe(prevAssetId);

    if (!isNewEditing && prevAssetId && prevAssetId !== nextAssetId) {
      const snapshotAssetId = layerEditSession.mode === "editing" ? layerEditSession.snapshot.assetId ?? null : null;
      const prevIsSnapshot = snapshotAssetId && prevAssetId === snapshotAssetId;

      if (!prevIsSnapshot) cleanupAssetSafe(prevAssetId);
    }

    setLayerAssetId(nextAssetId);
  }

  /* Reordena capas, manteniendo la base fijada en primera posición */
  function handleReorderLayers(fromIndex: number, toIndex: number) {
    if (fromIndex === 0 || toIndex === 0) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= layers.length || toIndex >= layers.length) return;

    reorderNodeLayers(fromIndex, toIndex);
    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las capas.");
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
              onSelectVariant={(id) => {
                if (!canLeaveCurrentLayerEditor()) return;
                setActiveLayerId(id);
                setActiveLayerField(null);
              }}
              onEditVariant={(id) => {
                if (!canLeaveCurrentLayerEditor()) return;
                enterEdit(id, false);
              }}
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
                onChange={(next) => {
                  if (creating) {
                    setDraftLabel(next);
                    return;
                  }
                  setLayerLabel(next);
                }}
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
                showAddCondition={Boolean(canShowRest && editingLayer && !currentLayerIsBase)}
                addConditionLabel={editingLayerHasCondition ? "Editar condición" : "+ Añadir condición"}
                addConditionTitle={editingLayerHasCondition ? "Editar condición de la capa" : "Añadir condición (obligatoria en capas no-base)"}
                onAddCondition={() => setOpenLayerCondModal(true)}
              />

              {canShowRest && editingLayer ? (
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
        project={project}
        value={layerCondDraft}
        onClose={() => setOpenLayerCondModal(false)}
        onSave={(nextCondition) => {
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
        }}
      />
    </>
  );
}