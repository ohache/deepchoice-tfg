import type { ID } from "@/domain/types";
import type { Condition } from "@/domain/conditions";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;
type MapRegionRef = Readonly<{ mapId: ID; regionId: ID }>;

/* Referencias encontradas en una condición */
export type ConditionRefs = Partial<{
  nodeIds: readonly ID[];
  placedItemIds: readonly ID[];
  hotspotIds: readonly ID[];
  npcIds: readonly ID[];
  playerIds: readonly ID[];
  mapRegions: readonly MapRegionRef[];
  hotspotVars: readonly OwnerVarRef[];
  npcVars: readonly OwnerVarRef[];
  playerVars: readonly OwnerVarRef[];
}>;

/* Tipos auxiliares */
type ConditionLeaf = Exclude<Condition, { type: "and" } | { type: "or" } | { type: "not" }>;
type ConditionLeafType = ConditionLeaf["type"];

type ExtractorMap = {
  [T in ConditionLeafType]: (cond: Extract<ConditionLeaf, { type: T }>) => ConditionRefs
};

/* Mapa declarativo */
const EXTRACT_REFS: ExtractorMap = {
  nodeVisited: c => ({ nodeIds: [c.nodeId] }),
  hasItem: c => ({ placedItemIds: [c.placedItemId] }),

  playerVar: c => ({
    playerIds: [c.playerId],
    playerVars: [{ ownerId: c.playerId, varId: c.varId }],
  }),

  npcVar: c => ({
    npcIds: [c.npcId],
    npcVars: [{ ownerId: c.npcId, varId: c.varId }],
  }),

  hotspotVar: c => ({
    hotspotIds: [c.hotspotId],
    hotspotVars: [{ ownerId: c.hotspotId, varId: c.varId }],
  }),

  hotspotVisible: c => ({ hotspotIds: [c.hotspotId] }),
  hotspotReachable: c => ({ hotspotIds: [c.hotspotId] }),

  placedItemVisible: c => ({ placedItemIds: [c.placedItemId] }),
  placedItemReachable: c => ({ placedItemIds: [c.placedItemId] }),

  placedNpcVisible: c => ({ npcIds: [c.npcId] }),
  placedNpcReachable: c => ({ npcIds: [c.npcId] }),

  placedPlayerVisible: c => ({ playerIds: [c.playerId] }),

  mapRegionVisited: c => ({ mapRegions: [{ mapId: c.mapId, regionId: c.regionId }]}),
};

function mergeRefs(a: ConditionRefs, b: ConditionRefs): ConditionRefs {
  const merge = <T>(x?: readonly T[], y?: readonly T[]) => x || y ? [...(x ?? []), ...(y ?? [])] : undefined;

  return {
    nodeIds: merge(a.nodeIds, b.nodeIds),
    placedItemIds: merge(a.placedItemIds, b.placedItemIds),
    hotspotIds: merge(a.hotspotIds, b.hotspotIds),
    npcIds: merge(a.npcIds, b.npcIds),
    playerIds: merge(a.playerIds, b.playerIds),
    mapRegions: merge(a.mapRegions, b.mapRegions),
    hotspotVars: merge(a.hotspotVars, b.hotspotVars),
    npcVars: merge(a.npcVars, b.npcVars),
    playerVars: merge(a.playerVars, b.playerVars),
  };
}

/*Recorrido del árbol de condiciones */
function isLeaf(cond: Condition): cond is ConditionLeaf {
  return cond.type !== "and" && cond.type !== "or" && cond.type !== "not";
}

function getConditionRefs(cond: Condition | undefined): ConditionRefs {
  if (!cond) return {};

if (cond.type === "and") return cond.all.reduce<ConditionRefs>((acc, c) => mergeRefs(acc, getConditionRefs(c)), {});

if (cond.type === "or") return cond.any.reduce<ConditionRefs>((acc, c) => mergeRefs(acc, getConditionRefs(c)), {});

  if (cond.type === "not") return getConditionRefs(cond.cond);

   if (isLeaf(cond)) { const extractor = EXTRACT_REFS[cond.type] as (c: typeof cond) => ConditionRefs;

    return extractor(cond);
  }

  return {};
}


function includes<T>(arr: readonly T[] | undefined, value: T) {
  return arr?.includes(value) ?? false;
}

function some<T>(arr: readonly T[] | undefined, fn: (v: T) => boolean) {
  return arr?.some(fn) ?? false;
}

/* API pública */
export const conditionReferences = {
  placedItem: (cond: Condition | undefined, id: ID) => includes(getConditionRefs(cond).placedItemIds, id),

  node: (cond: Condition | undefined, id: ID) => includes(getConditionRefs(cond).nodeIds, id),

  hotspot: (cond: Condition | undefined, id: ID) => includes(getConditionRefs(cond).hotspotIds, id),

  npc: (cond: Condition | undefined, id: ID) => includes(getConditionRefs(cond).npcIds, id),

  player: (cond: Condition | undefined, id: ID) => includes(getConditionRefs(cond).playerIds, id),

  npcVar: (cond: Condition | undefined, input: { npcId: ID; varId: ID }) => some(getConditionRefs(cond).npcVars, r => r.ownerId === input.npcId && r.varId === input.varId),

  playerVar: (cond: Condition | undefined, input: { playerId: ID; varId: ID }) => some(getConditionRefs(cond).playerVars, r => r.ownerId === input.playerId && r.varId === input.varId),

  hotspotVar: (cond: Condition | undefined, input: { hotspotId: ID; varId: ID }) => some(getConditionRefs(cond).hotspotVars, r => r.ownerId === input.hotspotId && r.varId === input.varId),

  mapRegion: (cond: Condition | undefined, input: { mapId: ID; regionId: ID }) => some(getConditionRefs(cond).mapRegions, r => r.mapId === input.mapId && r.regionId === input.regionId),
};