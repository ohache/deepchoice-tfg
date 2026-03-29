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
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const playerList = project?.players ?? [];
  const images = usePlayerImagesDraft();

  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);
  const [replaceTargetUiId, setReplaceTargetUiId] = useState<ID | null>(null);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const resolvedPreviewUrl = useResolvedAssetUrl(
  images.previewLogicalPath && !images.previewLogicalPath.startsWith("blob:")
    ? images.previewLogicalPath
    : undefined
);

const previewDefaultSrc = images.previewLogicalPath?.startsWith("blob:")
  ? images.previewLogicalPath
  : resolvedPreviewUrl;

  const panel = useAssetDraftPanel<PlayerDef>({
    hasProject: !!project,
    selectedId: selectedPlayerId,
    setSelectedId: setSelectedPlayerId,
    focusRef: nameInputRef,
    items: playerList,

    onLoadDraftFieldsFromSelected: (p) => {
      setDraftName(p.name ?? "");
      setDraftDescription(p.description ?? "");
      setFieldErrors({});
      images.loadFromPlayer(p);
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
  const rightTitle = mode === "new" ? "Nuevo personaje" : mode === "edit" ? "Editar personaje" : "Personaje";

  const selectedPlayerVarIds = useMemo(() => {
    const set = new Set<string>();
    for (const v of selectedPlayer?.vars ?? []) set.add(v.id);
    return set;
  }, [selectedPlayer]);

  const {
    draftVars,
    openVarId,
    varNameRefs,
    computeRowErrors,
    updateVarRow,
    switchVarType,
    addVarRow,
    toggleVarOpen,
    removeVarRow,
    saveVarRow,
    syncFromVars,
  } = useEntityVarsEditor({
    initialVars: selectedPlayer?.vars ?? [],
    onPersistRemove: (varId) => {
      if (mode === "edit" && selectedPlayerId && selectedPlayerVarIds.has(varId)) {
        removePlayerVar(selectedPlayerId, varId);
      }
    },
    onPersistSave: (variable, meta) => {
      if (mode !== "edit" || !selectedPlayerId) return;

      if (!meta.existedBefore) addPlayerVar(selectedPlayerId, variable);
      else updatePlayerVar(selectedPlayerId, variable);
    },
  });

  function PlayerImageThumb({ logicalPath }: { logicalPath: string }) {
    const resolved = useResolvedAssetUrl(logicalPath);
    const src = logicalPath.startsWith("blob:") ? logicalPath : resolved;

    if (!src) return <span className="text-[10px] text-slate-500">—</span>;
    return <img src={src} alt="" className="h-full w-full object-contain p-1" draggable={false} />;
  }

const previewDefaultNode = useMemo(() => {
  if (!previewDefaultSrc) {
    return <div className="text-[11px] text-slate-500">No hay imagen por defecto</div>;
  }

  return (
    <img
      src={previewDefaultSrc}
      alt=""
      className="h-full w-full object-contain p-2"
      draggable={false}
    />
  );
}, [previewDefaultSrc]);

  // -----------------------------
  // Validación + save
  // -----------------------------
  const validateDraft = (): boolean => {
    if (!project) return false;
    if (mode === "none") return false;

    const imageIdByUiId = new Map<string, string>();
    for (const im of images.draftImages) imageIdByUiId.set(im.uiId, (im.imageId ?? im.uiId) as string);

    const defaultUiId = images.draftDefaultImageUiId;
    const defaultImageId = defaultUiId ? (imageIdByUiId.get(defaultUiId) ?? "") : "";

    const { ok, errors } = validatePlayerDraft(
      {
        name: draftName,
        description: draftDescription?.trim() ? draftDescription : undefined,
        images: images.draftImages.map((im) => ({
          id: (im.imageId ?? im.uiId) as string,
          name: (im.name ?? "").trim(),
          file: im.file ?? undefined,
        })),
        defaultImageId,
        vars: draftVars as any,
      },
      { mode: mode === "edit" ? "edit" : "new", project, currentPlayerId: selectedPlayerId ?? undefined }
    );

    setFieldErrors(errors);
    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");
    return ok;
  };

  const handleSave = (): boolean => {
    if (!project) return false;
    if (mode === "none") return false;
    if (!validateDraft()) return false;

    const varsOut: VarDef[] = [];
    for (const row of draftVars) {
      const result = saveVarRow(row);
      if (!result.ok) {
        toast.warning("Variables con errores", "Corrige los errores de las variables antes de guardar.");
        return false;
      }
      varsOut.push(result.variable);
    }

    const name = draftName.trim();
    const descTrim = (draftDescription ?? "").trim();
    const description = descTrim ? descTrim : undefined;

    if (mode === "new") {
      const imgsWithFile = images.draftImages.filter((im) => im.file instanceof File);
      if (imgsWithFile.length === 0) {
        toast.error("Falta imagen", "Selecciona al menos una imagen para el personaje.");
        return false;
      }

      const id = addPlayerDef({
        name,
        description,
        vars: varsOut,
        images: imgsWithFile.map((im) => {
          const imageId = (im.imageId ?? (im.uiId as ID)) as ID;
          return {
            id: imageId,
            name: (im.name ?? "").trim() || "Imagen",
            file: im.file as File,
            setAsDefault: im.uiId === images.draftDefaultImageUiId,
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
    }

    if (mode === "edit" && selectedPlayerId) {
      updatePlayerDef(selectedPlayerId, { name, description });

      const current = (project.players ?? []).find((p) => p.id === selectedPlayerId) ?? null;
      const currentImageIds = new Set((current?.images ?? []).map((x) => x.id));
      const keptImageIds = new Set(images.draftImages.filter((x) => x.imageId).map((x) => x.imageId as ID));

      for (const im of images.draftImages) {
        if (!im.imageId && im.file) {
          addPlayerImage(selectedPlayerId, {
            name: (im.name ?? "").trim() || "Imagen",
            file: im.file,
          });
        }
      }

      for (const im of images.draftImages) {
        if (im.imageId) {
          updatePlayerImage(selectedPlayerId, im.imageId, {
            name: (im.name ?? "").trim() || "Imagen",
            file: im.file ?? null,
          });
        }
      }

      for (const imageId of currentImageIds) {
        if (!keptImageIds.has(imageId)) removePlayerImage(selectedPlayerId, imageId);
      }

      const defaultDraft = images.draftImages.find((x) => x.uiId === images.draftDefaultImageUiId) ?? null;
      if (defaultDraft?.imageId) setDefaultPlayerImage(selectedPlayerId, defaultDraft.imageId);

      void varsOut;

      toast.success("Personaje actualizado", `“${name}”`);
      panel.reset();
      return true;
    }

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

  const handleStartNew = () => {
    panel.startNew();
  };

  const handleListClick = (p: PlayerDef) => {
    panel.handleListClick(p);
  };

  const handleCancel = () => panel.reset();

  useEffect(() => {
    syncFromVars(selectedPlayer?.vars ?? []);
  }, [selectedPlayer?.id, syncFromVars]);

  if (!project) return null;

  const disableAddVar = mode === "none" || openVarId !== null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 bg-slate-950 flex flex-col rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={handleStartNew}
            className="px-3 py-2 text-base font-semibold bg-emerald-800 hover:bg-emerald-700 text-white rounded-t-lg"
          >
            + Añadir personaje
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {playerList.length === 0 ? (
              <p className="p-4 text-[12px] text-slate-320 text-center">Aún no hay personajes en el proyecto</p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {playerList.map((p) => {
                  const isSelected = p.id === selectedPlayerId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleListClick(p)}
                        className={[
                          "w-full text-left px-6 py-3 text-[15px]",
                          isSelected ? "bg-emerald-700 text-slate-50" : "hover:bg-emerald-600 text-slate-200",
                        ].join(" ")}
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{p.name}</span>
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
                    className={
                      "group relative mt-3 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (images.isDragging
                        ? "border-emerald-400 bg-emerald-900/40"
                        : "border-emerald-800 bg-slate-900/40 hover:bg-emerald-900/20")
                    }
                    onDragOver={images.handleDragOver}
                    onDragLeave={images.handleDragLeave}
                    onDrop={images.handleDrop}
                    onClick={() => canEdit && images.fileInputRef.current?.click()}
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
                      onChange={(evt) => {
                        const file = evt.target.files?.[0] ?? null;
                        const targetUiId = replaceTargetUiId;

                        evt.target.value = "";

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
                      images.draftImages.map((im) => {
                        const isDefault = im.uiId === images.draftDefaultImageUiId;
                        const errorKey = im.imageId ?? im.uiId;

                        return (
                          <div
                            key={im.uiId}
                            className="flex gap-2 items-center rounded-md border border-slate-800 bg-slate-900/30 p-2"
                          >
                            <div className="h-12 w-12 rounded border border-slate-800 bg-slate-900/40 overflow-hidden flex items-center justify-center">
                              {(() => {
                                const lp =
                                  im.previewLogicalPath && im.previewLogicalPath.startsWith("blob:")
                                    ? im.previewLogicalPath
                                    : (im.imageId ?? null);

                                return lp ? <PlayerImageThumb logicalPath={lp} /> : <span className="text-[10px] text-slate-500">—</span>;
                              })()}
                            </div>

                            <div className="flex-1">
                              <input
                                type="text"
                                value={im.name}
                                disabled={!canEdit}
                                onChange={(e) =>
                                  images.setDraftImages((prev) =>
                                    prev.map((x) => (x.uiId === im.uiId ? { ...x, name: e.target.value } : x))
                                  )
                                }
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
                                onChange={() => images.setDraftDefaultImageUiId(im.uiId)}
                              />
                              Default
                            </label>

                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                setReplaceTargetUiId(im.uiId);
                                replaceImageInputRef.current?.click();
                              }}
                              className="btn btn-select text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Actualizar
                            </button>

                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => images.removeDraftImage(im.uiId)}
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
                    <h6 className="text-[12px] font-semibold text-slate-200 m-0 text-center">Imagen por defecto</h6>
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
                      className="btn btn-select text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={disableAddVar}
                      title={openVarId ? "Termina la edición de la variable abierta (guarda o elimina)." : "Añadir variable"}
                    >
                      + Añadir variable
                    </button>
                  </div>

                  {fieldErrors.vars && <p className="form-field-error mt-2 text-center">{fieldErrors.vars}</p>}

                  {draftVars.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center mt-3">Este personaje no tiene variables.</p>
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
                              nameInputRef={(el) => {
                                varNameRefs.current[row.id] = el;
                              }}
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

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-[12px] text-slate-100"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSave()}
                      disabled={!canEdit}
                      className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-[12px] font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Guardar
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
        description={
          mode === "new"
            ? "Has empezado un personaje nuevo. ¿Quieres guardarlo antes de salir?"
            : "Hay cambios sin guardar. ¿Quieres guardarlos antes de salir?"
        }
        onSaveAndExit={handleExitSave}
        onDiscardAndExit={handleExitDiscard}
        onCancel={() => setIsExitModalOpen(false)}
        canSave={true}
      />
    </div>
  );
}