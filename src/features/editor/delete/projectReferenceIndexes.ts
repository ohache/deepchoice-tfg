import type { ID, Project } from "@/domain/types";

export type PlacementKeyInput = {
  nodeId: ID;
  layerId: ID;
  ownerId: ID;
};

export function makePlacementKey(input: PlacementKeyInput): string {
  return `${input.nodeId}::${input.layerId}::${input.ownerId}`;
}

export function buildProjectReferenceIndexes(project: Project) {
  const nodeIds = new Set(project.nodes.map((node) => node.id));
  const layerIdsByNodeId = new Map<ID, Set<ID>>();

  const playerIds = new Set(project.players.map((player) => player.id));
  const npcIds = new Set(project.npcs.map((npc) => npc.id));
  const itemIds = new Set(project.items.map((item) => item.id));
  const musicIds = new Set(project.musicTracks.map((track) => track.id));
  const sfxIds = new Set(project.soundEffects.map((sfx) => sfx.id));
  const mapIds = new Set(project.maps.map((map) => map.id));
  const assetIds = new Set(project.assets.map((asset) => asset.id));

  const playerImageIdsByPlayerId = new Map<ID, Set<ID>>();
  const playerVarIdsByPlayerId = new Map<ID, Set<ID>>();
  const npcVarIdsByNpcId = new Map<ID, Set<ID>>();

  for (const player of project.players) {
    playerImageIdsByPlayerId.set(player.id, new Set(player.images.map((image) => image.id)));

    playerVarIdsByPlayerId.set(player.id, new Set((player.vars ?? []).map((variable) => variable.id)));
  }

  for (const npc of project.npcs) {
    npcVarIdsByNpcId.set(npc.id, new Set((npc.vars ?? []).map((variable) => variable.id)));
  }

  const gameItemInstanceIds = new Set<ID>();
  const placedItemInstanceIds = new Set<ID>();
  const placedNpcKeys = new Set<string>();
  const placedPlayerKeys = new Set<string>();
  const hotspotIds = new Set<ID>();
  const hotspotVarIdsByHotspotId = new Map<ID, Set<ID>>();
  const dialogueIdsByNodeId = new Map<ID, Set<ID>>();

  for (const player of project.players) {
    for (const item of player.initialInventory ?? []) {
      gameItemInstanceIds.add(item.itemInstanceId);
    }
  }

  for (const npc of project.npcs) {
    for (const item of npc.initialInventory ?? []) {
      gameItemInstanceIds.add(item.itemInstanceId);
    }
  }

  for (const node of project.nodes) {
    dialogueIdsByNodeId.set(node.id, new Set((node.dialogues ?? []).map((dialogue) => dialogue.id)));

    layerIdsByNodeId.set(node.id, new Set(node.layers.map((layer) => layer.id)));

    for (const layer of node.layers) {
      for (const placedItem of layer.placedItems ?? []) {
        placedItemInstanceIds.add(placedItem.itemInstanceId);
        gameItemInstanceIds.add(placedItem.itemInstanceId);
      }

      for (const hotspot of layer.hotspots ?? []) {
        hotspotIds.add(hotspot.id);
        hotspotVarIdsByHotspotId.set(hotspot.id, new Set(hotspot.vars.map((variable) => variable.id)));
      }

      for (const placedNpc of layer.placedNpcs ?? []) {
        placedNpcKeys.add(makePlacementKey({ nodeId: node.id, layerId: layer.id, ownerId: placedNpc.npcId }));
      }

      for (const placedPlayer of layer.placedPlayers ?? []) {
        placedPlayerKeys.add(makePlacementKey({ nodeId: node.id, layerId: layer.id, ownerId: placedPlayer.playerId }));
      }
    }
  }

  const mapRegionIdsByMapId = new Map<ID, Set<ID>>();

  for (const map of project.maps) {
    mapRegionIdsByMapId.set(map.id, new Set(map.regions.map((region) => region.id)));
  }

  return {
    nodeIds, layerIdsByNodeId, playerIds, npcIds, itemIds, musicIds, sfxIds, mapIds, assetIds, playerImageIdsByPlayerId, playerVarIdsByPlayerId, npcVarIdsByNpcId,
    gameItemInstanceIds, placedItemInstanceIds, placedNpcKeys, placedPlayerKeys, hotspotIds, hotspotVarIdsByHotspotId, dialogueIdsByNodeId, mapRegionIdsByMapId,
  };
}

export type ProjectReferenceIndexes = ReturnType<typeof buildProjectReferenceIndexes>;

export function hasLayer(indexes: ProjectReferenceIndexes, input: { nodeId: ID; layerId: ID }): boolean {
  return indexes.layerIdsByNodeId.get(input.nodeId)?.has(input.layerId) === true;
}

export function hasMapRegion(indexes: ProjectReferenceIndexes, input: { mapId: ID; regionId: ID }): boolean {
  return indexes.mapRegionIdsByMapId.get(input.mapId)?.has(input.regionId) === true;
}

export function hasPlacedNpc(indexes: ProjectReferenceIndexes, input: { nodeId: ID; layerId: ID; npcId: ID }): boolean {
  return indexes.placedNpcKeys.has(makePlacementKey({ nodeId: input.nodeId, layerId: input.layerId, ownerId: input.npcId }));
}

export function hasPlacedPlayer(indexes: ProjectReferenceIndexes, input: { nodeId: ID; layerId: ID; playerId: ID }): boolean {
  return indexes.placedPlayerKeys.has(makePlacementKey({ nodeId: input.nodeId, layerId: input.layerId, ownerId: input.playerId }));
}