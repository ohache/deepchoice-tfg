import { useEffect, useState } from "react";
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

import { StartConflictModal } from "@/features/editor/components/modals";

import {
  useSceneValidation,
  useSceneImageUpload,
  useSceneTagsLogic,
  useSceneHotspotsLogic,
  useSceneEntitiesLogic,
} from "@/features/editor/hooks";

import { buildScenePreviewMeta } from "@/features/editor/utils";
import type { Node } from "@/domain/types";

export function SceneCreateView() {
  /* Estado global del editor */
  const project = useEditorStore((s) => s.project);
  const sceneMode = useEditorStore((s) => s.sceneMode);
  const draftScene = useEditorStore((s) => s.draftScene);

  const enterCreateMode = useEditorStore((s) => s.enterCreateMode);
  const updateDraftFields = useEditorStore((s) => s.updateDraftFields);
  const commitDraftAsNode = useEditorStore((s) => s.commitDraftAsNode);

  // Hotspots
  const addHotspotToActiveScene = useEditorStore((s) => s.addHotspotToActiveScene);
  const updateHotspotTargetForActiveScene = useEditorStore((s) => s.updateHotspotTargetForActiveScene);
  const removeHotspotFromActiveScene = useEditorStore((s) => s.removeHotspotFromActiveScene);

  const activeHotspotDrawingId = useEditorStore((s) => s.activeHotspotDrawingId);
  const setActiveHotspotDrawingId = useEditorStore((s) => s.setActiveHotspotDrawingId);

  const setHotspotActionForActiveScene = useEditorStore((s) => s.setHotspotActionForActiveScene);
  const clearHotspotShapeForActiveScene = useEditorStore((s) => s.clearHotspotShapeForActiveScene);

  const focusedHotspotId = useEditorStore((s) => s.focusedHotspotId);
  const setFocusedHotspotId = useEditorStore((s) => s.setFocusedHotspotId);

  // Placement (items / npcs)
  const beginPlaceItemForActiveScene = useEditorStore((s) => s.beginPlaceItemForActiveScene);
  const beginPlaceNpcForActiveScene = useEditorStore((s) => s.beginPlaceNpcForActiveScene);
  const beginEditPlacedItemForActiveScene = useEditorStore((s) => s.beginEditPlacedItemForActiveScene);
  const beginEditPlacedNpcForActiveScene = useEditorStore((s) => s.beginEditPlacedNpcForActiveScene);

  // Assets
  const registerAssetFile = useEditorStore((s) => s.registerAssetFile);

  const { goToHistoriaVista } = useSceneNavigation();

  /* Estado de campos de la escena */
  const { activeField, setActiveField, toggleField, titleInputRef, textAreaRef } = useSceneFieldState();

  /* Estado local UI */
  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");
  const clearStartFlagFromAllNodes = useEditorStore((s) => s.clearStartFlagFromAllNodes);

  /* Validación */
  const { validateNow, issues } = useSceneValidation({ mode: "create" });
  const { titleError, textError, imageError, hotspotErrors, musicError, mapError } = useSceneFieldErrors(issues);

  /* Derivados del borrador */
  const draftTitle = draftScene.title ?? "";
  const draftText = draftScene.text ?? "";
  const draftImage = draftScene.image ?? "";
  const draftIsStart = !!draftScene.isStart;
  const draftIsFinal = !!draftScene.isFinal;

  const draftHotspots = draftScene.hotspots ?? [];
  const draftPlacedItems = draftScene.placedItems ?? [];
  const draftPlacedNpcs = draftScene.placedNpcs ?? [];

  /* Hotspots logic */
  const {
    canBindHotspotTargets,
    availableNodesByHotspotId,
    handleAddHotspot,
    handleHotspotActionChange,
    handleHotspotTargetChange,
    handleHotspotRemove,
    handleStartDrawing,
    resolveNodeLabel,
  } = useSceneHotspotsLogic({
    mode: "create",
    project,
    hotspots: draftHotspots,
    contextNodeId: "DRAFT_NODE",
    addHotspot: () => addHotspotToActiveScene(),
    removeHotspot: (hotspotId) => removeHotspotFromActiveScene(hotspotId),
    setHotspotAction: (hotspotId, actionType) => setHotspotActionForActiveScene(hotspotId, actionType as any),
    updateHotspotTarget: (hotspotId, targetNodeId) => updateHotspotTargetForActiveScene(hotspotId, targetNodeId),
    activeDrawingHotspotId: activeHotspotDrawingId,
    setActiveHotspotDrawingId,
    clearHotspotShape: (hotspotId) => clearHotspotShapeForActiveScene(hotspotId),
    hasImage: !!draftImage,
  });

  /* Imagen resuelta */
  const resolvedImageUrl = useResolvedSceneImage(draftImage);

  /* Upload de imagen */
  const {
    fileInputRef,
    imageLocalError,
    isImageDragging,
    handleImageChange,
    handleImageDragOver,
    handleImageDragLeave,
    handleImageDrop,
  } = useSceneImageUpload({
    onImagePathChange: (relativePath) => updateDraftFields({ image: relativePath }),
    registerAssetFile,
  });

  /* Tags (music/map) */
  const tagsLogic = useSceneTagsLogic({
    project,
    musicId: draftScene.musicId,
    mapId: draftScene.mapId,
    onUpdateTags: (update) => updateDraftFields(update),
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
    placedItems: draftPlacedItems,
    placedNpcs: draftPlacedNpcs,
    onUpdateEntities: (update) => updateDraftFields(update),
    onRequestPlace: (kind, resourceId) => {
      if (!draftScene.image) return; // sin imagen no hay drawing
      if (kind === "item") beginPlaceItemForActiveScene(resourceId);
      else beginPlaceNpcForActiveScene(resourceId);
    },
    onRequestEdit: (kind, instanceId) => {
      if (!draftScene.image) return;
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
  const { mapLabel, npcLabel, itemLabel, musicLabel, musicFilePath } = buildScenePreviewMeta(project, draftScene as Node);
  const musicUrl = useResolvedSceneImage(musicFilePath);

  /* Entrar al modo creación */
  useEffect(() => {
    if (sceneMode !== "creating") enterCreateMode();
  }, [sceneMode, enterCreateMode]);

  /* Crear escena */
  const handleCreateScene = () => {
    const { ok } = validateNow(draftScene);
    if (!ok) return;

    if (!draftScene.isStart) {
      commitDraftAsNode();
      goToHistoriaVista();
      return;
    }

    const existingStart = project?.nodes.find((n) => n.isStart);
    if (!existingStart) {
      commitDraftAsNode();
      goToHistoriaVista();
      return;
    }

    setExistingStartTitle(existingStart.title || existingStart.id);
    setPendingCreate(true);
    setStartModalOpen(true);
  };

  const confirmReplace = () => {
    clearStartFlagFromAllNodes();
    setStartModalOpen(false);

    if (pendingCreate) {
      commitDraftAsNode();
      goToHistoriaVista();
      setPendingCreate(false);
    }
  };

  const cancelReplace = () => {
    updateDraftFields({ isStart: false });
    setStartModalOpen(false);

    if (pendingCreate) {
      commitDraftAsNode();
      goToHistoriaVista();
      setPendingCreate(false);
    }
  };

  /* Flags Inicio/Final */
  const handleToggleStart = () => {
    if (draftIsStart) updateDraftFields({ isStart: false });
    else updateDraftFields({ isStart: true, isFinal: false });
  };

  const handleToggleFinal = () => {
    if (draftIsFinal) updateDraftFields({ isFinal: false });
    else updateDraftFields({ isFinal: true, isStart: false });
  };

  return (
    <div className="scene-editor-layout">
      <section className="scene-editor-panel-left">
        <h4 className="text-base font-semibold text-slate-100">Nueva escena</h4>

        <div className="space-y-2 text-sm text-slate-200">
          <SceneTitleField
            value={draftTitle}
            error={titleError}
            active={activeField === "title"}
            onToggle={() => toggleField("title")}
            inputRef={titleInputRef}
            onChange={(val) => updateDraftFields({ title: val })}
            onEnterDone={() => {
              setActiveField("text");
              setTimeout(() => {
                textAreaRef.current?.focus();
                textAreaRef.current?.select();
              }, 0);
            }}
          />

          <SceneTextField
            value={draftText}
            error={textError}
            active={activeField === "text"}
            onToggle={() => toggleField("text")}
            textareaRef={textAreaRef}
            onChange={(val) => updateDraftFields({ text: val })}
            onMarkDone={() => setActiveField(null)}
          />

          <SceneImageField
            value={draftImage}
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
            hotspots={draftHotspots}
            canBindTargets={canBindHotspotTargets}
            availableNodesByHotspotId={availableNodesByHotspotId}
            onChangeAction={handleHotspotActionChange}
            onChangeTarget={handleHotspotTargetChange}
            onStartDrawing={handleStartDrawing}
            activeDrawingHotspotId={activeHotspotDrawingId}
            onRemoveHotspot={handleHotspotRemove}
            onAddHotspot={handleAddHotspot}
            hotspotErrors={hotspotErrors}
            noScenesMessage="Necesitas tener escenas creadas en el proyecto."
            emptyHotspotsMessage="Aún no hay hotspots en esta escena. Puedes crear uno para ir a otra escena."
            resolveNodeLabel={resolveNodeLabel}
            selectPlaceholderWhenActive="Selecciona destino…"
            selectPlaceholderWhenDisabled="No hay escenas disponibles"
            hasImage={!!draftScene.image}
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
            canPlaceOnScene={!!draftScene.image}
            placeDisabledReason="Carga una imagen para poder dibujar/colocar."
          />

          <SceneTypeField
            isStart={draftIsStart}
            isFinal={draftIsFinal}
            onToggleStart={handleToggleStart}
            onToggleFinal={handleToggleFinal}
          />
        </div>

        <SceneFooter justify="end">
          <SceneFooterButton label="Crear escena" variant="primary" onClick={handleCreateScene} />
        </SceneFooter>
      </section>

      <section className="scene-editor-panel-right">
        <ScenePreviewCard
          title={draftTitle}
          text={draftText}
          imageLogicalPath={resolvedImageUrl}
          mapLabel={mapLabel}
          npcLabel={npcLabel}
          itemLabel={itemLabel}
          musicLabel={musicLabel}
          musicUrl={musicUrl}
        />
      </section>

      <StartConflictModal
        open={isStartModalOpen}
        currentStartTitle={existingStartTitle}
        onConfirmReplace={confirmReplace}
        onCancelKeep={cancelReplace}
      />
    </div>
  );
}
