import { useCallback, useEffect, useRef, useState } from "react";
import type { ID } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";

const FADE_OUT_MS = 220;
const BLACK_HOLD_MS = 60;

type DisplayedNodeState = {
  isFading: boolean;
  displayedNodeId: ID | null;
  displayedGameState: GameState | null;
};

/* Mantiene separada la escena real de la escena visualmente mostrada */
export function usePlayerDisplayedNode(gameState: GameState | null, currentNodeId?: ID): DisplayedNodeState {
  const latestGameStateRef = useRef<GameState | null>(gameState ?? null);
  const displayedNodeIdRef = useRef<ID | null>(currentNodeId ?? null);
  const targetNodeIdRef = useRef<ID | null>(currentNodeId ?? null);

  const timeoutRef = useRef<number | null>(null);

  const [isFading, setIsFading] = useState(false);
  const [displayedNodeId, setDisplayedNodeId] = useState<ID | null>(currentNodeId ?? null);
  const [displayedGameState, setDisplayedGameState] = useState<GameState | null>(gameState ?? null);

  useEffect(() => {
    latestGameStateRef.current = gameState ?? null;
  }, [gameState]);

  const clearTransitionTimeout = useCallback(() => {
    if (!timeoutRef.current) return;

    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const setDisplayedSnapshot = useCallback((nodeId: ID | null, state: GameState | null) => {
    displayedNodeIdRef.current = nodeId;
    setDisplayedNodeId(nodeId);
    setDisplayedGameState(state);
  }, []);

  const syncDisplayedState = useCallback((state: GameState | null) => {
    if (!state) {
      setDisplayedGameState(null);
      return;
    }

    if (!isFading && displayedNodeIdRef.current === state.currentNodeId) {
      setDisplayedGameState(state);
    }
  }, [isFading]);

  const resetDisplayedNode = useCallback(
    (state: GameState) => {
      clearTransitionTimeout();

      targetNodeIdRef.current = state.currentNodeId;
      setIsFading(false);
      setDisplayedSnapshot(state.currentNodeId, state);
    }, [clearTransitionTimeout, setDisplayedSnapshot]);

  const finishTransitionTo = useCallback((targetNodeId: ID, targetState: GameState | null) => {
    setDisplayedSnapshot(targetNodeId, targetState);

    timeoutRef.current = window.setTimeout(() => {
      setIsFading(false);
      timeoutRef.current = null;
    }, BLACK_HOLD_MS);
  }, [setDisplayedSnapshot]);

  const startNodeTransition = useCallback((targetNodeId: ID, targetState: GameState | null) => {
    clearTransitionTimeout();
    setIsFading(true);

    timeoutRef.current = window.setTimeout(() => {
      finishTransitionTo(targetNodeId, targetState);
    }, FADE_OUT_MS);
  }, [clearTransitionTimeout, finishTransitionTo]);

  /* Detecta cambios reales de nodo */
  useEffect(() => {
    if (!currentNodeId) return;

    const isFirstDisplayedNode = displayedNodeIdRef.current == null;

    if (isFirstDisplayedNode) {
      targetNodeIdRef.current = currentNodeId;
      setDisplayedSnapshot(currentNodeId, gameState ?? null);
      return;
    }

    const isSameTargetNode = targetNodeIdRef.current === currentNodeId;

    if (isSameTargetNode) return;

    targetNodeIdRef.current = currentNodeId;
    startNodeTransition(currentNodeId, gameState ?? null);
  }, [currentNodeId, gameState, setDisplayedSnapshot, startNodeTransition]);

  useEffect(() => {
    syncDisplayedState(gameState);
  }, [gameState, syncDisplayedState]);

  useEffect(() => {
    const latestGameState = latestGameStateRef.current;

    if (!latestGameState?.currentNodeId) return;

    resetDisplayedNode(latestGameState);
  }, [gameState?.project?.id, resetDisplayedNode]);

  useEffect(() => {
    return () => {
      clearTransitionTimeout();
    };
  }, [clearTransitionTimeout]);

  return { isFading, displayedNodeId, displayedGameState };
}