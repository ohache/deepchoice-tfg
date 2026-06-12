import { useEffect, useRef, useState } from "react";
import type { ID } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";

const FADE_OUT_MS = 220;
const BLACK_HOLD_MS = 60;

export function usePlayerDisplayedNode(gameState: GameState | null, currentNodeId?: ID) {
  const prevNodeIdRef = useRef<ID | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [isFading, setIsFading] = useState(false);
  const [displayedNodeId, setDisplayedNodeId] = useState<ID | null>(currentNodeId ?? null);
  const [displayedGameState, setDisplayedGameState] = useState<GameState | null>(gameState ?? null);

  useEffect(() => {
    if (!currentNodeId) return;

    // Primer render
    if (displayedNodeId == null) {
      setDisplayedNodeId(currentNodeId);
      setDisplayedGameState(gameState ?? null);
      prevNodeIdRef.current = currentNodeId;
      return;
    }

    // Mismo nodo → nada
    if (prevNodeIdRef.current === currentNodeId) return;

    // Limpieza
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 1. Fade OUT
    setIsFading(true);

    timeoutRef.current = window.setTimeout(() => {
      // 2. Cambio de escena (ya en negro)
      setDisplayedNodeId(currentNodeId);
      setDisplayedGameState(gameState ?? null);

      // Pequeño hold en negro para evitar “flash”
      timeoutRef.current = window.setTimeout(() => {
        // 3. Fade IN
        setIsFading(false);
      }, BLACK_HOLD_MS);

    }, FADE_OUT_MS);

    prevNodeIdRef.current = currentNodeId;

  }, [currentNodeId, gameState]);

  // Mantener sync del state mientras NO estamos cambiando escena
  useEffect(() => {
    if (!gameState) {
      setDisplayedGameState(null);
      return;
    }

    if (!isFading && displayedNodeId === gameState.currentNodeId) {
      setDisplayedGameState(gameState);
    }
  }, [gameState, displayedNodeId, isFading]);

  // Reset al cargar proyecto nuevo
  useEffect(() => {
    if (!gameState?.currentNodeId) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsFading(false);
    setDisplayedNodeId(gameState.currentNodeId);
    setDisplayedGameState(gameState);
    prevNodeIdRef.current = gameState.currentNodeId;
  }, [gameState?.project?.id]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { isFading, displayedNodeId, displayedGameState };
}