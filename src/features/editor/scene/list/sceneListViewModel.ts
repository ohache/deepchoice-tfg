import type { Dialogue, ID, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, SceneImageLayer } from "@/domain/types";

export type SceneListLeafItem =
  | { id: ID; label: string; kind: "text" }
  | { id: ID; label: string; kind: "hotspot" }
  | { id: ID; label: string; itemName: string; kind: "placedItem" }
  | { id: ID; npcName: string; kind: "placedNpc" }
  | { id: ID; playerName: string; kind: "placedPlayer" };

export type SceneListLayerGroup =
  | { key: "texts"; kind: "list"; label: "Textos"; count: number; items: SceneListLeafItem[] }
  | { key: "hotspots"; kind: "list"; label: "Hotspots"; count: number; items: SceneListLeafItem[] }
  | { key: "placedItems"; kind: "list"; label: "Items"; count: number; items: SceneListLeafItem[] }
  | { key: "placedNpcs"; kind: "list"; label: "NPCs"; count: number; items: SceneListLeafItem[] }
  | { key: "placedPlayers"; kind: "list"; label: "Players"; count: number; items: SceneListLeafItem[] }
  | { key: "music"; kind: "single"; label: "Música"; trackName: string };

export interface SceneListLayerEntry {
  id: ID;
  label: string;
  groups: SceneListLayerGroup[];
}

export interface SceneListDialogueEntry {
  id: ID;
  title: string;
  playerName: string;
  npcName: string;
}

export interface SceneListMapSummary {
  mapName: string;
  regionName: string;
  isEntry: boolean;
}

export interface SceneListMusicSummary {
  trackName: string;
}

export interface SceneListSceneEntry {
  id: ID;
  title: string;
  isStart: boolean;
  isFinal: boolean;
  layerCount: number;
  dialogueCount: number;
  map?: SceneListMapSummary;
  music?: SceneListMusicSummary;
  layers: SceneListLayerEntry[];
  dialogues: SceneListDialogueEntry[];
}

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

function unknownLabel(base: string): string {
  return `${base} desconocido`;
}

function buildTextGroup(layer: SceneImageLayer): SceneListLayerGroup | null {
  const texts = (layer.text ?? [])
    .filter((entry) => normalizeText(entry.label))
    .map((entry) => ({ id: entry.id, label: normalizeText(entry.label), kind: "text" as const }));

  if (texts.length === 0) return null;

  return { key: "texts", kind: "list", label: "Textos", count: texts.length, items: texts };
}

function buildHotspotGroup(layer: SceneImageLayer): SceneListLayerGroup | null {
  const hotspots = (layer.hotspots ?? [])
    .filter((entry) => normalizeText(entry.label))
    .map((entry) => ({ id: entry.id, label: normalizeText(entry.label), kind: "hotspot" as const }));

  if (hotspots.length === 0) return null;

  return { key: "hotspots", kind: "list", label: "Hotspots", count: hotspots.length, items: hotspots };
}

function buildPlacedItemsGroup(layer: SceneImageLayer, itemNameById: Record<ID, string>): SceneListLayerGroup | null {
  const items = (layer.placedItems ?? []).map((entry: PlacedItem) => ({
    id: entry.id,
    label: normalizeText(entry.label) || "Item sin label",
    itemName: itemNameById[entry.itemId] ?? unknownLabel("Item"),
    kind: "placedItem" as const,
  }));

  if (items.length === 0) return null;

  return { key: "placedItems", kind: "list", label: "Items", count: items.length, items };
}

function buildPlacedNpcsGroup(layer: SceneImageLayer, npcNameById: Record<ID, string>): SceneListLayerGroup | null {
  const npcs = (layer.placedNpcs ?? []).map((entry: PlacedNpc, index) => ({
    id: `${entry.npcId}-${index}`,
    npcName: npcNameById[entry.npcId] ?? unknownLabel("NPC"),
    kind: "placedNpc" as const,
  }));

  if (npcs.length === 0) return null;

  return {  key: "placedNpcs", kind: "list", label: "NPCs", count: npcs.length, items: npcs };
}

function buildPlacedPlayersGroup(layer: SceneImageLayer, playerNameById: Record<ID, string>): SceneListLayerGroup | null {
  const players = (layer.placedPlayers ?? []).map((entry: PlacedPlayer, index) => ({
    id: `${entry.playerId}-${index}`,
    playerName: playerNameById[entry.playerId] ?? unknownLabel("Player"),
    kind: "placedPlayer" as const,
  }));

  if (players.length === 0) return null;

  return { key: "placedPlayers", kind: "list", label: "Players", count: players.length, items: players };
}

function buildLayerMusicGroup(layer: SceneImageLayer, musicNameById: Record<ID, string>): SceneListLayerGroup | null {
  if (!layer.musicTrackId) return null;

  return { key: "music", kind: "single", label: "Música", trackName: musicNameById[layer.musicTrackId] ?? unknownLabel("Pista") };
}

function buildLayerEntry(
  layer: SceneImageLayer,
  index: number,
  refs: { itemNameById: Record<ID, string>; npcNameById: Record<ID, string>; playerNameById: Record<ID, string>; musicNameById: Record<ID, string> },
): SceneListLayerEntry {
  const groups = [
    buildTextGroup(layer),
    buildHotspotGroup(layer),
    buildPlacedItemsGroup(layer, refs.itemNameById),
    buildPlacedNpcsGroup(layer, refs.npcNameById),
    buildPlacedPlayersGroup(layer, refs.playerNameById),
    buildLayerMusicGroup(layer, refs.musicNameById),
  ].filter(Boolean) as SceneListLayerGroup[];

  return { id: layer.id, label: fallbackLayerTitle(layer, index), groups };
}

function buildDialogueEntry(
  dialogue: Dialogue,
  refs: { playerNameById: Record<ID, string>; npcNameById: Record<ID, string> },
): SceneListDialogueEntry {
  return {
    id: dialogue.id,
    title: normalizeText(dialogue.title) || "Diálogo sin título",
    playerName: refs.playerNameById[dialogue.playerId] ?? unknownLabel("Player"),
    npcName: refs.npcNameById[dialogue.npcId] ?? unknownLabel("NPC"),
  };
}

function buildMapSummary(project: Project, node: Node): SceneListMapSummary | undefined {
  const location = node.mapLocation;
  if (!location) return undefined;

  const map = (project.maps ?? []).find((entry) => entry.id === location.mapId);
  if (!map) {
    return {  mapName: unknownLabel("Mapa"), regionName: unknownLabel("Región"), isEntry: Boolean(location.isEntry) };
  }

  const region = (map.regions ?? []).find((entry) => entry.id === location.regionId);

  return {
    mapName: normalizeText(map.name) || unknownLabel("Mapa"),
    regionName: region ? normalizeText(region.label) || unknownLabel("Región") : unknownLabel("Región"),
    isEntry: Boolean(location.isEntry),
  };
}

function buildSceneMusicSummary(node: Node, musicNameById: Record<ID, string>): SceneListMusicSummary | undefined {
  if (!node.musicTrackId) return undefined;

  return { trackName: musicNameById[node.musicTrackId] ?? unknownLabel("Pista") };
}

export function buildSceneListEntries(project: Project | null): SceneListSceneEntry[] {
  if (!project) return [];

  const itemNameById = createNameIndex(project.items);
  const npcNameById = createNameIndex(project.npcs);
  const playerNameById = createNameIndex(project.players);
  const musicNameById = createNameIndex(project.musicTracks);

  return (project.nodes ?? []).map((node, index) => ({
    id: node.id,
    title: fallbackSceneTitle(node, index),
    isStart: Boolean(node.isStart),
    isFinal: Boolean(node.isFinal),
    layerCount: node.layers.length,
    dialogueCount: (node.dialogues ?? []).length,
    map: buildMapSummary(project, node),
    music: buildSceneMusicSummary(node, musicNameById),
    layers: node.layers.map((layer, layerIndex) => buildLayerEntry(layer, layerIndex, { itemNameById, npcNameById, playerNameById, musicNameById })),
    dialogues: (node.dialogues ?? []).map((dialogue) => buildDialogueEntry(dialogue, { playerNameById, npcNameById })),
  }));
}