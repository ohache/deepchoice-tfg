import type { ID } from "@/domain/types";
import type { Effect, EffectType } from "@/domain/effects";

type OwnerVarRef = Readonly<{ ownerId: ID; varId: ID }>;
type MapRegionRef = Readonly<{ mapId: ID; regionId: ID }>;

/* Referencias detectadas dentro de un efecto */
export type EffectRefs = Partial<{
  npcIds: readonly ID[];
  playerIds: readonly ID[];
  nodeIds: readonly ID[];
  itemIds: readonly ID[];
  dialogueIds: readonly ID[];
  itemInstanceIds: readonly ID[];
  hotspotIds: readonly ID[];
  imageAssetIds: readonly ID[];
  sfxIds: readonly ID[];
  musicTrackIds: readonly ID[];
  mapRegions: readonly MapRegionRef[];
  hotspotVars: readonly OwnerVarRef[];
  playerVars: readonly OwnerVarRef[];
  npcVars: readonly OwnerVarRef[];
}>;

type ExtractorMap = {
  [T in EffectType]: (effect: Extract<Effect, { type: T }>) => EffectRefs
};

/* Qué referencias toca cada tipo de efecto */
const EXTRACT_REFS: ExtractorMap = {
  /* Navegación */
  goToNode: (effect) => ({ nodeIds: [effect.targetNodeId] }),

  /* Inventario */
  addItem: (effect) => ({ itemInstanceIds: [effect.itemInstanceId] }),
  removeItem: (effect) => ({ itemInstanceIds: [effect.itemInstanceId] }),

  /* Diálogo / PNJ */
  startDialogue: (effect) => ({ dialogueIds: [effect.nodeDialogueId] }),
  endDialogue: () => ({}),

  giveItemToNpc: (effect) => ({ npcIds: [effect.npcId], itemInstanceIds: [effect.itemInstanceId] }),
  receiveItemFromNpc: (effect) => ({ npcIds: [effect.npcId], itemInstanceIds: [effect.itemInstanceId] }),
  transformItem: (effect) => ({ itemIds: [effect.resultItemId], itemInstanceIds: [effect.itemInstanceId, effect.resultItemInstanceId] }),
  combineItems: (effect) => ({ itemIds: [effect.resultItemId], itemInstanceIds: [effect.itemAInstanceId, effect.itemBInstanceId, effect.resultItemInstanceId] }),

  /* Feedback */
  showMessage: (effect) => ({
    playerIds: effect.speaker?.kind === "player" ? [effect.speaker.playerId] : undefined,
    npcIds: effect.speaker?.kind === "npc" ? [effect.speaker.npcId] : undefined,
  }),

  /* Estado de items colocados */
  setPlacedItemVisible: (effect) => ({ itemInstanceIds: [effect.itemInstanceId] }),
  setPlacedItemReachable: (effect) => ({ itemInstanceIds: [effect.itemInstanceId] }),

  /* Estado de hotspot */
  setHotspotVisible: (effect) => ({ hotspotIds: [effect.hotspotId] }),
  setHotspotReachable: (effect) => ({ hotspotIds: [effect.hotspotId] }),

  /* Variables de hotspot */
  setHotspotVar: (effect) => ({
    hotspotIds: [effect.hotspotId],
    hotspotVars: [{ ownerId: effect.hotspotId, varId: effect.varId }],
  }),
  toggleHotspotVar: (effect) => ({
    hotspotIds: [effect.hotspotId],
    hotspotVars: [{ ownerId: effect.hotspotId, varId: effect.varId }],
  }),
  incHotspotVar: (effect) => ({
    hotspotIds: [effect.hotspotId],
    hotspotVars: [{ ownerId: effect.hotspotId, varId: effect.varId }],
  }),
  decHotspotVar: (effect) => ({
    hotspotIds: [effect.hotspotId],
    hotspotVars: [{ ownerId: effect.hotspotId, varId: effect.varId }],
  }),

  /* Estado de player colocado */
  setPlacedPlayerVisible: (effect) => ({
    nodeIds: [effect.nodeId],
    playerIds: [effect.playerId],
  }),
  setPlacedPlayerImage: (effect) => ({
    nodeIds: [effect.nodeId],
    playerIds: [effect.playerId],
    imageAssetIds: [effect.imageId],
  }),

  /* Estado de npc colocado */
  setPlacedNpcVisible: (effect) => ({
    nodeIds: [effect.nodeId],
    npcIds: [effect.npcId],
  }),
  setPlacedNpcReachable: (effect) => ({
    nodeIds: [effect.nodeId],
    npcIds: [effect.npcId],
  }),

  /* Variables de player */
  setPlayerVar: (effect) => ({
    playerIds: [effect.playerId],
    playerVars: [{ ownerId: effect.playerId, varId: effect.varId }],
  }),
  togglePlayerVar: (effect) => ({
    playerIds: [effect.playerId],
    playerVars: [{ ownerId: effect.playerId, varId: effect.varId }],
  }),
  incPlayerVar: (effect) => ({
    playerIds: [effect.playerId],
    playerVars: [{ ownerId: effect.playerId, varId: effect.varId }],
  }),
  decPlayerVar: (effect) => ({
    playerIds: [effect.playerId],
    playerVars: [{ ownerId: effect.playerId, varId: effect.varId }],
  }),

  /* Variables de npc */
  setNpcVar: (effect) => ({
    npcIds: [effect.npcId],
    npcVars: [{ ownerId: effect.npcId, varId: effect.varId }],
  }),
  toggleNpcVar: (effect) => ({
    npcIds: [effect.npcId],
    npcVars: [{ ownerId: effect.npcId, varId: effect.varId }],
  }),
  incNpcVar: (effect) => ({
    npcIds: [effect.npcId],
    npcVars: [{ ownerId: effect.npcId, varId: effect.varId }],
  }),
  decNpcVar: (effect) => ({
    npcIds: [effect.npcId],
    npcVars: [{ ownerId: effect.npcId, varId: effect.varId }],
  }),

  /* Audio */
  playSfx: (effect) => ({ sfxIds: [effect.sfxId] }),
  playMusic: (effect) => ({ musicTrackIds: [effect.trackId] }),
  stopMusic: (effect) => ({ musicTrackIds: [effect.trackId] }),

  /* Mapa */
  setMapRegionAvailable: (effect) => ({ mapRegions: [{ mapId: effect.mapId, regionId: effect.regionId }] }),

  /* Finalizar juego */
  endGame: (effect) => ({
    musicTrackIds: effect.ending?.musicTrackId ? [effect.ending.musicTrackId] : undefined,
    playerIds: effect.ending?.lines?.flatMap((line) => line.speaker?.kind === "player" ? [line.speaker.playerId] : []),
    npcIds: effect.ending?.lines?.flatMap((line) => line.speaker?.kind === "npc" ? [line.speaker.npcId] : []),
  }),
};

type EffectLeaf = Effect;
type EffectLeafType = EffectLeaf["type"];

export function extractEffectRefs(effect: Effect): EffectRefs {
  const extractor = EXTRACT_REFS[effect.type as EffectLeafType] as (value: typeof effect) => EffectRefs;

  return extractor(effect);
}

function includes<T>(values: readonly T[] | undefined, target: T): boolean {
  return values?.includes(target) ?? false;
}

function some<T>(values: readonly T[] | undefined, predicate: (value: T) => boolean): boolean {
  return values?.some(predicate) ?? false;
}

export function effectReferencesNpc(effect: Effect, npcId: ID): boolean {
  return includes(extractEffectRefs(effect).npcIds, npcId);
}

export function effectReferencesPlayer(effect: Effect, playerId: ID): boolean {
  return includes(extractEffectRefs(effect).playerIds, playerId);
}

export function effectReferencesNode(effect: Effect, nodeId: ID): boolean {
  return includes(extractEffectRefs(effect).nodeIds, nodeId);
}

export function effectReferencesDialogue(effect: Effect, dialogueId: ID): boolean {
  return includes(extractEffectRefs(effect).dialogueIds, dialogueId);
}

export function effectReferencesHotspot(effect: Effect, hotspotId: ID): boolean {
  return includes(extractEffectRefs(effect).hotspotIds, hotspotId);
}

export function effectReferencesItemInstance(effect: Effect, ItemInstanceId: ID): boolean {
  return includes(extractEffectRefs(effect).itemInstanceIds, ItemInstanceId);
}

export function effectReferencesImageAsset(effect: Effect, assetId: ID): boolean {
  return includes(extractEffectRefs(effect).imageAssetIds, assetId);
}

export function effectReferencesSfx(effect: Effect, sfxId: ID): boolean {
  return includes(extractEffectRefs(effect).sfxIds, sfxId);
}

export function effectReferencesMusicTrack(effect: Effect, trackId: ID): boolean {
  return includes(extractEffectRefs(effect).musicTrackIds, trackId);
}

export function effectReferencesMapRegion(effect: Effect, input: { mapId: ID; regionId: ID }): boolean {
  return some(extractEffectRefs(effect).mapRegions, (ref) => ref.mapId === input.mapId && ref.regionId === input.regionId);
}

export function effectReferencesNpcVar(effect: Effect, input: { npcId: ID; varId: ID }): boolean {
  return some(extractEffectRefs(effect).npcVars, (ref) => ref.ownerId === input.npcId && ref.varId === input.varId);
}

export function effectReferencesPlayerVar(effect: Effect, input: { playerId: ID; varId: ID }): boolean {
  return some(extractEffectRefs(effect).playerVars, (ref) => ref.ownerId === input.playerId && ref.varId === input.varId);
}

export function effectReferencesHotspotVar(effect: Effect, input: { hotspotId: ID; varId: ID }): boolean {
  return some(extractEffectRefs(effect).hotspotVars, (ref) => ref.ownerId === input.hotspotId && ref.varId === input.varId);
}