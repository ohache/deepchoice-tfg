import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, Hotspot, PlaceableState, PlacedItem, PlacedNpc, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { DialogueSpeechBubble } from "@/features/player/components/DialogueSpeechBubble";
import { HotspotLayer } from "@/features/player/components/interactive/HotspotLayer";
import { PlacedItemLayer } from "@/features/player/components/interactive/PlacedItemLayer";
import { PlacedNpcLayer } from "@/features/player/components/interactive/PlacedNpcLayer";
import { PlacedPlayerLayer } from "@/features/player/components/interactive/PlacedPlayerLayer";

type ContentRect = { x: number; y: number; w: number; h: number };

const REVEAL_MS = 2000;

function isVisible(runtime?: { visible: boolean }): boolean {
  return runtime?.visible ?? true;
}

export function SceneStage(props: {
  revealSignal?: number;
  keyboardBlocked?: boolean;
  gameEnded?: boolean;
  imageSrc?: string;
  hotspots?: Array<{ hotspot: Hotspot; runtime?: PlaceableState }>;
  placedItems?: Array<{ placedItem: PlacedItem; runtime?: PlaceableState; imageSrc?: string }>;
  placedPlayers?: Array<{ placedPlayer: PlacedPlayer; runtime?: PlacedPlayerState; imageSrc?: string }>;
  placedNpcs?: Array<{ placedNpc: PlacedNpc; runtime?: PlaceableState; imageSrc?: string }>;

  dialogueText?: string;
  dialogueSpeaker?: "player" | "npc" | null;
  dialogueSpeakerId?: ID | null;

  isUsingItem?: boolean;
  onHotspotUseItem?: (hotspot: Hotspot) => void;
  onPlacedItemUseItem?: (placedItem: PlacedItem) => void;
  onPlacedNpcUseItem?: (placedNpc: PlacedNpc) => void;
  onSceneBackgroundClick?: () => void;

  onContentRectChange?: (rect: ContentRect | null) => void;

  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorLeave?: () => void;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onPlacedItemClick?: (placedItem: PlacedItem) => void;
  onPlacedNpcClick?: (placedNpc: PlacedNpc) => void;
  onNotReachable?: (hotspot: Hotspot, text: string) => void;
  onPlacedItemNotReachable?: (placedItem: PlacedItem, text: string) => void;
  onPlacedNpcNotReachable?: (placedNpc: PlacedNpc, text: string) => void;

  cursorBlocked?: boolean;
}) {
  const { keyboardBlocked,   gameEnded = false, imageSrc, hotspots = [], placedItems = [], placedPlayers = [], placedNpcs = [], dialogueText, dialogueSpeaker, isUsingItem, onHotspotUseItem, onPlacedItemUseItem,
    onPlacedNpcUseItem, onSceneBackgroundClick, onContentRectChange, onCursorMove, onCursorEnter, onCursorLeave, onHotspotClick, onPlacedItemClick, onPlacedNpcClick, onNotReachable,
    onPlacedItemNotReachable, onPlacedNpcNotReachable, cursorBlocked, revealSignal, dialogueSpeakerId } = props;

  const { containerRef, imgRef, getImageContentRect } = useImageContentRect();

  const stageRef = useRef<HTMLDivElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const [contentRect, setContentRect] = useState<ContentRect | null>(null);
  const [revealHotspots, setRevealHotspots] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredPlacedItemId, setHoveredPlacedItemId] = useState<string | null>(null);
  const [hoveredPlacedNpcId, setHoveredPlacedNpcId] = useState<string | null>(null);

  function rectPx(shape: RegionShape, content: { w: number; h: number }) {
  if (shape.type !== "rect") return null;

  return {
    left: shape.x * content.w,
    top: shape.y * content.h,
    width: shape.w * content.w,
    height: shape.h * content.h,
  };
}

  useEffect(() => {
    stageRef.current?.focus();

    setRevealHotspots(false);
    setHoveredHotspotId(null);
    setHoveredPlacedItemId(null);
    setHoveredPlacedNpcId(null);

    onCursorLeave?.();

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, [imageSrc, onCursorLeave]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!imageSrc) {
      setContentRect(null);
      return;
    }

    const recompute = () => setContentRect(getImageContentRect());

    recompute();
    window.addEventListener("resize", recompute);

    return () => window.removeEventListener("resize", recompute);
  }, [imageSrc, getImageContentRect]);

  useEffect(() => {
    onContentRectChange?.(contentRect);
  }, [contentRect, onContentRectChange]);

  const visibleHotspots = useMemo(() => hotspots.filter(({ runtime }) => isVisible(runtime)), [hotspots]);

  const visiblePlacedItems = useMemo(() => placedItems.filter(({ runtime }) => isVisible(runtime)), [placedItems]);

  const visiblePlacedPlayers = useMemo(() => placedPlayers.filter(({ runtime }) => isVisible(runtime)), [placedPlayers]);

  const visiblePlacedNpcs = useMemo(() => placedNpcs.filter(({ runtime }) => isVisible(runtime)), [placedNpcs]);

const speakingPlayer = useMemo(() => {
  if (dialogueSpeaker !== "player") return null;

  if (dialogueSpeakerId) {
    return visiblePlacedPlayers.find(
      ({ placedPlayer }) => placedPlayer.playerId === dialogueSpeakerId,
    ) ?? null;
  }

  return visiblePlacedPlayers[0] ?? null;
}, [dialogueSpeaker, dialogueSpeakerId, visiblePlacedPlayers]);

const speakingNpc = useMemo(() => {
  if (dialogueSpeaker !== "npc") return null;

  if (dialogueSpeakerId) {
    return visiblePlacedNpcs.find(
      ({ placedNpc }) => placedNpc.npcId === dialogueSpeakerId,
    ) ?? null;
  }

  return visiblePlacedNpcs[0] ?? null;
}, [dialogueSpeaker, dialogueSpeakerId, visiblePlacedNpcs]);

  const dialogueTargetRect = useMemo(() => {
    if (!contentRect || !dialogueText || !dialogueSpeaker) return null;

    if (dialogueSpeaker === "player" && speakingPlayer) {
      return rectPx(speakingPlayer.placedPlayer.shape, contentRect);
    }

    if (dialogueSpeaker === "npc" && speakingNpc) {
      return rectPx(speakingNpc.placedNpc.shape, contentRect);
    }

    return null;
  }, [contentRect, dialogueText, dialogueSpeaker, speakingPlayer, speakingNpc]);

  const hasOverlayContent =
    !!contentRect &&
    (visibleHotspots.length > 0 ||
      visiblePlacedItems.length > 0 ||
      visiblePlacedPlayers.length > 0 ||
      visiblePlacedNpcs.length > 0 ||
      !!dialogueTargetRect);

function triggerReveal() {
  if (gameEnded) return;
  if (isUsingItem) return;

  setRevealHotspots(true);

  if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);

  revealTimerRef.current = window.setTimeout(() => {
    setRevealHotspots(false);
    revealTimerRef.current = null;
  }, REVEAL_MS);
}
  useEffect(() => {
    if (!revealSignal) return;
    if (keyboardBlocked) return;

    triggerReveal();
  }, [revealSignal, keyboardBlocked]);

  useEffect(() => {
  if (!isUsingItem) return;

  setRevealHotspots(false);
}, [isUsingItem]);

  function clearHoveredExcept(kind: "hotspot" | "item" | "npc") {
    if (kind !== "hotspot") setHoveredHotspotId(null);
    if (kind !== "item") setHoveredPlacedItemId(null);
    if (kind !== "npc") setHoveredPlacedNpcId(null);
  }

  function handleStageKeyDown(e: React.KeyboardEvent) {
    if (gameEnded) return;
    if (keyboardBlocked) return;
    if (e.key !== "Tab") return;

    e.preventDefault();
    triggerReveal();
  }

  function handleStageMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    stageRef.current?.focus();

    if (gameEnded) return;
    if (!isUsingItem) return;

    const target = e.target as HTMLElement;

    const clickedStageBackground = target === e.currentTarget || target === containerRef.current || target === imgRef.current;

    const clickedInteractionButton = target.closest("button[aria-label]");

    if (clickedStageBackground || !clickedInteractionButton) onSceneBackgroundClick?.();
  }

  return (
    <div className="relative h-full bg-black">
      <style>{`@keyframes hotspotPulse {
        0%   { transform: scale(0.985); opacity: 0.7; }
        50%  { transform: scale(1.035); opacity: 1; }
        100% { transform: scale(0.985); opacity: 0.7; }
      }`}</style>

      {imageSrc ? (
        <>


          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Escena"
            onKeyDown={handleStageKeyDown}
            onMouseDown={handleStageMouseDown}
            onMouseMove={(e) => {
              if (cursorBlocked) return;
              onCursorMove?.(e, "idle");
            }}
            onMouseEnter={(e) => {
              if (cursorBlocked) return;
              onCursorEnter?.(e, "idle");
            }}
            onMouseLeave={() => {
              onCursorLeave?.();
            }}
            className="relative z-10 flex h-full w-full items-center justify-center bg-black outline-none"
            style={{ cursor: cursorBlocked ? "auto" : "none" }}
          >
            <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
                onLoad={() => setContentRect(getImageContentRect())}
              />

              {hasOverlayContent && contentRect ? (
                <div
                  className="absolute z-20"
                  style={{
                    left: contentRect.x,
                    top: contentRect.y,
                    width: contentRect.w,
                    height: contentRect.h,
                  }}
                >
                  <PlacedPlayerLayer
                    contentSize={contentRect}
                    placedPlayers={visiblePlacedPlayers}
                  />

                  <PlacedItemLayer
                    cursorBlocked={cursorBlocked || gameEnded}
                    contentSize={contentRect}
                    placedItems={visiblePlacedItems}
                    revealHotspots={!gameEnded && !isUsingItem && revealHotspots}
                    hoveredPlacedItemId={hoveredPlacedItemId}
                    isUsingItem={isUsingItem}
                    onHoverPlacedItem={setHoveredPlacedItemId}
                    clearHoveredExcept={clearHoveredExcept}
                    onCursorMove={onCursorMove}
                    onCursorEnter={onCursorEnter}
                    onPlacedItemClick={onPlacedItemClick}
                    onPlacedItemUseItem={onPlacedItemUseItem}
                    onPlacedItemNotReachable={onPlacedItemNotReachable}
                  />

                  <PlacedNpcLayer
                    cursorBlocked={cursorBlocked || gameEnded}
                    contentSize={contentRect}
                    placedNpcs={visiblePlacedNpcs}
                    revealHotspots={!gameEnded && !isUsingItem && revealHotspots}
                    hoveredPlacedNpcId={hoveredPlacedNpcId}
                    isUsingItem={isUsingItem}
                    onHoverPlacedNpc={setHoveredPlacedNpcId}
                    clearHoveredExcept={clearHoveredExcept}
                    onCursorMove={onCursorMove}
                    onCursorEnter={onCursorEnter}
                    onPlacedNpcClick={onPlacedNpcClick}
                    onPlacedNpcUseItem={onPlacedNpcUseItem}
                    onPlacedNpcNotReachable={onPlacedNpcNotReachable}
                  />

                  <HotspotLayer
                    cursorBlocked={cursorBlocked || gameEnded}
                    contentSize={contentRect}
                    hotspots={visibleHotspots}
                    revealHotspots={!gameEnded && !isUsingItem && revealHotspots}
                    hoveredHotspotId={hoveredHotspotId}
                    isUsingItem={isUsingItem}
                    onHoverHotspot={setHoveredHotspotId}
                    clearHoveredExcept={clearHoveredExcept}
                    onCursorMove={onCursorMove}
                    onCursorEnter={onCursorEnter}
                    onHotspotClick={onHotspotClick}
                    onHotspotUseItem={onHotspotUseItem}
                    onNotReachable={onNotReachable}
                  />

                  {dialogueText && dialogueSpeaker && dialogueTargetRect ? (
                    <DialogueSpeechBubble
                      text={dialogueText}
                      speaker={dialogueSpeaker}
                      targetRect={dialogueTargetRect}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <div className="game-no-image">
          <span className="game-no-image-text">Esta escena no tiene imagen definida.</span>
        </div>
      )}
    </div>
  );
}