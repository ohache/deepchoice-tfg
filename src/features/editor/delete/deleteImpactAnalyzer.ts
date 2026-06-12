import type {
  Dialogue,
  Hotspot,
  ID,
  InteractionRules,
  PlacedItem,
  PlacedNpc,
  PlacedPlayer,
  Project,
  SceneImageLayer,
} from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type {
  DeleteImpactEntry,
  DeleteImpactReport,
  DeleteImpactSeverity,
  DeleteLocation,
  DeleteTarget,
} from "./deleteTypes";

type Ctx = {
  nodeId?: ID;
  nodeLabel?: string;
  layerId?: ID;
  layerLabel?: string;
  ownerKind?: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | "dialogue" | "dialogueLine";
  ownerId?: ID;
  ownerLabel?: string;
  ruleId?: ID;
  dialogueId?: ID;
  dialogueLineId?: ID;
};

function label(value?: string | null, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function makeId(prefix: string, parts: Array<string | undefined>): string {
  return [prefix, ...parts.filter(Boolean)].join("::");
}

function location(ctx: Ctx, extra?: Partial<DeleteLocation>): DeleteLocation {
  const parts = [
    ctx.nodeLabel,
    ctx.layerLabel,
    ctx.ownerLabel,
    ctx.ruleId ? `Regla ${ctx.ruleId}` : undefined,
  ].filter(Boolean);

  return {
    kind: extra?.kind ?? "project",
    nodeId: ctx.nodeId,
    layerId: ctx.layerId,
    hotspotId: ctx.ownerKind === "hotspot" ? ctx.ownerId : undefined,
    placedItemId: ctx.ownerKind === "placedItem" ? ctx.ownerId : undefined,
    npcId: ctx.ownerKind === "placedNpc" ? ctx.ownerId : undefined,
    playerId: ctx.ownerKind === "placedPlayer" ? ctx.ownerId : undefined,
    dialogueId: ctx.dialogueId,
    dialogueLineId: ctx.dialogueLineId,
    label: parts.join(" > ") || extra?.label || "Proyecto",
    ...extra,
  };
}

function addEntry(
  entries: DeleteImpactEntry[],
  input: {
    id: string;
    severity: DeleteImpactSeverity;
    action: DeleteImpactEntry["action"];
    location: DeleteLocation;
    message: string;
  },
): void {
  entries.push(input);
}

/* ---------- Labels del objetivo ---------- */

function getTargetLabel(project: Project, target: DeleteTarget): string {
  switch (target.kind) {
    case "player":
      return `Player: ${label(project.players.find((p) => p.id === target.playerId)?.name, target.playerId)}`;

    case "playerImage": {
      const player = project.players.find((p) => p.id === target.playerId);
      const image = player?.images.find((img) => img.id === target.imageId);
      return `Imagen de player: ${label(image?.name, target.imageId)}`;
    }

    case "playerVar": {
      const player = project.players.find((p) => p.id === target.playerId);
      const variable = player?.vars?.find((v) => v.id === target.varId);
      return `Variable de player: ${label(variable?.name, target.varId)}`;
    }

    case "playerInventoryItem":
      return `Item de inventario inicial de player: ${target.itemInstanceId}`;

    case "npc":
      return `NPC: ${label(project.npcs.find((n) => n.id === target.npcId)?.name, target.npcId)}`;

    case "npcVar": {
      const npc = project.npcs.find((n) => n.id === target.npcId);
      const variable = npc?.vars?.find((v) => v.id === target.varId);
      return `Variable de NPC: ${label(variable?.name, target.varId)}`;
    }

    case "npcInventoryItem":
      return `Item de inventario inicial de NPC: ${target.itemInstanceId}`;

    case "item":
      return `Item: ${label(project.items.find((i) => i.id === target.itemId)?.name, target.itemId)}`;

    case "music":
      return `Música: ${label(project.musicTracks.find((m) => m.id === target.trackId)?.name, target.trackId)}`;

    case "sfx":
      return `Efecto de sonido: ${label(project.soundEffects.find((s) => s.id === target.sfxId)?.name, target.sfxId)}`;

    case "map":
      return `Mapa: ${label(project.maps.find((m) => m.id === target.mapId)?.name, target.mapId)}`;

    case "nodeMapLocation": {
      const node = project.nodes.find((n) => n.id === target.nodeId);
      return `Mapa asociado a escena: ${label(node?.title, target.nodeId)}`;
    }

    case "mapRegion": {
      const map = project.maps.find((m) => m.id === target.mapId);
      const region = map?.regions.find((r) => r.id === target.regionId);
      return `Región de mapa: ${label(region?.label, target.regionId)}`;
    }

    case "node":
      return `Escena: ${label(project.nodes.find((n) => n.id === target.nodeId)?.title, target.nodeId)}`;

    case "layer": {
      const node = project.nodes.find((n) => n.id === target.nodeId);
      const layer = node?.layers.find((l) => l.id === target.layerId);
      return `Variante de escena: ${label(layer?.label, target.layerId)}`;
    }

    case "dialogue": {
      const node = project.nodes.find((n) => n.id === target.nodeId);
      const dialogue = node?.dialogues?.find((d) => d.id === target.dialogueId);

      return `Diálogo: ${label(dialogue?.title, target.dialogueId)}`;
    }

    default:
      return target.kind;
  }
}

/* ---------- Matchers ---------- */

function conditionMatchesTarget(condition: Condition, target: DeleteTarget): boolean {
  switch (target.kind) {
    case "player":
      return (
        (condition.type === "playerVar" && condition.playerId === target.playerId) ||
        (condition.type === "hasItem" && condition.playerId === target.playerId) ||
        (condition.type === "placedPlayerVisible" && condition.playerId === target.playerId) ||
        (condition.type === "placedPlayerImage" && condition.playerId === target.playerId)
      );

    case "playerImage":
      return condition.type === "placedPlayerImage" &&
        condition.playerId === target.playerId &&
        condition.imageId === target.imageId;

    case "playerVar":
      return condition.type === "playerVar" &&
        condition.playerId === target.playerId &&
        condition.varId === target.varId;

    case "playerInventoryItem":
      return condition.type === "hasItem" &&
        condition.playerId === target.playerId &&
        condition.itemInstanceId === target.itemInstanceId;

    case "npc":
      return (
        (condition.type === "npcVar" && condition.npcId === target.npcId) ||
        (condition.type === "npcHasItem" && condition.npcId === target.npcId) ||
        (condition.type === "placedNpcVisible" && condition.npcId === target.npcId) ||
        (condition.type === "placedNpcReachable" && condition.npcId === target.npcId)
      );

    case "npcVar":
      return condition.type === "npcVar" &&
        condition.npcId === target.npcId &&
        condition.varId === target.varId;

    case "npcInventoryItem":
      return condition.type === "npcHasItem" &&
        condition.npcId === target.npcId &&
        condition.itemInstanceId === target.itemInstanceId;

    case "node":
      return condition.type === "nodeVisited" && condition.nodeId === target.nodeId;

    case "hotspot":
      return (
        (condition.type === "hotspotVar" && condition.hotspotId === target.hotspotId) ||
        (condition.type === "hotspotVisible" && condition.hotspotId === target.hotspotId) ||
        (condition.type === "hotspotReachable" && condition.hotspotId === target.hotspotId)
      );

    case "hotspotVar":
      return condition.type === "hotspotVar" &&
        condition.hotspotId === target.hotspotId &&
        condition.varId === target.varId;

    case "placedItem":
      return (
        (condition.type === "placedItemVisible" && condition.placedItemId === target.placedItemId) ||
        (condition.type === "placedItemReachable" && condition.placedItemId === target.placedItemId)
      );

    case "placedNpc":
      return (
        (condition.type === "placedNpcVisible" && condition.npcId === target.npcId) ||
        (condition.type === "placedNpcReachable" && condition.npcId === target.npcId)
      );

    case "placedPlayer":
      return (
        (condition.type === "placedPlayerVisible" && condition.playerId === target.playerId) ||
        (condition.type === "placedPlayerImage" && condition.playerId === target.playerId)
      );

    case "map":
      return condition.type === "mapRegionVisited" && condition.mapId === target.mapId;

    case "mapRegion":
      return condition.type === "mapRegionVisited" &&
        condition.mapId === target.mapId &&
        condition.regionId === target.regionId;

    default:
      return false;
  }
}

function effectMatchesTarget(effect: Effect, target: DeleteTarget): boolean {
  switch (target.kind) {
    case "player":
      return (
        (effect.type === "setPlayerVar" && effect.playerId === target.playerId) ||
        (effect.type === "togglePlayerVar" && effect.playerId === target.playerId) ||
        (effect.type === "incPlayerVar" && effect.playerId === target.playerId) ||
        (effect.type === "decPlayerVar" && effect.playerId === target.playerId) ||
        (effect.type === "setPlacedPlayerVisible" && effect.playerId === target.playerId) ||
        (effect.type === "setPlacedPlayerImage" && effect.playerId === target.playerId) ||
        (effect.type === "showMessage" && effect.speakerKind === "player" && effect.speakerId === target.playerId)
      );

    case "playerImage":
      return effect.type === "setPlacedPlayerImage" &&
        effect.playerId === target.playerId &&
        effect.imageId === target.imageId;

    case "playerVar":
      return (
        (effect.type === "setPlayerVar" && effect.playerId === target.playerId && effect.varId === target.varId) ||
        (effect.type === "togglePlayerVar" && effect.playerId === target.playerId && effect.varId === target.varId) ||
        (effect.type === "incPlayerVar" && effect.playerId === target.playerId && effect.varId === target.varId) ||
        (effect.type === "decPlayerVar" && effect.playerId === target.playerId && effect.varId === target.varId)
      );

    case "playerInventoryItem":
      return effectReferencesItemInstance(effect, target.itemInstanceId);

    case "npc":
      return (
        (effect.type === "setNpcVar" && effect.npcId === target.npcId) ||
        (effect.type === "toggleNpcVar" && effect.npcId === target.npcId) ||
        (effect.type === "incNpcVar" && effect.npcId === target.npcId) ||
        (effect.type === "decNpcVar" && effect.npcId === target.npcId) ||
        (effect.type === "setPlacedNpcVisible" && effect.npcId === target.npcId) ||
        (effect.type === "setPlacedNpcReachable" && effect.npcId === target.npcId) ||
        (effect.type === "giveItemToNpc" && effect.npcId === target.npcId) ||
        (effect.type === "receiveItemFromNpc" && effect.npcId === target.npcId) ||
        (effect.type === "showMessage" && effect.speakerKind === "npc" && effect.speakerId === target.npcId)
      );

    case "npcVar":
      return (
        (effect.type === "setNpcVar" && effect.npcId === target.npcId && effect.varId === target.varId) ||
        (effect.type === "toggleNpcVar" && effect.npcId === target.npcId && effect.varId === target.varId) ||
        (effect.type === "incNpcVar" && effect.npcId === target.npcId && effect.varId === target.varId) ||
        (effect.type === "decNpcVar" && effect.npcId === target.npcId && effect.varId === target.varId)
      );

    case "npcInventoryItem":
      return effectReferencesItemInstance(effect, target.itemInstanceId);

    case "item":
      return (
        (effect.type === "transformItem" && effect.resultItemId === target.itemId) ||
        (effect.type === "combineItems" && effect.resultItemId === target.itemId)
      );

    case "music":
      return effect.type === "playMusic" && effect.trackId === target.trackId;

    case "sfx":
      return effect.type === "playSfx" && effect.sfxId === target.sfxId;

    case "node":
      return effect.type === "goToNode" && effect.targetNodeId === target.nodeId;

    case "hotspot":
      return (
        (effect.type === "setHotspotVisible" && effect.hotspotId === target.hotspotId) ||
        (effect.type === "setHotspotReachable" && effect.hotspotId === target.hotspotId) ||
        (effect.type === "setHotspotVar" && effect.hotspotId === target.hotspotId) ||
        (effect.type === "toggleHotspotVar" && effect.hotspotId === target.hotspotId) ||
        (effect.type === "incHotspotVar" && effect.hotspotId === target.hotspotId) ||
        (effect.type === "decHotspotVar" && effect.hotspotId === target.hotspotId)
      );

    case "hotspotVar":
      return (
        (effect.type === "setHotspotVar" && effect.hotspotId === target.hotspotId && effect.varId === target.varId) ||
        (effect.type === "toggleHotspotVar" && effect.hotspotId === target.hotspotId && effect.varId === target.varId) ||
        (effect.type === "incHotspotVar" && effect.hotspotId === target.hotspotId && effect.varId === target.varId) ||
        (effect.type === "decHotspotVar" && effect.hotspotId === target.hotspotId && effect.varId === target.varId)
      );

    case "placedItem":
      return (
        (effect.type === "setPlacedItemVisible" && effect.itemInstanceId === target.placedItemId) ||
        (effect.type === "setPlacedItemReachable" && effect.itemInstanceId === target.placedItemId) ||
        effectReferencesItemInstance(effect, target.placedItemId)
      );

    case "placedNpc":
      return (
        (effect.type === "setPlacedNpcVisible" && effect.npcId === target.npcId) ||
        (effect.type === "setPlacedNpcReachable" && effect.npcId === target.npcId)
      );

    case "placedPlayer":
      return (
        (effect.type === "setPlacedPlayerVisible" && effect.playerId === target.playerId) ||
        (effect.type === "setPlacedPlayerImage" && effect.playerId === target.playerId)
      );

    case "map":
      return effect.type === "setMapRegionAvailable" && effect.mapId === target.mapId;

    case "mapRegion":
      return effect.type === "setMapRegionAvailable" &&
        effect.mapId === target.mapId &&
        effect.regionId === target.regionId;

    case "dialogue":
      return effect.type === "startDialogue" && effect.nodeDialogueId === target.dialogueId;

    default:
      return false;
  }
}

function effectReferencesItemInstance(effect: Effect, itemInstanceId: ID): boolean {
  switch (effect.type) {
    case "addItem":
    case "removeItem":
    case "giveItemToNpc":
    case "receiveItemFromNpc":
      return effect.itemInstanceId === itemInstanceId;

    case "transformItem":
      return effect.sourceItemInstanceId === itemInstanceId ||
        effect.resultItemInstanceId === itemInstanceId;

    case "combineItems":
      return effect.sourceItemInstanceId === itemInstanceId ||
        effect.targetItemInstanceId === itemInstanceId ||
        effect.resultItemInstanceId === itemInstanceId;

    default:
      return false;
  }
}

/* ---------- Walkers de condiciones y efectos ---------- */

function walkCondition(
  condition: Condition | undefined,
  visit: (condition: Condition) => void,
): void {
  if (!condition) return;

  visit(condition);

  switch (condition.type) {
    case "and":
      condition.all.forEach((child) => walkCondition(child, visit));
      break;
    case "or":
      condition.any.forEach((child) => walkCondition(child, visit));
      break;
    case "not":
      walkCondition(condition.cond, visit);
      break;
  }
}

function analyzeWhen(
  entries: DeleteImpactEntry[],
  when: Condition | undefined,
  target: DeleteTarget,
  ctx: Ctx,
): void {
  walkCondition(when, (condition) => {
    if (!conditionMatchesTarget(condition, target)) return;

    addEntry(entries, {
      id: makeId("condition", [
        ctx.nodeId,
        ctx.layerId,
        ctx.ownerId,
        ctx.ruleId,
        condition.type,
      ]),
      severity: "logic-change",
      action: "remove-condition",
      location: location(ctx, {
        kind: "condition",
        conditionType: condition.type,
      }),
      message: `Se eliminará una condición de tipo "${condition.type}".`,
    });
  });
}

function analyzeEffects(
  entries: DeleteImpactEntry[],
  effects: Effect[] | undefined,
  target: DeleteTarget,
  ctx: Ctx,
): void {
  for (const effect of effects ?? []) {
    if (!effectMatchesTarget(effect, target)) continue;

    const remainingEffects = (effects ?? []).filter((current) => current !== effect).length;
    const leavesRuleEmpty = Boolean(ctx.ruleId) && remainingEffects === 0;

    addEntry(entries, {
      id: makeId("effect", [
        ctx.nodeId,
        ctx.layerId,
        ctx.ownerId,
        ctx.ruleId,
        effect.type,
      ]),
      severity: leavesRuleEmpty ? "blocking-risk" : "logic-change",
      action: "remove-effect",
      location: location(ctx, {
        kind: "effect",
        effectType: effect.type,
      }),
      message: leavesRuleEmpty
        ? `Se eliminará el único efecto de esta regla. La regla quedará sin efectos.`
        : `Se eliminará un efecto de tipo "${effect.type}".`,
    });
  }
}

function analyzeRules(
  entries: DeleteImpactEntry[],
  rules: InteractionRules | undefined,
  target: DeleteTarget,
  ctx: Ctx,
): void {
  for (const rule of rules?.onClick ?? []) {
    const ruleCtx = { ...ctx, ruleId: rule.id };

    analyzeWhen(entries, rule.when, target, ruleCtx);
    analyzeEffects(entries, rule.effects, target, ruleCtx);
  }

  for (const rule of rules?.onUseItem ?? []) {
    const ruleCtx = { ...ctx, ruleId: rule.id };

    const ruleUsesDeletedItem =
      (
        (target.kind === "playerInventoryItem" || target.kind === "npcInventoryItem") &&
        rule.itemInstanceId === target.itemInstanceId
      ) ||
      (
        target.kind === "placedItem" &&
        rule.itemInstanceId === target.placedItemId
      );

    if (ruleUsesDeletedItem) {
      addEntry(entries, {
        id: makeId("use-item-rule", [ctx.nodeId, ctx.layerId, ctx.ownerId, rule.id]),
        severity: "blocking-risk",
        action: "remove-rule",
        location: location(ruleCtx, { kind: "rule" }),
        message: "Se eliminará una regla de uso de item porque dependía del item eliminado.",
      });
    }

    analyzeWhen(entries, rule.when, target, ruleCtx);
    analyzeEffects(entries, rule.effects, target, ruleCtx);
  }
}

/* ---------- Análisis de entidades directas ---------- */

function analyzeDirectNodeRefs(entries: DeleteImpactEntry[], project: Project, target: DeleteTarget): void {
  if (target.kind === "music") {
    for (const node of project.nodes) {
      if (node.musicTrackId === target.trackId) {
        addEntry(entries, {
          id: makeId("node-music", [node.id, target.trackId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "node",
            nodeId: node.id,
            label: `Escena ${label(node.title, node.id)}`,
          },
          message: `Se eliminará la música asociada a la escena.`,
        });
      }

      for (const layer of node.layers) {
        if (layer.musicTrackId === target.trackId) {
          addEntry(entries, {
            id: makeId("layer-music", [node.id, layer.id, target.trackId]),
            severity: "info",
            action: "clear-field",
            location: {
              kind: "layer",
              nodeId: node.id,
              layerId: layer.id,
              label: `${label(node.title, node.id)} > ${label(layer.label, layer.id)}`,
            },
            message: `Se eliminará la música asociada a la variante.`,
          });
        }
      }
    }
  }

  if (target.kind === "map") {
    for (const node of project.nodes) {
      if (node.mapLocation?.mapId === target.mapId) {
        addEntry(entries, {
          id: makeId("node-map-location", [node.id, target.mapId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "node",
            nodeId: node.id,
            label: `Escena ${label(node.title, node.id)}`,
          },
          message: `Se eliminará el mapa asociado a la escena.`,
        });
      }
    }
  }

  if (target.kind === "nodeMapLocation") {
    const node = project.nodes.find((entry) => entry.id === target.nodeId);
    const loc = node?.mapLocation;

    if (!node || !loc) return;

    const map = project.maps.find((entry) => entry.id === loc.mapId);
    const region = map?.regions.find((entry) => entry.id === loc.regionId);

    addEntry(entries, {
      id: makeId("node-map-location", [node.id, loc.mapId, loc.regionId]),
      severity: loc.isEntry ? "logic-change" : "info",
      action: "clear-field",
      location: {
        kind: "node",
        nodeId: node.id,
        mapId: loc.mapId,
        regionId: loc.regionId,
        label: `Escena ${label(node.title, node.id)}`,
      },
      message: loc.isEntry
        ? `Se eliminará el mapa asociado a la escena. Como era entrada de región, otra escena de la misma región pasará a ser entrada si existe.`
        : `Se eliminará el mapa asociado a la escena.`,
    });

    if (loc.isEntry) {
      const replacement = project.nodes.find(
        (candidate) =>
          candidate.id !== node.id &&
          candidate.mapLocation?.mapId === loc.mapId &&
          candidate.mapLocation.regionId === loc.regionId,
      );

      if (replacement) {
        addEntry(entries, {
          id: makeId("node-map-entry-replacement", [node.id, replacement.id, loc.mapId, loc.regionId]),
          severity: "logic-change",
          action: "replace-reference",
          location: {
            kind: "node",
            nodeId: replacement.id,
            mapId: loc.mapId,
            regionId: loc.regionId,
            label: `Escena ${label(replacement.title, replacement.id)}`,
          },
          message: `Esta escena pasará a ser la nueva entrada de la región "${label(region?.label, loc.regionId)}" del mapa "${label(map?.name, loc.mapId)}".`,
        });
      }
    }
  }

  if (target.kind === "mapRegion") {
    const map = project.maps.find((entry) => entry.id === target.mapId);
    const region = map?.regions.find((entry) => entry.id === target.regionId);

    if (region?.imageAssetId) {
      addEntry(entries, {
        id: makeId("map-region-image", [target.mapId, target.regionId, region.imageAssetId]),
        severity: "info",
        action: "delete-target",
        location: {
          kind: "map-region",
          mapId: target.mapId,
          regionId: target.regionId,
          label: `${label(map?.name, target.mapId)} > Región ${label(region.label, target.regionId)}`,
        },
        message: "Se eliminará la imagen asociada a esta región.",
      });
    }

    for (const node of project.nodes) {
      if (
        node.mapLocation?.mapId === target.mapId &&
        node.mapLocation.regionId === target.regionId
      ) {
        addEntry(entries, {
          id: makeId("node-map-region-location", [node.id, target.mapId, target.regionId]),
          severity: "logic-change",
          action: "clear-field",
          location: {
            kind: "node",
            nodeId: node.id,
            label: `Escena ${label(node.title, node.id)}`,
          },
          message: "La escena dejará de estar asociada a esta región del mapa.",
        });
      }
    }
  }
}

/* ---------- Recorrido principal ---------- */
function analyzeDeletedNodeContents(
  entries: DeleteImpactEntry[],
  node: Project["nodes"][number],
  nodeLabel: string,
): void {
  for (const layer of node.layers ?? []) {
    const layerLabel = label(layer.label, layer.id);

    addEntry(entries, {
      id: makeId("node-layer", [node.id, layer.id]),
      severity: "logic-change",
      action: "delete-target",
      location: {
        kind: "layer",
        nodeId: node.id,
        layerId: layer.id,
        label: `${nodeLabel} > ${layerLabel}`,
      },
      message: "Se eliminará esta variante de escena.",
    });

    for (const hotspot of layer.hotspots ?? []) {
      addEntry(entries, {
        id: makeId("node-hotspot", [node.id, layer.id, hotspot.id]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "hotspot",
          nodeId: node.id,
          layerId: layer.id,
          hotspotId: hotspot.id,
          label: `${nodeLabel} > ${layerLabel} > Hotspot ${label(hotspot.label, hotspot.id)}`,
        },
        message: "Se eliminará este hotspot y sus reglas.",
      });
    }

    for (const placedItem of layer.placedItems ?? []) {
      addEntry(entries, {
        id: makeId("node-placed-item", [node.id, layer.id, placedItem.id]),
        severity: "logic-change",
        action: "remove-placed-entity",
        location: {
          kind: "placed-item",
          nodeId: node.id,
          layerId: layer.id,
          placedItemId: placedItem.id,
          label: `${nodeLabel} > ${layerLabel} > Item ${label(placedItem.label, placedItem.id)}`,
        },
        message: "Se eliminará este item colocado.",
      });
    }

    for (const placedNpc of layer.placedNpcs ?? []) {
      addEntry(entries, {
        id: makeId("node-placed-npc", [node.id, layer.id, placedNpc.npcId]),
        severity: "logic-change",
        action: "remove-placed-entity",
        location: {
          kind: "placed-npc",
          nodeId: node.id,
          layerId: layer.id,
          npcId: placedNpc.npcId,
          label: `${nodeLabel} > ${layerLabel} > NPC ${placedNpc.npcId}`,
        },
        message: "Se eliminará este NPC colocado.",
      });
    }

    for (const placedPlayer of layer.placedPlayers ?? []) {
      addEntry(entries, {
        id: makeId("node-placed-player", [node.id, layer.id, placedPlayer.playerId]),
        severity: "logic-change",
        action: "remove-placed-entity",
        location: {
          kind: "placed-player",
          nodeId: node.id,
          layerId: layer.id,
          playerId: placedPlayer.playerId,
          label: `${nodeLabel} > ${layerLabel} > Player ${placedPlayer.playerId}`,
        },
        message: "Se eliminará este player colocado.",
      });
    }
  }

  for (const dialogue of node.dialogues ?? []) {
    addEntry(entries, {
      id: makeId("node-dialogue", [node.id, dialogue.id]),
      severity: "logic-change",
      action: "remove-dialogue",
      location: {
        kind: "dialogue",
        nodeId: node.id,
        dialogueId: dialogue.id,
        label: `${nodeLabel} > Diálogo ${label(dialogue.title, dialogue.id)}`,
      },
      message: "Se eliminará este diálogo.",
    });
  }
}

function analyzeDeletedLayerContents(
  entries: DeleteImpactEntry[],
  input: {
    nodeId: ID;
    nodeLabel: string;
    layer: SceneImageLayer;
  },
): void {
  const { nodeId, nodeLabel, layer } = input;
  const layerLabel = label(layer.label, layer.id);

  addEntry(entries, {
    id: makeId("layer", [nodeId, layer.id]),
    severity: "logic-change",
    action: "delete-target",
    location: {
      kind: "layer",
      nodeId,
      layerId: layer.id,
      label: `${nodeLabel} > ${layerLabel}`,
    },
    message: "Se eliminará esta variante de escena.",
  });

  if (layer.assetId) {
    addEntry(entries, {
      id: makeId("layer-image", [nodeId, layer.id, layer.assetId]),
      severity: "info",
      action: "delete-target",
      location: {
        kind: "layer",
        nodeId,
        layerId: layer.id,
        label: `${nodeLabel} > ${layerLabel}`,
      },
      message: "Se eliminará la imagen de fondo de esta variante si no la usa nadie más.",
    });
  }

  if (layer.musicTrackId) {
    addEntry(entries, {
      id: makeId("layer-music", [nodeId, layer.id, layer.musicTrackId]),
      severity: "info",
      action: "clear-field",
      location: {
        kind: "layer",
        nodeId,
        layerId: layer.id,
        label: `${nodeLabel} > ${layerLabel}`,
      },
      message: "Se eliminará la música asociada a esta variante.",
    });
  }

  for (const hotspot of layer.hotspots ?? []) {
    addEntry(entries, {
      id: makeId("layer-hotspot", [nodeId, layer.id, hotspot.id]),
      severity: "logic-change",
      action: "delete-target",
      location: {
        kind: "hotspot",
        nodeId,
        layerId: layer.id,
        hotspotId: hotspot.id,
        label: `${nodeLabel} > ${layerLabel} > Hotspot ${label(hotspot.label, hotspot.id)}`,
      },
      message: "Se eliminará este hotspot y sus reglas.",
    });
  }

  for (const placedItem of layer.placedItems ?? []) {
    addEntry(entries, {
      id: makeId("layer-placed-item", [nodeId, layer.id, placedItem.id]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: {
        kind: "placed-item",
        nodeId,
        layerId: layer.id,
        placedItemId: placedItem.id,
        label: `${nodeLabel} > ${layerLabel} > Item ${label(placedItem.label, placedItem.id)}`,
      },
      message: "Se eliminará este item colocado.",
    });
  }

  for (const placedNpc of layer.placedNpcs ?? []) {
    addEntry(entries, {
      id: makeId("layer-placed-npc", [nodeId, layer.id, placedNpc.npcId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: {
        kind: "placed-npc",
        nodeId,
        layerId: layer.id,
        npcId: placedNpc.npcId,
        label: `${nodeLabel} > ${layerLabel} > NPC ${placedNpc.npcId}`,
      },
      message: "Se eliminará este NPC colocado.",
    });
  }

  for (const placedPlayer of layer.placedPlayers ?? []) {
    addEntry(entries, {
      id: makeId("layer-placed-player", [nodeId, layer.id, placedPlayer.playerId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: {
        kind: "placed-player",
        nodeId,
        layerId: layer.id,
        playerId: placedPlayer.playerId,
        label: `${nodeLabel} > ${layerLabel} > Player ${placedPlayer.playerId}`,
      },
      message: "Se eliminará este player colocado.",
    });
  }
}

function analyzeLayer(
  entries: DeleteImpactEntry[],
  nodeLabel: string,
  nodeId: ID,
  layer: SceneImageLayer,
  target: DeleteTarget,
): void {
  const layerLabel = label(layer.label, layer.id);
  const baseCtx: Ctx = { nodeId, nodeLabel, layerId: layer.id, layerLabel };

  analyzeWhen(entries, layer.when, target, baseCtx);

  for (const textEntry of layer.text) {
    analyzeWhen(entries, textEntry.when, target, {
      ...baseCtx,
      ownerKind: "dialogueLine",
      ownerId: textEntry.id,
      ownerLabel: `Texto ${label(textEntry.label, textEntry.id)}`,
    });
  }

  for (const hotspot of layer.hotspots ?? []) {
    analyzeHotspot(entries, hotspot, target, baseCtx);
  }

  for (const placedItem of layer.placedItems ?? []) {
    analyzePlacedItem(entries, placedItem, target, baseCtx);
  }

  for (const placedNpc of layer.placedNpcs ?? []) {
    analyzePlacedNpc(entries, placedNpc, target, baseCtx);
  }

  for (const placedPlayer of layer.placedPlayers ?? []) {
    analyzePlacedPlayer(entries, placedPlayer, target, baseCtx);
  }
}

function analyzeHotspot(
  entries: DeleteImpactEntry[],
  hotspot: Hotspot,
  target: DeleteTarget,
  baseCtx: Ctx,
): void {
  if (target.kind === "hotspot" && hotspot.id === target.hotspotId) {
    addEntry(entries, {
      id: makeId("hotspot", [baseCtx.nodeId, baseCtx.layerId, hotspot.id]),
      severity: "logic-change",
      action: "delete-target",
      location: location(baseCtx, {
        kind: "hotspot",
        hotspotId: hotspot.id,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Hotspot ${label(hotspot.label, hotspot.id)}`,
      }),
      message: "Se eliminará el hotspot completo y sus reglas.",
    });

    return;
  }

  analyzeRules(entries, hotspot.rules, target, {
    ...baseCtx,
    ownerKind: "hotspot",
    ownerId: hotspot.id,
    ownerLabel: `Hotspot ${label(hotspot.label, hotspot.id)}`,
  });
}

function analyzePlacedItem(
  entries: DeleteImpactEntry[],
  placedItem: PlacedItem,
  target: DeleteTarget,
  baseCtx: Ctx,
): void {
  if (target.kind === "placedItem" && placedItem.id === target.placedItemId) {
    addEntry(entries, {
      id: makeId("placed-item", [baseCtx.nodeId, baseCtx.layerId, placedItem.id]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-item",
        placedItemId: placedItem.id,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Item colocado ${label(placedItem.label, placedItem.id)}`,
      }),
      message: "Se eliminará este item colocado.",
    });

    return;
  }

  if (target.kind === "item" && placedItem.itemId === target.itemId) {
    addEntry(entries, {
      id: makeId("placed-item", [baseCtx.nodeId, baseCtx.layerId, placedItem.id]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-item",
        placedItemId: placedItem.id,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Item colocado ${label(placedItem.label, placedItem.id)}`,
      }),
      message: "Se eliminará este item colocado porque usa el item global eliminado.",
    });

    return;
  }

  analyzeRules(entries, placedItem.rules, target, {
    ...baseCtx,
    ownerKind: "placedItem",
    ownerId: placedItem.id,
    ownerLabel: `Item colocado ${label(placedItem.label, placedItem.id)}`,
  });
}

function analyzePlacedNpc(
  entries: DeleteImpactEntry[],
  placedNpc: PlacedNpc,
  target: DeleteTarget,
  baseCtx: Ctx,
): void {
  if (
    (target.kind === "placedNpc" && placedNpc.npcId === target.npcId) ||
    (target.kind === "npc" && placedNpc.npcId === target.npcId)
  ) {
    addEntry(entries, {
      id: makeId("placed-npc", [baseCtx.nodeId, baseCtx.layerId, placedNpc.npcId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-npc",
        npcId: placedNpc.npcId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > NPC colocado ${placedNpc.npcId}`,
      }),
      message: target.kind === "npc"
        ? "Se eliminará este NPC colocado porque usa el NPC global eliminado."
        : "Se eliminará este NPC colocado.",
    });

    return;
  }

  analyzeRules(entries, placedNpc.rules, target, {
    ...baseCtx,
    ownerKind: "placedNpc",
    ownerId: placedNpc.npcId,
    ownerLabel: `NPC colocado ${placedNpc.npcId}`,
  });
}

function analyzePlacedPlayer(
  entries: DeleteImpactEntry[],
  placedPlayer: PlacedPlayer,
  target: DeleteTarget,
  baseCtx: Ctx,
): void {
  if (
    (target.kind === "placedPlayer" && placedPlayer.playerId === target.playerId) ||
    (target.kind === "player" && placedPlayer.playerId === target.playerId)
  ) {
    addEntry(entries, {
      id: makeId("placed-player", [baseCtx.nodeId, baseCtx.layerId, placedPlayer.playerId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-player",
        playerId: placedPlayer.playerId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Player colocado ${placedPlayer.playerId}`,
      }),
      message: target.kind === "player"
        ? "Se eliminará este player colocado porque usa el player global eliminado."
        : "Se eliminará este player colocado.",
    });
  }
}

function analyzeDialogue(
  entries: DeleteImpactEntry[],
  dialogue: Dialogue,
  nodeId: ID,
  nodeLabel: string,
  target: DeleteTarget,
): void {
  if (target.kind === "dialogue" && dialogue.id === target.dialogueId) {
    addEntry(entries, {
      id: makeId("dialogue", [nodeId, dialogue.id]),
      severity: "logic-change",
      action: "remove-dialogue",
      location: {
        kind: "dialogue",
        nodeId,
        dialogueId: dialogue.id,
        label: `${nodeLabel} > Diálogo ${label(dialogue.title, dialogue.id)}`,
      },
      message: "Se eliminará este diálogo.",
    });

    return;
  }

  if (
    (target.kind === "player" && dialogue.playerId === target.playerId) ||
    (target.kind === "npc" && dialogue.npcId === target.npcId)
  ) {
    addEntry(entries, {
      id: makeId("dialogue", [nodeId, dialogue.id]),
      severity: "logic-change",
      action: "remove-dialogue",
      location: {
        kind: "dialogue",
        nodeId,
        dialogueId: dialogue.id,
        label: `${nodeLabel} > Diálogo ${label(dialogue.title, dialogue.id)}`,
      },
      message: "Se eliminará el diálogo completo.",
    });
  }

  analyzeWhen(entries, dialogue.when, target, {
    nodeId,
    nodeLabel,
    ownerKind: "dialogue",
    ownerId: dialogue.id,
    ownerLabel: `Diálogo ${label(dialogue.title, dialogue.id)}`,
    dialogueId: dialogue.id,
  });

  for (const dialogueNode of dialogue.nodes) {
    if (dialogueNode.type !== "line") continue;

    const ctx: Ctx = {
      nodeId,
      nodeLabel,
      ownerKind: "dialogueLine",
      ownerId: dialogueNode.id,
      ownerLabel: `Línea de diálogo ${dialogueNode.id}`,
      dialogueId: dialogue.id,
      dialogueLineId: dialogueNode.id,
    };

    analyzeWhen(entries, dialogueNode.when, target, ctx);
    analyzeEffects(entries, dialogueNode.effects, target, ctx);
  }
}

export function analyzeDeleteImpact(project: Project | null, target: DeleteTarget): DeleteImpactReport {
  const entries: DeleteImpactEntry[] = [];

  if (!project) {
    return {
      target,
      targetLabel: target.kind,
      entries,
    };
  }

  analyzeDirectNodeRefs(entries, project, target);

  for (const node of project.nodes) {
    const nodeLabel = label(node.title, node.id);

    if (target.kind === "node" && node.id === target.nodeId) {
      addEntry(entries, {
        id: makeId("node", [node.id]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "node",
          nodeId: node.id,
          label: `Escena ${nodeLabel}`,
        },
        message: "Se eliminará la escena completa.",
      });

      analyzeDeletedNodeContents(entries, node, nodeLabel);
      continue;
    }

    if (target.kind === "layer" && node.id === target.nodeId) {
      const layer = node.layers.find((entry) => entry.id === target.layerId);

      if (layer) {
        analyzeDeletedLayerContents(entries, {
          nodeId: node.id,
          nodeLabel,
          layer,
        });
      }

      continue;
    }

    for (const layer of node.layers) {
      analyzeLayer(entries, nodeLabel, node.id, layer, target);
    }

    for (const dialogue of node.dialogues ?? []) {
      analyzeDialogue(entries, dialogue, node.id, nodeLabel, target);
    }
  }

  return {
    target,
    targetLabel: getTargetLabel(project, target),
    entries,
  };
}