import type { Option } from "@/components/Select";
import type { Hotspot, ID, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, VarDef } from "@/domain/types";

export type OwnerVarKind = "boolean" | "number" | "unknown";

/* Índice de acceso rápido a entidades del proyecto para el editor de efectos */
export type ProjectIndex = {
  project: Project | null;

  getNode: (id: ID) => Node | null;
  getNodeLabel: (id: ID) => string;
  getNodeOptions: (opts?: { excludeNodeId?: ID }) => Option<ID>[];

  getNodeHotspots: (nodeId: ID) => Hotspot[];
  getHotspot: (nodeId: ID, hotspotId: ID) => Hotspot | null;
  getHotspotLabel: (nodeId: ID, hotspotId: ID) => string;
  getHotspotOptions: (nodeId: ID) => Option<ID>[];
  getHotspotVarDef: (nodeId: ID, hotspotId: ID, varId: ID) => VarDef | null;
  getHotspotVarLabel: (nodeId: ID, hotspotId: ID, varId: ID) => string;
  getHotspotVarOptions: (nodeId: ID, hotspotId: ID) => Option<ID>[];
  getHotspotVarKind: (nodeId: ID, hotspotId: ID, varId: ID) => OwnerVarKind;

  getPlacedItems: () => PlacedItem[];
  getPlacedItemLabel: (placedItemId: ID) => string;
  getPlacedItemOptions: () => Option<ID>[];

  getPlacedNpcs: () => PlacedNpc[];
  getPlacedNpcLabel: (npcId: ID) => string;
  getPlacedNpcOptions: () => Option<ID>[];

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerLabel: (playerId: ID) => string;
  getPlacedPlayerOptions: () => Option<ID>[];
  getPlayerImageOptions: (playerId: ID) => Option<ID>[];
  getPlayerImageLabel: (playerId: ID, imageId: ID) => string;

  getPlayerLabel: (playerId: ID) => string;
  getPlayerOptions: () => Option<ID>[];
  getPlayerVarDef: (playerId: ID, varId: ID) => VarDef | null;
  getPlayerVarLabel: (playerId: ID, varId: ID) => string;
  getPlayerVarOptions: (playerId: ID) => Option<ID>[];
  getPlayerVarKind: (playerId: ID, varId: ID) => OwnerVarKind;

  getNpcLabel: (npcId: ID) => string;
  getNpcOptions: () => Option<ID>[];
  getNpcVarDef: (npcId: ID, varId: ID) => VarDef | null;
  getNpcVarLabel: (npcId: ID, varId: ID) => string;
  getNpcVarOptions: (npcId: ID) => Option<ID>[];
  getNpcVarKind: (npcId: ID, varId: ID) => OwnerVarKind;

  getDialogueOptions: (nodeId: ID) => Option<ID>[];
  getDialogueLabel: (nodeId: ID, dialogueId: ID) => string;

  getSfxOptions: () => Option<ID>[];
  getSfxLabel: (sfxId: ID) => string;

  getMusicOptions: () => Option<ID>[];
  getMusicLabel: (trackId: ID) => string;

  getMapOptions: () => Option<ID>[];
  getMapLabel: (mapId: ID) => string;
  getMapRegionOptions: (mapId: ID) => Option<ID>[];
  getMapRegionLabel: (mapId: ID, regionId: ID) => string;
};


function toOption(id: ID, label?: string): Option<ID> {
  return { id, label: label || id };
}

function normalizeLabel(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/* Elimina duplicados por id manteniendo la última ocurrencia */
function uniqueById<T extends { id: ID }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item] as const)).values());
}

/* Elimina duplicados en opciones por id */
function uniqueOptionsById(options: Option<ID>[]): Option<ID>[] {
  return Array.from(new Map(options.map((option) => [option.id, option] as const)).values());
}

function getVarKind(def: VarDef | null): OwnerVarKind {
  if (!def) return "unknown";
  return def.type === "boolean" ? "boolean" : "number";
}

function getVarLabel(def: VarDef | null, fallbackId: ID): string {
  return normalizeLabel(def?.name) || def?.id || fallbackId || "—";
}

function getEntityLabel(name: string | undefined, fallbackId: ID): string {
  return normalizeLabel(name) || fallbackId || "—";
}

/* Factory */
export function createProjectIndex(project: Project | null): ProjectIndex {
  const nodes = project?.nodes ?? [];
  const items = project?.items ?? [];
  const players = project?.players ?? [];
  const npcs = project?.npcs ?? [];
  const maps = project?.maps ?? [];
  const sfx = project?.soundEffects ?? [];
  const musicTracks = project?.musicTracks ?? [];

  const placedItemsRaw: PlacedItem[] = [];
  const placedNpcsRaw: PlacedNpc[] = [];
  const placedPlayersRaw: PlacedPlayer[] = [];

  const hotspotsByNodeId = new Map<ID, Hotspot[]>();
  const hotspotByNodeAndId = new Map<string, Hotspot>();
  const dialoguesByNodeId = new Map<ID, NonNullable<Node["dialogues"]>>();

  for (const node of nodes) {
    const nodeHotspots: Hotspot[] = [];
    const nodePlacedItems: PlacedItem[] = [];
    const nodePlacedNpcs: PlacedNpc[] = [];
    const nodePlacedPlayers: PlacedPlayer[] = [];

    for (const layer of node.layers ?? []) {
      if (layer.hotspots) nodeHotspots.push(...layer.hotspots);
      if (layer.placedItems) nodePlacedItems.push(...layer.placedItems);
      if (layer.placedNpcs) nodePlacedNpcs.push(...layer.placedNpcs);
      if (layer.placedPlayers) nodePlacedPlayers.push(...layer.placedPlayers);
    }

    const uniqueHotspots = uniqueById(nodeHotspots);
    hotspotsByNodeId.set(node.id, uniqueHotspots);

    for (const hotspot of uniqueHotspots) {
      hotspotByNodeAndId.set(`${node.id}::${hotspot.id}`, hotspot);
    }

    dialoguesByNodeId.set(node.id, node.dialogues ?? []);

    placedItemsRaw.push(...nodePlacedItems);
    placedNpcsRaw.push(...nodePlacedNpcs);
    placedPlayersRaw.push(...nodePlacedPlayers);
  }

  const placedItems = uniqueById(placedItemsRaw);
  const placedNpcs = Array.from(new Map(placedNpcsRaw.map((placedNpc) => [placedNpc.npcId, placedNpc] as const)).values());
  const placedPlayers = Array.from(new Map(placedPlayersRaw.map((placedPlayer) => [placedPlayer.playerId, placedPlayer] as const)).values());

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  const playerById = new Map(players.map((player) => [player.id, player] as const));
  const npcById = new Map(npcs.map((npc) => [npc.id, npc] as const));
  const mapById = new Map(maps.map((map) => [map.id, map] as const));
  const sfxById = new Map(sfx.map((entry) => [entry.id, entry] as const));
  const musicById = new Map(musicTracks.map((track) => [track.id, track] as const));

  const placedItemById = new Map(placedItems.map((placedItem) => [placedItem.id, placedItem] as const));

  const nodeOptionsAll = nodes.map((node) => toOption(node.id, getEntityLabel(node.title, node.id)));

  const placedItemOptionsAll = uniqueOptionsById(
    placedItems.map((placedItem) => {
      const itemName = itemById.get(placedItem.itemId)?.name;
      return toOption(placedItem.id, normalizeLabel(placedItem.label) || normalizeLabel(itemName) || placedItem.id);
    })
  );

  const placedNpcOptionsAll = uniqueOptionsById(
    placedNpcs.map((placedNpc) => {
      const npcName = npcById.get(placedNpc.npcId)?.name;
      return toOption(placedNpc.npcId, getEntityLabel(npcName, placedNpc.npcId));
    })
  );

  const placedPlayerOptionsAll = uniqueOptionsById(
    placedPlayers.map((placedPlayer) => {
      const playerName = playerById.get(placedPlayer.playerId)?.name;
      return toOption(placedPlayer.playerId, getEntityLabel(playerName, placedPlayer.playerId));
    })
  );

  const playerOptionsAll = players.map((player) => toOption(player.id, getEntityLabel(player.name, player.id)));
  const npcOptionsAll = npcs.map((npc) => toOption(npc.id, getEntityLabel(npc.name, npc.id)));
  const sfxOptionsAll = sfx.map((entry) => toOption(entry.id, getEntityLabel(entry.name, entry.id)));
  const musicOptionsAll = musicTracks.map((track) => toOption(track.id, getEntityLabel(track.name, track.id)));
  const mapOptionsAll = maps.map((map) => toOption(map.id, getEntityLabel(map.name, map.id)));

  const getNode = (id: ID): Node | null => nodeById.get(id) ?? null;
  const getNodeHotspots = (nodeId: ID): Hotspot[] => hotspotsByNodeId.get(nodeId) ?? [];
  const getHotspot = (nodeId: ID, hotspotId: ID): Hotspot | null => hotspotByNodeAndId.get(`${nodeId}::${hotspotId}`) ?? null;
  const getPlacedItems = (): PlacedItem[] => placedItems;
  const getPlacedNpcs = (): PlacedNpc[] => placedNpcs;
  const getPlacedPlayers = (): PlacedPlayer[] => placedPlayers;

  const getHotspotOptions = (nodeId: ID): Option<ID>[] =>
    uniqueOptionsById(getNodeHotspots(nodeId).map((hotspot) => toOption(hotspot.id, getEntityLabel(hotspot.label, hotspot.id)))
    );

  const getHotspotVarDef = (nodeId: ID, hotspotId: ID, varId: ID): VarDef | null => {
    if (!nodeId || !hotspotId || !varId) return null;
    return getHotspot(nodeId, hotspotId)?.vars?.find((entry) => entry.id === varId) ?? null;
  };

  const getHotspotVarOptions = (nodeId: ID, hotspotId: ID): Option<ID>[] => {
    const hotspot = getHotspot(nodeId, hotspotId);
    return (hotspot?.vars ?? []).map((entry) => toOption(entry.id, getEntityLabel(entry.name, entry.id)));
  };

  const getPlayerVarDef = (playerId: ID, varId: ID): VarDef | null => {
    if (!playerId || !varId) return null;
    return playerById.get(playerId)?.vars?.find((entry) => entry.id === varId) ?? null;
  };

  const getPlayerVarOptions = (playerId: ID): Option<ID>[] => {
    const player = playerById.get(playerId);
    return (player?.vars ?? []).map((entry) => toOption(entry.id, getEntityLabel(entry.name, entry.id)));
  };

  const getNpcVarDef = (npcId: ID, varId: ID): VarDef | null => {
    if (!npcId || !varId) return null;
    return npcById.get(npcId)?.vars?.find((entry) => entry.id === varId) ?? null;
  };

  const getNpcVarOptions = (npcId: ID): Option<ID>[] => {
    const npc = npcById.get(npcId);
    return (npc?.vars ?? []).map((entry) => toOption(entry.id, getEntityLabel(entry.name, entry.id)));
  };

  const getDialogueOptions = (nodeId: ID): Option<ID>[] => {
    const dialogues = dialoguesByNodeId.get(nodeId) ?? [];
    return dialogues.map((dialogue) => toOption(dialogue.id, getEntityLabel(dialogue.title, dialogue.id)));
  };

  const getMapRegionOptions = (mapId: ID): Option<ID>[] => {
    const map = mapById.get(mapId);
    return (map?.regions ?? []).map((region) => toOption(region.id, getEntityLabel(region.label, region.id)));
  };

  const getPlayerImageOptions = (playerId: ID): Option<ID>[] => {
    const player = playerById.get(playerId);
    return (player?.images ?? []).map((image) => toOption(image.id, getEntityLabel(image.name, image.id)));
  };

  /* API pública */

  return {
    project,

    getNode,
    getNodeLabel: (id) => getEntityLabel(nodeById.get(id)?.title, id),
    getNodeOptions: (opts) => opts?.excludeNodeId
      ? nodeOptionsAll.filter((option) => option.id !== opts.excludeNodeId)
      : nodeOptionsAll,

    getNodeHotspots,
    getHotspot,
    getHotspotLabel: (nodeId, hotspotId) => {
      const hotspot = getHotspot(nodeId, hotspotId);
      return getEntityLabel(hotspot?.label, hotspot?.id || hotspotId);
    },
    getHotspotOptions,
    getHotspotVarDef,
    getHotspotVarLabel: (nodeId, hotspotId, varId) => getVarLabel(getHotspotVarDef(nodeId, hotspotId, varId), varId),
    getHotspotVarOptions,
    getHotspotVarKind: (nodeId, hotspotId, varId) => getVarKind(getHotspotVarDef(nodeId, hotspotId, varId)),

    getPlacedItems,
    getPlacedItemLabel: (placedItemId) => {
      const placedItem = placedItemById.get(placedItemId);
      if (!placedItem) return placedItemId || "—";

      const itemName = itemById.get(placedItem.itemId)?.name;
      return (normalizeLabel(placedItem.label) || normalizeLabel(itemName) || placedItem.id || placedItemId || "—");
    },
    getPlacedItemOptions: () => placedItemOptionsAll,

    getPlacedNpcs,
    getPlacedNpcLabel: (npcId) => getEntityLabel(npcById.get(npcId)?.name, npcId),
    getPlacedNpcOptions: () => placedNpcOptionsAll,

    getPlacedPlayers,
    getPlacedPlayerLabel: (playerId) => getEntityLabel(playerById.get(playerId)?.name, playerId),
    getPlacedPlayerOptions: () => placedPlayerOptionsAll,
    getPlayerImageOptions,
    getPlayerImageLabel: (playerId, imageId) => {
      const player = playerById.get(playerId);
      const image = player?.images?.find((entry) => entry.id === imageId);
      return getEntityLabel(image?.name, image?.id || imageId);
    },

    getPlayerLabel: (playerId) => getEntityLabel(playerById.get(playerId)?.name, playerId),
    getPlayerOptions: () => playerOptionsAll,
    getPlayerVarDef,
    getPlayerVarLabel: (playerId, varId) => getVarLabel(getPlayerVarDef(playerId, varId), varId),
    getPlayerVarOptions,
    getPlayerVarKind: (playerId, varId) => getVarKind(getPlayerVarDef(playerId, varId)),

    getNpcLabel: (npcId) => getEntityLabel(npcById.get(npcId)?.name, npcId),
    getNpcOptions: () => npcOptionsAll,
    getNpcVarDef,
    getNpcVarLabel: (npcId, varId) => getVarLabel(getNpcVarDef(npcId, varId), varId),
    getNpcVarOptions,
    getNpcVarKind: (npcId, varId) => getVarKind(getNpcVarDef(npcId, varId)),

    getDialogueOptions,
    getDialogueLabel: (nodeId, dialogueId) => {
      const dialogue = (dialoguesByNodeId.get(nodeId) ?? []).find((entry) => entry.id === dialogueId);
      return getEntityLabel(dialogue?.title, dialogue?.id || dialogueId);
    },

    getSfxOptions: () => sfxOptionsAll,
    getSfxLabel: (sfxId) => getEntityLabel(sfxById.get(sfxId)?.name, sfxId),

    getMusicOptions: () => musicOptionsAll,
    getMusicLabel: (trackId) => getEntityLabel(musicById.get(trackId)?.name, trackId),

    getMapOptions: () => mapOptionsAll,
    getMapLabel: (mapId) => getEntityLabel(mapById.get(mapId)?.name, mapId),
    getMapRegionOptions,
    getMapRegionLabel: (mapId, regionId) => {
      const map = mapById.get(mapId);
      const region = map?.regions?.find((entry) => entry.id === regionId);
      return getEntityLabel(region?.label, region?.id || regionId);
    },
  };
}