import { useMemo, useEffect, useState, useCallback } from "react";
import type { ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateNodeDraft } from "@/features/editor/scene/node/nodeValidator";
import { SceneTitleField } from "@/features/editor/scene/fields/SceneTitleField";
import { SceneLayersField } from "@/features/editor/scene/fields/SceneLayersField";
import { SceneDialogueField } from "@/features/editor/scene/dialogues/SceneDialogueField";
import { SceneMapField } from "@/features/editor/scene/maps/SceneMapField";
import { SceneMusicField } from "@/features/editor/scene/music/SceneMusicField";
import { SceneTypeField } from "@/features/editor/scene/fields/SceneTypeField";
import { findStartConflict, getRegionInfo } from "@/features/editor/scene/node/NodeHelpers";
import { commitActiveInteractiveDrafts } from "@/features/editor/scene/interactiveComponents/interactiveDraftGuards";
import { SceneRenderPreview } from "@/features/editor/scene/preview/SceneRenderPreview";
import { useSceneFieldState, useSceneNavigation, type SceneToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { StartConflictModal } from "@/features/editor/modals/StartConflictModal";
import { ConfirmDangerModal } from "@/features/editor/modals/ConfirmDangerModal";
import { toast } from "@/shared/toast/toastStore";

export function SceneEditorView() {
  const project = useEditorStore((s) => s.project);

  const nodeMode = useEditorStore((s) => s.nodeMode);
  const editingNodeId = useEditorStore((s) => s.editingNodeId);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);

  const enterCreateNodeMode = useEditorStore((s) => s.enterCreateNodeMode);
  const cancelNodeDraft = useEditorStore((s) => s.cancelNodeDraft);
  const commitNode = useEditorStore((s) => s.commitNode);
  const deleteNode = useEditorStore((s) => s.deleteNode);

  const setActiveLayerId = useEditorStore((s) => s.setActiveLayerId);
  const setNodeMapLocation = useEditorStore((s) => s.setNodeMapLocation);
  const setNodeTitle = useEditorStore((s) => s.setNodeTitle);
  const setNodeIsStart = useEditorStore((s) => s.setNodeIsStart);
  const setNodeIsFinal = useEditorStore((s) => s.setNodeIsFinal);

  const hotspotEditor = useEditorStore((s) => s.hotspotEditor);
  const placedItemEditor = useEditorStore((s) => s.placedItemEditor);
  const placedNpcEditor = useEditorStore((s) => s.placedNpcEditor);
  const placedPlayerEditor = useEditorStore((s) => s.placedPlayerEditor);

  const commitHotspotDraft = useEditorStore((s) => s.commitHotspotDraft);
  const commitPlacedItemDraft = useEditorStore((s) => s.commitPlacedItemDraft);
  const commitPlacedNpcDraft = useEditorStore((s) => s.commitPlacedNpcDraft);
  const commitPlacedPlayerDraft = useEditorStore((s) => s.commitPlacedPlayerDraft);

  const nodeErrors = useEditorStore((s) => s.nodeErrors);
  const setNodeErrors = useEditorStore((s) => s.setNodeErrors);
  const clearNodeErrors = useEditorStore((s) => s.clearNodeErrors);

  const isEditing = nodeMode === "editing" && Boolean(editingNodeId);
  const header = isEditing ? "Editar escena" : "Crear escena";

  const [textPreview, setTextPreview] = useState<string | null>(null);

  const { activeField, setActiveField, titleInputRef } = useSceneFieldState();
  const { goToHistoriaVista } = useSceneNavigation();

  const title = nodeDraft?.title ?? "";
  const isStart = Boolean(nodeDraft?.isStart);
  const isFinal = Boolean(nodeDraft?.isFinal);

  /* Primer error “global” que merece mostrarse arriba del formulario */
  const rootIssue = nodeErrors.title ?? nodeErrors.layers ?? nodeErrors.mapLocation ?? nodeErrors.musicTrackId ?? nodeErrors.isFinal ?? nodeErrors.isStart ?? nodeErrors.meta;

  /* ID a excluir en validaciones/conflictos */
  const excludeId = useMemo<ID | null>(() => (isEditing && editingNodeId ? editingNodeId : null), [isEditing, editingNodeId]);

  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");

  const [isMapEntryConflictModalOpen, setMapEntryConflictModalOpen] = useState(false);
  const [existingRegionEntryTitle, setExistingRegionEntryTitle] = useState("");

  const clearTextPreview = useCallback(() => setTextPreview(null), []);
  const navigateOut = useCallback(() => goToHistoriaVista(), [goToHistoriaVista]);

  useEffect(() => clearNodeErrors(), [nodeDraft?.id, clearNodeErrors]);

  const closeStartModal = useCallback(() => {
    setStartModalOpen(false);
    setExistingStartTitle("");
  }, []);

  const closeMapEntryConflictModal = useCallback(() => {
    setMapEntryConflictModalOpen(false);
    setExistingRegionEntryTitle("");
  }, []);

  /* Intenta cerrar/guardar cualquier editor interactivo abierto dentro de capas antes de abandonar el panel o guardar la escena */
  const commitActiveInteractiveDraftsForScene = useCallback(() =>
    commitActiveInteractiveDrafts({
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
    }), [hotspotEditor.mode, hotspotEditor.draft, placedItemEditor.mode, placedItemEditor.draft, placedNpcEditor.mode, placedNpcEditor.draft,
    placedPlayerEditor.mode, placedPlayerEditor.draft, commitHotspotDraft, commitPlacedItemDraft, commitPlacedNpcDraft, commitPlacedPlayerDraft],
  );

  /* Decide si se puede salir del campo activo actual */
  const canLeaveSceneField = useCallback((): boolean => {
    if (activeField !== "layers") return true;
    return commitActiveInteractiveDraftsForScene();
  }, [activeField, commitActiveInteractiveDraftsForScene]);

  /* Alterna la apertura/cierre de un bloque del editor */
  const handleToggleSceneField = useCallback(
    (next: SceneToggleFieldId) => {
      if (activeField === next) {
        if (!canLeaveSceneField()) return;
        setActiveField(null);
        return;
      }

      if (!canLeaveSceneField()) return;
      setActiveField(next);
    }, [activeField, canLeaveSceneField, setActiveField],
  );

  const openInteractiveFieldFromPreview = useCallback((field: "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers") => {
    if (!canLeaveSceneField()) return;

    if (activeField !== "layers") setActiveField("layers");

    const { activeLayerId, activeLayerField, setActiveLayerField } = useEditorStore.getState();

    if (!activeLayerId) {
      toast.warning("No hay capa activa", "Selecciona una capa antes de editar elementos interactivos.");
      return;
    }

    if (activeLayerField !== field) setActiveLayerField(field);
  }, [activeField, canLeaveSceneField, setActiveField],
);

  /* En modo creación, si hay proyecto pero aún no hay borrador, entra automáticamente en creación de escena */
  useEffect(() => {
    if (!project) return;
    if (isEditing) return;
    if (nodeDraft) return;

    enterCreateNodeMode();
  }, [project, isEditing, nodeDraft, enterCreateNodeMode]);

  /* En creación abrimos por defecto el título. En edición dejamos todos cerrados inicialmente */
  useEffect(() => {
  setActiveField(isEditing ? null : "title");
  clearTextPreview();
}, [nodeDraft?.id, isEditing, setActiveField, clearTextPreview]);

  /* Al cargar otra escena en el editor, activamos por defecto su capa base */
  useEffect(() => {
    if (!nodeDraft) return;

    const baseId = nodeDraft.layers?.[0]?.id ?? null;
    setActiveLayerId(baseId);
  }, [nodeDraft?.id, setActiveLayerId]);

  /* Commit final + feedback + salida del editor */
  const doCommitWithToastAndExit = useCallback(() => {
    const res = commitNode();
    if (!res) return;

    clearNodeErrors();

    const label = (res.title ?? "").trim() || "Escena";

    toast.success(res.mode === "creating" ? "Escena creada" : "Cambios guardados", `“${label}”`);

    cancelNodeDraft();
    navigateOut();
  }, [commitNode, clearNodeErrors, cancelNodeDraft, navigateOut]);

  /* Commit específico cuando la escena pertenece a una región de mapa y puede ser o no la entrada de dicha región */
  const doCommitSceneWithMapEntry = useCallback(
    (forceIsEntry?: boolean) => {
      const latestDraft = useEditorStore.getState().nodeDraft;

      if (!latestDraft?.mapLocation) {
        doCommitWithToastAndExit();
        return;
      }

      const nextIsEntry = typeof forceIsEntry === "boolean" ? forceIsEntry : Boolean(latestDraft.mapLocation.isEntry);

      setNodeMapLocation({ mapId: latestDraft.mapLocation.mapId, regionId: latestDraft.mapLocation.regionId, isEntry: nextIsEntry });

      doCommitWithToastAndExit();
    }, [setNodeMapLocation, doCommitWithToastAndExit],
  );

  /* Acción principal: validar, detectar conflictos y guardar */
  const handlePrimary = useCallback(() => {
    if (!project) return;

    if (!commitActiveInteractiveDraftsForScene()) return;

    const latestDraft = useEditorStore.getState().nodeDraft;
    if (!latestDraft || !project) return;

    const res = validateNodeDraft(latestDraft, { project, currentNodeId: excludeId });

    setNodeErrors(res.errors);

    if (!res.ok) {
      const first = res.errors.title ?? res.errors.layers ?? res.errors.mapLocation ?? res.errors.musicTrackId ??
        res.errors.isFinal ?? res.errors.isStart ?? res.errors.meta ?? "Revisa el formulario.";

      toast.error("No se pudo guardar", first);
      return;
    }

    const startConflict = findStartConflict({ nodes: project.nodes ?? [], wantsStart: Boolean(latestDraft.isStart), excludeId });

    if (startConflict) {
      setExistingStartTitle(startConflict.title);
      setStartModalOpen(true);
      return;
    }

    const regionInfo = getRegionInfo({ nodes: project.nodes ?? [], nodeDraft: latestDraft, excludeId, currentNodeId: editingNodeId ?? latestDraft.id });

    if (!regionInfo) {
      doCommitWithToastAndExit();
      return;
    }

    const wantsEntry = Boolean(latestDraft.mapLocation?.isEntry);
    const currentEntry = regionInfo.currentEntry;

    if (!regionInfo.hasAnyOtherScene) {
      doCommitSceneWithMapEntry(true);
      return;
    }

    if (wantsEntry && currentEntry && currentEntry.id !== (editingNodeId ?? latestDraft.id)) {
      const entryTitle = (currentEntry.title ?? "").trim() || String(currentEntry.id);

      setExistingRegionEntryTitle(entryTitle);
      setMapEntryConflictModalOpen(true);
      return;
    }

    doCommitSceneWithMapEntry();
  }, [project, excludeId, editingNodeId, commitActiveInteractiveDraftsForScene, setNodeErrors, doCommitWithToastAndExit, doCommitSceneWithMapEntry]);

  /* Cancelación del editor */
  const handleSecondary = useCallback(() => {
    clearNodeErrors();
    cancelNodeDraft();
    navigateOut();
  }, [clearNodeErrors, cancelNodeDraft, navigateOut]);

  /* Eliminación de escena ya existente */
  const handleDelete = useCallback(() => {
    if (!editingNodeId) return;

    deleteNode(editingNodeId);
  }, [editingNodeId, deleteNode]);

  /* Confirmaciones/cancelaciones de modales */
  const confirmReplace = useCallback(() => {
    doCommitWithToastAndExit();
    closeStartModal();
  }, [doCommitWithToastAndExit, closeStartModal]);

  const cancelKeepExistingStart = useCallback(() => {
    setNodeIsStart(false);
    doCommitWithToastAndExit();
    closeStartModal();
  }, [setNodeIsStart, doCommitWithToastAndExit, closeStartModal]);

  const confirmReplaceRegionEntry = useCallback(() => {
    doCommitSceneWithMapEntry(true);
    closeMapEntryConflictModal();
  }, [doCommitSceneWithMapEntry, closeMapEntryConflictModal]);

  const cancelKeepExistingRegionEntry = useCallback(() => {
    doCommitSceneWithMapEntry(false);
    closeMapEntryConflictModal();
  }, [doCommitSceneWithMapEntry, closeMapEntryConflictModal]);

  if (!nodeDraft) return null;

  return (
    <div className="scene-editor-layout">
      {/* Panel izquierdo: formulario */}
      <section className="scene-editor-panel-left editor-scroll">
        <h4 className="text-base font-semibold text-slate-100">{header}</h4>

        {/* Error global */}
        {rootIssue ? (
          <div className="mt-2 rounded-md border-2 border-red-500/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {rootIssue}
          </div>
        ) : null}

        <div className="mt-2 space-y-2 text-sm text-slate-200">
          {/* Título */}
          <SceneTitleField
            value={title}
            active={activeField === "title"}
            onToggle={() => handleToggleSceneField("title")}
            inputRef={titleInputRef}
            onChange={setNodeTitle}
            onEnterDone={() => setActiveField("layers")}
          />

          {/* Capas */}
          <SceneLayersField
            active={activeField === "layers"}
            onToggle={() => handleToggleSceneField("layers")}
            onTextPreview={setTextPreview}
            onClearTextPreview={clearTextPreview}
          />

          {/* Diálogos */}
          <SceneDialogueField
            active={activeField === "dialogues"}
            onToggle={() => handleToggleSceneField("dialogues")}
          />

          {/* Mapa */}
          <SceneMapField
            active={activeField === "map"}
            onToggle={() => handleToggleSceneField("map")}
          />

          {/* Música */}
          <SceneMusicField
            active={activeField === "music"}
            onToggle={() => handleToggleSceneField("music")}
          />

          {/* Flags start/final */}
          <SceneTypeField
            isStart={isStart}
            isFinal={isFinal}
            onToggleStart={() => setNodeIsStart(!isStart)}
            onToggleFinal={() => setNodeIsFinal(!isFinal)}
          />
        </div>

        {/* Barra inferior */}
        <div className="mt-4 flex items-center justify-between border-t-2 border-slate-600 pt-3">
          <div className="flex items-center gap-2">
            {isEditing ? (
              <button
                type="button"
                onClick={handleDelete}
                className="btn btn-danger-condition text-[12px]"
              >
                Eliminar
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSecondary}
              className="btn btn-close-condition bg-slate-800 text-[12px] hover:bg-slate-600"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handlePrimary}
              className="btn btn-create-condition text-[12px] text-white"
            >
              {isEditing ? "Guardar cambios" : "Crear escena"}
            </button>
          </div>
        </div>
      </section>

      {/* Panel derecho: preview */}
      <section className="scene-editor-panel-right">
        <SceneRenderPreview
          textPreview={textPreview}
          onOpenInteractiveField={openInteractiveFieldFromPreview}
        />
      </section>

      {/* Conflicto de escena inicial */}
      <StartConflictModal
        open={isStartModalOpen}
        currentStartTitle={existingStartTitle}
        editingTitle={title}
        onConfirmReplace={confirmReplace}
        onCancelKeep={cancelKeepExistingStart}
      />

      {/* Conflicto de puerta de entrada de región */}
      <ConfirmDangerModal
        open={isMapEntryConflictModalOpen}
        title="Sustituir puerta de entrada"
        description={existingRegionEntryTitle
          ? `La región ya tiene una escena de entrada: “${existingRegionEntryTitle}”. ¿Quieres sustituirla por la escena actual?`
          : "La región ya tiene una escena de entrada. ¿Quieres sustituirla por la escena actual?"}
        confirmText="Sí, sustituir"
        cancelText="No, mantener actual"
        onCancel={cancelKeepExistingRegionEntry}
        onConfirm={confirmReplaceRegionEntry}
      />
    </div>
  );
}