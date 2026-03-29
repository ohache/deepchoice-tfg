import { useEffect } from "react";

export function usePlayerKeyboard(opts: {
  openInventory: () => void;
  openMap: () => void;
  openSettings: () => void;
  toggleFullscreen: () => void;
  onEscape?: () => void;
  onTab?: () => void;
  onEnter?: () => void;
}) {
  const { openInventory, openMap, openSettings, toggleFullscreen, onEscape, onTab, onEnter } = opts;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const key = event.key.toLowerCase();

      if (key === "i") {
        event.preventDefault();
        openInventory();
        return;
      }

      if (key === "m") {
        event.preventDefault();
        openMap();
        return;
      }

      if (key === "s") {
        event.preventDefault();
        openSettings();
        return;
      }

      if (key === "t") {
        event.preventDefault();
        toggleFullscreen();
        return;
      }

      if (key === "tab") {
        event.preventDefault();
        onTab?.();
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        onEnter?.();
        return;
      }

      if (key === "escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          toggleFullscreen();
          return;
        }

        onEscape?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openInventory, openMap, openSettings, toggleFullscreen, onEscape, onTab, onEnter]);
}