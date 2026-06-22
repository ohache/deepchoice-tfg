import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { CSSProperties } from "react";
import type { ID, MapRegion, WorldMap } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { iconForInteractionKind } from "@/features/player/components/interactionCursors";
import { PLAYER_CURSOR_DEFAULT_SIZE, type CursorSize } from "@/features/player/hooks/usePlayerCursor";
import { buildAssetIdToFile, resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";

type MapOverlayProps = {
  gameState: GameState;
  assetUrls: Record<string, string>;
  onClose: () => void;
  onTravelToRegion: (regionId: ID) => void;
};

type ContentRect = { x: number; y: number; w: number; h: number };

type CursorPosition = { visible: boolean; x: number; y: number };

const REVEAL_REGIONS_MS = 2000;

const INITIAL_CURSOR_POSITION: CursorPosition = { visible: false, x: 0, y: 0 };

function getActiveMap(gameState: GameState): WorldMap | null {
  const activeMapId = gameState.map.activeMapId;
  if (!activeMapId) return null;

  return gameState.project.maps.find((map) => map.id === activeMapId) ?? null;
}

function getVisibleRegionIdSet(gameState: GameState, mapId: ID): Set<ID> {
  return new Set(gameState.map.visibleRegionIdsByMap?.[mapId] ?? []);
}

function getUnlockedRegionIdSet(gameState: GameState, mapId: ID): Set<ID> {
  return new Set(gameState.map.unlockedRegionIdsByMap?.[mapId] ?? []);
}

function isTravelableRegion(region: MapRegion, visibleRegionIds: Set<ID>, unlockedRegionIds: Set<ID>): boolean {
  return visibleRegionIds.has(region.id) && unlockedRegionIds.has(region.id) && Boolean(region.entrySceneId);
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

function areCursorPositionsEqual(a: CursorPosition, b: CursorPosition): boolean {
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

function RegionImageOverlay(props: { region: MapRegion; assetIdToFile: Map<ID, string>; assetUrls: Record<string, string>; contentRect: ContentRect }) {
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

function MapRegionButton(props: { region: MapRegion; contentRect: ContentRect; revealRegions: boolean; onHover: (regionId: ID) => void;
  onClearHover: (regionId: ID) => void; onTravelToRegion: (regionId: ID) => void}) {
  const { region, contentRect, revealRegions, onHover, onClearHover, onTravelToRegion } = props;

  const style = rectStyleFromRegionShape(region, contentRect);
  if (!style) return null;

  return (
    <button
      key={region.id}
      type="button"
      aria-label={`Viajar a ${region.label}`}
      style={{ ...style, cursor: "none" }}
      onMouseEnter={() => onHover(region.id)}
      onMouseMove={() => onHover(region.id)}
      onMouseLeave={() => onClearHover(region.id)}
      onClick={(event) => {
        event.stopPropagation();
        onTravelToRegion(region.id);
      }}
      className={`absolute rounded-sm transition-colors focus:outline-none ${
        revealRegions ? "border-2 border-emerald-400/80 bg-emerald-500/15 hover:bg-emerald-500/25" : "border border-transparent bg-transparent hover:bg-emerald-500/10"
      }`}
    />
  );
}

function HoveredRegionLabel(props: { region: MapRegion | null; contentRect: ContentRect | null }) {
  const { region, contentRect } = props;

  if (!region || !contentRect) return null;

  const style = labelStyleFromRegionShape(region, contentRect);
  if (!style) return null;

  return (
    <div
      className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full pb-2"
      style={style}
    >
      <div className="max-w-[280px] whitespace-normal rounded-md border border-slate-700 bg-slate-950/95 px-3 py-1.5 text-center text-xs font-medium leading-snug text-slate-100 shadow-xl">
        {region.label}
      </div>
    </div>
  );
}

function MapCursor(props: { visible: boolean; src: string; position: CursorPosition; size: CursorSize }) {
  const { visible, src, position, size } = props;

  if (!visible) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none fixed z-60 select-none object-contain"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        transform: "translate(-50%, -50%)",
      }}
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

export function MapOverlay({ gameState, assetUrls, onClose, onTravelToRegion }: MapOverlayProps) {
  const assetIdToFile = useMemo(() => buildAssetIdToFile(gameState.project), [gameState.project]);

  const activeMap = useMemo(() => getActiveMap(gameState), [gameState]);

  const mapImageSrc = useMemo(
    () => resolveMapImageSrc(activeMap, assetIdToFile, assetUrls),
    [activeMap, assetIdToFile, assetUrls],
  );

  const visibleRegionIds = useMemo(() => {
    if (!activeMap) return new Set<ID>();

    return getVisibleRegionIdSet(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const unlockedRegionIds = useMemo(() => {
    if (!activeMap) return new Set<ID>();

    return getUnlockedRegionIdSet(gameState, activeMap.id);
  }, [gameState, activeMap]);

  const visibleRegions = useMemo(() => {
    if (!activeMap) return [];

    return activeMap.regions.filter((region) => visibleRegionIds.has(region.id));
  }, [activeMap, visibleRegionIds]);

  const travelableRegions = useMemo(() => {
    if (!activeMap) return [];

    return activeMap.regions.filter((region) => isTravelableRegion(region, visibleRegionIds, unlockedRegionIds));
  }, [activeMap, visibleRegionIds, unlockedRegionIds]);

  const [revealRegions, setRevealRegions] = useState(false);
  const [hoveredRegionId, setHoveredRegionId] = useState<ID | null>(null);
  const [cursorPos, setCursorPos] = useState<CursorPosition>(INITIAL_CURSOR_POSITION);

  const revealTimerRef = useRef<number | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const cursorPosRef = useRef<CursorPosition>(INITIAL_CURSOR_POSITION);
  const pendingCursorPosRef = useRef<CursorPosition | null>(null);
  const cursorFrameRef = useRef<number | null>(null);

  const { containerRef, imgRef, contentRect, refreshImageContentRect } = useImageContentRect();

  const mapCursorIcon = iconForInteractionKind("map");

  const hoveredRegion = useMemo(() => {
    if (!activeMap || !hoveredRegionId) return null;

    return activeMap.regions.find((region) => region.id === hoveredRegionId) ?? null;
  }, [activeMap, hoveredRegionId]);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const triggerRevealRegions = useCallback(() => {
    setRevealRegions(true);

    clearRevealTimer();

    revealTimerRef.current = window.setTimeout(() => {
      setRevealRegions(false);
      revealTimerRef.current = null;
    }, REVEAL_REGIONS_MS);
  }, [clearRevealTimer]);

  const applyCursorPosition = useCallback((next: CursorPosition) => {
    if (areCursorPositionsEqual(cursorPosRef.current, next)) return;

    cursorPosRef.current = next;
    setCursorPos(next);
  }, []);

  const scheduleCursorPosition = useCallback(
    (next: CursorPosition) => {
      pendingCursorPosRef.current = next;

      if (cursorFrameRef.current !== null) return;

      cursorFrameRef.current = window.requestAnimationFrame(() => {
        cursorFrameRef.current = null;

        const pending = pendingCursorPosRef.current;
        pendingCursorPosRef.current = null;

        if (pending) applyCursorPosition(pending);
      });
    },
    [applyCursorPosition],
  );

  const hideCursor = useCallback(() => {
    pendingCursorPosRef.current = null;

    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }

    applyCursorPosition({ ...cursorPosRef.current, visible: false });
  }, [applyCursorPosition]);

  const handleHoverRegion = useCallback((regionId: ID) => {
    setHoveredRegionId((current) => (current === regionId ? current : regionId));
  }, []);

  const handleClearHoveredRegion = useCallback((regionId: ID) => {
    setHoveredRegionId((current) => (current === regionId ? null : current));
  }, []);

  const handleStageKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Tab") {
        event.preventDefault();
        triggerRevealRegions();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [triggerRevealRegions, onClose],
  );

  useEffect(() => {
    stageRef.current?.focus();
  }, [activeMap?.id]);

  useEffect(() => {
    setRevealRegions(false);
    setHoveredRegionId(null);
    clearRevealTimer();
  }, [activeMap?.id, clearRevealTimer]);

  useEffect(() => {
    return () => {
      clearRevealTimer();

      if (cursorFrameRef.current !== null) {
        window.cancelAnimationFrame(cursorFrameRef.current);
        cursorFrameRef.current = null;
      }
    };
  }, [clearRevealTimer]);

  if (!activeMap) return <EmptyMapOverlay onClose={onClose} />;

  return (
    <div
      className="absolute inset-0 z-40 bg-slate-950/85 backdrop-blur-sm"
      onClick={onClose}
      onPointerMove={(event) => { scheduleCursorPosition({ visible: true, x: event.clientX, y: event.clientY }) }}
      onPointerEnter={(event) => { applyCursorPosition({ visible: true, x: event.clientX, y: event.clientY }) }}
      onPointerLeave={() => {
        hideCursor();
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
            onKeyDown={handleStageKeyDown}
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
                  onLoad={refreshImageContentRect}
                />

                {contentRect ? (
                  <div className="absolute inset-0">
                    {activeMap.visual.type === "composed"
                      ? visibleRegions.map((region) => {
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

                    {travelableRegions.map((region) => (
                      <MapRegionButton
                        key={region.id}
                        region={region}
                        contentRect={contentRect}
                        revealRegions={revealRegions}
                        onHover={handleHoverRegion}
                        onClearHover={handleClearHoveredRegion}
                        onTravelToRegion={onTravelToRegion}
                      />
                    ))}

                    <HoveredRegionLabel region={hoveredRegion} contentRect={contentRect} />
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

      <MapCursor
        visible={cursorPos.visible}
        src={mapCursorIcon}
        position={cursorPos}
        size={PLAYER_CURSOR_DEFAULT_SIZE}
      />
    </div>
  );
}