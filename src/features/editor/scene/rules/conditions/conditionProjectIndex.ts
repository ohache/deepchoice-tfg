import type { Hotspot, ID, ItemInstance, PlacedNpc, PlacedPlayer, Project, VarDef } from "@/domain/types";
import type { Option } from "@/components/Select";

type VarOwnerKind = "player" | "npc" | "hotspot";

type PlacedNpcContext = {
  nodeId: ID;
  nodeTitle: string;
  layerId: ID;
  layerLabel: string;
  npc: PlacedNpc;
};

type PlacedPlayerContext = {
  nodeId: ID;
  nodeTitle: string;
  layerId: ID;
  layerLabel: string;
  player: PlacedPlayer;
};

/* Helpers */
const toOption = (id: ID, label?: string): Option<ID> => ({ id, label: label || id });

function uniqueByKey<T>(items: T[], keyFn: (item: T) => ID): T[] {
  const map = new Map<ID, T>();

  for (const item of items) map.set(keyFn(item), item);

  return Array.from(map.values());
}

/* API del index */
export type ProjectIndex = {
  project: Project | null;

  getNodeLabel: (nodeId: ID) => string;
  getNodeOptions: (opts?: { excludeNodeId?: ID }) => Option<ID>[];

  getHotspots: () => Hotspot[];
  getHotspotOptions: () => Option<ID>[];
  getHotspotLabel: (hotspotId: ID) => string;

  getPlacedItems: () => ItemInstance[];
  getPlacedItemOptions: () => Option<ID>[];
  getPlacedItemLabel: (itemInstanceId: ID) => string;

  getPlacedNpcs: () => PlacedNpc[];
  getPlacedNpcNodeOptions: (npcId: ID) => Option<ID>[];
  getPlacedNpcLayerOptions: (npcId: ID, nodeId: ID) => Option<ID>[];
  getPlacedNpcContextLabel: (nodeId: ID, layerId: ID, npcId: ID) => string;

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerNodeOptions: (playerId: ID) => Option<ID>[];
  getPlacedPlayerLayerOptions: (playerId: ID, nodeId: ID) => Option<ID>[];
  getPlacedPlayerContextLabel: (nodeId: ID, layerId: ID, playerId: ID) => string;

  getPlayerOptions: () => Option<ID>[];
  getPlayerLabel: (playerId: ID) => string;
  getPlayerImageOptions: (playerId: ID) => Option<ID>[];
  getPlayerImageLabel: (playerId: ID, imageId: ID) => string;

  getNpcOptions: () => Option<ID>[];
  getNpcLabel: (npcId: ID) => string;

  getGameItemOptions: () => Option<ID>[];
  getGameItemLabel: (itemInstanceId: ID) => string;

  getMapOptions: () => Option<ID>[];
  getMapLabel: (mapId: ID) => string;
  getMapRegionOptions: (mapId: ID) => Option<ID>[];
  getMapRegionLabel: (mapId: ID, regionId: ID) => string;

  getMusicOptions: () => Option<ID>[];
  getMusicLabel: (trackId: ID) => string;

  getVarOptions: (kind: VarOwnerKind, ownerId: ID) => Option<ID>[];
  getVarDef: (kind: VarOwnerKind, ownerId: ID, varId: ID) => VarDef | null;
  getVarLabel: (kind: VarOwnerKind, ownerId: ID, varId: ID) => string;
};

/* Factory */
export function createProjectIndex(project: Project | null): ProjectIndex {
  const nodes = project?.nodes ?? [];
  const items = project?.items ?? [];
  const npcs = project?.npcs ?? [];
  const players = project?.players ?? [];
  const maps = project?.maps ?? [];
  const musicTracks = project?.musicTracks ?? [];

  const hotspotsRaw: Hotspot[] = [];
  const placedItemsRaw: ItemInstance[] = [];
  const placedNpcsRaw: PlacedNpc[] = [];
  const placedNpcContextsRaw: PlacedNpcContext[] = [];
  const placedPlayersRaw: PlacedPlayer[] = [];
  const placedPlayerContextsRaw: PlacedPlayerContext[] = [];

  for (const node of nodes) {
    for (const layer of node.layers ?? []) {
      if (layer.placedItems) placedItemsRaw.push(...layer.placedItems);
      if (layer.hotspots) hotspotsRaw.push(...layer.hotspots);

      if (layer.placedNpcs) {
        placedNpcsRaw.push(...layer.placedNpcs);

        for (const npc of layer.placedNpcs) {
          placedNpcContextsRaw.push({ nodeId: node.id, nodeTitle: node.title, layerId: layer.id, layerLabel: layer.label, npc });
        }
      }

      if (layer.placedPlayers) {
        placedPlayersRaw.push(...layer.placedPlayers);

        for (const player of layer.placedPlayers) {
          placedPlayerContextsRaw.push({ nodeId: node.id, nodeTitle: node.title, layerId: layer.id, layerLabel: layer.label, player });
        }
      }
    }
  }

  const hotspots = uniqueByKey(hotspotsRaw, (hotspot) => hotspot.id);
  const placedItems = uniqueByKey(placedItemsRaw, (item) => item.itemInstanceId);
  const placedNpcs = uniqueByKey(placedNpcsRaw, (npc) => npc.npcId);
  const placedPlayers = uniqueByKey(placedPlayersRaw, (player) => player.playerId);

  const placedNpcContexts = uniqueByKey(placedNpcContextsRaw, (entry) => `${entry.nodeId}::${entry.layerId}::${entry.npc.npcId}`);
  const placedPlayerContexts = uniqueByKey(placedPlayerContextsRaw, (entry) => `${entry.nodeId}::${entry.layerId}::${entry.player.playerId}`);

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const itemDefById = new Map(items.map((item) => [item.id, item]));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const npcById = new Map(npcs.map((npc) => [npc.id, npc]));
  const mapById = new Map(maps.map((map) => [map.id, map]));
  const musicById = new Map(musicTracks.map((track) => [track.id, track]));

  const placedItemById = new Map(placedItems.map((item) => [item.itemInstanceId, item]));
  const hotspotById = new Map(hotspots.map((hotspot) => [hotspot.id, hotspot]));

  const nodeOptions = nodes.map((node) => toOption(node.id, node.title || node.id));
  const hotspotOptions = hotspots.map((hotspot) => toOption(hotspot.id, hotspot.label?.trim() || hotspot.id));

  const placedItemOptions = placedItems.map((item) => {
    const def = itemDefById.get(item.itemId);
    return toOption(item.itemInstanceId, item.label?.trim() || def?.name || item.itemInstanceId);
  });

  const playerOptions = players.map((player) => toOption(player.id, player.name || player.id));
  const npcOptions = npcs.map((npc) => toOption(npc.id, npc.name || npc.id));
  const mapOptions = maps.map((map) => toOption(map.id, map.name || map.id));
  const musicOptions = musicTracks.map((track) => toOption(track.id, track.name || track.id));

  const playerInventoryItems = players.flatMap((player) => player.initialInventory ?? []);
  const npcInventoryItems = npcs.flatMap((npc) => npc.initialInventory ?? []);

  const gameItems = uniqueByKey([...playerInventoryItems, ...npcInventoryItems, ...placedItems], (item) => item.itemInstanceId);
  const gameItemById = new Map(gameItems.map((item) => [item.itemInstanceId, item]));

  const gameItemOptions = gameItems.map((item) => {
    const def = itemDefById.get(item.itemId);
    return toOption(item.itemInstanceId, item.label?.trim() || def?.name || item.itemInstanceId);
  });

  const getItemInstanceLabel = (item: ItemInstance | undefined, fallbackId: ID): string => {
    if (!item) return fallbackId || "—";

    return ( item.label?.trim() || itemDefById.get(item.itemId)?.name || item.itemInstanceId);
  };

  const getNodeLayerLabel = (nodeId: ID, layerId: ID): string => {
    const node = nodeById.get(nodeId);
    const layer = node?.layers?.find((current) => current.id === layerId);

    const nodeLabel = node?.title || nodeId || "—";
    const layerLabel = layer?.label || layerId || "—";

    return `${nodeLabel} · ${layerLabel}`;
  };

  const getPlacedNpcNodeOptions = (npcId: ID): Option<ID>[] => {
    const contexts = placedNpcContexts.filter((entry) => entry.npc.npcId === npcId);

    return uniqueByKey(contexts.map((entry) => toOption(entry.nodeId, entry.nodeTitle || entry.nodeId)), (option) => option.id);
  };

  const getPlacedNpcLayerOptions = (npcId: ID, nodeId: ID): Option<ID>[] => {
    const contexts = placedNpcContexts.filter((entry) => entry.npc.npcId === npcId && entry.nodeId === nodeId);

    return uniqueByKey(contexts.map((entry) => toOption(entry.layerId, entry.layerLabel || entry.layerId)), (option) => option.id);
  };

  const getPlacedPlayerNodeOptions = (playerId: ID): Option<ID>[] => {
    const contexts = placedPlayerContexts.filter((entry) => entry.player.playerId === playerId);

    return uniqueByKey(contexts.map((entry) => toOption(entry.nodeId, entry.nodeTitle || entry.nodeId)), (option) => option.id);
  };

  const getPlacedPlayerLayerOptions = (playerId: ID, nodeId: ID): Option<ID>[] => {
    const contexts = placedPlayerContexts.filter((entry) => entry.player.playerId === playerId && entry.nodeId === nodeId);

    return uniqueByKey(contexts.map((entry) => toOption(entry.layerId, entry.layerLabel || entry.layerId)), (option) => option.id);
  };

  return {
    project,

    getNodeLabel: (id) => nodeById.get(id)?.title || id || "—",
    getNodeOptions: (opts) => opts?.excludeNodeId ? nodeOptions.filter((node) => node.id !== opts.excludeNodeId) : nodeOptions,

    getHotspots: () => hotspots,
    getHotspotOptions: () => hotspotOptions,
    getHotspotLabel: (id) => hotspotById.get(id)?.label?.trim() || id || "—",

    getPlacedItems: () => placedItems,
    getPlacedItemOptions: () => placedItemOptions,
    getPlacedItemLabel: (id) => getItemInstanceLabel(placedItemById.get(id), id),

    getPlacedNpcs: () => placedNpcs,
    getPlacedNpcNodeOptions,
    getPlacedNpcLayerOptions,
    getPlacedNpcContextLabel: (nodeId, layerId, npcId) => {
      const npcName = npcById.get(npcId)?.name || npcId || "—";
      return `${npcName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

    getPlacedPlayers: () => placedPlayers,
    getPlacedPlayerNodeOptions,
    getPlacedPlayerLayerOptions,
    getPlacedPlayerContextLabel: (nodeId, layerId, playerId) => {
      const playerName = playerById.get(playerId)?.name || playerId || "—";
      return `${playerName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

    getPlayerOptions: () => playerOptions,
    getPlayerLabel: (id) => playerById.get(id)?.name || id || "—",
    getPlayerImageOptions: (playerId) => {
      const player = playerById.get(playerId);

      return player?.images?.map((image) => toOption(image.id, image.name || image.id)) ?? [];
    },

    getPlayerImageLabel: (playerId, imageId) => {
      const player = playerById.get(playerId);

      return ( player?.images?.find((image) => image.id === imageId)?.name || imageId || "—");
    },

    getNpcOptions: () => npcOptions,
    getNpcLabel: (id) => npcById.get(id)?.name || id || "—",

    getGameItemOptions: () => gameItemOptions,
    getGameItemLabel: (id) => getItemInstanceLabel(gameItemById.get(id), id),

    getMapOptions: () => mapOptions,
    getMapLabel: (id) => mapById.get(id)?.name || id || "—",
    getMapRegionOptions: (mapId) => mapById.get(mapId)?.regions?.map((region) => toOption(region.id, region.label || region.id)) ?? [],
    getMapRegionLabel: (mapId, regionId) => mapById.get(mapId)?.regions?.find((region) => region.id === regionId)?.label || regionId || "—",

    getMusicOptions: () => musicOptions,
    getMusicLabel: (id) => musicById.get(id)?.name || id || "—",

    getVarOptions: (kind, ownerId) => {
      if (!ownerId) return [];

      if (kind === "hotspot") return hotspotById.get(ownerId)?.vars?.map((variable) => toOption(variable.id, variable.name)) ?? [];

      const owner = kind === "player" ? playerById.get(ownerId) : npcById.get(ownerId);

      return owner?.vars?.map((variable) => toOption(variable.id, variable.name)) ?? [];
    },

    getVarDef: (kind, ownerId, varId) => {
      if (!ownerId || !varId) return null;

      if (kind === "hotspot") {
        return hotspotById.get(ownerId)?.vars?.find((variable) => variable.id === varId) ?? null;
      }

      const owner = kind === "player" ? playerById.get(ownerId) : npcById.get(ownerId);

      return owner?.vars?.find((variable) => variable.id === varId) ?? null;
    },

    getVarLabel: (kind, ownerId, varId) => {
      if (!varId) return "—";

      const vars = kind === "hotspot" ? hotspotById.get(ownerId)?.vars : kind === "player" ? playerById.get(ownerId)?.vars : npcById.get(ownerId)?.vars;

      return vars?.find((variable) => variable.id === varId)?.name || varId;
    },
  };
}