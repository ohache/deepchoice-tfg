import { useCallback, useMemo, useState, type MouseEvent } from "react";
import { iconForInteractionKind, type InteractionKind } from "@/features/player/components/interactionCursors";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";

export type PlayerInteractionMode =
  | { type: "default" }
  | { type: "useItem"; item: InventoryItemView };

export type CursorSize = {
  width: number;
  height: number;
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

const INITIAL_TEXT_CURSOR: TextCursorState = { visible: false, x: 0, y: 0 };

const INITIAL_PLAYER_CURSOR: PlayerCursorState = { visible: false, kind: "idle", x: 0, y: 0 };

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
  const next: TextCursorState = { visible: true, x, y   };

  return isSameTextCursor(prev, next) ? prev : next;
}

function showPlayerCursorState(prev: PlayerCursorState, x: number, y: number, kind: InteractionKind): PlayerCursorState {
  const next: PlayerCursorState = { visible: true, x, y, kind };

  return isSamePlayerCursor(prev, next) ? prev : next;
}

/* Gestiona los cursores visuales del Player */
export function usePlayerCursor(interactionMode: PlayerInteractionMode) {
  const [textCursor, setTextCursor] = useState<TextCursorState>(INITIAL_TEXT_CURSOR);
  const [playerCursor, setPlayerCursor] = useState<PlayerCursorState>(INITIAL_PLAYER_CURSOR);

  const isUsingItem = interactionMode.type === "useItem";
  const selectedInventoryItem = interactionMode.type === "useItem" ? interactionMode.item : null;

  const showPlayerCursor = useCallback((x: number, y: number, kind: InteractionKind = "idle") => {
    setPlayerCursor((prev) => showPlayerCursorState(prev, x, y, kind));
  }, []);

  const hidePlayerCursor = useCallback(() => {
    setPlayerCursor(hidePlayerCursorState);
  }, []);

  /* Actualiza el cursor de escena desde eventos de ratón */
  const updatePlayerCursorFromMouseEvent = useCallback(
    (e: MouseEvent, kind: InteractionKind = "idle") => {
      setTextCursor(hideTextCursorState);
      showPlayerCursor(e.clientX, e.clientY, kind);
    },
    [showPlayerCursor],
  );

  /* Actualiza el cursor del panel de texto */
  const updateTextCursor = useCallback((e: MouseEvent<HTMLDivElement>) => {
    setPlayerCursor(hidePlayerCursorState);
    setTextCursor((prev) => showTextCursorState(prev, e.clientX, e.clientY));
  }, []);

  const hideTextCursor = useCallback(() => {
    setTextCursor(hideTextCursorState);
  }, []);

  const hideAllCursors = useCallback(() => {
    setTextCursor(hideTextCursorState);
    setPlayerCursor(hidePlayerCursorState);
  }, []);

  const playerCursorIconSrc = iconForInteractionKind(playerCursor.kind);
  const effectivePlayerCursorSrc = isUsingItem ? selectedInventoryItem?.imageSrc || playerCursorIconSrc : playerCursorIconSrc;

  const selectedItemCursorSize = useMemo<CursorSize>(() => {
    return selectedInventoryItem?.cursorSize ?? PLAYER_ITEM_CURSOR_FALLBACK_SIZE;
  }, [selectedInventoryItem]);

  return {
    textCursor, playerCursor, isUsingItem, selectedInventoryItem, effectivePlayerCursorSrc, selectedItemCursorSize, showPlayerCursor,
    hidePlayerCursor, updatePlayerCursorFromMouseEvent, updateTextCursor, hideTextCursor, hideAllCursors };
}