import type { Dialogue, ID, Node, ItemInstance, PlacedNpc, PlacedPlayer, Project, SceneImageLayer } from "@/domain/types";

export type SceneListLeafItem =
  | { id: ID; label: string; kind: "text" }
  | { id: ID; label: string; kind: "hotspot" }
  | { id: ID; label: string; itemName: string; kind: "placedItem" }
  | { id: ID; npcName: string; kind: "placedNpc" }
  | { id: ID; playerName: string; kind: "placedPlayer" };

export type SceneListLayerGroup =
  | { key: "texts"; kind: "list"; label: "Textos"; count: number; items: SceneListLeafItem[] }
  | { key: "hotspots"; kind: "list"; label: "Hotspots"; count: number; items: SceneListLeafItem[] }
  | { key: "placedItems"; kind: "list"; label: "Objetos"; count: number; items: SceneListLeafItem[] }
  | { key: "placedNpcs"; kind: "list"; label: "PNJs"; count: number; items: SceneListLeafItem[] }
  | { key: "placedPlayers"; kind: "list"; label: "Jugadores"; count: number; items: SceneListLeafItem[] }
  | { key: "music"; kind: "single"; label: "Música"; trackName: string; sourceLabel: string };

export type SceneListLayerEntry = {
  id: ID;
  label: string;
  groups: SceneListLayerGroup[];
}

export type SceneListDialogueEntry = {
  id: ID;
  title: string;
  playerName: string;
  npcName: string;
}

export type SceneListMapSummary = {
  mapName: string;
  regionName: string;
  isEntry: boolean;
}

export type SceneListMusicSummary = {
  trackName: string;
  sourceLabel: string;
}

export type SceneListSceneEntry = {
  id: ID;
  title: string;
  searchText: string;
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
  const texts = (layer.text ?? []).filter((entry) => normalizeText(entry.label)).map((entry) => ({ id: entry.id, label: normalizeText(entry.label), kind: "text" as const }));

  if (texts.length === 0) return null;

  return { key: "texts", kind: "list", label: "Textos", count: texts.length, items: texts };
}

function buildHotspotGroup(layer: SceneImageLayer): SceneListLayerGroup | null {
  const hotspots = (layer.hotspots ?? []).filter((entry) => normalizeText(entry.label)).map((entry) => ({ id: entry.id, label: normalizeText(entry.label), kind: "hotspot" as const }));

  if (hotspots.length === 0) return null;

  return { key: "hotspots", kind: "list", label: "Hotspots", count: hotspots.length, items: hotspots };
}

function buildPlacedItemsGroup(layer: SceneImageLayer, itemNameById: Record<ID, string>): SceneListLayerGroup | null {
  const items = (layer.placedItems ?? []).map((entry: ItemInstance) => ({
    id: entry.itemInstanceId,
    label: normalizeText(entry.label) || "Objeto sin label",
    itemName: itemNameById[entry.itemId] ?? unknownLabel("Objeto"),
    kind: "placedItem" as const,
  }));

  if (items.length === 0) return null;

  return { key: "placedItems", kind: "list", label: "Objetos", count: items.length, items };
}

function buildPlacedNpcsGroup(layer: SceneImageLayer, npcNameById: Record<ID, string>): SceneListLayerGroup | null {
  const npcs = (layer.placedNpcs ?? []).map((entry: PlacedNpc, index) => ({
    id: `${layer.id}:${entry.npcId}:${index}`,
    npcName: npcNameById[entry.npcId] ?? unknownLabel("PNJ"),
    kind: "placedNpc" as const,
  }));

  if (npcs.length === 0) return null;

  return { key: "placedNpcs", kind: "list", label: "PNJs", count: npcs.length, items: npcs };
}

function buildPlacedPlayersGroup(layer: SceneImageLayer, playerNameById: Record<ID, string>): SceneListLayerGroup | null {
  const players = (layer.placedPlayers ?? []).map((entry: PlacedPlayer, index) => ({
    id: `${layer.id}:${entry.playerId}:${index}`,
    playerName: playerNameById[entry.playerId] ?? unknownLabel("Jugador"),
    kind: "placedPlayer" as const,
  }));

  if (players.length === 0) return null;

  return { key: "placedPlayers", kind: "list", label: "Jugadores", count: players.length, items: players };
}

function buildLayerMusicGroup(layer: SceneImageLayer, musicNameById: Record<ID, string>): SceneListLayerGroup | null {
  if (!layer.musicTrackId) return null;

  return { key: "music", kind: "single", label: "Música", trackName: musicNameById[layer.musicTrackId] ?? unknownLabel("Pista"), sourceLabel: "Capa" };
}

function buildLayerEntry(layer: SceneImageLayer, index: number,
  refs: { itemNameById: Record<ID, string>; npcNameById: Record<ID, string>; playerNameById: Record<ID, string>; musicNameById: Record<ID, string> }): SceneListLayerEntry {
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

function buildDialogueEntry(dialogue: Dialogue, refs: { playerNameById: Record<ID, string>; npcNameById: Record<ID, string> }): SceneListDialogueEntry {
  return {
    id: dialogue.id,
    title: normalizeText(dialogue.title) || "Diálogo sin título",
    playerName: refs.playerNameById[dialogue.playerId] ?? unknownLabel("Jugador"),
    npcName: refs.npcNameById[dialogue.npcId] ?? unknownLabel("PNJ"),
  };
}

function buildMapSummary(project: Project, node: Node): SceneListMapSummary | undefined {
  const location = node.mapLocation;
  if (!location) return undefined;

  const map = (project.maps ?? []).find((entry) => entry.id === location.mapId);
  if (!map) return { mapName: unknownLabel("Mapa"), regionName: unknownLabel("Región"), isEntry: Boolean(location.isEntry) };

  const region = (map.regions ?? []).find((entry) => entry.id === location.regionId);

  return {
    mapName: normalizeText(map.name) || unknownLabel("Mapa"),
    regionName: region ? normalizeText(region.label) || unknownLabel("Región") : unknownLabel("Región"),
    isEntry: Boolean(location.isEntry),
  };
}

function buildSceneMusicSummary(project: Project, node: Node, musicNameById: Record<ID, string>): SceneListMusicSummary | undefined {
  if (node.musicTrackId) {
    return { trackName: musicNameById[node.musicTrackId] ?? unknownLabel("Pista"), sourceLabel: "Escena" };
  }

  const location = node.mapLocation;
  if (location) {
    const map = (project.maps ?? []).find((entry) => entry.id === location.mapId);
    const region = map?.regions.find((entry) => entry.id === location.regionId);

    if (region?.musicTrackId) {
      return { trackName: musicNameById[region.musicTrackId] ?? unknownLabel("Pista"), sourceLabel: "Región" };
    }
  }

  const layersWithMusic = node.layers.filter((layer) => Boolean(layer.musicTrackId));

  if (layersWithMusic.length === 1) {
    const trackId = layersWithMusic[0]!.musicTrackId!;

    return { trackName: musicNameById[trackId] ?? unknownLabel("Pista"), sourceLabel: "Capa" };
  }

  if (layersWithMusic.length > 1) {
    return { trackName: `${layersWithMusic.length} pistas`, sourceLabel: "Capas" };
  }

  return undefined;
}

function buildSceneSearchText(args: { scene: Pick<SceneListSceneEntry, "title">; map?: SceneListMapSummary; music?: SceneListMusicSummary;
  layers: SceneListLayerEntry[]; dialogues: SceneListDialogueEntry[] }): string {
  const values: string[] = [];

  values.push(args.scene.title);

  if (args.map) values.push(args.map.mapName, args.map.regionName);

  if (args.music) values.push(args.music.trackName);

  for (const layer of args.layers) {
    values.push(layer.label);

    for (const group of layer.groups) {
      values.push(group.label);

      if (group.kind === "single") {
        values.push(group.trackName);
        continue;
      }

      for (const item of group.items) {
        if (item.kind === "text") values.push(item.label);
        else if (item.kind === "hotspot") values.push(item.label);
        else if (item.kind === "placedItem") values.push(item.label, item.itemName);
        else if (item.kind === "placedNpc") values.push(item.npcName);
        else if (item.kind === "placedPlayer") values.push(item.playerName);
      }
    }
  }

  for (const dialogue of args.dialogues) values.push(dialogue.title, dialogue.playerName, dialogue.npcName);

  return values.map((value) => normalizeText(value).toLowerCase()).filter(Boolean).join(" ");
}

export function buildSceneListEntries(project: Project | null): SceneListSceneEntry[] {
  if (!project) return [];

  const itemNameById = createNameIndex(project.items);
  const npcNameById = createNameIndex(project.npcs);
  const playerNameById = createNameIndex(project.players);
  const musicNameById = createNameIndex(project.musicTracks);

  return (project.nodes ?? []).map((node, index) => {
    const title = fallbackSceneTitle(node, index);
    const map = buildMapSummary(project, node);
    const music = buildSceneMusicSummary(project, node, musicNameById);

    const layers = node.layers.map((layer, layerIndex) => buildLayerEntry(layer, layerIndex, { itemNameById, npcNameById, playerNameById, musicNameById }));

    const dialogues = (node.dialogues ?? []).map((dialogue) => buildDialogueEntry(dialogue, { playerNameById, npcNameById }));

    const searchText = buildSceneSearchText({ scene: { title }, map, music, layers, dialogues });

    return {
      id: node.id, title, searchText, isStart: Boolean(node.isStart), isFinal: Boolean(node.isFinal), layerCount: node.layers.length,
      dialogueCount: (node.dialogues ?? []).length, map, music, layers, dialogues
    }
  });
}
