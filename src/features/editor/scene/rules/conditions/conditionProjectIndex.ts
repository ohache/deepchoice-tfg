import type { ID, PlacedItem, Project, VarDef, Node, Hotspot, PlacedNpc, PlacedPlayer } from "@/domain/types";
import type { Option } from "@/components/Select";

export type VarOwnerKind = "player" | "npc" | "hotspot";

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

function toOption(id: ID, label?: string): Option<ID> {
  return { id, label: label || id };
}

export function createProjectIndex(project: Project | null): ProjectIndex {
  const nodes = project?.nodes ?? [];
  const items = project?.items ?? [];
  const players = project?.players ?? [];
  const npcs = project?.npcs ?? [];
  const maps = project?.maps ?? [];

  const placedItems: PlacedItem[] = [];
  const hotspots: Hotspot[] = [];
  const placedNpcs: PlacedNpc[] = [];
  const placedPlayers: PlacedPlayer[] = [];

  for (const node of nodes) {
    for (const layer of node.layers ?? []) {
      placedItems.push(...(layer.placedItems ?? []));
      hotspots.push(...(layer.hotspots ?? []));
      placedNpcs.push(...(layer.placedNpcs ?? []));
      placedPlayers.push(...(layer.placedPlayers ?? []));
    }
  }

  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
  const itemDefById = new Map(items.map((i) => [i.id, i] as const));
  const playerById = new Map(players.map((p) => [p.id, p] as const));
  const npcById = new Map(npcs.map((n) => [n.id, n] as const));
  const mapById = new Map(maps.map((m) => [m.id, m] as const));

  const placedItemById = new Map(placedItems.map((p) => [p.id, p] as const));
  const hotspotById = new Map(hotspots.map((h) => [h.id, h] as const));
  const placedNpcByNpcId = new Map(placedNpcs.map((p) => [p.npcId, p] as const));
  const placedPlayerByPlayerId = new Map(placedPlayers.map((p) => [p.playerId, p] as const));

  const nodeOptionsAll = nodes.map((n) => toOption(n.id, n.title || n.id));
  const placedItemOptionsAll = placedItems.map((p) => {
    const itemDefName = itemDefById.get(p.itemId)?.name;
    return toOption(p.id, p.label?.trim() || itemDefName || p.id);
  });
  const hotspotOptionsAll = hotspots.map((h) => toOption(h.id, h.label?.trim() || h.id));
  const placedNpcOptionsAll = placedNpcs.map((p) => {
    const npcName = npcById.get(p.npcId)?.name;
    return toOption(p.npcId, npcName || p.npcId);
  });
  const placedPlayerOptionsAll = placedPlayers.map((p) => {
    const playerName = playerById.get(p.playerId)?.name;
    return toOption(p.playerId, playerName || p.playerId);
  });

  const getNode = (id: ID) => nodeById.get(id) ?? null;

  const getPlacedItems = (): PlacedItem[] => placedItems;
  const getHotspots = (): Hotspot[] => hotspots;
  const getPlacedNpcs = (): PlacedNpc[] => placedNpcs;
  const getPlacedPlayers = (): PlacedPlayer[] => placedPlayers;

  const getVarOptions = (kind: VarOwnerKind, ownerId: ID) => {
    if (!project || !ownerId) return [];

    if (kind === "hotspot") {
      const hotspot = hotspotById.get(ownerId);
      return (hotspot?.vars ?? []).map((v) => ({ id: v.id, label: v.name || v.id }));
    }

    const owner = kind === "player" ? playerById.get(ownerId) : npcById.get(ownerId);
    return (owner?.vars ?? []).map((v) => ({ id: v.id, label: v.name || v.id }));
  };

  const getVarDef = (kind: VarOwnerKind, ownerId: ID, varId: ID) => {
    if (!project || !ownerId || !varId) return null;

    if (kind === "hotspot") {
      const hotspot = hotspotById.get(ownerId);
      return (hotspot?.vars ?? []).find((v) => v.id === varId) ?? null;
    }

    const owner = kind === "player" ? playerById.get(ownerId) : npcById.get(ownerId);
    return (owner?.vars ?? []).find((v) => v.id === varId) ?? null;
  };

  const getVarLabel = (kind: VarOwnerKind, ownerId: ID, varId: ID) => {
    if (!varId) return "—";
    const v = getVarDef(kind, ownerId, varId);
    return v?.name || v?.id || varId || "—";
  };

  const getMapRegionOptions = (mapId: ID): Option<ID>[] => {
    if (!mapId) return [];
    const map = mapById.get(mapId);
    return (map?.regions ?? []).map((r) => toOption(r.id, r.label || r.id));
  };

  const getMapRegionLabel = (mapId: ID, regionId: ID): string => {
    if (!mapId || !regionId) return "—";
    const map = mapById.get(mapId);
    const region = map?.regions?.find((r) => r.id === regionId);
    return region?.label || region?.id || regionId || "—";
  };

  const mapOptionsAll = maps.map((m) => toOption(m.id, m.name || m.id));
  const playerOptionsAll = players.map((p) => toOption(p.id, p.name || p.id));
  const npcOptionsAll = npcs.map((n) => toOption(n.id, n.name || n.id));

  return {
    project,

    getNode,
    getNodeLabel: (id) => nodeById.get(id)?.title || id || "—",
    getNodeOptions: (opts) =>
      opts?.excludeNodeId
        ? nodeOptionsAll.filter((n) => n.id !== opts.excludeNodeId)
        : nodeOptionsAll,

    getPlacedItems,
    getPlacedItemOptions: () => placedItemOptionsAll,
    getPlacedItemLabel: (placedItemId) => {
      const placed = placedItemById.get(placedItemId);
      if (!placed) return placedItemId || "—";
      const itemDefName = itemDefById.get(placed.itemId)?.name;
      return placed.label?.trim() || itemDefName || placed.id || placedItemId || "—";
    },

    getHotspots,
    getHotspotOptions: () => hotspotOptionsAll,
    getHotspotLabel: (hotspotId) => {
      const hotspot = hotspotById.get(hotspotId);
      return hotspot?.label?.trim() || hotspot?.id || hotspotId || "—";
    },

    getPlacedNpcs,
    getPlacedNpcOptions: () => placedNpcOptionsAll,
    getPlacedNpcLabel: (npcId) => {
      const placed = placedNpcByNpcId.get(npcId);
      const resolvedId = placed?.npcId ?? npcId;
      return npcById.get(resolvedId)?.name || resolvedId || "—";
    },

    getPlacedPlayers,
    getPlacedPlayerOptions: () => placedPlayerOptionsAll,
    getPlacedPlayerLabel: (playerId) => {
      const placed = placedPlayerByPlayerId.get(playerId);
      const resolvedId = placed?.playerId ?? playerId;
      return playerById.get(resolvedId)?.name || resolvedId || "—";
    },

    getPlayerLabel: (id) => playerById.get(id)?.name || id || "—",
    getNpcLabel: (id) => npcById.get(id)?.name || id || "—",
    getMapLabel: (id) => mapById.get(id)?.name || id || "—",

    getMapRegionOptions,
    getMapRegionLabel,

    getVarOptions,
    getVarDef,
    getVarLabel,

    getMapOptions: () => mapOptionsAll,
    getPlayerOptions: () => playerOptionsAll,
    getNpcOptions: () => npcOptionsAll,
  };
}