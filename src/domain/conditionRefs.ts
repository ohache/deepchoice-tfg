import type { ID } from "@/domain/types";
import type { Condition } from "@/domain/conditions";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;
type MapRegionRef = Readonly<{ mapId: ID; regionId: ID }>;

/* Referencias encontradas en una condición */
export type ConditionRefs = Partial<{
  nodeIds: readonly ID[];
  itemInstanceIds: readonly ID[];
  hotspotIds: readonly ID[];
  npcIds: readonly ID[];
  playerIds: readonly ID[];
  imageAssetIds: readonly ID[];
  musicTrackIds: readonly ID[];
  mapRegions: readonly MapRegionRef[];
  hotspotVars: readonly OwnerVarRef[];
  npcVars: readonly OwnerVarRef[];
  playerVars: readonly OwnerVarRef[];
}>;

/* Condiciones lógicas excluidas: no contienen referencias directas, solo agrupan otras condiciones */
type ConditionLeaf = Exclude<Condition, { type: "and" } | { type: "or" } | { type: "not" }>;

type ConditionLeafType = ConditionLeaf["type"];

type ExtractorMap = { [T in ConditionLeafType]: (condition: Extract<ConditionLeaf, { type: T }>) => ConditionRefs };

/* Mapa declarativo: define qué referencias contiene cada tipo de condición */
const EXTRACT_REFS: ExtractorMap = {
  nodeVisited: (condition) => ({
    nodeIds: [condition.nodeId],
  }),

  hasItem: (condition) => ({
    playerIds: [condition.playerId],
    itemInstanceIds: [condition.itemInstanceId],
  }),

  npcHasItem: (condition) => ({
    npcIds: [condition.npcId],
    itemInstanceIds: [condition.itemInstanceId],
  }),

  playerVar: (condition) => ({
    playerIds: [condition.playerId],
    playerVars: [{ ownerId: condition.playerId, varId: condition.varId }],
  }),

  npcVar: (condition) => ({
    npcIds: [condition.npcId],
    npcVars: [{ ownerId: condition.npcId, varId: condition.varId }],
  }),

  hotspotVar: (condition) => ({
    hotspotIds: [condition.hotspotId],
    hotspotVars: [{ ownerId: condition.hotspotId, varId: condition.varId }],
  }),

  hotspotVisible: (condition) => ({
    hotspotIds: [condition.hotspotId],
  }),

  hotspotReachable: (condition) => ({
    hotspotIds: [condition.hotspotId],
  }),

  placedItemVisible: (condition) => ({
    itemInstanceIds: [condition.itemInstanceId],
  }),

  placedItemReachable: (condition) => ({
    itemInstanceIds: [condition.itemInstanceId],
  }),

  placedNpcVisible: (condition) => ({
    nodeIds: [condition.nodeId],
    npcIds: [condition.npcId],
  }),

  placedNpcReachable: (condition) => ({
    nodeIds: [condition.nodeId],
    npcIds: [condition.npcId],
  }),

  placedPlayerVisible: (condition) => ({
    nodeIds: [condition.nodeId],
    playerIds: [condition.playerId],
  }),

  placedPlayerImage: (condition) => ({
    nodeIds: [condition.nodeId],
    playerIds: [condition.playerId],
    imageAssetIds: [condition.imageId],
  }),

  musicPlaying: (condition) => ({
    musicTrackIds: [condition.trackId],
  }),

  mapRegionVisited: (condition) => ({
    mapRegions: [{ mapId: condition.mapId, regionId: condition.regionId }],
  }),
};

function mergeArrays<T>(left?: readonly T[], right?: readonly T[]): readonly T[] | undefined {
  if (!left && !right) return undefined;
  return [...(left ?? []), ...(right ?? [])];
}

function mergeRefs(left: ConditionRefs, right: ConditionRefs): ConditionRefs {
  return {
    nodeIds: mergeArrays(left.nodeIds, right.nodeIds),
    itemInstanceIds: mergeArrays(left.itemInstanceIds, right.itemInstanceIds),
    hotspotIds: mergeArrays(left.hotspotIds, right.hotspotIds),
    npcIds: mergeArrays(left.npcIds, right.npcIds),
    playerIds: mergeArrays(left.playerIds, right.playerIds),
    imageAssetIds: mergeArrays(left.imageAssetIds, right.imageAssetIds),
    musicTrackIds: mergeArrays(left.musicTrackIds, right.musicTrackIds),
    mapRegions: mergeArrays(left.mapRegions, right.mapRegions),
    hotspotVars: mergeArrays(left.hotspotVars, right.hotspotVars),
    npcVars: mergeArrays(left.npcVars, right.npcVars),
    playerVars: mergeArrays(left.playerVars, right.playerVars),
  };
}

function isConditionLeaf(condition: Condition): condition is ConditionLeaf {
  return (condition.type !== "and" && condition.type !== "or" && condition.type !== "not");
}

/* Recorre el árbol completo de condiciones y devuelve todas sus referencias */
export function getConditionRefs(condition: Condition | undefined): ConditionRefs {
  if (!condition) return {};

  if (condition.type === "and") {
    return condition.all.reduce<ConditionRefs>((acc, child) => mergeRefs(acc, getConditionRefs(child)), {});
  }

  if (condition.type === "or") {
    return condition.any.reduce<ConditionRefs>((acc, child) => mergeRefs(acc, getConditionRefs(child)), {});
  }

  if (condition.type === "not") return getConditionRefs(condition.cond);

  if (isConditionLeaf(condition)) {
    const extractor = EXTRACT_REFS[condition.type] as (value: typeof condition) => ConditionRefs;

    return extractor(condition);
  }

  return {};
}

function includes<T>(values: readonly T[] | undefined, target: T): boolean {
  return values?.includes(target) ?? false;
}

function some<T>(values: readonly T[] | undefined, predicate: (value: T) => boolean): boolean {
  return values?.some(predicate) ?? false;
}

/* API pública para consultar referencias concretas */
export const conditionReferences = {
  itemInstance: (condition: Condition | undefined, itemInstanceId: ID) =>
    includes(getConditionRefs(condition).itemInstanceIds, itemInstanceId),

  node: (condition: Condition | undefined, nodeId: ID) =>
    includes(getConditionRefs(condition).nodeIds, nodeId),

  hotspot: (condition: Condition | undefined, hotspotId: ID) =>
    includes(getConditionRefs(condition).hotspotIds, hotspotId),

  npc: (condition: Condition | undefined, npcId: ID) =>
    includes(getConditionRefs(condition).npcIds, npcId),

  player: (condition: Condition | undefined, playerId: ID) =>
    includes(getConditionRefs(condition).playerIds, playerId),

  imageAsset: (condition: Condition | undefined, imageAssetId: ID) =>
    includes(getConditionRefs(condition).imageAssetIds, imageAssetId),

  musicTrack: (condition: Condition | undefined, trackId: ID) =>
    includes(getConditionRefs(condition).musicTrackIds, trackId),

  npcVar: (condition: Condition | undefined, input: { npcId: ID; varId: ID }) =>
    some(getConditionRefs(condition).npcVars, (ref) => ref.ownerId === input.npcId && ref.varId === input.varId),

  playerVar: (condition: Condition | undefined, input: { playerId: ID; varId: ID }) =>
    some(getConditionRefs(condition).playerVars, (ref) => ref.ownerId === input.playerId && ref.varId === input.varId),

  hotspotVar: (condition: Condition | undefined, input: { hotspotId: ID; varId: ID }) =>
    some(getConditionRefs(condition).hotspotVars, (ref) => ref.ownerId === input.hotspotId && ref.varId === input.varId),

  mapRegion: (condition: Condition | undefined, input: { mapId: ID; regionId: ID }) =>
    some(getConditionRefs(condition).mapRegions, (ref) => ref.mapId === input.mapId && ref.regionId === input.regionId),
};