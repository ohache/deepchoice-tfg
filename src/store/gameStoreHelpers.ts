import type { ID, Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { createInitialGameState, ensureNodeRuntime } from "@/engine/state/runtimeState";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";
import { musicSetTargetTrack } from "@/engine/state/slices/musicSlice";
import { normalizeAssetPath, getPickedRelativePath } from "@/shared/directoryImport";
import { pushBubbleMessage } from "@/engine/messages/uiMessageStore";

/* Mensajes / errores */
export const emitBubbleMessage = pushBubbleMessage;

export function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/* Assets */
export function revokeAssetUrls(assetUrlMap: Record<string, string>) {
  for (const url of Object.values(assetUrlMap)) {
    try { URL.revokeObjectURL(url) }
    catch { }
  }
}

export function buildAssetUrls(files: File[]): Record<string, string> {
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

export function buildAssetUrlsFromEditor(project: Project, assetFilesById: Record<ID, File>): Record<string, string> {
  const assetUrls: Record<string, string> = {};

  for (const asset of project.assets ?? []) {
    const logicalPath = asset.file;
    const file = assetFilesById[asset.id];

    if (!logicalPath || !file) continue;

    assetUrls[logicalPath] = URL.createObjectURL(file);
  }

  return assetUrls;
}

export function buildAssetIdToFile(project: Project): Map<ID, string> {
  const assetIdToFile = new Map<ID, string>();

  for (const asset of project.assets ?? []) assetIdToFile.set(asset.id, asset.file);

  return assetIdToFile;
}

export function resolveAssetUrlFromStore(assetId: ID, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>): string | null {
  const file = assetIdToFile.get(assetId);

  if (!file) return null;

  return assetUrls[file] ?? file;
}

/* Preparación de estado */
export function getCurrentNodeMapLocation(state: GameState) {
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
      currentRegionIdByMap: {
        ...state.map.currentRegionIdByMap,
        [loc.mapId]: loc.regionId,
      },
      visibleRegionIdsByMap: {
        ...state.map.visibleRegionIdsByMap,
        [loc.mapId]: nextVisible,
      },
      unlockedRegionIdsByMap: {
        ...state.map.unlockedRegionIdsByMap,
        [loc.mapId]: nextUnlocked,
      },
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

  return { ...state, music: nextMusic };
}

export function prepareNextGameState(state: GameState): GameState {
  return withResolvedMusicTarget(withPreparedRuntimeForCurrentNode(state));
}

export function createPreparedInitialGameState(project: Project): GameState {
  return prepareNextGameState(createInitialGameState(project));
}

/* Mapa */
export function getActiveMap(state: GameState) {
  const activeMapId = state.map.activeMapId;
  if (!activeMapId) return null;

  return state.project.maps.find((projectMap) => projectMap.id === activeMapId) ?? null;
}

export function getTravelableRegionsForActiveMap(state: GameState) {
  const map = getActiveMap(state);
  if (!map) return [];

  const visible = state.map.visibleRegionIdsByMap?.[map.id] ?? [];
  const unlocked = state.map.unlockedRegionIdsByMap?.[map.id] ?? [];

  return (map.regions ?? []).filter((region) => visible.includes(region.id) && unlocked.includes(region.id) && Boolean(region.entrySceneId));
}

/* Diálogo */
export function setActiveDialogueState(state: GameState, patch: Partial<NonNullable<GameState["activeDialogue"]>>): GameState {
  if (!state.activeDialogue) return state;

  return {
    ...state,
    activeDialogue: {
      ...state.activeDialogue,
      ...patch,
    },
  };
}

export function findActiveDialogue(state: GameState) {
  const active = state.activeDialogue;
  if (!active) return null;

  const node = state.project.nodes.find((projectNode) => projectNode.id === active.nodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((dialogue) => dialogue.id === active.dialogueId) ?? null;
}

export function findDialogueNode(state: GameState) {
  const dialogue = findActiveDialogue(state);
  const active = state.activeDialogue;

  if (!dialogue || !active) return null;

  return dialogue.nodes.find((node) => node.id === active.currentNodeId) ?? null;
}

export function getValidDialogueLineChildren(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return node.childrenIds.map((childId) => dialogue.nodes.find((dialogueNode) => dialogueNode.id === childId))
    .filter((child): child is Extract<(typeof dialogue.nodes)[number], { type: "line" }> =>
      Boolean(child && child.type === "line")).filter((child) => !child.when || evaluateCondition(state, child.when));
}

export function getValidPlayerChildren(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return getValidDialogueLineChildren(dialogue, node, state).filter((child) => child.speaker === "player");
}

export function getFirstValidNpcChild(dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>, node: NonNullable<ReturnType<typeof findDialogueNode>>, state: GameState) {
  return getValidDialogueLineChildren(dialogue, node, state).find((child) => child.speaker === "npc") ?? null;
}

export function goToDialogueRoot(state: GameState, dialogue: NonNullable<ReturnType<typeof findActiveDialogue>>) {
  return setActiveDialogueState(state, { currentNodeId: dialogue.rootId, phase: "speaking" });
}