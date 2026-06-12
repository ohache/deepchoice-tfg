import type { ID, InventoryItemInstance, PlacedItem, Project, VarDef, Node, Hotspot, PlacedNpc, PlacedPlayer } from "@/domain/types";
import type { Option } from "@/components/Select";

export type VarOwnerKind = "player" | "npc" | "hotspot";

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

/* API del index */
export type ProjectIndex = {
  project: Project | null;

  getNode: (id: ID) => Node | null;
  getNodeLabel: (id: ID) => string;
  getNodeOptions: (opts?: { excludeNodeId?: ID }) => Option<ID>[];

  getPlacedItems: () => PlacedItem[];
  getPlacedItemOptions: () => Option<ID>[];
  getPlacedItemLabel: (placedItemId: ID) => string;

  getHotspots: () => Hotspot[];
  getHotspotOptions: () => Option<ID>[];
  getHotspotLabel: (hotspotId: ID) => string;

  getPlacedNpcs: () => PlacedNpc[];
  getPlacedNpcOptions: () => Option<ID>[];
  getPlacedNpcLabel: (npcId: ID) => string;
  getPlacedNpcNodeOptions: (npcId: ID) => Option<ID>[];
  getPlacedNpcLayerOptions: (npcId: ID, nodeId: ID) => Option<ID>[];
  getPlacedNpcContextLabel: (nodeId: ID, layerId: ID, npcId: ID) => string;

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerOptions: () => Option<ID>[];
  getPlacedPlayerLabel: (playerId: ID) => string;
  getPlacedPlayerNodeOptions: (playerId: ID) => Option<ID>[];
  getPlacedPlayerLayerOptions: (playerId: ID, nodeId: ID) => Option<ID>[];
  getPlacedPlayerContextLabel: (nodeId: ID, layerId: ID, playerId: ID) => string;

  getPlayerLabel: (id: ID) => string;
  getPlayerImageOptions: (playerId: ID) => Option<ID>[];
  getPlayerImageLabel: (playerId: ID, imageId: ID) => string;

  getNpcLabel: (id: ID) => string;
  getMapLabel: (id: ID) => string;

  getPlayerInventoryItemOptions: () => Option<ID>[];
  getPlayerInventoryItemLabel: (itemInstanceId: ID) => string;

  getNpcInventoryItemOptions: (npcId: ID) => Option<ID>[];
  getNpcInventoryItemLabel: (npcId: ID, itemInstanceId: ID) => string;

  getGameItemOptions: () => Option<ID>[];
  getGameItemLabel: (itemInstanceId: ID) => string;

  getMapRegionOptions: (mapId: ID) => Option<ID>[];
  getMapRegionLabel: (mapId: ID, regionId: ID) => string;

  getVarOptions: (kind: VarOwnerKind, ownerId: ID) => { id: ID; label: string }[];
  getVarDef: (kind: VarOwnerKind, ownerId: ID, varId: ID) => VarDef | null;
  getVarLabel: (kind: VarOwnerKind, ownerId: ID, varId: ID) => string;

  getMapOptions: () => Option<ID>[];
  getPlayerOptions: () => Option<ID>[];
  getNpcOptions: () => Option<ID>[];
};

/* Helpers */
const toOption = (id: ID, label?: string): Option<ID> => ({ id, label: label || id });

function uniqueByKey<T>(items: T[], keyFn: (item: T) => ID): T[] {
  const map = new Map<ID, T>();
  for (const item of items) {
    map.set(keyFn(item), item);
  }
  return Array.from(map.values());
}

/* Factory */
export function createProjectIndex(project: Project | null): ProjectIndex {
  const nodes = project?.nodes ?? [];
  const items = project?.items ?? [];
  const players = project?.players ?? [];
  const npcs = project?.npcs ?? [];
  const maps = project?.maps ?? [];

  const placedItemsRaw: PlacedItem[] = [];
  const hotspotsRaw: Hotspot[] = [];
  const placedNpcsRaw: PlacedNpc[] = [];
  const placedPlayersRaw: PlacedPlayer[] = [];
  const placedNpcContextsRaw: PlacedNpcContext[] = [];
  const placedPlayerContextsRaw: PlacedPlayerContext[] = [];

  for (const node of nodes) {
    for (const layer of node.layers ?? []) {
      if (layer.placedItems) placedItemsRaw.push(...layer.placedItems);
      if (layer.hotspots) hotspotsRaw.push(...layer.hotspots);
      if (layer.placedNpcs) {
        placedNpcsRaw.push(...layer.placedNpcs);

        for (const npc of layer.placedNpcs) {
          placedNpcContextsRaw.push({
            nodeId: node.id,
            nodeTitle: node.title,
            layerId: layer.id,
            layerLabel: layer.label,
            npc,
          });
        }
      }

      if (layer.placedPlayers) {
        placedPlayersRaw.push(...layer.placedPlayers);

        for (const player of layer.placedPlayers) {
          placedPlayerContextsRaw.push({
            nodeId: node.id,
            nodeTitle: node.title,
            layerId: layer.id,
            layerLabel: layer.label,
            player,
          });
        }
      }
    }
  }

  const placedItems = uniqueByKey(placedItemsRaw, (x) => x.id);
  const hotspots = uniqueByKey(hotspotsRaw, (x) => x.id);
  const placedNpcs = uniqueByKey(placedNpcsRaw, (x) => x.npcId);
  const placedPlayers = uniqueByKey(placedPlayersRaw, (x) => x.playerId);
  const placedNpcContexts = uniqueByKey(
    placedNpcContextsRaw,
    (x) => `${x.nodeId}::${x.layerId}::${x.npc.npcId}`,
  );

  const placedPlayerContexts = uniqueByKey(
    placedPlayerContextsRaw,
    (x) => `${x.nodeId}::${x.layerId}::${x.player.playerId}`,
  );

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const itemDefById = new Map(items.map((i) => [i.id, i]));
  const playerById = new Map(players.map((p) => [p.id, p]));
  const npcById = new Map(npcs.map((n) => [n.id, n]));
  const mapById = new Map(maps.map((m) => [m.id, m]));

  const placedItemById = new Map(placedItems.map((p) => [p.id, p]));
  const hotspotById = new Map(hotspots.map((h) => [h.id, h]));

  const nodeOptions = nodes.map((n) => toOption(n.id, n.title || n.id));
  const mapOptions = maps.map((m) => toOption(m.id, m.name || m.id));
  const playerOptions = players.map((p) => toOption(p.id, p.name || p.id));
  const npcOptions = npcs.map((n) => toOption(n.id, n.name || n.id));


  const placedItemOptions = placedItems.map((p) => {
    const def = itemDefById.get(p.itemId);
    return toOption(p.id, p.label?.trim() || def?.name || p.id);
  });

  const hotspotOptions = hotspots.map((h) => toOption(h.id, h.label?.trim() || h.id));
  const placedNpcOptions = placedNpcs.map((p) => toOption(p.npcId, npcById.get(p.npcId)?.name || p.npcId));
  const placedPlayerOptions = placedPlayers.map((p) => toOption(p.playerId, playerById.get(p.playerId)?.name || p.playerId));

  const playerInventoryItems = players.flatMap((player) => player.initialInventory ?? []);

  const npcInventoryItemsByNpcId = new Map<ID, InventoryItemInstance[]>(
    npcs.map((npc) => [npc.id, npc.initialInventory ?? []]),
  );

  const npcInventoryItems = npcs.flatMap((npc) => npc.initialInventory ?? []);

  const placedItemsAsInventoryItems: InventoryItemInstance[] = placedItems.map((placedItem) => ({
    itemInstanceId: placedItem.id,
    itemId: placedItem.itemId,
    label: placedItem.label,
  }));

  const gameItems = uniqueByKey(
    [
      ...playerInventoryItems,
      ...npcInventoryItems,
      ...placedItemsAsInventoryItems,
    ],
    (item) => item.itemInstanceId,
  );

  const gameItemById = new Map(gameItems.map((item) => [item.itemInstanceId, item]));

  const playerInventoryItemById = new Map(
    playerInventoryItems.map((item) => [item.itemInstanceId, item]),
  );

  const gameItemOptions = gameItems.map((item) => {
    const def = itemDefById.get(item.itemId);
    return toOption(item.itemInstanceId, item.label?.trim() || def?.name || item.itemInstanceId);
  });

  const playerInventoryItemOptions = playerInventoryItems.map((item) => {
    const def = itemDefById.get(item.itemId);
    return toOption(item.itemInstanceId, item.label?.trim() || def?.name || item.itemInstanceId);
  });

  const getNodeLayerLabel = (nodeId: ID, layerId: ID): string => {
    const node = nodeById.get(nodeId);
    const layer = node?.layers?.find((current) => current.id === layerId);

    const nodeLabel = node?.title || nodeId || "—";
    const layerLabel = layer?.label || layerId || "—";

    return `${nodeLabel} · ${layerLabel}`;
  };

  const getPlacedNpcNodeOptions = (npcId: ID): Option<ID>[] => {
    const contexts = placedNpcContexts.filter((entry) => entry.npc.npcId === npcId);

    return uniqueByKey(
      contexts.map((entry) => toOption(entry.nodeId, entry.nodeTitle || entry.nodeId)),
      (option) => option.id,
    );
  };

  const getPlacedNpcLayerOptions = (npcId: ID, nodeId: ID): Option<ID>[] => {
    const contexts = placedNpcContexts.filter(
      (entry) => entry.npc.npcId === npcId && entry.nodeId === nodeId,
    );

    return uniqueByKey(
      contexts.map((entry) => toOption(entry.layerId, entry.layerLabel || entry.layerId)),
      (option) => option.id,
    );
  };

  const getPlacedPlayerNodeOptions = (playerId: ID): Option<ID>[] => {
    const contexts = placedPlayerContexts.filter((entry) => entry.player.playerId === playerId);

    return uniqueByKey(
      contexts.map((entry) => toOption(entry.nodeId, entry.nodeTitle || entry.nodeId)),
      (option) => option.id,
    );
  };

  const getPlacedPlayerLayerOptions = (playerId: ID, nodeId: ID): Option<ID>[] => {
    const contexts = placedPlayerContexts.filter(
      (entry) => entry.player.playerId === playerId && entry.nodeId === nodeId,
    );

    return uniqueByKey(
      contexts.map((entry) => toOption(entry.layerId, entry.layerLabel || entry.layerId)),
      (option) => option.id,
    );
  };

  return {
    project,

    getNode: (id) => nodeById.get(id) ?? null,

    getNodeLabel: (id) => nodeById.get(id)?.title || id || "—",

    getNodeOptions: (opts) => opts?.excludeNodeId
      ? nodeOptions.filter((n) => n.id !== opts.excludeNodeId)
      : nodeOptions,

    getPlacedItems: () => placedItems,
    getPlacedItemOptions: () => placedItemOptions,

    getPlacedItemLabel: (id) => {
      const p = placedItemById.get(id);
      if (!p) return id || "—";
      return p.label?.trim() || itemDefById.get(p.itemId)?.name || p.id;
    },

    getHotspots: () => hotspots,
    getHotspotOptions: () => hotspotOptions,
    getHotspotLabel: (id) => hotspotById.get(id)?.label?.trim() || id || "—",

    getPlacedNpcs: () => placedNpcs,
    getPlacedNpcOptions: () => placedNpcOptions,
    getPlacedNpcLabel: (id) => npcById.get(id)?.name || id || "—",
    getPlacedNpcNodeOptions,
    getPlacedNpcLayerOptions,
    getPlacedNpcContextLabel: (nodeId, layerId, npcId) => {
      const npcName = npcById.get(npcId)?.name || npcId || "—";
      return `${npcName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

    getPlacedPlayers: () => placedPlayers,
    getPlacedPlayerOptions: () => placedPlayerOptions,
    getPlacedPlayerLabel: (id) => playerById.get(id)?.name || id || "—",
    getPlacedPlayerNodeOptions,
    getPlacedPlayerLayerOptions,
    getPlacedPlayerContextLabel: (nodeId, layerId, playerId) => {
      const playerName = playerById.get(playerId)?.name || playerId || "—";
      return `${playerName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

    getPlayerLabel: (id) => playerById.get(id)?.name || id || "—",
    getPlayerImageOptions: (playerId) => {
      const player = playerById.get(playerId);
      return player?.images?.map((image) => toOption(image.id, image.name || image.id)) ?? [];
    },

    getPlayerImageLabel: (playerId, imageId) => {
      const player = playerById.get(playerId);
      return player?.images?.find((image) => image.id === imageId)?.name || imageId || "—";
    },
    
    getNpcLabel: (id) => npcById.get(id)?.name || id || "—",

    getPlayerInventoryItemOptions: () => playerInventoryItemOptions,
    getPlayerInventoryItemLabel: (itemInstanceId) => {
      const item = playerInventoryItemById.get(itemInstanceId);
      if (!item) return itemInstanceId || "—";

      return item.label?.trim() || itemDefById.get(item.itemId)?.name || item.itemInstanceId;
    },

    getNpcInventoryItemOptions: (npcId) => {
      const npcItems = npcInventoryItemsByNpcId.get(npcId) ?? [];

      return npcItems.map((item) => {
        const def = itemDefById.get(item.itemId);
        return toOption(item.itemInstanceId, item.label?.trim() || def?.name || item.itemInstanceId);
      });
    },

    getNpcInventoryItemLabel: (npcId, itemInstanceId) => {
      const npcItems = npcInventoryItemsByNpcId.get(npcId) ?? [];
      const item = npcItems.find((current) => current.itemInstanceId === itemInstanceId);

      if (!item) return itemInstanceId || "—";

      return item.label?.trim() || itemDefById.get(item.itemId)?.name || item.itemInstanceId;
    },

    getGameItemOptions: () => gameItemOptions,

    getGameItemLabel: (itemInstanceId) => {
      const item = gameItemById.get(itemInstanceId);
      if (!item) return itemInstanceId || "—";

      return item.label?.trim() || itemDefById.get(item.itemId)?.name || item.itemInstanceId;
    },

    getMapLabel: (id) => mapById.get(id)?.name || id || "—",
    getMapRegionOptions: (mapId) => mapById.get(mapId)?.regions?.map((r) => toOption(r.id, r.label || r.id)) ?? [],
    getMapRegionLabel: (mapId, regionId) => mapById.get(mapId)?.regions?.find((r) => r.id === regionId)?.label || regionId || "—",

    getVarOptions: (kind, ownerId) => {
      if (!ownerId) return [];

      if (kind === "hotspot") return hotspotById.get(ownerId)?.vars?.map(v => ({ id: v.id, label: v.name })) ?? [];

      const owner = kind === "player"
        ? playerById.get(ownerId)
        : npcById.get(ownerId);

      return owner?.vars?.map(v => ({ id: v.id, label: v.name })) ?? [];
    },

    getVarDef: (kind, ownerId, varId) => {
      if (!ownerId || !varId) return null;

      if (kind === "hotspot") return hotspotById.get(ownerId)?.vars?.find(v => v.id === varId) ?? null;

      const owner = kind === "player"
        ? playerById.get(ownerId)
        : npcById.get(ownerId);

      return owner?.vars?.find(v => v.id === varId) ?? null;
    },

    getVarLabel: (kind, ownerId, varId) => {
      if (!varId) return "—";
      return (
        (kind === "hotspot"
          ? hotspotById.get(ownerId)?.vars
          : kind === "player"
            ? playerById.get(ownerId)?.vars
            : npcById.get(ownerId)?.vars
        )?.find(v => v.id === varId)?.name || varId
      );
    },

    getMapOptions: () => mapOptions,
    getPlayerOptions: () => playerOptions,
    getNpcOptions: () => npcOptions,
  };
}