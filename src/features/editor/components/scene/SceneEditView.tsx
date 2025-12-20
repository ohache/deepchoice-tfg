import { useState } from "react";
import type { Hotspot } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";

import { ScenePreviewCard, SceneTitleField, SceneTextField, SceneImageField, SceneHotspotField, SceneTagField,
  SceneTypeField, SceneFooter, SceneFooterButton, useSceneFieldState, useSceneNavigation, useResolvedSceneImage,
  useSceneFieldErrors } from "@/features/editor/components/scene";

import { StartConflictModal, DeleteSceneModal } from "@/features/editor/components/modals";
import { useSceneValidation, useSceneImageUpload, useSceneTagsLogic, useSceneHotspotsLogic } from "@/features/editor/hooks";
import { buildScenePreviewMeta } from "@/features/editor/utils";

export function SceneEditView() {
  /* Estado global del editor */
  const project = useEditorStore((s) => s.project);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const sceneMode = useEditorStore((s) => s.sceneMode);

  const updateSelectedNodeFields = useEditorStore((s) => s.updateSelectedNodeFields);
  const addHotspotToActiveScene = useEditorStore((s) => s.addHotspotToActiveScene);
  const updateHotspotTargetForActiveScene = useEditorStore((s) => s.updateHotspotTargetForActiveScene);
  const removeHotspotFromActiveScene = useEditorStore((s) => s.removeHotspotFromActiveScene);
  const deleteSelectedNode = useEditorStore((s) => s.deleteSelectedNode);

  const activeHotspotDrawingId = useEditorStore((s) => s.activeHotspotDrawingId);
  const setActiveHotspotDrawingId = useEditorStore((s) => s.setActiveHotspotDrawingId);
  const setHotspotActionForActiveScene = useEditorStore((s) => s.setHotspotActionForActiveScene);
  const clearHotspotShapeForActiveScene = useEditorStore((s) => s.clearHotspotShapeForActiveScene);

  const registerAssetFile = useEditorStore.getState().registerAssetFile;
  const { goToHistoriaVista } = useSceneNavigation();

  /* Estado de campos de la escena */
  const { activeField, setActiveField, toggleField, titleInputRef, textAreaRef } = useSceneFieldState([selectedNodeId]);

  /* Estado local de la UI*/
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");
  const clearStartFlagFromAllNodes = useEditorStore((s) => s.clearStartFlagFromAllNodes);

  const focusedHotspotId = useEditorStore((s) => s.focusedHotspotId);
  const setFocusedHotspotId = useEditorStore((s) => s.setFocusedHotspotId);

  /* Resolución de la escena actual */
  const currentNode = sceneMode === "editing" && project && selectedNodeId
    ? project.nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  if (sceneMode === "editing" && !currentNode) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
        No se ha encontrado la escena seleccionada. Elige una escena desde{" "}
        <span className="font-semibold mx-1">Listar</span> o cambia a modo{" "}
        <span className="font-semibold mx-1">Crear</span>.
      </div>
    );
  }

  if (!currentNode) return null;

  /* Validación */
  const { validateNow, issues } = useSceneValidation({ mode: "edit", currentNodeId: currentNode?.id });
  const { titleError, textError, imageError, hotspotErrors, musicError, mapError, npcErrors, itemError } = useSceneFieldErrors(issues);

  /* Imagen resuelta, hotspots y nodos disponibles */
  const { fileInputRef, imageLocalError, isImageDragging, handleImageChange, handleImageDragOver, handleImageDragLeave, handleImageDrop } = 
    useSceneImageUpload({onImagePathChange: (relativePath) => updateSelectedNodeFields({ image: relativePath }),registerAssetFile });

  const resolvedImageUrl = useResolvedSceneImage(currentNode.image);
  const hotspots: Hotspot[] = currentNode.hotspots ?? [];

  /* Estado local para Etiquetas */
  const tagsLogic = useSceneTagsLogic({
  project,
    musicId: currentNode.musicId,
    mapId: currentNode.mapId,
    placedItems: currentNode.placedItems,
    placedNpcs: currentNode.placedNpcs,
    onUpdateTags: (update) => updateSelectedNodeFields(update),
    onRequestPlace: (kind, resourceId) => {
      if (kind === "item") useEditorStore.getState().beginPlaceItemForActiveScene(resourceId);
      else useEditorStore.getState().beginPlaceNpcForActiveScene(resourceId);
    },
  });

const {
  sceneTags,
  tagTypeOptions,
  getItemsForTagType,
  isAddingTag,
  newTagType,
  newTagId,
  tagLocalError,
  itemsForNewTagType,
  handleStartAddTag,
  handleCancelAddTag,
  handleNewTagTypeChange,
  handleNewTagValueChange,
  handleConfirmAddTag,
  handleExistingTagChange,
  handleRemoveTag,
} = tagsLogic;


  // ==== Etiquetas para la preview ====
  const { mapLabel, npcLabel, itemLabel, musicLabel, musicFilePath } = buildScenePreviewMeta(project, currentNode);
  const musicUrl = useResolvedSceneImage(musicFilePath);

  /* Helper (borrador) */
  const buildDraftFromCurrentNode = () => {
    if (!currentNode) return null;

    return {
      title: currentNode.title,
      text: currentNode.text,
      image: currentNode.image,
      hotspots: currentNode.hotspots ?? [],
      musicId: currentNode.musicId,
      mapId: currentNode.mapId,
      placedItems: currentNode.placedItems ?? [],
      placedNpcs: currentNode.placedNpcs ?? [],
      isStart: currentNode.isStart,
      isFinal: currentNode.isFinal,
      meta: currentNode.meta,
    };
  };


  /* Handlers para guardar cambios y conflico de escena inicial */
  const handleSaveChanges = () => {
    if (!currentNode) return;

    const draftLike = buildDraftFromCurrentNode();
    if (!draftLike) return;

    const { ok } = validateNow(draftLike);

    if (!ok) return;

    if (!draftLike.isStart) {
      goToHistoriaVista();
      return;
    }

    const existingStart = project?.nodes.find((n) => n.isStart && n.id !== currentNode.id);
    console.log({ existingStart });

    if (!existingStart) {
      goToHistoriaVista();
      return;
    }

    setExistingStartTitle(existingStart.title || existingStart.id);
    setStartModalOpen(true);
  };

  const confirmReplace = () => {
    if (!currentNode) {
      setStartModalOpen(false);
      return;
    }

    clearStartFlagFromAllNodes();
    updateSelectedNodeFields({ isStart: true });

    setStartModalOpen(false);
    goToHistoriaVista();
  };

  const cancelReplace = () => {
    updateSelectedNodeFields({ isStart: false });

    setStartModalOpen(false);
    goToHistoriaVista();
  };

  /* Handlers para hotspots */
  const { canBindHotspotTargets, availableNodesByHotspotId, activeDrawingHotspotId, resolveNodeLabel,
      handleAddHotspot, handleHotspotRemove, handleHotspotActionChange, handleHotspotTargetChange, handleStartDrawing } =
      useSceneHotspotsLogic({ mode: "edit", project, hotspots, contextNodeId: currentNode.id, addHotspot: addHotspotToActiveScene,
      removeHotspot: removeHotspotFromActiveScene, setHotspotAction: setHotspotActionForActiveScene, updateHotspotTarget: updateHotspotTargetForActiveScene,
      activeDrawingHotspotId: activeHotspotDrawingId, setActiveHotspotDrawingId, clearHotspotShape: clearHotspotShapeForActiveScene, hasImage: !!currentNode.image });

  /* Handlers para Inicio/Final */
  const handleToggleStart = () => {
    if (!currentNode) return;

    if (currentNode.isStart) {
      updateSelectedNodeFields({ isStart: false });
    } else {
      updateSelectedNodeFields({
        isStart: true,
        isFinal: false,
      });
    }
  };

  const handleToggleFinal = () => {
    if (!currentNode) return;

    if (currentNode.isFinal) {
      updateSelectedNodeFields({ isFinal: false });
    } else {
      updateSelectedNodeFields({
        isFinal: true,
        isStart: false,
      });
    }
  };

  /* Handler para eliminación de escena */
  const handleDeleteConfirm = () => {
    deleteSelectedNode();
    setIsDeleteModalOpen(false);
    goToHistoriaVista();
  };

  return (
    <>
      <div className="scene-editor-layout">
        {/* Panel izquierdo: formulario */}
        <section className="scene-editor-panel-left">
          <h4 className="text-base font-semibold text-slate-100">
            Editar escena
          </h4>

          <div className="space-y-2 text-sm text-slate-200">
            {/* Título */}
            <SceneTitleField
              value={currentNode.title ?? ""}
              error={titleError}
              active={activeField === "title"}
              onToggle={() => toggleField("title")}
              inputRef={titleInputRef}
              onChange={(val) => updateSelectedNodeFields({ title: val })}
              onEnterDone={() => {
                setActiveField("text");
                setTimeout(() => {
                  textAreaRef.current?.focus();
                  textAreaRef.current?.select();
                }, 0);
              }}
            />

            {/* Texto */}
            <SceneTextField
              value={currentNode.text ?? ""}
              error={textError}
              active={activeField === "text"}
              onToggle={() => toggleField("text")}
              textareaRef={textAreaRef}
              onChange={(val) => updateSelectedNodeFields({ text: val })}
              onMarkDone={() => setActiveField(null)}
            />

            {/* Imagen */}
            <SceneImageField
              value={currentNode.image}
              schemaError={imageError}
              localError={imageLocalError}
              active={activeField === "image"}
              onToggle={() => toggleField("image")}
              isDragging={isImageDragging}
              onDragOver={handleImageDragOver}
              onDragLeave={handleImageDragLeave}
              onDrop={handleImageDrop}
              fileInputRef={fileInputRef}
              onFileChange={handleImageChange}
            />

            {/* Hotspot */}
            <SceneHotspotField
              label="Hotspots"
              active={activeField === "hotspots"}
              onToggle={() => toggleField("hotspots")}
              hotspots={hotspots}
              canBindTargets={canBindHotspotTargets}
              availableNodesByHotspotId={availableNodesByHotspotId}
              onChangeAction={handleHotspotActionChange}
              onChangeTarget={handleHotspotTargetChange}
              onStartDrawing={handleStartDrawing}
              activeDrawingHotspotId={activeDrawingHotspotId}
              onRemoveHotspot={handleHotspotRemove}
              onAddHotspot={handleAddHotspot}
              hotspotErrors={hotspotErrors}
              noScenesMessage="Para crear hotspots de navegación necesitas al menos dos escenas en el proyecto."
              emptyHotspotsMessage="Aún no hay hotspots en esta escena. Puedes crear uno para ir a otra escena."
              resolveNodeLabel={resolveNodeLabel}
              selectPlaceholderWhenActive="Selecciona destino…"
              selectPlaceholderWhenDisabled="No hay escenas disponibles"
              hasImage={!!currentNode?.image}
              focusedHotspotId={focusedHotspotId}
              onFocusHotspot={(id) => setFocusedHotspotId(focusedHotspotId === id ? null : id)}
              onClearFocus={() => setFocusedHotspotId(null)}
            />

            {/* Etiquetas */}
            <SceneTagField
              label="Etiquetas"
              active={activeField === "tags"}
              onToggle={() => toggleField("tags")}
              tagTypeOptions={tagTypeOptions}
              sceneTags={sceneTags}
              getItemsForTagType={getItemsForTagType}
              isAddingTag={isAddingTag}
              newTagType={newTagType}
              newTagId={newTagId}
              itemsForNewTagType={itemsForNewTagType}
              tagLocalError={tagLocalError}
              onStartAddTag={handleStartAddTag}
              onCancelAddTag={handleCancelAddTag}
              onConfirmAddTag={handleConfirmAddTag}
              onNewTagTypeChange={handleNewTagTypeChange}
              onNewTagValueChange={handleNewTagValueChange}
              onExistingTagChange={handleExistingTagChange}
              onRemoveTag={handleRemoveTag}
              onRequestPlaceTag={tagsLogic.handleRequestPlaceTag}
              canPlaceOnScene={!!currentNode.image}
              placeDisabledReason="Carga una imagen para poder dibujar/colocar."
              musicError={musicError}
              mapError={mapError}
              itemError={itemError}
              npcErrors={npcErrors}
            />

            {/* Inicio / Final */}
            <SceneTypeField
              isStart={!!currentNode.isStart}
              isFinal={!!currentNode.isFinal}
              onToggleStart={handleToggleStart}
              onToggleFinal={handleToggleFinal}
            />
          </div>

          {/* Botones inferiores */}
          <SceneFooter justify="between">
            <SceneFooterButton
              label="Eliminar escena"
              variant="danger"
              onClick={() => setIsDeleteModalOpen(true)}
            />

            <SceneFooterButton
              label="Guardar cambios"
              variant="primary"
              onClick={handleSaveChanges}
            />
          </SceneFooter>
        </section>

        {/* Panel de previsualización */ }
        <section className="scene-editor-panel-right">
          <ScenePreviewCard
            title={currentNode.title ?? ""}
            text={currentNode.text ?? ""}
            imageLogicalPath={resolvedImageUrl}
            mapLabel={mapLabel}
            npcLabel={npcLabel}
            itemLabel={itemLabel}
            musicLabel={musicLabel}
            musicUrl={musicUrl}
          />
        </section>
      </div>

      {/* Modal de eliminación */}
      <DeleteSceneModal
        open={isDeleteModalOpen}
        onCancel={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteConfirm}
      />

      <StartConflictModal
        open={isStartModalOpen}
        currentStartTitle={existingStartTitle}
        onConfirmReplace={confirmReplace}
        onCancelKeep={cancelReplace}
      />
    </>
  );
}