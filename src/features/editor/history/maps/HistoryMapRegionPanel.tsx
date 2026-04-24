import { useEffect, useMemo, useRef } from "react";
import type { ID, MapRegion } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { RegionStatusNotice } from "@/features/editor/scene/interactiveComponents/RegionStatusNotice";
import { Select, type Option } from "@/components/Select";
import { Checkbox } from "@/components/Checkbox";
import { Pencil, ImageIcon } from "lucide-react";
import { toast } from "@/shared/toast/toastStore";

type HistoryMapRegionsPanelProps = {
  mapId: ID;
  mapVisualType: "singleImage" | "composed";
  isRegionMode: boolean;
  panelError: string | null;
  setPanelError: React.Dispatch<React.SetStateAction<string | null>>;
  onEditMap: () => void;
  onEnterRegionMode: () => void;
};

export function HistoryMapRegionsPanel({ mapId, mapVisualType, isRegionMode, panelError, setPanelError, onEditMap, onEnterRegionMode }: HistoryMapRegionsPanelProps) {
  const project = useEditorStore((s) => s.project);

  const selectedMapId = useEditorStore((s) => s.selectedMapId);
  const setSelectedMapId = useEditorStore((s) => s.setSelectedMapId);

  const mapRegionEditor = useEditorStore((s) => s.mapRegionEditor);
  const setMapRegionSelection = useEditorStore((s) => s.setMapRegionSelection);
  const clearMapRegionEditor = useEditorStore((s) => s.clearMapRegionEditor);

  const startPlacingMapRegion = useEditorStore((s) => s.startPlacingMapRegion);
  const editMapRegion = useEditorStore((s) => s.editMapRegion);
  const cancelMapRegionDraft = useEditorStore((s) => s.cancelMapRegionDraft);

  const setMapRegionDraftLabel = useEditorStore((s) => s.setMapRegionDraftLabel);
  const setMapRegionDraftVisible = useEditorStore((s) => s.setMapRegionDraftVisible);
  const setMapRegionDraftImageAssetId = useEditorStore((s) => s.setMapRegionDraftImageAssetId);
  const setMapRegionDraftMusicTrackId = useEditorStore((s) => s.setMapRegionDraftMusicTrackId);
  const setMapRegionDraftSubMapId = useEditorStore((s) => s.setMapRegionDraftSubMapId);
  const startRedrawMapRegionShape = useEditorStore((s) => s.startRedrawMapRegionShape);

  const saveMapRegionDraft = useEditorStore((s) => s.saveMapRegionDraft);
  const removeMapRegion = useEditorStore((s) => s.removeMapRegion);
  const validateMapRegionDraft = useEditorStore((s) => s.validateMapRegionDraft);

  const addMapRegionImageAsset = useEditorStore((s) => s.addMapRegionImageAsset);

  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const regionImageInputRef = useRef<HTMLInputElement | null>(null);

  const selectedMap = useMemo(() => (project?.maps ?? []).find((map) => map.id === mapId) ?? null, [project, mapId]);

  const musicTracks = useMemo(() => project?.musicTracks ?? [], [project]);
  const allMaps = useMemo(() => project?.maps ?? [], [project]);
  const regions = useMemo(() => selectedMap?.regions ?? [], [selectedMap]);
  const subMapOptions = useMemo(() => allMaps.filter((map) => map.id !== mapId), [allMaps, mapId]);

  const musicTrackOptions: Option<string>[] = musicTracks.map((track) => ({ id: track.id, label: track.name }));

  const subMapSelectOptions: Option<string>[] = subMapOptions.map((map) => ({ id: map.id, label: map.name }));

  const selectedRegionId = mapRegionEditor.selection.regionId;

  const selectedRegion = useMemo(() => {
    if (!selectedRegionId || !selectedMap) return null;
    return regions.find((region) => region.id === selectedRegionId) ?? null;
  }, [selectedRegionId, selectedMap, regions]);

  const draft = mapRegionEditor.draft;

  const isEditing = mapRegionEditor.mode.type !== "idle" && !!draft;
  const isDrawing = mapRegionEditor.mode.type === "drawing";
  const hasShape = !!draft?.shape;
  const isExistingRegion = !!selectedRegion;
  const isComposedMap = mapVisualType === "composed";

  useEffect(() => {
    if (mapRegionEditor.mode.type === "editing" && draft?.shape) labelInputRef.current?.focus();
  }, [mapRegionEditor.mode.type, draft?.id, draft?.shape]);

  const resetRegionEditor = () => {
    cancelMapRegionDraft();
    clearMapRegionEditor();
    setMapRegionSelection({ regionId: null });
  };

  const openRegionImagePicker = () => { regionImageInputRef.current?.click() };

  const handleRegionImageSelected = (file?: File | null) => {
    if (!file) return;

    const assetId = addMapRegionImageAsset({ file });
    if (!assetId) {
      toast.error("No se pudo crear la imagen", "Revisa el archivo seleccionado.");
      return;
    }

    setPanelError(null);

    if (!draft) {
      startPlacingMapRegion({ imageAssetId: assetId });
      return;
    }

    setMapRegionDraftImageAssetId(assetId);
  };

  const handleStartNew = () => {
    setPanelError(null);

    if (selectedMapId !== mapId) setSelectedMapId(mapId);

    onEnterRegionMode();

    if (isComposedMap) {
      openRegionImagePicker();
      return;
    }

    startPlacingMapRegion();
  };

  const handleSelectRegion = (region: MapRegion) => {
    if (selectedMapId !== mapId) setSelectedMapId(mapId);

    const isSameRegionOpen = isRegionMode && mapRegionEditor.mode.type === "editing" && mapRegionEditor.selection.regionId === region.id;

    if (isSameRegionOpen) {
      setPanelError(null);
      resetRegionEditor();
      return;
    }

    setPanelError(null);
    onEnterRegionMode();
    setMapRegionSelection({ regionId: region.id });
    editMapRegion(region.id);
  };

  const handleRegionAreaClick = () => { if (!isRegionMode) onEnterRegionMode() };

  const handleSave = () => {
    setPanelError(null);

    const result = validateMapRegionDraft();
    if (!result.ok) {
      setPanelError(result.error ?? "Hay errores en la región.");
      return;
    }

    const id = saveMapRegionDraft();
    if (!id) {
      setPanelError("Revisa la región antes de guardar.");
      return;
    }

    resetRegionEditor();
    toast.success("Región guardada", "La región del mapa se ha guardado correctamente.");
  };

  const handleDelete = () => {
    if (!selectedRegionId) return;

    const deletedName = selectedRegion?.label ?? "Región";
    removeMapRegion(selectedRegionId);
    toast.success("Región eliminada", `“${deletedName}”`);
  };

  const handleCancel = () => {
    setPanelError(null);
    resetRegionEditor();
  };

  if (!project || !selectedMap) return null;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <input
        ref={regionImageInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          handleRegionImageSelected(file);
          e.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEditMap();
        }}
        className="w-full px-3 py-2 text-base font-semibold bg-amber-800 hover:bg-amber-700 text-white rounded-t-lg"
      >
        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-center">
          {selectedMap.name}
        </span>
      </button>

      <div className="px-3 py-2 flex flex-col items-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleStartNew();
          }}
          className="px-4 py-2 mt-2 text-sm font-semibold bg-cyan-800 hover:bg-cyan-700 text-white rounded-md"
        >
          + Añadir región
        </button>

        {regions.length > 0 ? <div className="w-full h-px bg-slate-700 mt-3" /> : null}
      </div>

      <div className="flex-1 overflow-y-auto" onClick={handleRegionAreaClick}>
        <div className="p-3 space-y-3">
          {regions.length > 0 ? (
            <div className="pt-1 flex flex-col items-center gap-2">
              {regions.map((region) => {
                const isSelected =
                  isRegionMode &&
                  mapRegionEditor.mode.type === "editing" &&
                  mapRegionEditor.selection.regionId === region.id;

                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectRegion(region);
                    }}
                    className={"flex items-center gap-2 rounded-md border px-3 py-2 select-none w-full text-left transition-colors " +
                      (isSelected
                        ? "border-amber-500 bg-amber-900/40 text-white"
                        : "border-slate-700 bg-slate-900 hover:bg-amber-900/40 text-slate-200")}
                    title={isSelected ? "Click: colapsar" : "Click: editar región"}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-white truncate">
                        {(region.label ?? "").trim() || "(Sin etiqueta)"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {isRegionMode && isEditing ? (
            <div
              className="bg-slate-950/40 p-3 space-y-3 rounded-lg border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              {panelError ? (
                <div className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
                  {panelError}
                </div>
              ) : (
                <RegionStatusNotice
                  isDrawing={isDrawing}
                  hasShape={hasShape}
                  hasCollisions={false}
                  collisionSummary=""
                  collisionLock={{ active: false, summary: "" }}
                  drawingText="Dibuja una región sobre el mapa arrastrando con el ratón."
                  missingShapeText="Debes dibujar primero una región válida."
                />
              )}

              <div className="space-y-1">
                <div className="text-xs text-slate-100 mb-1.5 text-center">Etiqueta</div>

                <div className="flex items-center gap-2">
                  <input
                    ref={labelInputRef}
                    value={draft?.label ?? ""}
                    onChange={(e) => {
                      if (panelError) setPanelError(null);
                      setMapRegionDraftLabel(e.target.value);
                    }}
                    className="flex flex-1 min-w-0 rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500"
                    placeholder="Ej: Cocina"
                    disabled={!hasShape}
                  />

                  {isComposedMap ? (
                    <button
                      type="button"
                      disabled={isDrawing}
                      className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-[11px] text-white disabled:opacity-40"
                      onClick={openRegionImagePicker}
                      title="Cambiar imagen"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
                    onClick={startRedrawMapRegionShape}
                    title={isDrawing
                      ? "Termina o cancela el dibujo actual antes de editar la región"
                      : "Editar región"}
                    disabled={isDrawing}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {isComposedMap ? (
                <div className="bg-slate-950/30 px-2 py-2 space-y-3">
                  <div className="text-xs text-slate-300 text-center">Visibilidad inicial</div>

                  <label className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-slate-200">Visible inicialmente</span>
                    <Checkbox
                      checked={!!draft?.visible}
                      disabled={!hasShape}
                      onChange={setMapRegionDraftVisible}
                    />
                  </label>
                </div>
              ) : null}

              <div className="bg-slate-950/30 px-2 py-2">
                <div className="text-xs text-slate-300 text-center mb-2">
                  Música asociada <span className="text-slate-400">(opcional)</span>
                </div>

                <Select<string>
                  value={draft?.musicTrackId ?? ""}
                  disabled={!hasShape}
                  onChange={(value) => setMapRegionDraftMusicTrackId(value || undefined)}
                  options={musicTrackOptions}
                  placeholder="— Sin música —"
                  buttonClassName="border-2 border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="bg-slate-950/30 px-2 py-2">
                <div className="text-xs text-slate-300 text-center mb-2">
                  Submapa asociado <span className="text-slate-400">(opcional)</span>
                </div>

                <Select<string>
                  value={draft?.subMapId ?? ""}
                  disabled={!hasShape}
                  onChange={(value) => setMapRegionDraftSubMapId(value || undefined)}
                  options={subMapSelectOptions}
                  placeholder="— Sin submapa —"
                  buttonClassName="border-2 border-slate-700 bg-slate-900 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <div>
                  {isExistingRegion ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDrawing}
                      className="px-2 py-1 rounded-md border border-rose-700 bg-rose-950/20 text-white hover:bg-rose-900/30 text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-2 py-1 rounded-md border border-slate-600 bg-slate-900 text-white hover:bg-slate-800 text-[11px]"
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-2 py-1 rounded-md border border-emerald-700 bg-emerald-800/30 text-white hover:bg-emerald-700/40 text-[11px]"
                    title={isDrawing ? "Termina o cancela el dibujo actual antes de guardar" : !hasShape
                      ? "Dibuja una región válida antes de guardar" : !(draft?.label ?? "").trim()
                        ? "La etiqueta es obligatoria" : undefined}
                  >
                    Guardar
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}