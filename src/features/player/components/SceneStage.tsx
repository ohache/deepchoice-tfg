import { useCallback, useEffect, useMemo, useRef, type MouseEvent, type KeyboardEvent } from "react";
import type { ID, Hotspot, PlaceableState, ItemInstance, PlacedNpc, PlacedPlayer, PlacedPlayerState } from "@/domain/types";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { useSceneInteractionReveal } from "@/features/player/hooks/useSceneInteractionReveal";
import type { InteractionKind } from "@/features/player/components/interactionCursors";
import { DialogueSpeechBubble } from "@/features/player/components/DialogueSpeechBubble";
import { HotspotLayer } from "@/features/player/components/interactive/HotspotLayer";
import { PlacedItemLayer } from "@/features/player/components/interactive/PlacedItemLayer";
import { PlacedNpcLayer } from "@/features/player/components/interactive/PlacedNpcLayer";
import { PlacedPlayerLayer } from "@/features/player/components/interactive/PlacedPlayerLayer";
import { rectPx } from "@/features/player/components/interactive/interactiveLayerShared";

type ContentRect = { x: number; y: number; w: number; h: number };

type SceneStageSceneProps = {
  nodeId?: ID | null;
  imageSrc?: string;
  revealSignal?: number;
  keyboardBlocked?: boolean;
  gameEnded?: boolean;
};

type SceneStageEntitiesProps = {
  hotspots?: Array<{ hotspot: Hotspot; runtime?: PlaceableState }>;
  placedItems?: Array<{ placedItem: ItemInstance; runtime?: PlaceableState; imageSrc?: string }>;
  placedPlayers?: Array<{ placedPlayer: PlacedPlayer; runtime?: PlacedPlayerState; imageSrc?: string }>;
  placedNpcs?: Array<{ placedNpc: PlacedNpc; runtime?: PlaceableState; imageSrc?: string }>;
};

type SceneStageDialogueProps = {
  text?: string;
  speaker?: "player" | "npc" | null;
  speakerId?: ID | null;
};

type SceneStageItemUseProps = {
  isUsingItem?: boolean;
  onHotspotUseItem?: (hotspot: Hotspot) => void;
  onPlacedItemUseItem?: (placedItem: ItemInstance) => void;
  onPlacedNpcUseItem?: (placedNpc: PlacedNpc) => void;
};

type SceneStageCursorProps = {
  blocked?: boolean;
  onMove?: (e: MouseEvent, kind?: InteractionKind) => void;
  onEnter?: (e: MouseEvent, kind?: InteractionKind) => void;
  onLeave?: () => void;
};

type SceneStageInteractionsProps = {
  onSceneBackgroundClick?: () => void;

  onHotspotClick?: (hotspot: Hotspot) => void;
  onPlacedItemClick?: (placedItem: ItemInstance) => void;
  onPlacedNpcClick?: (placedNpc: PlacedNpc) => void;

  onHotspotNotReachable?: (hotspot: Hotspot, text: string) => void;
  onPlacedItemNotReachable?: (placedItem: ItemInstance, text: string) => void;
  onPlacedNpcNotReachable?: (placedNpc: PlacedNpc, text: string) => void;
};

type SceneStageProps = {
  scene: SceneStageSceneProps;
  entities: SceneStageEntitiesProps;
  dialogue?: SceneStageDialogueProps;
  itemUse?: SceneStageItemUseProps;
  cursor?: SceneStageCursorProps;
  interactions?: SceneStageInteractionsProps;
  onContentRectChange?: (rect: ContentRect | null) => void;
};

function isVisible(runtime?: { visible: boolean }): boolean {
  return runtime?.visible ?? true;
}

export function SceneStage(props: SceneStageProps) {
  const { scene, entities, dialogue, itemUse, cursor, interactions, onContentRectChange } = props;

  const { nodeId, imageSrc, revealSignal, keyboardBlocked, gameEnded = false } = scene;

  const { hotspots = [], placedItems = [], placedPlayers = [], placedNpcs = [] } = entities;

  const dialogueText = dialogue?.text;
  const dialogueSpeaker = dialogue?.speaker ?? null;
  const dialogueSpeakerId = dialogue?.speakerId ?? null;

  const isUsingItem = itemUse?.isUsingItem;
  const onHotspotUseItem = itemUse?.onHotspotUseItem;
  const onPlacedItemUseItem = itemUse?.onPlacedItemUseItem;
  const onPlacedNpcUseItem = itemUse?.onPlacedNpcUseItem;

  const cursorBlocked = cursor?.blocked;
  const onCursorMove = cursor?.onMove;
  const onCursorEnter = cursor?.onEnter;
  const onCursorLeave = cursor?.onLeave;

  const onSceneBackgroundClick = interactions?.onSceneBackgroundClick;
  const onHotspotClick = interactions?.onHotspotClick;
  const onPlacedItemClick = interactions?.onPlacedItemClick;
  const onPlacedNpcClick = interactions?.onPlacedNpcClick;
  const onNotReachable = interactions?.onHotspotNotReachable;
  const onPlacedItemNotReachable = interactions?.onPlacedItemNotReachable;
  const onPlacedNpcNotReachable = interactions?.onPlacedNpcNotReachable;

  const { containerRef, imgRef, containerElement, imageElement, contentRect, refreshImageContentRect } = useImageContentRect();

  const stageRef = useRef<HTMLDivElement | null>(null);

  const { revealHotspots, hoveredHotspotId, hoveredPlacedItemId, hoveredPlacedNpcId, setHoveredHotspotId, setHoveredPlacedItemId, setHoveredPlacedNpcId,
    triggerReveal, clearHoveredExcept, clearHoveredTargets } = useSceneInteractionReveal({ resetKey: nodeId ?? imageSrc, revealSignal, keyboardBlocked, gameEnded, isUsingItem, onCursorLeave });

  useEffect(() => stageRef.current?.focus(), [nodeId, imageSrc]);

  useEffect(() => {
    onContentRectChange?.(contentRect);
  }, [contentRect, onContentRectChange]);

  const visibleHotspots = useMemo(() => hotspots.filter(({ runtime }) => isVisible(runtime)), [hotspots]);

  const visiblePlacedItems = useMemo(() => placedItems.filter(({ runtime }) => isVisible(runtime)), [placedItems]);

  const visiblePlacedPlayers = useMemo(() => placedPlayers.filter(({ runtime }) => isVisible(runtime)), [placedPlayers]);

  const visiblePlacedNpcs = useMemo(() => placedNpcs.filter(({ runtime }) => isVisible(runtime)), [placedNpcs]);

  const speakingPlayer = useMemo(() => {
    if (dialogueSpeaker !== "player") return null;

    if (dialogueSpeakerId) return visiblePlacedPlayers.find(({ placedPlayer }) => placedPlayer.playerId === dialogueSpeakerId) ?? null;

    return visiblePlacedPlayers[0] ?? null;
  }, [dialogueSpeaker, dialogueSpeakerId, visiblePlacedPlayers]);

  const speakingNpc = useMemo(() => {
    if (dialogueSpeaker !== "npc") return null;

    if (dialogueSpeakerId) return visiblePlacedNpcs.find(({ placedNpc }) => placedNpc.npcId === dialogueSpeakerId) ?? null;

    return visiblePlacedNpcs[0] ?? null;
  }, [dialogueSpeaker, dialogueSpeakerId, visiblePlacedNpcs]);

  const dialogueTargetRect = useMemo(() => {
    if (!contentRect || !dialogueText || !dialogueSpeaker) return null;

    if (dialogueSpeaker === "player" && speakingPlayer) return rectPx(speakingPlayer.placedPlayer.shape, contentRect);

    if (dialogueSpeaker === "npc" && speakingNpc) return rectPx(speakingNpc.placedNpc.shape, contentRect);
  
    return null;
  }, [contentRect, dialogueText, dialogueSpeaker, speakingPlayer, speakingNpc]);

  const hasOverlayContent = !!contentRect && (visibleHotspots.length > 0 || visiblePlacedItems.length > 0 || visiblePlacedPlayers.length > 0 ||
    visiblePlacedNpcs.length > 0 || !!dialogueTargetRect);

  const handleStageKeyDown = useCallback((e: KeyboardEvent) => {
    if (gameEnded) return;
    if (keyboardBlocked) return;
    if (e.key !== "Tab") return;

    e.preventDefault();
    triggerReveal();
  }, [gameEnded, keyboardBlocked, triggerReveal]);

  const handleStageMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    stageRef.current?.focus();

    if (gameEnded) return;

    const target = e.target as HTMLElement;
    
    const clickedStageBackground = target === e.currentTarget || target === containerElement || target === imageElement;

    const clickedInteractionButton = target.closest("button[aria-label]");

    if (clickedStageBackground || !clickedInteractionButton) {
      clearHoveredTargets();
      onSceneBackgroundClick?.();
    }
  }, [gameEnded, containerElement, imageElement, clearHoveredTargets, onSceneBackgroundClick]);

  return (
    <div className="relative h-full bg-black">

      {imageSrc ? (
        <div
          ref={stageRef}
          tabIndex={0}
          role="application"
          aria-label="Escena"
          onKeyDown={handleStageKeyDown}
          onMouseDown={handleStageMouseDown}
          onMouseMove={(e) => {
            if (cursorBlocked) return;

            const target = e.target as HTMLElement;
            const movingOverStageBackground = target === e.currentTarget || target === containerElement || target === imageElement;

            if (movingOverStageBackground) clearHoveredTargets();

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
          style={{ cursor: cursorBlocked && !gameEnded ? "auto" : "none" }}
        >
          <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              className="max-h-full max-w-full object-contain"
              draggable={false}
              onLoad={refreshImageContentRect}
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
                <PlacedPlayerLayer contentSize={contentRect} placedPlayers={visiblePlacedPlayers} />

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
                  <DialogueSpeechBubble text={dialogueText} speaker={dialogueSpeaker} targetRect={dialogueTargetRect} />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="game-no-image">
          <span className="game-no-image-text">Esta escena no tiene imagen definida.</span>
        </div>
      )}
    </div>
  );
}