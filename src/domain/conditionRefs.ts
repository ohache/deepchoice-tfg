import type { ID } from "@/domain/types";
import type { Condition } from "@/domain/conditions";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;
type MapRegionRef = Readonly<{ mapId: ID; regionId: ID }>;
type PlacedNpcRef = Readonly<{ nodeId: ID; layerId: ID; npcId: ID }>;
type PlacedPlayerRef = Readonly<{ nodeId: ID; layerId: ID; playerId: ID }>;

export type ConditionRefs = Partial<{
  nodeIds: readonly ID[];
  npcIds: readonly ID[];
  playerIds: readonly ID[];
  itemInstanceIds: readonly ID[];
  hotspotIds: readonly ID[];
  imageAssetIds: readonly ID[];
  musicTrackIds: readonly ID[];
  mapRegions: readonly MapRegionRef[];
  hotspotVars: readonly OwnerVarRef[];
  playerVars: readonly OwnerVarRef[];
  npcVars: readonly OwnerVarRef[];
  placedNpcs: readonly PlacedNpcRef[];
  placedPlayers: readonly PlacedPlayerRef[];
}>;

function mergeRefs(refs: ConditionRefs[]): ConditionRefs {
  const merged: {
    nodeIds: ID[];
    npcIds: ID[];
    playerIds: ID[];
    itemInstanceIds: ID[];
    hotspotIds: ID[];
    imageAssetIds: ID[];
    musicTrackIds: ID[];
    mapRegions: MapRegionRef[];
    hotspotVars: OwnerVarRef[];
    playerVars: OwnerVarRef[];
    npcVars: OwnerVarRef[];
    placedNpcs: PlacedNpcRef[];
    placedPlayers: PlacedPlayerRef[];
  } = {
    nodeIds: [],
    npcIds: [],
    playerIds: [],
    itemInstanceIds: [],
    hotspotIds: [],
    imageAssetIds: [],
    musicTrackIds: [],
    mapRegions: [],
    hotspotVars: [],
    playerVars: [],
    npcVars: [],
    placedNpcs: [],
    placedPlayers: [],
  };

  for (const ref of refs) {
    merged.nodeIds.push(...ref.nodeIds ?? []);
    merged.npcIds.push(...ref.npcIds ?? []);
    merged.playerIds.push(...ref.playerIds ?? []);
    merged.itemInstanceIds.push(...ref.itemInstanceIds ?? []);
    merged.hotspotIds.push(...ref.hotspotIds ?? []);
    merged.imageAssetIds.push(...ref.imageAssetIds ?? []);
    merged.musicTrackIds.push(...ref.musicTrackIds ?? []);
    merged.mapRegions.push(...ref.mapRegions ?? []);
    merged.hotspotVars.push(...ref.hotspotVars ?? []);
    merged.playerVars.push(...ref.playerVars ?? []);
    merged.npcVars.push(...ref.npcVars ?? []);
    merged.placedNpcs.push(...ref.placedNpcs ?? []);
    merged.placedPlayers.push(...ref.placedPlayers ?? []);
  }

  return {
    nodeIds: merged.nodeIds.length ? merged.nodeIds : undefined,
    npcIds: merged.npcIds.length ? merged.npcIds : undefined,
    playerIds: merged.playerIds.length ? merged.playerIds : undefined,
    itemInstanceIds: merged.itemInstanceIds.length ? merged.itemInstanceIds : undefined,
    hotspotIds: merged.hotspotIds.length ? merged.hotspotIds : undefined,
    imageAssetIds: merged.imageAssetIds.length ? merged.imageAssetIds : undefined,
    musicTrackIds: merged.musicTrackIds.length ? merged.musicTrackIds : undefined,
    mapRegions: merged.mapRegions.length ? merged.mapRegions : undefined,
    hotspotVars: merged.hotspotVars.length ? merged.hotspotVars : undefined,
    playerVars: merged.playerVars.length ? merged.playerVars : undefined,
    npcVars: merged.npcVars.length ? merged.npcVars : undefined,
    placedNpcs: merged.placedNpcs.length ? merged.placedNpcs : undefined,
    placedPlayers: merged.placedPlayers.length ? merged.placedPlayers : undefined,
  };
}

export function extractConditionRefs(condition: Condition): ConditionRefs {
  switch (condition.type) {
    case "and":
      return mergeRefs(condition.all.map(extractConditionRefs));

    case "or":
      return mergeRefs(condition.any.map(extractConditionRefs));

    case "not":
      return extractConditionRefs(condition.cond);

    case "nodeVisited":
      return { nodeIds: [condition.nodeId] };

    case "hasItem":
      return {
        playerIds: [condition.playerId],
        itemInstanceIds: [condition.itemInstanceId],
      };

    case "npcHasItem":
      return {
        npcIds: [condition.npcId],
        itemInstanceIds: [condition.itemInstanceId],
      };

    case "playerVar":
      return {
        playerIds: [condition.playerId],
        playerVars: [{ ownerId: condition.playerId, varId: condition.varId }],
      };

    case "npcVar":
      return {
        npcIds: [condition.npcId],
        npcVars: [{ ownerId: condition.npcId, varId: condition.varId }],
      };

    case "hotspotVar":
      return {
        hotspotIds: [condition.hotspotId],
        hotspotVars: [{ ownerId: condition.hotspotId, varId: condition.varId }],
      };

    case "hotspotVisible":
    case "hotspotReachable":
      return { hotspotIds: [condition.hotspotId] };

    case "placedItemVisible":
    case "placedItemReachable":
      return { itemInstanceIds: [condition.itemInstanceId] };

    case "placedNpcVisible":
    case "placedNpcReachable":
      return {
        nodeIds: [condition.nodeId],
        npcIds: [condition.npcId],
        placedNpcs: [{ nodeId: condition.nodeId, layerId: condition.layerId, npcId: condition.npcId }],
      };

    case "placedPlayerVisible":
      return {
        nodeIds: [condition.nodeId],
        playerIds: [condition.playerId],
        placedPlayers: [{ nodeId: condition.nodeId, layerId: condition.layerId, playerId: condition.playerId }],
      };

    case "placedPlayerImage":
      return {
        nodeIds: [condition.nodeId],
        playerIds: [condition.playerId],
        imageAssetIds: [condition.imageId],
        placedPlayers: [{ nodeId: condition.nodeId, layerId: condition.layerId, playerId: condition.playerId }],
      };

    case "musicPlaying":
      return { musicTrackIds: [condition.trackId] };

    case "mapRegionVisited":
      return { mapRegions: [{ mapId: condition.mapId, regionId: condition.regionId }] };
  }
}

function includes<T>(values: readonly T[] | undefined, target: T): boolean {
  return values?.includes(target) ?? false;
}

function some<T>(values: readonly T[] | undefined, predicate: (value: T) => boolean): boolean {
  return values?.some(predicate) ?? false;
}

export const conditionReferences = {
  node: (condition: Condition, nodeId: ID): boolean => includes(extractConditionRefs(condition).nodeIds, nodeId),

  player: (condition: Condition, playerId: ID): boolean => includes(extractConditionRefs(condition).playerIds, playerId),

  npc: (condition: Condition, npcId: ID): boolean => includes(extractConditionRefs(condition).npcIds, npcId),

  itemInstance: (condition: Condition, itemInstanceId: ID): boolean => includes(extractConditionRefs(condition).itemInstanceIds, itemInstanceId),

  hotspot: (condition: Condition, hotspotId: ID): boolean => includes(extractConditionRefs(condition).hotspotIds, hotspotId),

  imageAsset: (condition: Condition, assetId: ID): boolean => includes(extractConditionRefs(condition).imageAssetIds, assetId),

  musicTrack: (condition: Condition, trackId: ID): boolean => includes(extractConditionRefs(condition).musicTrackIds, trackId),

  mapRegion: (condition: Condition, input: { mapId: ID; regionId: ID }): boolean =>
    some(extractConditionRefs(condition).mapRegions, (ref) => ref.mapId === input.mapId && ref.regionId === input.regionId),

  playerVar: (condition: Condition, input: { playerId: ID; varId: ID }): boolean =>
    some(extractConditionRefs(condition).playerVars, (ref) => ref.ownerId === input.playerId && ref.varId === input.varId),

  npcVar: (condition: Condition, input: { npcId: ID; varId: ID }): boolean =>
    some(extractConditionRefs(condition).npcVars, (ref) => ref.ownerId === input.npcId && ref.varId === input.varId),

  hotspotVar: (condition: Condition, input: { hotspotId: ID; varId: ID }): boolean =>
    some(extractConditionRefs(condition).hotspotVars, (ref) => ref.ownerId === input.hotspotId && ref.varId === input.varId),
};
