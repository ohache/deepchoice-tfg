import type { Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import type { SaveGameData } from "@/engine/save/saveGame";

export async function loadSaveFile(file: File): Promise<SaveGameData> {
  const text = await file.text();

  let parsed: unknown;

  try { parsed = JSON.parse(text); }
  catch { throw new Error("El archivo no es un JSON válido."); }

  if (!parsed || typeof parsed !== "object") throw new Error("Save file inválido.");

  const data = parsed as Partial<SaveGameData>;

  if (!data.gameState) throw new Error("El archivo no contiene estado de partida.");

  return data as SaveGameData;
}

export function restoreGameStateFromSave(project: Project, save: SaveGameData): GameState {
  if (save.projectId !== project.id) throw new Error("El archivo de guardado pertenece a otro proyecto.");

  const gameState = save.gameState;

  if (!gameState.currentNodeId) throw new Error("Save corrupto: falta currentNodeId.");

  const nodeExists = project.nodes.some((node) => node.id === gameState.currentNodeId);

  if (!nodeExists) throw new Error("El nodo guardado ya no existe en el proyecto.");

  return {
    ...gameState,
    project,
    gameEnded: Boolean(gameState.gameEnded),
    ending: gameState.ending,
    endingLineIndex:
      gameState.gameEnded && gameState.ending?.lines?.length
        ? gameState.endingLineIndex ?? 0
        : undefined,
  };
}