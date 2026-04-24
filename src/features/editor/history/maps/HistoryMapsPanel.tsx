import { useEffect, useMemo, useRef, useState } from "react";
import type { WorldMap } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateMapDraft } from "@/features/editor/history/maps/mapValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import type { MapFieldErrors } from "@/features/editor/history/maps/mapValidator";
import { useImageFileDraft } from "@/features/editor/history/shared/useImageFileDraft";
import { useAssetDraftPanel } from "@/features/editor/history/shared/useAssetDraftPanel";
import { DeleteProjectEntityModal } from "@/features/editor/modals/DeleteProjectEntityModal";
import { HistoryMapRegionsPanel } from "@/features/editor/history/maps/HistoryMapRegionPanel";
import { MapRegionCanvas } from "@/features/editor/history/maps/MapRegionCanvas";
import { toast } from "@/shared/toast/toastStore";

type MapVisualType = "singleImage" | "composed";

function getModeTitle(mode: "none" | "new" | "edit") {
  if (mode === "new") return "Nuevo mapa";
  if (mode === "edit") return "Editar mapa";
  return "Detalle de mapa";
}

export function HistoryMapsPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedMapId = useEditorStore((s) => s.selectedMapId);
  const setSelectedMapId = useEditorStore((s) => s.setSelectedMapId);
  const addMap = useEditorStore((s) => s.addMap);
  const updateMap = useEditorStore((s) => s.updateMap);
  const removeMap = useEditorStore((s) => s.removeMap);

  const clearMapRegionEditor = useEditorStore((s) => s.clearMapRegionEditor);

  const [draftName, setDraftName] = useState("");
  const [draftVisualType, setDraftVisualType] = useState<MapVisualType>("singleImage");
  const [fieldErrors, setFieldErrors] = useState<Partial<MapFieldErrors>>({});
  const [editMode, setEditMode] = useState<"map" | "region">("region");
  const [mapRegionPanelError, setMapRegionPanelError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const mapsList = useMemo(() => project?.maps ?? [], [project]);

  const selectedMap = useMemo(() => {
    if (!selectedMapId || !project) return null;
    return mapsList.find((map) => map.id === selectedMapId) ?? null;
  }, [selectedMapId, project, mapsList]);

  const inferredMode: "none" | "edit" = selectedMapId ? "edit" : "none";

  const image = useImageFileDraft({
    mode: inferredMode,
    selectedId: selectedMapId,
    isDuplicateFile: (file, ctx) => {
      if (!project) return false;

      return hasDuplicateFileByLinkedAssetId({
        project,
        list: project.maps ?? [],
        assetKind: "maps",
        incomingFileName: file.name,
        ignoreId: ctx.mode === "edit" ? ctx.selectedId ?? undefined : undefined,
      });
    },
    messages: {
      duplicateFieldError: "Ya existe un mapa que usa esta imagen.",
      duplicateToastTitle: "Archivo duplicado",
      duplicateToastBody: "Ya hay un mapa usando esa imagen.",
    },
  });

  useEffect(() => {
    return () => {
      clearMapRegionEditor();
      setSelectedMapId(null);
    };
  }, [clearMapRegionEditor, setSelectedMapId]);

  useEffect(() => {
    setEditMode("region");
  }, [selectedMapId]);

  const loadDraftFromSelectedMap = (map: WorldMap) => {
    setDraftName(map.name ?? "");
    setDraftVisualType(map.visual.type);
    setFieldErrors({});
    image.resetImageDraft();

    const assetId = map.visual.type === "singleImage"
        ? map.visual.imageAssetId
        : map.visual.backgroundAssetId;

    const assetPath = (project?.assets ?? []).find((asset) => asset.kind === "maps" && asset.id === assetId)?.file?.trim() ?? "";

    image.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");
    image.loadPreviewFromExistingFile(assetFiles?.[assetId]);
  };

  const resetDraftFields = () => {
    setDraftName("");
    setDraftVisualType("singleImage");
    setFieldErrors({});
    image.resetImageDraft();
    setMapRegionPanelError(null);
    clearMapRegionEditor();
    setEditMode("region");
  };

  const panel = useAssetDraftPanel<WorldMap>({
    hasProject: !!project,
    selectedId: selectedMapId,
    focusRef: nameInputRef,
    items: mapsList,
    setSelectedId: (id) => {
      setMapRegionPanelError(null);
      clearMapRegionEditor();
      setSelectedMapId(id);
      setEditMode("region");
    },
    onLoadDraftFieldsFromSelected: loadDraftFromSelectedMap,
    onResetDraftFields: resetDraftFields,
  });

  const mode = panel.mode;
  const rightTitle = mode === "edit" && editMode === "region"
      ? "Editar regiones"
      : getModeTitle(mode);

  const showMapConfig = mode === "new" || (mode === "edit" && editMode === "map");
  const showRegionEditor = mode === "edit" && !!selectedMap && editMode === "region";

  const validateDraft = (): boolean => {
    if (!project) return false;

    const { ok, errors } = validateMapDraft(
      { name: draftName, file: image.draftFile ?? undefined },
      { mode: mode === "edit" ? "edit" : "new",
        project,
        currentMapId: selectedMapId ?? undefined},
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");

    return ok;
  };

  const cleanupAfterSaveOrDelete = () => {
    clearMapRegionEditor();
    setSelectedMapId(null);
    setEditMode("region");
    panel.reset();
  };

  const handleCreate = () => {
    if (!image.draftFile) {
      toast.error("Falta imagen", "Selecciona una imagen antes de guardar.");
      return;
    }

    const nameTrim = draftName.trim();

    const id = addMap({
      name: nameTrim,
      file: image.draftFile,
      visualType: draftVisualType,
    });

    if (!id) {
      toast.error("No se pudo crear", "Revisa si el nombre o el archivo ya están en uso.");
      return;
    }

    cleanupAfterSaveOrDelete();
    toast.success("Mapa creado", `“${nameTrim}”`);
  };

  const handleUpdate = () => {
    if (!selectedMapId) return;

    const nameTrim = draftName.trim();
    const replacingFile = !!image.draftFile;

    updateMap(selectedMapId, {
      name: nameTrim,
      file: image.draftFile ?? undefined,
      visualType: draftVisualType,
    });

    cleanupAfterSaveOrDelete();

    toast.success(replacingFile ? "Mapa actualizado (imagen reemplazada)" : "Mapa actualizado", `“${nameTrim}”`);
  };

  const handleSave = () => {
    if (!project) return;
    if (!validateDraft()) return;

    if (mode === "new") {
      handleCreate();
      return;
    }

    if (mode === "edit") handleUpdate();
  };

  const handleConfirmDelete = () => {
    if (!selectedMapId) {
      panel.reset();
      return;
    }

    const deletedName = selectedMap?.name ?? "Mapa";
    removeMap(selectedMapId);
    toast.success("Mapa eliminado", `“${deletedName}”`);
    cleanupAfterSaveOrDelete();
  };

  const handleEditMap = () => {
    clearMapRegionEditor();
    setEditMode("map");
  };

  const handleEnterRegionMode = () => {setEditMode("region")};

  if (!project) return null;

  const fileError = fieldErrors.file ?? image.fileError;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-3 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        <aside className="w-1/3 rounded-lg border border-amber-700 bg-slate-950 flex flex-col overflow-hidden">
          {mode === "edit" && selectedMap ? (
            <HistoryMapRegionsPanel
              mapId={selectedMap.id}
              mapVisualType={selectedMap.visual.type}
              isRegionMode={editMode === "region"}
              panelError={mapRegionPanelError}
              setPanelError={setMapRegionPanelError}
              onEditMap={handleEditMap}
              onEnterRegionMode={handleEnterRegionMode}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={panel.startNew}
                className="px-3 py-2 text-base font-semibold bg-amber-800 hover:bg-amber-700 text-white rounded-t-lg"
              >
                + Añadir mapa
              </button>

              <div className="flex-1 overflow-y-auto text-[15px]">
                {mapsList.length === 0 ? (
                  <p className="p-4 text-xs text-slate-320 text-center">No hay mapas en el proyecto</p>
                ) : (
                  <ul>
                    {mapsList.map((map, index) => {
                      const isSelected = map.id === selectedMapId;
                      const isFirst = index === 0;
                      const isLast = index === mapsList.length - 1;

                      return (
                        <li key={map.id}>
                          <button
                            type="button"
                            onClick={() => panel.handleListClick(map)}
                            className={
                          "w-full text-left px-6 py-3 text-[15px] border-x border-amber-700 " +
                          (isFirst ? "border-t " : "") +
                          (!isLast ? "border-b " : "") +
                          (isLast && !isSelected ? "rounded-b-lg " : "") +
                          (isSelected
                            ? "bg-amber-900/60 text-slate-50"
                            : "hover:bg-amber-900/60 text-slate-200")
                        }
                          >
                            <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                              {map.name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </aside>

        <section className="relative flex-1 rounded-lg border border-amber-700 bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src="/ui/map-watermark.png"
              alt="Logo de mapas"
              className="px-3 pointer-events-none absolute right-[7%] top-52/100 -translate-y-1/2 w-3/4 opacity-[0.06]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-amber-800 border-b border-amber-900 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">{rightTitle}</h4>
          </div>

          <div className="p-4 flex-1 flex flex-col min-h-0">
            {mode === "none" ? (
              <p className="text-[11px] text-slate-200 text-center">
                Selecciona un mapa en la lista de la izquierda o pulsa{" "}
                <span className="font-semibold">“Añadir mapa”</span> para crear uno nuevo
              </p>
            ) : (
              <>
                <div className="mb-2">
                  <label className="block text-[14px] text-slate-100 mb-1 text-center">Nombre</label>
                  <input
                    ref={nameInputRef}
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                      focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-600"
                    placeholder="Ej: Pueblo"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}

                  {showRegionEditor ? (
                    <p className="mt-2 text-[11px] text-slate-400 text-center">
                      Para cambiar la configuración global del mapa, selecciona el mapa en el panel izquierdo.
                    </p>
                  ) : null}
                </div>

                {showMapConfig ? (
                  <>
                    <div className="mb-3">
                      <label className="block text-[14px] text-slate-100 mb-2 text-center">
                        Tipo de mapa
                      </label>

                      {mode === "new" ? (
                        <div className="flex gap-2 justify-center">
                          <button
                            type="button"
                            onClick={() => setDraftVisualType("singleImage")}
                            className={ "px-3 py-2 rounded-md border text-xs font-medium transition " +
                              (draftVisualType === "singleImage"
                                ? "bg-amber-800 border-amber-500 text-white"
                                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800")}
                          >
                            Imagen única
                          </button>

                          <button
                            type="button"
                            onClick={() => setDraftVisualType("composed")}
                            className={ "px-3 py-2 rounded-md border text-xs font-medium transition " +
                              (draftVisualType === "composed"
                                ? "bg-amber-800 border-amber-500 text-white"
                                : "bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800")}
                          >
                            Composición
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 text-center">
                          {draftVisualType === "singleImage" ? "Single image" : "Composed"}
                        </div>
                      )}

                      <p className="mt-2 text-[11px] text-slate-400 text-center">
                        {draftVisualType === "singleImage"
                          ? "El mapa se construye a partir de una única imagen global."
                          : "El mapa usa una imagen de fondo. Las diferentes regiones tienen su propia imagen."}
                      </p>
                    </div>

                    <div className="mb-2 mt-2">
                      <label className="block text-[13px] text-slate-200 mb-1 text-center">
                        {draftVisualType === "singleImage" ? "Imagen base del mapa" : "Imagen de fondo del mapa"}
                      </label>

                      <div
                        className={ "group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                          "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                          (image.isDragging
                            ? "border-amber-400 bg-amber-800"
                            : "border-amber-800 bg-slate-900/40 " +
                              (image.isHoveringSelectButton ? "" : "hover:bg-amber-900/60"))}
                        onDragOver={image.handleDragOver}
                        onDragLeave={image.handleDragLeave}
                        onDrop={image.handleDrop}
                        onClick={() => image.fileInputRef.current?.click()}
                      >
                        <p className="mb-2 text-slate-200 text-center">
                          Arrastra aquí una imagen
                          <span className="block text-xs text-slate-400">(o haz clic para seleccionarla)</span>
                          {mode === "edit" ? (
                            <span className="block text-xs text-slate-400 mt-2">
                              En edición, sustituirá la imagen actual.
                            </span>
                          ) : null}
                        </p>

                        <button
                          type="button"
                          className="btn btn-select border-amber-800 hover:bg-amber-950"
                          onMouseEnter={() => image.setIsHoveringSelectButton(true)}
                          onMouseLeave={() => image.setIsHoveringSelectButton(false)}
                          onClick={(e) => {
                            e.stopPropagation();
                            image.fileInputRef.current?.click();
                          }}
                        >
                          Seleccionar…
                        </button>
                      </div>

                      <input
                        ref={image.fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={image.handleFileChange}
                      />

                      {fileError && <p className="form-field-error mt-1">{fileError}</p>}
                    </div>

                    {!!image.previewUrl && (
                      <div className="mt-3 flex justify-center">
                        <img
                          src={image.previewUrl}
                          alt="Preview del mapa"
                          className="max-h-56 rounded-md border border-slate-700"
                          draggable="false"
                        />
                      </div>
                    )}

                    {image.isReady && (
                      <div className="mt-3 text-[11px] text-slate-400 flex justify-center mb-1">
                        <span className="inline-flex items-center gap-1 text-emerald-400">
                          <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                          <span>Archivo listo</span>
                        </span>
                      </div>
                    )}
                  </>
                ) : null}

                {showRegionEditor ? (
                  <div className="mt-3 flex-1 min-h-0">
                    <MapRegionCanvas
                      mapId={selectedMap.id}
                      mapVisualType={selectedMap.visual.type}
                      setPanelError={setMapRegionPanelError}
                    />
                  </div>
                ) : null}

                <div className="mt-auto flex justify-between pt-5">
                  <button
                    type="button"
                    onClick={panel.openDelete}
                    disabled={!selectedMapId}
                    className="btn btn-danger border-rose-500 bg-rose-800 hover:bg-rose-500 text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar mapa
                  </button>

                  <div className="flex gap-3 panel--map">
                    <button
                      type="button"
                      onClick={panel.reset}
                      className="btn btn-cancel text-[12px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="btn btn-save"
                    >
                      {mode === "new" ? "Añadir mapa" : "Guardar mapa"}
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
        entityName={selectedMap?.name ?? ""}
        description="Este mapa dejará de estar disponible para las escenas asociadas a él."
        onConfirm={handleConfirmDelete}
        onCancel={panel.cancelDelete}
      />
    </div>
  );
}