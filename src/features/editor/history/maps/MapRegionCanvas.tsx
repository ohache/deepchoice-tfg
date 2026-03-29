import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import type { ID, MapRegion, RegionShape } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { useResolvedAssetUrl } from "@/features/editor/hooks/useResolvedAssetUrl";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import type { Rect } from "@/features/editor/hooks/useObjectContainRect";
import { useRegionShapeRectDrawing } from "@/features/editor/hooks/useRegionShapeRectDrawing";
import { rectStyleFromShape, isValidRect01, rect01Intersects } from "@/features/editor/hooks/regionShape";

type MapRegionCanvasProps = {
  mapId: ID;
  mapVisualType: "singleImage" | "composed";
  setPanelError: React.Dispatch<React.SetStateAction<string | null>>;
};

type RegionImageOverlayProps = {
  assetId: ID;
  style: CSSProperties;
  alt: string;
};

type DraftRegionImagePreviewProps = {
  assetId: ID | null;
  shape: RegionShape | null;
  contentRectInContainer: Rect | null;
};

function RegionImageOverlay({ assetId, style, alt }: RegionImageOverlayProps) {
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

function DraftRegionImagePreview({
  assetId,
  shape,
  contentRectInContainer,
}: DraftRegionImagePreviewProps) {
  const imageUrl = useResolvedAssetUrl(assetId);
  const st = rectStyleFromShape(shape ?? null, contentRectInContainer);

  if (!imageUrl || !st) return null;

  return (
    <img
      src={imageUrl}
      alt="Preview de región"
      style={st}
      className="absolute pointer-events-none select-none object-fill"
      draggable={false}
    />
  );
}

function shapeKey(shape: unknown): string {
  try {
    return JSON.stringify(shape ?? null);
  } catch {
    return String(shape ?? "");
  }
}

export function MapRegionCanvas({ mapId, mapVisualType, setPanelError }: MapRegionCanvasProps) {
  const project = useEditorStore((s) => s.project);
  const selectedMapId = useEditorStore((s) => s.selectedMapId);

  const mapRegionEditor = useEditorStore((s) => s.mapRegionEditor);
  const setMapRegionSelection = useEditorStore((s) => s.setMapRegionSelection);
  const editMapRegion = useEditorStore((s) => s.editMapRegion);
  const setMapRegionDraftShape = useEditorStore((s) => s.setMapRegionDraftShape);
  const clearMapRegionDraftShape = useEditorStore((s) => s.clearMapRegionDraftShape);
  const finishDrawingMapRegion = useEditorStore((s) => s.finishDrawingMapRegion);
  const startRedrawMapRegionShape = useEditorStore((s) => s.startRedrawMapRegionShape);

  const selectedMap = useMemo(
    () => (project?.maps ?? []).find((m) => m.id === mapId) ?? null,
    [project, mapId]
  );

  const effectiveAssetId: ID | null = useMemo(() => {
    if (!selectedMap) return null;

    return selectedMap.visual.type === "singleImage"
      ? selectedMap.visual.imageAssetId
      : selectedMap.visual.backgroundAssetId;
  }, [selectedMap]);

  const imageUrl = useResolvedAssetUrl(effectiveAssetId);

  const regions = useMemo<MapRegion[]>(() => {
    if (!selectedMap) return [];
    return selectedMap.regions ?? [];
  }, [selectedMap]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const lastRejectedShapeKeyRef = useRef<string>("");

  const { contentRectInContainer, toContainerPx } = useObjectContainRect({ containerRef, imgRef });

  const isDraftOnActiveMap =
    mapRegionEditor.context?.mapId != null &&
    selectedMapId != null &&
    String(mapRegionEditor.context.mapId) === String(selectedMapId) &&
    String(selectedMapId) === String(mapId);

  const isDrawing = mapRegionEditor.mode.type === "drawing" && isDraftOnActiveMap;

  const draftShapeStyle = rectStyleFromShape(
    isDraftOnActiveMap ? (mapRegionEditor.draft?.shape ?? null) : null,
    contentRectInContainer
  );

  const resetKey = [
    selectedMapId ?? "",
    mapId,
    mapRegionEditor.mode.type,
    mapRegionEditor.selection.regionId ?? "",
    mapRegionEditor.draft?.id ?? "",
  ].join(":");

  useEffect(() => {
    lastRejectedShapeKeyRef.current = "";
  }, [resetKey, setPanelError]);

  const collisionSummary = useMemo(() => {
    if (!isDraftOnActiveMap || isDrawing) return "";

    const draftShape = mapRegionEditor.draft?.shape;
    const draftId = mapRegionEditor.draft?.id;

    if (!isValidRect01(draftShape, { min: 0.02 })) return "";

    const collisions = regions.filter((region) => {
      if (region.id === draftId) return false;
      if (!draftShape || !isValidRect01(draftShape, { min: 0.02 })) return false;
      if (!isValidRect01(region.shape, { min: 0.02 })) return false;
      return rect01Intersects(draftShape, region.shape);
    });

    if (!collisions.length) return "";

    return collisions
      .map((region) => region.label?.trim() || "Región sin etiqueta")
      .slice(0, 2)
      .join(", ");
  }, [isDraftOnActiveMap, isDrawing, mapRegionEditor.draft?.shape, mapRegionEditor.draft?.id, regions]);

  useEffect(() => {
    if (!isDraftOnActiveMap || isDrawing) return;

    const draftShape = mapRegionEditor.draft?.shape;
    if (!isValidRect01(draftShape, { min: 0.02 })) return;
    if (!collisionSummary) return;

    const key = shapeKey(draftShape);
    if (lastRejectedShapeKeyRef.current === key) return;
    lastRejectedShapeKeyRef.current = key;

    clearMapRegionDraftShape();
    startRedrawMapRegionShape();
    setPanelError(`Colisión con: ${collisionSummary}. Dibuja otra región o pulsa “Cancelar”.`);
  }, [
    isDraftOnActiveMap,
    isDrawing,
    mapRegionEditor.draft?.shape,
    collisionSummary,
    clearMapRegionDraftShape,
    startRedrawMapRegionShape,
    setPanelError,
  ]);

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

  const handleSelectRegion = (regionId: ID) => {
    setMapRegionSelection({ regionId });
    editMapRegion(regionId);
  };

  const drawingCursorClass = isDrawing ? "cursor-crosshair" : "";

  return (
    <div className="rounded-lg border-2 border-slate-700 bg-slate-900/40 p-3 h-full">
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
                alt={selectedMap?.name ?? "Mapa"}
                className="w-full h-full object-contain select-none"
                draggable={false}
              />
            </div>

            <div className="absolute inset-0 z-20">
              {mapVisualType === "composed"
                ? regions.map((region) => {
                    if (!region.imageAssetId) return null;

                    const st = rectStyleFromShape(region.shape ?? null, contentRectInContainer);
                    if (!st) return null;

                    return (
                      <RegionImageOverlay
                        key={`region-image:${region.id}:${region.imageAssetId}`}
                        assetId={region.imageAssetId}
                        style={st}
                        alt={region.label || "Región"}
                      />
                    );
                  })
                : null}

              {mapVisualType === "composed" && isDraftOnActiveMap && mapRegionEditor.draft?.imageAssetId ? (
                <DraftRegionImagePreview
                  assetId={mapRegionEditor.draft.imageAssetId}
                  shape={mapRegionEditor.draft.shape ?? null}
                  contentRectInContainer={contentRectInContainer}
                />
              ) : null}

              {regions.map((region) => {
                const st = rectStyleFromShape(region.shape ?? null, contentRectInContainer);
                if (!st) return null;

                const isSelected = region.id === mapRegionEditor.selection.regionId;
                const w = Number(String((st as CSSProperties).width ?? "0").replace("px", "")) || 0;
                const h = Number(String((st as CSSProperties).height ?? "0").replace("px", "")) || 0;
                const canShowLabel = !!region.label?.trim() && w >= 60 && h >= 22;

                return (
                  <button
                    key={region.id}
                    type="button"
                    style={st}
                    onClick={() => handleSelectRegion(region.id)}
                    className={[
                      "absolute rounded-sm transition-colors",
                      isSelected
                        ? "border-2 border-amber-300 bg-amber-500/20"
                        : "border-2 border-amber-500/70 bg-amber-500/10 hover:bg-amber-500/20",
                    ].join(" ")}
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