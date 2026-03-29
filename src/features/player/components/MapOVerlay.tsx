import { useMemo, useRef, useState, useEffect } from "react";
import type { CSSProperties } from "react";
import type { ID, Project, WorldMap, MapRegion } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";

type MapOverlayProps = {
  gameState: GameState;
  assetUrls: Record<string, string>;
  onClose: () => void;
  onTravel: () => void;
  onSelectRegion: (regionId: ID) => void;
};

type RegionImageOverlayProps = {
  region: MapRegion;
  assetIdToFile: Map<ID, string>;
  assetUrls: Record<string, string>;
  contentRect: { x: number; y: number; w: number; h: number };
};

function buildAssetIdToFile(project: Project): Map<ID, string> {
  const m = new Map<ID, string>();
  for (const a of project.assets ?? []) m.set(a.id, a.file);
  return m;
}

function resolveAssetIdToSrc(
  assetId: ID | undefined,
  assetIdToFile: Map<ID, string>,
  assetUrls: Record<string, string>
) {
  if (!assetId) return undefined;

  const file = assetIdToFile.get(assetId);
  if (!file) return undefined;

  return assetUrls[file] ?? file;
}

function getActiveMap(gameState: GameState): WorldMap | null {
  const activeMapId = gameState.map.activeMapId;
  if (!activeMapId) return null;

  return (gameState.project.maps ?? []).find((map) => map.id === activeMapId) ?? null;
}

function getVisibleRegionIds(gameState: GameState, mapId: ID): ID[] {
  return gameState.map.visibleRegionIdsByMap?.[mapId] ?? [];
}

function getUnlockedRegionIds(gameState: GameState, mapId: ID): ID[] {
  return gameState.map.unlockedRegionIdsByMap?.[mapId] ?? [];
}

function isTravelableRegion(region: MapRegion, visibleRegionIds: ID[], unlockedRegionIds: ID[]): boolean {
  return (
    visibleRegionIds.includes(region.id) &&
    unlockedRegionIds.includes(region.id) &&
    Boolean(region.entrySceneId)
  );
}

function rectStyleFromRegionShape(
  region: MapRegion,
  contentRect: { x: number; y: number; w: number; h: number } | null
): CSSProperties | null {
  const shape = region.shape;
  if (!shape || shape.type !== "rect" || !contentRect) return null;

  return {
    left: `${contentRect.x + shape.x * contentRect.w}px`,
    top: `${contentRect.y + shape.y * contentRect.h}px`,
    width: `${shape.w * contentRect.w}px`,
    height: `${shape.h * contentRect.h}px`,
  };
}

function RegionImageOverlay({
  region,
  assetIdToFile,
  assetUrls,
  contentRect,
}: RegionImageOverlayProps) {
  const imageSrc = resolveAssetIdToSrc(region.imageAssetId, assetIdToFile, assetUrls);
  const style = rectStyleFromRegionShape(region, contentRect);

  if (!imageSrc || !style) return null;

  return (
    <img
      src={imageSrc}
      alt={region.label}
      style={style}
      className="absolute pointer-events-none select-none object-fill"
      draggable={false}
    />
  );
}

export function MapOverlay({
  gameState,
  assetUrls,
  onClose,
  onTravel,
  onSelectRegion,
}: MapOverlayProps) {
  const assetIdToFile = useMemo(
    () => buildAssetIdToFile(gameState.project),
    [gameState.project]
  );

  const activeMap = useMemo(
    () => getActiveMap(gameState),
    [gameState]
  );

  const mapImageSrc = useMemo(() => {
    if (!activeMap) return undefined;

    if (activeMap.visual.type === "singleImage") {
      return resolveAssetIdToSrc(activeMap.visual.imageAssetId, assetIdToFile, assetUrls);
    }

    return resolveAssetIdToSrc(activeMap.visual.backgroundAssetId, assetIdToFile, assetUrls);
  }, [activeMap, assetIdToFile, assetUrls]);

  const visibleRegionIds = useMemo(() => {
    if (!activeMap) return [];
    return getVisibleRegionIds(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const unlockedRegionIds = useMemo(() => {
    if (!activeMap) return [];
    return getUnlockedRegionIds(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const [revealRegions, setRevealRegions] = useState(false);
  const revealTimerRef = useRef<number | null>(null);
  const [hoveredRegionId, setHoveredRegionId] = useState<ID | null>(null);

  const mapCursorIcon = iconForInteractionKind("map");
  const [cursorPos, setCursorPos] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });

  const { containerRef, imgRef, getImageContentRect } = useImageContentRect();
  const [contentRect, setContentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  useEffect(() => {
    const recompute = () => {
      setContentRect(getImageContentRect());
    };

    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [getImageContentRect, mapImageSrc]);

  const triggerRevealRegions = () => {
    setRevealRegions(true);

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
    }

    revealTimerRef.current = window.setTimeout(() => {
      setRevealRegions(false);
      revealTimerRef.current = null;
    }, 2000);
  };

  if (!activeMap) {
    return (
      <div
        className="absolute inset-0 z-40 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900/95 p-6 text-center shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-lg font-semibold text-slate-100">Mapa</div>
          <p className="mt-3 text-sm text-slate-300">
            No hay ningún mapa activo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm"
      onClick={onClose}
      onPointerMove={(e) => setCursorPos({ visible: true, x: e.clientX, y: e.clientY })}
      onPointerEnter={(e) => setCursorPos({ visible: true, x: e.clientX, y: e.clientY })}
      onPointerLeave={() => {
        setCursorPos((prev) => ({ ...prev, visible: false }));
        setHoveredRegionId(null);
      }}
      style={{ cursor: "none" }}
    >
      <div className="h-full w-full flex flex-col">
        <div className="flex-1 min-h-0 flex items-center justify-center p-3">
          <div
            ref={stageRef}
            tabIndex={0}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Tab") {
                e.preventDefault();
                triggerRevealRegions();
                return;
              }

              if (e.key === "Escape") {
                e.preventDefault();
                onClose();
              }
            }}
            className="relative w-full h-full flex items-center justify-center outline-none"
            style={{ cursor: "none" }}
          >
            {mapImageSrc ? (
              <div
                ref={containerRef}
                className="relative w-full h-full flex items-center justify-center"
              >
                <img
                  ref={imgRef}
                  src={mapImageSrc}
                  alt={activeMap.name}
                  className="max-w-full max-h-full object-contain rounded-lg select-none"
                  draggable={false}
                  onLoad={() => setContentRect(getImageContentRect())}
                />

                {contentRect ? (
                  <div className="absolute inset-0">
                    {activeMap.visual.type === "composed"
                      ? (activeMap.regions ?? []).map((region) => {
                          if (!visibleRegionIds.includes(region.id)) return null;
                          if (!region.imageAssetId) return null;

                          return (
                            <RegionImageOverlay
                              key={`region-image:${region.id}:${region.imageAssetId}`}
                              region={region}
                              assetIdToFile={assetIdToFile}
                              assetUrls={assetUrls}
                              contentRect={contentRect}
                            />
                          );
                        })
                      : null}

                    {(activeMap.regions ?? []).map((region) => {
                      const style = rectStyleFromRegionShape(region, contentRect);
                      if (!style) return null;

                      const isTravelable = isTravelableRegion(region, visibleRegionIds, unlockedRegionIds);
                      if (!isTravelable) return null;

                      const isHovered = hoveredRegionId === region.id;

                      return (
                        <button
                          key={region.id}
                          type="button"
                          style={{
                            ...style,
                            cursor: "none",
                          }}
                          onMouseEnter={() => setHoveredRegionId(region.id)}
                          onMouseMove={() => {
                            if (hoveredRegionId !== region.id) setHoveredRegionId(region.id);
                          }}
                          onMouseLeave={() => {
                            setHoveredRegionId((curr) => (curr === region.id ? null : curr));
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRegion(region.id);
                            onTravel();
                          }}
                          className={[
                            "absolute rounded-sm transition-colors focus:outline-none cursor-none",
                            revealRegions
                              ? "border-2 border-emerald-400/80 bg-emerald-500/15 hover:bg-emerald-500/25"
                              : "border border-transparent bg-transparent hover:bg-emerald-500/10",
                          ].join(" ")}
                          title={region.label}
                        >
                          {isHovered ? (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <div className="max-w-[90%] truncate rounded-md border border-slate-700 bg-slate-950/85 px-2 py-0.5 text-[11px] text-slate-100">
                                {region.label}
                              </div>
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="text-sm text-slate-400 text-center px-6">
                Este mapa todavía no tiene imagen visual compatible.
              </div>
            )}
          </div>
        </div>
      </div>

      {cursorPos.visible ? (
        <img
          src={mapCursorIcon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none fixed z-60 h-16 w-16 object-contain select-none"
          style={{
            left: cursorPos.x - 32,
            top: cursorPos.y - 32,
          }}
        />
      ) : null}
    </div>
  );
}