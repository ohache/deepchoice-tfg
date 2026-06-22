import type { Condition } from "@/domain/conditions";
import { conditionReferences } from "@/domain/conditionRefs";
import type { Effect } from "@/domain/effects";
import {
  effectReferencesDialogue, effectReferencesHotspot, effectReferencesHotspotVar, effectReferencesImageAsset, effectReferencesItemInstance,
  effectReferencesMapRegion, effectReferencesNode, effectReferencesNpc, effectReferencesNpcVar,
  effectReferencesPlayer, effectReferencesPlayerVar, effectReferencesSfx
} from "@/domain/effectRefs";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";

export function conditionMatchesDeleteTarget(condition: Condition, target: DeleteTarget): boolean {
  switch (target.kind) {
    case "node":
      return conditionReferences.node(condition, target.nodeId);

    case "layer":
      return (
        "nodeId" in condition &&
        "layerId" in condition &&
        condition.nodeId === target.nodeId &&
        condition.layerId === target.layerId
      );

    case "player":
      return conditionReferences.player(condition, target.playerId);

    case "playerImage":
      return conditionReferences.imageAsset(condition, target.imageId);

    case "playerVar":
      return conditionReferences.playerVar(condition, target);

    case "playerInventoryItem":
    case "npcInventoryItem":
      return conditionReferences.itemInstance(condition, target.itemInstanceId);

    case "npc":
      return conditionReferences.npc(condition, target.npcId);

    case "npcVar":
      return conditionReferences.npcVar(condition, target);

    case "music":
      return conditionReferences.musicTrack(condition, target.trackId);

    case "hotspot":
      return conditionReferences.hotspot(condition, target.hotspotId);

    case "hotspotVar":
      return conditionReferences.hotspotVar(condition, target);

    case "placedItem":
      return conditionReferences.itemInstance(condition, target.placedItemId);

    case "placedNpc":
      return (
        (
          condition.type === "placedNpcVisible" ||
          condition.type === "placedNpcReachable"
        ) &&
        condition.nodeId === target.nodeId &&
        condition.layerId === target.layerId &&
        condition.npcId === target.npcId
      );

    case "placedPlayer":
  return (
    (
      condition.type === "placedPlayerVisible" ||
      condition.type === "placedPlayerImage"
    ) &&
    condition.nodeId === target.nodeId &&
    condition.layerId === target.layerId &&
    condition.playerId === target.playerId
  );

    case "map":
      return condition.type === "mapRegionVisited" && condition.mapId === target.mapId;

    case "mapRegion":
      return conditionReferences.mapRegion(condition, target);

    default:
      return false;
  }
}

export function effectMatchesDeleteTarget(effect: Effect, target: DeleteTarget): boolean {
  switch (target.kind) {
    case "node":
      return effectReferencesNode(effect, target.nodeId);

    case "layer":
      return (
        "nodeId" in effect &&
        "layerId" in effect &&
        effect.nodeId === target.nodeId &&
        effect.layerId === target.layerId
      );

    case "player":
      return effectReferencesPlayer(effect, target.playerId);

    case "playerImage":
      return effectReferencesImageAsset(effect, target.imageId);

    case "playerVar":
      return effectReferencesPlayerVar(effect, target);

    case "playerInventoryItem":
    case "npcInventoryItem":
      return effectReferencesItemInstance(effect, target.itemInstanceId);

    case "npc":
      return effectReferencesNpc(effect, target.npcId);

    case "npcVar":
      return effectReferencesNpcVar(effect, target);

    case "item":
      return ((effect.type === "transformItem" && effect.resultItemId === target.itemId) || (effect.type === "combineItems" && effect.resultItemId === target.itemId));

    case "music":
      return (
        (effect.type === "playMusic" || effect.type === "stopMusic") &&
        effect.trackId === target.trackId
      );

    case "sfx":
      return effectReferencesSfx(effect, target.sfxId);

    case "hotspot":
      return effectReferencesHotspot(effect, target.hotspotId);

    case "hotspotVar":
      return effectReferencesHotspotVar(effect, target);

    case "placedItem":
      return effectReferencesItemInstance(effect, target.placedItemId);

    case "placedNpc":
      return (
        (
          effect.type === "setPlacedNpcVisible" ||
          effect.type === "setPlacedNpcReachable"
        ) &&
        effect.nodeId === target.nodeId &&
        effect.layerId === target.layerId &&
        effect.npcId === target.npcId
      );

    case "placedPlayer":
  return (
    (
      effect.type === "setPlacedPlayerVisible" ||
      effect.type === "setPlacedPlayerImage"
    ) &&
    effect.nodeId === target.nodeId &&
    effect.layerId === target.layerId &&
    effect.playerId === target.playerId
  );

    case "map":
      return effect.type === "setMapRegionAvailable" && effect.mapId === target.mapId;

    case "mapRegion":
      return effectReferencesMapRegion(effect, target);

    case "dialogue":
      return effectReferencesDialogue(effect, target.dialogueId);

    default:
      return false;
  }
}