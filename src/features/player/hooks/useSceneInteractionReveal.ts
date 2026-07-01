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

export function useSceneInteractionReveal({ resetKey, revealSignal, keyboardBlocked, gameEnded, isUsingItem, onCursorLeave, revealMs = DEFAULT_REVEAL_MS }: UseSceneInteractionRevealArgs) {
  const revealTimerRef = useRef<number | null>(null);
  const latestRevealSignalRef = useRef(revealSignal ?? 0);
  const lastRevealSignalRef = useRef(revealSignal ?? 0);
  const wasUsingItemRef = useRef(Boolean(isUsingItem));

  latestRevealSignalRef.current = revealSignal ?? 0;

  const [revealHotspots, setRevealHotspots] = useState(false);
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  const [hoveredPlacedItemId, setHoveredPlacedItemId] = useState<string | null>(null);
  const [hoveredPlacedNpcId, setHoveredPlacedNpcId] = useState<string | null>(null);

  const clearRevealTimer = useCallback(() => {
    if (!revealTimerRef.current) return;

    window.clearTimeout(revealTimerRef.current);
    revealTimerRef.current = null;
  }, []);

  const clearHoveredTargets = useCallback(() => {
    setHoveredHotspotId(null);
    setHoveredPlacedItemId(null);
    setHoveredPlacedNpcId(null);
  }, []);

  const resetInteractionReveal = useCallback(() => {
    setRevealHotspots(false);
    clearHoveredTargets();

    clearRevealTimer();
    onCursorLeave?.();
  }, [clearHoveredTargets, clearRevealTimer, onCursorLeave]);

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
    lastRevealSignalRef.current = latestRevealSignalRef.current;
    resetInteractionReveal();
  }, [resetKey, resetInteractionReveal]);

  useEffect(() => {
    return () => { clearRevealTimer() };
  }, [clearRevealTimer]);

  useEffect(() => {
    const currentSignal = revealSignal ?? 0;

    if (currentSignal === lastRevealSignalRef.current) return;

    lastRevealSignalRef.current = currentSignal;

    if (!currentSignal) return;
    if (keyboardBlocked) return;

    triggerReveal();
  }, [revealSignal, keyboardBlocked, triggerReveal]);

  useEffect(() => {
    const wasUsingItem = wasUsingItemRef.current;
    const nowUsingItem = Boolean(isUsingItem);

    wasUsingItemRef.current = nowUsingItem;

    if (!wasUsingItem && !nowUsingItem) return;

    setRevealHotspots(false);
    clearHoveredTargets();

    clearRevealTimer();
  }, [isUsingItem, clearHoveredTargets, clearRevealTimer]);

  return {
    revealHotspots, hoveredHotspotId, hoveredPlacedItemId, hoveredPlacedNpcId, setHoveredHotspotId, setHoveredPlacedItemId,
    setHoveredPlacedNpcId, triggerReveal, clearHoveredExcept, clearHoveredTargets, resetInteractionReveal,
  };
}