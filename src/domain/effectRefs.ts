import type { ID } from "@/domain/types";
import type { Effect, EffectType } from "@/domain/effects";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;

export type EffectRefs = Partial<{
  npcIds: readonly ID[];
  playerIds: readonly ID[];
  nodeIds: readonly ID[];
  dialogueIds: readonly ID[];
  placedItemIds: readonly ID[];
  hotspotIds: readonly ID[];
  imageAssetIds: readonly ID[];
  sfxIds: readonly ID[];
  musicTrackIds: readonly ID[];
  hotspotVars: readonly OwnerVarRef[];
  playerVars: readonly OwnerVarRef[];
  npcVars: readonly OwnerVarRef[];
  mapIds: readonly ID[];
  mapRegionIds: readonly ID[];
}>;

/* Helper para crear extractores por type manteniendo tipado por unión discriminada */
type ExtractorMap = { [T in EffectType]: (e: Extract<Effect, { type: T }>) => EffectRefs };

/* Registro único de “qué ids toca cada Effect.type” */
const EXTRACT_REFS: ExtractorMap = {
  goToNode: (e) => ({ nodeIds: [e.targetNodeId] }),

  addItem: (e) => ({ placedItemIds: [e.placedItemId] }),
  removeItem: (e) => ({ placedItemIds: [e.placedItemId] }),

  startDialogue: (e) => ({ dialogueIds: [e.nodeDialogueId] }),
  endDialogue: (_e) => ({}),

  giveItemToNpc: (e) => ({ npcIds: [e.npcId], placedItemIds: [e.placedItemId] }),
  receiveItemFromNpc: (e) => ({ npcIds: [e.npcId], placedItemIds: [e.placedItemId] }),

  showMessage: (_e) => ({}),

  setPlacedItemVisible: (e) => ({ nodeIds: [e.nodeId], placedItemIds: [e.placedItemId] }),
  setPlacedItemReachable: (e) => ({ nodeIds: [e.nodeId], placedItemIds: [e.placedItemId] }),

  setHotspotVisible: (e) => ({ hotspotIds: [e.hotspotId] }),
  setHotspotReachable: (e) => ({ hotspotIds: [e.hotspotId] }),

  setHotspotVar: (e) => ({
    hotspotIds: [e.hotspotId],
    hotspotVars: [{ ownerId: e.hotspotId, varId: e.varId }],
  }),
  toggleHotspotVar: (e) => ({
    hotspotIds: [e.hotspotId],
    hotspotVars: [{ ownerId: e.hotspotId, varId: e.varId }],
  }),
  incHotspotVar: (e) => ({
    hotspotIds: [e.hotspotId],
    hotspotVars: [{ ownerId: e.hotspotId, varId: e.varId }],
  }),
  decHotspotVar: (e) => ({
    hotspotIds: [e.hotspotId],
    hotspotVars: [{ ownerId: e.hotspotId, varId: e.varId }],
  }),

  setPlacedPlayerVisible: (e) => ({ nodeIds: [e.nodeId], playerIds: [e.playerId] }),
  setPlacedPlayerImage: (e) => ({
    nodeIds: [e.nodeId],
    playerIds: [e.playerId],
    imageAssetIds: [e.imageId],
  }),

  setPlacedNpcVisible: (e) => ({ nodeIds: [e.nodeId], npcIds: [e.npcId] }),
  setPlacedNpcReachable: (e) => ({ nodeIds: [e.nodeId], npcIds: [e.npcId] }),

  setPlayerVar: (e) => ({
    playerIds: [e.playerId],
    playerVars: [{ ownerId: e.playerId, varId: e.varId }],
  }),
  togglePlayerVar: (e) => ({
    playerIds: [e.playerId],
    playerVars: [{ ownerId: e.playerId, varId: e.varId }],
  }),
  incPlayerVar: (e) => ({
    playerIds: [e.playerId],
    playerVars: [{ ownerId: e.playerId, varId: e.varId }],
  }),
  decPlayerVar: (e) => ({
    playerIds: [e.playerId],
    playerVars: [{ ownerId: e.playerId, varId: e.varId }],
  }),

  setNpcVar: (e) => ({
    npcIds: [e.npcId],
    npcVars: [{ ownerId: e.npcId, varId: e.varId }],
  }),
  toggleNpcVar: (e) => ({
    npcIds: [e.npcId],
    npcVars: [{ ownerId: e.npcId, varId: e.varId }],
  }),
  incNpcVar: (e) => ({
    npcIds: [e.npcId],
    npcVars: [{ ownerId: e.npcId, varId: e.varId }],
  }),
  decNpcVar: (e) => ({
    npcIds: [e.npcId],
    npcVars: [{ ownerId: e.npcId, varId: e.varId }],
  }),

  playSfx: (e) => ({ sfxIds: [e.sfxId] }),

  playMusic: (e) => ({ musicTrackIds: [e.trackId] }),
  pauseMusic: (_e) => ({}),
  stopMusic: (_e) => ({}),

  setMapRegionAvailable: (e) => ({
    mapIds: [e.mapId],
    mapRegionIds: [e.regionId],
  }),

  endGame: (_e) => ({}),
};

function getEffectRefs(e: Effect): EffectRefs {
  return EXTRACT_REFS[e.type](e as never);
}

/* Predicados listos para slices */
export function effectReferencesItem(e: Effect, itemId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.placedItemIds ?? []).includes(itemId);
}

export function effectReferencesNpc(e: Effect, npcId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.npcIds ?? []).includes(npcId);
}

export function effectReferencesPlayer(e: Effect, playerId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.playerIds ?? []).includes(playerId);
}

export function effectReferencesNode(e: Effect, nodeId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.nodeIds ?? []).includes(nodeId);
}

export function effectReferencesDialogue(e: Effect, dialogueId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.dialogueIds ?? []).includes(dialogueId);
}

export function effectReferencesHotspot(e: Effect, hotspotId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.hotspotIds ?? []).includes(hotspotId);
}

export function effectReferencesPlacedItem(e: Effect, placedItemId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.placedItemIds ?? []).includes(placedItemId);
}

export function effectReferencesImageAsset(e: Effect, assetId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.imageAssetIds ?? []).includes(assetId);
}

export function effectReferencesSfx(e: Effect, sfxId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.sfxIds ?? []).includes(sfxId);
}

export function effectReferencesMusicTrack(e: Effect, trackId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.musicTrackIds ?? []).includes(trackId);
}

export function effectReferencesMap(e: Effect, mapId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.mapIds ?? []).includes(mapId);
}

export function effectReferencesMapRegion(e: Effect, regionId: ID): boolean {
  const refs = getEffectRefs(e);
  return (refs.mapRegionIds ?? []).includes(regionId);
}

export function effectReferencesNpcVar(e: Effect, input: { npcId: ID; varId: ID }): boolean {
  const refs = getEffectRefs(e);
  return (refs.npcVars ?? []).some((r) => r.ownerId === input.npcId && r.varId === input.varId);
}

export function effectReferencesPlayerVar(e: Effect, input: { playerId: ID; varId: ID }): boolean {
  const refs = getEffectRefs(e);
  return (refs.playerVars ?? []).some((r) => r.ownerId === input.playerId && r.varId === input.varId);
}

export function effectReferencesHotspotVar(e: Effect, input: { hotspotId: ID; varId: ID }): boolean {
  const refs = getEffectRefs(e);
  return (refs.hotspotVars ?? []).some((r) => r.ownerId === input.hotspotId && r.varId === input.varId);
}