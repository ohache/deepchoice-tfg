import type React from "react";
import { useEffect, useRef, useState } from "react";
import type { ID, Hotspot } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ScenePreviewCard } from "@/features/editor/components/scene/ScenePreviewCard";
import { CheckCircleIcon, FlagIcon, StopCircleIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useSceneFieldState, useSceneNavigation, useResolvedSceneImage,
  handleSceneImageFileChange, useSceneFieldErrors } from "@/features/editor/components/scene/SceneCommon";
import { ToggleFieldBlock, SceneTypeButton } from "@/features/editor/components/scene/SceneFieldBlocks";
import { getUsedTargetNodeIds, getAvailableTargetNodes } from "@/features/editor/utils/hotspotUtils";
import { useSceneValidation } from "@/features/editor/hooks/useSceneValidation";
import { isGoToNodeAction } from "@/shared/actionGuards";
import { StartConflictModal } from "../modals/StartConflictModal";

export function SceneCreateView() {
  const project = useEditorStore((s) => s.project);
  const sceneMode = useEditorStore((s) => s.sceneMode);
  const draftScene = useEditorStore((s) => s.draftScene);

  const enterCreateMode = useEditorStore((s) => s.enterCreateMode);
  const updateDraftFields = useEditorStore((s) => s.updateDraftFields);
  const commitDraftAsNode = useEditorStore((s) => s.commitDraftAsNode);

  const addHotspotToActiveScene = useEditorStore((s) => s.addHotspotToActiveScene);
  const updateHotspotTargetForActiveScene = useEditorStore((s) => s.updateHotspotTargetForActiveScene);
  const removeHotspotFromActiveScene = useEditorStore((s) => s.removeHotspotFromActiveScene);

  const registerAssetFile = useEditorStore((s) => s.registerAssetFile);
  const { goToHistoriaVista } = useSceneNavigation();

  const { activeField, setActiveField, toggleField, titleInputRef, textAreaRef } = useSceneFieldState();
  const [imageLocalError, setImageLocalError] = useState<string | null>(null);

  const { validateNow, issues } = useSceneValidation({ mode: "create" });
  const { titleError, textError, imageError, hotspotErrors } = useSceneFieldErrors(issues);

  const [isStartModalOpen, setStartModalOpen] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);
  const [existingStartTitle, setExistingStartTitle] = useState("");
  const clearStartFlagFromAllNodes = useEditorStore((s) => s.clearStartFlagFromAllNodes);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {if (sceneMode !== "creating") enterCreateMode();
  }, [sceneMode, enterCreateMode]);

  const draftTitle = draftScene.title ?? "";
  const draftText = draftScene.text ?? "";
  const draftImage = draftScene.image;
  const draftIsStart = !!draftScene.isStart;
  const draftIsFinal = !!draftScene.isFinal;
  const draftHotspots = draftScene.hotspots ?? [];

  const canBindHotspotTargets = !!project && project.nodes.length > 0;
  const usedTargets = getUsedTargetNodeIds(draftHotspots);
  const availableNodes = getAvailableTargetNodes(project?.nodes ?? [], "DRAFT_NODE", usedTargets);

  const resolvedImageUrl = useResolvedSceneImage(draftImage);

  const handleTitleChange = (event: React.ChangeEvent<HTMLInputElement>) => updateDraftFields({ title: event.currentTarget.value });

  const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setActiveField("text");
      setTimeout(() => {
        textAreaRef.current?.focus();
        textAreaRef.current?.select();
      }, 0);
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => updateDraftFields({ text: event.currentTarget.value });
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSceneImageFileChange(event, {
      setImageLocalError,
      onValidImagePath: (relativePath, file) => {
        updateDraftFields({ image: relativePath });
        registerAssetFile(relativePath, file);
      },
    });
  };

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

  const handleToggleStart = () => {
    if (draftIsStart) {
      updateDraftFields({ isStart: false });
    } else {
      updateDraftFields({ isStart: true, isFinal: false });
    }
  };

  const handleToggleFinal = () => {
    if (draftIsFinal) {
      updateDraftFields({ isFinal: false });
    } else {
      updateDraftFields({ isFinal: true, isStart: false });
    }
  };

  const handleAddHotspot = () => addHotspotToActiveScene();
  const handleHotspotTargetChange = (hotspotId: ID, targetNodeId: ID) => updateHotspotTargetForActiveScene(hotspotId, targetNodeId);
  const handleRemoveHotspot = (hotspotId: ID) => removeHotspotFromActiveScene(hotspotId);

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

  return (
    <div className="scene-editor-layout">
      {/* Panel izquierdo: formulario de creación */}
      <section className="scene-editor-panel-left">
        <h4 className="text-base font-semibold text-slate-100">
          Nueva escena
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
                value={draftTitle}
                onChange={handleTitleChange}
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
                  value={draftText}
                  onChange={handleTextChange}
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

              {draftImage && (
                <span className="text-[11px] text-slate-500 text-center">
                  Imagen seleccionada.
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
              {!project || project.nodes.length === 0 ? (
                <>
                  {draftHotspots.length === 0 && (
                    <p className="text-xs text-slate-400">
                      Necesitas tener escenas creadas en el proyecto.
                    </p>
                  )}

                  {draftHotspots.length > 0 && (
                    <p className="text-xs text-slate-400">
                      Cuando haya escenas en el proyecto, podrás asignarles destino.
                    </p>
                  )}
                </>
              ) : null}

              {draftHotspots.length > 0 && (
                <div className="space-y-2">
                  {draftHotspots.map((hs: Hotspot, index: number) => {
                    const goAction = hs.actions.find(isGoToNodeAction);
                    const currentTargetId = goAction?.targetNodeId ?? "";
                    
                    return (
                      <div key={hs.id} className="scene-hotspot-row">
                        <span className="text-[11px] text-slate-400 min-w-[70px]">
                          Hotspot {index + 1}
                        </span>

                        <select
                          value={currentTargetId}
                          disabled={!canBindHotspotTargets}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                            handleHotspotTargetChange(hs.id, e.target.value as ID)
                          }
                          className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 disabled:bg-slate-900 disabled:text-slate-500"
                        >
                          <option value="">
                            {canBindHotspotTargets
                              ? "Selecciona destino…"
                              : "No hay escenas disponibles"}
                          </option>

                          {currentTargetId &&
                                !availableNodes.some(n => n.id === currentTargetId) && (
                                  <option value={currentTargetId}>
                                    {project?.nodes.find(n => n.id === currentTargetId)?.title || currentTargetId}
                                  </option>
                                )}

                          {canBindHotspotTargets &&
                            availableNodes.map((node) => (
                              <option key={node.id} value={node.id}>
                                {node.title || node.id}
                              </option>
                            ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveHotspot(hs.id)}
                          className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                          title="Eliminar hotspot"
                        >
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddHotspot}
                className="scene-hotspot-add-btn"
              >
                <PlusCircleIcon className="w-3.5 h-3.5" />
                Añadir hotspot
              </button>
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


          {/* Etiquetas (placeholder futuro) */}
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
                active={draftIsStart}
                label="Inicio"
                icon={FlagIcon}
                onClick={handleToggleStart}
              />

              <SceneTypeButton
                active={draftIsFinal}
                label="Final"
                icon={StopCircleIcon}
                onClick={handleToggleFinal}
              />
            </div>
          </div>
        </div>

        {/* Botones inferiores */}
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCreateScene}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
          >
            Crear escena
          </button>
        </div>
      </section>

      {/* Panel derecho: previsualización */}
      <section className="scene-editor-panel-right">
        <ScenePreviewCard
          title={draftTitle}
          text={draftText}
          imageLogicalPath={resolvedImageUrl}
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