import { create } from "zustand";
import type { Project, Hotspot, ItemInstance, ID, PlacedNpc } from "@/domain/types";
import { applyEffects } from "@/engine/apply/applyEffect";
import {
  buildAssetIdToFile, buildAssetUrls, buildAssetUrlsFromEditor, createPreparedInitialGameState, emitBubbleMessage, findActiveDialogue,
  findDialogueNode, getActiveMap, getCurrentNodeMapLocation, getErrorMessage, getFirstValidNpcChild, getTravelableRegionsForActiveMap,
  getValidPlayerChildren, goToDialogueRoot, prepareNextGameState, revokeAssetUrls, resolveAssetUrlFromStore,
  setActiveDialogueState
} from "@/store/gameStoreHelpers";
import { type GameState } from "@/engine/state/runtimeState";
import { buildSaveGameData, downloadSaveFile } from "@/engine/save/saveGame";
import { loadSaveFile, restoreGameStateFromSave } from "@/engine/save/loadGame";
import { applyHotspot } from "@/engine/apply/applyHotspot";
import { applyPlacedItemInteraction as applyPlacedItemInteractionEngine } from "@/engine/apply/applyPlacedItem";
import { applyPlacedNpcInteraction as applyPlacedNpcInteractionEngine } from "@/engine/apply/applyPlacedNpc";
import { applyInventoryItemUseItem } from "@/engine/apply/applyInventoryItem";
import { createAudioAdapter, type AudioAdapter } from "@/engine/adapters/SfxAdapter";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";

interface GameStoreState {
  gameState: GameState | null;
  assetUrls: Record<string, string>;
  audioAdapter: AudioAdapter;

  startGame: (project: Project, files: File[]) => void;
  startGameFromEditor: (project: Project, assetFilesById: Record<ID, File>) => void;

  applyHotspot: (hotspot: Hotspot) => void;
  applyPlacedItemInteraction: (placedItem: ItemInstance) => void;
  applyPlacedNpcInteraction: (placedNpc: PlacedNpc) => void;
  applyInventoryItemInteraction: (sourceInstanceId: ID, targetInstanceId: ID) => void;

  advanceDialogue: (nextNodeId?: ID) => void;
  advanceEndingLine: () => void;

  openMap: () => void;
  closeMap: () => void;
  toggleMap: () => void;
  cycleMapRegionSelection: () => void;
  travelToSelectedMapRegion: () => void;
  travelToMapRegion: (regionId: ID) => void;

  saveGameToFile: (filename?: string) => void;
  loadGameFromFile: (file: File) => Promise<void>;

  setPreparedGameState: (nextState: GameState) => void;

  reset: () => void;
}

/* Store */
export const useGameStore = create<GameStoreState>((set, get) => ({
  gameState: null,

  assetUrls: {},

  audioAdapter: {
    playSfx: () => { },
    playSfxUrl: () => { },
    setSfxVolume: () => { },
    dispose: () => { },
  },

  startGame: (project: Project, files: File[]) => {
    const { assetUrls: prevAssetUrls, audioAdapter: prevAudioAdapter } = get();

    revokeAssetUrls(prevAssetUrls);
    prevAudioAdapter?.dispose();

    const assetUrls = buildAssetUrls(files);
    const assetIdToFile = buildAssetIdToFile(project);
    const initialState = createPreparedInitialGameState(project);

    const audio = createAudioAdapter((assetId) => resolveAssetUrlFromStore(assetId, assetIdToFile, get().assetUrls));

    useUiMessageStore.getState().clear();

    set({
      gameState: initialState,
      assetUrls,
      audioAdapter: audio,
    });
  },

  startGameFromEditor: (project: Project, assetFilesById: Record<ID, File>) => {
    const { assetUrls: prevAssetUrls, audioAdapter: prevAudioAdapter } = get();

    revokeAssetUrls(prevAssetUrls);
    prevAudioAdapter?.dispose();

    const assetUrls = buildAssetUrlsFromEditor(project, assetFilesById);
    const assetIdToFile = buildAssetIdToFile(project);
    const initialState = createPreparedInitialGameState(project);

    const audio = createAudioAdapter((assetId) => resolveAssetUrlFromStore(assetId, assetIdToFile, get().assetUrls));

    useUiMessageStore.getState().clear();

    set({
      gameState: initialState,
      assetUrls,
      audioAdapter: audio,
    });
  },

  applyHotspot: (hotspot: Hotspot) => {
    const { gameState, audioAdapter } = get();
    if (!gameState) return;

    try {
      const nextState = prepareNextGameState(
        applyHotspot(gameState, hotspot, {
          audio: audioAdapter,
          emitMessage: emitBubbleMessage,
        })
      );

      set({ gameState: nextState });
    } catch (err) {
      emitBubbleMessage(getErrorMessage(err));
    }
  },

  applyPlacedItemInteraction: (placedItem: ItemInstance) => {
    const { gameState, audioAdapter } = get();
    if (!gameState) return;

    try {
      const nextState = prepareNextGameState(
        applyPlacedItemInteractionEngine(gameState, placedItem, {
          audio: audioAdapter,
          emitMessage: emitBubbleMessage,
        })
      );

      set({ gameState: nextState });
    } catch (err) {
      emitBubbleMessage(getErrorMessage(err));
    }
  },

  applyPlacedNpcInteraction: (placedNpc: PlacedNpc) => {
    const { gameState, audioAdapter } = get();
    if (!gameState) return;

    try {
      const nextState = prepareNextGameState(
        applyPlacedNpcInteractionEngine(gameState, placedNpc, {
          audio: audioAdapter,
          emitMessage: emitBubbleMessage,
        })
      );

      set({ gameState: nextState });
    } catch (err) {
      emitBubbleMessage(getErrorMessage(err));
    }
  },

  applyInventoryItemInteraction: (sourceInstanceId: ID, targetInstanceId: ID) => {
    const { gameState, audioAdapter } = get();
    if (!gameState) return;

    try {
      const nextState = prepareNextGameState(
        applyInventoryItemUseItem(gameState, sourceInstanceId, targetInstanceId, {
          audio: audioAdapter,
          emitMessage: emitBubbleMessage,
        })
      );

      set({ gameState: nextState });
    } catch (err) {
      emitBubbleMessage(getErrorMessage(err));
    }
  },

  advanceDialogue: (nextNodeId?: ID) => {
    const { gameState, audioAdapter } = get();
    if (!gameState?.activeDialogue) return;

    try {
      const dialogue = findActiveDialogue(gameState);
      const active = gameState.activeDialogue;
      const currentNode = findDialogueNode(gameState);

      if (!dialogue || !active || !currentNode) {
        set({
          gameState: {
            ...gameState,
            activeDialogue: undefined,
          },
        });
        return;
      }

      if (currentNode.type === "root") {
        const firstNpcChild = getFirstValidNpcChild(dialogue, currentNode, gameState);

        if (firstNpcChild) {
          set({
            gameState: prepareNextGameState(
              setActiveDialogueState(gameState, {
                currentNodeId: firstNpcChild.id,
                phase: "speaking",
              })
            ),
          });
          return;
        }

        const validPlayerChildren = getValidPlayerChildren(dialogue, currentNode, gameState);

        if (validPlayerChildren.length === 0) return;

        if (validPlayerChildren.length === 1) {
          set({
            gameState: prepareNextGameState(
              setActiveDialogueState(gameState, {
                currentNodeId: validPlayerChildren[0].id,
                phase: "speaking",
              })
            ),
          });
          return;
        }

        if (!nextNodeId) {
          set({
            gameState: prepareNextGameState(
              setActiveDialogueState(gameState, {
                currentNodeId: currentNode.id,
                phase: "choosing",
              })
            ),
          });
          return;
        }

        const selected = validPlayerChildren.find((node) => node.id === nextNodeId);
        if (!selected) return;

        set({
          gameState: prepareNextGameState(
            setActiveDialogueState(gameState, {
              currentNodeId: selected.id,
              phase: "speaking",
            })
          ),
        });
        return;
      }

      if (currentNode.type !== "line") return;

      if (active.phase === "choosing") {
        const validPlayerChildren = getValidPlayerChildren(dialogue, currentNode, gameState);

        if (validPlayerChildren.length === 0) {
          set({
            gameState: prepareNextGameState(goToDialogueRoot(gameState, dialogue)),
          });
          return;
        }

        if (!nextNodeId) {
          set({ gameState });
          return;
        }

        const selected = validPlayerChildren.find((node) => node.id === nextNodeId);
        if (!selected) {
          set({ gameState });
          return;
        }

        set({
          gameState: prepareNextGameState(
            setActiveDialogueState(gameState, {
              currentNodeId: selected.id,
              phase: "speaking",
            })
          ),
        });
        return;
      }

      const stateAfterEffects = applyEffects(gameState, currentNode.effects ?? [], {
        audio: audioAdapter,
        emitMessage: emitBubbleMessage,
      });

      const updatedDialogue = findActiveDialogue(stateAfterEffects);
      const updatedNode = findDialogueNode(stateAfterEffects);
      const updatedActive = stateAfterEffects.activeDialogue;

      if (!updatedDialogue || !updatedNode || !updatedActive || updatedNode.type !== "line") {
        set({ gameState: prepareNextGameState(stateAfterEffects) });
        return;
      }

      const firstNpcChild = getFirstValidNpcChild(updatedDialogue, updatedNode, stateAfterEffects);

      if (firstNpcChild) {
        set({
          gameState: prepareNextGameState(
            setActiveDialogueState(stateAfterEffects, {
              currentNodeId: firstNpcChild.id,
              phase: "speaking",
            })
          ),
        });
        return;
      }

      const validPlayerChildren = getValidPlayerChildren(updatedDialogue, updatedNode, stateAfterEffects);

      if (validPlayerChildren.length === 0) {
        set({ gameState: prepareNextGameState(goToDialogueRoot(stateAfterEffects, updatedDialogue)) });
        return;
      }

      if (validPlayerChildren.length === 1) {
        set({
          gameState: prepareNextGameState(
            setActiveDialogueState(stateAfterEffects, {
              currentNodeId: validPlayerChildren[0].id,
              phase: "speaking",
            })
          ),
        });
        return;
      }

      set({
        gameState: prepareNextGameState(
          setActiveDialogueState(stateAfterEffects, {
            currentNodeId: updatedNode.id,
            phase: "choosing",
          })
        ),
      });
    } catch (err) {
      emitBubbleMessage(getErrorMessage(err));
    }
  },

  advanceEndingLine: () => {
    const { gameState } = get();
    if (!gameState?.gameEnded) return;

    const lines = gameState.ending?.lines ?? [];
    const currentIndex = gameState.endingLineIndex ?? 0;

    if (currentIndex >= lines.length) return;

    set({
      gameState: {
        ...gameState,
        endingLineIndex: currentIndex + 1,
      },
    });
  },

  openMap: () => {
    const { gameState } = get();
    if (!gameState) return;

    const currentLoc = getCurrentNodeMapLocation(gameState);
    const fallbackMapId = currentLoc?.mapId ?? gameState.map.activeMapId ?? gameState.project.maps?.[0]?.id;

    if (!fallbackMapId) return;

    const map = gameState.project.maps.find((projectMap) => projectMap.id === fallbackMapId) ?? null;
    if (!map) return;

    const visible = gameState.map.visibleRegionIdsByMap?.[fallbackMapId] ?? [];
    const unlocked = gameState.map.unlockedRegionIdsByMap?.[fallbackMapId] ?? [];

    const travelable = (map.regions ?? []).filter((region) => visible.includes(region.id) && unlocked.includes(region.id) && Boolean(region.entrySceneId));

    const selectedRegionId = travelable.find((region) => region.id === gameState.map.selectedRegionId)?.id ??
      travelable.find((region) => region.id === currentLoc?.regionId)?.id ?? travelable[0]?.id ?? undefined;

    set({
      gameState: {
        ...gameState,
        map: {
          ...gameState.map,
          isOpen: true,
          activeMapId: fallbackMapId,
          selectedRegionId,
        },
      },
    });
  },

  closeMap: () => {
    const { gameState } = get();
    if (!gameState) return;

    set({
      gameState: {
        ...gameState,
        map: {
          ...gameState.map,
          isOpen: false,
        },
      },
    });
  },

  toggleMap: () => {
    const { gameState } = get();
    if (!gameState) return;

    if (gameState.map.isOpen) {
      get().closeMap();
      return;
    }

    get().openMap();
  },

  cycleMapRegionSelection: () => {
    const { gameState } = get();
    if (!gameState || !gameState.map.isOpen) return;

    const activeMap = getActiveMap(gameState);
    if (!activeMap) return;

    const travelable = getTravelableRegionsForActiveMap(gameState);
    if (!travelable.length) return;

    const currentIndex = travelable.findIndex((region) => region.id === gameState.map.selectedRegionId);

    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % travelable.length;
    const nextRegion = travelable[nextIndex] ?? null;

    if (!nextRegion) return;

    set({
      gameState: {
        ...gameState,
        map: {
          ...gameState.map,
          selectedRegionId: nextRegion.id,
        },
      },
    });
  },

  travelToMapRegion: (regionId: ID) => {
    const { gameState } = get();
    if (!gameState || !gameState.map.isOpen) return;

    const activeMapId = gameState.map.activeMapId;
    if (!activeMapId) return;

    const activeMap = gameState.project.maps.find((projectMap) => projectMap.id === activeMapId) ?? null;
    if (!activeMap) return;

    const visible = gameState.map.visibleRegionIdsByMap?.[activeMap.id] ?? [];
    const unlocked = gameState.map.unlockedRegionIdsByMap?.[activeMap.id] ?? [];

    if (!visible.includes(regionId) || !unlocked.includes(regionId)) return;

    const region = (activeMap.regions ?? []).find((mapRegion) => mapRegion.id === regionId) ?? null;
    const entrySceneId = region?.entrySceneId;

    if (!region || !entrySceneId) return;

    const nextState = prepareNextGameState({
      ...gameState,
      currentNodeId: entrySceneId,
      activeDialogue: undefined,
      visitedNodes: {
        ...gameState.visitedNodes,
        [entrySceneId]: true,
      },
      map: {
        ...gameState.map,
        isOpen: false,
        activeMapId: activeMap.id,
        selectedRegionId: regionId,
        currentRegionIdByMap: {
          ...gameState.map.currentRegionIdByMap,
          [activeMap.id]: regionId,
        },
      },
    });

    set({ gameState: nextState });
  },

  travelToSelectedMapRegion: () => {
    const selectedRegionId = get().gameState?.map.selectedRegionId;
    if (!selectedRegionId) return;

    get().travelToMapRegion(selectedRegionId);
  },

  saveGameToFile: (filename?: string) => {
    const { gameState } = get();
    if (!gameState) return;

    const save = buildSaveGameData(gameState.project, gameState);
    downloadSaveFile(save, filename);
  },

  loadGameFromFile: async (file: File) => {
    const { gameState } = get();

    if (!gameState) throw new Error("No hay partida activa para cargar un guardado.");

    const save = await loadSaveFile(file);
    const restoredState = restoreGameStateFromSave(gameState.project, save);
    const finalState = prepareNextGameState(restoredState);

    useUiMessageStore.getState().clear();

    set({ gameState: finalState });
  },

  setPreparedGameState: (nextState: GameState) => {
    set({ gameState: prepareNextGameState(nextState) });
  },

  reset: () => {
    const { assetUrls, audioAdapter } = get();

    revokeAssetUrls(assetUrls);
    audioAdapter.dispose();
    useUiMessageStore.getState().clear();

    set({
      gameState: null,
      assetUrls: {},
    });
  },
}));