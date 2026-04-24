import { useEffect, useMemo, useRef, useState } from "react";
import type { Hotspot, PlaceableState, PlacedItem, PlacedNpc, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import { useImageContentRect } from "@/features/player/hooks/useImageContentRect";
import { getHotspotInteractionKind, type InteractionKind } from "@/features/player/components/interactionCursors";
import { DialogueSpeechBubble } from "@/features/player/components/DialogueSpeechBubble";

function rectPx(shape: RegionShape, content: { w: number; h: number }) {
  if (shape.type !== "rect") return null;
  return { left: shape.x * content.w, top: shape.y * content.h, width: shape.w * content.w, height: shape.h * content.h };
}

const placedItemInteractionKind: InteractionKind = "take";
const placedNpcInteractionKind: InteractionKind = "talk";

export function SceneStage(props: {
  imageSrc?: string;
  hotspots?: Array<{ hotspot: Hotspot; runtime?: PlaceableState }>;
  placedItems?: Array<{ placedItem: PlacedItem; runtime?: PlaceableState; imageSrc?: string }>;
  placedPlayers?: Array<{ placedPlayer: PlacedPlayer; runtime?: PlacedPlayerState; imageSrc?: string }>;
  placedNpcs?: Array<{ placedNpc: PlacedNpc; runtime?: PlaceableState; imageSrc?: string }>;

  dialogueText?: string;
  dialogueSpeaker?: "player" | "npc" | null;

  isUsingItem?: boolean;
  onHotspotUseItem?: (hotspot: Hotspot) => void;
  onPlacedItemUseItem?: (placedItem: PlacedItem) => void;
  onPlacedNpcUseItem?: (placedNpc: PlacedNpc) => void;
  onSceneBackgroundClick?: () => void;

  onCursorMove?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorEnter?: (e: React.MouseEvent, kind?: InteractionKind) => void;
  onCursorLeave?: () => void;
  onHotspotClick?: (hotspot: Hotspot) => void;
  onPlacedItemClick?: (placedItem: PlacedItem) => void;
  onPlacedNpcClick?: (placedNpc: PlacedNpc) => void;
  onNotReachable?: (hotspot: Hotspot, text: string) => void;
  onPlacedItemNotReachable?: (placedItem: PlacedItem, text: string) => void;
  onPlacedNpcNotReachable?: (placedNpc: PlacedNpc, text: string) => void;
}) {
  const {
    imageSrc,
    hotspots = [],
    placedItems = [],
    placedPlayers = [],
    placedNpcs = [],
    dialogueText,
    dialogueSpeaker,
    isUsingItem,
    onHotspotUseItem,
    onPlacedItemUseItem,
    onPlacedNpcUseItem,
    onSceneBackgroundClick,
    onCursorMove,
    onCursorEnter,
    onCursorLeave,
    onHotspotClick,
    onPlacedItemClick,
    onPlacedNpcClick,
    onNotReachable,
    onPlacedItemNotReachable,
    onPlacedNpcNotReachable,
  } = props;

  const { containerRef, imgRef, getImageContentRect } = useImageContentRect();
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [contentRect, setContentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const REVEAL_MS = 2000;
  const revealTimerRef = useRef<number | null>(null);
  const [revealHotspots, setRevealHotspots] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredPlacedItemId, setHoveredPlacedItemId] = useState<string | null>(null);
  const [hoveredPlacedNpcId, setHoveredPlacedNpcId] = useState<string | null>(null);

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

  const visibleHotspots = useMemo(
    () => hotspots.filter(({ runtime }) => (runtime?.visible ?? true) === true),
    [hotspots]
  );

  const visiblePlacedItems = useMemo(
    () => placedItems.filter(({ runtime }) => (runtime?.visible ?? true) === true),
    [placedItems]
  );

  const visiblePlacedPlayers = useMemo(
    () => placedPlayers.filter(({ runtime }) => (runtime?.visible ?? true) === true),
    [placedPlayers]
  );

  const visiblePlacedNpcs = useMemo(
    () => placedNpcs.filter(({ runtime }) => (runtime?.visible ?? true) === true),
    [placedNpcs]
  );

  const speakingPlayer = useMemo(() => {
    if (dialogueSpeaker !== "player") return null;
    return visiblePlacedPlayers[0] ?? null;
  }, [dialogueSpeaker, visiblePlacedPlayers]);

  const speakingNpc = useMemo(() => {
    if (dialogueSpeaker !== "npc") return null;
    return visiblePlacedNpcs[0] ?? null;
  }, [dialogueSpeaker, visiblePlacedNpcs]);

  const dialogueTargetRect = useMemo(() => {
    if (!contentRect || !dialogueText || !dialogueSpeaker) return null;

    if (dialogueSpeaker === "player" && speakingPlayer) {
      return rectPx(speakingPlayer.placedPlayer.shape, { w: contentRect.w, h: contentRect.h });
    }

    if (dialogueSpeaker === "npc" && speakingNpc) {
      return rectPx(speakingNpc.placedNpc.shape, { w: contentRect.w, h: contentRect.h });
    }

    return null;
  }, [contentRect, dialogueText, dialogueSpeaker, speakingPlayer, speakingNpc]);

  const triggerReveal = () => {
    setRevealHotspots(true);

    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = window.setTimeout(() => {
      setRevealHotspots(false);
      revealTimerRef.current = null;
    }, REVEAL_MS);
  };

  const handleStageKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab") {
      e.preventDefault();
      triggerReveal();
    }
  };

  function buildUseItemHoverStyle(isHovered: boolean, reachable: boolean) {
    if (!isUsingItem || !isHovered) return undefined;

    return reachable
      ? {
        boxShadow:
          "0 0 0 2px rgba(250,204,21,0.9), 0 0 24px rgba(250,204,21,0.45), inset 0 0 0 2px rgba(250,204,21,0.35)",
        background: "rgba(250,204,21,0.14)",
        borderRadius: 12,
        backdropFilter: "blur(1px)",
      }
      : {
        boxShadow:
          "0 0 0 2px rgba(148,163,184,0.55), 0 0 18px rgba(148,163,184,0.24), inset 0 0 0 2px rgba(148,163,184,0.18)",
        background: "rgba(148,163,184,0.08)",
        borderRadius: 12,
        backdropFilter: "blur(1px)",
      };
  }

  return (
    <div className="game-scene-image h-full relative">
      <style>{`@keyframes hotspotPulse {
        0%   { transform: scale(0.985); opacity: 0.7; }
        50%  { transform: scale(1.035); opacity: 1; }
        100% { transform: scale(0.985); opacity: 0.7; }
      }`}</style>

      {imageSrc ? (
        <>
          <img
            src={imageSrc}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60"
            draggable={false}
          />

          <div
            ref={stageRef}
            tabIndex={0}
            role="application"
            aria-label="Escena"
            onKeyDown={handleStageKeyDown}
            onMouseDown={(e) => {
              stageRef.current?.focus();

              if (!isUsingItem) return;

              const target = e.target as HTMLElement;
              const clickedStageBackground = target === e.currentTarget || target === containerRef.current || target === imgRef.current;
              const clickedInteractionButton = target.closest("button[aria-label]");

              if (clickedStageBackground || !clickedInteractionButton) onSceneBackgroundClick?.();
            }}
            onMouseMove={(e) => onCursorMove?.(e, "idle")}
            onMouseEnter={(e) => onCursorEnter?.(e, "idle")}
            onMouseLeave={() => onCursorLeave?.()}
            className="relative z-10 w-full h-full flex items-center justify-center outline-none"
            style={{ cursor: "none" }}
          >
            <div ref={containerRef} className="relative w-full h-full flex items-center justify-center">
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                className="max-w-full max-h-full object-contain drop-shadow"
                draggable={false}
                onLoad={() => setContentRect(getImageContentRect())}
              />

              {contentRect &&
                (visibleHotspots.length > 0 ||
                  visiblePlacedItems.length > 0 ||
                  visiblePlacedPlayers.length > 0 ||
                  visiblePlacedNpcs.length > 0 ||
                  !!dialogueTargetRect) && (
                  <div
                    className="absolute z-20"
                    style={{ left: contentRect.x, top: contentRect.y, width: contentRect.w, height: contentRect.h }}
                  >
                    {visibleHotspots.map(({ hotspot, runtime }) => {
                      const r = rectPx(hotspot.shape, { w: contentRect.w, h: contentRect.h });
                      if (!r) return null;

                      const reachable = runtime?.reachable ?? true;
                      const interactionKind = getHotspotInteractionKind(hotspot);
                      const notReachableText = (runtime?.notReachableText ?? hotspot.initialState?.notReachableText ?? "").trim();

                      const revealRing = revealHotspots
                        ? reachable
                          ? {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(251,191,36,0.65), 0 0 28px rgba(251,191,36,0.45), inset 0 0 0 2px rgba(251,191,36,0.28)",
                            background: "rgba(251,191,36,0.12)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                          : {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(148,163,184,0.45), 0 0 22px rgba(148,163,184,0.28), inset 0 0 0 2px rgba(148,163,184,0.16)",
                            background: "rgba(148,163,184,0.08)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                        : undefined;

                      const useItemHoverStyle = buildUseItemHoverStyle(hoveredHotspotId === hotspot.id, reachable);

                      return (
                        <button
                          key={hotspot.id}
                          type="button"
                          aria-label={hotspot.label}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            setHoveredHotspotId(hotspot.id);
                            setHoveredPlacedItemId(null);
                            setHoveredPlacedNpcId(null);
                            onCursorEnter?.(e, reachable ? interactionKind : "idle");
                          }}
                          onMouseMove={(e) => {
                            e.stopPropagation();
                            if (hoveredHotspotId !== hotspot.id) setHoveredHotspotId(hotspot.id);
                            if (hoveredPlacedItemId !== null) setHoveredPlacedItemId(null);
                            if (hoveredPlacedNpcId !== null) setHoveredPlacedNpcId(null);
                            onCursorMove?.(e, reachable ? interactionKind : "idle");
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            setHoveredHotspotId(null);
                            onCursorMove?.(e, "idle");
                          }}
                          onClick={() => {
                            if (!reachable) {
                              onNotReachable?.(hotspot, notReachableText || "No puedes interactuar con eso ahora.");
                              return;
                            }

                            if (isUsingItem) {
                              onHotspotUseItem?.(hotspot);
                              return;
                            }

                            onHotspotClick?.(hotspot);
                          }}
                          className={[
                            "absolute bg-transparent",
                            "focus:outline-none",
                            "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-0",
                          ].join(" ")}
                          style={{ ...r, ...(revealRing ?? {}), ...(useItemHoverStyle ?? {}), cursor: "none" }}
                          tabIndex={-1}
                        />
                      );
                    })}

                    {visiblePlacedItems.map(({ placedItem, runtime, imageSrc }) => {
                      const r = rectPx(placedItem.shape, { w: contentRect.w, h: contentRect.h });
                      if (!r) return null;

                      const reachable = runtime?.reachable ?? true;
                      const notReachableText = (runtime?.notReachableText ?? placedItem.initialState?.notReachableText ?? "").trim();

                      const revealRing = revealHotspots
                        ? reachable
                          ? {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(251,191,36,0.65), 0 0 28px rgba(251,191,36,0.45), inset 0 0 0 2px rgba(251,191,36,0.28)",
                            background: "rgba(251,191,36,0.12)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                          : {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(148,163,184,0.45), 0 0 22px rgba(148,163,184,0.28), inset 0 0 0 2px rgba(148,163,184,0.16)",
                            background: "rgba(148,163,184,0.08)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                        : undefined;

                      const useItemHoverStyle = buildUseItemHoverStyle(hoveredPlacedItemId === placedItem.id, reachable);

                      return (
                        <>
                          {imageSrc ? (
                            <div
                              key={`${placedItem.id}-img`}
                              className="absolute pointer-events-none"
                              style={{ ...r }}
                            >
                              <img
                                src={imageSrc}
                                alt={placedItem.label}
                                className="w-full h-full object-fill select-none"
                                draggable={false}
                              />
                            </div>
                          ) : null}

                          <button
                            key={placedItem.id}
                            type="button"
                            aria-label={placedItem.label}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setHoveredPlacedItemId(placedItem.id);
                              setHoveredHotspotId(null);
                              setHoveredPlacedNpcId(null);
                              onCursorEnter?.(e, reachable ? placedItemInteractionKind : "idle");
                            }}
                            onMouseMove={(e) => {
                              e.stopPropagation();
                              if (hoveredPlacedItemId !== placedItem.id) setHoveredPlacedItemId(placedItem.id);
                              if (hoveredHotspotId !== null) setHoveredHotspotId(null);
                              if (hoveredPlacedNpcId !== null) setHoveredPlacedNpcId(null);
                              onCursorMove?.(e, reachable ? placedItemInteractionKind : "idle");
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation();
                              setHoveredPlacedItemId(null);
                              onCursorMove?.(e, "idle");
                            }}
                            onClick={() => {
                              if (!reachable) {
                                onPlacedItemNotReachable?.(
                                  placedItem,
                                  notReachableText || "No puedes interactuar con eso ahora."
                                );
                                return;
                              }

                              if (isUsingItem) {
                                onPlacedItemUseItem?.(placedItem);
                                return;
                              }

                              onPlacedItemClick?.(placedItem);
                            }}
                            className={[
                              "absolute bg-transparent",
                              "focus:outline-none",
                              "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-0",
                            ].join(" ")}
                            style={{ ...r, ...(revealRing ?? {}), ...(useItemHoverStyle ?? {}), cursor: "none" }}
                            tabIndex={-1}
                          />
                        </>
                      );
                    })}

                    {visiblePlacedPlayers.map(({ placedPlayer, imageSrc }) => {
                      const r = rectPx(placedPlayer.shape, { w: contentRect.w, h: contentRect.h });
                      if (!r) return null;

                      return (
                        <>
                          {imageSrc ? (
                            <div
                              key={`${placedPlayer.playerId}-img`}
                              className="absolute pointer-events-none"
                              style={{ ...r }}
                            >
                              <img
                                src={imageSrc}
                                className="w-full h-full object-fill select-none"
                                draggable={false}
                              />
                            </div>
                          ) : null}
                        </>
                      );
                    })}

                    {visiblePlacedNpcs.map(({ placedNpc, runtime, imageSrc }) => {
                      const r = rectPx(placedNpc.shape, { w: contentRect.w, h: contentRect.h });
                      if (!r) return null;

                      const reachable = runtime?.reachable ?? true;
                      const notReachableText = (runtime?.notReachableText ?? placedNpc.initialState?.notReachableText ?? "").trim();

                      const revealRing = revealHotspots
                        ? reachable
                          ? {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(251,191,36,0.65), 0 0 28px rgba(251,191,36,0.45), inset 0 0 0 2px rgba(251,191,36,0.28)",
                            background: "rgba(251,191,36,0.12)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                          : {
                            animation: "hotspotPulse 0.8s ease-in-out infinite",
                            boxShadow:
                              "0 0 0 2px rgba(148,163,184,0.45), 0 0 22px rgba(148,163,184,0.28), inset 0 0 0 2px rgba(148,163,184,0.16)",
                            background: "rgba(148,163,184,0.08)",
                            borderRadius: 12,
                            backdropFilter: "blur(1px)",
                          }
                        : undefined;

                      const useItemHoverStyle = buildUseItemHoverStyle(hoveredPlacedNpcId === placedNpc.npcId, reachable);

                      return (
                        <>
                          {imageSrc ? (
                            <div
                              key={`${placedNpc.npcId}-img`}
                              className="absolute pointer-events-none"
                              style={{ ...r }}
                            >
                              <img
                                src={imageSrc}
                                className="w-full h-full object-fill select-none"
                                draggable={false}
                              />
                            </div>
                          ) : null}

                          <button
                            key={placedNpc.npcId}
                            type="button"
                            aria-label={placedNpc.npcId}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              setHoveredPlacedNpcId(placedNpc.npcId);
                              setHoveredHotspotId(null);
                              onCursorEnter?.(e, reachable ? placedNpcInteractionKind : "idle");
                            }}
                            onMouseMove={(e) => {
                              e.stopPropagation();
                              if (hoveredPlacedItemId !== null) setHoveredPlacedItemId(null);
                              if (hoveredHotspotId !== null) setHoveredHotspotId(null);
                              if (hoveredPlacedNpcId !== placedNpc.npcId) setHoveredPlacedNpcId(placedNpc.npcId);
                              onCursorMove?.(e, reachable ? placedNpcInteractionKind : "idle");
                            }}
                            onMouseLeave={(e) => {
                              e.stopPropagation();
                              setHoveredPlacedNpcId(null);
                              onCursorMove?.(e, "idle");
                            }}
                            onClick={() => {
                              if (!reachable) {
                                onPlacedNpcNotReachable?.(
                                  placedNpc,
                                  notReachableText || "No puedes interactuar con eso ahora."
                                );
                                return;
                              }

                              if (isUsingItem) {
                                onPlacedNpcUseItem?.(placedNpc);
                                return;
                              }

                              onPlacedNpcClick?.(placedNpc);
                            }}
                            className={[
                              "absolute bg-transparent",
                              "focus:outline-none",
                              "focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:ring-offset-0",
                            ].join(" ")}
                            style={{ ...r, ...(revealRing ?? {}), ...(useItemHoverStyle ?? {}), cursor: "none" }}
                            tabIndex={-1}
                          />
                        </>
                      );
                    })}

                    {dialogueText && dialogueSpeaker && dialogueTargetRect ? (
                      <DialogueSpeechBubble
                        text={dialogueText}
                        speaker={dialogueSpeaker}
                        targetRect={dialogueTargetRect}
                      />
                    ) : null}
                  </div>
                )}
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