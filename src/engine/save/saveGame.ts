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

export function downloadSaveFile(save: SaveGameData) {
  const json = JSON.stringify(save, null, 2);

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const date = new Date(save.savedAt);
  const timestamp = date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0") + "_" + String(date.getHours()).padStart(2, "0") + "-" + String(date.getMinutes()).padStart(2, "0");

  const safeTitle = save.projectTitle.replace(/[^\w\d]+/g, "_");

  const filename = `${safeTitle}_save_${timestamp}.json`;

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);

  a.click();

  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}