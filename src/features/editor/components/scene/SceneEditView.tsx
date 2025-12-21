import { useState } from "react";
import type { Hotspot } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";

import {
  ScenePreviewCard,
  SceneTitleField,
  SceneTextField,
  SceneImageField,
  SceneHotspotField,
  SceneTagField,
  SceneEntityField,
  SceneTypeField,
  SceneFooter,
  SceneFooterButton,
  useSceneFieldState,
  useSceneNavigation,
  useResolvedSceneImage,
  useSceneFieldErrors,
} from "@/features/editor/components/scene";

import { StartConflictModal, DeleteSceneModal } from "@/features/editor/components/modals";
import {
  useSceneValidation,
  useSceneImageUpload,
  useSceneTagsLogic,
  useSceneHotspotsLogic,
  useSceneEntitiesLogic,
} from "@/features/editor/hooks";

import { buildScenePreviewMeta } from "@/features/editor/utils";

export function SceneEditView() {
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

  const focusedHotspotId = useEditorStore((s) => s.focusedHotspotId);
  const setFocusedHotspotId = useEditorStore((s) => s.setFocusedHotspotId);

  const clearStartFlagFromAllNodes = useEditorStore((s) => s.clearStartFlagFromAllNodes);

  // Placement API
  const beginPlaceItemForActiveScene = useEditorStore((s) => s.beginPlaceItemForActiveScene);
  const beginPlaceNpcForActiveScene = useEditorStore((s) => s.beginPlaceNpcForActiveScene);
  const beginEditPlacedItemForActiveScene = useEditorStore((s) => s.beginEditPlacedItemForActiveScene);
  const beginEditPlacedNpcForActiveScene = useEditorStore((s) => s.beginEditPlacedNpcForActiveScene);

  const registerAssetFile = useEditorStore.getState().registerAssetFile;
  const { goToHistoriaVista } = useSceneNavigation();

  const { activeField, setActiveField, toggleField, titleInputRef, textAreaRef } = useSceneFieldState([selectedNodeId]);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");

  const currentNode =
    sceneMode === "editing" && project && selectedNodeId
      ? project.nodes.find((n) => n.id === selectedNodeId) ?? null
      : null;

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

  const { validateNow, issues } = useSceneValidation({ mode: "edit", currentNodeId: currentNode.id });
  const { titleError, textError, imageError, hotspotErrors, musicError, mapError } = useSceneFieldErrors(issues);

  const {
    fileInputRef,
    imageLocalError,
    isImageDragging,
    handleImageChange,
    handleImageDragOver,
    handleImageDragLeave,
    handleImageDrop,
  } = useSceneImageUpload({
    onImagePathChange: (relativePath) => updateSelectedNodeFields({ image: relativePath }),
    registerAssetFile,
  });

  const resolvedImageUrl = useResolvedSceneImage(currentNode.image);
  const hotspots: Hotspot[] = currentNode.hotspots ?? [];

  /* Tags (music/map) */
  const tagsLogic = useSceneTagsLogic({
    project,
    musicId: currentNode.musicId,
    mapId: currentNode.mapId,
    onUpdateTags: (update) => updateSelectedNodeFields(update),
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

  /* Entities (items/npcs colocados en escena) */
  const entitiesLogic = useSceneEntitiesLogic({
    project,
    placedItems: currentNode.placedItems ?? [],
    placedNpcs: currentNode.placedNpcs ?? [],
    onUpdateEntities: (update) => updateSelectedNodeFields(update),
    onRequestPlace: (kind, resourceId) => {
      if (!currentNode.image) return;
      if (kind === "item") beginPlaceItemForActiveScene(resourceId);
      else beginPlaceNpcForActiveScene(resourceId);
    },
    onRequestEdit: (kind, instanceId) => {
      if (!currentNode.image) return;
      if (kind === "item") beginEditPlacedItemForActiveScene(instanceId);
      else beginEditPlacedNpcForActiveScene(instanceId);
    },
  });

  const {
    entities,
    entityTypeOptions,
    getResourcesForKind,
    isAdding: isAddingEntity,
    newKind,
    newResourceId,
    resourcesForNewKind,
    localError: entityLocalError,
    handleStartAdd,
    handleCancelAdd,
    handleNewKindChange,
    handleNewResourceChange,
    handleConfirmAdd,
    handleExistingEntityResourceChange,
    handleRemoveEntity,
  } = entitiesLogic;

  /* Preview meta */
  const { mapLabel, npcLabel, itemLabel, musicLabel, musicFilePath } = buildScenePreviewMeta(project, currentNode);
  const musicUrl = useResolvedSceneImage(musicFilePath);

  const handleSaveChanges = () => {
    const draftLike = {
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

    const { ok } = validateNow(draftLike);
    if (!ok) return;

    if (!draftLike.isStart) {
      goToHistoriaVista();
      return;
    }

    const existingStart = project?.nodes.find((n) => n.isStart && n.id !== currentNode.id);
    if (!existingStart) {
      goToHistoriaVista();
      return;
    }

    setExistingStartTitle(existingStart.title || existingStart.id);
    setStartModalOpen(true);
  };

  const confirmReplace = () => {
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

  const {
    canBindHotspotTargets,
    availableNodesByHotspotId,
    activeDrawingHotspotId,
    resolveNodeLabel,
    handleAddHotspot,
    handleHotspotRemove,
    handleHotspotActionChange,
    handleHotspotTargetChange,
    handleStartDrawing,
  } = useSceneHotspotsLogic({
    mode: "edit",
    project,
    hotspots,
    contextNodeId: currentNode.id,
    addHotspot: addHotspotToActiveScene,
    removeHotspot: removeHotspotFromActiveScene,
    setHotspotAction: (hotspotId, actionType) => setHotspotActionForActiveScene(hotspotId, actionType as any),
    updateHotspotTarget: updateHotspotTargetForActiveScene,
    activeDrawingHotspotId: activeHotspotDrawingId,
    setActiveHotspotDrawingId,
    clearHotspotShape: clearHotspotShapeForActiveScene,
    hasImage: !!currentNode.image,
  });

  const handleToggleStart = () => {
    if (currentNode.isStart) updateSelectedNodeFields({ isStart: false });
    else updateSelectedNodeFields({ isStart: true, isFinal: false });
  };

  const handleToggleFinal = () => {
    if (currentNode.isFinal) updateSelectedNodeFields({ isFinal: false });
    else updateSelectedNodeFields({ isFinal: true, isStart: false });
  };

  const handleDeleteConfirm = () => {
    deleteSelectedNode();
    setIsDeleteModalOpen(false);
    goToHistoriaVista();
  };

  return (
    <>
      <div className="scene-editor-layout">
        <section className="scene-editor-panel-left">
          <h4 className="text-base font-semibold text-slate-100">Editar escena</h4>

          <div className="space-y-2 text-sm text-slate-200">
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

            <SceneTextField
              value={currentNode.text ?? ""}
              error={textError}
              active={activeField === "text"}
              onToggle={() => toggleField("text")}
              textareaRef={textAreaRef}
              onChange={(val) => updateSelectedNodeFields({ text: val })}
              onMarkDone={() => setActiveField(null)}
            />

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
              hasImage={!!currentNode.image}
              focusedHotspotId={focusedHotspotId}
              onFocusHotspot={(id) => setFocusedHotspotId(focusedHotspotId === id ? null : id)}
              onClearFocus={() => setFocusedHotspotId(null)}
            />

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
              musicError={musicError}
              mapError={mapError}
            />

            <SceneEntityField
              label="Entidades en escena"
              active={activeField === "entities"}
              onToggle={() => toggleField("entities")}
              entityTypeOptions={entityTypeOptions}
              entities={entities}
              getResourcesForKind={getResourcesForKind}
              isAdding={isAddingEntity}
              newKind={newKind}
              newResourceId={newResourceId}
              resourcesForNewKind={resourcesForNewKind}
              localError={entityLocalError}
              onStartAdd={handleStartAdd}
              onCancelAdd={handleCancelAdd}
              onConfirmAdd={handleConfirmAdd}
              onNewKindChange={handleNewKindChange}
              onNewResourceChange={handleNewResourceChange}
              onExistingEntityResourceChange={handleExistingEntityResourceChange}
              onRemoveEntity={handleRemoveEntity}
              onRequestPlace={entitiesLogic.handleRequestPlace}
              onRequestEdit={entitiesLogic.handleRequestEdit}
              canPlaceOnScene={!!currentNode.image}
              placeDisabledReason="Carga una imagen para poder dibujar/colocar."
            />

            <SceneTypeField
              isStart={!!currentNode.isStart}
              isFinal={!!currentNode.isFinal}
              onToggleStart={handleToggleStart}
              onToggleFinal={handleToggleFinal}
            />
          </div>

          <SceneFooter justify="between">
            <SceneFooterButton label="Eliminar escena" variant="danger" onClick={() => setIsDeleteModalOpen(true)} />
            <SceneFooterButton label="Guardar cambios" variant="primary" onClick={handleSaveChanges} />
          </SceneFooter>
        </section>

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

      <DeleteSceneModal open={isDeleteModalOpen} onCancel={() => setIsDeleteModalOpen(false)} onConfirm={handleDeleteConfirm} />

      <StartConflictModal
        open={isStartModalOpen}
        currentStartTitle={existingStartTitle}
        onConfirmReplace={confirmReplace}
        onCancelKeep={cancelReplace}
      />
    </>
  );
}
