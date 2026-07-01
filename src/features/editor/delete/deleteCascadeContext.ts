import type { ID, Project } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";

export type RemovedSceneSpeaker = {
  nodeId: ID;
  kind: "player" | "npc";
  id: ID;
};

export type DeleteCascadeContext = {
  removedItemInstanceIds: Set<ID>;
  removedHotspotIds: Set<ID>;
  removedDialogueIds: Set<ID>;
  removedSceneSpeaker?: RemovedSceneSpeaker;
  replacementPlayerImageId?: ID;
};

function createEmptyDeleteCascadeContext(): DeleteCascadeContext {
  return {
    removedItemInstanceIds: new Set<ID>(),
    removedHotspotIds: new Set<ID>(),
    removedDialogueIds: new Set<ID>(),
  };
}

export function buildDeleteCascadeContext(project: Project, target: DeleteTarget): DeleteCascadeContext {
  switch (target.kind) {
    case "player":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: collectPlayerInventoryItemInstanceIds(project, target.playerId),
        removedDialogueIds: collectDialogueIds(project, (dialogue) => dialogue.playerId === target.playerId),
      };

    case "playerImage":
      return {
        ...createEmptyDeleteCascadeContext(),
        replacementPlayerImageId: getReplacementPlayerImageId(project, target),
      };

    case "playerInventoryItem":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: new Set<ID>([target.itemInstanceId]),
      };

    case "npc":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: collectNpcInventoryItemInstanceIds(project, target.npcId),
        removedDialogueIds: collectDialogueIds(project, (dialogue) => dialogue.npcId === target.npcId),
      };

    case "npcInventoryItem":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: new Set<ID>([target.itemInstanceId]),
      };

    case "item":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: collectGlobalItemInstanceIds(project, target.itemId),
      };

    case "node":
      return {
        ...createEmptyDeleteCascadeContext(),
        ...collectNodeDeleteContext(project, target.nodeId),
      };

    case "layer":
      return {
        ...createEmptyDeleteCascadeContext(),
        ...collectLayerDeleteContext(project, target),
      };

    case "hotspot":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedHotspotIds: new Set<ID>([target.hotspotId]),
      };

    case "placedItem":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedItemInstanceIds: new Set<ID>([target.placedItemId]),
      };

    case "placedNpc":
      return {
        ...createEmptyDeleteCascadeContext(),
        ...collectPlacedNpcDeleteContext(project, target),
      };

    case "placedPlayer":
      return {
        ...createEmptyDeleteCascadeContext(),
        ...collectPlacedPlayerDeleteContext(project, target),
      };

    case "dialogue":
      return {
        ...createEmptyDeleteCascadeContext(),
        removedDialogueIds: new Set<ID>([target.dialogueId]),
      };

    case "playerVar":
    case "npcVar":
    case "music":
    case "sfx":
    case "map":
    case "mapRegion":
    case "nodeMapLocation":
    case "hotspotVar":
      return createEmptyDeleteCascadeContext();

    default:
      return assertNever(target);
  }
}

function collectPlayerInventoryItemInstanceIds(project: Project, playerId: ID): Set<ID> {
  const player = project.players.find((entry) => entry.id === playerId);

  return new Set<ID>((player?.initialInventory ?? []).map((item) => item.itemInstanceId));
}

function collectNpcInventoryItemInstanceIds(project: Project, npcId: ID): Set<ID> {
  const npc = project.npcs.find((entry) => entry.id === npcId);

  return new Set<ID>((npc?.initialInventory ?? []).map((item) => item.itemInstanceId));
}

function collectGlobalItemInstanceIds(project: Project, itemId: ID): Set<ID> {
  const playerItemInstanceIds = project.players.flatMap((player) =>
    (player.initialInventory ?? []).filter((item) => item.itemId === itemId).map((item) => item.itemInstanceId),
  );

  const npcItemInstanceIds = project.npcs.flatMap((npc) =>
    (npc.initialInventory ?? []).filter((item) => item.itemId === itemId).map((item) => item.itemInstanceId),
  );

  const sceneItemInstanceIds = project.nodes.flatMap((node) =>
    node.layers.flatMap((layer) => (layer.placedItems ?? []).filter((item) => item.itemId === itemId).map((item) => item.itemInstanceId)),
  );

  return new Set<ID>([ ...playerItemInstanceIds, ...npcItemInstanceIds, ...sceneItemInstanceIds ]);
}

function collectNodeDeleteContext(project: Project, nodeId: ID): Pick<DeleteCascadeContext, "removedItemInstanceIds" | "removedHotspotIds" | "removedDialogueIds"> {
  const node = project.nodes.find((entry) => entry.id === nodeId);

  const removedItemInstanceIds = new Set<ID>();
  const removedHotspotIds = new Set<ID>();
  const removedDialogueIds = new Set<ID>();

  if (!node) return { removedItemInstanceIds, removedHotspotIds, removedDialogueIds };

  for (const layer of node.layers ?? []) {
    for (const hotspot of layer.hotspots ?? []) removedHotspotIds.add(hotspot.id);

    for (const placedItem of layer.placedItems ?? []) removedItemInstanceIds.add(placedItem.itemInstanceId);
  }

  for (const dialogue of node.dialogues ?? []) removedDialogueIds.add(dialogue.id);

  return { removedItemInstanceIds, removedHotspotIds, removedDialogueIds };
}

function collectLayerDeleteContext(project: Project, input: { nodeId: ID; layerId: ID }): Pick<DeleteCascadeContext, "removedItemInstanceIds" | "removedHotspotIds" | "removedDialogueIds"> {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const removedItemInstanceIds = new Set<ID>();
  const removedHotspotIds = new Set<ID>();
  const removedDialogueIds = new Set<ID>();

  if (!node || !layer) return { removedItemInstanceIds, removedHotspotIds, removedDialogueIds };

  for (const hotspot of layer.hotspots ?? []) removedHotspotIds.add(hotspot.id);

  for (const placedItem of layer.placedItems ?? []) removedItemInstanceIds.add(placedItem.itemInstanceId);

  const removedNpcIds = new Set<ID>((layer.placedNpcs ?? []).map((placedNpc) => placedNpc.npcId));

  const removedPlayerIds = new Set<ID>((layer.placedPlayers ?? []).map((placedPlayer) => placedPlayer.playerId));

  const remainingLayers = node.layers.filter((currentLayer) => currentLayer.id !== input.layerId);

  for (const npcId of removedNpcIds) {
    const npcStillPlacedInNode = remainingLayers.some((currentLayer) => (currentLayer.placedNpcs ?? []).some((placedNpc) => placedNpc.npcId === npcId));

    if (npcStillPlacedInNode) continue;

    for (const dialogue of node.dialogues ?? []) {
      if (dialogue.npcId === npcId) removedDialogueIds.add(dialogue.id);
    }
  }

  for (const playerId of removedPlayerIds) {
    const playerStillPlacedInNode = remainingLayers.some((currentLayer) => (currentLayer.placedPlayers ?? []).some((placedPlayer) => placedPlayer.playerId === playerId));

    if (playerStillPlacedInNode) continue;

    for (const dialogue of node.dialogues ?? []) {
      if (dialogue.playerId === playerId) removedDialogueIds.add(dialogue.id);
    }
  }

  return { removedItemInstanceIds, removedHotspotIds, removedDialogueIds };
}

function collectPlacedNpcDeleteContext(project: Project, input: { nodeId: ID; layerId: ID; npcId: ID }): Pick<DeleteCascadeContext, "removedDialogueIds" | "removedSceneSpeaker"> {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const removedDialogueIds = new Set<ID>();

  const placedNpcExists = Boolean(layer?.placedNpcs?.some((placedNpc) => placedNpc.npcId === input.npcId));

  if (!node || !placedNpcExists) return { removedDialogueIds };

  const npcStillPlacedInNodeAfterDelete = node.layers.some((currentLayer) =>
    (currentLayer.placedNpcs ?? []).some((placedNpc) => {
      if (currentLayer.id === input.layerId && placedNpc.npcId === input.npcId) return false;

      return placedNpc.npcId === input.npcId;
    }),
  );

  if (npcStillPlacedInNodeAfterDelete) return { removedDialogueIds };

  for (const dialogue of node.dialogues ?? []) {
    if (dialogue.npcId === input.npcId) removedDialogueIds.add(dialogue.id);
  }

  return { removedDialogueIds, removedSceneSpeaker: { nodeId: input.nodeId, kind: "npc", id: input.npcId }};
}

function collectPlacedPlayerDeleteContext(project: Project, input: { nodeId: ID; layerId: ID; playerId: ID }): Pick<DeleteCascadeContext, "removedDialogueIds" | "removedSceneSpeaker"> {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const removedDialogueIds = new Set<ID>();

  const placedPlayerExists = Boolean(layer?.placedPlayers?.some((placedPlayer) => placedPlayer.playerId === input.playerId));

  if (!node || !placedPlayerExists) return { removedDialogueIds };

  const playerStillPlacedInNodeAfterDelete = node.layers.some((currentLayer) =>
    (currentLayer.placedPlayers ?? []).some((placedPlayer) => {
      if (currentLayer.id === input.layerId && placedPlayer.playerId === input.playerId) return false;

      return placedPlayer.playerId === input.playerId;
    }),
  );

  if (playerStillPlacedInNodeAfterDelete) return { removedDialogueIds };

  for (const dialogue of node.dialogues ?? []) {
    if (dialogue.playerId === input.playerId) removedDialogueIds.add(dialogue.id);
  }

  return { removedDialogueIds, removedSceneSpeaker: { nodeId: input.nodeId, kind: "player", id: input.playerId }};
}

export function collectDialogueIds(project: Project, predicate: (dialogue: NonNullable<Project["nodes"][number]["dialogues"]>[number]) => boolean): Set<ID> {
  const ids = new Set<ID>();

  for (const node of project.nodes) {
    for (const dialogue of node.dialogues ?? []) {
      if (predicate(dialogue)) ids.add(dialogue.id);
    }
  }

  return ids;
}

function getReplacementPlayerImageId(project: Project, input: { playerId: ID; imageId: ID }): ID | undefined {
  const player = project.players.find((entry) => entry.id === input.playerId);
  if (!player) return undefined;

  const remainingImages = player.images.filter((image) => image.id !== input.imageId);
  if (remainingImages.length === 0) return undefined;

  if (player.defaultImageId && player.defaultImageId !== input.imageId) return player.defaultImageId;

  return remainingImages[0]?.id;
}

function assertNever(value: never): never {
  throw new Error(`DeleteTarget no contemplado: ${JSON.stringify(value)}`);
}