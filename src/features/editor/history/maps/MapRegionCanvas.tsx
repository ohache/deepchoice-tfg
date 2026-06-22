import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ID, MapRegion, RegionShape } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";
import { useRegionShapeRectDrawing } from "@/features/editor/hooks/useRegionShapeRectDrawing";
import { rectStyleFromShape, isValidRect01, rect01Intersects, DEFAULT_MIN_RECT_01 } from "@/features/editor/hooks/regionShape";

/* Genera una URL temporal a partir de un File. Lo limpia cuando cambia o se desmonta */
function useObjectUrl(file?: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  return url;
}

/* Capa visual de región persistida */
function RegionImageOverlay({ assetId, style, alt }: { assetId: ID; style: CSSProperties; alt: string }) {
  const imageUrl = useResolvedAssetUrl(assetId);
  if (!imageUrl) return null;

  return (
    <img
      src={imageUrl}
      alt={alt}
      style={style}
      className="absolute pointer-events-none select-none object-fill"
      draggable={false}
    />
  );
}

/* Previsualización de región en edición */
function DraftRegionImagePreview({ imageAssetId, imageFile, shape, contentRectInContainer}:
  { imageAssetId?: ID | null; imageFile?: File | null; shape: RegionShape | null; contentRectInContainer: Rect | null }) {
  const persistedImageUrl = useResolvedAssetUrl(imageAssetId ?? null);
  const draftImageUrl = useObjectUrl(imageFile);

  const imageUrl = draftImageUrl ?? persistedImageUrl;
  const style = rectStyleFromShape(shape ?? null, contentRectInContainer);

  if (!imageUrl || !style) return null;

  return (
    <img
      src={imageUrl}
      alt="Preview de región"
      style={style}
      className="absolute pointer-events-none select-none object-fill"
      draggable={false}
    />
  );
}

export function MapRegionCanvas({ mapId, mapVisualType, setPanelError }:
  { mapId: ID; mapVisualType: "singleImage" | "composed"; setPanelError: React.Dispatch<React.SetStateAction<string | null>> }) {
  const project = useEditorStore((s) => s.project);

  const mapRegionEditor = useEditorStore((s) => s.mapRegionEditor);
  const editMapRegion = useEditorStore((s) => s.editMapRegion);
  const setMapRegionDraftShape = useEditorStore((s) => s.setMapRegionDraftShape);
  const clearMapRegionDraftShape = useEditorStore((s) => s.clearMapRegionDraftShape);
  const finishDrawingMapRegion = useEditorStore((s) => s.finishDrawingMapRegion);
  const startRedrawMapRegionShape = useEditorStore((s) => s.startRedrawMapRegionShape);

  /* Mapa activo en pantalla */
  const selectedMap = useMemo(() => (project?.maps ?? []).find((map) => map.id === mapId) ?? null, [project, mapId]);

  /* Asset base del mapa */
  const effectiveAssetId = useMemo<ID | null>(() => {
    if (!selectedMap) return null;

    return selectedMap.visual.type === "singleImage" ? selectedMap.visual.imageAssetId : selectedMap.visual.backgroundAssetId;
  }, [selectedMap]);

  const imageUrl = useResolvedAssetUrl(effectiveAssetId);
  const regions: MapRegion[] = selectedMap?.regions ?? [];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastRejectedShapeKeyRef = useRef("");

  const { contentRectInContainer, toContainerPx } = useObjectContainRect({ containerRef, imgRef });

  const draft = mapRegionEditor.draft;
  const draftShape = draft?.shape ?? null;
  const selectedRegionId = mapRegionEditor.selectedRegionId;

  const isDraftOnActiveMap = mapRegionEditor.mapId != null && String(mapRegionEditor.mapId) === String(mapId);

  const isDrawing = mapRegionEditor.mode.type === "drawing" && isDraftOnActiveMap;

  const draftShapeStyle = rectStyleFromShape(isDraftOnActiveMap ? draftShape : null, contentRectInContainer);

  const showDraftRegionImagePreview = mapVisualType === "composed" && isDraftOnActiveMap && !!draftShape && (!!draft?.imageFile || !!draft?.imageAssetId);

  const resetKey = [mapId, mapRegionEditor.mapId ?? "", mapRegionEditor.mode.type, selectedRegionId ?? "", draft?.id ?? ""].join(":");

  /* Reset de control de colisiones cuando cambia el contexto */
  useEffect(() => {lastRejectedShapeKeyRef.current = "";}, [resetKey, setPanelError]);

  /* Detecta colisiones entre regiones del mapa */
  const collidingRegions = useMemo(() => {
    if (!isDraftOnActiveMap || isDrawing) return [];
    if (!draftShape) return [];
    if (!isValidRect01(draftShape, { min: DEFAULT_MIN_RECT_01 })) return [];

    return regions.filter((region) => {
      if (region.id === draft?.id) return false;
      if (!isValidRect01(region.shape, { min: DEFAULT_MIN_RECT_01 })) return false;
      return rect01Intersects(draftShape, region.shape);
    });
  }, [isDraftOnActiveMap, isDrawing, draftShape, draft?.id, regions]);

  /* Texto resumen de colisiones */
  const collisionSummary = useMemo(() => {
    if (!collidingRegions.length) return "";

    return collidingRegions.map((region) => region.label?.trim() || "Región sin etiqueta").slice(0, 2).join(", ");
  }, [collidingRegions]);

  /* Si hay colisión, invalida el shape actual y reinicia el dibujo */
  useEffect(() => {
    if (!isDraftOnActiveMap || isDrawing) return;
    if (!isValidRect01(draftShape, { min: DEFAULT_MIN_RECT_01 })) return;
    if (!collisionSummary) return;

    let shapeKey = "";
    try { shapeKey = JSON.stringify(draftShape); }
    catch { shapeKey = String(draftShape ?? ""); }

    if (lastRejectedShapeKeyRef.current === shapeKey) return;
    lastRejectedShapeKeyRef.current = shapeKey;

    clearMapRegionDraftShape();
    startRedrawMapRegionShape();
    setPanelError(`Colisión con: ${collisionSummary}. Dibuja otra región o pulsa “Cancelar”.`);
  }, [isDraftOnActiveMap, isDrawing, draftShape, collisionSummary, clearMapRegionDraftShape, startRedrawMapRegionShape, setPanelError]);

  /* Dibujo de región en canvas */
  const draw = useRegionShapeRectDrawing({
    contentRect: contentRectInContainer,
    enabled: Boolean(isDrawing && imageUrl),
    toContainerPx,
    onCommit: (shape: RegionShape) => {
      setPanelError(null);
      setMapRegionDraftShape(shape);
      finishDrawingMapRegion();
    },
    resetKey,
  });

  const drawingCursorClass = isDrawing ? "cursor-crosshair" : "";

  if (!selectedMap) return null;

  return (
    <div className="rounded-lg border-2 border-amber-700 bg-slate-900/40 p-3 h-full">
      <div className="text-[12px] text-slate-300 text-center mb-3">
        {mapVisualType === "singleImage" ? "Mapa" : "Mapa compuesto"}
      </div>

      <div
        ref={containerRef}
        className={`relative w-full h-[520px] rounded-md overflow-hidden bg-slate-950 border border-slate-700 flex items-center justify-center ${drawingCursorClass}`}
        {...draw.bind}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover blur-md scale-105 opacity-35 z-0"
              draggable={false}
            />

            <div className="relative z-10 w-full h-full flex items-center justify-center overflow-hidden">
              <img
                ref={imgRef}
                src={imageUrl}
                alt={selectedMap.name ?? "Mapa"}
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            </div>

            <div className="absolute inset-0 z-20">
              {mapVisualType === "composed"
                ? regions.map((region) => {
                  if (!region.imageAssetId) return null;

                  const isDraftRegion =
                    showDraftRegionImagePreview &&
                    isDraftOnActiveMap &&
                    draft?.id === region.id;

                  if (isDraftRegion) return null;

                  const style = rectStyleFromShape(region.shape ?? null, contentRectInContainer);
                  if (!style) return null;

                  return (
                    <RegionImageOverlay
                      key={`region-image:${region.id}:${region.imageAssetId}`}
                      assetId={region.imageAssetId}
                      style={style}
                      alt={region.label || "Región"}
                    />
                  );
                })
                : null}

              {showDraftRegionImagePreview ? (
                <DraftRegionImagePreview
                  imageAssetId={draft?.imageAssetId ?? null}
                  imageFile={draft?.imageFile ?? null}
                  shape={draftShape}
                  contentRectInContainer={contentRectInContainer}
                />
              ) : null}

              {regions.map((region) => {
                const style = rectStyleFromShape(region.shape ?? null, contentRectInContainer);
                if (!style) return null;

                const isSelected = region.id === selectedRegionId;
                const width = Number(String(style.width ?? "0").replace("px", "")) || 0;
                const height = Number(String(style.height ?? "0").replace("px", "")) || 0;
                const canShowLabel = !!region.label?.trim() && width >= 60 && height >= 22;

                return (
                  <button
                    key={region.id}
                    type="button"
                    style={style}
                    onClick={() => {
                      setPanelError(null);
                      editMapRegion(region.id);
                    }}
                    className={"absolute rounded-sm transition-colors " +
                      (isSelected
                        ? "border-2 border-amber-300 bg-amber-500/20"
                        : "border-2 border-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20")}
                    title={region.label}
                  >
                    {canShowLabel ? (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="px-2 py-0.5 rounded-md border border-amber-600 bg-slate-950/70 text-slate-100 text-[11px] leading-none truncate max-w-[90%] text-center">
                          {region.label}
                        </div>
                      </div>
                    ) : null}
                  </button>
                );
              })}

              {draw.tempRectStyle ? (
                <div
                  style={draw.tempRectStyle}
                  className="absolute border-2 border-emerald-400/70 bg-emerald-500/10 rounded-sm pointer-events-none"
                />
              ) : null}

              {draftShapeStyle ? (
                <div
                  style={draftShapeStyle}
                  className="absolute border-2 border-emerald-400/70 bg-emerald-500/10 rounded-sm pointer-events-none"
                />
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-slate-400 text-center px-4">
            No se ha podido cargar la imagen del mapa.
          </p>
        )}
      </div>
    </div>
  );
}