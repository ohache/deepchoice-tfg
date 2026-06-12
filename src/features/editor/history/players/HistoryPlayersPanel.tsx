import { useEffect, useMemo, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { PlayerDef, ID, VarDef, InventoryItemInstance } from "@/domain/types";
import { PlayerInventoryItemRulesEditor } from "@/features/editor/history/players/PlayerInventoryItemsRulesEditor";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { type PlayerFieldErrors, validatePlayerDraft } from "@/features/editor/history/players/playerValidator";
import { ConfirmExitModal } from "@/features/editor/modals/ConfirmExitModal";
import { useAssetDraftPanel, type DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { VarRowCard } from "@/shared/vars/varRowCard";
import { usePlayerImagesDraft } from "@/features/editor/history/players/playersImageDraft";
import { useEntityVarsEditor } from "@/shared/vars/useEntityVarsEditor";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";
import { generateId } from "@/utils/id";
import { Select } from "@/components/Select";
import { toast } from "@/shared/toast/toastStore";

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

  const draftPlayerId = selectedPlayerId ?? "__draft_player__";

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
  const [draftInventory, setDraftInventory] = useState<InventoryItemInstance[]>([]);
  const [openInventoryItemId, setOpenInventoryItemId] = useState<ID | null>(null);
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
      setDraftInventory(player.initialInventory ?? []);
      setOpenInventoryItemId(null);
      setFieldErrors({});
      images.loadFromPlayer(player);
    },

    onResetDraftFields: () => {
      setDraftName("");
      setDraftDescription("");
      setDraftInventory([]);
      setOpenInventoryItemId(null);
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

  useEffect(() => () => setSelectedPlayerId(null), [setSelectedPlayerId]);

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
        vars: draftVars,
        initialInventory: draftInventory,
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

  const toggleInventoryItemOpen = (itemInstanceId: ID) => { setOpenInventoryItemId((current) => current === itemInstanceId ? null : itemInstanceId) };

  const itemOptions = project?.items ?? [];

  const addInventoryRow = () => {
    const item = itemOptions[0];
    if (!item) {
      toast.warning("No hay items", "Crea primero un item global.");
      return;
    }

    const itemInstance: InventoryItemInstance = {
      itemInstanceId: generateId.itemPlaced(),
      itemId: item.id,
      label: item.name,
    };

    setDraftInventory((prev) => [...prev, itemInstance]);
    setOpenInventoryItemId(itemInstance.itemInstanceId);
  };

  const updateInventoryRow = (itemInstanceId: ID, patch: Partial<InventoryItemInstance>) => {
    setDraftInventory((prev) =>
      prev.map((item) =>
        item.itemInstanceId === itemInstanceId ? { ...item, ...patch } : item,
      ),
    );
  };

  const removeInventoryRow = (itemInstanceId: ID) => {
    setDraftInventory((prev) => prev.filter((item) => item.itemInstanceId !== itemInstanceId));
    setOpenInventoryItemId((current) => current === itemInstanceId ? null : current);

    if (mode === "edit" && selectedPlayerId) {
      removePlayerInventoryItem(selectedPlayerId, itemInstanceId);
    }
  };

  const setInventoryItemError = (itemInstanceId: ID, message: string) => {
    setFieldErrors((prev) => ({
      ...prev,
      inventoryItemById: {
        ...(prev.inventoryItemById ?? {}),
        [itemInstanceId]: message,
      },
    }));
  };

  const clearInventoryItemError = (itemInstanceId: ID) => {
    setFieldErrors((prev) => {
      const nextById = { ...(prev.inventoryItemById ?? {}) };
      delete nextById[itemInstanceId];

      return {
        ...prev,
        inventoryItemById: Object.keys(nextById).length > 0 ? nextById : undefined,
      };
    });
  };

  const saveInventoryRow = (item: InventoryItemInstance) => {
    if (!project) return;

    clearInventoryItemError(item.itemInstanceId);

    if (!item.itemId) {
      setInventoryItemError(item.itemInstanceId, "Selecciona un tipo de item.");
      toast.warning("Item incompleto", "Selecciona un tipo de item.");
      return;
    }

    const label = item.label.trim();

    if (!label) {
      setInventoryItemError(item.itemInstanceId, "El item necesita una etiqueta.");
      toast.warning("Etiqueta obligatoria", "El item necesita una etiqueta.");
      return;
    }

    if (label.length > 60) {
      toast.warning("Nombre demasiado largo", "La etiqueta no puede superar 60 caracteres.");
      return;
    }

    const duplicatedInDraft = draftInventory.some(
      (other) =>
        other.itemInstanceId !== item.itemInstanceId &&
        other.label.trim().toLowerCase() === label.toLowerCase(),
    );

    if (duplicatedInDraft) {
      setInventoryItemError(item.itemInstanceId, "Ya hay otro item del inventario con ese nombre.");
      toast.warning("Nombre repetido", "Ya hay otro item del inventario con ese nombre.");
      return;
    }

    if (hasDuplicatedItemInstanceLabel(project, label, item.itemInstanceId)) {
      setInventoryItemError(item.itemInstanceId, "Ya existe otro item instanciado con ese nombre.");
      toast.warning("Nombre repetido", "Ya existe otro item instanciado con ese nombre.");
      return;
    }

    const cleanItem: InventoryItemInstance = {
      ...item,
      label,
    };

    setDraftInventory((prev) =>
      prev.map((current) =>
        current.itemInstanceId === cleanItem.itemInstanceId ? cleanItem : current,
      ),
    );

    if (mode === "edit" && selectedPlayerId) {
      const existedBefore = selectedPlayer?.initialInventory?.some(
        (existing) => existing.itemInstanceId === cleanItem.itemInstanceId,
      );

      if (existedBefore) updatePlayerInventoryItem(selectedPlayerId, cleanItem);
      else addPlayerInventoryItem(selectedPlayerId, cleanItem);
    }

    setOpenInventoryItemId(null);
    toast.success("Item guardado", `“${cleanItem.label}”`);
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
      initialInventory: draftInventory,
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

    for (const item of draftInventory) {
      const existedBefore = selectedPlayer?.initialInventory?.some(
        (existing) => existing.itemInstanceId === item.itemInstanceId,
      );

      if (existedBefore) updatePlayerInventoryItem(selectedPlayerId, item);
      else addPlayerInventoryItem(selectedPlayerId, item);
    }

    const currentInventoryIds = new Set(
      (selectedPlayer?.initialInventory ?? []).map((item) => item.itemInstanceId),
    );

    const keptInventoryIds = new Set(draftInventory.map((item) => item.itemInstanceId));

    for (const itemInstanceId of currentInventoryIds) {
      if (!keptInventoryIds.has(itemInstanceId)) {
        removePlayerInventoryItem(selectedPlayerId, itemInstanceId);
      }
    }

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

  const handleExitDiscard = () => {
    setIsExitModalOpen(false);
    panel.reset();
  };

  const handleExitSave = () => {
    const ok = handleSave();
    if (ok) setIsExitModalOpen(false);
  };

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
            + Añadir personaje
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {playerList.length === 0 ? (
              <p className="p-4 text-[12px] text-slate-320 text-center">
                Aún no hay personajes en el proyecto
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
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">Nombre</label>
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
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">
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
                      disabled={!canEdit}
                      className="btn btn-select border-emerald-800 hover:bg-emerald-950 disabled:opacity-40 disabled:cursor-not-allowed"
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
                                disabled={!canEdit}
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
                                disabled={!canEdit}
                                onChange={() => images.setDraftDefaultImageUiId(image.uiId)}
                              />
                              Predeterminada
                            </label>

                            <button
                              type="button"
                              disabled={!canEdit}
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

                  <div className="mt-4 border-t border-slate-700 pt-4">
                    <h5 className="text-[14px] text-slate-100 m-0 text-center">Inventario inicial</h5>

                    <div className="mt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={addInventoryRow}
                        className="btn btn-add-variant bg-rose-800 border-rose-600 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed mt-1 mb-1"
                        disabled={!canEdit || openInventoryItemId !== null}
                        title={openInventoryItemId ? "Termina la edición del item abierto." : "Añadir item"}
                      >
                        + Añadir item
                      </button>
                    </div>

                    {fieldErrors.initialInventory && (
                      <p className="form-field-error mt-2 text-center">{fieldErrors.initialInventory}</p>
                    )}

                    <div className="space-y-2 mt-3">
                      {draftInventory.map((item) => {

                        const isOpen = item.itemInstanceId === openInventoryItemId;
                        const itemDef = itemOptions.find((option) => option.id === item.itemId);

                        return (
                          <div
                            key={item.itemInstanceId}
                            className={
                              "rounded-md border-2 border-slate-700 bg-slate-950 p-2 " +
                              (!isOpen ? "hover:bg-slate-900" : "")
                            }
                          >
                            <button
                              type="button"
                              onClick={() => toggleInventoryItemOpen(item.itemInstanceId)}
                              className="w-full text-left text-[13px] text-slate-100"
                            >
                              <span className="ml-1 font-semibold">{item.label || "Item sin nombre"}</span>
                              <span className="text-slate-300"> · {itemDef?.name ?? "Item desconocido"}</span>
                            </button>

                            {isOpen && (
                              <div className="-mx-2 mt-3 border-t border-slate-600 px-2 pt-3 space-y-2">
                                <div>
                                  <label className="block text-[12px] text-center text-slate-100 mt-2 mb-2">
                                    Tipo de item
                                  </label>

                                  <Select<ID>
                                    value={item.itemId}
                                    disabled={!canEdit}
                                    placeholder="Selecciona item…"
                                    options={itemOptions.map((option) => ({
                                      id: option.id,
                                      label: option.name,
                                    }))}
                                    onChange={(nextItemId) => {
                                      if (!nextItemId) return;
                                      updateInventoryRow(item.itemInstanceId, { itemId: nextItemId });
                                    }}
                                    buttonClassName="border-2 border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 focus:ring-emerald-500"
                                    menuClassName="border-slate-700 bg-slate-900"
                                    optionClassName="hover:bg-emerald-900"
                                  />
                                </div>

                                <div>
                                  <label className="block text-[12px] text-center text-slate-100 mt-3 mb-2">
                                    Nombre
                                  </label>
                                  <input
                                    type="text"
                                    value={item.label}
                                    disabled={!canEdit}
                                    onChange={(e) => {
                                      clearInventoryItemError(item.itemInstanceId);
                                      updateInventoryRow(item.itemInstanceId, { label: e.target.value });
                                    }}
                                    className="w-full rounded-md bg-slate-950 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
                                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                                    placeholder="Ej: Objeto oxidado"
                                  />
                                </div>

                                {fieldErrors.inventoryItemById?.[item.itemInstanceId] && (
                                  <p className="form-field-error mt-1">
                                    {fieldErrors.inventoryItemById[item.itemInstanceId]}
                                  </p>
                                )}


                                <PlayerInventoryItemRulesEditor
                                  project={project}
                                  playerId={draftPlayerId}
                                  item={item}
                                  canEdit={canEdit}
                                  onChange={(patch) => updateInventoryRow(item.itemInstanceId, patch)}
                                />

                                <div className="flex justify-end gap-2 panel--players">
                                  <button
                                    type="button"
                                    onClick={() => saveInventoryRow(item)}
                                    className="btn btn-save text-[11px]"
                                  >
                                    Guardar
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => removeInventoryRow(item.itemInstanceId)}
                                    className="btn btn-danger text-[11px]"
                                  >
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="mt-auto flex justify-between pt-6">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={handleDeletePlayer}
                      disabled={!selectedPlayerId}
                      className="btn btn-danger text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Eliminar Player
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
                      Guardar Player
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

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