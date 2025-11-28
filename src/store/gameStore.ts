import { create } from "zustand";
import type { Project, Hotspot } from "@/domain/types";
import type { GameState } from "@/engine/gameState";
import { createInitialGameState } from "@/engine/gameState";
import { applyHotspot as applyHotspotEngine } from "@/engine/applyHotspot";

interface GameStoreState {
  gameState: GameState | null;
  startGame: (project: Project) => void;
  applyHotspot: (hotspot: Hotspot) => void;
  reset: () => void;
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,

  startGame: (project: Project) => {
    const initialState = createInitialGameState(project);
    set({ gameState: initialState });
  },

  applyHotspot: (hotspot: Hotspot) => {
    const { gameState } = get();
    if (!gameState) return;

    const newState = applyHotspotEngine(gameState, hotspot);
    set({ gameState: newState });
  },

  reset: () => set({ gameState: null }),
}));