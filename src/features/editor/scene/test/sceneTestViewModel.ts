import type { Dialogue, Hotspot, ID, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, SceneImageLayer, VarDef } from "@/domain/types";
import type { SceneTestBuildIndexes, SceneTestDialogueEntry, SceneTestHotspotEntry, SceneTestInitialStateSummary, SceneTestLayerEntry,
  SceneTestMapSummary, SceneTestPlacedItemEntry, SceneTestPlacedNpcEntry, SceneTestPlacedPlayerEntry, SceneTestResolvedMusicSummary,
  SceneTestSceneEntry, SceneTestTextVariantEntry, SceneTestVarEntry, SceneTestViewModel } from "@/features/editor/scene/test/sceneTestTypes";
import { formatCondition, formatRules } from "@/features/editor/scene/test/sceneTestFormatters";

/* Helpers */
function normalizeText(value: string | undefined | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function fallbackSceneTitle(node: Node, index: number): string {
  return normalizeText(node.title) || `Escena ${index + 1}`;
}

function fallbackLayerTitle(layer: SceneImageLayer, index: number): string {
  return normalizeText(layer.label) || `Capa ${index + 1}`;
}

function createNameIndex<T extends { id: ID; name: string }>(items: T[] | undefined): Record<ID, string> {
  return Object.fromEntries((items ?? []).map((item) => [item.id, normalizeText(item.name) || "Sin nombre"]));
}

function createAssetNameIndex(project: Project): Record<ID, string> {
  return Object.fromEntries((project.assets ?? []).map((asset) => [asset.id, normalizeText(asset.name) || asset.file || "Asset"]));
}

function unknownLabel(base: string): string {
  return `${base} desconocido`;
}

function scopedKey(a: ID, b: ID): string {
  return `${a}:${b}`;
}

function collectNodeNames(project: Project): Record<ID, string> {
  return Object.fromEntries((project.nodes ?? []).map((node, index) => [node.id, fallbackSceneTitle(node, index)]));
}

function collectHotspotNames(project: Project): Record<ID, string> {
  const entries: Array<[ID, string]> = [];

  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const hotspot of layer.hotspots ?? []) {
        entries.push([hotspot.id, normalizeText(hotspot.label) || "Hotspot"]);
      }
    }
  }

  return Object.fromEntries(entries);
}

function collectPlacedItemNames(project: Project): Record<ID, string> {
  const entries: Array<[ID, string]> = [];

  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const placedItem of layer.placedItems ?? []) {
        entries.push([placedItem.id, normalizeText(placedItem.label) || "Item colocado"]);
      }
    }
  }

  return Object.fromEntries(entries);
}

function collectDialogueNames(project: Project): Record<ID, string> {
  const entries: Array<[ID, string]> = [];

  for (const node of project.nodes ?? []) {
    for (const dialogue of node.dialogues ?? []) {
      entries.push([dialogue.id, normalizeText(dialogue.title) || "Diálogo"]);
    }
  }

  return Object.fromEntries(entries);
}

function collectMapNames(project: Project): Record<ID, string> {
  return Object.fromEntries((project.maps ?? []).map((map) => [map.id, normalizeText(map.name) || "Mapa"]));
}

function collectRegionNames(project: Project): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const map of project.maps ?? []) {
    for (const region of map.regions ?? []) {
      entries.push([scopedKey(map.id, region.id), normalizeText(region.label) || "Región"]);
    }
  }

  return Object.fromEntries(entries);
}

function collectPlayerVarNames(project: Project): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const player of project.players ?? []) {
    for (const variable of player.vars ?? []) {
      entries.push([scopedKey(player.id, variable.id), normalizeText(variable.name) || "Variable"]);
    }
  }

  return Object.fromEntries(entries);
}

function collectNpcVarNames(project: Project): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const npc of project.npcs ?? []) {
    for (const variable of npc.vars ?? []) {
      entries.push([scopedKey(npc.id, variable.id), normalizeText(variable.name) || "Variable"]);
    }
  }

  return Object.fromEntries(entries);
}

function collectHotspotVarNames(project: Project): Record<string, string> {
  const entries: Array<[string, string]> = [];

  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const hotspot of layer.hotspots ?? []) {
        for (const variable of hotspot.vars ?? []) {
          entries.push([scopedKey(hotspot.id, variable.id), normalizeText(variable.name) || "Variable"]);
        }
      }
    }
  }

  return Object.fromEntries(entries);
}

function buildIndexes(project: Project): SceneTestBuildIndexes {
  const assetNames = createAssetNameIndex(project);

  return {
    itemNameById: createNameIndex(project.items),
    placedItemNamesById: collectPlacedItemNames(project),
    npcNameById: createNameIndex(project.npcs),
    playerNameById: createNameIndex(project.players),
    musicNameById: createNameIndex(project.musicTracks),
    assetNameById: assetNames,

    nodeNamesById: collectNodeNames(project),
    hotspotNamesById: collectHotspotNames(project),
    mapNamesById: collectMapNames(project),
    regionNamesByScopedId: collectRegionNames(project),
    dialogueNamesById: collectDialogueNames(project),
    sfxNamesById: createNameIndex(project.soundEffects),
    imageNamesById: assetNames,

    playerVarNamesByScopedId: collectPlayerVarNames(project),
    npcVarNamesByScopedId: collectNpcVarNames(project),
    hotspotVarNamesByScopedId: collectHotspotVarNames(project),
  };
}

/* Variables / estado inicial */
function buildVarEntry(variable: VarDef): SceneTestVarEntry {
  return {
    id: variable.id,
    name: normalizeText(variable.name) || "Variable",
    type: variable.type,
    initialText: variable.type === "boolean" ? String(variable.initial) : `${variable.initial}. Mínimo: ${variable.min}. Máximo: ${variable.max}`,
  };
}

function buildInitialStateSummary(state: { visible?: boolean; reachable?: boolean; notReachableText?: string } | undefined): SceneTestInitialStateSummary {
  if (!state) return {};

  return {
    visible: state.visible,
    reachable: state.reachable,
    notReachableText: normalizeText(state.notReachableText) || undefined,
  };
}

/* Variantes de texto */
function buildTextVariants(layer: SceneImageLayer, indexes: SceneTestBuildIndexes): SceneTestTextVariantEntry[] {
  const entries = layer.text ?? [];
  const total = entries.length;

  return entries.map((entry, index) => ({
    id: entry.id,
    label: normalizeText(entry.label) || `Texto ${index + 1}`,
    textIndex: index,
    textCount: total,
    content: entry.content ?? "",
    dock: layer.dock ?? "bottom",
    when: formatCondition(entry.when, indexes),
  }));
}

/* Elementos inspeccionables */
function buildHotspotEntry(hotspot: Hotspot, indexes: SceneTestBuildIndexes): SceneTestHotspotEntry {
  return {
    type: "hotspot",
    id: hotspot.id,
    label: normalizeText(hotspot.label) || "Hotspot",
    raw: hotspot,
    initialState: buildInitialStateSummary(hotspot.initialState),
    vars: (hotspot.vars ?? []).map(buildVarEntry),
    rules: formatRules(hotspot.rules, indexes),
  };
}

function buildPlacedItemEntry(placedItem: PlacedItem, indexes: SceneTestBuildIndexes): SceneTestPlacedItemEntry {
  return {
    type: "placedItem",
    id: placedItem.id,
    label: normalizeText(placedItem.label) || "Item colocado",
    raw: placedItem,
    itemId: placedItem.itemId,
    itemName: indexes.itemNameById[placedItem.itemId] ?? unknownLabel("Item"),
    initialState: buildInitialStateSummary(placedItem.initialState),
    rules: formatRules(placedItem.rules, indexes),
  };
}

function buildPlacedNpcEntry(placedNpc: PlacedNpc, project: Project, indexes: SceneTestBuildIndexes): SceneTestPlacedNpcEntry {
  const npc = (project.npcs ?? []).find((entry) => entry.id === placedNpc.npcId) ?? null;

  return {
    type: "placedNpc",
    id: placedNpc.npcId,
    raw: placedNpc,
    npcId: placedNpc.npcId,
    npcName: indexes.npcNameById[placedNpc.npcId] ?? unknownLabel("NPC"),
    initialState: buildInitialStateSummary(placedNpc.initialState),
    vars: (npc?.vars ?? []).map(buildVarEntry),
    rules: formatRules(placedNpc.rules, indexes),
  };
}

function buildPlacedPlayerEntry(placedPlayer: PlacedPlayer, project: Project, indexes: SceneTestBuildIndexes): SceneTestPlacedPlayerEntry {
  const player = (project.players ?? []).find((entry) => entry.id === placedPlayer.playerId) ?? null;

  return {
    type: "placedPlayer",
    id: placedPlayer.playerId,
    raw: placedPlayer,
    playerId: placedPlayer.playerId,
    playerName: indexes.playerNameById[placedPlayer.playerId] ?? unknownLabel("Player"),
    initialState: { visible: placedPlayer.initialState?.visible },
    initialImageId: placedPlayer.initialImageId,
    initialImageName: indexes.assetNameById[placedPlayer.initialImageId] ?? unknownLabel("Imagen"),
    vars: (player?.vars ?? []).map(buildVarEntry),
  };
}

/* Diálogos */
function buildDialogueEntry(dialogue: Dialogue, indexes: SceneTestBuildIndexes): SceneTestDialogueEntry {
  return {
    id: dialogue.id,
    title: normalizeText(dialogue.title) || "Diálogo",
    playerId: dialogue.playerId,
    playerName: indexes.playerNameById[dialogue.playerId] ?? unknownLabel("Player"),
    npcId: dialogue.npcId,
    npcName: indexes.npcNameById[dialogue.npcId] ?? unknownLabel("NPC"),
    when: formatCondition(dialogue.when, indexes),
  };
}

/* Mapa */
function buildMapSummary(project: Project, node: Node): SceneTestMapSummary | undefined {
  const location = node.mapLocation;
  if (!location) return undefined;

  const map = (project.maps ?? []).find((entry) => entry.id === location.mapId);
  const region = map?.regions.find((entry) => entry.id === location.regionId);

  return {
    mapId: location.mapId,
    mapName: map ? normalizeText(map.name) || unknownLabel("Mapa") : unknownLabel("Mapa"),
    regionId: location.regionId,
    regionName: region ? normalizeText(region.label) || unknownLabel("Región") : unknownLabel("Región"),
    isEntry: Boolean(location.isEntry),
  };
}

/* Música */
function resolveMusicForScene(node: Node, activeLayer: SceneImageLayer | undefined, project: Project, indexes: SceneTestBuildIndexes): SceneTestResolvedMusicSummary | undefined {
  if (activeLayer?.musicTrackId) {
    return {
      trackId: activeLayer.musicTrackId,
      trackName: indexes.musicNameById[activeLayer.musicTrackId] ?? unknownLabel("Pista"),
      source: "variante",
    };
  }

  if (node.musicTrackId) {
    return {
      trackId: node.musicTrackId,
      trackName: indexes.musicNameById[node.musicTrackId] ?? unknownLabel("Pista"),
      source: "escena",
    };
  }

  const location = node.mapLocation;
  if (!location) return undefined;

  const map = (project.maps ?? []).find((entry) => entry.id === location.mapId);
  const region = map?.regions.find((entry) => entry.id === location.regionId);

  if (!region?.musicTrackId) return undefined;

  return {
    trackId: region.musicTrackId,
    trackName: indexes.musicNameById[region.musicTrackId] ?? unknownLabel("Pista"),
    source: "mapa",
  };
}

/* Capa */
function buildLayerEntry(layer: SceneImageLayer, layerIndex: number, layerCount: number,
  project: Project, indexes: SceneTestBuildIndexes): SceneTestLayerEntry {
  const textVariants = buildTextVariants(layer, indexes);

  return {
    id: layer.id,
    label: fallbackLayerTitle(layer, layerIndex),
    layerIndex,
    layerCount,
    assetId: layer.assetId,
    imageSrcLabel: indexes.assetNameById[layer.assetId] ?? unknownLabel("Imagen"),
    textVariants,
    hotspots: (layer.hotspots ?? []).map((entry) => buildHotspotEntry(entry, indexes)),
    placedItems: (layer.placedItems ?? []).map((entry) => buildPlacedItemEntry(entry, indexes)),
    placedNpcs: (layer.placedNpcs ?? []).map((entry) => buildPlacedNpcEntry(entry, project, indexes)),
    placedPlayers: (layer.placedPlayers ?? []).map((entry) => buildPlacedPlayerEntry(entry, project, indexes)),
    musicTrackId: layer.musicTrackId,
    musicTrackName: layer.musicTrackId ? indexes.musicNameById[layer.musicTrackId] ?? unknownLabel("Pista") : undefined,
  };
}

/* Escena */
function buildSceneEntry(node: Node, sceneIndex: number, sceneCount: number, project: Project, indexes: SceneTestBuildIndexes): SceneTestSceneEntry {
  const layers = node.layers ?? [];
  const layerEntries = layers.map((layer, index) => buildLayerEntry(layer, index, layers.length, project, indexes));

  const textVariantCount = layerEntries.reduce((acc, layer) => acc + layer.textVariants.length, 0);

  return {
    id: node.id,
    title: fallbackSceneTitle(node, sceneIndex),
    isStart: Boolean(node.isStart),
    isFinal: Boolean(node.isFinal),
    sceneIndex,
    sceneCount,
    layerCount: layerEntries.length,
    textVariantCount,
    dialogueCount: (node.dialogues ?? []).length,
    map: buildMapSummary(project, node),
    music: resolveMusicForScene(node, layers[0], project, indexes),
    layers: layerEntries,
    dialogues: (node.dialogues ?? []).map((dialogue) => buildDialogueEntry(dialogue, indexes)),
  };
}

/* Builder principal */
export function buildSceneTestViewModel(project: Project | null): SceneTestViewModel | null {
  if (!project) return null;

  const indexes = buildIndexes(project);
  const scenes = (project.nodes ?? []).map((node, index) => buildSceneEntry(node, index, project.nodes.length, project, indexes));

  return {
    projectId: project.id,
    projectTitle: normalizeText(project.title) || "Proyecto",
    scenes,
  };
}