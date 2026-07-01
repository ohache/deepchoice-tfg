import type { Dialogue, Hotspot, ID, InteractionRules, ItemInstance, PlacedNpc, PlacedPlayer, Project, RulePhrase, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { DeleteImpactEntry, DeleteImpactReport, DeleteImpactSeverity, DeleteLocation, DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { conditionMatchesDeleteTarget, effectMatchesDeleteTarget } from "@/features/editor/delete/deleteReferenceQueries";
import { buildDeleteCascadeContext, type DeleteCascadeContext } from "@/features/editor/delete/deleteCascadeContext";

type Ctx = {
  nodeId?: ID;
  nodeLabel?: string;
  layerId?: ID;
  layerLabel?: string;
  ownerKind?: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | "dialogue" | "dialogueLine";
  ownerId?: ID;
  ownerLabel?: string;
  ruleId?: ID;
  ruleLabel?: string;
  dialogueId?: ID;
  dialogueLineId?: ID;
};

type AnalysisOptions = Partial<DeleteCascadeContext>;

function label(value?: string | null, fallback = "—"): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

function getRuleLabel(rule: { id: ID; label?: string }): string {
  return label(rule.label, rule.id);
}

function getPlayerLabel(project: Project, playerId: ID): string {
  return label(project.players.find((player) => player.id === playerId)?.name, playerId);
}

function getNpcLabel(project: Project, npcId: ID): string {
  return label(project.npcs.find((npc) => npc.id === npcId)?.name, npcId);
}

function getPlayerInventoryItemLabel(project: Project, input: { playerId: ID; itemInstanceId: ID }): string {
  const player = project.players.find((entry) => entry.id === input.playerId);
  const item = player?.initialInventory?.find((entry) => entry.itemInstanceId === input.itemInstanceId);

  return label(item?.label, input.itemInstanceId);
}

function getNpcInventoryItemLabel(project: Project, input: { npcId: ID; itemInstanceId: ID }): string {
  const npc = project.npcs.find((entry) => entry.id === input.npcId);
  const item = npc?.initialInventory?.find((entry) => entry.itemInstanceId === input.itemInstanceId);

  return label(item?.label, input.itemInstanceId);
}

function makeId(prefix: string, parts: Array<string | undefined>): string {
  return [prefix, ...parts.filter(Boolean)].join("::");
}

function location(ctx: Ctx, extra?: Partial<DeleteLocation>): DeleteLocation {
  const ruleLabel = ctx.ruleId ? `Regla ${label(ctx.ruleLabel, ctx.ruleId)}` : undefined;

  const parts = [ctx.nodeLabel, ctx.layerLabel, ctx.ownerLabel, ruleLabel].filter(Boolean);

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

function addEntry(entries: DeleteImpactEntry[], input: {
  id: string; severity: DeleteImpactSeverity; action: DeleteImpactEntry["action"];
  location: DeleteLocation; message: string
}): void {
  entries.push(input);
}

function analyzeDeletedGlobalItemRefs(entries: DeleteImpactEntry[], project: Project, itemId: ID): void {
  for (const player of project.players) {
    for (const item of player.initialInventory ?? []) {
      if (item.itemId !== itemId) continue;

      addEntry(entries, {
        id: makeId("player-inventory-item", [player.id, item.itemInstanceId]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "player",
          playerId: player.id,
          placedItemId: item.itemInstanceId,
          label: `Jugador ${label(player.name, player.id)} > Inventario ${label(item.label, item.itemInstanceId)}`,
        },
        message: "Se eliminará este objeto del inventario inicial del jugador.",
      });
    }
  }

  for (const npc of project.npcs) {
    for (const item of npc.initialInventory ?? []) {
      if (item.itemId !== itemId) continue;

      addEntry(entries, {
        id: makeId("npc-inventory-item", [npc.id, item.itemInstanceId]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "npc",
          npcId: npc.id,
          placedItemId: item.itemInstanceId,
          label: `PNJ ${label(npc.name, npc.id)} > Inventario ${label(item.label, item.itemInstanceId)}`,
        },
        message: "Se eliminará este objeto del inventario inicial del PNJ.",
      });
    }
  }
}

function phraseMatchesDeleteTarget(phrase: RulePhrase | undefined, target: DeleteTarget, ctx?: Ctx, options: AnalysisOptions = {}): boolean {
  if (!phrase?.speaker) return false;

  if (target.kind === "player") return phrase.speaker.kind === "player" && phrase.speaker.playerId === target.playerId;

  if (target.kind === "npc") return phrase.speaker.kind === "npc" && phrase.speaker.npcId === target.npcId;

  const removedSpeaker = options.removedSceneSpeaker;

  if (!removedSpeaker || ctx?.nodeId !== removedSpeaker.nodeId) return false;

  if (removedSpeaker.kind === "player") return (phrase.speaker.kind === "player" && phrase.speaker.playerId === removedSpeaker.id);

  return (phrase.speaker.kind === "npc" && phrase.speaker.npcId === removedSpeaker.id);
}

function conditionWillBeRemoved(condition: Condition, target: DeleteTarget, options: AnalysisOptions = {}): boolean {
  const matchesTarget = conditionMatchesDeleteTarget(condition, target);

  const matchesRemovedItemInstance = options.removedItemInstanceIds && "itemInstanceId" in condition && options.removedItemInstanceIds.has(condition.itemInstanceId);

  const matchesRemovedHotspot = options.removedHotspotIds && "hotspotId" in condition && options.removedHotspotIds.has(condition.hotspotId);

  return Boolean(matchesTarget || matchesRemovedItemInstance || matchesRemovedHotspot);
}

function conditionAfterDelete(condition: Condition | undefined, target: DeleteTarget, options: AnalysisOptions = {}): Condition | undefined {
  if (!condition) return undefined;

  switch (condition.type) {
    case "and": {
      const nextAll = condition.all.map((child) => conditionAfterDelete(child, target, options)).filter(Boolean) as Condition[];

      if (nextAll.length === 0) return undefined;
      if (nextAll.length === 1) return nextAll[0];

      return nextAll.length === condition.all.length ? condition : { ...condition, all: nextAll };
    }

    case "or": {
      const nextAny = condition.any.map((child) => conditionAfterDelete(child, target, options)).filter(Boolean) as Condition[];

      if (nextAny.length === 0) return undefined;
      if (nextAny.length === 1) return nextAny[0];

      return nextAny.length === condition.any.length ? condition : { ...condition, any: nextAny };
    }

    case "not": {
      const nextCond = conditionAfterDelete(condition.cond, target, options);
      if (!nextCond) return undefined;

      return nextCond === condition.cond ? condition : { ...condition, cond: nextCond };
    }

    default:
      return conditionWillBeRemoved(condition, target, options) ? undefined : condition;
  }
}

function endGameMusicWillBeCleared(effect: Effect, target: DeleteTarget): boolean {
  return (target.kind === "music" && effect.type === "endGame" && effect.ending?.musicTrackId === target.trackId);
}

function effectSpeakerMatchesRemovedSceneSpeaker(effect: Effect, ctx: Ctx, options: AnalysisOptions = {}): boolean {
  const removedSpeaker = options.removedSceneSpeaker;

  if (!removedSpeaker || ctx.nodeId !== removedSpeaker.nodeId) return false;
  if (effect.type !== "showMessage") return false;

  if (removedSpeaker.kind === "player") return (effect.speaker?.kind === "player" && effect.speaker.playerId === removedSpeaker.id);

  return (effect.speaker?.kind === "npc" && effect.speaker.npcId === removedSpeaker.id);
}

function effectWillBeRemoved(effect: Effect, target: DeleteTarget, options: AnalysisOptions = {}): boolean {
  if (target.kind === "music") return ((effect.type === "playMusic" || effect.type === "stopMusic") && effect.trackId === target.trackId);

  const matchesTarget = effectMatchesDeleteTarget(effect, target);

  const matchesRemovedDialogue = options.removedDialogueIds && effect.type === "startDialogue" && options.removedDialogueIds.has(effect.nodeDialogueId);

  const matchesRemovedHotspot = options.removedHotspotIds && "hotspotId" in effect && options.removedHotspotIds.has(effect.hotspotId);

  const matchesRemovedItemInstance = options.removedItemInstanceIds && "itemInstanceId" in effect && options.removedItemInstanceIds.has(effect.itemInstanceId);

  const matchesRemovedTransformOrCombineItemInstance = options.removedItemInstanceIds &&
    ((effect.type === "transformItem" && options.removedItemInstanceIds.has(effect.itemInstanceId)) ||
      (effect.type === "combineItems" && (options.removedItemInstanceIds.has(effect.itemAInstanceId) || options.removedItemInstanceIds.has(effect.itemBInstanceId)))
    );

  return Boolean(matchesTarget || matchesRemovedDialogue || matchesRemovedHotspot || matchesRemovedItemInstance || matchesRemovedTransformOrCombineItemInstance);
}

function ruleWillBeRemovedAfterDelete(rule: { when?: Condition; phrase?: RulePhrase; effects: Effect[] },
  target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): boolean {
  const nextWhen = conditionAfterDelete(rule.when, target, options);

  const remainingEffects = rule.effects.filter((effect) => !effectWillBeRemoved(effect, target, options) && !effectSpeakerMatchesRemovedSceneSpeaker(effect, ctx, options));

  if (!nextWhen && remainingEffects.length === 0) return true;

  return false;
}

function analyzeRuleRemovalIfEmptyAfterDelete(entries: DeleteImpactEntry[], rule: { id: ID; when?: Condition; phrase?: RulePhrase; effects: Effect[] },
  target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): void {
  if (!ruleWillBeRemovedAfterDelete(rule, target, ctx, options)) return;

  addEntry(entries, {
    id: makeId("empty-rule-after-delete", [ctx.nodeId, ctx.layerId, ctx.ownerId, rule.id]),
    severity: "logic-change",
    action: "remove-rule",
    location: location(ctx, { kind: "rule" }),
    message: "La regla quedará sin condición ni efectos tras eliminar sus referencias y se borrará automáticamente.",
  });
}

function analyzePhrase(entries: DeleteImpactEntry[], phrase: RulePhrase | undefined, target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): void {
  if (!phraseMatchesDeleteTarget(phrase, target, ctx, options)) return;

  addEntry(entries, {
    id: makeId("phrase", [ctx.nodeId, ctx.layerId, ctx.ownerId, ctx.ruleId]),
    severity: "logic-change",
    action: "remove-phrase",
    location: location(ctx, { kind: "phrase" }),
    message: "Se eliminará la frase de esta regla porque su emisor será eliminado de la escena.",
  });
}

/* ---------- Labels del objetivo ---------- */
function getTargetLabel(project: Project, target: DeleteTarget): string {
  switch (target.kind) {
    case "player":
      return `Jugador: ${getPlayerLabel(project, target.playerId)}`;

    case "playerImage": {
      const player = project.players.find((p) => p.id === target.playerId);
      const image = player?.images.find((img) => img.id === target.imageId);
      return `Imagen de jugador: ${label(image?.name, target.imageId)}`;
    }

    case "playerVar": {
      const player = project.players.find((p) => p.id === target.playerId);
      const variable = player?.vars?.find((v) => v.id === target.varId);
      return `Variable de jugador: ${label(variable?.name, target.varId)}`;
    }

    case "playerInventoryItem":
      return `Objeto de inventario inicial de jugador: ${getPlayerInventoryItemLabel(project, target)}`;

    case "npc":
      return `PNJ: ${getNpcLabel(project, target.npcId)}`;

    case "npcVar": {
      const npc = project.npcs.find((n) => n.id === target.npcId);
      const variable = npc?.vars?.find((v) => v.id === target.varId);
      return `Variable de PNJ: ${label(variable?.name, target.varId)}`;
    }

    case "npcInventoryItem":
      return `Objeto de inventario inicial de PNJ: ${getNpcInventoryItemLabel(project, target)}`;

    case "item":
      return `Objeto: ${label(project.items.find((i) => i.id === target.itemId)?.name, target.itemId)}`;

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

    case "hotspot": {
      const node = project.nodes.find((entry) => entry.id === target.nodeId);
      const layer = node?.layers.find((entry) => entry.id === target.layerId);
      const hotspot = layer?.hotspots?.find((entry) => entry.id === target.hotspotId);

      return `Hotspot: ${label(hotspot?.label, target.hotspotId)}`;
    }

    case "hotspotVar": {
      const node = project.nodes.find((entry) => entry.id === target.nodeId);
      const layer = node?.layers.find((entry) => entry.id === target.layerId);
      const hotspot = layer?.hotspots?.find((entry) => entry.id === target.hotspotId);
      const variable = hotspot?.vars.find((entry) => entry.id === target.varId);

      return `Variable de hotspot: ${label(variable?.name, target.varId)}`;
    }

    case "placedItem": {
      const node = project.nodes.find((entry) => entry.id === target.nodeId);
      const layer = node?.layers.find((entry) => entry.id === target.layerId);
      const placedItem = layer?.placedItems?.find((entry) => entry.itemInstanceId === target.placedItemId);

      return `Objeto colocado: ${label(placedItem?.label, target.placedItemId)}`;
    }

    case "placedPlayer": {
      return `Jugador colocado: ${getPlayerLabel(project, target.playerId)}`;
    }

    case "placedNpc": {
      return `PNJ colocado: ${getNpcLabel(project, target.npcId)}`;
    }

    case "dialogue": {
      const node = project.nodes.find((n) => n.id === target.nodeId);
      const dialogue = node?.dialogues?.find((d) => d.id === target.dialogueId);

      return `Diálogo: ${label(dialogue?.title, target.dialogueId)}`;
    }

    default:
      return assertNever(target);
  }
}

function assertNever(value: never): never {
  throw new Error(`DeleteTarget no contemplado: ${JSON.stringify(value)}`);
}

/* ---------- Walkers de condiciones y efectos ---------- */
function walkCondition(condition: Condition | undefined, visit: (condition: Condition) => void): void {
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

function analyzeWhen(entries: DeleteImpactEntry[], when: Condition | undefined, target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): void {
  walkCondition(when, (condition) => {
    if (!conditionWillBeRemoved(condition, target, options)) return;

    addEntry(entries, {
      id: makeId("condition", [ctx.nodeId, ctx.layerId, ctx.ownerId, ctx.ruleId, condition.type]),
      severity: "logic-change",
      action: "remove-condition",
      location: location(ctx, { kind: "condition", conditionType: condition.type }),
      message: `Se eliminará una condición de tipo "${condition.type}".`,
    });
  });
}

function analyzeEffects(entries: DeleteImpactEntry[], effects: Effect[] | undefined, target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): void {
  for (const effect of effects ?? []) {
    if (endGameMusicWillBeCleared(effect, target)) {
      addEntry(entries, {
        id: makeId("end-game-music", [ctx.nodeId, ctx.layerId, ctx.ownerId, ctx.ruleId, effect.type]),
        severity: "logic-change",
        action: "clear-field",
        location: location(ctx, {
          kind: "effect",
          effectType: effect.type,
        }),
        message: "Se eliminará la música asociada a este final, pero se conservará el efecto de fin de juego.",
      });

      continue;
    }

    const removedBySceneSpeaker = effectSpeakerMatchesRemovedSceneSpeaker(effect, ctx, options);

    if (!effectWillBeRemoved(effect, target, options) && !removedBySceneSpeaker) continue;

    const remainingEffects = (effects ?? []).filter((current) => current !== effect).length;
    const leavesRuleWithoutEffects = Boolean(ctx.ruleId) && remainingEffects === 0;

    addEntry(entries, {
      id: makeId("effect", [ctx.nodeId, ctx.layerId, ctx.ownerId, ctx.ruleId, effect.type]),
      severity: "logic-change",
      action: "remove-effect",
      location: location(ctx, {
        kind: "effect",
        effectType: effect.type,
      }),
      message: removedBySceneSpeaker ? `Se eliminará un mensaje de tipo "${effect.type}" porque su emisor será eliminado de la escena.` : leavesRuleWithoutEffects
        ? `Se eliminará el único efecto de esta regla. La regla quedará sin efectos y deberá revisarse si conserva frase o condición.` : `Se eliminará un efecto de tipo "${effect.type}".`,
    });
  }
}

function analyzeRules(entries: DeleteImpactEntry[], rules: InteractionRules | undefined, target: DeleteTarget, ctx: Ctx, options: AnalysisOptions = {}): void {
  for (const rule of rules?.onClick ?? []) {
    const ruleCtx = { ...ctx, ruleId: rule.id, ruleLabel: getRuleLabel(rule) };

    analyzePhrase(entries, rule.phrase, target, ruleCtx, options);
    analyzeWhen(entries, rule.when, target, ruleCtx, options);
    analyzeEffects(entries, rule.effects, target, ruleCtx, options);
    analyzeRuleRemovalIfEmptyAfterDelete(entries, rule, target, ruleCtx, options);
  }

  for (const rule of rules?.onUseItem ?? []) {
    const ruleCtx = { ...ctx, ruleId: rule.id, ruleLabel: getRuleLabel(rule) };

    const ruleUsesDeletedItem = ((target.kind === "playerInventoryItem" || target.kind === "npcInventoryItem") &&
      rule.itemInstanceId === target.itemInstanceId) || (target.kind === "placedItem" && rule.itemInstanceId === target.placedItemId) ||
      Boolean(options.removedItemInstanceIds?.has(rule.itemInstanceId));

    if (ruleUsesDeletedItem) {
      addEntry(entries, {
        id: makeId("use-item-rule", [ctx.nodeId, ctx.layerId, ctx.ownerId, rule.id]),
        severity: "logic-change",
        action: "remove-rule",
        location: location(ruleCtx, { kind: "rule" }),
        message: "Se eliminará una regla de uso de objeto porque dependía de un objeto eliminado.",
      });

      continue;
    }

    analyzePhrase(entries, rule.phrase, target, ruleCtx, options);
    analyzeWhen(entries, rule.when, target, ruleCtx, options);
    analyzeEffects(entries, rule.effects, target, ruleCtx, options);
    analyzeRuleRemovalIfEmptyAfterDelete(entries, rule, target, ruleCtx, options);
  }
}

/* ---------- Análisis de entidades directas ---------- */
function analyzeDirectNodeRefs(entries: DeleteImpactEntry[], project: Project, target: DeleteTarget): void {
  if (target.kind === "item") analyzeDeletedGlobalItemRefs(entries, project, target.itemId);

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
          message: "Se eliminará la música asociada a la escena.",
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
            message: "Se eliminará la música asociada a la variante.",
          });
        }
      }
    }

    for (const map of project.maps) {
      for (const region of map.regions) {
        if (region.musicTrackId !== target.trackId) continue;

        addEntry(entries, {
          id: makeId("map-region-music", [map.id, region.id, target.trackId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "map-region",
            mapId: map.id,
            regionId: region.id,
            label: `${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
          },
          message: "Se eliminará la música asociada a la región del mapa.",
        });
      }
    }
  }

  if (target.kind === "map") {
    const map = project.maps.find((entry) => entry.id === target.mapId);

    if (map?.visual.type === "singleImage") {
      addEntry(entries, {
        id: makeId("map-visual-image", [target.mapId, map.visual.imageAssetId]),
        severity: "info",
        action: "delete-target",
        location: {
          kind: "map",
          mapId: target.mapId,
          label: `Mapa ${label(map.name, target.mapId)}`,
        },
        message: "Se eliminará la imagen visual de este mapa si no la usa nadie más.",
      });
    }

    if (map?.visual.type === "composed") {
      addEntry(entries, {
        id: makeId("map-visual-background", [target.mapId, map.visual.backgroundAssetId]),
        severity: "info",
        action: "delete-target",
        location: {
          kind: "map",
          mapId: target.mapId,
          label: `Mapa ${label(map.name, target.mapId)}`,
        },
        message: "Se eliminará la imagen de fondo de este mapa compuesto si no la usa nadie más.",
      });
    }

    for (const currentMap of project.maps) {
      if (currentMap.id === target.mapId) continue;

      for (const region of currentMap.regions) {
        if (region.subMapId !== target.mapId) continue;

        addEntry(entries, {
          id: makeId("external-map-region-submap", [currentMap.id, region.id, target.mapId]),
          severity: "logic-change",
          action: "clear-field",
          location: {
            kind: "map-region",
            mapId: currentMap.id,
            regionId: region.id,
            label: `${label(currentMap.name, currentMap.id)} > Región ${label(region.label, region.id)}`,
          },
          message: "Se eliminará la referencia a este mapa como submapa de esta región.",
        });
      }
    }

    for (const region of map?.regions ?? []) {
      addEntry(entries, {
        id: makeId("map-region", [target.mapId, region.id]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "map-region",
          mapId: target.mapId,
          regionId: region.id,
          label: `${label(map?.name, target.mapId)} > Región ${label(region.label, region.id)}`,
        },
        message: "Se eliminará esta región porque pertenece al mapa eliminado.",
      });

      if (region.imageAssetId) {
        addEntry(entries, {
          id: makeId("map-region-image", [target.mapId, region.id, region.imageAssetId]),
          severity: "info",
          action: "delete-target",
          location: {
            kind: "map-region",
            mapId: target.mapId,
            regionId: region.id,
            label: `${label(map?.name, target.mapId)} > Región ${label(region.label, region.id)}`,
          },
          message: "Se eliminará la imagen asociada a esta región.",
        });
      }

      if (region.musicTrackId) {
        addEntry(entries, {
          id: makeId("map-region-music", [target.mapId, region.id, region.musicTrackId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "map-region",
            mapId: target.mapId,
            regionId: region.id,
            label: `${label(map?.name, target.mapId)} > Región ${label(region.label, region.id)}`,
          },
          message: "Se eliminará la música asociada a esta región.",
        });
      }

      if (region.subMapId) {
        addEntry(entries, {
          id: makeId("map-region-submap", [target.mapId, region.id, region.subMapId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "map-region",
            mapId: target.mapId,
            regionId: region.id,
            label: `${label(map?.name, target.mapId)} > Región ${label(region.label, region.id)}`,
          },
          message: "Se eliminará el submapa asociado a esta región.",
        });
      }
    }

    for (const node of project.nodes) {
      if (node.mapLocation?.mapId === target.mapId) {
        addEntry(entries, {
          id: makeId("node-map-location", [node.id, target.mapId]),
          severity: "info",
          action: "clear-field",
          location: {
            kind: "node",
            nodeId: node.id,
            mapId: target.mapId,
            regionId: node.mapLocation.regionId,
            label: `Escena ${label(node.title, node.id)}`,
          },
          message: "La escena dejará de estar asociada al mapa eliminado.",
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
      message: loc.isEntry ? `Se eliminará el mapa asociado a la escena. Como era entrada de región, otra escena de la misma región pasará a ser entrada si existe.`
        : `Se eliminará el mapa asociado a la escena.`,
    });

    if (loc.isEntry) {
      const replacement = project.nodes.find((candidate) => candidate.id !== node.id && candidate.mapLocation?.mapId === loc.mapId && candidate.mapLocation.regionId === loc.regionId);

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

    if (region) {
      addEntry(entries, {
        id: makeId("map-region", [target.mapId, target.regionId]),
        severity: "logic-change",
        action: "delete-target",
        location: {
          kind: "map-region",
          mapId: target.mapId,
          regionId: target.regionId,
          label: `${label(map?.name, target.mapId)} > Región ${label(region.label, target.regionId)}`,
        },
        message: "Se eliminará esta región del mapa.",
      });
    }

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
        message: "Se eliminará la imagen asociada a esta región si no la usa nadie más.",
      });
    }

    if (region?.musicTrackId) {
      addEntry(entries, {
        id: makeId("map-region-music", [target.mapId, target.regionId, region.musicTrackId]),
        severity: "info",
        action: "clear-field",
        location: {
          kind: "map-region",
          mapId: target.mapId,
          regionId: target.regionId,
          label: `${label(map?.name, target.mapId)} > Región ${label(region.label, target.regionId)}`,
        },
        message: "Se eliminará la música asociada a esta región.",
      });
    }

    if (region?.subMapId) {
      addEntry(entries, {
        id: makeId("map-region-submap", [target.mapId, target.regionId, region.subMapId]),
        severity: "info",
        action: "clear-field",
        location: {
          kind: "map-region",
          mapId: target.mapId,
          regionId: target.regionId,
          label: `${label(map?.name, target.mapId)} > Región ${label(region.label, target.regionId)}`,
        },
        message: "Se eliminará el submapa asociado a esta región.",
      });
    }

    for (const node of project.nodes) {
      if (node.mapLocation?.mapId === target.mapId && node.mapLocation.regionId === target.regionId) {
        addEntry(entries, {
          id: makeId("node-map-region-location", [node.id, target.mapId, target.regionId]),
          severity: "logic-change",
          action: "clear-field",
          location: {
            kind: "node",
            nodeId: node.id,
            mapId: target.mapId,
            regionId: target.regionId,
            label: `Escena ${label(node.title, node.id)}`,
          },
          message: "La escena dejará de estar asociada a esta región del mapa.",
        });
      }
    }
  }

  if (target.kind === "placedNpc") {
    const node = project.nodes.find((entry) => entry.id === target.nodeId);
    const layer = node?.layers.find((entry) => entry.id === target.layerId);

    const placedNpcExists = Boolean(layer?.placedNpcs?.some((placedNpc) => placedNpc.npcId === target.npcId));

    if (node && placedNpcExists) {
      const npcStillPlacedInNodeAfterDelete = node.layers.some((currentLayer) =>
        (currentLayer.placedNpcs ?? []).some((placedNpc) => {
          if (currentLayer.id === target.layerId && placedNpc.npcId === target.npcId) return false;

          return placedNpc.npcId === target.npcId;
        }),
      );

      if (!npcStillPlacedInNodeAfterDelete) {
        for (const dialogue of node.dialogues ?? []) {
          if (dialogue.npcId !== target.npcId) continue;

          addEntry(entries, {
            id: makeId("placed-npc-dialogue", [node.id, dialogue.id, target.npcId]),
            severity: "logic-change",
            action: "remove-dialogue",
            location: {
              kind: "dialogue",
              nodeId: node.id,
              dialogueId: dialogue.id,
              label: `${label(node.title, node.id)} > Diálogo ${label(dialogue.title, dialogue.id)}`,
            },
            message: "Se eliminará este diálogo porque el PNJ dejará de aparecer en la escena.",
          });
        }
      }
    }
  }

  if (target.kind === "placedPlayer") {
    const node = project.nodes.find((entry) => entry.id === target.nodeId);
    const layer = node?.layers.find((entry) => entry.id === target.layerId);

    const placedPlayerExists = Boolean(layer?.placedPlayers?.some((placedPlayer) => placedPlayer.playerId === target.playerId));

    if (node && placedPlayerExists) {
      const playerStillPlacedInNodeAfterDelete = node.layers.some((currentLayer) =>
        (currentLayer.placedPlayers ?? []).some((placedPlayer) => {
          if (currentLayer.id === target.layerId && placedPlayer.playerId === target.playerId) return false;

          return placedPlayer.playerId === target.playerId;
        }),
      );

      if (!playerStillPlacedInNodeAfterDelete) {
        for (const dialogue of node.dialogues ?? []) {
          if (dialogue.playerId !== target.playerId) continue;

          addEntry(entries, {
            id: makeId("placed-player-dialogue", [node.id, dialogue.id, target.playerId]),
            severity: "logic-change",
            action: "remove-dialogue",
            location: {
              kind: "dialogue",
              nodeId: node.id,
              dialogueId: dialogue.id,
              label: `${label(node.title, node.id)} > Diálogo ${label(dialogue.title, dialogue.id)}`,
            },
            message: "Se eliminará este diálogo porque el jugador dejará de aparecer en la escena.",
          });
        }
      }
    }
  }
}

/* ---------- Recorrido principal ---------- */
function analyzeDeletedNodeContents(entries: DeleteImpactEntry[], project: Project, node: Project["nodes"][number], nodeLabel: string): void {
  if (node.isStart) {
    const replacement = project.nodes.find((entry) => entry.id !== node.id);

    addEntry(entries, {
      id: makeId("node-start", [node.id, replacement?.id]),
      severity: "logic-change",
      action: replacement ? "replace-reference" : "clear-field",
      location: {
        kind: "node",
        nodeId: node.id,
        label: `Escena ${nodeLabel}`,
      },
      message: replacement ? `La escena era la escena inicial. "${label(replacement.title, replacement.id)}" pasará a ser la nueva escena inicial.`
        : "La escena era la escena inicial. El proyecto quedará sin escena inicial.",
    });
  }

  if (node.musicTrackId) {
    addEntry(entries, {
      id: makeId("node-music", [node.id, node.musicTrackId]),
      severity: "info",
      action: "clear-field",
      location: {
        kind: "node",
        nodeId: node.id,
        label: `Escena ${nodeLabel}`,
      },
      message: "Se eliminará la música asociada a esta escena.",
    });
  }

  if (node.mapLocation) {
    const loc = node.mapLocation;
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
        label: `Escena ${nodeLabel}`,
      },
      message: loc.isEntry
        ? `La escena era entrada de la región "${label(region?.label, loc.regionId)}" del mapa "${label(map?.name, loc.mapId)}". Si existe otra escena en esa región, pasará a ser la nueva entrada.`
        : `La escena dejará de estar asociada a la región "${label(region?.label, loc.regionId)}" del mapa "${label(map?.name, loc.mapId)}".`,
    });
  }

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

    if (layer.assetId) {
      addEntry(entries, {
        id: makeId("node-layer-image", [node.id, layer.id, layer.assetId]),
        severity: "info",
        action: "delete-target",
        location: {
          kind: "layer",
          nodeId: node.id,
          layerId: layer.id,
          label: `${nodeLabel} > ${layerLabel}`,
        },
        message: "Se eliminará la imagen de fondo de esta variante si no la usa nadie más.",
      });
    }

    if (layer.musicTrackId) {
      addEntry(entries, {
        id: makeId("node-layer-music", [node.id, layer.id, layer.musicTrackId]),
        severity: "info",
        action: "clear-field",
        location: {
          kind: "layer",
          nodeId: node.id,
          layerId: layer.id,
          label: `${nodeLabel} > ${layerLabel}`,
        },
        message: "Se eliminará la música asociada a esta variante.",
      });
    }

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
        id: makeId("node-placed-item", [node.id, layer.id, placedItem.itemInstanceId]),
        severity: "logic-change",
        action: "remove-placed-entity",
        location: {
          kind: "placed-item",
          nodeId: node.id,
          layerId: layer.id,
          placedItemId: placedItem.itemInstanceId,
          label: `${nodeLabel} > ${layerLabel} > Objeto ${label(placedItem.label, placedItem.itemInstanceId)}`,
        },
        message: "Se eliminará este objeto colocado.",
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
          label: `${nodeLabel} > ${layerLabel} > PNJ ${placedNpc.npcId}`,
        },
        message: "Se eliminará este PNJ colocado.",
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
          label: `${nodeLabel} > ${layerLabel} > Jugador ${getPlayerLabel(project, placedPlayer.playerId)}`,
        },
        message: "Se eliminará este jugador colocado.",
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

function analyzeDeletedLayerContents(entries: DeleteImpactEntry[], project: Project, input: { nodeId: ID; nodeLabel: string; layer: SceneImageLayer }): void {
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
      id: makeId("layer-placed-item", [nodeId, layer.id, placedItem.itemInstanceId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: {
        kind: "placed-item",
        nodeId,
        layerId: layer.id,
        placedItemId: placedItem.itemInstanceId,
        label: `${nodeLabel} > ${layerLabel} > Objeto ${label(placedItem.label, placedItem.itemInstanceId)}`,
      },
      message: "Se eliminará este objeto colocado.",
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
        label: `${nodeLabel} > ${layerLabel} > PNJ ${getNpcLabel(project, placedNpc.npcId)}`,
      },
      message: "Se eliminará este PNJ colocado.",
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
        label: `${nodeLabel} > ${layerLabel} > Jugador ${getPlayerLabel(project, placedPlayer.playerId)}`,
      },
      message: "Se eliminará este jugador colocado.",
    });
  }
}

function analyzeLayerRemovedDialogues(entries: DeleteImpactEntry[], input: { node: Project["nodes"][number]; nodeLabel: string; removedDialogueIds: Set<ID> | undefined }): void {
  const { node, nodeLabel, removedDialogueIds } = input;

  if (!removedDialogueIds || removedDialogueIds.size === 0) return;

  for (const dialogue of node.dialogues ?? []) {
    if (!removedDialogueIds.has(dialogue.id)) continue;

    addEntry(entries, {
      id: makeId("layer-dialogue", [node.id, dialogue.id]),
      severity: "logic-change",
      action: "remove-dialogue",
      location: {
        kind: "dialogue",
        nodeId: node.id,
        dialogueId: dialogue.id,
        label: `${nodeLabel} > Diálogo ${label(dialogue.title, dialogue.id)}`,
      },
      message: "Se eliminará este diálogo porque al borrar la capa dejará de estar presente en la escena un jugador o PNJ implicado.",
    });
  }
}

function analyzeLayer(entries: DeleteImpactEntry[], project: Project, nodeLabel: string, nodeId: ID, layer: SceneImageLayer, target: DeleteTarget, options: AnalysisOptions = {}): void {
  const layerLabel = label(layer.label, layer.id);
  const baseCtx: Ctx = { nodeId, nodeLabel, layerId: layer.id, layerLabel };

  analyzeWhen(entries, layer.when, target, baseCtx, options);

  for (const textEntry of layer.text) {
    analyzeWhen(entries, textEntry.when, target, {
      ...baseCtx, ownerKind: "dialogueLine", ownerId: textEntry.id,
      ownerLabel: `Texto ${label(textEntry.label, textEntry.id)}`
    }, options);
  }

  for (const hotspot of layer.hotspots ?? []) {
    analyzeHotspot(entries, hotspot, target, baseCtx, options);
  }

  for (const placedItem of layer.placedItems ?? []) {
    analyzePlacedItem(entries, placedItem, target, baseCtx, options);
  }

  for (const placedNpc of layer.placedNpcs ?? []) {
    analyzePlacedNpc(entries, project, placedNpc, target, baseCtx, options);
  }

  for (const placedPlayer of layer.placedPlayers ?? []) {
    analyzePlacedPlayer(entries, project, placedPlayer, target, baseCtx, options);
  }
}

function analyzeHotspot(entries: DeleteImpactEntry[], hotspot: Hotspot, target: DeleteTarget, baseCtx: Ctx, options: AnalysisOptions = {}): void {
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
      message: "Se eliminará el hotspot completo, sus variables y sus reglas.",
    });

    return;
  }

  analyzeRules(entries, hotspot.rules, target, {
    ...baseCtx, ownerKind: "hotspot", ownerId: hotspot.id,
    ownerLabel: `Hotspot ${label(hotspot.label, hotspot.id)}`
  }, options);
}

function analyzePlacedItem(entries: DeleteImpactEntry[], placedItem: ItemInstance, target: DeleteTarget, baseCtx: Ctx, options: AnalysisOptions = {}): void {
  if (target.kind === "placedItem" && placedItem.itemInstanceId === target.placedItemId) {
    addEntry(entries, {
      id: makeId("placed-item", [baseCtx.nodeId, baseCtx.layerId, placedItem.itemInstanceId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-item",
        placedItemId: placedItem.itemInstanceId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Objeto colocado ${label(placedItem.label, placedItem.itemInstanceId)}`,
      }),
      message: "Se eliminará este objeto colocado.",
    });

    return;
  }

  if (target.kind === "item" && placedItem.itemId === target.itemId) {
    addEntry(entries, {
      id: makeId("placed-item", [baseCtx.nodeId, baseCtx.layerId, placedItem.itemInstanceId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-item",
        placedItemId: placedItem.itemInstanceId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Objeto colocado ${label(placedItem.label, placedItem.itemInstanceId)}`,
      }),
      message: "Se eliminará este objeto colocado porque usa el objeto global eliminado.",
    });

    return;
  }

  analyzeRules(entries, placedItem.rules, target, {
    ...baseCtx, ownerKind: "placedItem", ownerId: placedItem.itemInstanceId,
    ownerLabel: `Objeto colocado ${label(placedItem.label, placedItem.itemInstanceId)}`
  }, options);
}

function analyzePlacedNpc(entries: DeleteImpactEntry[], project: Project, placedNpc: PlacedNpc, target: DeleteTarget, baseCtx: Ctx, options: AnalysisOptions = {}): void {
  const isTargetPlacedNpc = target.kind === "placedNpc" && baseCtx.nodeId === target.nodeId && baseCtx.layerId === target.layerId && placedNpc.npcId === target.npcId;

  const isGlobalNpcTarget = target.kind === "npc" && placedNpc.npcId === target.npcId;

  const npcLabel = getNpcLabel(project, placedNpc.npcId);

  if (isTargetPlacedNpc || isGlobalNpcTarget) {
    addEntry(entries, {
      id: makeId("placed-npc", [baseCtx.nodeId, baseCtx.layerId, placedNpc.npcId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-npc",
        npcId: placedNpc.npcId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > PNJ colocado ${npcLabel}`,
      }),
      message: isGlobalNpcTarget ? "Se eliminará este PNJ colocado porque usa el PNJ global eliminado." : "Se eliminará este PNJ colocado.",
    });

    return;
  }

  analyzeRules(entries, placedNpc.rules, target, {
    ...baseCtx, ownerKind: "placedNpc", ownerId: placedNpc.npcId,
    ownerLabel: `PNJ colocado ${npcLabel}`
  }, options);
}

function analyzePlacedPlayer(entries: DeleteImpactEntry[], project: Project, placedPlayer: PlacedPlayer, target: DeleteTarget, baseCtx: Ctx, options: AnalysisOptions = {}): void {
  const isTargetPlacedPlayer = target.kind === "placedPlayer" && baseCtx.nodeId === target.nodeId && baseCtx.layerId === target.layerId && placedPlayer.playerId === target.playerId;

  const isGlobalPlayerTarget = target.kind === "player" && placedPlayer.playerId === target.playerId;

  const playerLabel = getPlayerLabel(project, placedPlayer.playerId);

  if (isTargetPlacedPlayer || isGlobalPlayerTarget) {
    addEntry(entries, {
      id: makeId("placed-player", [baseCtx.nodeId, baseCtx.layerId, placedPlayer.playerId]),
      severity: "logic-change",
      action: "remove-placed-entity",
      location: location(baseCtx, {
        kind: "placed-player",
        playerId: placedPlayer.playerId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Jugador colocado ${playerLabel}`,
      }),
      message: isGlobalPlayerTarget ? "Se eliminará este jugador colocado porque usa el jugador global eliminado." : "Se eliminará este jugador colocado.",
    });

    return;
  }

  if (target.kind === "playerImage" && placedPlayer.playerId === target.playerId && placedPlayer.initialImageId === target.imageId && options.replacementPlayerImageId) {
    addEntry(entries, {
      id: makeId("placed-player-image-replacement", [
        baseCtx.nodeId,
        baseCtx.layerId,
        placedPlayer.playerId,
        target.imageId,
        options.replacementPlayerImageId,
      ]),
      severity: "logic-change",
      action: "replace-reference",
      location: location(baseCtx, {
        kind: "placed-player",
        playerId: placedPlayer.playerId,
        label: `${baseCtx.nodeLabel} > ${baseCtx.layerLabel} > Jugador colocado ${placedPlayer.playerId}`,
      }),
      message: "Este jugador colocado pasará a usar la nueva imagen por defecto del jugador.",
    });
  }
}

function analyzeDialogue(entries: DeleteImpactEntry[], dialogue: Dialogue, nodeId: ID, nodeLabel: string, target: DeleteTarget, options: AnalysisOptions = {}): void {
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

  if ((target.kind === "player" && dialogue.playerId === target.playerId) || (target.kind === "npc" && dialogue.npcId === target.npcId)) {
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

  if ((target.kind === "player" && dialogue.playerId === target.playerId) || (target.kind === "npc" && dialogue.npcId === target.npcId)) return;

  analyzeWhen(entries, dialogue.when, target, {
    nodeId, nodeLabel, ownerKind: "dialogue", ownerId: dialogue.id,
    ownerLabel: `Diálogo ${label(dialogue.title, dialogue.id)}`, dialogueId: dialogue.id
  }, options);

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

    analyzeWhen(entries, dialogueNode.when, target, ctx, options);
    analyzeEffects(entries, dialogueNode.effects, target, ctx, options);
  }
}

export function analyzeDeleteImpact(project: Project | null, target: DeleteTarget): DeleteImpactReport {
  const entries: DeleteImpactEntry[] = [];

  if (!project) return { target, targetLabel: target.kind, entries };

  const options: AnalysisOptions = buildDeleteCascadeContext(project, target);

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

      analyzeDeletedNodeContents(entries, project, node, nodeLabel);
      continue;
    }

    if (target.kind === "layer" && node.id === target.nodeId) {
      const layer = node.layers.find((entry) => entry.id === target.layerId);

      if (layer) {
        analyzeDeletedLayerContents(entries, project, { nodeId: node.id, nodeLabel, layer });
        analyzeLayerRemovedDialogues(entries, { node, nodeLabel, removedDialogueIds: options.removedDialogueIds });
      }
    }

    for (const layer of node.layers) {
      if (target.kind === "layer" && node.id === target.nodeId && layer.id === target.layerId) continue;

      analyzeLayer(entries, project, nodeLabel, node.id, layer, target, options);
    }

    for (const dialogue of node.dialogues ?? []) {
      const dialogueRemovedByCascadeDelete =
        (target.kind === "placedNpc" || target.kind === "placedPlayer" || target.kind === "layer") && options.removedDialogueIds?.has(dialogue.id);

      if (dialogueRemovedByCascadeDelete) continue;

      analyzeDialogue(entries, dialogue, node.id, nodeLabel, target, options);
    }
  }

  return {
    target, targetLabel: getTargetLabel(project, target), entries,
  };
}