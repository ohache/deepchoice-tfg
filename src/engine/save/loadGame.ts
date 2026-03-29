import type { Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import type { SaveGameData } from "@/engine/save/saveGame";

export async function loadSaveFile(file: File): Promise<SaveGameData> {
  const text = await file.text();
  const parsed = JSON.parse(text);

  if (!parsed || typeof parsed !== "object") throw new Error("Save file inválido.");

  if (!parsed.gameState) throw new Error("El archivo no contiene estado de partida.");

  return parsed as SaveGameData;
}

export function restoreGameStateFromSave(project: Project, save: SaveGameData): GameState {
  if (save.projectId !== project.id) throw new Error("El archivo de guardado pertenece a otro proyecto.");

  const gs = save.gameState;

  if (!gs.currentNodeId) throw new Error("Save corrupto: falta currentNodeId.");

  const nodeExists = project.nodes.some((n) => n.id === gs.currentNodeId);

  if (!nodeExists) throw new Error("El nodo guardado ya no existe en el proyecto.");

  return gs;
}