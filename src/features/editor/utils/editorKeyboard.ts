import type * as React from "react";
import { runShortcutMap } from "@/shared/keyboard";

/* Acciones que el EditorShell le pasa al handler */
export type EditorKeyboardActions = {
  saveProject?: () => void;
  exportProject?: () => void;
  closeModalOrCancel?: () => void;
  focusSearch?: () => void;
  toggleHelp?: () => void;
  deleteSelection?: () => void;
  duplicateSelection?: () => void;
  selectAll?: () => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  zoomReset?: () => void;
  fitToView?: () => void;
};

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;

  if (!el) return false;

  const tag = el.tagName?.toLowerCase();

  return tag === "input" || tag === "textarea" || el.isContentEditable === true;
}

/* Devuelve un onKeyDown para el editor */
export function createEditorKeyHandler(actions: EditorKeyboardActions) {
  return (e: React.KeyboardEvent) => {
    const typing = isTypingTarget(e.target);

    if (e.key === "Escape") {
      actions.closeModalOrCancel?.();
      return;
    }

    if (typing) return;

    runShortcutMap(e, [
      // Guardar (Ctrl+S)
      {
        when: { key: "S", ctrl: true },
        action: () => actions.saveProject?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Exportar (Ctrl+E)
      {
        when: { key: "E", ctrl: true },
        action: () => actions.exportProject?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Buscar (Ctrl+F)
      {
        when: { key: "F", ctrl: true },
        action: () => actions.focusSearch?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Selección: borrar
      {
        when: { key: "Delete" },
        action: () => actions.deleteSelection?.(),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "Backspace" },
        action: () => actions.deleteSelection?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Duplicar (Ctrl+D)
      {
        when: { key: "D", ctrl: true },
        action: () => actions.duplicateSelection?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Select all (Ctrl+A)
      {
        when: { key: "A", ctrl: true },
        action: () => actions.selectAll?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Zoom in (Ctrl+= / Ctrl+ +)
      {
        when: { key: "=", ctrl: true },
        action: () => actions.zoomIn?.(),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "+", ctrl: true },
        action: () => actions.zoomIn?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Zoom out (Ctrl+-)
      {
        when: { key: "-", ctrl: true },
        action: () => actions.zoomOut?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Zoom reset (Ctrl+0)
      {
        when: { key: "0", ctrl: true },
        action: () => actions.zoomReset?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Fit to view (P)
      {
        when: { key: "P" },
        action: () => actions.fitToView?.(),
        preventDefault: true,
        stopPropagation: true,
      },

      // Ayuda (? / F1)
      {
        when: { key: "?" },
        action: () => actions.toggleHelp?.(),
        preventDefault: true,
        stopPropagation: true,
      },
      {
        when: { key: "F1" },
        action: () => actions.toggleHelp?.(),
        preventDefault: true,
        stopPropagation: true,
      },
    ]);
  };
}
