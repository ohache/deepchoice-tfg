import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { iconForInteractionKind, type InteractionKind } from "@/features/player/components/interactionCursors";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";

export type PlayerInteractionMode =
  | { type: "default" }
  | { type: "useItem"; item: InventoryItemView };

export type CursorSize = {
  width: number;
  height: number;
};

export type SceneContentRect = {
  w: number;
  h: number;
};

export type TextCursorState = {
  visible: boolean;
  x: number;
  y: number;
};

export type PlayerCursorState = {
  visible: boolean;
  kind: InteractionKind;
  x: number;
  y: number;
};

export const PLAYER_CURSOR_DEFAULT_SIZE: CursorSize = { width: 64, height: 64 };
export const PLAYER_ITEM_CURSOR_FALLBACK_SIZE: CursorSize = { width: 128, height: 128 };

const PLAYER_ITEM_CURSOR_MIN_SIZE = 40;
const PLAYER_ITEM_CURSOR_MAX_SIZE = 150;
const PLAYER_ITEM_CURSOR_SCENE_RATIO = 0.15;

const INITIAL_TEXT_CURSOR: TextCursorState = { visible: false, x: 0, y: 0 };

const INITIAL_PLAYER_CURSOR: PlayerCursorState = { visible: false, kind: "idle", x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getSceneBasedItemCursorSize(sceneContentRect?: SceneContentRect | null): CursorSize {
  if (!sceneContentRect) return PLAYER_ITEM_CURSOR_FALLBACK_SIZE;

  const shortestSceneSide = Math.min(sceneContentRect.w, sceneContentRect.h);

  if (!Number.isFinite(shortestSceneSide) || shortestSceneSide <= 0) return PLAYER_ITEM_CURSOR_FALLBACK_SIZE;

  const size = Math.round(clamp(shortestSceneSide * PLAYER_ITEM_CURSOR_SCENE_RATIO, PLAYER_ITEM_CURSOR_MIN_SIZE, PLAYER_ITEM_CURSOR_MAX_SIZE));

  return { width: size, height: size };
}

function isSameTextCursor(a: TextCursorState, b: TextCursorState): boolean {
  return a.visible === b.visible && a.x === b.x && a.y === b.y;
}

function isSamePlayerCursor(a: PlayerCursorState, b: PlayerCursorState): boolean {
  return a.visible === b.visible && a.kind === b.kind && a.x === b.x && a.y === b.y;
}

function hideTextCursorState(prev: TextCursorState): TextCursorState {
  return prev.visible ? { ...prev, visible: false } : prev;
}

function hidePlayerCursorState(prev: PlayerCursorState): PlayerCursorState {
  return prev.visible ? { ...prev, visible: false } : prev;
}

function showTextCursorState(prev: TextCursorState, x: number, y: number): TextCursorState {
  const next: TextCursorState = { visible: true, x, y };

  return isSameTextCursor(prev, next) ? prev : next;
}

function showPlayerCursorState(prev: PlayerCursorState, x: number, y: number, kind: InteractionKind): PlayerCursorState {
  const next: PlayerCursorState = { visible: true, x, y, kind };

  return isSamePlayerCursor(prev, next) ? prev : next;
}

/* Gestiona los cursores visuales del Player */
export function usePlayerCursor(interactionMode: PlayerInteractionMode, sceneContentRect?: SceneContentRect | null) {
  const [textCursor, setTextCursor] = useState<TextCursorState>(INITIAL_TEXT_CURSOR);
  const [playerCursor, setPlayerCursor] = useState<PlayerCursorState>(INITIAL_PLAYER_CURSOR);

  const textCursorRef = useRef<TextCursorState>(INITIAL_TEXT_CURSOR);
  const playerCursorRef = useRef<PlayerCursorState>(INITIAL_PLAYER_CURSOR);

  const pendingTextCursorRef = useRef<TextCursorState | null>(null);
  const pendingPlayerCursorRef = useRef<PlayerCursorState | null>(null);
  const cursorFrameRef = useRef<number | null>(null);

  const isUsingItem = interactionMode.type === "useItem";
  const selectedInventoryItem = interactionMode.type === "useItem" ? interactionMode.item : null;

  const applyTextCursorState = useCallback((next: TextCursorState) => {
    if (isSameTextCursor(textCursorRef.current, next)) return;

    textCursorRef.current = next;
    setTextCursor(next);
  }, []);

  const applyPlayerCursorState = useCallback((next: PlayerCursorState) => {
    if (isSamePlayerCursor(playerCursorRef.current, next)) return;

    playerCursorRef.current = next;
    setPlayerCursor(next);
  }, []);

  const clearScheduledCursorFrame = useCallback(() => {
    pendingTextCursorRef.current = null;
    pendingPlayerCursorRef.current = null;

    if (cursorFrameRef.current !== null) {
      window.cancelAnimationFrame(cursorFrameRef.current);
      cursorFrameRef.current = null;
    }
  }, []);

  const flushScheduledCursorFrame = useCallback(() => {
    cursorFrameRef.current = null;

    const nextTextCursor = pendingTextCursorRef.current;
    const nextPlayerCursor = pendingPlayerCursorRef.current;

    pendingTextCursorRef.current = null;
    pendingPlayerCursorRef.current = null;

    if (nextTextCursor) applyTextCursorState(nextTextCursor);
    if (nextPlayerCursor) applyPlayerCursorState(nextPlayerCursor);
  }, [applyTextCursorState, applyPlayerCursorState]);

  const scheduleCursorState = useCallback((nextTextCursor: TextCursorState | null, nextPlayerCursor: PlayerCursorState | null) => {
    if (nextTextCursor) pendingTextCursorRef.current = nextTextCursor;
    if (nextPlayerCursor) pendingPlayerCursorRef.current = nextPlayerCursor;

    if (cursorFrameRef.current !== null) return;

    cursorFrameRef.current = window.requestAnimationFrame(flushScheduledCursorFrame);
  }, [flushScheduledCursorFrame]);

  const showPlayerCursor = useCallback((x: number, y: number, kind: InteractionKind = "idle") => {
    clearScheduledCursorFrame();

    applyPlayerCursorState(showPlayerCursorState(playerCursorRef.current, x, y, kind));
  }, [applyPlayerCursorState, clearScheduledCursorFrame]);

  const hidePlayerCursor = useCallback(() => {
    clearScheduledCursorFrame();

    applyPlayerCursorState(hidePlayerCursorState(playerCursorRef.current));
  }, [applyPlayerCursorState, clearScheduledCursorFrame]);

  /* Actualiza el cursor de escena desde eventos de ratón */
  const updatePlayerCursorFromMouseEvent = useCallback(
    (e: MouseEvent, kind: InteractionKind = "idle") => {
      scheduleCursorState(hideTextCursorState(textCursorRef.current), showPlayerCursorState(playerCursorRef.current, e.clientX, e.clientY, kind));
    },
    [scheduleCursorState],
  );

  /* Actualiza el cursor del panel de texto */
  const updateTextCursor = useCallback((e: MouseEvent<HTMLDivElement>) => {
    scheduleCursorState(showTextCursorState(textCursorRef.current, e.clientX, e.clientY), hidePlayerCursorState(playerCursorRef.current));
  }, [scheduleCursorState]);

  const hideTextCursor = useCallback(() => {
    clearScheduledCursorFrame();

    applyTextCursorState(hideTextCursorState(textCursorRef.current));
  }, [applyTextCursorState, clearScheduledCursorFrame]);

  const hideAllCursors = useCallback(() => {
    clearScheduledCursorFrame();

    applyTextCursorState(hideTextCursorState(textCursorRef.current));
    applyPlayerCursorState(hidePlayerCursorState(playerCursorRef.current));
  }, [applyTextCursorState, applyPlayerCursorState, clearScheduledCursorFrame]);

  useEffect(() => {
    return () =>  clearScheduledCursorFrame();
  }, [clearScheduledCursorFrame]);

  const playerCursorIconSrc = iconForInteractionKind(playerCursor.kind);
  const effectivePlayerCursorSrc = isUsingItem ? selectedInventoryItem?.imageSrc || playerCursorIconSrc : playerCursorIconSrc;

  const selectedItemCursorSize = useMemo<CursorSize>(() => {
    if (!selectedInventoryItem) return PLAYER_ITEM_CURSOR_FALLBACK_SIZE;

    return getSceneBasedItemCursorSize(sceneContentRect);
  }, [selectedInventoryItem, sceneContentRect]);

  return {
    textCursor, playerCursor, isUsingItem, selectedInventoryItem, effectivePlayerCursorSrc, selectedItemCursorSize, showPlayerCursor,
    hidePlayerCursor, updatePlayerCursorFromMouseEvent, updateTextCursor, hideTextCursor, hideAllCursors };
}