import type { ID } from "@/domain/types";
import type { Condition } from "@/domain/conditions";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;
type MapRegionRef = Readonly<{ mapId: ID; regionId: ID }>;

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

function mergeRefs(a: ConditionRefs, b: ConditionRefs): ConditionRefs {
  return {
    nodeIds: [...(a.nodeIds ?? []), ...(b.nodeIds ?? [])],
    placedItemIds: [...(a.placedItemIds ?? []), ...(b.placedItemIds ?? [])],
    hotspotIds: [...(a.hotspotIds ?? []), ...(b.hotspotIds ?? [])],
    npcIds: [...(a.npcIds ?? []), ...(b.npcIds ?? [])],
    playerIds: [...(a.playerIds ?? []), ...(b.playerIds ?? [])],
    mapRegions: [...(a.mapRegions ?? []), ...(b.mapRegions ?? [])],
    hotspotVars: [...(a.hotspotVars ?? []), ...(b.hotspotVars ?? [])],
    npcVars: [...(a.npcVars ?? []), ...(b.npcVars ?? [])],
    playerVars: [...(a.playerVars ?? []), ...(b.playerVars ?? [])],
  };
}

function getConditionRefs(cond: Condition | undefined): ConditionRefs {
  if (!cond) return {};

  switch (cond.type) {
    case "and":
      return (cond.all ?? []).reduce<ConditionRefs>((acc, c) => mergeRefs(acc, getConditionRefs(c)), {});

    case "or":
      return (cond.any ?? []).reduce<ConditionRefs>((acc, c) => mergeRefs(acc, getConditionRefs(c)), {});

    case "not":
      return getConditionRefs(cond.cond);

    case "nodeVisited":
      return { nodeIds: [cond.nodeId] };

    case "hasItem":
      return { placedItemIds: [cond.placedItemId] };

    case "playerVar":
      return {
        playerIds: [cond.playerId],
        playerVars: [{ ownerId: cond.playerId, varId: cond.varId }],
      };

    case "npcVar":
      return {
        npcIds: [cond.npcId],
        npcVars: [{ ownerId: cond.npcId, varId: cond.varId }],
      };

    case "hotspotVar":
      return {
        hotspotIds: [cond.hotspotId],
        hotspotVars: [{ ownerId: cond.hotspotId, varId: cond.varId }],
      };

    case "hotspotVisible":
    case "hotspotReachable":
      return { hotspotIds: [cond.hotspotId] };

    case "placedItemVisible":
    case "placedItemReachable":
      return { placedItemIds: [cond.placedItemId] };

    case "placedNpcVisible":
    case "placedNpcReachable":
      return { npcIds: [cond.npcId] };

    case "placedPlayerVisible":
      return { playerIds: [cond.playerId] };

    case "mapRegionVisited":
      return { mapRegions: [{ mapId: cond.mapId, regionId: cond.regionId }] };

    default:
      return {};
  }
}

export function conditionReferencesPlacedItem(cond: Condition | undefined, placedItemId: ID): boolean {
  const refs = getConditionRefs(cond);
  return (refs.placedItemIds ?? []).includes(placedItemId);
}

export function conditionReferencesNode(cond: Condition | undefined, nodeId: ID): boolean {
  const refs = getConditionRefs(cond);
  return (refs.nodeIds ?? []).includes(nodeId);
}

export function conditionReferencesHotspot(cond: Condition | undefined, hotspotId: ID): boolean {
  const refs = getConditionRefs(cond);
  return (refs.hotspotIds ?? []).includes(hotspotId);
}

export function conditionReferencesNpc(cond: Condition | undefined, npcId: ID): boolean {
  const refs = getConditionRefs(cond);
  return (refs.npcIds ?? []).includes(npcId);
}

export function conditionReferencesPlayer(cond: Condition | undefined, playerId: ID): boolean {
  const refs = getConditionRefs(cond);
  return (refs.playerIds ?? []).includes(playerId);
}

export function conditionReferencesNpcVar(cond: Condition | undefined, input: { npcId: ID; varId: ID }): boolean {
  const refs = getConditionRefs(cond);
  return (refs.npcVars ?? []).some((r) => r.ownerId === input.npcId && r.varId === input.varId);
}

export function conditionReferencesPlayerVar(cond: Condition | undefined, input: { playerId: ID; varId: ID }): boolean {
  const refs = getConditionRefs(cond);
  return (refs.playerVars ?? []).some((r) => r.ownerId === input.playerId && r.varId === input.varId);
}

export function conditionReferencesHotspotVar(cond: Condition | undefined, input: { hotspotId: ID; varId: ID }): boolean {
  const refs = getConditionRefs(cond);
  return (refs.hotspotVars ?? []).some((r) => r.ownerId === input.hotspotId && r.varId === input.varId);
}

export function conditionReferencesMapRegion(cond: Condition | undefined, input: { mapId: ID; regionId: ID }): boolean {
  const refs = getConditionRefs(cond);
  return (refs.mapRegions ?? []).some((r) => r.mapId === input.mapId && r.regionId === input.regionId);
}