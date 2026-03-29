import type * as React from "react";
import { runShortcutMap } from "@/shared/keyboard";

export type PlayerPanels = "none" | "map" | "inventory" | "settings";
export type PlayerVerb = "go" | "look" | "use";

/* Acciones que el player/motor debe exponer */
export type PlayerKeyboardActions = {
  getOpenPanel: () => PlayerPanels;
  setOpenPanel: (panel: PlayerPanels) => void;
  toggleFullscreen?: () => void;
  closeTopLayer?: () => void;
  continue?: () => void;
  cycleMapRegionSelection?: () => void;
  confirmMapTravel?: () => void;
  getActiveVerb?: () => PlayerVerb;
  setActiveVerb?: (verb: PlayerVerb) => void;
};

function togglePanel(actions: PlayerKeyboardActions, panel: Exclude<PlayerPanels, "none">) {
  const current = actions.getOpenPanel();
  actions.setOpenPanel(current === panel ? "none" : panel);
}

/* Handler de teclado para el modo play */
export function createPlayerKeyHandler(actions: PlayerKeyboardActions) {
  return (e: React.KeyboardEvent) => {
    runShortcutMap(e, [
      {
        when: { key: "Escape" },
        action: () => {
          const panel = actions.getOpenPanel();
          if (panel !== "none") {
            actions.setOpenPanel("none");
            return;
          }
          actions.closeTopLayer?.();
        },
        preventDefault: true,
        stopPropagation: true,
      },

      {
        when: { key: "M" },
        action: () => togglePanel(actions, "map"),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "I" },
        action: () => togglePanel(actions, "inventory"),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "S" },
        action: () => togglePanel(actions, "settings"),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "T" },
        action: () => actions.toggleFullscreen?.(),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "Tab" },
        action: () => {
          if (actions.getOpenPanel() === "map") {
            actions.cycleMapRegionSelection?.();
          }
        },
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "Enter" },
        action: () => {
          if (actions.getOpenPanel() === "map") {
            actions.confirmMapTravel?.();
            return;
          }
          actions.continue?.();
        },
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: " " },
        action: () => actions.continue?.(),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "1" },
        action: () => actions.setActiveVerb?.("go"),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "2" },
        action: () => actions.setActiveVerb?.("look"),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "3" },
        action: () => actions.setActiveVerb?.("use"),
        preventDefault: true,
        stopPropagation: true,
      },
    ]);
  };
}