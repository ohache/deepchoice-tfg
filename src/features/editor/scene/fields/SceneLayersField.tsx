import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, SceneImageLayer } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { SceneImageField } from "@/features/editor/scene/fields/SceneImageField";
import { SceneTextField } from "@/features/editor/scene/fields/SceneTextField";
import { SceneHotspotField } from "@/features/editor/scene/hotspots/SceneHotspotField";
import { ScenePlacedItemField } from "@/features/editor/scene/placedItems/ScenePlacedItemField";
import { useLayerFieldState, type LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { SceneVariantList, SceneVariantEditorShell } from "@/components/SceneVariantsSection";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";
import { ConditionBuilder, type Condition } from "@/domain/conditions";
import { ConditionBuilderModal } from "@/features/editor/scene/rules/conditions/ConditionBuilderModal";
import { ScenePlacedPlayerField } from "@/features/editor/scene/placedPlayers/ScenePlacedPlayerField";
import { ScenePlacedNpcField } from "@/features/editor/scene/placedNpcs/ScenePlacedNpcField";
import { SceneMusicField } from "@/features/editor/scene/music/SceneMusicField";
import { toast } from "@/shared/toast/toastStore";

type SceneLayersFieldProps = {
  active: boolean;
  onToggle: () => void;
  onTextPreview?: (text: string | null) => void;
  onClearTextPreview?: () => void;
};

type EditSession =
  | { mode: "idle" }
  | { mode: "editing"; layerId: ID; isNew: boolean; snapshot: SceneImageLayer; };

function cloneLayer(l: SceneImageLayer): SceneImageLayer {
  return JSON.parse(JSON.stringify(l));
}

export function SceneLayersField({ active, onToggle, onTextPreview, onClearTextPreview }: SceneLayersFieldProps) {
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const removeBackgroundAsset = useEditorStore((s) => s.removeBackgroundAsset);

  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);

  const addNodeLayer = useEditorStore((s) => s.addNodeLayer);
  const updateNodeLayer = useEditorStore((s) => s.updateNodeLayer);
  const removeNodeLayer = useEditorStore((s) => s.removeNodeLayer);
  const reorderNodeLayers = useEditorStore((s) => s.reorderNodeLayers);

  const setLayerLabel = useEditorStore((s) => s.setLayerLabel);
  const setLayerAssetId = useEditorStore((s) => s.setLayerAssetId);
  const setLayerDock = useEditorStore((s) => s.setLayerDock);

  const hotspotEditor = useEditorStore((s) => s.hotspotEditor);
  const placedItemEditor = useEditorStore((s) => s.placedItemEditor);
  const placedNpcEditor = useEditorStore((s) => s.placedNpcEditor);
  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);

  const commitHotspotDraft = useEditorStore((s) => s.commitHotspotDraft);
  const commitPlacedItemDraft = useEditorStore((s) => s.commitPlacedItemDraft);
  const commitPlacedNpcDraft = useEditorStore((s) => s.commitPlacedNpcDraft);
  const commitPlacedPlayerDraft = useEditorStore((s) => s.commitPlacedPlayerDraft);

  const layers = useMemo<SceneImageLayer[]>(() => (nodeDraft?.layers ?? []), [nodeDraft?.id, nodeDraft?.layers]);

  const baseLayerId = (layers[0]?.id ?? null);
  const isBaseLayerId = (id: ID) => Boolean(baseLayerId && String(id) === String(baseLayerId));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [session, setSession] = useState<EditSession>({ mode: "idle" });

  const [creating, setCreating] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const isEditing = session.mode === "editing";
  const isNewEditing = isEditing && session.isNew;

  const editingLayerId = session.mode === "editing" ? session.layerId : null;

  const editingLayer = useMemo(() => {
    if (!editingLayerId) return null;
    return layers.find((l) => String(l.id) === String(editingLayerId)) ?? null;
  }, [layers, editingLayerId]);

  const editorOpen = creating || isEditing;
  const isLocked = editorOpen;

  const activeLayer = useMemo(() => {
    if (!activeLayerId) return null;
    return layers.find((l) => String(l.id) === String(activeLayerId)) ?? null;
  }, [layers, activeLayerId]);

  const currentLayer = editorOpen ? editingLayer : activeLayer;

  const { activeLayerField, setActiveLayerField, toggleLayerField, layerLabelInputRef, layerTextAreaRef } =
    useLayerFieldState([active, session.mode, activeLayerId, layers.length, creating]);

  useEffect(() => {
    if (!active) return;

    if (!layers.length) {
      if (activeLayerId) setActiveLayerId(null);
      return;
    }

    const exists = activeLayerId && layers.some((l) => String(l.id) === String(activeLayerId));
    if (!exists) {
      setActiveLayerId(layers[0]!.id);
      setActiveLayerField(null);
    }
  }, [active, layers, activeLayerId, setActiveLayerId, setActiveLayerField]);

  function commitActiveInteractiveDraft(): boolean {
    if (hotspotEditor.mode.type !== "idle") {
      const result = commitHotspotDraft();
      if (!result.ok) {
        toast.error("Hotspot incompleto", result.error ?? "Revisa el hotspot antes de continuar.");
        return false;
      }
    }

    if (placedItemEditor.mode.type !== "idle") {
      const result = commitPlacedItemDraft();
      if (!result.ok) {
        toast.error("Item incompleto", result.error ?? "Revisa el item antes de continuar.");
        return false;
      }
    }

    if (placedNpcEditor.mode.type !== "idle") {
      const result = commitPlacedNpcDraft();
      if (!result.ok) {
        toast.error("NPC incompleto", result.error ?? "Revisa el NPC antes de continuar.");
        return false;
      }
    }

    if (placedPlayerEditor.mode.type !== "idle") {
      const result = commitPlacedPlayerDraft();
      if (!result.ok) {
        toast.error("Player incompleto", result.error ?? "Revisa el player antes de continuar.");
        return false;
      }
    }

    return true;
  }

  function canLeaveCurrentLayerField(): boolean {
    if (!editingLayer) return true;

    switch (activeLayerField) {
      case "image":
        if (!editingLayer.assetId) {
          toast.error("Falta imagen", "La capa necesita una imagen.");
          return false;
        }
        return true;

      case "text":
        return true;

      case "hotspots":
      case "placedItems":
      case "placedNpcs":
      case "placedPlayers":
        return commitActiveInteractiveDraft();

      case "music":
        return true;

      default:
        return true;
    }
  }

  function handleToggleLayerField(next: LayerToggleFieldId) {
    if (!editorOpen) {
      toggleLayerField(next);
      return;
    }

    if (activeLayerField === next) {
      if (!canLeaveCurrentLayerField()) return;
      setActiveLayerField(null);
      return;
    }

    if (!canLeaveCurrentLayerField()) return;
    setActiveLayerField(next);
  }

  function canLeaveCurrentLayerEditor(): boolean {
    if (!editorOpen) return true;

    if (!commitActiveInteractiveDraft()) {
      return false;
    }

    if (editingLayer && !editingLayer.assetId) {
      toast.error("Falta imagen", "La capa necesita una imagen.");
      return false;
    }

    if (editingLayer && !ensureLayerConditionIfRequired()) return false;

    return true;
  }

  useEffect(() => {
    if (!active) return;
    if (!editorOpen) return;

    requestAnimationFrame(() => {
      layerLabelInputRef.current?.focus();
      layerLabelInputRef.current?.select();
    });
  }, [active, editorOpen, layerLabelInputRef]);

  const cleanupAssetSafe = (assetId: ID | null | undefined) => {
    if (!assetId) return;
    try { removeBackgroundAsset(assetId); }
    catch { }
  };

  const enterEdit = (layerId: ID, isNew: boolean) => {
    const layer = layers.find((l) => String(l.id) === String(layerId)) ?? null;
    if (!layer) return;

    setActiveLayerId(layerId);
    setActiveLayerField("image");

    setSession({ mode: "editing", layerId, isNew, snapshot: cloneLayer(layer) });
  };

  const exitEdit = () => {
    setCreating(false);
    setDraftLabel("");
    setSession({ mode: "idle" });
    setActiveLayerField(null);
  };

  const handleAdd = () => {
    if (isLocked) return;
    const nextIndex = layers.length + 1;
    setDraftLabel(`Capa ${nextIndex}`);
    setCreating(true);
    setActiveLayerField("image");
  };

  const handleCancel = () => {
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

    if (session.isNew) {
      const current = layers.find((l) => String(l.id) === String(session.layerId)) ?? null;
      cleanupAssetSafe(current?.assetId);

      removeNodeLayer(session.layerId);
      setActiveLayerId(layers[0]?.id ?? null);
      exitEdit();
      return;
    }

    const snap = session.snapshot;

    const current = layers.find((l) => String(l.id) === String(session.layerId)) ?? null;
    const curAsset = (current?.assetId ?? null);
    const snapAsset = (snap.assetId ?? null);

    if (curAsset && curAsset !== snapAsset) cleanupAssetSafe(curAsset);

    updateNodeLayer(session.layerId, {
      assetId: snap.assetId,
      label: snap.label,
      when: snap.when,
      dock: snap.dock,
      text: snap.text,
      hotspots: snap.hotspots,
      placedItems: snap.placedItems,
      placedNpcs: snap.placedNpcs,
      placedPlayers: snap.placedPlayers,
      musicTrackId: snap.musicTrackId,
    });

    exitEdit();
  };

  const isBaseLayer = Boolean(currentLayer && baseLayerId && String(currentLayer.id) === String(baseLayerId));
  const layerWhen = currentLayer?.when;
  const hasLayerCondition = Boolean(layerWhen && !isEmptyCondition(layerWhen));

  const [openLayerCondModal, setOpenLayerCondModal] = useState(false);
  const [layerCondDraft, setLayerCondDraft] = useState<Condition>(ConditionBuilder.and());


  useEffect(() => {
    if (!editorOpen) return;

    if (editingLayer) {
      const w = (editingLayer?.when ?? null);
      setLayerCondDraft(w ?? ConditionBuilder.and());
    } else {
      setLayerCondDraft(ConditionBuilder.and());
    }
  }, [editorOpen, editingLayer?.id]);

  const ensureLayerConditionIfRequired = () => {
    if (!editingLayer) return true;
    if (isBaseLayer) return true;

    const w = (editingLayer?.when ?? null);
    if (w && !isEmptyCondition(w)) return true;

    toast.error("Falta condición", "En capas no-base necesitas añadir al menos una condición para poder guardar.");
    return false;
  };

  const handleSave = () => {
    if (!commitActiveInteractiveDraft()) {
      return;
    }

    const nextLabel = (creating ? draftLabel : editingLayer?.label ?? "").trim();
    if (!nextLabel) {
      toast.error("Falta etiqueta", "La capa necesita una etiqueta.");
      return;
    }

    if (hasDuplicateLayerLabel) {
      toast.error("Etiqueta duplicada", "Ya existe una capa con esa etiqueta en esta escena.");
      return;
    }

    if (creating && !editingLayer) {
      toast.warning("Falta imagen", "Selecciona una imagen para crear la capa.");
      return;
    }

    if (editingLayer && !ensureLayerConditionIfRequired()) return;

    exitEdit();
  };

  const handleDelete = () => {
  if (!isEditing) return;

  removeNodeLayer(session.layerId);
  setActiveLayerId(layers[0]?.id ?? null);
  exitEdit();
};

  const handleCommitAssetId = (nextAssetId: ID) => {
    if (creating) {
      const label = draftLabel.trim() || `Capa ${layers.length + 1}`;
      const createdId = addNodeLayer({ assetId: nextAssetId, label });
      if (!createdId) return;

      setActiveLayerId(createdId);

      const st = useEditorStore.getState();
      const freshLayer = (st.nodeDraft?.layers ?? []).find((l) => l.id === createdId) ?? null;
      if (!freshLayer) return;

      setSession({ mode: "editing", layerId: createdId, isNew: true, snapshot: cloneLayer(freshLayer) });

      setCreating(false);
      setDraftLabel("");
      setActiveLayerField("image");
      return;
    }

    if (!editingLayer) return;

    const prevAssetId = (editingLayer.assetId ?? null);

    if (isNewEditing && prevAssetId && prevAssetId !== nextAssetId) cleanupAssetSafe(prevAssetId);

    if (!isNewEditing && prevAssetId && prevAssetId !== nextAssetId) {
      const snapAsset = (session.mode === "editing" ? (session.snapshot.assetId ?? null) : null);
      const prevIsSnapshot = snapAsset && prevAssetId === snapAsset;

      if (!prevIsSnapshot) cleanupAssetSafe(prevAssetId);
    }

    setLayerAssetId(nextAssetId);
  };

  const handleReorderLayers = (from: number, to: number) => {
    if (from === 0 || to === 0) return;
    if (from < 0 || to < 0) return;
    if (from >= layers.length || to >= layers.length) return;
    reorderNodeLayers(from, to);
    toast.success("Orden actualizado", "Se ha actualizado la prioridad de las capas.");
  };

  const variantItems = useMemo(() => layers.map((l) => ({ id: l.id, label: l.label ?? "" })), [layers]);

  const currentLabel = creating ? draftLabel : editingLayer?.label ?? "";
  const canShowRest = Boolean(editingLayer?.assetId);

  const normalizedCurrentLabel = currentLabel.trim().toLowerCase();

  const hasDuplicateLayerLabel = useMemo(() => {
    if (!normalizedCurrentLabel) return false;

    return layers.some((layer) => {
      if (editingLayerId && String(layer.id) === String(editingLayerId)) return false;
      return (layer.label ?? "").trim().toLowerCase() === normalizedCurrentLabel;
    });
  }, [layers, normalizedCurrentLabel, editingLayerId]);

  return (
    <>
      <ToggleFieldBlock label="Capas" active={active} onToggle={onToggle}>
        <div className="pt-2 space-y-3">
          {!isLocked ? (
            <div className="flex justify-center pt-2">
              <button type="button" className="btn btn-create-condition text-[12px]" onClick={handleAdd}>
                + Añadir capa
              </button>
            </div>
          ) : null}

          {/* Listado de capas */}
          {!isLocked && layers.length > 0 ? (
            <SceneVariantList
              title="Capas guardadas"
              variants={variantItems}
              isItemDraggable={(id) => !isBaseLayerId(id)}
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

          {/* Editor */}
          {active && editorOpen ? (
            <SceneVariantEditorShell
              labelInputRef={layerLabelInputRef}
              draftLabel={currentLabel}
              onChangeDraftLabel={(next) => {
                if (creating) setDraftLabel(next);
                else setLayerLabel(next);
              }}
              onCancel={handleCancel}
              onSave={handleSave}
              onDelete={!creating && isEditing && !isNewEditing ? handleDelete : undefined}
              saveDisabled={false}
            >
              <div className="-mx-3 space-y-3">
                <SceneImageField
                  label="Imagen"
                  value={creating ? undefined : editingLayer?.assetId}
                  active={activeLayerField === "image"}
                  onToggle={() => handleToggleLayerField("image")}
                  fileInputRef={fileInputRef}
                  onCommitAssetId={handleCommitAssetId}
                  dock={editingLayer?.dock ?? "bottom"}
                  onDockChange={setLayerDock}
                  showAddCondition={Boolean(canShowRest && editingLayer && !isBaseLayer)}
                  addConditionLabel={hasLayerCondition ? "Editar condición" : "Añadir condición"}
                  addConditionTitle={hasLayerCondition
                    ? "Editar condición de la capa"
                    : "Añadir condición (obligatoria en capas no-base)"}
                  onAddCondition={() => setOpenLayerCondModal(true)}
                />

                {canShowRest && editingLayer ? (
                  <>
                    <SceneTextField
                      active={activeLayerField === "text"}
                      onToggle={() => handleToggleLayerField("text")}
                      textareaRef={layerTextAreaRef}
                      layerId={editingLayer.id}
                      onPreview={(p) => onTextPreview?.(p.text ?? null)}
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
              </div>
            </SceneVariantEditorShell>
          ) : null}
        </div>
      </ToggleFieldBlock>

      {/* Modal condición de capa */}
      <ConditionBuilderModal
        open={openLayerCondModal}
        project={useEditorStore.getState().project}
        value={layerCondDraft}
        onClose={() => setOpenLayerCondModal(false)}
        onSave={(next) => {
          if (!editingLayer) {
            toast.error("No se pudo guardar", "No hay capa activa.");
            setOpenLayerCondModal(false);
            return;
          }

          const whenToSave = isEmptyCondition(next) ? undefined : next;
          updateNodeLayer(editingLayer.id, { when: whenToSave });

          setLayerCondDraft(next);
          setOpenLayerCondModal(false);

          toast.success("Condición guardada", "La condición se ha aplicado a la capa.");
        }}
      />
    </>
  );
}