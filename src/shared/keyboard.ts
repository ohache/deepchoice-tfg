import type { KeyboardEvent } from "react";

/* Teclas (string) normalizadas a mayúsculas cuando son letras */
function normalizeKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}

type ShortcutMatch = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
};

type ShortcutEntry = {
  when: ShortcutMatch;
  action: () => void;
  preventDefault?: boolean;
  stopPropagation?: boolean;
};

/* Comprueba si el foco está en un campo editable */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;

  const tag = element.tagName?.toLowerCase();

  return tag === "input" || tag === "textarea" || element.isContentEditable === true;
}

/* Comprueba si un evento de teclado coincide con una definición de shortcut */
function matchesShortcut(event: KeyboardEvent, match: ShortcutMatch): boolean {
  const pressedKey = normalizeKey(event.key);
  const wantedKey = normalizeKey(match.key);

  if (pressedKey !== wantedKey) return false;

  const primaryModifierPressed = event.ctrlKey || event.metaKey;

  if (match.ctrl !== undefined) {
    if (match.ctrl && !primaryModifierPressed) return false;
    if (!match.ctrl && primaryModifierPressed) return false;
  }

  if (match.shift !== undefined && event.shiftKey !== match.shift) return false;
  if (match.alt !== undefined && event.altKey !== match.alt) return false;

  return true;
}

/* Recorre el mapa de shortcuts y ejecuta la primera acción cuyo shortcut coincida */
export function runShortcutMap(event: KeyboardEvent, entries: ShortcutEntry[]): boolean {
  for (const entry of entries) {
    if (!matchesShortcut(event, entry.when)) continue;

    if (entry.preventDefault) event.preventDefault();
    if (entry.stopPropagation) event.stopPropagation();

    entry.action();
    return true;
  }

  return false;
}

/* Crea un handler para confirmar/cancelar formularios o modales simples */
export function createCommitCancelKeyHandler<T extends HTMLElement>(onCommit: () => void, onCancel: () => void, opts?: { commitWithModifier?: boolean; stopPropagation?: boolean }) {
  const { commitWithModifier = false, stopPropagation = false } = opts ?? {};

  return (event: KeyboardEvent<T>) => {
    const isEnter = event.key === "Enter";
    const isEscape = event.key === "Escape";
    const hasModifier = event.ctrlKey || event.metaKey;

    if (isEnter) {
      if (commitWithModifier && !hasModifier) return;

      event.preventDefault();
      if (stopPropagation) event.stopPropagation();

      onCommit();
      return;
    }

    if (isEscape) {
      event.preventDefault();
      if (stopPropagation) event.stopPropagation();

      onCancel();
    }
  };
}

/* Contenido centralizado del modal de ayuda de teclado del editor */
export const EDITOR_KEYBOARD_SHORTCUTS = [
  { keys: "Ctrl + S ", description: "Guardar JSON" },
  { keys: "Ctrl + E ", description: "Exportar proyecto" },
  { keys: "Ctrl + F ", description: "Buscar" },
  { keys: "Ctrl + + ", description: "Zoom in" },
  { keys: "Ctrl + - ", description: "Zoom out" },
  { keys: "Ctrl + 0 ", description: "Reset zoom" },
  { keys: "F1 / ? ", description: "Mostrar ayuda" },
  { keys: "Esc ", description: "Cerrar / cancelar" },
] as const;