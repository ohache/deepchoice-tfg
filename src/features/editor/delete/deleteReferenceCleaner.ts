import type { ID, PlacedPlayer, PlayerDef, Project } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import {
  effectReferencesDialogue,
  effectReferencesHotspot,
  effectReferencesHotspotVar,
  effectReferencesMapRegion,
  effectReferencesMusicTrack,
  effectReferencesNode,
  effectReferencesNpc,
  effectReferencesNpcVar,
  effectReferencesPlacedItem,
  effectReferencesPlayer,
  effectReferencesPlayerVar,
  effectReferencesSfx,
} from "@/domain/effectRefs";
import {
  collectDialogueIds,
  effectIsStartDialogueForAnyOf,
  removeConditionsInProject,
  removeDialogues,
  removeEffectsInProject,
  removePlacedItems,
  removePlacedNpcs,
  removePlacedPlayers,
} from "@/features/editor/core/editorProjectWalkers";
import { removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { ensureDefaultImageId } from "@/features/editor/history/shared/genericHelpers";
import { removeAsset } from "@/features/editor/core/editorGenericSlice";
import type { DeleteTarget } from "./deleteTypes";
import {
  rebuildMapsFromNodes,
  reconcileRegionEntryAfterNodeMapRemoval,
} from "@/features/editor/scene/node/editorNodeHelpersSlice";

function effectReferencesItemInstance(effect: Effect, itemInstanceId: ID): boolean {
  return effectReferencesPlacedItem(effect, itemInstanceId);
}

function removeAssetsByIds(project: Project, assetIds: Set<ID>): Project {
  if (assetIds.size === 0) return project;

  return {
    ...project,
    assets: project.assets.filter((asset) => !assetIds.has(asset.id)),
  };
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

function removeNowUnusedAssets(project: Project, candidateIds: Iterable<ID>): Project {
  const used = collectUsedAssetIds(project);
  const unused = new Set<ID>();

  for (const id of candidateIds) {
    if (!used.has(id)) unused.add(id);
  }

  return removeAssetsByIds(project, unused);
}

function removePlayerImageRefs(project: Project, input: { playerId: ID; imageId: ID; nextPlayer: PlayerDef }): Project {
  const { playerId, imageId, nextPlayer } = input;

  let nextProject = {
    ...project,
    nodes: project.nodes.map((node) => ({
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
            initialImageId: nextPlayer.defaultImageId,
          } as PlacedPlayer;
        });

        return touched ? { ...layer, placedPlayers: nextPlacedPlayers } : layer;
      }),
    })),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      condition.type === "placedPlayerImage" &&
      condition.playerId === playerId &&
      condition.imageId === imageId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      effect.type === "setPlacedPlayerImage" &&
      effect.playerId === playerId &&
      effect.imageId === imageId,
  );

  return nextProject;
}

function cleanPlayer(project: Project, playerId: ID): Project {
  const player = project.players.find((p) => p.id === playerId);
  if (!player) return project;

  const dialogueIds = collectDialogueIds(project, (dialogue) => dialogue.playerId === playerId);

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesPlayer(effect, playerId) || effectIsStartDialogueForAnyOf(effect, dialogueIds),
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "playerVar" && condition.playerId === playerId) ||
      (condition.type === "hasItem" && condition.playerId === playerId) ||
      (condition.type === "placedPlayerVisible" && condition.playerId === playerId) ||
      (condition.type === "placedPlayerImage" && condition.playerId === playerId),
  );

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

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      condition.type === "playerVar" &&
      condition.playerId === input.playerId &&
      condition.varId === input.varId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesPlayerVar(effect, input),
  );

  return nextProject;
}

function cleanPlayerInventoryItem(project: Project, input: { playerId: ID; itemInstanceId: ID }): Project {
  const player = project.players.find((p) => p.id === input.playerId);
  if (!player) return project;

  let nextProject = {
    ...project,
    players: replaceById(project.players, input.playerId, {
      ...player,
      initialInventory: (player.initialInventory ?? []).filter(
        (item) => item.itemInstanceId !== input.itemInstanceId,
      ),
    }),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "hasItem" && condition.itemInstanceId === input.itemInstanceId) ||
      (condition.type === "npcHasItem" && condition.itemInstanceId === input.itemInstanceId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesItemInstance(effect, input.itemInstanceId),
  );

  return nextProject;
}

function cleanNpc(project: Project, npcId: ID): Project {
  const dialogueIds = collectDialogueIds(project, (dialogue) => dialogue.npcId === npcId);

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesNpc(effect, npcId) || effectIsStartDialogueForAnyOf(effect, dialogueIds),
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "npcVar" && condition.npcId === npcId) ||
      (condition.type === "npcHasItem" && condition.npcId === npcId) ||
      (condition.type === "placedNpcVisible" && condition.npcId === npcId) ||
      (condition.type === "placedNpcReachable" && condition.npcId === npcId),
  );

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
    nextProject,
    (condition) =>
      condition.type === "npcVar" &&
      condition.npcId === input.npcId &&
      condition.varId === input.varId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesNpcVar(effect, input),
  );

  return nextProject;
}

function cleanNpcInventoryItem(project: Project, input: { npcId: ID; itemInstanceId: ID }): Project {
  const npc = project.npcs.find((n) => n.id === input.npcId);
  if (!npc) return project;

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
    nextProject,
    (condition) =>
      (condition.type === "hasItem" && condition.itemInstanceId === input.itemInstanceId) ||
      (condition.type === "npcHasItem" && condition.itemInstanceId === input.itemInstanceId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesItemInstance(effect, input.itemInstanceId),
  );

  return nextProject;
}

function cleanItem(project: Project, itemId: ID): Project {
  const playerItemInstanceIds = project.players.flatMap((player) =>
    (player.initialInventory ?? [])
      .filter((item) => item.itemId === itemId)
      .map((item) => item.itemInstanceId),
  );

  const npcItemInstanceIds = project.npcs.flatMap((npc) =>
    (npc.initialInventory ?? [])
      .filter((item) => item.itemId === itemId)
      .map((item) => item.itemInstanceId),
  );

  const placedItemIds = project.nodes.flatMap((node) =>
    node.layers.flatMap((layer) =>
      (layer.placedItems ?? [])
        .filter((placedItem) => placedItem.itemId === itemId)
        .map((placedItem) => placedItem.id),
    ),
  );

  const removedInstanceIds = new Set<ID>([
    ...playerItemInstanceIds,
    ...npcItemInstanceIds,
    ...placedItemIds,
  ]);

  let nextProject: Project = {
    ...project,
    items: removeById(project.items, itemId),
    players: project.players.map((player) => ({
      ...player,
      initialInventory: (player.initialInventory ?? []).filter((item) => item.itemId !== itemId),
    })),
    npcs: project.npcs.map((npc) => ({
      ...npc,
      initialInventory: (npc.initialInventory ?? []).filter((item) => item.itemId !== itemId),
    })),
    assets: removeAsset(project.assets, { id: itemId, kind: "items" }).assets,
  };

  nextProject = removePlacedItems(nextProject, (placedItem) => placedItem.itemId === itemId);

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "hasItem" && removedInstanceIds.has(condition.itemInstanceId)) ||
      (condition.type === "npcHasItem" && removedInstanceIds.has(condition.itemInstanceId)) ||
      (condition.type === "placedItemVisible" && removedInstanceIds.has(condition.placedItemId)) ||
      (condition.type === "placedItemReachable" && removedInstanceIds.has(condition.placedItemId)),
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if (
      (effect.type === "transformItem" || effect.type === "combineItems") &&
      effect.resultItemId === itemId
    ) {
      return true;
    }

    for (const itemInstanceId of removedInstanceIds) {
      if (effectReferencesItemInstance(effect, itemInstanceId)) return true;
    }

    return false;
  });

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

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesMusicTrack(effect, trackId),
  );

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
    nodes: project.nodes.map((node) =>
      node.mapLocation?.mapId === mapId
        ? { ...node, mapLocation: undefined }
        : node,
    ),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => condition.type === "mapRegionVisited" && condition.mapId === mapId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effect.type === "setMapRegionAvailable" && effect.mapId === mapId,
  );

  return removeAssetsByIds(nextProject, assetIdsToRemove);
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
      node.mapLocation?.mapId === input.mapId && node.mapLocation.regionId === input.regionId
        ? { ...node, mapLocation: undefined }
        : node,
    ),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      condition.type === "mapRegionVisited" &&
      condition.mapId === input.mapId &&
      condition.regionId === input.regionId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesMapRegion(effect, input),
  );

  return removeAssetsByIds(nextProject, assetIdsToRemove);
}

function cleanNode(project: Project, nodeId: ID): Project {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  if (!node) return project;

  const deletedWasStart = Boolean(node.isStart);
  const layerAssetIds = new Set<ID>(
    node.layers.map((layer) => layer.assetId).filter(Boolean),
  );

  let nextNodes = removeById(project.nodes, nodeId);

  if (deletedWasStart && nextNodes.length > 0) {
    const nextStartId = nextNodes[0]!.id;

    nextNodes = nextNodes.map((entry) =>
      entry.id === nextStartId
        ? { ...entry, isStart: true }
        : { ...entry, isStart: false },
    );
  }

  let nextProject: Project = {
    ...project,
    nodes: nextNodes,
    maps: project.maps.map((map) => ({
      ...map,
      regions: map.regions.map((region) => ({
        ...region,
        entrySceneId: region.entrySceneId === nodeId ? undefined : region.entrySceneId,
        sceneIds: region.sceneIds.filter((sceneId) => sceneId !== nodeId),
      })),
    })),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => condition.type === "nodeVisited" && condition.nodeId === nodeId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesNode(effect, nodeId),
  );

  return removeNowUnusedAssets(nextProject, layerAssetIds);
}

function cleanNodeMapLocation(project: Project, nodeId: ID): Project {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  const removedLoc = node?.mapLocation;

  if (!node || !removedLoc) return project;

  const nodesWithoutMapLocation = project.nodes.map((currentNode) =>
    currentNode.id === nodeId
      ? { ...currentNode, mapLocation: undefined }
      : currentNode,
  );

  const reconciledNodes = reconcileRegionEntryAfterNodeMapRemoval(
    nodesWithoutMapLocation,
    removedLoc,
  );

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

  const assetIdsToCheck = new Set<ID>();
  if (layer.assetId) assetIdsToCheck.add(layer.assetId);

  const removedHotspotIds = new Set<ID>((layer.hotspots ?? []).map((hotspot) => hotspot.id));
  const removedPlacedItemIds = new Set<ID>((layer.placedItems ?? []).map((item) => item.id));

  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((currentNode) => {
      if (currentNode.id !== input.nodeId) return currentNode;

      return {
        ...currentNode,
        layers: currentNode.layers.filter((currentLayer) => currentLayer.id !== input.layerId),
      };
    }),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => {
    if (
      (condition.type === "hotspotVar" ||
        condition.type === "hotspotVisible" ||
        condition.type === "hotspotReachable") &&
      removedHotspotIds.has(condition.hotspotId)
    ) {
      return true;
    }

    if (
      (condition.type === "placedItemVisible" ||
        condition.type === "placedItemReachable" ||
        condition.type === "hasItem" ||
        condition.type === "npcHasItem") &&
      (
        ("placedItemId" in condition && removedPlacedItemIds.has(condition.placedItemId)) ||
        ("itemInstanceId" in condition && removedPlacedItemIds.has(condition.itemInstanceId))
      )
    ) {
      return true;
    }

    if (
      (condition.type === "placedNpcVisible" ||
        condition.type === "placedNpcReachable") &&
      condition.nodeId === input.nodeId &&
      condition.layerId === input.layerId
    ) {
      return true;
    }

    if (
      (condition.type === "placedPlayerVisible" ||
        condition.type === "placedPlayerImage") &&
      condition.nodeId === input.nodeId &&
      condition.layerId === input.layerId
    ) {
      return true;
    }

    return false;
  });

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if ("nodeId" in effect && effect.nodeId === input.nodeId) {
      if ("layerId" in effect && effect.layerId === input.layerId) {
        return true;
      }
    }

    for (const hotspotId of removedHotspotIds) {
      if (effectReferencesHotspot(effect, hotspotId)) return true;
    }

    for (const placedItemId of removedPlacedItemIds) {
      if (effectReferencesPlacedItem(effect, placedItemId)) return true;
    }

    return false;
  });

  return removeNowUnusedAssets(nextProject, assetIdsToCheck);
}

function cleanHotspot(project: Project, input: { nodeId: ID; layerId: ID; hotspotId: ID }): Project {
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
            hotspots: (layer.hotspots ?? []).filter((hotspot) => hotspot.id !== input.hotspotId),
          };
        }),
      };
    }),
  };

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "hotspotVar" && condition.hotspotId === input.hotspotId) ||
      (condition.type === "hotspotVisible" && condition.hotspotId === input.hotspotId) ||
      (condition.type === "hotspotReachable" && condition.hotspotId === input.hotspotId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesHotspot(effect, input.hotspotId),
  );

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

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      condition.type === "hotspotVar" &&
      condition.hotspotId === input.hotspotId &&
      condition.varId === input.varId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesHotspotVar(effect, input),
  );

  return nextProject;
}

function cleanPlacedItem(project: Project, input: { nodeId: ID; layerId: ID; placedItemId: ID }): Project {
  let nextProject = removePlacedItems(
    project,
    (placedItem) => placedItem.id === input.placedItemId,
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "placedItemVisible" && condition.placedItemId === input.placedItemId) ||
      (condition.type === "placedItemReachable" && condition.placedItemId === input.placedItemId) ||
      (condition.type === "hasItem" && condition.itemInstanceId === input.placedItemId) ||
      (condition.type === "npcHasItem" && condition.itemInstanceId === input.placedItemId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesItemInstance(effect, input.placedItemId),
  );

  nextProject = {
    ...nextProject,
    nodes: nextProject.nodes.map((node) => ({
      ...node,
      layers: node.layers.map((layer) => ({
        ...layer,

        hotspots: (layer.hotspots ?? []).map((hotspot) => ({
          ...hotspot,
          rules: {
            ...hotspot.rules,
            onUseItem: (hotspot.rules?.onUseItem ?? []).filter(
              (rule) => rule.itemInstanceId !== input.placedItemId,
            ),
          },
        })),

        placedItems: (layer.placedItems ?? []).map((placedItem) => ({
          ...placedItem,
          rules: {
            ...placedItem.rules,
            onUseItem: (placedItem.rules?.onUseItem ?? []).filter(
              (rule) => rule.itemInstanceId !== input.placedItemId,
            ),
          },
        })),

        placedNpcs: (layer.placedNpcs ?? []).map((placedNpc) => ({
          ...placedNpc,
          rules: {
            ...placedNpc.rules,
            onUseItem: (placedNpc.rules?.onUseItem ?? []).filter(
              (rule) => rule.itemInstanceId !== input.placedItemId,
            ),
          },
        })),
      })),
    })),
  };

  return nextProject;
}

function cleanPlacedNpc(project: Project, input: { nodeId: ID; layerId: ID; npcId: ID }): Project {
  let nextProject = removePlacedNpcs(
    project,
    (placedNpc) => placedNpc.npcId === input.npcId,
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "placedNpcVisible" && condition.npcId === input.npcId) ||
      (condition.type === "placedNpcReachable" && condition.npcId === input.npcId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      effect.type === "setPlacedNpcVisible" && effect.npcId === input.npcId ||
      effect.type === "setPlacedNpcReachable" && effect.npcId === input.npcId,
  );

  return nextProject;
}

function cleanPlacedPlayer(project: Project, input: { nodeId: ID; layerId: ID; playerId: ID }): Project {
  let nextProject = removePlacedPlayers(
    project,
    (placedPlayer) => placedPlayer.playerId === input.playerId,
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "placedPlayerVisible" && condition.playerId === input.playerId) ||
      (condition.type === "placedPlayerImage" && condition.playerId === input.playerId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      (effect.type === "setPlacedPlayerVisible" && effect.playerId === input.playerId) ||
      (effect.type === "setPlacedPlayerImage" && effect.playerId === input.playerId),
  );

  return nextProject;
}

function cleanDialogue(project: Project, input: { nodeId: ID; dialogueId: ID }): Project {
  let nextProject: Project = {
    ...project,
    nodes: project.nodes.map((node) => {
      if (node.id !== input.nodeId) return node;

      return {
        ...node,
        dialogues: (node.dialogues ?? []).filter(
          (dialogue) => dialogue.id !== input.dialogueId,
        ),
      };
    }),
  };

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesDialogue(effect, input.dialogueId),
  );

  return nextProject;
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
      return project;
  }
}