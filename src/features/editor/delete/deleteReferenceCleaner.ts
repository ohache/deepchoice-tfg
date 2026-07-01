import type { ID, PlacedPlayer, PlayerDef, Project } from "@/domain/types";
import { effectReferencesHotspotVar, effectReferencesMapRegion, effectReferencesNode, effectReferencesNpc, effectReferencesNpcVar,
  effectReferencesPlayer, effectReferencesPlayerVar, effectReferencesSfx } from "@/domain/effectRefs";
import { clearMusicFromEndGameEffectsInProject, effectReferencesAnyHotspot, effectReferencesAnyItemInstance, removeNowUnusedAssets,
  removeRulePhrasesBySpeakerInNode, removeShowMessagesBySpeakerInNode, sceneSpeakerFromRemovedSceneSpeaker } from "@/features/editor/delete/deleteReferenceTransforms";
import { effectIsStartDialogueForAnyOf, removeConditionsInProject, removeDialogues, removeEffectsInProject, removeEmptyInteractionRulesInProject,
  removeOnUseItemRulesForInstances, removePlacedItems, removePlacedNpcs, removePlacedPlayers, removeRulePhrasesInProject } from "@/features/editor/delete/editorProjectWalkers";
import { removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { ensureDefaultImageId } from "@/features/editor/history/shared/genericHelpers";
import { removeAsset } from "@/features/editor/core/editorDataUtils";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { buildDeleteCascadeContext, type RemovedSceneSpeaker } from "@/features/editor/delete/deleteCascadeContext";
import { rebuildMapsFromNodes, reconcileRegionEntryAfterNodeMapRemoval } from "@/features/editor/scene/node/NodeHelpers";

function removePlayerImageRefs(project: Project, input: { playerId: ID; imageId: ID; nextPlayer: PlayerDef }): Project {
  const { playerId, imageId, nextPlayer } = input;
  const replacementImageId = nextPlayer.defaultImageId;

  let nextProject: Project = project;

  if (replacementImageId) {
    nextProject = {
      ...nextProject,
      nodes: nextProject.nodes.map((node) => ({
        ...node,
        layers: node.layers.map((layer) => {
          const placedPlayers = layer.placedPlayers ?? [];
          if (placedPlayers.length === 0) return layer;

          let touched = false;

          const nextPlacedPlayers = placedPlayers.map((placedPlayer) => {
            if (placedPlayer.playerId !== playerId) return placedPlayer;
            if (placedPlayer.initialImageId !== imageId) return placedPlayer;

            touched = true;

            return {
              ...placedPlayer,
              initialImageId: replacementImageId,
            } as PlacedPlayer;
          });

          return touched ? { ...layer, placedPlayers: nextPlacedPlayers } : layer;
        }),
      })),
    };
  }

  nextProject = removeConditionsInProject(nextProject, (condition) => condition.type === "placedPlayerImage" && condition.playerId === playerId && condition.imageId === imageId);

  nextProject = removeEffectsInProject(nextProject, (effect) => effect.type === "setPlacedPlayerImage" && effect.playerId === playerId && effect.imageId === imageId);

  return nextProject;
}

function cleanPlayer(project: Project, playerId: ID): Project {
  const player = project.players.find((p) => p.id === playerId);
  if (!player) return project;

  const { removedDialogueIds, removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "player", playerId });

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      effectReferencesPlayer(effect, playerId) || effectIsStartDialogueForAnyOf(effect, removedDialogueIds) || effectReferencesAnyItemInstance(effect, removedItemInstanceIds)
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "playerVar" && condition.playerId === playerId) || (condition.type === "hasItem" && condition.playerId === playerId) ||
      (condition.type === "placedPlayerVisible" && condition.playerId === playerId) || (condition.type === "placedPlayerImage" && condition.playerId === playerId) ||
      ((condition.type === "hasItem" || condition.type === "npcHasItem") && removedItemInstanceIds.has(condition.itemInstanceId))
  );

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeRulePhrasesInProject(nextProject, (phrase) => phrase.speaker?.kind === "player" && phrase.speaker.playerId === playerId);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  nextProject = removePlacedPlayers(nextProject, (placedPlayer) => placedPlayer.playerId === playerId);
  nextProject = removeDialogues(nextProject, (dialogue) => dialogue.playerId === playerId);

  let nextAssets = nextProject.assets;
  for (const image of player.images) {
    nextAssets = removeAsset(nextAssets, { id: image.id, kind: "players" }).assets;
  }

  return {
    ...nextProject,
    players: removeById(nextProject.players, playerId),
    assets: nextAssets,
  };
}

function cleanPlayerImage(project: Project, input: { playerId: ID; imageId: ID }): Project {
  const player = project.players.find((p) => p.id === input.playerId);
  if (!player) return project;

  if (!player.images.some((image) => image.id === input.imageId)) return project;

  const nextPlayer = ensureDefaultImageId({
    ...player,
    images: player.images.filter((image) => image.id !== input.imageId),
    defaultImageId: player.defaultImageId === input.imageId ? undefined : player.defaultImageId,
  });

  let nextProject = {
    ...project,
    players: replaceById(project.players, input.playerId, nextPlayer),
    assets: removeAsset(project.assets, { id: input.imageId, kind: "players" }).assets,
  };

  nextProject = removePlayerImageRefs(nextProject, {
    playerId: input.playerId,
    imageId: input.imageId,
    nextPlayer,
  });

  return nextProject;
}

function cleanPlayerVar(project: Project, input: { playerId: ID; varId: ID }): Project {
  const player = project.players.find((p) => p.id === input.playerId);
  if (!player) return project;

  let nextProject = {
    ...project,
    players: replaceById(project.players, input.playerId, {
      ...player,
      vars: (player.vars ?? []).filter((variable) => variable.id !== input.varId),
    }),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => condition.type === "playerVar" && condition.playerId === input.playerId && condition.varId === input.varId);

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesPlayerVar(effect, input));

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanPlayerInventoryItem(project: Project, input: { playerId: ID; itemInstanceId: ID }): Project {
  const player = project.players.find((p) => p.id === input.playerId);
  if (!player) return project;

  const { removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "playerInventoryItem", ...input });

  let nextProject = {
    ...project,
    players: replaceById(project.players, input.playerId, {
      ...player,
      initialInventory: (player.initialInventory ?? []).filter((item) => item.itemInstanceId !== input.itemInstanceId),
    }),
  };

  nextProject = removeConditionsInProject(
    nextProject, (condition) => (condition.type === "hasItem" || condition.type === "npcHasItem") && removedItemInstanceIds.has(condition.itemInstanceId),
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesAnyItemInstance(effect, removedItemInstanceIds));

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanNpc(project: Project, npcId: ID): Project {
  const npc = project.npcs.find((entry) => entry.id === npcId);
  if (!npc) return project;

  const { removedDialogueIds, removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "npc", npcId });

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesNpc(effect, npcId) || effectIsStartDialogueForAnyOf(effect, removedDialogueIds) || effectReferencesAnyItemInstance(effect, removedItemInstanceIds)
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "npcVar" && condition.npcId === npcId) || (condition.type === "npcHasItem" && condition.npcId === npcId) ||
      (condition.type === "placedNpcVisible" && condition.npcId === npcId) || (condition.type === "placedNpcReachable" && condition.npcId === npcId) ||
      ((condition.type === "hasItem" || condition.type === "npcHasItem") && removedItemInstanceIds.has(condition.itemInstanceId)),
  );

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeRulePhrasesInProject(nextProject, (phrase) => phrase.speaker?.kind === "npc" && phrase.speaker.npcId === npcId);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  nextProject = removePlacedNpcs(nextProject, (placedNpc) => placedNpc.npcId === npcId);
  nextProject = removeDialogues(nextProject, (dialogue) => dialogue.npcId === npcId);

  return {
    ...nextProject,
    npcs: removeById(nextProject.npcs, npcId),
    assets: removeAsset(nextProject.assets, { id: npcId, kind: "npcs" }).assets,
  };
}

function cleanNpcVar(project: Project, input: { npcId: ID; varId: ID }): Project {
  const npc = project.npcs.find((n) => n.id === input.npcId);
  if (!npc) return project;

  let nextProject = {
    ...project,
    npcs: replaceById(project.npcs, input.npcId, {
      ...npc,
      vars: (npc.vars ?? []).filter((variable) => variable.id !== input.varId),
    }),
  };

  nextProject = removeConditionsInProject(
    nextProject, (condition) => condition.type === "npcVar" && condition.npcId === input.npcId && condition.varId === input.varId);

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesNpcVar(effect, input));

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanNpcInventoryItem(project: Project, input: { npcId: ID; itemInstanceId: ID }): Project {
  const npc = project.npcs.find((n) => n.id === input.npcId);
  if (!npc) return project;

  const { removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "npcInventoryItem", ...input });

  let nextProject = {
    ...project,
    npcs: replaceById(project.npcs, input.npcId, {
      ...npc,
      initialInventory: (npc.initialInventory ?? []).filter(
        (item) => item.itemInstanceId !== input.itemInstanceId,
      ),
    }),
  };

  nextProject = removeConditionsInProject(
    nextProject, (condition) => (condition.type === "hasItem" || condition.type === "npcHasItem") && removedItemInstanceIds.has(condition.itemInstanceId)
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesAnyItemInstance(effect, removedItemInstanceIds));

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanItem(project: Project, itemId: ID): Project {
  const { removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "item", itemId });

  let nextProject: Project = {
    ...project,
    items: removeById(project.items, itemId),
    players: project.players.map((player) => ({
      ...player,
      initialInventory: (player.initialInventory ?? []).filter((itemInstance) => itemInstance.itemId !== itemId),
    })),
    npcs: project.npcs.map((npc) => ({
      ...npc,
      initialInventory: (npc.initialInventory ?? []).filter((itemInstance) => itemInstance.itemId !== itemId),
    })),
    assets: removeAsset(project.assets, { id: itemId, kind: "items" }).assets,
  };

  nextProject = removePlacedItems(nextProject, (placedItem) => placedItem.itemId === itemId);

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => (condition.type === "hasItem" || condition.type === "npcHasItem" || condition.type === "placedItemVisible" || condition.type === "placedItemReachable") &&
      removedItemInstanceIds.has(condition.itemInstanceId),
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if ((effect.type === "transformItem" || effect.type === "combineItems") && effect.resultItemId === itemId) return true;

    return effectReferencesAnyItemInstance(effect, removedItemInstanceIds);
  });

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);
  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanMusic(project: Project, trackId: ID): Project {
  let nextProject: Project = {
    ...project,
    musicTracks: removeById(project.musicTracks, trackId),
    assets: removeAsset(project.assets, { id: trackId, kind: "music" }).assets,

    nodes: project.nodes.map((node) => ({
      ...node,
      musicTrackId: node.musicTrackId === trackId ? undefined : node.musicTrackId,
      layers: node.layers.map((layer) => ({
        ...layer,
        musicTrackId: layer.musicTrackId === trackId ? undefined : layer.musicTrackId,
      })),
    })),

    maps: project.maps.map((map) => ({
      ...map,
      regions: map.regions.map((region) => ({
        ...region,
        musicTrackId: region.musicTrackId === trackId ? undefined : region.musicTrackId,
      })),
    })),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => condition.type === "musicPlaying" && condition.trackId === trackId);

  nextProject = removeEffectsInProject(nextProject, (effect) => (effect.type === "playMusic" || effect.type === "stopMusic") && effect.trackId === trackId);

  nextProject = clearMusicFromEndGameEffectsInProject(nextProject, trackId);

  return nextProject;
}

function cleanSfx(project: Project, sfxId: ID): Project {
  return removeEffectsInProject(
    {
      ...project,
      soundEffects: removeById(project.soundEffects, sfxId),
      assets: removeAsset(project.assets, { id: sfxId, kind: "sfx" }).assets,
    },
    (effect) => effectReferencesSfx(effect, sfxId),
  );
}

function cleanMap(project: Project, mapId: ID): Project {
  const map = project.maps.find((entry) => entry.id === mapId);
  const assetIdsToRemove = new Set<ID>();

  if (map?.visual.type === "singleImage") assetIdsToRemove.add(map.visual.imageAssetId);
  if (map?.visual.type === "composed") assetIdsToRemove.add(map.visual.backgroundAssetId);

  for (const region of map?.regions ?? []) {
    if (region.imageAssetId) assetIdsToRemove.add(region.imageAssetId);
  }

  let nextProject: Project = {
    ...project,
    maps: project.maps
      .filter((currentMap) => currentMap.id !== mapId)
      .map((currentMap) => ({
        ...currentMap,
        regions: currentMap.regions.map((region) =>
          region.subMapId === mapId ? { ...region, subMapId: undefined } : region,
        ),
      })),
    nodes: project.nodes.map((node) => node.mapLocation?.mapId === mapId ? { ...node, mapLocation: undefined } : node),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => condition.type === "mapRegionVisited" && condition.mapId === mapId);

  nextProject = removeEffectsInProject(nextProject, (effect) => effect.type === "setMapRegionAvailable" && effect.mapId === mapId);

  return removeNowUnusedAssets(nextProject, assetIdsToRemove);
}

function cleanMapRegion(project: Project, input: { mapId: ID; regionId: ID }): Project {
  const map = project.maps.find((entry) => entry.id === input.mapId);
  const region = map?.regions.find((entry) => entry.id === input.regionId);
  const assetIdsToRemove = new Set<ID>();

  if (region?.imageAssetId) assetIdsToRemove.add(region.imageAssetId);

  let nextProject: Project = {
    ...project,
    maps: project.maps.map((currentMap) => {
      if (currentMap.id !== input.mapId) return currentMap;

      return {
        ...currentMap,
        regions: currentMap.regions.filter((currentRegion) => currentRegion.id !== input.regionId),
      };
    }),
    nodes: project.nodes.map((node) =>
      node.mapLocation?.mapId === input.mapId && node.mapLocation.regionId === input.regionId ? { ...node, mapLocation: undefined } : node,
    ),
  };

  nextProject = removeConditionsInProject(
    nextProject, (condition) => condition.type === "mapRegionVisited" && condition.mapId === input.mapId && condition.regionId === input.regionId,
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesMapRegion(effect, input));

  return removeNowUnusedAssets(nextProject, assetIdsToRemove);
}

function cleanNode(project: Project, nodeId: ID): Project {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  if (!node) return project;

  const deletedWasStart = Boolean(node.isStart);
  const removedLoc = node.mapLocation;

  const layerAssetIds = new Set<ID>(node.layers.map((layer) => layer.assetId).filter(Boolean));

  const { removedHotspotIds, removedItemInstanceIds, removedDialogueIds } = buildDeleteCascadeContext(project, { kind: "node", nodeId });

  let nextNodes = removeById(project.nodes, nodeId);

  if (deletedWasStart && nextNodes.length > 0) {
    const nextStartId = nextNodes[0]!.id;

    nextNodes = nextNodes.map((entry) => entry.id === nextStartId ? { ...entry, isStart: true } : { ...entry, isStart: false });
  }

  nextNodes = reconcileRegionEntryAfterNodeMapRemoval(nextNodes, removedLoc);

  let nextProject: Project = {
    ...project,
    nodes: nextNodes,
    maps: rebuildMapsFromNodes(project.maps ?? [], nextNodes),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => {
    if ("nodeId" in condition && condition.nodeId === nodeId) return true;

    if ("hotspotId" in condition && removedHotspotIds.has(condition.hotspotId)) return true;

    if ("itemInstanceId" in condition && removedItemInstanceIds.has(condition.itemInstanceId)) return true;

    return false;
  });

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if (effectReferencesNode(effect, nodeId)) return true;
    if (effectIsStartDialogueForAnyOf(effect, removedDialogueIds)) return true;
    if (effectReferencesAnyHotspot(effect, removedHotspotIds)) return true;
    if (effectReferencesAnyItemInstance(effect, removedItemInstanceIds)) return true;

    return false;
  });

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return removeNowUnusedAssets(nextProject, layerAssetIds);
}

function cleanNodeMapLocation(project: Project, nodeId: ID): Project {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  const removedLoc = node?.mapLocation;

  if (!node || !removedLoc) return project;

  const nodesWithoutMapLocation = project.nodes.map((currentNode) => currentNode.id === nodeId ? { ...currentNode, mapLocation: undefined } : currentNode,
  );

  const reconciledNodes = reconcileRegionEntryAfterNodeMapRemoval(nodesWithoutMapLocation, removedLoc);

  return {
    ...project,
    nodes: reconciledNodes,
    maps: rebuildMapsFromNodes(project.maps ?? [], reconciledNodes),
  };
}

function cleanLayer(project: Project, input: { nodeId: ID; layerId: ID }): Project {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);
  if (!node || !layer) return project;

  const { removedHotspotIds, removedItemInstanceIds, removedDialogueIds } = buildDeleteCascadeContext(project, {
    kind: "layer",
    nodeId: input.nodeId,
    layerId: input.layerId,
  });

  const assetIdsToCheck = new Set<ID>();
  if (layer.assetId) assetIdsToCheck.add(layer.assetId);

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((currentNode) => {
      if (currentNode.id !== input.nodeId) return currentNode;

      return {
        ...currentNode,
        layers: currentNode.layers.filter(
          (currentLayer) => currentLayer.id !== input.layerId,
        ),
      };
    }),
  };

  if (removedDialogueIds.size > 0) {
    nextProject = removeDialogues(nextProject, (dialogue) => removedDialogueIds.has(dialogue.id));
  }

  nextProject = removeConditionsInProject(nextProject, (condition) => {
    if ("nodeId" in condition && "layerId" in condition && condition.nodeId === input.nodeId && condition.layerId === input.layerId) return true;

    if ("hotspotId" in condition && removedHotspotIds.has(condition.hotspotId)) return true;

    if ("itemInstanceId" in condition && removedItemInstanceIds.has(condition.itemInstanceId)) return true;

    return false;
  });

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if ("nodeId" in effect && "layerId" in effect && effect.nodeId === input.nodeId && effect.layerId === input.layerId)return true;

    if (effectIsStartDialogueForAnyOf(effect, removedDialogueIds)) return true;

    if (effectReferencesAnyHotspot(effect, removedHotspotIds)) return true;

    if (effectReferencesAnyItemInstance(effect, removedItemInstanceIds)) return true;

    return false;
  });

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return removeNowUnusedAssets(nextProject, assetIdsToCheck);
}

function cleanHotspot(project: Project, input: { nodeId: ID; layerId: ID; hotspotId: ID }): Project {
  const { removedHotspotIds } = buildDeleteCascadeContext(project, { kind: "hotspot", ...input });

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== input.nodeId) return node;

      return {
        ...node,
        layers: node.layers.map((layer) => {
          if (layer.id !== input.layerId) return layer;

          return {
            ...layer,
            hotspots: (layer.hotspots ?? []).filter(
              (hotspot) => !removedHotspotIds.has(hotspot.id),
            ),
          };
        }),
      };
    }),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => "hotspotId" in condition && removedHotspotIds.has(condition.hotspotId));

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesAnyHotspot(effect, removedHotspotIds));

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanHotspotVar(project: Project, input: { nodeId: ID; layerId: ID; hotspotId: ID; varId: ID }): Project {
  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== input.nodeId) return node;

      return {
        ...node,
        layers: node.layers.map((layer) => {
          if (layer.id !== input.layerId) return layer;

          return {
            ...layer,
            hotspots: (layer.hotspots ?? []).map((hotspot) => {
              if (hotspot.id !== input.hotspotId) return hotspot;

              return {
                ...hotspot,
                vars: hotspot.vars.filter((variable) => variable.id !== input.varId),
              };
            }),
          };
        }),
      };
    }),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => condition.type === "hotspotVar" && condition.hotspotId === input.hotspotId && condition.varId === input.varId);

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesHotspotVar(effect, input));

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanPlacedItem(project: Project, input: { nodeId: ID; layerId: ID; placedItemId: ID }): Project {
  const { removedItemInstanceIds } = buildDeleteCascadeContext(project, { kind: "placedItem", ...input });

  let nextProject = removePlacedItems(project, (placedItem) => removedItemInstanceIds.has(placedItem.itemInstanceId));

  nextProject = removeConditionsInProject(nextProject, (condition) => "itemInstanceId" in condition && removedItemInstanceIds.has(condition.itemInstanceId));

  nextProject = removeEffectsInProject(nextProject, (effect) => effectReferencesAnyItemInstance(effect, removedItemInstanceIds));

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function removeSceneSpeakerReferences(project: Project, removedSceneSpeaker: RemovedSceneSpeaker | undefined): Project {
  const speaker = sceneSpeakerFromRemovedSceneSpeaker(removedSceneSpeaker);
  if (!speaker || !removedSceneSpeaker) return project;

  let nextProject = removeShowMessagesBySpeakerInNode(project, removedSceneSpeaker.nodeId, speaker);

  nextProject = removeRulePhrasesBySpeakerInNode(nextProject, removedSceneSpeaker.nodeId, speaker);

  return nextProject;
}

function cleanPlacedNpc(project: Project, input: { nodeId: ID; layerId: ID; npcId: ID }): Project {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const placedNpcExists = Boolean(layer?.placedNpcs?.some((placedNpc) => placedNpc.npcId === input.npcId));

  if (!node || !layer || !placedNpcExists) return project;

  const { removedDialogueIds, removedSceneSpeaker } = buildDeleteCascadeContext(project, { kind: "placedNpc", ...input });

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((currentNode) => {
      if (currentNode.id !== input.nodeId) return currentNode;

      return {
        ...currentNode,
        layers: currentNode.layers.map((currentLayer) => {
          if (currentLayer.id !== input.layerId) return currentLayer;

          return {
            ...currentLayer,
            placedNpcs: (currentLayer.placedNpcs ?? []).filter(
              (placedNpc) => placedNpc.npcId !== input.npcId,
            ),
          };
        }),
      };
    }),
  };

  if (removedDialogueIds.size > 0) {
    nextProject = removeDialogues(nextProject, (dialogue) => removedDialogueIds.has(dialogue.id));
  }

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => (condition.type === "placedNpcVisible" || condition.type === "placedNpcReachable") &&
      condition.nodeId === input.nodeId && condition.layerId === input.layerId && condition.npcId === input.npcId);

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => ((effect.type === "setPlacedNpcVisible" || effect.type === "setPlacedNpcReachable") &&
      effect.nodeId === input.nodeId && effect.layerId === input.layerId && effect.npcId === input.npcId) || effectIsStartDialogueForAnyOf(effect, removedDialogueIds));

  nextProject = removeSceneSpeakerReferences(nextProject, removedSceneSpeaker);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanPlacedPlayer(project: Project, input: { nodeId: ID; layerId: ID; playerId: ID }): Project {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const placedPlayerExists = Boolean(layer?.placedPlayers?.some((placedPlayer) => placedPlayer.playerId === input.playerId));

  if (!node || !layer || !placedPlayerExists) return project;

  const { removedDialogueIds, removedSceneSpeaker } = buildDeleteCascadeContext(project, { kind: "placedPlayer", ...input });

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((currentNode) => {
      if (currentNode.id !== input.nodeId) return currentNode;

      return {
        ...currentNode,
        layers: currentNode.layers.map((currentLayer) => {
          if (currentLayer.id !== input.layerId) return currentLayer;

          return {
            ...currentLayer,
            placedPlayers: (currentLayer.placedPlayers ?? []).filter(
              (placedPlayer) => placedPlayer.playerId !== input.playerId,
            ),
          };
        }),
      };
    }),
  };

  if (removedDialogueIds.size > 0) nextProject = removeDialogues(nextProject, (dialogue) => removedDialogueIds.has(dialogue.id));

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => (condition.type === "placedPlayerVisible" || condition.type === "placedPlayerImage") &&
      condition.nodeId === input.nodeId && condition.layerId === input.layerId && condition.playerId === input.playerId);

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      ((effect.type === "setPlacedPlayerVisible" || effect.type === "setPlacedPlayerImage") &&
        effect.nodeId === input.nodeId && effect.layerId === input.layerId && effect.playerId === input.playerId) || effectIsStartDialogueForAnyOf(effect, removedDialogueIds));

  nextProject = removeSceneSpeakerReferences(nextProject, removedSceneSpeaker);

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanDialogue(project: Project, input: { nodeId: ID; dialogueId: ID }): Project {
  const { removedDialogueIds } = buildDeleteCascadeContext(project, { kind: "dialogue", ...input });

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== input.nodeId) return node;

      return {
        ...node,
        dialogues: (node.dialogues ?? []).filter(
          (dialogue) => !removedDialogueIds.has(dialogue.id),
        ),
      };
    }),
  };

  nextProject = removeEffectsInProject(nextProject, (effect) => effectIsStartDialogueForAnyOf(effect, removedDialogueIds));

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function assertNever(value: never): never {
  throw new Error(`DeleteTarget no contemplado: ${JSON.stringify(value)}`);
}

export function applyDeleteWithCleanup(project: Project, target: DeleteTarget): Project {
  switch (target.kind) {
    case "player":
      return cleanPlayer(project, target.playerId);

    case "playerImage":
      return cleanPlayerImage(project, target);

    case "playerVar":
      return cleanPlayerVar(project, target);

    case "playerInventoryItem":
      return cleanPlayerInventoryItem(project, target);

    case "npc":
      return cleanNpc(project, target.npcId);

    case "npcVar":
      return cleanNpcVar(project, target);

    case "npcInventoryItem":
      return cleanNpcInventoryItem(project, target);

    case "item":
      return cleanItem(project, target.itemId);

    case "music":
      return cleanMusic(project, target.trackId);

    case "sfx":
      return cleanSfx(project, target.sfxId);

    case "map":
      return cleanMap(project, target.mapId);

    case "mapRegion":
      return cleanMapRegion(project, target);

    case "node":
      return cleanNode(project, target.nodeId);

    case "layer":
      return cleanLayer(project, target);

    case "hotspot":
      return cleanHotspot(project, target);

    case "hotspotVar":
      return cleanHotspotVar(project, target);

    case "placedItem":
      return cleanPlacedItem(project, target);

    case "placedNpc":
      return cleanPlacedNpc(project, target);

    case "placedPlayer":
      return cleanPlacedPlayer(project, target);

    case "dialogue":
      return cleanDialogue(project, target);

    case "nodeMapLocation":
      return cleanNodeMapLocation(project, target.nodeId);

    default:
      return assertNever(target);
  }
}