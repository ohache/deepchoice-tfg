import { create } from "zustand";
import type { Project, Hotspot, PlacedItem, ID, PlacedNpc } from "@/domain/types";
import { applyEffects } from "@/engine/apply/applyEffect";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";
import { type GameState, createInitialGameState, ensureNodeRuntime } from "@/engine/state/runtimeState";
import { buildSaveGameData, downloadSaveFile } from "@/engine/save/saveGame";
import { loadSaveFile, restoreGameStateFromSave } from "@/engine/save/loadGame";
import { applyHotspot } from "@/engine/apply/applyHotspot";
import { applyPlacedItemInteraction as applyPlacedItemInteractionEngine } from "@/engine/apply/applyPlacedItem";
import { applyPlacedNpcInteraction as applyPlacedNpcInteractionEngine } from "@/engine/apply/applyPlacedNpc";
import { applyInventoryItemUseItem } from "@/engine/apply/applyInventoryItem";
import { normalizeAssetPath, getPickedRelativePath } from "@/shared/directoryImport";
import { createAudioAdapter, type AudioAdapter } from "@/engine/adapters/audioAdapter";
import { musicSetTargetTrack } from "@/engine/state/slices/musicSlice";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";

interface GameStoreState {
  gameState: GameState | null;
  assetUrls: Record<string, string>;
  audioAdapter: AudioAdapter;

  startGame: (project: Project, files: File[]) => void;
  startGameFromEditor: (project: Project, assetFilesById: Record<ID, File>) => void;

  applyHotspot: (hotspot: Hotspot) => void;
  applyPlacedItemInteraction: (placedItem: PlacedItem) => void;
  applyPlacedNpcInteraction: (placedNpc: PlacedNpc) => void;
  applyInventoryItemInteraction: (sourceInstanceId: ID, targetInstanceId: ID) => void;

  advanceDialogue: (nextNodeId?: ID) => void;
  advanceEndingLine: () => void;

  openMap: () => void;
  closeMap: () => void;
  toggleMap: () => void;
  selectMapRegion: (regionId: ID) => void;
  cycleMapRegionSelection: () => void;
  travelToSelectedMapRegion: () => void;

  saveGameToFile: (filename?: string) => void;
  loadGameFromFile: (file: File) => Promise<void>;

  reset: () => void;
}

/*Helpers generales*/
function emitBubbleMessage(
  text: string,
  speaker?: {
    kind: "narrator" | "player" | "npc";
    speakerId?: ID;
  },
) {
  useUiMessageStore.getState().push({
    text,
    preferredChannel: "bubble",
    speaker:
      speaker?.kind === "player" && speaker.speakerId
        ? { kind: "player", playerId: speaker.speakerId }
        : speaker?.kind === "npc" && speaker.speakerId
          ? { kind: "npc", npcId: speaker.speakerId }
          : speaker?.kind === "narrator"
            ? { kind: "narrator" }
            : undefined,
  });
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function revokeAssetUrls(assetUrlMap: Record<string, string>) {
  for (const url of Object.values(assetUrlMap)) {
    try { URL.revokeObjectURL(url) }
    catch { }
  }
}

function buildAssetUrls(files: File[]): Record<string, string> {
  const assetUrls: Record<string, string> = {};

  for (const file of files) {
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith(".json")) continue;

    const pickedPath = getPickedRelativePath(file);
    const normalizedRelativePath = normalizeAssetPath(pickedPath);

    assetUrls[normalizedRelativePath] = URL.createObjectURL(file);
  }

  return assetUrls;
}

function buildAssetUrlsFromEditor(project: Project, assetFilesById: Record<ID, File>): Record<string, string> {
  const assetUrls: Record<string, string> = {};

  for (const asset of project.assets ?? []) {
    const logicalPath = asset.file;
    const file = assetFilesById[asset.id];

    if (!logicalPath || !file) continue;

    assetUrls[logicalPath] = URL.createObjectURL(file);
  }

  return assetUrls;
}

function buildAssetIdToFile(project: Project): Map<ID, string> {
  const assetIdToFile = new Map<ID, string>();

  for (const asset of project.assets ?? []) {
    assetIdToFile.set(asset.id, asset.file);
  }

  return assetIdToFile;
}

function resolveAssetUrlFromStore(assetId: ID, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>): string | null {
  const file = assetIdToFile.get(assetId);

  if (!file) return null;

  return assetUrls[file] ?? file;
}

/* Helpers de preparación del estado */

function getCurrentNodeMapLocation(state: GameState) {
  const node = state.project.nodes.find((projectNode) => projectNode.id === state.currentNodeId) ?? null;
  return node?.mapLocation ?? null;
}

function discoverCurrentRegion(state: GameState): GameState {
  const loc = getCurrentNodeMapLocation(state);
  if (!loc) return state;

  const currentVisible = state.map.visibleRegionIdsByMap?.[loc.mapId] ?? [];
  const currentUnlocked = state.map.unlockedRegionIdsByMap?.[loc.mapId] ?? [];

  const nextVisible = currentVisible.includes(loc.regionId) ? currentVisible : [...currentVisible, loc.regionId];

  const nextUnlocked = currentUnlocked.includes(loc.regionId) ? currentUnlocked : [...currentUnlocked, loc.regionId];

  return {
    ...state,
    map: {
      ...state.map,
      activeMapId: loc.mapId,
      selectedRegionId: loc.regionId,
      currentRegionIdByMap: { ...state.map.currentRegionIdByMap, [loc.mapId]: loc.regionId },
      visibleRegionIdsByMap: { ...state.map.visibleRegionIdsByMap, [loc.mapId]: nextVisible },
      unlockedRegionIdsByMap: { ...state.map.unlockedRegionIdsByMap, [loc.mapId]: nextUnlocked },
    },
  };
}

function withPreparedRuntimeForCurrentNode(state: GameState): GameState {
  const withDiscovery = discoverCurrentRegion(state);
  return ensureNodeRuntime(withDiscovery, withDiscovery.currentNodeId);
}

function resolveActiveLayerForCurrentNode(state: GameState) {
  const node = state.project.nodes.find((projectNode) => projectNode.id === state.currentNodeId) ?? null;
  if (!node) return null;

  const layers = node.layers ?? [];
  if (!layers.length) return null;

  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const layer = layers[i];

    if (!layer.when || evaluateCondition(state, layer.when)) return layer;
  }

  return layers[0] ?? null;
}

function resolveCurrentMusicTrackId(state: GameState): ID | undefined {
  const node = state.project.nodes.find((projectNode) => projectNode.id === state.currentNodeId) ?? null;
  if (!node) return undefined;

  const activeLayer = resolveActiveLayerForCurrentNode(state);
  if (activeLayer?.musicTrackId) return activeLayer.musicTrackId;

  if (node.musicTrackId) return node.musicTrackId;

  const loc = node.mapLocation;
  if (!loc) return undefined;

  const map = state.project.maps.find((projectMap) => projectMap.id === loc.mapId) ?? null;
  const region = map?.regions.find((mapRegion) => mapRegion.id === loc.regionId) ?? null;

  return region?.musicTrackId;
}

function withResolvedMusicTarget(state: GameState): GameState {
  if (state.gameEnded) return state;

  const targetTrackId = resolveCurrentMusicTrackId(state);
  const nextMusic = musicSetTargetTrack(state.music, targetTrackId);

  if (nextMusic === state.music) return state;

  return {
    ...state,
    music: nextMusic,
  };
}

function prepareNextGameState(state: GameState): GameState {
  return withResolvedMusicTarget(withPreparedRuntimeForCurrentNode(state));
}

function createPreparedInitialGameState(project: Project): GameState {
  return prepareNextGameState(createInitialGameState(project));
}

/* Helpers de mapa */
function getActiveMap(state: GameState) {
  const activeMapId = state.map.activeMapId;
  if (!activeMapId) return null;

  return state.project.maps.find((projectMap) => projectMap.id === activeMapId) ?? null;
}

function getTravelableRegionsForActiveMap(state: GameState) {
  const map = getActiveMap(state);
  if (!map) return [];

  const visible = state.map.visibleRegionIdsByMap?.[map.id] ?? [];
  const unlocked = state.map.unlockedRegionIdsByMap?.[map.id] ?? [];

  return (map.regions ?? []).filter((region) => visible.includes(region.id) && unlocked.includes(region.id) && Boolean(region.entrySceneId));
}

/* Helpers de diálogo */
function setActiveDialogueState(state: GameState, patch: Partial<NonNullable<GameState["activeDialogue"]>>): GameState {
  if (!state.activeDialogue) return state;

  return {
    ...state,
    activeDialogue: {
      ...state.activeDialogue,
      ...patch,
    },
  };
}

function findActiveDialogue(state: GameState) {
  const active = state.activeDialogue;
  if (!active) return null;

  const node = state.project.nodes.find((projectNode) => projectNode.id === active.nodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((dialogue) => dialogue.id === active.dialogueId) ?? null;
}

function findDialogueNode(state: GameState) {
  const dialogue = findActiveDialogue(state);
  const active = state.activeDialogue;

  if (!dialogue || !active) return null;

  return dialogue.nodes.find((node) => node.id === active.currentNodeId) ?? null;
}

function getValidDialogueLineChildren(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return node.childrenIds
    .map((childId) => dialogue.nodes.find((dialogueNode) => dialogueNode.id === childId))
    .filter((child): child is Extract<(typeof dialogue.nodes)[number], { type: "line" }> => { return Boolean(child && child.type === "line") })
    .filter((child) => !child.when || evaluateCondition(state, child.when));
}

function getValidPlayerChildren(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return getValidDialogueLineChildren(dialogue, node, state).filter((child) => child.speaker === "player");
}

function getFirstValidNpcChild(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return getValidDialogueLineChildren(dialogue, node, state).find((child) => child.speaker === "npc") ?? null;
}

function goToDialogueRoot(state: GameState, dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>) {
  return setActiveDialogueState(state, { currentNodeId: dialogue.rootId, phase: "speaking" });
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

    const audio = createAudioAdapter({
      audioEl: new Audio(),
      resolveAssetUrl: (assetId) => resolveAssetUrlFromStore(assetId, assetIdToFile, get().assetUrls),
    });

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

    const audio = createAudioAdapter({
      audioEl: new Audio(),
      resolveAssetUrl: (assetId) => resolveAssetUrlFromStore(assetId, assetIdToFile, get().assetUrls),
    });

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

  applyPlacedItemInteraction: (placedItem: PlacedItem) => {
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

  selectMapRegion: (regionId: ID) => {
    const { gameState } = get();
    if (!gameState || !gameState.map.isOpen) return;

    const activeMap = getActiveMap(gameState);
    if (!activeMap) return;

    const travelable = getTravelableRegionsForActiveMap(gameState);
    const exists = travelable.some((region) => region.id === regionId);
    if (!exists) return;

    set({
      gameState: {
        ...gameState,
        map: {
          ...gameState.map,
          selectedRegionId: regionId,
        },
      },
    });
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

  travelToSelectedMapRegion: () => {
    const { gameState } = get();
    if (!gameState || !gameState.map.isOpen) return;

    const activeMap = getActiveMap(gameState);
    const selectedRegionId = gameState.map.selectedRegionId;

    if (!activeMap || !selectedRegionId) return;

    const visible = gameState.map.visibleRegionIdsByMap?.[activeMap.id] ?? [];
    const unlocked = gameState.map.unlockedRegionIdsByMap?.[activeMap.id] ?? [];

    if (!visible.includes(selectedRegionId) || !unlocked.includes(selectedRegionId)) return;

    const region = (activeMap.regions ?? []).find((mapRegion) => mapRegion.id === selectedRegionId) ?? null;
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
        selectedRegionId,
        currentRegionIdByMap: {
          ...gameState.map.currentRegionIdByMap,
          [activeMap.id]: selectedRegionId,
        },
      },
    });

    set({ gameState: nextState });
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