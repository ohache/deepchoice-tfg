import { useCallback, useState } from "react";
import type { InventoryItemView } from "@/features/player/components/InventoryOverlay";

const DEFAULT_BLOCK_TAB_MS = 150;

export type PlayerInteractionMode = { type: "default" } | { type: "useItem"; item: InventoryItemView };

export function usePlayerOverlayState(blockTabMs = DEFAULT_BLOCK_TAB_MS) {
  const [bottomBarOpen, setBottomBarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<PlayerInteractionMode>({ type: "default" });
  const [revealSignal, setRevealSignal] = useState(0);
  const [blockTabUntil, setBlockTabUntil] = useState(0);

  const blockTabBriefly = useCallback(() => {
    setBlockTabUntil(Date.now() + blockTabMs);
  }, [blockTabMs]);

  const clearInteractionMode = useCallback(() => {
    setInteractionMode({ type: "default" });
  }, []);

  const revealInteractiveElements = useCallback(() => {
    setRevealSignal((prev) => prev + 1);
  }, []);

  const closeInventory = useCallback(() => {
    setInventoryOpen(false);
  }, []);

  const toggleInventory = useCallback(() => {
    setInventoryOpen((prev) => !prev);
  }, []);

  const openInventoryFromBottomBar = useCallback(() => {
    setBottomBarOpen(true);
    setInventoryOpen(true);
  }, []);

  const closeBottomBar = useCallback(() => {
    setBottomBarOpen(false);
    blockTabBriefly();
  }, [blockTabBriefly]);

  const toggleBottomBar = useCallback(() => {
    setBottomBarOpen((prev) => !prev);
  }, []);

  const openMapFromBottomBar = useCallback(() => {
    setBottomBarOpen(true);
  }, []);

  const prepareForMapToggle = useCallback(() => {
    setInventoryOpen(false);
    setBottomBarOpen(false);
    clearInteractionMode();
  }, [clearInteractionMode]);

  const openSettingsOverlay = useCallback(() => {
    setInventoryOpen(false);
    setBottomBarOpen(true);
    setSettingsOpen(true);
    clearInteractionMode();
  }, [clearInteractionMode]);

  const closeSettingsAndBottomBar = useCallback(() => {
    setSettingsOpen(false);
    setBottomBarOpen(false);
    blockTabBriefly();
  }, [blockTabBriefly]);

  const closeOverlays = useCallback((shouldBlockTab = true) => {
      setInventoryOpen(false);
      setBottomBarOpen(false);
      setSettingsOpen(false);
      clearInteractionMode();

      if (shouldBlockTab) blockTabBriefly();

    }, [clearInteractionMode, blockTabBriefly],
  );

  const startUseItemInteraction = useCallback((item: InventoryItemView) => {
    setInteractionMode({ type: "useItem", item });
    setInventoryOpen(false);
  }, []);

  return {
    bottomBarOpen, inventoryOpen, settingsOpen, interactionMode, revealSignal, blockTabUntil, setBottomBarOpen, setInventoryOpen, setSettingsOpen,
    clearInteractionMode, revealInteractiveElements, closeInventory, toggleInventory, openInventoryFromBottomBar, closeBottomBar, toggleBottomBar,
    openMapFromBottomBar, prepareForMapToggle, openSettingsOverlay, closeSettingsAndBottomBar,  closeOverlays, startUseItemInteraction,
  };
}