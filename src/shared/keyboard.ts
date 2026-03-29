import type * as React from "react";

/* Teclas (string) normalizadas a mayúsculas cuando son letras */
function normalizeKey(key: string): string {
  if (key.length === 1) return key.toUpperCase();
  return key;
}

type ShortcutMatch = {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
};

function matchesShortcut(e: React.KeyboardEvent, match: ShortcutMatch): boolean {
  const pressedKey = normalizeKey(e.key);
  const wantedKey = normalizeKey(match.key);
  if (pressedKey !== wantedKey) return false;

  const primaryMod = e.ctrlKey || e.metaKey;

  if (match.ctrl !== undefined) {
    if (match.ctrl === true && !primaryMod) return false;
    if (match.ctrl === false && primaryMod) return false;
  }

  if (match.shift !== undefined && e.shiftKey !== match.shift) return false;
  if (match.alt !== undefined && e.altKey !== match.alt) return false;

  if (match.meta !== undefined && e.metaKey !== match.meta) return false;

  return true;
}

/* Ejecuta la primera acción cuyo shortcut coincida */
export function runShortcutMap( e: React.KeyboardEvent, entries: Array<{ when: ShortcutMatch; action: () => void;
    preventDefault?: boolean; stopPropagation?: boolean;}>): boolean {
  for (const entry of entries) {
    if (!matchesShortcut(e, entry.when)) continue;

    if (entry.preventDefault) e.preventDefault();
    if (entry.stopPropagation) e.stopPropagation();
    entry.action();
    return true;
  }
  return false;
}

export function createCommitCancelKeyHandler<T extends HTMLElement>(onCommit: () => void, onCancel: () => void,
  opts?: { commitWithModifier?: boolean; stopPropagation?: boolean;}) {
  const { commitWithModifier = false, stopPropagation = false } = opts ?? {};

  return (e: React.KeyboardEvent<T>) => {
    const isEnter = e.key === "Enter";
    const isEsc = e.key === "Escape";
    const hasModifier = e.ctrlKey || e.metaKey;

    if (isEnter) {
      if (commitWithModifier && !hasModifier) return;

      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      onCommit();
      return;
    }

    if (isEsc) {
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      onCancel();
    }
  };
}