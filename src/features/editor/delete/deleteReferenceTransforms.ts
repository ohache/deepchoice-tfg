import type { ID, Project, RulePhrase } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import { effectReferencesHotspot, effectReferencesItemInstance } from "@/domain/effectRefs";
import type { RemovedSceneSpeaker } from "@/features/editor/delete/deleteCascadeContext";
import { mapEffectsInNode, mapEffectsInProject, removeRulePhrasesInNode } from "@/features/editor/delete/editorProjectWalkers";

export type SceneSpeakerRef = { kind: "player"; id: ID } | { kind: "npc"; id: ID };

export function sceneSpeakerFromRemovedSceneSpeaker(speaker: RemovedSceneSpeaker | undefined): SceneSpeakerRef | null {
  if (!speaker) return null;

  return speaker.kind === "player" ? { kind: "player", id: speaker.id } : { kind: "npc", id: speaker.id };
}

export function effectSpeakerMatches(effect: Effect, speaker: SceneSpeakerRef): boolean {
  if (effect.type !== "showMessage") return false;

  if (speaker.kind === "player") return (effect.speaker?.kind === "player" && effect.speaker.playerId === speaker.id);

  return (effect.speaker?.kind === "npc" && effect.speaker.npcId === speaker.id);
}

export function phraseSpeakerMatches(phrase: RulePhrase | undefined, speaker: SceneSpeakerRef): boolean {
  if (!phrase?.speaker) return false;

  if (speaker.kind === "player") return (phrase.speaker.kind === "player" && phrase.speaker.playerId === speaker.id);

  return (phrase.speaker.kind === "npc" && phrase.speaker.npcId === speaker.id);
}

export function effectReferencesAnyItemInstance(effect: Effect, itemInstanceIds: Set<ID>): boolean {
  if (itemInstanceIds.size === 0) return false;

  for (const itemInstanceId of itemInstanceIds) {
    if (effectReferencesItemInstance(effect, itemInstanceId)) return true;
  }

  return false;
}

export function effectReferencesAnyHotspot(effect: Effect, hotspotIds: Set<ID>): boolean {
  if (hotspotIds.size === 0) return false;

  for (const hotspotId of hotspotIds) {
    if (effectReferencesHotspot(effect, hotspotId)) return true;
  }

  return false;
}

/* ---------- Assets ---------- */
function removeAssetsByIds(project: Project, assetIds: Set<ID>): Project {
  if (assetIds.size === 0) return project;

  return { ...project, assets: project.assets.filter((asset) => !assetIds.has(asset.id)) };
}

function collectUsedAssetIds(project: Project): Set<ID> {
  const used = new Set<ID>();

  for (const node of project.nodes) {
    for (const layer of node.layers) {
      if (layer.assetId) used.add(layer.assetId);
    }
  }

  for (const player of project.players) {
    for (const image of player.images) used.add(image.id);
  }

  for (const map of project.maps) {
    if (map.visual.type === "singleImage") used.add(map.visual.imageAssetId);

    if (map.visual.type === "composed") used.add(map.visual.backgroundAssetId);

    for (const region of map.regions) {
      if (region.imageAssetId) used.add(region.imageAssetId);
    }
  }

  for (const item of project.items) used.add(item.id);
  for (const npc of project.npcs) used.add(npc.id);
  for (const music of project.musicTracks) used.add(music.id);
  for (const sfx of project.soundEffects) used.add(sfx.id);

  return used;
}

export function removeNowUnusedAssets(project: Project, candidateIds: Iterable<ID>): Project {
  const used = collectUsedAssetIds(project);
  const unused = new Set<ID>();

  for (const id of candidateIds) {
    if (!used.has(id)) unused.add(id);
  }

  return removeAssetsByIds(project, unused);
}

/* ---------- Música en efectos endGame ---------- */
function clearMusicFromEndGameEffect(effect: Effect, trackId: ID): Effect {
  if (effect.type !== "endGame") return effect;
  if (effect.ending?.musicTrackId !== trackId) return effect;

  return {
    ...effect,
    ending: { ...effect.ending, musicTrackId: undefined },
  };
}

export function clearMusicFromEndGameEffectsInProject(project: Project, trackId: ID): Project {
  return mapEffectsInProject(project, (effect) => clearMusicFromEndGameEffect(effect, trackId));
}

/* ---------- Speaker en reglas/efectos de una escena ---------- */
export function removeShowMessagesBySpeakerInNode(project: Project, nodeId: ID, speaker: SceneSpeakerRef): Project {
  return mapEffectsInNode(project, nodeId, (effect) => (effectSpeakerMatches(effect, speaker) ? undefined : effect));
}

export function removeRulePhrasesBySpeakerInNode(project: Project, nodeId: ID, speaker: SceneSpeakerRef): Project {
  return removeRulePhrasesInNode(project, nodeId, (phrase) => phraseSpeakerMatches(phrase, speaker));
}