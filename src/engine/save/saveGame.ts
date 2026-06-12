import type { GameState } from "@/engine/state/runtimeState";
import type { Project } from "@/domain/types";

export type SaveGameData = {
  projectId: string;
  projectTitle: string;
  savedAt: number;
  gameState: GameState;
};

export function buildSaveGameData(project: Project, gameState: GameState): SaveGameData {
  return {
    projectId: project.id,
    projectTitle: project.title ?? "adventure",
    savedAt: Date.now(),
    gameState,
  };
}

function buildTimestamp(date: Date): string {
  return (
    date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0") +
    "_" + String(date.getHours()).padStart(2, "0") + "-" + String(date.getMinutes()).padStart(2, "0"));
}

function sanitizeFilename(text: string): string {
  const safe = text.trim().replace(/[^\w\d]+/g, "_").replace(/^_+|_+$/g, "");
  return safe || "save";
}

export function downloadSaveFile(save: SaveGameData, customName?: string) {
  const json = JSON.stringify(save, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const timestamp = buildTimestamp(new Date(save.savedAt));

  const filename = customName?.trim()
    ? `${sanitizeFilename(customName)}.json`
    : `${sanitizeFilename(save.projectTitle)}_save_${timestamp}.json`;

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}