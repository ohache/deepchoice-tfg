import { useCallback, useEffect, useRef, useState } from "react";
import type { InteractiveLayerKind } from "@/features/player/components/interactive/interactiveLayerShared";

const DEFAULT_REVEAL_MS = 2000;

type UseSceneInteractionRevealArgs = {
  resetKey?: unknown;
  revealSignal?: number;
  keyboardBlocked?: boolean;
  gameEnded?: boolean;
  isUsingItem?: boolean;
  onCursorLeave?: () => void;
  revealMs?: number;
};

export function useSceneInteractionReveal({ resetKey, revealSignal, keyboardBlocked, gameEnded, isUsingItem, onCursorLeave, revealMs = DEFAULT_REVEAL_MS}: UseSceneInteractionRevealArgs) {
  const revealTimerRef = useRef<number | null>(null);

  const [revealHotspots, setRevealHotspots] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredPlacedItemId, setHoveredPlacedItemId] = useState<string | null>(null);
  const [hoveredPlacedNpcId, setHoveredPlacedNpcId] = useState<string | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (!revealTimerRef.current) return;

    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
  }, []);

  const resetInteractionReveal = useCallback(() => {
    setRevealHotspots(false);
    setHoveredHotspotId(null);
    setHoveredPlacedItemId(null);
    setHoveredPlacedNpcId(null);

    clearRevealTimer();
    onCursorLeave?.();
  }, [clearRevealTimer, onCursorLeave]);

  const triggerReveal = useCallback(() => {
    if (gameEnded) return;
    if (isUsingItem) return;

    setRevealHotspots(true);
    clearRevealTimer();

    revealTimerRef.current = window.setTimeout(() => {
      setRevealHotspots(false);
      revealTimerRef.current = null;
    }, revealMs);
  }, [gameEnded, isUsingItem, revealMs, clearRevealTimer]);

  const clearHoveredExcept = useCallback((kind: InteractiveLayerKind) => {
    if (kind !== "hotspot") setHoveredHotspotId(null);
    if (kind !== "item") setHoveredPlacedItemId(null);
    if (kind !== "npc") setHoveredPlacedNpcId(null);
  }, []);

  useEffect(() => {
    resetInteractionReveal();
  }, [resetKey, resetInteractionReveal]);

  useEffect(() => {
    return () => {clearRevealTimer() };
  }, [clearRevealTimer]);

  useEffect(() => {
    if (!revealSignal) return;
    if (keyboardBlocked) return;

    triggerReveal();
  }, [revealSignal, keyboardBlocked, triggerReveal]);

  useEffect(() => {
    if (!isUsingItem) return;

    setRevealHotspots(false);
    clearRevealTimer();
  }, [isUsingItem, clearRevealTimer]);

  return {
    revealHotspots, hoveredHotspotId, hoveredPlacedItemId, hoveredPlacedNpcId, setHoveredHotspotId, setHoveredPlacedItemId,
    setHoveredPlacedNpcId, triggerReveal, clearHoveredExcept, resetInteractionReveal,
  };
}