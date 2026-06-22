import { useEffect } from "react";

export type PlayerKeyboardMode = "game" | "dialogue" | "map" | "inventory" | "settings" | "playerBottomBar";

type UsePlayerKeyboardOptions = {
  mode: PlayerKeyboardMode;
  openInventory: () => void;
  openMap: () => void;
  openSettings?: () => void;
  toggleFullscreen?: () => void;
  onEscape?: () => void;
  onTab?: () => void;
  onEnter?: () => void;
  blockTabUntil?: number;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function usePlayerKeyboard(opts: UsePlayerKeyboardOptions) {
  const { mode, openInventory, openMap, openSettings, toggleFullscreen, onEscape, onTab, onEnter, blockTabUntil } = opts;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key.toLowerCase();

      if (key === "escape") {
        event.preventDefault();

        if (document.fullscreenElement && toggleFullscreen) {
          toggleFullscreen();
          return;
        }

        onEscape?.();
        return;
      }

      if (mode === "dialogue") {
        if (key === "tab") {
          event.preventDefault();
          return;
        }

        if (key === "enter") {
          event.preventDefault();
          onEnter?.();
        }

        return;
      }

      if (mode === "map") {
        if (key === "m") {
          event.preventDefault();
          openMap();
          return;
        }

        if (key === "tab") {
          if (blockTabUntil && Date.now() < blockTabUntil) return;

          event.preventDefault();
          onTab?.();
          return;
        }

        if (key === "enter") {
          event.preventDefault();
          onEnter?.();
          return;
        }

        return;
      }

      if (mode === "inventory") {
        if (key === "i") {
          event.preventDefault();
          openInventory();
        }

        return;
      }

      if (mode === "settings") {
        if (key === "s") {
          event.preventDefault();
          openSettings?.();
        }

        return;
      }

      if (mode === "playerBottomBar") {
        return;
      }

      if (key === "tab") {
        event.preventDefault();
        onTab?.();
        return;
      }

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
        openSettings?.();
        return;
      }

      if (key === "t") {
        event.preventDefault();
        toggleFullscreen?.();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [
  mode,
  openInventory,
  openMap,
  openSettings,
  toggleFullscreen,
  onEscape,
  onTab,
  onEnter,
  blockTabUntil,
]);
}