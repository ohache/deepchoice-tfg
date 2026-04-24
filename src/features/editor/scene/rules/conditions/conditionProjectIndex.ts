import type { ID, PlacedItem, Project, VarDef, Node, Hotspot, PlacedNpc, PlacedPlayer } from "@/domain/types";
import type { Option } from "@/components/Select";

export type VarOwnerKind = "player" | "npc" | "hotspot";

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

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerOptions: () => Option<ID>[];
  getPlacedPlayerLabel: (playerId: ID) => string;

  getPlayerLabel: (id: ID) => string;
  getNpcLabel: (id: ID) => string;
  getMapLabel: (id: ID) => string;

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

  for (const node of nodes) {
    for (const layer of node.layers ?? []) {
      if (layer.placedItems) placedItemsRaw.push(...layer.placedItems);
      if (layer.hotspots) hotspotsRaw.push(...layer.hotspots);
      if (layer.placedNpcs) placedNpcsRaw.push(...layer.placedNpcs);
      if (layer.placedPlayers) placedPlayersRaw.push(...layer.placedPlayers);
    }
  }

  const placedItems = uniqueByKey(placedItemsRaw, (x) => x.id);
  const hotspots = uniqueByKey(hotspotsRaw, (x) => x.id);
  const placedNpcs = uniqueByKey(placedNpcsRaw, (x) => x.npcId);
  const placedPlayers = uniqueByKey(placedPlayersRaw, (x) => x.playerId);

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

    getPlacedPlayers: () => placedPlayers,
    getPlacedPlayerOptions: () => placedPlayerOptions,
    getPlacedPlayerLabel: (id) => playerById.get(id)?.name || id || "—",

    getPlayerLabel: (id) => playerById.get(id)?.name || id || "—",
    getNpcLabel: (id) => npcById.get(id)?.name || id || "—",
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