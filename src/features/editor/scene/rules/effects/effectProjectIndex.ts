import type { Option } from "@/components/Select";
import type { Hotspot, ID, InventoryItemInstance, Node, PlacedItem, PlacedNpc, PlacedPlayer, Project, VarDef } from "@/domain/types";

export type OwnerVarKind = "boolean" | "number" | "unknown";
export type MessageSpeakerKind = "narrator" | "player" | "npc";
export type MessageSpeakerOptionId = "narrator" | `player:${ID}` | `npc:${ID}`;

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

  getPlacedItems: () => PlacedItem[];
  getPlacedItemLabel: (placedItemId: ID) => string;
  getPlacedItemOptions: () => Option<ID>[];

  getItemOptions: () => Option<ID>[];
  getItemLabel: (itemId: ID) => string;

  getGameItemOptions: () => Option<ID>[];
  getGameItemLabel: (itemInstanceId: ID) => string;
  isPlacedItemInstance: (itemInstanceId: ID) => boolean;
  hasGameItemLabel: (label: string, excludeItemInstanceId?: ID) => boolean;

  getPlayerInventoryItemOptions: () => Option<ID>[];
  getPlayerInventoryItemLabel: (itemInstanceId: ID) => string;

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
function uniqueOptionsById<T extends string>(options: Option<T>[]): Option<T>[] {
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

function normalizeComparableLabel(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
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

  const playerInventoryItems: InventoryItemInstance[] = players.flatMap((player) => player.initialInventory ?? []);
  const npcInventoryItems: InventoryItemInstance[] = npcs.flatMap((npc) => npc.initialInventory ?? []);

  const playerInventoryItemById = new Map(playerInventoryItems.map((item) => [item.itemInstanceId, item] as const));

  const npcInventoryItemsByNpcId = new Map<ID, InventoryItemInstance[]>(npcs.map((npc) => [npc.id, npc.initialInventory ?? []]));

  const placedItemsRaw: PlacedItem[] = [];
  const placedNpcsRaw: PlacedNpc[] = [];
  const placedPlayersRaw: PlacedPlayer[] = [];
  const placedNpcContextsRaw: { nodeId: ID; layerId: ID; npc: PlacedNpc }[] = [];
  const placedPlayerContextsRaw: { nodeId: ID; layerId: ID; player: PlacedPlayer }[] = [];

  const hotspotsByNodeId = new Map<ID, Hotspot[]>();
  const hotspotByNodeAndId = new Map<string, Hotspot>();
  const hotspotsRaw: Hotspot[] = [];
  const dialoguesByNodeId = new Map<ID, NonNullable<Node["dialogues"]>>();

  for (const node of nodes) {
    const nodeHotspots: Hotspot[] = [];
    const nodePlacedItems: PlacedItem[] = [];
    const nodePlacedNpcs: PlacedNpc[] = [];
    const nodePlacedPlayers: PlacedPlayer[] = [];

    for (const layer of node.layers ?? []) {
      if (layer.hotspots) {
        nodeHotspots.push(...layer.hotspots);
        hotspotsRaw.push(...layer.hotspots);
      }
      if (layer.placedItems) nodePlacedItems.push(...layer.placedItems);
      if (layer.placedNpcs) {
        nodePlacedNpcs.push(...layer.placedNpcs);

        for (const npc of layer.placedNpcs) {
          placedNpcContextsRaw.push({
            nodeId: node.id,
            layerId: layer.id,
            npc,
          });
        }
      }

      if (layer.placedPlayers) {
        nodePlacedPlayers.push(...layer.placedPlayers);

        for (const player of layer.placedPlayers) {
          placedPlayerContextsRaw.push({
            nodeId: node.id,
            layerId: layer.id,
            player,
          });
        }
      }
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

  const hotspots = uniqueById(hotspotsRaw);
  const hotspotById = new Map(hotspots.map((hotspot) => [hotspot.id, hotspot] as const));
  const placedItems = uniqueById(placedItemsRaw);
  const placedNpcs = Array.from(new Map(placedNpcsRaw.map((placedNpc) => [placedNpc.npcId, placedNpc] as const)).values());
  const placedPlayers = Array.from(new Map(placedPlayersRaw.map((placedPlayer) => [placedPlayer.playerId, placedPlayer] as const)).values());
  const placedNpcContexts = placedNpcContextsRaw;
  const placedPlayerContexts = placedPlayerContextsRaw;

  const gameItemByInstanceId = new Map<ID, InventoryItemInstance | PlacedItem>();

  for (const item of playerInventoryItems) {
    gameItemByInstanceId.set(item.itemInstanceId, item);
  }

  for (const item of npcInventoryItems) {
    gameItemByInstanceId.set(item.itemInstanceId, item);
  }

  for (const item of placedItems) {
    gameItemByInstanceId.set(item.id, item);
  }

  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
  const itemById = new Map(items.map((item) => [item.id, item] as const));
  const playerById = new Map(players.map((player) => [player.id, player] as const));
  const npcById = new Map(npcs.map((npc) => [npc.id, npc] as const));
  const mapById = new Map(maps.map((map) => [map.id, map] as const));
  const sfxById = new Map(sfx.map((entry) => [entry.id, entry] as const));
  const musicById = new Map(musicTracks.map((track) => [track.id, track] as const));

  const placedItemById = new Map(placedItems.map((placedItem) => [placedItem.id, placedItem] as const));

  const getGameItemDisplayLabel = (itemInstanceId: ID): string => {
    const item = gameItemByInstanceId.get(itemInstanceId);

    if (!item) return itemInstanceId || "—";

    if ("itemInstanceId" in item) {
      const itemName = itemById.get(item.itemId)?.name;
      return normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId || "—";
    }

    const itemName = itemById.get(item.itemId)?.name;
    return normalizeLabel(item.label) || normalizeLabel(itemName) || item.id || "—";
  };

  const nodeOptionsAll = nodes.map((node) => toOption(node.id, getEntityLabel(node.title, node.id)));

  const itemOptionsAll = items.map((item) => toOption(item.id, getEntityLabel(item.name, item.id)));

  const playerInventoryItemOptionsAll = uniqueOptionsById(
    playerInventoryItems.map((item) => {
      const itemName = itemById.get(item.itemId)?.name;
      return toOption(item.itemInstanceId, normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId);
    }),
  );

  const hotspotOptionsAll = uniqueOptionsById(
    hotspots.map((hotspot) =>
      toOption(hotspot.id, getEntityLabel(hotspot.label, hotspot.id))
    )
  );

  const placedItemOptionsAll = uniqueOptionsById(
    placedItems.map((placedItem) => {
      const itemName = itemById.get(placedItem.itemId)?.name;
      return toOption(placedItem.id, normalizeLabel(placedItem.label) || normalizeLabel(itemName) || placedItem.id);
    })
  );

  const npcInventoryItemOptionsAll = uniqueOptionsById(
    npcInventoryItems.map((item) => {
      const itemName = itemById.get(item.itemId)?.name;
      return toOption(item.itemInstanceId, normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId);
    }),
  );

  const gameItemOptionsAll = uniqueOptionsById([
    ...playerInventoryItemOptionsAll,
    ...npcInventoryItemOptionsAll,
    ...placedItemOptionsAll,
  ]);

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

  const getHotspots = (): Hotspot[] => hotspots;

  const getHotspotById = (hotspotId: ID): Hotspot | null => {
    return hotspotById.get(hotspotId) ?? null;
  };

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

  const getNodeLayerLabel = (nodeId: ID, layerId: ID): string => {
    const node = nodeById.get(nodeId);
    const layer = node?.layers?.find((entry) => entry.id === layerId);

    const nodeLabel = getEntityLabel(node?.title, nodeId);
    const layerLabel = getEntityLabel(layer?.label, layerId);

    return `${nodeLabel} · ${layerLabel}`;
  };

  const getPlacedNpcNodeOptions = (npcId: ID): Option<ID>[] => {
    return uniqueOptionsById(
      placedNpcContexts
        .filter((entry) => entry.npc.npcId === npcId)
        .map((entry) => toOption(entry.nodeId, getEntityLabel(nodeById.get(entry.nodeId)?.title, entry.nodeId))),
    );
  };

  const getPlacedNpcLayerOptions = (npcId: ID, nodeId: ID): Option<ID>[] => {
    const node = nodeById.get(nodeId);

    return uniqueOptionsById(
      placedNpcContexts
        .filter((entry) => entry.npc.npcId === npcId && entry.nodeId === nodeId)
        .map((entry) => {
          const layer = node?.layers?.find((current) => current.id === entry.layerId);
          return toOption(entry.layerId, getEntityLabel(layer?.label, entry.layerId));
        }),
    );
  };

  const getPlacedPlayerNodeOptions = (playerId: ID): Option<ID>[] => {
    return uniqueOptionsById(
      placedPlayerContexts
        .filter((entry) => entry.player.playerId === playerId)
        .map((entry) => toOption(entry.nodeId, getEntityLabel(nodeById.get(entry.nodeId)?.title, entry.nodeId))),
    );
  };

  const getPlacedPlayerLayerOptions = (playerId: ID, nodeId: ID): Option<ID>[] => {
    const node = nodeById.get(nodeId);

    return uniqueOptionsById(
      placedPlayerContexts
        .filter((entry) => entry.player.playerId === playerId && entry.nodeId === nodeId)
        .map((entry) => {
          const layer = node?.layers?.find((current) => current.id === entry.layerId);
          return toOption(entry.layerId, getEntityLabel(layer?.label, entry.layerId));
        }),
    );
  };

  const getCombinableInventoryItemOptions = (sourceItemInstanceId: ID): Option<ID>[] => {
    if (!sourceItemInstanceId) return [];

    return gameItemOptionsAll.filter((option) => option.id !== sourceItemInstanceId);
  };

  const getGameItemComparableLabel = (item: InventoryItemInstance | PlacedItem): string => {
    const itemId = "itemInstanceId" in item ? item.itemId : item.itemId;
    const itemName = itemById.get(itemId)?.name;

    return normalizeComparableLabel(
      normalizeLabel(item.label) || normalizeLabel(itemName) || ("itemInstanceId" in item ? item.itemInstanceId : item.id),
    );
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

  const formatMessageSpeakerOption = (input: {
    speakerKind: MessageSpeakerKind;
    speakerId?: ID;
  }): MessageSpeakerOptionId => {
    if (input.speakerKind === "player") return `player:${input.speakerId ?? ""}`;
    if (input.speakerKind === "npc") return `npc:${input.speakerId ?? ""}`;
    return "narrator";
  };

  const parseMessageSpeakerOption = (
    value: MessageSpeakerOptionId,
  ): { speakerKind: MessageSpeakerKind; speakerId?: ID } => {
    if (value === "narrator") return { speakerKind: "narrator" };

    const [kind, id] = value.split(":") as [MessageSpeakerKind, ID];

    if (kind === "player") return { speakerKind: "player", speakerId: id };
    if (kind === "npc") return { speakerKind: "npc", speakerId: id };

    return { speakerKind: "narrator" };
  };

  const getMessageSpeakerOptions = (input: {
    nodeId: ID;
    layerId?: ID | null;
  }): Option<MessageSpeakerOptionId>[] => {
    const node = nodeById.get(input.nodeId);
    const layers = input.layerId
      ? (node?.layers ?? []).filter((layer) => layer.id === input.layerId)
      : (node?.layers ?? []);

    const playerOptions = layers.flatMap((layer) =>
      (layer.placedPlayers ?? []).map((placedPlayer) => {
        const playerName = playerById.get(placedPlayer.playerId)?.name;

        return {
          id: `player:${placedPlayer.playerId}` as const,
          label: `Player · ${getEntityLabel(playerName, placedPlayer.playerId)}`,
        };
      }),
    );

    const npcOptions = layers.flatMap((layer) =>
      (layer.placedNpcs ?? []).map((placedNpc) => {
        const npcName = npcById.get(placedNpc.npcId)?.name;

        return {
          id: `npc:${placedNpc.npcId}` as const,
          label: `NPC · ${getEntityLabel(npcName, placedNpc.npcId)}`,
        };
      }),
    );

    return uniqueOptionsById([
      { id: "narrator", label: "Narrador" },
      ...playerOptions,
      ...npcOptions,
    ]);
  };

  const getMessageSpeakerLabel = (input: {
    speakerKind: MessageSpeakerKind;
    speakerId?: ID;
  }): string => {
    if (input.speakerKind === "narrator") return "Narrador";
    if (!input.speakerId) return "—";

    if (input.speakerKind === "player") {
      return `Player · ${getEntityLabel(playerById.get(input.speakerId)?.name, input.speakerId)}`;
    }

    return `NPC · ${getEntityLabel(npcById.get(input.speakerId)?.name, input.speakerId)}`;
  };

  /* API pública */
  return {
    project,

    getNode,
    getNodeLabel: (id) => getEntityLabel(nodeById.get(id)?.title, id),
    getNodeOptions: (opts) => opts?.excludeNodeId
      ? nodeOptionsAll.filter((option) => option.id !== opts.excludeNodeId)
      : nodeOptionsAll,

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
    getPlacedItemLabel: (placedItemId) => getGameItemDisplayLabel(placedItemId),
    getPlacedItemOptions: () => placedItemOptionsAll,

    getItemOptions: () => itemOptionsAll,

    getItemLabel: (itemId) => {
      const item = itemById.get(itemId);
      return getEntityLabel(item?.name, itemId);
    },

    isPlacedItemInstance: (itemInstanceId) => placedItemById.has(itemInstanceId),

    getGameItemOptions: () => gameItemOptionsAll,

    getGameItemLabel: (itemInstanceId) => getGameItemDisplayLabel(itemInstanceId),

    hasGameItemLabel,

    getPlayerInventoryItemOptions: () => playerInventoryItemOptionsAll,

    getPlayerInventoryItemLabel: (itemInstanceId) => {
      const item = playerInventoryItemById.get(itemInstanceId);
      if (!item) return itemInstanceId || "—";

      const itemName = itemById.get(item.itemId)?.name;
      return normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId || "—";
    },

    getNpcInventoryItemOptions: (npcId) => {
      const npcItems = npcInventoryItemsByNpcId.get(npcId) ?? [];

      return npcItems.map((item) => {
        const itemName = itemById.get(item.itemId)?.name;
        return toOption(
          item.itemInstanceId,
          normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId,
        );
      });
    },

    getNpcInventoryItemLabel: (npcId, itemInstanceId) => {
      const npcItems = npcInventoryItemsByNpcId.get(npcId) ?? [];
      const item = npcItems.find((entry) => entry.itemInstanceId === itemInstanceId);

      if (!item) return itemInstanceId || "—";

      const itemName = itemById.get(item.itemId)?.name;
      return normalizeLabel(item.label) || normalizeLabel(itemName) || item.itemInstanceId || "—";
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