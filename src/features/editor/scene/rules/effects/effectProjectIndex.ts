import type { Hotspot, ID, ItemInstance, Node, PlacedNpc, PlacedPlayer, Project, VarDef } from "@/domain/types";
import type { Option } from "@/components/Select";

export type OwnerVarKind = "boolean" | "number" | "unknown";
type MessageSpeakerKind = "narrator" | "player" | "npc";
type MessageSpeakerOptionId = "narrator" | `player:${ID}` | `npc:${ID}`;

type PlacedNpcContext = {
  nodeId: ID;
  layerId: ID;
  npc: PlacedNpc;
};

type PlacedPlayerContext = {
  nodeId: ID;
  layerId: ID;
  player: PlacedPlayer;
};

/* Índice de acceso rápido a entidades del proyecto para el editor de efectos */
export type ProjectIndex = {
  project: Project | null;

  getNode: (id: ID) => Node | null;
  getNodeLabel: (id: ID) => string;
  getNodeOptions: (opts?: { excludeNodeId?: ID }) => Option<ID>[];

  getHotspots: () => Hotspot[];
  getHotspotById: (hotspotId: ID) => Hotspot | null;
  getHotspotLabelById: (hotspotId: ID) => string;
  getHotspotOptionsAll: () => Option<ID>[];

  getNodeHotspots: (nodeId: ID) => Hotspot[];
  getHotspot: (nodeId: ID, hotspotId: ID) => Hotspot | null;
  getHotspotLabel: (nodeId: ID, hotspotId: ID) => string;
  getHotspotOptions: (nodeId: ID) => Option<ID>[];

  getHotspotVarDef: (nodeId: ID, hotspotId: ID, varId: ID) => VarDef | null;
  getHotspotVarLabel: (nodeId: ID, hotspotId: ID, varId: ID) => string;
  getHotspotVarOptions: (nodeId: ID, hotspotId: ID) => Option<ID>[];
  getHotspotVarKind: (nodeId: ID, hotspotId: ID, varId: ID) => OwnerVarKind;

  getPlacedItems: () => ItemInstance[];
  getPlacedItemLabel: (itemInstanceId: ID) => string;
  getPlacedItemOptions: () => Option<ID>[];

  getItemOptions: () => Option<ID>[];
  getItemLabel: (itemId: ID) => string;

  getGameItemOptions: () => Option<ID>[];
  getGameItemLabel: (itemInstanceId: ID) => string;
  isPlacedItemInstance: (itemInstanceId: ID) => boolean;
  hasGameItemLabel: (label: string, excludeItemInstanceId?: ID) => boolean;

  getPlayerInventoryItemOptions: () => Option<ID>[];
  getPlayerInventoryItemLabel: (itemInstanceId: ID) => string;
  getPlayerInventoryItemOptionsForPlayer: (playerId: ID) => Option<ID>[];
  getPlayerInventoryItemLabelForPlayer: (playerId: ID, itemInstanceId: ID) => string;

  getNpcInventoryItemOptions: (npcId: ID) => Option<ID>[];
  getNpcInventoryItemLabel: (npcId: ID, itemInstanceId: ID) => string;

  getCombinableInventoryItemOptions: (sourceItemInstanceId: ID) => Option<ID>[];

  getPlacedNpcs: () => PlacedNpc[];
  getPlacedNpcLabel: (npcId: ID) => string;
  getPlacedNpcOptions: () => Option<ID>[];
  getPlacedNpcNodeOptions: (npcId: ID) => Option<ID>[];
  getPlacedNpcLayerOptions: (npcId: ID, nodeId: ID) => Option<ID>[];
  getPlacedNpcContextLabel: (nodeId: ID, layerId: ID, npcId: ID) => string;

  getPlacedPlayers: () => PlacedPlayer[];
  getPlacedPlayerLabel: (playerId: ID) => string;
  getPlacedPlayerOptions: () => Option<ID>[];
  getPlacedPlayerNodeOptions: (playerId: ID) => Option<ID>[];
  getPlacedPlayerLayerOptions: (playerId: ID, nodeId: ID) => Option<ID>[];
  getPlacedPlayerContextLabel: (nodeId: ID, layerId: ID, playerId: ID) => string;
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

  getMessageSpeakerOptions: (input: { nodeId: ID; layerId?: ID | null }) => Option<MessageSpeakerOptionId>[];
  parseMessageSpeakerOption: (value: MessageSpeakerOptionId) => { speakerKind: MessageSpeakerKind; speakerId?: ID };
  formatMessageSpeakerOption: (input: { speakerKind: MessageSpeakerKind; speakerId?: ID }) => MessageSpeakerOptionId;
  getMessageSpeakerLabel: (input: { speakerKind: MessageSpeakerKind; speakerId?: ID }) => string;
};

/* Helpers */
function toOption(id: ID, label?: string): Option<ID> {
  return { id, label: label || id };
}

function normalizeLabel(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeComparableLabel(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function getEntityLabel(name: string | undefined, fallbackId: ID): string {
  return normalizeLabel(name) || fallbackId || "—";
}

function getVarKind(def: VarDef | null): OwnerVarKind {
  if (!def) return "unknown";
  return def.type === "boolean" ? "boolean" : "number";
}

function getVarLabel(def: VarDef | null, fallbackId: ID): string {
  return normalizeLabel(def?.name) || def?.id || fallbackId || "—";
}

function uniqueByKey<T>(items: T[], keyFn: (item: T) => ID): T[] {
  const map = new Map<ID, T>();

  for (const item of items)  map.set(keyFn(item), item);

  return Array.from(map.values());
}

function uniqueOptionsById<T extends string>(options: Option<T>[]): Option<T>[] {
  return Array.from(new Map(options.map((option) => [option.id, option] as const)).values());
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

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  const playerById = new Map(players.map((player) => [player.id, player] as const));
  const npcById = new Map(npcs.map((npc) => [npc.id, npc] as const));
  const mapById = new Map(maps.map((map) => [map.id, map] as const));
  const sfxById = new Map(sfx.map((entry) => [entry.id, entry] as const));
  const musicById = new Map(musicTracks.map((track) => [track.id, track] as const));

  const playerInventoryItems = players.flatMap((player) => player.initialInventory ?? []);
  const npcInventoryItems = npcs.flatMap((npc) => npc.initialInventory ?? []);
  const playerInventoryItemById = new Map(playerInventoryItems.map((item) => [item.itemInstanceId, item] as const));
  const playerInventoryItemsByPlayerId = new Map<ID, ItemInstance[]>(players.map((player) => [player.id, player.initialInventory ?? []]));
  const npcInventoryItemsByNpcId = new Map<ID, ItemInstance[]>(npcs.map((npc) => [npc.id, npc.initialInventory ?? []]));

  const placedItemsRaw: ItemInstance[] = [];
  const placedNpcsRaw: PlacedNpc[] = [];
  const placedPlayersRaw: PlacedPlayer[] = [];
  const placedNpcContextsRaw: PlacedNpcContext[] = [];
  const placedPlayerContextsRaw: PlacedPlayerContext[] = [];

  const hotspotsRaw: Hotspot[] = [];
  const hotspotsByNodeId = new Map<ID, Hotspot[]>();
  const hotspotByNodeAndId = new Map<string, Hotspot>();
  const dialoguesByNodeId = new Map<ID, NonNullable<Node["dialogues"]>>();

  for (const node of nodes) {
    const nodeHotspots: Hotspot[] = [];

    for (const layer of node.layers ?? []) {
      if (layer.hotspots) {
        nodeHotspots.push(...layer.hotspots);
        hotspotsRaw.push(...layer.hotspots);
      }

      if (layer.placedItems) placedItemsRaw.push(...layer.placedItems);

      if (layer.placedNpcs) {
        placedNpcsRaw.push(...layer.placedNpcs);

        for (const npc of layer.placedNpcs) {
          placedNpcContextsRaw.push({ nodeId: node.id, layerId: layer.id, npc });
        }
      }

      if (layer.placedPlayers) {
        placedPlayersRaw.push(...layer.placedPlayers);

        for (const player of layer.placedPlayers) {
          placedPlayerContextsRaw.push({ nodeId: node.id, layerId: layer.id, player });
        }
      }
    }

    const uniqueNodeHotspots = uniqueByKey(nodeHotspots, (hotspot) => hotspot.id);
    hotspotsByNodeId.set(node.id, uniqueNodeHotspots);

    for (const hotspot of uniqueNodeHotspots) hotspotByNodeAndId.set(`${node.id}::${hotspot.id}`, hotspot);

    dialoguesByNodeId.set(node.id, node.dialogues ?? []);
  }

  const hotspots = uniqueByKey(hotspotsRaw, (hotspot) => hotspot.id);
  const hotspotById = new Map(hotspots.map((hotspot) => [hotspot.id, hotspot] as const));

  const placedItems = uniqueByKey(placedItemsRaw, (item) => item.itemInstanceId);
  const placedItemById = new Map(placedItems.map((item) => [item.itemInstanceId, item] as const));

  const placedNpcs = uniqueByKey(placedNpcsRaw, (npc) => npc.npcId);
  const placedPlayers = uniqueByKey(placedPlayersRaw, (player) => player.playerId);

  const placedNpcContexts = uniqueByKey(placedNpcContextsRaw, (entry) => `${entry.nodeId}::${entry.layerId}::${entry.npc.npcId}`);

  const placedPlayerContexts = uniqueByKey(placedPlayerContextsRaw, (entry) => `${entry.nodeId}::${entry.layerId}::${entry.player.playerId}`);

  const gameItems = uniqueByKey([...playerInventoryItems, ...npcInventoryItems, ...placedItems], (item) => item.itemInstanceId);
  const gameItemByInstanceId = new Map(gameItems.map((item) => [item.itemInstanceId, item] as const));

  const getItemInstanceLabel = (item: ItemInstance | undefined, fallbackId: ID): string => {
    if (!item) return fallbackId || "—";

    const itemName = itemById.get(item.itemId)?.name;

    return (normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId || "—");
  };

  const getGameItemDisplayLabel = (itemInstanceId: ID): string => getItemInstanceLabel(gameItemByInstanceId.get(itemInstanceId), itemInstanceId);

  const toItemInstanceOption = (item: ItemInstance): Option<ID> => {
    const itemName = itemById.get(item.itemId)?.name;

    return toOption(item.itemInstanceId, normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId);
  };

  const nodeOptionsAll = nodes.map((node) => toOption(node.id, getEntityLabel(node.title, node.id)));
  const itemOptionsAll = items.map((item) => toOption(item.id, getEntityLabel(item.name, item.id)));
  const playerInventoryItemOptionsAll = uniqueOptionsById(playerInventoryItems.map(toItemInstanceOption));
  const placedItemOptionsAll = uniqueOptionsById(placedItems.map(toItemInstanceOption));
  const gameItemOptionsAll = uniqueOptionsById(gameItems.map(toItemInstanceOption));
  const hotspotOptionsAll = uniqueOptionsById(hotspots.map((hotspot) => toOption(hotspot.id, getEntityLabel(hotspot.label, hotspot.id))));

  const placedNpcOptionsAll = uniqueOptionsById(
    placedNpcs.map((placedNpc) => {
      const npcName = npcById.get(placedNpc.npcId)?.name;
      return toOption(placedNpc.npcId, getEntityLabel(npcName, placedNpc.npcId));
    }),
  );

  const placedPlayerOptionsAll = uniqueOptionsById(
    placedPlayers.map((placedPlayer) => {
      const playerName = playerById.get(placedPlayer.playerId)?.name;
      return toOption(placedPlayer.playerId, getEntityLabel(playerName, placedPlayer.playerId));
    }),
  );

  const playerOptionsAll = players.map((player) => toOption(player.id, getEntityLabel(player.name, player.id)));
  const npcOptionsAll = npcs.map((npc) => toOption(npc.id, getEntityLabel(npc.name, npc.id)));
  const sfxOptionsAll = sfx.map((entry) => toOption(entry.id, getEntityLabel(entry.name, entry.id)));
  const musicOptionsAll = musicTracks.map((track) => toOption(track.id, getEntityLabel(track.name, track.id)));
  const mapOptionsAll = maps.map((map) => toOption(map.id, getEntityLabel(map.name, map.id)));

  const getNode = (id: ID): Node | null => nodeById.get(id) ?? null;
  const getHotspots = (): Hotspot[] => hotspots;
  const getHotspotById = (hotspotId: ID): Hotspot | null => hotspotById.get(hotspotId) ?? null;
  const getNodeHotspots = (nodeId: ID): Hotspot[] => hotspotsByNodeId.get(nodeId) ?? [];
  const getHotspot = (nodeId: ID, hotspotId: ID): Hotspot | null => hotspotByNodeAndId.get(`${nodeId}::${hotspotId}`) ?? hotspotById.get(hotspotId) ?? null;

  const getPlacedItems = (): ItemInstance[] => placedItems;
  const getPlacedNpcs = (): PlacedNpc[] => placedNpcs;
  const getPlacedPlayers = (): PlacedPlayer[] => placedPlayers;

  const getHotspotOptions = (nodeId: ID): Option<ID>[] => uniqueOptionsById(getNodeHotspots(nodeId).map((hotspot) => toOption(hotspot.id, getEntityLabel(hotspot.label, hotspot.id))));

  const getHotspotVarDef = (nodeId: ID, hotspotId: ID, varId: ID): VarDef | null => {
    if (!hotspotId || !varId) return null;

    const hotspot = nodeId ? getHotspot(nodeId, hotspotId) : getHotspotById(hotspotId);

    return hotspot?.vars?.find((entry) => entry.id === varId) ?? null;
  };

  const getHotspotVarOptions = (nodeId: ID, hotspotId: ID): Option<ID>[] => {
    const hotspot = nodeId ? getHotspot(nodeId, hotspotId) : getHotspotById(hotspotId);

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

  const getNodeLayerLabel = (nodeId: ID, layerId: ID): string => {
    const node = nodeById.get(nodeId);
    const layer = node?.layers?.find((entry) => entry.id === layerId);

    const nodeLabel = getEntityLabel(node?.title, nodeId);
    const layerLabel = getEntityLabel(layer?.label, layerId);

    return `${nodeLabel} · ${layerLabel}`;
  };

  const getPlacedNpcNodeOptions = (npcId: ID): Option<ID>[] =>
    uniqueOptionsById(placedNpcContexts.filter((entry) => entry.npc.npcId === npcId).map((entry) =>
          toOption(entry.nodeId, getEntityLabel(nodeById.get(entry.nodeId)?.title, entry.nodeId))));

  const getPlacedNpcLayerOptions = (npcId: ID, nodeId: ID): Option<ID>[] => {
    const node = nodeById.get(nodeId);

    return uniqueOptionsById(placedNpcContexts.filter((entry) => entry.npc.npcId === npcId && entry.nodeId === nodeId).map((entry) => {
          const layer = node?.layers?.find((current) => current.id === entry.layerId);
          return toOption(entry.layerId, getEntityLabel(layer?.label, entry.layerId));
        }),
    );
  };

  const getPlacedPlayerNodeOptions = (playerId: ID): Option<ID>[] =>
    uniqueOptionsById(placedPlayerContexts.filter((entry) => entry.player.playerId === playerId).map((entry) =>
          toOption(entry.nodeId, getEntityLabel(nodeById.get(entry.nodeId)?.title, entry.nodeId))));

  const getPlacedPlayerLayerOptions = (playerId: ID, nodeId: ID): Option<ID>[] => {
    const node = nodeById.get(nodeId);

    return uniqueOptionsById(placedPlayerContexts.filter((entry) =>
            entry.player.playerId === playerId && entry.nodeId === nodeId).map((entry) => {
          const layer = node?.layers?.find((current) => current.id === entry.layerId);
          return toOption(entry.layerId, getEntityLabel(layer?.label, entry.layerId));
        }),
    );
  };

  const getCombinableInventoryItemOptions = (sourceItemInstanceId: ID): Option<ID>[] => {
    if (!sourceItemInstanceId) return [];

    return gameItemOptionsAll.filter((option) => option.id !== sourceItemInstanceId);
  };

  const getPlayerInventoryItemOptionsForPlayer = (playerId: ID): Option<ID>[] => {
    return (playerInventoryItemsByPlayerId.get(playerId) ?? []).map(toItemInstanceOption);
  };

  const getPlayerInventoryItemLabelForPlayer = (playerId: ID, itemInstanceId: ID): string => {
    const item = (playerInventoryItemsByPlayerId.get(playerId) ?? []).find((entry) => entry.itemInstanceId === itemInstanceId);

    return getItemInstanceLabel(item, itemInstanceId);
  };

  const getGameItemComparableLabel = (item: ItemInstance): string => {
    const itemName = itemById.get(item.itemId)?.name;

    return normalizeComparableLabel(normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId);
  };

  const hasGameItemLabel = (label: string, excludeItemInstanceId?: ID): boolean => {
    const normalized = normalizeComparableLabel(label);
    if (!normalized) return false;

    for (const [instanceId, item] of gameItemByInstanceId.entries()) {
      if (excludeItemInstanceId && instanceId === excludeItemInstanceId) continue;
      if (getGameItemComparableLabel(item) === normalized) return true;
    }

    return false;
  };

  const formatMessageSpeakerOption = (input: { speakerKind: MessageSpeakerKind; speakerId?: ID }): MessageSpeakerOptionId => {
    if (input.speakerKind === "player") return `player:${input.speakerId ?? ""}`;

    if (input.speakerKind === "npc") return `npc:${input.speakerId ?? ""}`;

    return "narrator";
  };

  const parseMessageSpeakerOption = (value: MessageSpeakerOptionId): { speakerKind: MessageSpeakerKind; speakerId?: ID } => {
    if (value === "narrator") return { speakerKind: "narrator" };

    const [kind, id] = value.split(":");

    if (kind === "player") return { speakerKind: "player", speakerId: id };
    if (kind === "npc") return { speakerKind: "npc", speakerId: id };

    return { speakerKind: "narrator" };
  };

  const getMessageSpeakerOptions = (input: { nodeId: ID; layerId?: ID | null }): Option<MessageSpeakerOptionId>[] => {
    const node = nodeById.get(input.nodeId);

    const layers = input.layerId ? (node?.layers ?? []).filter((layer) => layer.id === input.layerId) : (node?.layers ?? []);

    const playerSpeakerOptions: Option<MessageSpeakerOptionId>[] = layers.flatMap((layer) =>
        (layer.placedPlayers ?? []).map((placedPlayer) => {
          const playerName = playerById.get(placedPlayer.playerId)?.name;

          return { id: `player:${placedPlayer.playerId}` as const, label: `Player · ${getEntityLabel(playerName, placedPlayer.playerId)}` };
        }),
    );

    const npcSpeakerOptions: Option<MessageSpeakerOptionId>[] = layers.flatMap((layer) =>
        (layer.placedNpcs ?? []).map((placedNpc) => {
          const npcName = npcById.get(placedNpc.npcId)?.name;

          return { id: `npc:${placedNpc.npcId}` as const, label: `NPC · ${getEntityLabel(npcName, placedNpc.npcId)}` };
        }),
    );

    return uniqueOptionsById([{ id: "narrator", label: "Narrador" }, ...playerSpeakerOptions, ...npcSpeakerOptions ]);
  };

  const getMessageSpeakerLabel = (input: { speakerKind: MessageSpeakerKind; speakerId?: ID }): string => {
    if (input.speakerKind === "narrator") return "Narrador";
    if (!input.speakerId) return "—";

    if (input.speakerKind === "player") return `Player · ${getEntityLabel(playerById.get(input.speakerId)?.name, input.speakerId)}`;

    return `NPC · ${getEntityLabel(npcById.get(input.speakerId)?.name, input.speakerId)}`;
  };

  return {
    project,

    getNode,
    getNodeLabel: (id) => getEntityLabel(nodeById.get(id)?.title, id),
    getNodeOptions: (opts) => opts?.excludeNodeId ? nodeOptionsAll.filter((option) => option.id !== opts.excludeNodeId) : nodeOptionsAll,

    getHotspots,
    getHotspotById,
    getHotspotLabelById: (hotspotId) => {
      const hotspot = getHotspotById(hotspotId);
      return getEntityLabel(hotspot?.label, hotspot?.id || hotspotId);
    },
    getHotspotOptionsAll: () => hotspotOptionsAll,

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
    getPlacedItemLabel: (itemInstanceId) => getGameItemDisplayLabel(itemInstanceId),
    getPlacedItemOptions: () => placedItemOptionsAll,

    getItemOptions: () => itemOptionsAll,
    getItemLabel: (itemId) => getEntityLabel(itemById.get(itemId)?.name, itemId),

    isPlacedItemInstance: (itemInstanceId) => placedItemById.has(itemInstanceId),

    getGameItemOptions: () => gameItemOptionsAll,
    getGameItemLabel: (itemInstanceId) => getGameItemDisplayLabel(itemInstanceId),
    hasGameItemLabel,

    getPlayerInventoryItemOptions: () => playerInventoryItemOptionsAll,
    getPlayerInventoryItemLabel: (itemInstanceId) => getItemInstanceLabel(playerInventoryItemById.get(itemInstanceId), itemInstanceId),

    getPlayerInventoryItemOptionsForPlayer,
    getPlayerInventoryItemLabelForPlayer,

    getNpcInventoryItemOptions: (npcId) => (npcInventoryItemsByNpcId.get(npcId) ?? []).map(toItemInstanceOption),

    getNpcInventoryItemLabel: (npcId, itemInstanceId) => {
      const item = (npcInventoryItemsByNpcId.get(npcId) ?? []).find((entry) => entry.itemInstanceId === itemInstanceId);

      return getItemInstanceLabel(item, itemInstanceId);
    },

    getCombinableInventoryItemOptions,

    getPlacedNpcs,
    getPlacedNpcLabel: (npcId) => getEntityLabel(npcById.get(npcId)?.name, npcId),
    getPlacedNpcOptions: () => placedNpcOptionsAll,
    getPlacedNpcNodeOptions,
    getPlacedNpcLayerOptions,
    getPlacedNpcContextLabel: (nodeId, layerId, npcId) => {
      const npcName = getEntityLabel(npcById.get(npcId)?.name, npcId);
      return `${npcName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

    getPlacedPlayers,
    getPlacedPlayerLabel: (playerId) => getEntityLabel(playerById.get(playerId)?.name, playerId),
    getPlacedPlayerOptions: () => placedPlayerOptionsAll,
    getPlacedPlayerNodeOptions,
    getPlacedPlayerLayerOptions,
    getPlacedPlayerContextLabel: (nodeId, layerId, playerId) => {
      const playerName = getEntityLabel(playerById.get(playerId)?.name, playerId);
      return `${playerName} · ${getNodeLayerLabel(nodeId, layerId)}`;
    },

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

    getMessageSpeakerOptions,
    parseMessageSpeakerOption,
    formatMessageSpeakerOption,
    getMessageSpeakerLabel,
  };
}