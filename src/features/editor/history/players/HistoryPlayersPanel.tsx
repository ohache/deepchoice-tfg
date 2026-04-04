import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { PlayerDef, ID, VarDef } from "@/domain/types";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { type PlayerFieldErrors, validatePlayerDraft } from "@/features/editor/history/players/playerValidator";
import { DeleteProjectEntityModal } from "@/features/editor/modals/DeleteProjectEntityModal";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { toast } from "@/shared/toast/toastStore";
import { useAssetDraftPanel, type DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { VarRowCard } from "@/shared/vars/varRowCard";
import { usePlayerImagesDraft } from "@/features/editor/history/players/playersImageDraft";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";

function getModeTitle(mode: DraftMode) {
  if (mode === "new") return "Nuevo personaje";
  if (mode === "edit") return "Editar personaje";
  return "Personaje";
}

function PlayerImageThumb({ logicalPath }: { logicalPath: string }) {
  const resolved = useResolvedAssetUrl(logicalPath);
  const src = logicalPath.startsWith("blob:") ? logicalPath : resolved;

  if (!src) return <span className="text-[10px] text-slate-500">—</span>;

  return <img src={src} alt="" className="h-full w-full object-contain p-1" draggable={false} />;
}

export function HistoryPlayersPanel() {
  const project = useEditorStore((s) => s.project);

  const selectedPlayerId = useEditorStore((s) => s.selectedPlayerId);
  const setSelectedPlayerId = useEditorStore((s) => s.setSelectedPlayerId);

  const addPlayerDef = useEditorStore((s) => s.addPlayer);
  const updatePlayerDef = useEditorStore((s) => s.updatePlayer);
  const removePlayerDef = useEditorStore((s) => s.removePlayer);

  const addPlayerImage = useEditorStore((s) => s.addPlayerImage);
  const updatePlayerImage = useEditorStore((s) => s.updatePlayerImage);
  const removePlayerImage = useEditorStore((s) => s.removePlayerImage);
  const setDefaultPlayerImage = useEditorStore((s) => s.setDefaultPlayerImage);

  const addPlayerVar = useEditorStore((s) => s.addPlayerVar);
  const updatePlayerVar = useEditorStore((s) => s.updatePlayerVar);
  const removePlayerVar = useEditorStore((s) => s.removePlayerVar);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PlayerFieldErrors>({});
  const [replaceTargetUiId, setReplaceTargetUiId] = useState<ID | null>(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);

  const playerList = useMemo(() => project?.players ?? [], [project]);
  const images = usePlayerImagesDraft();

  const panel = useAssetDraftPanel<PlayerDef>({
    hasProject: !!project,
    selectedId: selectedPlayerId,
    setSelectedId: setSelectedPlayerId,
    focusRef: nameInputRef,
    items: playerList,

    onLoadDraftFieldsFromSelected: (player) => {
      setDraftName(player.name ?? "");
      setDraftDescription(player.description ?? "");
      setFieldErrors({});
      images.loadFromPlayer(player);
    },

    onResetDraftFields: () => {
      setDraftName("");
      setDraftDescription("");
      setFieldErrors({});
      images.resetDraft();
    },
  });

  const mode: DraftMode = panel.mode;
  const selectedPlayer = panel.selected;
  const canEdit = mode !== "none";
  const rightTitle = getModeTitle(mode);

  const selectedPlayerVarIds = useMemo(
    () => new Set((selectedPlayer?.vars ?? []).map((variable) => variable.id)),
    [selectedPlayer],
  );

  const { draftVars, openVarId, varNameRefs, computeRowErrors, updateVarRow, switchVarType, addVarRow, toggleVarOpen,
    removeVarRow, saveVarRow, syncFromVars } = useEntityVarsEditor({
      initialVars: selectedPlayer?.vars ?? [],
      onPersistRemove: (varId) => {
        if (mode === "edit" && selectedPlayerId && selectedPlayerVarIds.has(varId)) removePlayerVar(selectedPlayerId, varId);
      },
      onPersistSave: (variable, meta) => {
        if (mode !== "edit" || !selectedPlayerId) return;

        if (!meta.existedBefore) addPlayerVar(selectedPlayerId, variable);
        else updatePlayerVar(selectedPlayerId, variable);
      },
    });

  useEffect(() => {
    syncFromVars(selectedPlayer?.vars ?? []);
  }, [selectedPlayer?.id, syncFromVars]);

  const resolvedPreviewUrl = useResolvedAssetUrl(images.previewLogicalPath && !images.previewLogicalPath.startsWith("blob:")
    ? images.previewLogicalPath
    : undefined,
  );

  const previewDefaultSrc = images.previewLogicalPath?.startsWith("blob:")
    ? images.previewLogicalPath
    : resolvedPreviewUrl;

  const previewDefaultNode = useMemo(() => {
    if (!previewDefaultSrc) return <div className="text-[11px] text-slate-500">No hay imagen por defecto</div>;

    return (
      <img
        src={previewDefaultSrc}
        alt=""
        className="h-full w-full object-contain p-2"
        draggable={false}
      />
    );
  }, [previewDefaultSrc]);

  const validateDraft = (): boolean => {
    if (!project) return false;
    if (mode === "none") return false;

    const imageIdByUiId = new Map<string, string>();
    for (const image of images.draftImages) {
      imageIdByUiId.set(image.uiId, (image.imageId ?? image.uiId) as string);
    }

    const defaultUiId = images.draftDefaultImageUiId;
    const defaultImageId = defaultUiId ? imageIdByUiId.get(defaultUiId) ?? "" : "";

    const { ok, errors } = validatePlayerDraft(
      {
        name: draftName,
        description: draftDescription.trim() ? draftDescription : undefined,
        images: images.draftImages.map((image) => ({
          id: (image.imageId ?? image.uiId) as string,
          name: image.name.trim(),
          file: image.file ?? undefined,
        })),
        defaultImageId,
        vars: draftVars
      },
      {
        mode: mode === "edit" ? "edit" : "new",
        project,
        currentPlayerId: selectedPlayerId ?? undefined
      },
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");

    return ok;
  };

  const buildValidatedVars = (): VarDef[] | null => {
    const varsOut: VarDef[] = [];

    for (const row of draftVars) {
      const result = saveVarRow(row);
      if (!result.ok) {
        toast.warning("Variables con errores", "Corrige los errores de las variables antes de guardar.");
        return null;
      }
      varsOut.push(result.variable);
    }

    return varsOut;
  };

  const handleCreate = (): boolean => {
    const varsOut = buildValidatedVars();
    if (!varsOut) return false;

    const imagesWithFile = images.draftImages.filter((image) => image.file instanceof File);
    if (imagesWithFile.length === 0) {
      toast.error("Falta imagen", "Selecciona al menos una imagen para el personaje.");
      return false;
    }

    const name = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;

    const id = addPlayerDef({
      name,
      description,
      vars: varsOut,
      images: imagesWithFile.map((image) => {
        const imageId = (image.imageId ?? (image.uiId as ID)) as ID;
        return {
          id: imageId,
          name: image.name.trim() || "Imagen",
          file: image.file as File,
          setAsDefault: image.uiId === images.draftDefaultImageUiId,
        };
      }),
    });

    if (!id) {
      toast.error("No se pudo crear el personaje", "Puede que haya un duplicado o datos inválidos.");
      return false;
    }

    toast.success("Personaje creado", `“${name}”`);
    panel.reset();
    return true;
  };

  const handleUpdate = (): boolean => {
    if (!project || !selectedPlayerId) return false;

    const varsOut = buildValidatedVars();
    if (!varsOut) return false;

    const name = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;

    updatePlayerDef(selectedPlayerId, { name, description });

    const currentPlayer = project.players.find((player) => player.id === selectedPlayerId) ?? null;
    const currentImageIds = new Set((currentPlayer?.images ?? []).map((image) => image.id));
    const keptImageIds = new Set(images.draftImages.filter((image) => image.imageId).map((image) => image.imageId),);

    for (const image of images.draftImages) {
      if (!image.imageId && image.file) {
        addPlayerImage(selectedPlayerId, {
          name: image.name.trim() || "Imagen",
          file: image.file,
        });
      }
    }

    for (const image of images.draftImages) {
      if (image.imageId) {
        updatePlayerImage(selectedPlayerId, image.imageId, {
          name: image.name.trim() || "Imagen",
          file: image.file ?? null,
        });
      }
    }

    for (const imageId of currentImageIds) if (!keptImageIds.has(imageId)) removePlayerImage(selectedPlayerId, imageId);

    const defaultDraftImage = images.draftImages.find((image) => image.uiId === images.draftDefaultImageUiId) ?? null;

    if (defaultDraftImage?.imageId) setDefaultPlayerImage(selectedPlayerId, defaultDraftImage.imageId);

    void varsOut;

    toast.success("Personaje actualizado", `“${name}”`);
    panel.reset();
    return true;
  };

  const handleSave = (): boolean => {
    if (!project) return false;
    if (mode === "none") return false;
    if (!validateDraft()) return false;

    if (mode === "new") return handleCreate();
    if (mode === "edit") return handleUpdate();

    return false;
  };

  const handleRequestExit = () => {
    if (mode === "none") {
      panel.reset();
      return;
    }
    setIsExitModalOpen(true);
  };

  const handleExitDiscard = () => {
    setIsExitModalOpen(false);
    panel.reset();
  };

  const handleExitSave = () => {
    const ok = handleSave();
    if (ok) setIsExitModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (selectedPlayerId) {
      const deletedName = selectedPlayer?.name ?? "Personaje";
      removePlayerDef(selectedPlayerId);
      toast.success("Personaje eliminado", `“${deletedName}”`);
    }
    panel.reset();
  };

  if (!project) return null;

  const disableAddVar = mode === "none" || openVarId !== null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 bg-slate-950 flex flex-col rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-emerald-800 hover:bg-emerald-700 text-white rounded-t-lg"
          >
            + Añadir personaje
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {playerList.length === 0 ? (
              <p className="p-4 text-[12px] text-slate-320 text-center">
                Aún no hay personajes en el proyecto
              </p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {playerList.map((player) => {
                  const isSelected = player.id === selectedPlayerId;

                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(player)}
                        className={" w-full text-left px-6 py-3 text-[15px] " +
                          (isSelected
                            ? "bg-emerald-700 text-slate-50"
                            : "hover:bg-emerald-600 text-slate-200")}
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {player.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        <section className="relative flex-1 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src="/ui/player-watermark.png"
              alt=""
              className="px-3 pointer-events-none absolute left-1/12 top-19/40 -translate-y-1/2 scale-125 opacity-[0.05]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-emerald-800 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">{rightTitle}</h4>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {mode === "none" ? (
              <p className="text-[12px] text-slate-200 text-center">
                Selecciona un personaje o pulsa <span className="font-semibold">“Añadir personaje”</span>
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">Nombre</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Ej: Alex"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="mb-3">
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">
                    Descripción <span className="text-slate-400">(opcional)</span>
                  </label>
                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    disabled={!canEdit}
                    rows={3}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 resize-none
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Notas del autor…"
                  />
                  {fieldErrors.description && <p className="form-field-error mt-1">{fieldErrors.description}</p>}
                </div>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[13px] font-semibold text-slate-200 m-0 text-center">Imágenes</h5>

                  <div
                    className={"group relative mt-3 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (images.isDragging
                        ? "border-emerald-400 bg-emerald-900/40"
                        : "border-emerald-800 bg-slate-900/40 hover:bg-emerald-900/20")}
                    onDragOver={images.handleDragOver}
                    onDragLeave={images.handleDragLeave}
                    onDrop={images.handleDrop}
                    onClick={() => { if (canEdit) images.fileInputRef.current?.click() }}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí una imagen
                      <span className="block text-xs text-slate-400">(o haz clic para seleccionarla)</span>
                      {mode === "edit" && (
                        <span className="block text-xs text-slate-400 mt-2">
                          Puedes añadir nuevas imágenes o actualizar una existente desde la lista.
                        </span>
                      )}
                    </p>

                    <button
                      type="button"
                      disabled={!canEdit}
                      className="btn btn-select disabled:opacity-40 disabled:cursor-not-allowed"
                      onMouseEnter={() => images.setIsHoveringSelectButton(true)}
                      onMouseLeave={() => images.setIsHoveringSelectButton(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canEdit) return;
                        images.fileInputRef.current?.click();
                      }}
                    >
                      Seleccionar imagen
                    </button>
                  </div>

                  <input
                    ref={images.fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={images.handleFileChange}
                  />

                  <input
                    ref={replaceImageInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      const targetUiId = replaceTargetUiId;

                      event.target.value = "";

                      if (!file || !targetUiId) return;

                      images.replaceDraftImageFile(targetUiId, file);
                      setReplaceTargetUiId(null);
                    }}
                  />

                  {fieldErrors.images && <p className="form-field-error mt-2">{fieldErrors.images}</p>}

                  <div className="mt-3 space-y-2">
                    {images.draftImages.length === 0 ? (
                      <div className="text-[11px] text-slate-500 text-center">No hay imágenes cargadas</div>
                    ) : (
                      images.draftImages.map((image) => {
                        const isDefault = image.uiId === images.draftDefaultImageUiId;
                        const errorKey = image.imageId ?? image.uiId;

                        const logicalPath = image.previewLogicalPath && image.previewLogicalPath.startsWith("blob:")
                          ? image.previewLogicalPath
                          : image.imageId ?? null;

                        return (
                          <div
                            key={image.uiId}
                            className="flex gap-2 items-center rounded-md border border-slate-800 bg-slate-900/30 p-2"
                          >
                            <div className="h-12 w-12 rounded border border-slate-800 bg-slate-900/40 overflow-hidden flex items-center justify-center">
                              {logicalPath ? (
                                <PlayerImageThumb logicalPath={logicalPath} />
                              ) : (
                                <span className="text-[10px] text-slate-500">—</span>
                              )}
                            </div>

                            <div className="flex-1">
                              <input
                                type="text"
                                value={image.name}
                                disabled={!canEdit}
                                onChange={(e) => images.renameDraftImage(image.uiId, e.target.value)}
                                className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
                                  focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                                placeholder="Nombre de la imagen"
                              />

                              {fieldErrors.imageById?.[errorKey]?.name && (
                                <p className="form-field-error mt-1">{fieldErrors.imageById[errorKey].name}</p>
                              )}
                              {fieldErrors.imageById?.[errorKey]?.file && (
                                <p className="form-field-error mt-1">{fieldErrors.imageById[errorKey].file}</p>
                              )}
                            </div>

                            <label className="flex items-center gap-2 text-[11px] text-slate-200 select-none">
                              <input
                                type="radio"
                                name="player-default-image"
                                checked={isDefault}
                                disabled={!canEdit}
                                onChange={() => images.setDraftDefaultImageUiId(image.uiId)}
                              />
                              Default
                            </label>

                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                setReplaceTargetUiId(image.uiId);
                                replaceImageInputRef.current?.click();
                              }}
                              className="btn btn-select text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Actualizar
                            </button>

                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => images.removeDraftImage(image.uiId)}
                              className="btn btn-danger text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Quitar
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <h6 className="text-[12px] font-semibold text-slate-200 m-0 text-center">
                      Imagen por defecto
                    </h6>
                    <div className="mt-2 flex justify-center">
                      <div className="h-44 w-44 rounded-md border border-slate-800 bg-slate-900/40 flex items-center justify-center overflow-hidden">
                        {previewDefaultNode}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[13px] font-semibold text-slate-200 m-0 text-center">Variables</h5>

                  <div className="mt-2 flex justify-center">
                    <button
                      type="button"
                      onClick={addVarRow}
                      className="btn btn-add-variant text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={disableAddVar}
                      title={openVarId
                        ? "Termina la edición de la variable abierta (guarda o elimina)."
                        : "Añadir variable"}
                    >
                      + Añadir variable
                    </button>
                  </div>

                  {fieldErrors.vars && <p className="form-field-error mt-2 text-center">{fieldErrors.vars}</p>}

                  {draftVars.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center mt-3">
                      Este personaje no tiene variables.
                    </p>
                  ) : (
                    <div className="space-y-2 mt-3">
                      {draftVars.map((row, idx) => {
                        const isOpen = row.id === openVarId;
                        const errors = computeRowErrors(row);

                        return (
                          <div key={row.id}>
                            <VarRowCard
                              row={row}
                              index={idx}
                              isOpen={isOpen}
                              disabled={!canEdit}
                              nameInputRef={(el) => { varNameRefs.current[row.id] = el }}
                              onToggleOpen={() => toggleVarOpen(row.id)}
                              onChange={(patch) => updateVarRow(row.id, patch)}
                              onSwitchType={(nextType) => switchVarType(row.id, nextType)}
                              onSave={() => {
                                const result = saveVarRow(row);
                                if (!result.ok) {
                                  toast.warning("Revisa la variable", "Hay campos con errores.");
                                  return;
                                }
                                toast.success("Variable guardada", `“${result.variable.name}”`);
                              }}
                              onDelete={() => removeVarRow(row.id)}
                              saveTitle="Guardar"
                              deleteTitle="Eliminar"
                              saveVariant="player"
                              errors={errors}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-auto flex justify-between pt-4">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={panel.openDelete}
                      disabled={!selectedPlayerId}
                      className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-[12px] font-semibold text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Eliminar
                    </button>

                    <button
                      type="button"
                      onClick={handleRequestExit}
                      className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-[12px] font-semibold text-slate-100"
                    >
                      Salir
                    </button>
                  </div>

                  <div className="flex gap-3 panel--players">
                    <button
                      type="button"
                      onClick={panel.reset}
                      className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-[12px] text-slate-100"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn btn-save"
                    >
                      Guardar Player
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <DeleteProjectEntityModal
        open={panel.isDeleteModalOpen}
        title="Eliminar personaje"
        entityName={selectedPlayer?.name ?? ""}
        description="Esta acción lo quitará del proyecto y dejará de estar disponible para las escenas que lo usen."
        onConfirm={handleConfirmDelete}
        onCancel={panel.cancelDelete}
      />

      <ConfirmExitModal
        open={isExitModalOpen}
        title="Salir del editor de personaje"
        description={mode === "new"
          ? "Has empezado un personaje nuevo. ¿Quieres guardarlo antes de salir?"
          : "Hay cambios sin guardar. ¿Quieres guardarlos antes de salir?"}
        onSaveAndExit={handleExitSave}
        onDiscardAndExit={handleExitDiscard}
        onCancel={() => setIsExitModalOpen(false)}
        canSave={true}
      />
    </div>
  );
}