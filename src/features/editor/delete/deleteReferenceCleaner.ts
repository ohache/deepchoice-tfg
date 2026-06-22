import type { ID, InteractionRules, PlacedPlayer, PlayerDef, Project, RulePhrase } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import {
  effectReferencesDialogue, effectReferencesHotspot, effectReferencesHotspotVar, effectReferencesMapRegion,
  effectReferencesNode, effectReferencesNpc, effectReferencesNpcVar, effectReferencesItemInstance, effectReferencesPlayer,
  effectReferencesPlayerVar, effectReferencesSfx
} from "@/domain/effectRefs";
import {
  collectDialogueIds, effectIsStartDialogueForAnyOf, removeConditionsInProject, removeDialogues, removeEffectsInProject,
  removeEmptyInteractionRulesInProject, removeOnUseItemRulesForInstances, removePlacedItems, removePlacedNpcs, removePlacedPlayers,
  removeRulePhrasesInProject
} from "@/features/editor/delete/editorProjectWalkers";
import { removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { ensureDefaultImageId } from "@/features/editor/history/shared/genericHelpers";
import { removeAsset } from "@/features/editor/core/editorDataUtils";
import type { DeleteTarget } from "./deleteTypes";
import { rebuildMapsFromNodes, reconcileRegionEntryAfterNodeMapRemoval } from "@/features/editor/scene/node/NodeHelpers";

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

function clearMusicFromEndGameEffect(effect: Effect, trackId: ID): { effect: Effect; touched: boolean } {
  if (effect.type !== "endGame") return { effect, touched: false };
  if (effect.ending?.musicTrackId !== trackId) return { effect, touched: false };

  return {
    effect: {
      ...effect,
      ending: {
        ...effect.ending,
        musicTrackId: undefined,
      },
    },
    touched: true,
  };
}

function clearMusicFromEffects(
  effects: Effect[] | undefined,
  trackId: ID,
): { effects: Effect[] | undefined; touched: boolean } {
  if (!effects || effects.length === 0) return { effects, touched: false };

  let touched = false;

  const nextEffects = effects.map((effect) => {
    const result = clearMusicFromEndGameEffect(effect, trackId);
    if (result.touched) touched = true;
    return result.effect;
  });

  return touched
    ? { effects: nextEffects, touched: true }
    : { effects, touched: false };
}

function clearMusicFromInteractionRules(
  rules: InteractionRules | undefined,
  trackId: ID,
): { rules: InteractionRules | undefined; touched: boolean } {
  if (!rules) return { rules, touched: false };

  let touched = false;

  const mapRuleList = <T extends { effects: Effect[] }>(list: T[] | undefined): T[] | undefined => {
    if (!list || list.length === 0) return list;

    let touchedList = false;

    const nextList = list.map((rule) => {
      const result = clearMusicFromEffects(rule.effects, trackId);
      if (!result.touched) return rule;

      touchedList = true;
      return { ...rule, effects: result.effects ?? rule.effects };
    });

    if (touchedList) touched = true;
    return touchedList ? nextList : list;
  };

  const nextOnClick = mapRuleList(rules.onClick);
  const nextOnUseItem = mapRuleList(rules.onUseItem);

  if (!touched) return { rules, touched: false };

  return {
    rules: {
      ...rules,
      onClick: nextOnClick,
      onUseItem: nextOnUseItem,
    },
    touched: true,
  };
}

function clearMusicFromEndGameEffectsInProject(project: Project, trackId: ID): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    let touchedNode = false;

    const nextLayers = node.layers.map((layer) => {
      let touchedLayer = false;

      const mapRuleContainers = <T extends { rules?: InteractionRules }>(
        list: T[] | undefined,
      ): { list: T[] | undefined; touched: boolean } => {
        if (!list || list.length === 0) return { list, touched: false };

        let touchedList = false;

        const nextList = list.map((entry) => {
          const result = clearMusicFromInteractionRules(entry.rules, trackId);
          if (!result.touched) return entry;

          touchedList = true;
          return { ...entry, rules: result.rules ?? entry.rules } as T;
        });

        return touchedList
          ? { list: nextList, touched: true }
          : { list, touched: false };
      };

      const hotspotResult = mapRuleContainers(layer.hotspots);
      const placedItemResult = mapRuleContainers(layer.placedItems);
      const placedNpcResult = mapRuleContainers(layer.placedNpcs);

      if (hotspotResult.touched || placedItemResult.touched || placedNpcResult.touched) {
        touchedLayer = true;
      }

      if (!touchedLayer) return layer;

      touchedNode = true;

      return {
        ...layer,
        hotspots: hotspotResult.touched ? hotspotResult.list : layer.hotspots,
        placedItems: placedItemResult.touched ? placedItemResult.list : layer.placedItems,
        placedNpcs: placedNpcResult.touched ? placedNpcResult.list : layer.placedNpcs,
      };
    });

    const nextDialogues = (node.dialogues ?? []).map((dialogue) => {
      let touchedDialogue = false;

      const nextDialogueNodes = dialogue.nodes.map((dialogueNode) => {
        if (dialogueNode.type !== "line") return dialogueNode;

        const result = clearMusicFromEffects(dialogueNode.effects, trackId);
        if (!result.touched) return dialogueNode;

        touchedDialogue = true;
        return { ...dialogueNode, effects: result.effects };
      });

      if (!touchedDialogue) return dialogue;

      touchedNode = true;
      return { ...dialogue, nodes: nextDialogueNodes };
    });

    if (!touchedNode) return node;

    touchedNodes = true;

    return {
      ...node,
      layers: nextLayers,
      dialogues: nextDialogues,
    };
  });

  return touchedNodes ? { ...project, nodes: nextNodes } : project;
}

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

  const removedItemInstanceIds = new Set<ID>(
    (player.initialInventory ?? []).map((item) => item.itemInstanceId),
  );

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      effectReferencesPlayer(effect, playerId) ||
      effectIsStartDialogueForAnyOf(effect, dialogueIds) ||
      [...removedItemInstanceIds].some((itemInstanceId) =>
        effectReferencesItemInstance(effect, itemInstanceId),
      ),
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "playerVar" && condition.playerId === playerId) ||
      (condition.type === "hasItem" && condition.playerId === playerId) ||
      (condition.type === "placedPlayerVisible" && condition.playerId === playerId) ||
      (condition.type === "placedPlayerImage" && condition.playerId === playerId) ||
      (
        (
          condition.type === "hasItem" ||
          condition.type === "npcHasItem"
        ) &&
        removedItemInstanceIds.has(condition.itemInstanceId)
      ),
  );

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeRulePhrasesInProject(
    nextProject,
    (phrase) => phrase.speaker?.kind === "player" && phrase.speaker.playerId === playerId,
  );

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

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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

  nextProject = removeOnUseItemRulesForInstances(
    nextProject,
    new Set<ID>([input.itemInstanceId]),
  );

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanNpc(project: Project, npcId: ID): Project {
  const npc = project.npcs.find((entry) => entry.id === npcId);
  if (!npc) return project;

  const dialogueIds = collectDialogueIds(project, (dialogue) => dialogue.npcId === npcId);

  const removedItemInstanceIds = new Set<ID>(
    (npc.initialInventory ?? []).map((item) => item.itemInstanceId),
  );

  let nextProject = project;

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      effectReferencesNpc(effect, npcId) ||
      effectIsStartDialogueForAnyOf(effect, dialogueIds) ||
      [...removedItemInstanceIds].some((itemInstanceId) =>
        effectReferencesItemInstance(effect, itemInstanceId),
      ),
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "npcVar" && condition.npcId === npcId) ||
      (condition.type === "npcHasItem" && condition.npcId === npcId) ||
      (condition.type === "placedNpcVisible" && condition.npcId === npcId) ||
      (condition.type === "placedNpcReachable" && condition.npcId === npcId) ||
      (
        (
          condition.type === "hasItem" ||
          condition.type === "npcHasItem"
        ) &&
        removedItemInstanceIds.has(condition.itemInstanceId)
      ),
  );

  nextProject = removeOnUseItemRulesForInstances(nextProject, removedItemInstanceIds);

  nextProject = removeRulePhrasesInProject(
    nextProject,
    (phrase) => phrase.speaker?.kind === "npc" && phrase.speaker.npcId === npcId,
  );

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

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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

  nextProject = removeOnUseItemRulesForInstances(
    nextProject,
    new Set<ID>([input.itemInstanceId]),
  );

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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

  const sceneItemInstanceIds = project.nodes.flatMap((node) =>
    node.layers.flatMap((layer) =>
      (layer.placedItems ?? [])
        .filter((itemInstance) => itemInstance.itemId === itemId)
        .map((itemInstance) => itemInstance.itemInstanceId),
    ),
  );

  const removedItemInstanceIds = new Set<ID>([
    ...playerItemInstanceIds,
    ...npcItemInstanceIds,
    ...sceneItemInstanceIds,
  ]);

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
    (condition) =>
      (condition.type === "hasItem" && removedItemInstanceIds.has(condition.itemInstanceId)) ||
      (condition.type === "npcHasItem" && removedItemInstanceIds.has(condition.itemInstanceId)) ||
      (condition.type === "placedItemVisible" && removedItemInstanceIds.has(condition.itemInstanceId)) ||
      (condition.type === "placedItemReachable" && removedItemInstanceIds.has(condition.itemInstanceId)),
  );

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if (
      (effect.type === "transformItem" || effect.type === "combineItems") &&
      effect.resultItemId === itemId
    ) {
      return true;
    }

    for (const itemInstanceId of removedItemInstanceIds) {
      if (effectReferencesItemInstance(effect, itemInstanceId)) return true;
    }

    return false;
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

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) => condition.type === "musicPlaying" && condition.trackId === trackId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      (effect.type === "playMusic" || effect.type === "stopMusic") &&
      effect.trackId === trackId,
  );

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

  return removeNowUnusedAssets(nextProject, assetIdsToRemove);
}

function collectNodeInternalDeleteRefs(node: Project["nodes"][number]): {
  hotspotIds: Set<ID>;
  itemInstanceIds: Set<ID>;
  dialogueIds: Set<ID>;
} {
  const hotspotIds = new Set<ID>();
  const itemInstanceIds = new Set<ID>();
  const dialogueIds = new Set<ID>();

  for (const layer of node.layers ?? []) {
    for (const hotspot of layer.hotspots ?? []) {
      hotspotIds.add(hotspot.id);
    }

    for (const placedItem of layer.placedItems ?? []) {
      itemInstanceIds.add(placedItem.itemInstanceId);
    }
  }

  for (const dialogue of node.dialogues ?? []) {
    dialogueIds.add(dialogue.id);
  }

  return {
    hotspotIds,
    itemInstanceIds,
    dialogueIds,
  };
}

function cleanNode(project: Project, nodeId: ID): Project {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  if (!node) return project;

  const deletedWasStart = Boolean(node.isStart);
  const removedLoc = node.mapLocation;

  const layerAssetIds = new Set<ID>(
    node.layers.map((layer) => layer.assetId).filter(Boolean),
  );

  const {
    hotspotIds: removedHotspotIds,
    itemInstanceIds: removedItemInstanceIds,
    dialogueIds: removedDialogueIds,
  } = collectNodeInternalDeleteRefs(node);

  let nextNodes = removeById(project.nodes, nodeId);

  if (deletedWasStart && nextNodes.length > 0) {
    const nextStartId = nextNodes[0]!.id;

    nextNodes = nextNodes.map((entry) =>
      entry.id === nextStartId
        ? { ...entry, isStart: true }
        : { ...entry, isStart: false },
    );
  }

  nextNodes = reconcileRegionEntryAfterNodeMapRemoval(nextNodes, removedLoc);

  let nextProject: Project = {
    ...project,
    nodes: nextNodes,
    maps: rebuildMapsFromNodes(project.maps ?? [], nextNodes),
  };

  nextProject = removeConditionsInProject(nextProject, (condition) => {
    if ("nodeId" in condition && condition.nodeId === nodeId) return true;

    if (
      "hotspotId" in condition &&
      removedHotspotIds.has(condition.hotspotId)
    ) {
      return true;
    }

    if (
      "itemInstanceId" in condition &&
      removedItemInstanceIds.has(condition.itemInstanceId)
    ) {
      return true;
    }

    return false;
  });

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if (effectReferencesNode(effect, nodeId)) return true;
    if (effectIsStartDialogueForAnyOf(effect, removedDialogueIds)) return true;

    for (const hotspotId of removedHotspotIds) {
      if (effectReferencesHotspot(effect, hotspotId)) return true;
    }

    for (const itemInstanceId of removedItemInstanceIds) {
      if (effectReferencesItemInstance(effect, itemInstanceId)) return true;
    }

    return false;
  });

  nextProject = removeOnUseItemRulesForInstances(
    nextProject,
    removedItemInstanceIds,
  );

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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

  const removedHotspotIds = new Set<ID>(
    (layer.hotspots ?? []).map((hotspot) => hotspot.id),
  );

  const removedItemInstanceIds = new Set<ID>(
    (layer.placedItems ?? []).map((itemInstance) => itemInstance.itemInstanceId),
  );

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

  nextProject = removeConditionsInProject(nextProject, (condition) => {
    if (
      "nodeId" in condition &&
      "layerId" in condition &&
      condition.nodeId === input.nodeId &&
      condition.layerId === input.layerId
    ) {
      return true;
    }

    if (
      "hotspotId" in condition &&
      removedHotspotIds.has(condition.hotspotId)
    ) {
      return true;
    }

    if (
      "itemInstanceId" in condition &&
      removedItemInstanceIds.has(condition.itemInstanceId)
    ) {
      return true;
    }

    return false;
  });

  nextProject = removeEffectsInProject(nextProject, (effect) => {
    if (
      "nodeId" in effect &&
      "layerId" in effect &&
      effect.nodeId === input.nodeId &&
      effect.layerId === input.layerId
    ) {
      return true;
    }

    for (const hotspotId of removedHotspotIds) {
      if (effectReferencesHotspot(effect, hotspotId)) return true;
    }

    for (const itemInstanceId of removedItemInstanceIds) {
      if (effectReferencesItemInstance(effect, itemInstanceId)) return true;
    }

    return false;
  });

  nextProject = removeOnUseItemRulesForInstances(
    nextProject,
    removedItemInstanceIds,
  );

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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
            hotspots: (layer.hotspots ?? []).filter(
              (hotspot) => hotspot.id !== input.hotspotId,
            ),
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

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanPlacedItem(project: Project, input: { nodeId: ID; layerId: ID; placedItemId: ID }): Project {
  let nextProject = removePlacedItems(
    project,
    (placedItem) => placedItem.itemInstanceId === input.placedItemId,
  );

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (condition.type === "placedItemVisible" && condition.itemInstanceId === input.placedItemId) ||
      (condition.type === "placedItemReachable" && condition.itemInstanceId === input.placedItemId) ||
      (condition.type === "hasItem" && condition.itemInstanceId === input.placedItemId) ||
      (condition.type === "npcHasItem" && condition.itemInstanceId === input.placedItemId),
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) => effectReferencesItemInstance(effect, input.placedItemId),
  );

  nextProject = removeOnUseItemRulesForInstances(
    nextProject,
    new Set<ID>([input.placedItemId]),
  );

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

function cleanPlacedNpc(project: Project, input: { nodeId: ID; layerId: ID; npcId: ID }): Project {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const placedNpcExists = Boolean(
    layer?.placedNpcs?.some((placedNpc) => placedNpc.npcId === input.npcId),
  );

  if (!node || !layer || !placedNpcExists) return project;

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

  const nextNode = nextProject.nodes.find((entry) => entry.id === input.nodeId);

  const npcStillPlacedInNode = Boolean(
    nextNode?.layers.some((currentLayer) =>
      (currentLayer.placedNpcs ?? []).some(
        (placedNpc) => placedNpc.npcId === input.npcId,
      ),
    ),
  );

  const removedDialogueIds = new Set<ID>();

  if (!npcStillPlacedInNode) {
    for (const dialogue of node.dialogues ?? []) {
      if (dialogue.npcId === input.npcId) removedDialogueIds.add(dialogue.id);
    }

    nextProject = removeDialogues(
      nextProject,
      (dialogue) => removedDialogueIds.has(dialogue.id),
    );
  }

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (
        condition.type === "placedNpcVisible" ||
        condition.type === "placedNpcReachable"
      ) &&
      condition.nodeId === input.nodeId &&
      condition.layerId === input.layerId &&
      condition.npcId === input.npcId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      (
        effect.type === "setPlacedNpcVisible" ||
        effect.type === "setPlacedNpcReachable"
      ) &&
      effect.nodeId === input.nodeId &&
      effect.layerId === input.layerId &&
      effect.npcId === input.npcId,
  );

  if (removedDialogueIds.size > 0) {
    nextProject = removeEffectsInProject(
      nextProject,
      (effect) => effectIsStartDialogueForAnyOf(effect, removedDialogueIds),
    );
  }

  if (!npcStillPlacedInNode) {
    nextProject = removeShowMessagesBySpeakerInNode(
      nextProject,
      input.nodeId,
      { kind: "npc", id: input.npcId },
    );

    nextProject = removeRulePhrasesBySpeakerInNode(
      nextProject,
      input.nodeId,
      { kind: "npc", id: input.npcId },
    );
  }

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

  return nextProject;
}

type SceneSpeakerRef =
  | { kind: "player"; id: ID }
  | { kind: "npc"; id: ID };

function effectSpeakerMatches(effect: Effect, speaker: SceneSpeakerRef): boolean {
  if (effect.type !== "showMessage") return false;

  if (speaker.kind === "player") {
    return (
      effect.speaker?.kind === "player" &&
      effect.speaker.playerId === speaker.id
    );
  }

  return (
    effect.speaker?.kind === "npc" &&
    effect.speaker.npcId === speaker.id
  );
}

function phraseSpeakerMatches(phrase: RulePhrase | undefined, speaker: SceneSpeakerRef): boolean {
  if (!phrase?.speaker) return false;

  if (speaker.kind === "player") {
    return (
      phrase.speaker.kind === "player" &&
      phrase.speaker.playerId === speaker.id
    );
  }

  return (
    phrase.speaker.kind === "npc" &&
    phrase.speaker.npcId === speaker.id
  );
}

function removeShowMessagesBySpeakerInNode(
  project: Project,
  nodeId: ID,
  speaker: SceneSpeakerRef,
): Project {
  let touchedProject = false;

  const pruneEffects = (effects: Effect[] | undefined): { effects: Effect[] | undefined; touched: boolean } => {
    if (!effects || effects.length === 0) return { effects, touched: false };

    const nextEffects = effects.filter((effect) => !effectSpeakerMatches(effect, speaker));

    return nextEffects.length === effects.length
      ? { effects, touched: false }
      : { effects: nextEffects, touched: true };
  };

  const pruneRules = (rules: InteractionRules | undefined): { rules: InteractionRules | undefined; touched: boolean } => {
    if (!rules) return { rules, touched: false };

    let touched = false;

    const mapRuleList = <T extends { effects: Effect[] }>(list: T[] | undefined): T[] | undefined => {
      if (!list || list.length === 0) return list;

      let touchedList = false;

      const nextList = list.map((rule) => {
        const result = pruneEffects(rule.effects);
        if (!result.touched) return rule;

        touchedList = true;
        return { ...rule, effects: result.effects ?? [] };
      });

      if (touchedList) touched = true;
      return touchedList ? nextList : list;
    };

    const nextOnClick = mapRuleList(rules.onClick);
    const nextOnUseItem = mapRuleList(rules.onUseItem);

    if (!touched) return { rules, touched: false };

    return {
      rules: {
        ...rules,
        onClick: nextOnClick,
        onUseItem: nextOnUseItem,
      },
      touched: true,
    };
  };

  const nextNodes = project.nodes.map((node) => {
    if (node.id !== nodeId) return node;

    let touchedNode = false;

    const nextLayers = node.layers.map((layer) => {
      let touchedLayer = false;

      const mapRuleContainers = <T extends { rules?: InteractionRules }>(
        list: T[] | undefined,
      ): { list: T[] | undefined; touched: boolean } => {
        if (!list || list.length === 0) return { list, touched: false };

        let touchedList = false;

        const nextList = list.map((entry) => {
          const result = pruneRules(entry.rules);
          if (!result.touched) return entry;

          touchedList = true;
          return { ...entry, rules: result.rules ?? entry.rules } as T;
        });

        return touchedList
          ? { list: nextList, touched: true }
          : { list, touched: false };
      };

      const hotspotResult = mapRuleContainers(layer.hotspots);
      const placedItemResult = mapRuleContainers(layer.placedItems);
      const placedNpcResult = mapRuleContainers(layer.placedNpcs);

      if (hotspotResult.touched || placedItemResult.touched || placedNpcResult.touched) {
        touchedLayer = true;
      }

      if (!touchedLayer) return layer;

      touchedNode = true;

      return {
        ...layer,
        hotspots: hotspotResult.touched ? hotspotResult.list : layer.hotspots,
        placedItems: placedItemResult.touched ? placedItemResult.list : layer.placedItems,
        placedNpcs: placedNpcResult.touched ? placedNpcResult.list : layer.placedNpcs,
      };
    });

    const nextDialogues = (node.dialogues ?? []).map((dialogue) => {
      let touchedDialogue = false;

      const nextDialogueNodes = dialogue.nodes.map((dialogueNode) => {
        if (dialogueNode.type !== "line") return dialogueNode;

        const result = pruneEffects(dialogueNode.effects);
        if (!result.touched) return dialogueNode;

        touchedDialogue = true;
        return { ...dialogueNode, effects: result.effects };
      });

      if (!touchedDialogue) return dialogue;

      touchedNode = true;
      return { ...dialogue, nodes: nextDialogueNodes };
    });

    if (!touchedNode) return node;

    touchedProject = true;

    return {
      ...node,
      layers: nextLayers,
      dialogues: nextDialogues,
    };
  });

  return touchedProject ? { ...project, nodes: nextNodes } : project;
}

function removeRulePhrasesBySpeakerInNode(
  project: Project,
  nodeId: ID,
  speaker: SceneSpeakerRef,
): Project {
  let touchedProject = false;

  const cleanRules = (rules: InteractionRules | undefined): { rules: InteractionRules | undefined; touched: boolean } => {
    if (!rules) return { rules, touched: false };

    let touched = false;

    const mapRuleList = <T extends { phrase?: RulePhrase }>(list: T[] | undefined): T[] | undefined => {
      if (!list || list.length === 0) return list;

      let touchedList = false;

      const nextList = list.map((rule) => {
        if (!phraseSpeakerMatches(rule.phrase, speaker)) return rule;

        touchedList = true;
        return { ...rule, phrase: undefined };
      });

      if (touchedList) touched = true;
      return touchedList ? nextList : list;
    };

    const nextOnClick = mapRuleList(rules.onClick);
    const nextOnUseItem = mapRuleList(rules.onUseItem);

    if (!touched) return { rules, touched: false };

    return {
      rules: {
        ...rules,
        onClick: nextOnClick,
        onUseItem: nextOnUseItem,
      },
      touched: true,
    };
  };

  const nextNodes = project.nodes.map((node) => {
    if (node.id !== nodeId) return node;

    let touchedNode = false;

    const nextLayers = node.layers.map((layer) => {
      let touchedLayer = false;

      const mapRuleContainers = <T extends { rules?: InteractionRules }>(
        list: T[] | undefined,
      ): { list: T[] | undefined; touched: boolean } => {
        if (!list || list.length === 0) return { list, touched: false };

        let touchedList = false;

        const nextList = list.map((entry) => {
          const result = cleanRules(entry.rules);
          if (!result.touched) return entry;

          touchedList = true;
          return { ...entry, rules: result.rules ?? entry.rules } as T;
        });

        return touchedList
          ? { list: nextList, touched: true }
          : { list, touched: false };
      };

      const hotspotResult = mapRuleContainers(layer.hotspots);
      const placedItemResult = mapRuleContainers(layer.placedItems);
      const placedNpcResult = mapRuleContainers(layer.placedNpcs);

      if (hotspotResult.touched || placedItemResult.touched || placedNpcResult.touched) {
        touchedLayer = true;
      }

      if (!touchedLayer) return layer;

      touchedNode = true;

      return {
        ...layer,
        hotspots: hotspotResult.touched ? hotspotResult.list : layer.hotspots,
        placedItems: placedItemResult.touched ? placedItemResult.list : layer.placedItems,
        placedNpcs: placedNpcResult.touched ? placedNpcResult.list : layer.placedNpcs,
      };
    });

    if (!touchedNode) return node;

    touchedProject = true;
    return { ...node, layers: nextLayers };
  });

  return touchedProject ? { ...project, nodes: nextNodes } : project;
}

function cleanPlacedPlayer(project: Project, input: { nodeId: ID; layerId: ID; playerId: ID }): Project {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  const placedPlayerExists = Boolean(
    layer?.placedPlayers?.some((placedPlayer) => placedPlayer.playerId === input.playerId),
  );

  if (!node || !layer || !placedPlayerExists) return project;

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

  const nextNode = nextProject.nodes.find((entry) => entry.id === input.nodeId);

  const playerStillPlacedInNode = Boolean(
    nextNode?.layers.some((currentLayer) =>
      (currentLayer.placedPlayers ?? []).some(
        (placedPlayer) => placedPlayer.playerId === input.playerId,
      ),
    ),
  );

  const removedDialogueIds = new Set<ID>();

  if (!playerStillPlacedInNode) {
    for (const dialogue of node.dialogues ?? []) {
      if (dialogue.playerId === input.playerId) removedDialogueIds.add(dialogue.id);
    }

    nextProject = removeDialogues(
      nextProject,
      (dialogue) => removedDialogueIds.has(dialogue.id),
    );
  }

  nextProject = removeConditionsInProject(
    nextProject,
    (condition) =>
      (
        condition.type === "placedPlayerVisible" ||
        condition.type === "placedPlayerImage"
      ) &&
      condition.nodeId === input.nodeId &&
      condition.layerId === input.layerId &&
      condition.playerId === input.playerId,
  );

  nextProject = removeEffectsInProject(
    nextProject,
    (effect) =>
      (
        effect.type === "setPlacedPlayerVisible" ||
        effect.type === "setPlacedPlayerImage"
      ) &&
      effect.nodeId === input.nodeId &&
      effect.layerId === input.layerId &&
      effect.playerId === input.playerId,
  );

  if (removedDialogueIds.size > 0) {
    nextProject = removeEffectsInProject(
      nextProject,
      (effect) => effectIsStartDialogueForAnyOf(effect, removedDialogueIds),
    );
  }

  if (!playerStillPlacedInNode) {
    nextProject = removeShowMessagesBySpeakerInNode(
      nextProject,
      input.nodeId,
      { kind: "player", id: input.playerId },
    );

    nextProject = removeRulePhrasesBySpeakerInNode(
      nextProject,
      input.nodeId,
      { kind: "player", id: input.playerId },
    );
  }

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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

  nextProject = removeEmptyInteractionRulesInProject(nextProject);

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