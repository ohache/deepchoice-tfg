import { useCallback, useMemo, useState } from "react";
import { iconForInteractionKind, type InteractionKind } from "@/features/player/components/interactionCursors";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";

export type PlayerInteractionMode =
  | { type: "default" }
  | { type: "useItem"; item: InventoryItemView };

export function usePlayerCursor(interactionMode: PlayerInteractionMode) {
  const [textCursor, setTextCursor] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });

  const [playerCursor, setPlayerCursor] = useState<{ visible: boolean; kind: InteractionKind; x: number; y: number }>({ visible: false, kind: "idle", x: 0, y: 0 });

  const showPlayerCursor = useCallback((x: number, y: number, kind: InteractionKind = "idle") => {
    setPlayerCursor({ visible: true, x, y, kind });
  }, []);

  const hidePlayerCursor = useCallback(() => {
    setPlayerCursor((prev) => ({ ...prev, visible: false }));
  }, []);

  const updatePlayerCursorFromMouseEvent = useCallback(
    (e: React.MouseEvent, kind: InteractionKind = "idle") => {
      setTextCursor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      showPlayerCursor(e.clientX, e.clientY, kind);
    },
    [showPlayerCursor]
  );

  const updateTextCursor = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setPlayerCursor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    setTextCursor({ visible: true, x: e.clientX, y: e.clientY });
  }, []);

  const hideTextCursor = useCallback(() => {
    setTextCursor((prev) => ({ ...prev, visible: false }));
  }, []);

  const hideAllCursors = useCallback(() => {
  setTextCursor((prev) => ({ ...prev, visible: false }));
  setPlayerCursor((prev) => ({ ...prev, visible: false }));
}, []);

  const isUsingItem = interactionMode.type === "useItem";
  const selectedInventoryItem = interactionMode.type === "useItem" ? interactionMode.item : null;

  const playerCursorIconSrc = iconForInteractionKind(playerCursor.kind);

  const effectivePlayerCursorSrc = isUsingItem ? selectedInventoryItem?.imageSrc ?? playerCursorIconSrc : playerCursorIconSrc;

const selectedItemCursorSize = useMemo(() => {
  return selectedInventoryItem?.cursorSize ?? { width: 96, height: 96 };
}, [selectedInventoryItem]);

  return {
    textCursor, playerCursor, isUsingItem, selectedInventoryItem, effectivePlayerCursorSrc, selectedItemCursorSize,
    showPlayerCursor, hidePlayerCursor, updatePlayerCursorFromMouseEvent, updateTextCursor, hideTextCursor, hideAllCursors };
}