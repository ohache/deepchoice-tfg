import type React from "react";
import { useState, useRef } from "react";
import type { ID, Hotspot } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { DeleteSceneModal } from "@/features/editor/components/modals/DeleteSceneModal";
import { ScenePreviewCard } from "@/features/editor/components/scene/ScenePreviewCard";
import { ToggleFieldBlock, SceneTypeButton } from "@/features/editor/components/scene/SceneFieldBlocks";
import { useSceneFieldState, useSceneNavigation, useResolvedSceneImage,
  handleSceneImageFileChange, useSceneFieldErrors } from "@/features/editor/components/scene/SceneCommon";
import { CheckCircleIcon, FlagIcon, StopCircleIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { getUsedTargetNodeIds, getAvailableTargetNodes } from "@/features/editor/utils/hotspotUtils";
import { useSceneValidation } from "@/features/editor/hooks/useSceneValidation";
import { isGoToNodeAction } from "@/shared/actionGuards";
import { StartConflictModal } from "../modals/StartConflictModal";

export function SceneEditView() {
  const project = useEditorStore((s) => s.project);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const sceneMode = useEditorStore((s) => s.sceneMode);

  const updateSelectedNodeFields = useEditorStore((s) => s.updateSelectedNodeFields);
  const addHotspotToActiveScene = useEditorStore((s) => s.addHotspotToActiveScene);
  const updateHotspotTargetForActiveScene = useEditorStore((s) => s.updateHotspotTargetForActiveScene);
  const removeHotspotFromActiveScene = useEditorStore((s) => s.removeHotspotFromActiveScene);
  const deleteSelectedNode = useEditorStore((s) => s.deleteSelectedNode);
  const registerAssetFile = useEditorStore.getState().registerAssetFile;

  const { goToHistoriaVista } = useSceneNavigation();

  const { activeField, setActiveField, toggleField, titleInputRef, textAreaRef } = useSceneFieldState([selectedNodeId]);
  const [imageLocalError, setImageLocalError] = useState<string | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentNode = sceneMode === "editing" && project && selectedNodeId
    ? project.nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  const { validateNow, issues } = useSceneValidation({ mode: "edit", currentNodeId: currentNode?.id });
  const { titleError, textError, imageError, hotspotErrors } = useSceneFieldErrors(issues);

  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");
  const clearStartFlagFromAllNodes = useEditorStore((s) => s.clearStartFlagFromAllNodes);

  const isEditing = sceneMode === "editing" && !!currentNode;

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

  const resolvedImageUrl = useResolvedSceneImage(currentNode.image);

    const buildDraftFromCurrentNode = () => {
    if (!currentNode) return null;

    return {
      title: currentNode.title,
      text: currentNode.text,
      image: currentNode.image,
      hotspots: currentNode.hotspots ?? [],
      musicId: currentNode.musicId,
      npcIds: currentNode.npcIds,
      featuredItemId: currentNode.featuredItemId,
      mapId: currentNode.mapId,
      isStart: currentNode.isStart,
      isFinal: currentNode.isFinal,
      meta: currentNode.meta,
    };
  };

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

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isEditing && currentNode) {
        const trimmed = event.currentTarget.value.trim();
        updateSelectedNodeFields({ title: trimmed });
      }
      setActiveField("text");
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSceneImageFileChange(event, {
      setImageLocalError,
      onValidImagePath: (relativePath, file) => {
        updateSelectedNodeFields({ image: relativePath });
        registerAssetFile(relativePath, file);
      },
    });
  };


  const handleHotspotClickAdd = () => {
    if (!project || !currentNode) return;
    if (project.nodes.length < 2) return;
    addHotspotToActiveScene();
  };

  const handleHotspotTargetChange = (hotspotId: ID, targetNodeId: ID) => updateHotspotTargetForActiveScene(hotspotId, targetNodeId);
  const handleHotspotRemove = (hotspotId: ID) => removeHotspotFromActiveScene(hotspotId);

  const handleDeleteConfirm = () => {
    deleteSelectedNode();
    setIsDeleteModalOpen(false);
    goToHistoriaVista();
  };

  const hotspots: Hotspot[] = currentNode.hotspots ?? [];
  const canEditHotspots = !!project && project.nodes.length >= 2;

  const usedTargets = getUsedTargetNodeIds(hotspots);
  const availableNodes = getAvailableTargetNodes(project!.nodes, currentNode.id, usedTargets);

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
            <ToggleFieldBlock
              label="Título"
              active={activeField === "title"}
              onToggle={() => toggleField("title")}
            >
              <div className="pt-2">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={currentNode.title}
                  onChange={(e) => updateSelectedNodeFields({ title: e.target.value })}
                  onKeyDown={handleTitleKeyDown}
                  className="text-center w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                  placeholder="Ej: Entrada al bosque"
                />
              </div>
            </ToggleFieldBlock>

            {titleError && (
            <p className="form-field-error">
              {titleError.message}
            </p>
          )}

            {/* Texto */}
            <ToggleFieldBlock
              label="Texto"
              active={activeField === "text"}
              onToggle={() => toggleField("text")}
            >
              <div className="pt-2">
                <div className="relative">
                  <textarea
                    ref={textAreaRef}
                    value={currentNode.text}
                    onChange={(e) =>
                      updateSelectedNodeFields({ text: e.target.value })
                    }
                    className="w-full h-32 rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 pr-9 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 resize-none overflow-y-auto"
                    placeholder="Escribe aquí el texto de la escena…"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveField(null)}
                    className="absolute bottom-2 right-2 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                    title="Marcar texto como listo"
                  >
                    <CheckCircleIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </ToggleFieldBlock>

            {textError && (
            <p className="form-field-error">
              {textError.message}
            </p>
          )}

            {/* Imagen */}
            <ToggleFieldBlock
              label="Imagen"
              active={activeField === "image"}
              onToggle={() => toggleField("image")}
            >
              <div className="pt-2 flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-md border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
                >
                  Seleccionar imagen…
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                  className="hidden"
                  onChange={handleImageChange}
                />

                {currentNode.image && (
                  <span className="text-[11px] text-slate-500 text-center">
                    Imagen seleccionada:{" "}
                    <span className="font-mono break-all">
                      {currentNode.image}
                    </span>
                  </span>
                )}
              </div>
            </ToggleFieldBlock>

            {imageError && (
              <p className="form-field-error">
                {imageError.message}
              </p>
            )}

            {!imageError && imageLocalError && (
            <p className="form-field-error">
              {imageLocalError}
            </p>
          )}

            {/* Hotspots */}
            <ToggleFieldBlock
              label="Hotspots"
              active={activeField === "hotspots"}
              onToggle={() => toggleField("hotspots")}
            >
              <div className="pt-2 space-y-2 text-left">
                {!canEditHotspots ? (
                  <p className="text-xs text-slate-400">
                    Para crear hotspots de navegación necesitas al menos dos
                    escenas en el proyecto.
                  </p>
                ) : (
                  <>
                    {hotspots.length === 0 && (
                      <p className="text-xs text-slate-400">
                        Aún no hay hotspots en esta escena. Puedes crear uno
                        para ir a otra escena.
                      </p>
                    )}

                    <div className="space-y-2">
                      {hotspots.map((hs, index) => {
                        const goAction = hs.actions.find(isGoToNodeAction);
                        const currentTargetId = goAction?.targetNodeId ?? "";
                        
                        return (
                          <div key={hs.id} className="scene-hotspot-row">
                            <span className="text-[11px] text-slate-400 min-w-[70px]">
                              Hotspot {index + 1}
                            </span>

                            <select
                              value={currentTargetId}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                                handleHotspotTargetChange(
                                  hs.id,
                                  e.target.value as ID
                                )
                              }
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                            >
                              <option value="">
                                Selecciona destino…
                              </option>
                              {/* Siempre incluir el target actual */}
                              {currentTargetId &&
                                !availableNodes.some(n => n.id === currentTargetId) && (
                                  <option value={currentTargetId}>
                                    {project?.nodes.find(n => n.id === currentTargetId)?.title || currentTargetId}
                                  </option>
                                )}

                              {/* El resto de nodos disponibles */}
                              {availableNodes.map(node => (
                                <option key={node.id} value={node.id}>
                                  {node.title || node.id}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => handleHotspotRemove(hs.id)}
                              className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                              title="Eliminar hotspot"
                            >
                              <TrashIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={handleHotspotClickAdd}
                      className="scene-hotspot-add-btn"
                    >
                      <PlusCircleIcon className="w-3.5 h-3.5" />
                      Añadir hotspot
                    </button>
                  </>
                )}
              </div>
            </ToggleFieldBlock>

            {hotspotErrors.length > 0 && (
            <div className="mt-1 space-y-1">
              {hotspotErrors.map((err, index) => (
                <p
                  key={`${err.code}-${index}`}
                  className="form-field-error"
                >
                  {err.message}
                </p>
              ))}
            </div>
          )}

            {/* Etiquetas (placeholder de momento) */}
            <ToggleFieldBlock
              label="Etiquetas"
              active={activeField === "tags"}
              onToggle={() => toggleField("tags")}
            >
              <p className="text-xs text-slate-400 pt-2">
                Aquí podrás añadir etiquetas asociadas a esta escena.
              </p>
            </ToggleFieldBlock>

            {/* Inicio / Final */}
            <div className="scene-type-toggle-container">
              <div className="flex items-center justify-center gap-10">
                <SceneTypeButton
                  active={!!currentNode.isStart}
                  label="Inicio"
                  icon={FlagIcon}
                  onClick={() => {
                    if (currentNode.isStart) {
                      updateSelectedNodeFields({ isStart: false });
                    } else {
                      updateSelectedNodeFields({
                        isStart: true,
                        isFinal: false,
                      });
                    }
                  }}
                />

                <SceneTypeButton
                  active={!!currentNode.isFinal}
                  label="Final"
                  icon={StopCircleIcon}
                  onClick={() => {
                    if (currentNode.isFinal) {
                      updateSelectedNodeFields({ isFinal: false });
                    } else {
                      updateSelectedNodeFields({
                        isFinal: true,
                        isStart: false,
                      });
                    }
                  }}
                />
              </div>
            </div>
          </div>

          {/* Botones inferiores */}
          <div className="mt-3 flex justify-between gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-xs font-semibold text-white"
            >
              Eliminar escena
            </button>

            <button
              type="button"
              onClick={handleSaveChanges}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
            >
              Guardar cambios
            </button>
          </div>
        </section>

        {/* Panel derecho: previsualización */}
        <section className="scene-editor-panel-right">
          <ScenePreviewCard
            title={currentNode.title ?? ""}
            text={currentNode.text ?? ""}
            imageLogicalPath={resolvedImageUrl}
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