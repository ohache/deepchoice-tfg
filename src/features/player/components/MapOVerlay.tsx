import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ID, MapRegion, WorldMap } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";
import { buildAssetIdToFile, resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

type MapOverlayProps = {
  gameState: GameState;
  assetUrls: Record<string, string>;
  onClose: () => void;
  onTravel: () => void;
  onSelectRegion: (regionId: ID) => void;
};

type ContentRect = { x: number; y: number; w: number; h: number };

const REVEAL_REGIONS_MS = 2000;

function getActiveMap(gameState: GameState): WorldMap | null {
  const activeMapId = gameState.map.activeMapId;
  if (!activeMapId) return null;

  return gameState.project.maps.find((map) => map.id === activeMapId) ?? null;
}

function getVisibleRegionIds(gameState: GameState, mapId: ID): ID[] {
  return gameState.map.visibleRegionIdsByMap?.[mapId] ?? [];
}

function getUnlockedRegionIds(gameState: GameState, mapId: ID): ID[] {
  return gameState.map.unlockedRegionIdsByMap?.[mapId] ?? [];
}

function isTravelableRegion(region: MapRegion, visibleRegionIds: ID[], unlockedRegionIds: ID[]): boolean {
  return (visibleRegionIds.includes(region.id) && unlockedRegionIds.includes(region.id) && Boolean(region.entrySceneId));
}

function rectStyleFromRegionShape(region: MapRegion, contentRect: ContentRect | null): CSSProperties | null {
  const shape = region.shape;
  if (!shape || shape.type !== "rect" || !contentRect) return null;

  return {
    left: `${contentRect.x + shape.x * contentRect.w}px`,
    top: `${contentRect.y + shape.y * contentRect.h}px`,
    width: `${shape.w * contentRect.w}px`,
    height: `${shape.h * contentRect.h}px`,
  };
}

function labelStyleFromRegionShape(region: MapRegion, contentRect: ContentRect): CSSProperties | null {
  const shape = region.shape;
  if (!shape || shape.type !== "rect") return null;

  return {
    left: `${contentRect.x + (shape.x + shape.w / 2) * contentRect.w}px`,
    top: `${contentRect.y + shape.y * contentRect.h}px`,
  };
}

function resolveMapImageSrc(map: WorldMap | null, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>): string | undefined {
  if (!map) return undefined;

  if (map.visual.type === "singleImage") return resolveAssetIdToSrc(map.visual.imageAssetId, assetIdToFile, assetUrls);

  return resolveAssetIdToSrc(map.visual.backgroundAssetId, assetIdToFile, assetUrls);
}

function RegionImageOverlay(props: {
  region: MapRegion;
  assetIdToFile: Map<ID, string>;
  assetUrls: Record<string, string>;
  contentRect: ContentRect;
}) {
  const { region, assetIdToFile, assetUrls, contentRect } = props;

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

function EmptyMapOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900/95 p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="text-lg font-semibold text-slate-100">Mapa</div>
        <p className="mt-3 text-sm text-slate-300">No hay ningún mapa activo.</p>
      </div>
    </div>
  );
}

export function MapOverlay({ gameState, assetUrls, onClose, onTravel, onSelectRegion }: MapOverlayProps) {
  const assetIdToFile = useMemo(() => buildAssetIdToFile(gameState.project), [gameState.project]);

  const activeMap = useMemo(() => getActiveMap(gameState), [gameState]);

  const mapImageSrc = useMemo(() => resolveMapImageSrc(activeMap, assetIdToFile, assetUrls), [activeMap, assetIdToFile, assetUrls]);

  const visibleRegionIds = useMemo(() => {
    if (!activeMap) return [];
    return getVisibleRegionIds(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const unlockedRegionIds = useMemo(() => {
    if (!activeMap) return [];
    return getUnlockedRegionIds(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const [revealRegions, setRevealRegions] = useState(false);
  const [hoveredRegionId, setHoveredRegionId] = useState<ID | null>(null);
  const [cursorPos, setCursorPos] = useState({ visible: false, x: 0, y: 0 });
  const [contentRect, setContentRect] = useState<ContentRect | null>(null);

  const revealTimerRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const { containerRef, imgRef, getImageContentRect } = useImageContentRect();

  const mapCursorIcon = iconForInteractionKind("map");

  const hoveredRegion = useMemo(() => {
    if (!activeMap || !hoveredRegionId) return null;

    return activeMap.regions.find((region) => region.id === hoveredRegionId) ?? null;
  }, [activeMap, hoveredRegionId]);

  useEffect(() => stageRef.current?.focus(), []);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const recompute = () => setContentRect(getImageContentRect());

    recompute();
    window.addEventListener("resize", recompute);

    return () => window.removeEventListener("resize", recompute);
  }, [getImageContentRect, mapImageSrc]);

  function triggerRevealRegions() {
    setRevealRegions(true);

    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);

    revealTimerRef.current = window.setTimeout(() => {
      setRevealRegions(false);
      revealTimerRef.current = null;
    }, REVEAL_REGIONS_MS);
  }

  if (!activeMap) return <EmptyMapOverlay onClose={onClose} />;

  return (
    <div
      className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm"
      onClick={onClose}
      onPointerMove={(event) => setCursorPos({ visible: true, x: event.clientX, y: event.clientY })}
      onPointerEnter={(event) => setCursorPos({ visible: true, x: event.clientX, y: event.clientY })}
      onPointerLeave={() => {
        setCursorPos((prev) => ({ ...prev, visible: false }));
        setHoveredRegionId(null);
      }}
      style={{ cursor: "none" }}
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex min-h-0 flex-1 items-center justify-center p-3">
          <div
            ref={stageRef}
            tabIndex={0}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Tab") {
                event.preventDefault();
                triggerRevealRegions();
                return;
              }

              if (event.key === "Escape") {
                event.preventDefault();
                onClose();
              }
            }}
            className="relative flex h-full w-full items-center justify-center outline-none"
            style={{ cursor: "none" }}
          >
            {mapImageSrc ? (
              <div
                ref={containerRef}
                className="relative flex h-full w-full items-center justify-center"
              >
                <img
                  ref={imgRef}
                  src={mapImageSrc}
                  alt={activeMap.name}
                  className="max-h-full max-w-full select-none rounded-lg object-contain"
                  draggable={false}
                  onLoad={() => setContentRect(getImageContentRect())}
                />

                {contentRect ? (
                  <div className="absolute inset-0">
                    {activeMap.visual.type === "composed"
                      ? activeMap.regions.map((region) => {
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

                    {activeMap.regions.map((region) => {
                      const style = rectStyleFromRegionShape(region, contentRect);
                      if (!style) return null;

                      const isTravelable = isTravelableRegion(
                        region,
                        visibleRegionIds,
                        unlockedRegionIds
                      );

                      if (!isTravelable) return null;

                      return (
                        <button
                          key={region.id}
                          type="button"
                          style={{ ...style, cursor: "none" }}
                          onMouseEnter={() => setHoveredRegionId(region.id)}
                          onMouseMove={() => setHoveredRegionId(region.id)}
                          onMouseLeave={() => setHoveredRegionId((current) => current === region.id ? null : current)}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectRegion(region.id);
                            onTravel();
                          }}
                          className={[
                            "absolute rounded-sm transition-colors focus:outline-none cursor-none",
                            revealRegions
                              ? "border-2 border-emerald-400/80 bg-emerald-500/15 hover:bg-emerald-500/25"
                              : "border border-transparent bg-transparent hover:bg-emerald-500/10",
                          ].join(" ")}
                        >
                        </button>
                      );
                    })}
                    {hoveredRegion && contentRect ? (
                      <div
                        className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full pb-2"
                        style={labelStyleFromRegionShape(hoveredRegion, contentRect) ?? undefined}
                      >
                        <div className="max-w-[280px] whitespace-normal rounded-md border border-slate-700 bg-slate-950/95 px-3 py-1.5 text-center text-xs font-medium leading-snug text-slate-100 shadow-xl">
                          {hoveredRegion.label}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="px-6 text-center text-sm text-slate-400">
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
          className="pointer-events-none fixed z-60 h-16 w-16 select-none object-contain"
          style={{
            left: cursorPos.x - 32,
            top: cursorPos.y - 32,
          }}
        />
      ) : null}
    </div>
  );
}