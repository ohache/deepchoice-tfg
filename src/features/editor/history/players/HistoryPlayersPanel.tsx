import { useEffect, useMemo, useRef, useState } from "react";
import type { PlayerDef, VarDef, ItemInstance, ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { InventoryEditor } from "@/features/editor/history/shared/inventory/InventoryEditor";
import { type PlayerFieldErrors, validatePlayerDraft } from "@/features/editor/history/players/playerValidator";
import { useAssetDraftPanel, type DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { getDraftPanelTitle } from "@/features/editor/history/shared/genericHelpers";
import { VarRowCard } from "@/shared/vars/varRowCard";
import { usePlayerImagesDraft } from "@/features/editor/history/players/playersImageDraft";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { InventoryItemRulesEditor } from "@/features/editor/history/shared/inventory/InventoryItemRulesEditor";
import { useEntityInventoryEditor } from "@/features/editor/history/shared/inventory/useEntityInventoryEditor";
import { toast } from "@/shared/toast/toastStore";
import { publicPath } from "@/shared/helpers";

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

  const addPlayerInventoryItem = useEditorStore((s) => s.addPlayerInventoryItem);
  const updatePlayerInventoryItem = useEditorStore((s) => s.updatePlayerInventoryItem);
  const removePlayerInventoryItem = useEditorStore((s) => s.removePlayerInventoryItem);

  const [draftName, setDraftName] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [fieldErrors, setFieldErrors] = useState<PlayerFieldErrors>({});
  const [replaceTargetUiId, setReplaceTargetUiId] = useState<ID | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const replaceImageInputRef = useRef<HTMLInputElement | null>(null);

  const playerList = useMemo(() => project?.players ?? [], [project]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId || !project) return null;
    return playerList.find((player) => player.id === selectedPlayerId) ?? null;
  }, [selectedPlayerId, project, playerList]);

  const selectedPlayerVarIds = useMemo(() => new Set((selectedPlayer?.vars ?? []).map((variable) => variable.id)), [selectedPlayer]);

  const selectedPlayerInitialInventory = useMemo(() => selectedPlayer?.initialInventory ?? [], [selectedPlayer]);

  const itemOptions = useMemo(() => project?.items ?? [], [project]);

  const images = usePlayerImagesDraft();

  /* Al desmontar el panel se limpia la selección activa */
  useEffect(() => () => setSelectedPlayerId(null), [setSelectedPlayerId]);

  /* Carga el draft desde el PNJ seleccionado */
  const loadDraftFromSelectedNpc = (player: PlayerDef) => {
    setDraftName(player.name ?? "");
    setDraftDescription(player.description ?? "");
    setFieldErrors({});
    images.loadFromPlayer(player);
  };

  /* Limpia los campos del formulario */
  const resetDraftFields = () => {
    setDraftName("");
    setDraftDescription("");
    setFieldErrors({});
    images.resetDraft();
  };

  const panel = useAssetDraftPanel<PlayerDef>({
    hasProject: !!project,
    selectedId: selectedPlayerId,
    setSelectedId: setSelectedPlayerId,
    focusRef: nameInputRef,
    items: playerList,
    onLoadDraftFieldsFromSelected: loadDraftFromSelectedNpc,
    onResetDraftFields: resetDraftFields,
  });

  const mode: DraftMode = panel.mode;
  const rightTitle = getDraftPanelTitle(mode, {
    detail: "Detalle de Jugador",
    create: "Nuevo Jugador",
    edit: "Editar Jugador",
  });

  /* Editor de variables del Player */
  const { draftVars, openVarId, varNameRefs, computeRowErrors, updateVarRow, switchVarType, addVarRow, toggleVarOpen, removeVarRow,
    saveVarRow, validateVarRows, persistValidatedVars,syncFromVars } = useEntityVarsEditor({
      initialVars: selectedPlayer?.vars ?? [],
      onPersistRemove: (varId) => { if (mode === "edit" && selectedPlayerId && selectedPlayerVarIds.has(varId)) removePlayerVar(selectedPlayerId, varId) },
      onPersistSave: (variable, existedBefore) => {
        if (mode !== "edit" || !selectedPlayerId) return;

        if (!existedBefore) addPlayerVar(selectedPlayerId, variable);
        else updatePlayerVar(selectedPlayerId, variable);
      },
    });

  /* Editor del inventario inicial del Jugador */
  const { draftInventory, openInventoryItemId, addInventoryRow, updateInventoryRow, removeInventoryRow, toggleInventoryItemOpen, saveInventoryRow, syncFromInventory }
    = useEntityInventoryEditor({
      project,
      initialInventory: selectedPlayerInitialInventory,
      itemOptions,
      onPersistRemove: (itemInstanceId) => { if (mode === "edit" && selectedPlayerId) removePlayerInventoryItem(selectedPlayerId, itemInstanceId) },
      onPersistSave: (item, existedBefore) => {
        if (mode !== "edit" || !selectedPlayerId) return;

        if (!existedBefore) addPlayerInventoryItem(selectedPlayerId, item);
        else updatePlayerInventoryItem(selectedPlayerId, item);
      },
    });

  /* Sincroniza variables e inventario al cambiar el Jugador seleccionado */
  useEffect(() => {
    syncFromVars(selectedPlayer?.vars ?? []);
    syncFromInventory(selectedPlayer?.initialInventory ?? []);
  }, [selectedPlayer?.id, syncFromVars, syncFromInventory]);

  /* Limpia variables e inventario al crear un Jugador nuevo */
  useEffect(() => {
    if (mode !== "new") return;

    syncFromVars([]);
    syncFromInventory([]);
  }, [mode, syncFromVars, syncFromInventory]);

  const resolvedPreviewUrl = useResolvedAssetUrl(images.previewSource && !images.previewSource.startsWith("blob:") ? images.previewSource : undefined);

  const previewDefaultSrc = images.previewSource?.startsWith("blob:") ? images.previewSource : resolvedPreviewUrl;

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

  /* Valida el formulario completo del Jugador */
  const validateDraft = (input: { vars: VarDef[]; initialInventory: ItemInstance[] }): boolean => {
    if (!project) {
      toast.warning("No hay proyecto", "No se puede validar el jugador porque no hay un proyecto cargado.");
      return false;
    }

    const descriptionTrim = draftDescription.trim();

    const imageIdByUiId = new Map<string, string>();

    for (const image of images.draftImages) imageIdByUiId.set(image.uiId, (image.imageId ?? image.uiId) as string);

    const defaultUiId = images.draftDefaultImageUiId;
    const defaultImageId = defaultUiId ? imageIdByUiId.get(defaultUiId) ?? "" : "";

    const { ok, errors } = validatePlayerDraft(
      { name: draftName, description: descriptionTrim || undefined,
        images: images.draftImages.map((image) => ({ id: image.imageId ?? image.uiId, name: image.name.trim(), file: image.file ?? undefined })),
        defaultImageId, vars: input.vars, initialInventory: input.initialInventory },
      { mode: mode === "edit" ? "edit" : "new", project, currentPlayerId: selectedPlayerId ?? undefined },
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay errores en alguno de los campos.");

    return ok;
  };

  /* Convierte las filas draft de variables en VarDef persistibles */
  const buildValidatedVars = (): VarDef[] | null => {
    const result = validateVarRows();
  
    if (!result.ok) {
      toast.warning("Variables con errores", "Corrige los errores de las variables antes de guardar el jugador.");
      return null;
     }

    return result.variables;
  };

  /* Convierte las filas draft de inventario en ItemInstance persistibles */
  const buildValidatedInventory = (): ItemInstance[] | null => {
    const inventoryOut: ItemInstance[] = [];

    for (const item of draftInventory) {
      const result = saveInventoryRow(item);

      if (!result.ok) {
        toast.warning("Inventario con errores", "Corrige los errores del inventario antes de guardar el jugador.");
        return null;
      }

      inventoryOut.push(result.item);
    }

    return inventoryOut;
  };

  /* Alta de un nuevo player */
  const handleCreate = (varsOut: VarDef[], inventoryOut: ItemInstance[]) => {
    const imagesWithFile = images.draftImages.filter((image) => image.file instanceof File);
    if (imagesWithFile.length === 0) {
      toast.error("Falta imagen", "Selecciona al menos una imagen para el jugador.");
      return false;
    }

    const name = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;

    const id = addPlayerDef({ name, description, vars: varsOut, initialInventory: inventoryOut,
       images: imagesWithFile.map((image) => ({ name: image.name.trim() || "Imagen", file: image.file as File }))});

    if (!id) {
      toast.error("Error inesperado", "No se pudo crear el jugador.");
      return false;
    }

    toast.success("Jugador creado", `“${name}”`);
    panel.reset();
  };

  /* Actualización de un Jugador existente */
  const handleUpdate = () => {
    if (!project || !selectedPlayerId) return false;

    const name = draftName.trim();
    const descriptionTrim = draftDescription.trim();
    const description = descriptionTrim || undefined;

    updatePlayerDef(selectedPlayerId, { name, description });

    const currentPlayer = project.players.find((player) => player.id === selectedPlayerId) ?? null;
    const currentImageIds = new Set((currentPlayer?.images ?? []).map((image) => image.id));
    const keptImageIds = new Set(images.draftImages.filter((image) => image.imageId).map((image) => image.imageId),);

    for (const image of images.draftImages) {
      if (!image.imageId && image.file) addPlayerImage(selectedPlayerId, { name: image.name.trim() || "Imagen", file: image.file });
    }

    for (const image of images.draftImages) {
      if (image.imageId) updatePlayerImage(selectedPlayerId, image.imageId, { name: image.name.trim() || "Imagen", file: image.file ?? null });
    }

    for (const imageId of currentImageIds) if (!keptImageIds.has(imageId)) removePlayerImage(selectedPlayerId, imageId);

    const defaultDraftImage = images.draftImages.find((image) => image.uiId === images.draftDefaultImageUiId) ?? null;

    if (defaultDraftImage?.imageId) setDefaultPlayerImage(selectedPlayerId, defaultDraftImage.imageId);

    toast.success("Jugador actualizado", `“${name}”`);
    panel.reset();
    return true;
  };

  /* Punto único de guardado */
  const handleSave = () => {
    if (!project) return false;

    const varsOut = buildValidatedVars();
    if (!varsOut) return;

    const inventoryOut = buildValidatedInventory();
    if (!inventoryOut) return;

    if (!validateDraft({ vars: varsOut, initialInventory: inventoryOut })) return;

    if (mode === "new") handleCreate(varsOut, inventoryOut);
    else if (mode === "edit") {
      persistValidatedVars(varsOut);
      handleUpdate();
    }
  };

  /* Solicita la eliminación del Jugador seleccionado */
  const handleDeletePlayer = () => {
    if (!selectedPlayerId) return;
    removePlayerDef(selectedPlayerId);
  };

  if (!project) return null;

  const disableAddVar = mode === "none" || openVarId !== null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-3 border-slate-800 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 rounded-lg border border-emerald-700 bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-emerald-800 hover:bg-emerald-700 text-white rounded-t-lg"
          >
            + Añadir jugador
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {playerList.length === 0 ? (
              <p className="p-4 text-[12px] text-slate-320 text-center">
                Aún no hay jugadores en el proyecto
              </p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {playerList.map((player, index) => {
                  const isSelected = player.id === selectedPlayerId;
                  const isFirst = index === 0;
                  const isLast = index === playerList.length - 1;

                  return (
                    <li key={player.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(player)}
                        className={
                          "w-full text-left px-6 py-3 text-[15px] border-x border-emerald-700 " +
                          (isFirst ? "border-t " : "") +
                          (!isLast ? "border-b " : "") +
                          (isLast && !isSelected ? "rounded-b-lg " : "") +
                          (isSelected
                            ? "bg-emerald-900/60 text-slate-50"
                            : "hover:bg-emerald-900/60 text-slate-200")
                        }
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

        <section className="relative flex-1 rounded-lg border border-emerald-700 bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src={publicPath("ui/player-watermark.png")}
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
                Selecciona un PNJ en la lista de la izquierda o pulsa{" "}
                <span className="font-semibold">“Añadir Jugador"</span> para crear uno nuevo
              </p>
            ) : (
              <>
                <div className="mb-3">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">Nombre</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Ej: Alex"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}
                </div>

                <div className="mb-3">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">
                    Descripción <span className="text-slate-400">(opcional)</span>
                  </label>

                  <textarea
                    value={draftDescription}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 resize-none
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                    placeholder="Notas del autor…"
                  />
                  {fieldErrors.description && <p className="form-field-error mt-1">{fieldErrors.description}</p>}
                </div>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[14px] text-slate-100 m-0 text-center">Imágenes</h5>

                  <div
                    className={"group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (images.isDragging
                        ? "border-emerald-400 bg-emerald-800"
                        : "border-emerald-800 bg-slate-900/40 " +
                        (images.isHoveringSelectButton ? "" : "hover:bg-emerald-900/60"))}
                    onDragOver={images.handleDragOver}
                    onDragLeave={images.handleDragLeave}
                    onDrop={images.handleDrop}
                    onClick={() => images.fileInputRef.current?.click()}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí una imagen
                      <span className="block text-xs text-slate-400">(o haz clic para seleccionarla)</span>
                      {mode === "edit" && (
                        <span className="block text-xs text-slate-400 mt-2">
                          Puedes añadir nuevas imágenes o actualizar una existente desde la lista
                        </span>
                      )}
                    </p>

                    <button
                      type="button"
                      className="btn btn-select border-emerald-800 hover:bg-emerald-950 disabled:opacity-40 disabled:cursor-not-allowed"
                      onMouseEnter={() => images.setIsHoveringSelectButton(true)}
                      onMouseLeave={() => images.setIsHoveringSelectButton(false)}
                      onClick={(e) => {
                        e.stopPropagation();
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

                        const logicalPath = image.previewSource && image.previewSource.startsWith("blob:")
                          ? image.previewSource
                          : image.imageId ?? null;

                        return (
                          <div
                            key={image.uiId}
                            className="flex gap-2 items-center rounded-md border border-slate-700 bg-slate-900 p-2"
                          >
                            <div className="h-14 w-14 bg-slate-900 overflow-hidden flex items-center justify-center">
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
                                onChange={(e) => images.renameDraftImage(image.uiId, e.target.value)}
                                className="w-full rounded-md bg-slate-950 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
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
                                onChange={() => images.setDraftDefaultImageUiId(image.uiId)}
                              />
                              Predeterminada
                            </label>

                            <button
                              type="button"
                              onClick={() => {
                                setReplaceTargetUiId(image.uiId);
                                replaceImageInputRef.current?.click();
                              }}
                              className="btn border-cyan-600 bg-cyan-800 hover:bg-cyan-700 text-xs text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              Actualizar
                            </button>

                            <button
                              type="button"
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
                      <div className="h-50 w-50 rounded-md border-2 border-emerald-700 bg-slate-950 flex items-center justify-center overflow-hidden">
                        {previewDefaultNode}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-700 pt-4">
                  <h5 className="text-[14px] text-slate-100 m-0 text-center">Variables</h5>

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
                </div>

                <InventoryEditor
                  project={project}
                  value={draftInventory}
                  openInventoryItemId={openInventoryItemId}
                  fieldErrors={fieldErrors}
                  savedInventoryItems={selectedPlayerInitialInventory}
                  addInventoryRow={addInventoryRow}
                  updateInventoryRow={updateInventoryRow}
                  removeInventoryRow={removeInventoryRow}
                  toggleInventoryItemOpen={toggleInventoryItemOpen}
                  saveInventoryRow={saveInventoryRow}
                  buttonGroupClassName="panel--players"
                  renderRulesEditor={({ item, onChange }) => (
                    <InventoryItemRulesEditor
                      project={project}
                      owner={{ kind: "playerInventoryItem", playerId: selectedPlayerId ?? "__draft_player__" }}
                      item={item}
                      onChange={onChange}
                    />
                  )}
                />

                <div className="mt-auto flex justify-between pt-6">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleDeletePlayer}
                      disabled={!selectedPlayerId}
                      className="btn btn-danger text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Eliminar Jugador
                    </button>
                  </div>

                  <div className="flex gap-3 panel--players">
                    <button
                      type="button"
                      onClick={panel.reset}
                      className="px-4 py-2 rounded-md border border-slate-500 bg-slate-800 hover:bg-slate-700 text-[12px] text-slate-100"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn btn-save"
                    >
                      Guardar Jugador
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}