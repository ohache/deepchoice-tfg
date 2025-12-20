import { create } from "zustand";
import type { Project, Hotspot, ID, ItemVerb } from "@/domain/types";
import { type GameState, createInitialGameState } from "@/engine/gameState";
import { applyHotspot as applyHotspotEngine, applyPlacedItemInteraction as applyPlacedItemInteractionEngine } from "@/engine/applyHotspot";

interface GameStoreState {
  gameState: GameState | null;
  assetUrls: Record<string, string>;

  startGame: (project: Project, files: File[]) => void;
  applyHotspot: (hotspot: Hotspot) => void;
  applyPlacedItemInteraction: (placedItemId: ID, verb: ItemVerb) => void;

  reset: () => void;
}

function revokeAssetUrls(urls: Record<string, string>) {
  for (const url of Object.values(urls)) URL.revokeObjectURL(url);
}

function normalizeAssetPath(rawPath: string): string {
  const unix = rawPath.replace(/\\/g, "/");
  const parts = unix.split("/");
  return parts.length > 1 ? parts.slice(1).join("/") : unix;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,
  assetUrls: {},

  startGame: (project: Project, files: File[]) => {
    revokeAssetUrls(get().assetUrls);

    const assetUrls: Record<string, string> = {};

    for (const file of files) {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".json")) continue;

      const anyFile = file as any;
      const rawPath: string =
        typeof anyFile.webkitRelativePath === "string" && anyFile.webkitRelativePath.length > 0
          ? anyFile.webkitRelativePath
          : file.name;

      const relPath = normalizeAssetPath(rawPath);

      const url = URL.createObjectURL(file);
      assetUrls[relPath] = url;
    }

    const initialState = createInitialGameState(project);

    set({
      gameState: initialState,
      assetUrls,
    });
  },

  applyHotspot: (hotspot: Hotspot) => {
    const { gameState } = get();
    if (!gameState) return;

    try {
      const newState = applyHotspotEngine(gameState, hotspot);
      set({ gameState: newState });
    } catch (error) {
      console.error("Error al aplicar hotspot:", error);
    }
  },

  applyPlacedItemInteraction: (placedItemId: ID, verb) => {
    const { gameState } = get();
    if (!gameState) return;

    try {
      const newState = applyPlacedItemInteractionEngine(gameState, placedItemId, verb);
      set({ gameState: newState });
    } catch (error) {
      console.error("Error al aplicar interacción de item:", error);
    }
  },

  reset: () => {
    revokeAssetUrls(get().assetUrls);
    set({ gameState: null, assetUrls: {} });
  },
}));
