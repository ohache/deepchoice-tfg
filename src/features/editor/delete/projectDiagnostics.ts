import type { Dialogue, ID, InteractionRules, Project, RulePhrase, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { extractConditionRefs } from "@/domain/conditionRefs";
import type { Effect } from "@/domain/effects";
import { extractEffectRefs } from "@/domain/effectRefs";
import type { DeleteLocation, DiagnosticIssue, ProjectDiagnostics } from "@/features/editor/delete/deleteTypes";
import { buildProjectReferenceIndexes, hasLayer, hasMapRegion, hasPlacedNpc, hasPlacedPlayer, type ProjectReferenceIndexes } from "@/features/editor/delete/projectReferenceIndexes";

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

function makeId(prefix: string, parts: Array<string | undefined>): string {
  return [prefix, ...parts.filter(Boolean)].join("::");
}

function pushIssue(issues: DiagnosticIssue[], input: Omit<DiagnosticIssue, "id"> & { idParts: Array<string | undefined> }): void {
  issues.push({
    id: makeId(input.code, input.idParts),
    severity: input.severity,
    code: input.code,
    location: input.location,
    message: input.message,
  });
}

function nodeLocation(nodeId: ID, nodeLabel: string): DeleteLocation {
  return { kind: "node", nodeId, label: `Escena ${nodeLabel}` };
}

function layerLocation(input: { nodeId: ID; nodeLabel: string; layerId: ID; layerLabel: string }): DeleteLocation {
  return { kind: "layer", nodeId: input.nodeId, layerId: input.layerId, label: `${input.nodeLabel} > ${input.layerLabel}` };
}

function ruleLocation(input: {
  nodeId: ID; nodeLabel: string; layerId?: ID; layerLabel?: string; ownerKind: DeleteLocation["kind"];
  ownerId: ID; ownerLabel: string; ruleId: ID; ruleLabel: string
}): DeleteLocation {
  return {
    kind: "rule",
    nodeId: input.nodeId,
    layerId: input.layerId,
    hotspotId: input.ownerKind === "hotspot" ? input.ownerId : undefined,
    placedItemId: input.ownerKind === "placed-item" ? input.ownerId : undefined,
    npcId: input.ownerKind === "placed-npc" ? input.ownerId : undefined,
    playerId: input.ownerKind === "placed-player" ? input.ownerId : undefined,
    ruleId: input.ruleId,
    label: [input.nodeLabel, input.layerLabel, input.ownerLabel, `Regla ${input.ruleLabel}`]
      .filter(Boolean).join(" > "),
  };
}

function dialogueLocation(input: { nodeId: ID; nodeLabel: string; dialogueId: ID; dialogueLabel: string }): DeleteLocation {
  return {
    kind: "dialogue",
    nodeId: input.nodeId,
    dialogueId: input.dialogueId,
    label: `${input.nodeLabel} > Diálogo ${input.dialogueLabel}`,
  };
}

function dialogueLineLocation(input: { nodeId: ID; nodeLabel: string; dialogueId: ID; dialogueLabel: string; lineId: ID }): DeleteLocation {
  return {
    kind: "dialogue-line",
    nodeId: input.nodeId,
    dialogueId: input.dialogueId,
    dialogueLineId: input.lineId,
    label: `${input.nodeLabel} > Diálogo ${input.dialogueLabel} > Línea ${input.lineId}`,
  };
}

/* ---------- Conditions ---------- */
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

function pushBrokenCondition(issues: DiagnosticIssue[], location: DeleteLocation, conditionType: Condition["type"],
  idParts: Array<string | undefined>, message: string, code: DiagnosticIssue["code"] = "BROKEN_CONDITION_REFERENCE"): void {
  pushIssue(issues, { severity: "error", code, idParts, location: { ...location, kind: "condition", conditionType }, message });
}

function diagnoseCondition(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, condition: Condition | undefined, location: DeleteLocation): void {
  walkCondition(condition, (current) => {
    const refs = extractConditionRefs(current);

    switch (current.type) {
      case "and":
      case "or":
      case "not":
        return;

      case "nodeVisited": {
        for (const nodeId of refs.nodeIds ?? []) {
          if (!indexes.nodeIds.has(nodeId)) {
            pushBrokenCondition(issues, location, current.type, [location.label, current.type, nodeId], "La condición apunta a una escena que ya no existe.");
          }
        }
        return;
      }

      case "hasItem": {
        if (!indexes.playerIds.has(current.playerId) || !indexes.gameItemInstanceIds.has(current.itemInstanceId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.playerId, current.itemInstanceId],
            "La condición referencia un jugador u objeto de inventario inexistente.", "BROKEN_ITEM_REFERENCE");
        }
        return;
      }

      case "npcHasItem": {
        if (!indexes.npcIds.has(current.npcId) || !indexes.gameItemInstanceIds.has(current.itemInstanceId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.npcId, current.itemInstanceId],
            "La condición referencia un PNJ u objeto de inventario inexistente.", "BROKEN_ITEM_REFERENCE");
        }
        return;
      }

      case "playerVar": {
        if (!indexes.playerIds.has(current.playerId) || !indexes.playerVarIdsByPlayerId.get(current.playerId)?.has(current.varId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.playerId, current.varId],
            "La condición referencia una variable de jugador inexistente.");
        }
        return;
      }

      case "npcVar": {
        if (!indexes.npcIds.has(current.npcId) || !indexes.npcVarIdsByNpcId.get(current.npcId)?.has(current.varId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.npcId, current.varId],
            "La condición referencia una variable de PNJ inexistente.");
        }
        return;
      }

      case "hotspotVar": {
        if (!indexes.hotspotIds.has(current.hotspotId) || !indexes.hotspotVarIdsByHotspotId.get(current.hotspotId)?.has(current.varId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.hotspotId, current.varId],
            "La condición referencia una variable de hotspot inexistente.");
        }
        return;
      }

      case "hotspotVisible":
      case "hotspotReachable": {
        for (const hotspotId of refs.hotspotIds ?? []) {
          if (!indexes.hotspotIds.has(hotspotId)) {
            pushBrokenCondition(issues, location, current.type, [location.label, current.type, hotspotId], "La condición referencia un hotspot inexistente.");
          }
        }
        return;
      }

      case "placedItemVisible":
      case "placedItemReachable": {
        for (const itemInstanceId of refs.itemInstanceIds ?? []) {
          if (!indexes.placedItemInstanceIds.has(itemInstanceId)) {
            pushBrokenCondition(issues, location, current.type, [location.label, current.type, itemInstanceId], "La condición referencia un objeto colocado inexistente.");
          }
        }
        return;
      }

      case "placedNpcVisible":
      case "placedNpcReachable": {
        if (!indexes.nodeIds.has(current.nodeId) || !hasLayer(indexes, current) || !indexes.npcIds.has(current.npcId) || !hasPlacedNpc(indexes, current)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.nodeId, current.layerId, current.npcId],
            "La condición referencia un PNJ colocado inexistente.");
        }
        return;
      }

      case "placedPlayerVisible": {
        if (!indexes.nodeIds.has(current.nodeId) || !hasLayer(indexes, current) || !indexes.playerIds.has(current.playerId) || !hasPlacedPlayer(indexes, current)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.nodeId, current.layerId, current.playerId],
            "La condición referencia un jugador colocado inexistente.");
        }
        return;
      }

      case "placedPlayerImage": {
        if (!indexes.nodeIds.has(current.nodeId) || !hasLayer(indexes, current) || !indexes.playerIds.has(current.playerId) ||
          !hasPlacedPlayer(indexes, current) || !indexes.playerImageIdsByPlayerId.get(current.playerId)?.has(current.imageId)) {
          pushBrokenCondition(issues, location, current.type, [location.label, current.type, current.nodeId, current.layerId, current.playerId, current.imageId],
            "La condición referencia una imagen de jugador colocado inexistente.");
        }
        return;
      }

      case "musicPlaying": {
        for (const trackId of refs.musicTrackIds ?? []) {
          if (!indexes.musicIds.has(trackId)) {
            pushBrokenCondition(issues, location, current.type, [location.label, current.type, trackId], "La condición referencia una música inexistente.");
          }
        }
        return;
      }

      case "mapRegionVisited": {
        for (const ref of refs.mapRegions ?? []) {
          if (!indexes.mapIds.has(ref.mapId) || !hasMapRegion(indexes, ref)) {
            pushBrokenCondition(issues, location, current.type, [location.label, current.type, ref.mapId, ref.regionId],
              "La condición referencia una región de mapa inexistente.", "BROKEN_MAP_REFERENCE");
          }
        }
        return;
      }
    }
  });
}

/* ---------- Effects ---------- */
function pushBrokenEffect(issues: DiagnosticIssue[], location: DeleteLocation, effectType: Effect["type"], idParts: Array<string | undefined>,
  message: string, code: DiagnosticIssue["code"] = "BROKEN_EFFECT_REFERENCE"): void {
  pushIssue(issues, { severity: "error", code, idParts, location: { ...location, kind: "effect", effectType }, message });
}

function diagnoseEffect(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, effect: Effect, location: DeleteLocation): void {
  const refs = extractEffectRefs(effect);

  switch (effect.type) {
    case "goToNode": {
      for (const nodeId of refs.nodeIds ?? []) {
        if (!indexes.nodeIds.has(nodeId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, nodeId], "El efecto referencia una escena inexistente.");
        }
      }
      break;
    }

    case "startDialogue": {
      const nodeId = location.nodeId;
      const existsInCurrentNode = typeof nodeId === "string" && indexes.dialogueIdsByNodeId.get(nodeId)?.has(effect.nodeDialogueId) === true;

      if (!existsInCurrentNode) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.nodeDialogueId], "El efecto referencia un diálogo inexistente en esta escena.");
      }
      break;
    }

    case "playSfx": {
      for (const sfxId of refs.sfxIds ?? []) {
        if (!indexes.sfxIds.has(sfxId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, sfxId], "El efecto referencia un sonido inexistente.");
        }
      }
      break;
    }

    case "playMusic":
    case "stopMusic": {
      for (const trackId of refs.musicTrackIds ?? []) {
        if (!indexes.musicIds.has(trackId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, trackId], "El efecto referencia una música inexistente.");
        }
      }
      break;
    }

    case "setMapRegionAvailable": {
      for (const ref of refs.mapRegions ?? []) {
        if (!indexes.mapIds.has(ref.mapId) || !hasMapRegion(indexes, ref)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, ref.mapId, ref.regionId],
            "El efecto referencia una región de mapa inexistente.", "BROKEN_MAP_REFERENCE");
        }
      }
      break;
    }

    case "addItem":
    case "removeItem": {
      if (!indexes.gameItemInstanceIds.has(effect.itemInstanceId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.itemInstanceId],
          "El efecto referencia un objeto inexistente.", "BROKEN_ITEM_REFERENCE");
      }
      break;
    }

    case "transformItem": {
      if (!indexes.gameItemInstanceIds.has(effect.itemInstanceId) || !indexes.itemIds.has(effect.resultItemId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.itemInstanceId, effect.resultItemId],
          "El efecto referencia un objeto inexistente.", "BROKEN_ITEM_REFERENCE");
      }
      break;
    }

    case "combineItems": {
      if (!indexes.gameItemInstanceIds.has(effect.itemAInstanceId) || !indexes.gameItemInstanceIds.has(effect.itemBInstanceId) || !indexes.itemIds.has(effect.resultItemId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.itemAInstanceId, effect.itemBInstanceId, effect.resultItemId],
          "El efecto referencia un objeto inexistente.", "BROKEN_ITEM_REFERENCE");
      }
      break;
    }

    case "setPlacedItemVisible":
    case "setPlacedItemReachable": {
      for (const itemInstanceId of refs.itemInstanceIds ?? []) {
        if (!indexes.placedItemInstanceIds.has(itemInstanceId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, itemInstanceId], "El efecto referencia un objeto colocado inexistente.");
        }
      }
      break;
    }

    case "setHotspotVisible":
    case "setHotspotReachable": {
      for (const hotspotId of refs.hotspotIds ?? []) {
        if (!indexes.hotspotIds.has(hotspotId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, hotspotId], "El efecto referencia un hotspot inexistente.");
        }
      }
      break;
    }

    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar": {
      if (!indexes.hotspotIds.has(effect.hotspotId) || !indexes.hotspotVarIdsByHotspotId.get(effect.hotspotId)?.has(effect.varId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.hotspotId, effect.varId], "El efecto referencia una variable de hotspot inexistente.");
      }
      break;
    }

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar": {
      if (!indexes.playerIds.has(effect.playerId) || !indexes.playerVarIdsByPlayerId.get(effect.playerId)?.has(effect.varId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.playerId, effect.varId], "El efecto referencia una variable de jugador inexistente.");
      }
      break;
    }

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar": {
      if (!indexes.npcIds.has(effect.npcId) || !indexes.npcVarIdsByNpcId.get(effect.npcId)?.has(effect.varId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.npcId, effect.varId], "El efecto referencia una variable de PNJ inexistente.");
      }
      break;
    }

    case "setPlacedPlayerVisible": {
      if (!indexes.nodeIds.has(effect.nodeId) || !hasLayer(indexes, effect) || !indexes.playerIds.has(effect.playerId) || !hasPlacedPlayer(indexes, effect)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.nodeId, effect.layerId, effect.playerId],
          "El efecto referencia un jugador colocado inexistente.");
      }
      break;
    }

    case "setPlacedPlayerImage": {
      if (!indexes.nodeIds.has(effect.nodeId) || !hasLayer(indexes, effect) || !indexes.playerIds.has(effect.playerId) ||
        !hasPlacedPlayer(indexes, effect) || !indexes.playerImageIdsByPlayerId.get(effect.playerId)?.has(effect.imageId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.nodeId, effect.layerId, effect.playerId, effect.imageId],
          "El efecto referencia una imagen de jugador colocado inexistente.");
      }
      break;
    }

    case "setPlacedNpcVisible":
    case "setPlacedNpcReachable": {
      if (!indexes.nodeIds.has(effect.nodeId) || !hasLayer(indexes, effect) || !indexes.npcIds.has(effect.npcId) || !hasPlacedNpc(indexes, effect)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.nodeId, effect.layerId, effect.npcId],
          "El efecto referencia un PNJ colocado inexistente.");
      }
      break;
    }

    case "giveItemToNpc":
    case "receiveItemFromNpc": {
      if (!indexes.npcIds.has(effect.npcId) || !indexes.gameItemInstanceIds.has(effect.itemInstanceId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, effect.npcId, effect.itemInstanceId],
          "El efecto referencia un PNJ u objeto de inventario inexistente.", "BROKEN_ITEM_REFERENCE");
      }
      break;
    }

    case "showMessage": {
      const speaker = effect.speaker;

      if (speaker?.kind === "player" && !indexes.playerIds.has(speaker.playerId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, "player", speaker.playerId], "El mensaje referencia un jugador inexistente.");
      }

      if (speaker?.kind === "npc" && !indexes.npcIds.has(speaker.npcId)) {
        pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, "npc", speaker.npcId], "El mensaje referencia un PNJ inexistente.");
      }
      break;
    }

    case "endGame": {
      const ending = effect.ending;

      for (const trackId of refs.musicTrackIds ?? []) {
        if (!indexes.musicIds.has(trackId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, "music", trackId], "El final referencia una música inexistente.");
        }
      }

      for (const line of ending?.lines ?? []) {
        const speaker = line.speaker;

        if (speaker?.kind === "player" && !indexes.playerIds.has(speaker.playerId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, line.id, "player", speaker.playerId],
            "Una línea del final referencia un jugador inexistente.");
        }

        if (speaker?.kind === "npc" && !indexes.npcIds.has(speaker.npcId)) {
          pushBrokenEffect(issues, location, effect.type, [location.label, effect.type, line.id, "npc", speaker.npcId], "Una línea del final referencia un PNJ inexistente.");
        }
      }
      break;
    }

    case "endDialogue":
      break;
  }
}

/* ---------- Rule phrases ---------- */
function hasMeaningfulPhrase(phrase: RulePhrase | undefined): boolean {
  return Boolean(phrase?.text.trim());
}

function diagnosePhrase(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, phrase: RulePhrase | undefined, location: DeleteLocation): void {
  const speaker = phrase?.speaker;
  if (!speaker) return;

  if (speaker.kind === "player" && !indexes.playerIds.has(speaker.playerId)) {
    pushIssue(issues, {
      severity: "error",
      code: "BROKEN_SPEAKER_REFERENCE",
      idParts: [location.label, "phrase", "player", speaker.playerId],
      location: { ...location, kind: "rule" },
      message: "La frase de la regla referencia un jugador inexistente.",
    });
  }

  if (speaker.kind === "npc" && !indexes.npcIds.has(speaker.npcId)) {
    pushIssue(issues, {
      severity: "error",
      code: "BROKEN_SPEAKER_REFERENCE",
      idParts: [location.label, "phrase", "npc", speaker.npcId],
      location: { ...location, kind: "rule" },
      message: "La frase de la regla referencia un PNJ inexistente.",
    });
  }
}

function diagnoseRuleStructure(issues: DiagnosticIssue[], rule: { when?: Condition; phrase?: RulePhrase; effects: Effect[] }, location: DeleteLocation,
  idParts: Array<string | undefined>): void {
  const hasCondition = Boolean(rule.when);
  const hasPhrase = hasMeaningfulPhrase(rule.phrase);
  const hasEffects = rule.effects.length > 0;

  if (hasEffects) return;

  if (!hasCondition) return;

  pushIssue(issues, {
    severity: "warning",
    code: "RULE_WITHOUT_EFFECTS",
    idParts: [...idParts, hasPhrase ? "condition-and-phrase-without-effects" : "condition-without-effects"],
    location,
    message: hasPhrase
      ? "La regla tiene condición y frase, pero no ejecuta ningún efecto técnico. Añade un efecto o elimina la regla si no debe modificar la partida."
      : "La regla tiene condición, pero no ejecuta ningún efecto. Añade un efecto o elimina la regla.",
  });
}

/* ---------- Rules ---------- */
function diagnoseRules(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, rules: InteractionRules | undefined,
  input: { nodeId: ID; nodeLabel: string; layerId: ID; layerLabel: string; ownerKind: DeleteLocation["kind"]; ownerId: ID; ownerLabel: string }): void {
  const diagnoseRuleList = (list: NonNullable<InteractionRules["onClick"]> | NonNullable<InteractionRules["onUseItem"]> | undefined,
    kind: "onClick" | "onUseItem") => {
    for (const rule of list ?? []) {
      const loc = ruleLocation({ ...input, ruleId: rule.id, ruleLabel: getRuleLabel(rule) });

      diagnoseRuleStructure(issues, rule, loc, [input.nodeId, input.layerId, input.ownerId, rule.id]);

      diagnosePhrase(issues, indexes, rule.phrase, loc);

      if (kind === "onUseItem") {
        const itemInstanceId = "itemInstanceId" in rule && typeof rule.itemInstanceId === "string" ? rule.itemInstanceId : null;

        if (!itemInstanceId || !indexes.gameItemInstanceIds.has(itemInstanceId)) {
          pushIssue(issues, {
            severity: "error",
            code: "BROKEN_ITEM_REFERENCE",
            idParts: [input.nodeId, input.layerId, input.ownerId, rule.id, itemInstanceId ?? "missing"],
            location: loc,
            message: "La regla de uso referencia un objeto inexistente.",
          });
        }
      }

      diagnoseCondition(issues, indexes, rule.when, loc);

      for (const effect of rule.effects) diagnoseEffect(issues, indexes, effect, loc);
    }
  };

  diagnoseRuleList(rules?.onClick, "onClick");
  diagnoseRuleList(rules?.onUseItem, "onUseItem");
}

/* ---------- Scene ---------- */
function diagnoseLayer(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, project: Project, layer: SceneImageLayer, input: { nodeId: ID; nodeLabel: string }): void {
  const layerLabel = label(layer.label, layer.id);
  const loc = layerLocation({ nodeId: input.nodeId, nodeLabel: input.nodeLabel, layerId: layer.id, layerLabel });

  if (!layer.assetId) {
    pushIssue(issues, {
      severity: "error",
      code: "LAYER_WITHOUT_IMAGE",
      idParts: [input.nodeId, layer.id],
      location: loc,
      message: "La variante no tiene imagen de fondo.",
    });
  }

  diagnoseCondition(issues, indexes, layer.when, loc);

  for (const textEntry of layer.text) {
    diagnoseCondition(issues, indexes, textEntry.when, {
      kind: "text",
      nodeId: input.nodeId,
      layerId: layer.id,
      label: `${input.nodeLabel} > ${layerLabel} > Texto ${label(textEntry.label, textEntry.id)}`,
    });
  }

  for (const hotspot of layer.hotspots ?? []) {
    diagnoseRules(issues, indexes, hotspot.rules, {
      nodeId: input.nodeId,
      nodeLabel: input.nodeLabel,
      layerId: layer.id,
      layerLabel,
      ownerKind: "hotspot",
      ownerId: hotspot.id,
      ownerLabel: `Hotspot ${label(hotspot.label, hotspot.id)}`,
    });
  }

  for (const placedItem of layer.placedItems ?? []) {
    if (!indexes.itemIds.has(placedItem.itemId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_ITEM_REFERENCE",
        idParts: [input.nodeId, layer.id, placedItem.itemInstanceId, placedItem.itemId],
        location: {
          kind: "placed-item",
          nodeId: input.nodeId,
          layerId: layer.id,
          placedItemId: placedItem.itemInstanceId,
          label: `${input.nodeLabel} > ${layerLabel} > Objeto ${label(placedItem.label, placedItem.itemInstanceId)}`,
        },
        message: "El objeto colocado referencia un objeto global inexistente.",
      });
    }

    diagnoseRules(issues, indexes, placedItem.rules, {
      nodeId: input.nodeId,
      nodeLabel: input.nodeLabel,
      layerId: layer.id,
      layerLabel,
      ownerKind: "placed-item",
      ownerId: placedItem.itemInstanceId,
      ownerLabel: `Objeto ${label(placedItem.label, placedItem.itemInstanceId)}`,
    });
  }

  for (const placedNpc of layer.placedNpcs ?? []) {
    const npcLabel = getNpcLabel(project, placedNpc.npcId);

    if (!indexes.npcIds.has(placedNpc.npcId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_EFFECT_REFERENCE",
        idParts: [input.nodeId, layer.id, placedNpc.npcId],
        location: {
          kind: "placed-npc",
          nodeId: input.nodeId,
          layerId: layer.id,
          npcId: placedNpc.npcId,
          label: `${input.nodeLabel} > ${layerLabel} > PNJ ${npcLabel}`,
        },
        message: "El PNJ colocado referencia un PNJ global inexistente.",
      });
    }

    diagnoseRules(issues, indexes, placedNpc.rules, {
      nodeId: input.nodeId,
      nodeLabel: input.nodeLabel,
      layerId: layer.id,
      layerLabel,
      ownerKind: "placed-npc",
      ownerId: placedNpc.npcId,
      ownerLabel: `PNJ ${npcLabel}`,
    });
  }

  for (const placedPlayer of layer.placedPlayers ?? []) {
    const playerLabel = getPlayerLabel(project, placedPlayer.playerId);
    const playerImages = indexes.playerImageIdsByPlayerId.get(placedPlayer.playerId);

    if (!indexes.playerIds.has(placedPlayer.playerId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_EFFECT_REFERENCE",
        idParts: [input.nodeId, layer.id, placedPlayer.playerId],
        location: {
          kind: "placed-player",
          nodeId: input.nodeId,
          layerId: layer.id,
          playerId: placedPlayer.playerId,
          label: `${input.nodeLabel} > ${layerLabel} > Jugador ${playerLabel}`,
        },
        message: "El jugador colocado referencia un jugador global inexistente.",
      });
    } else if (!playerImages?.has(placedPlayer.initialImageId)) {
      pushIssue(issues, {
        severity: "error",
        code: "PLACED_PLAYER_WITH_INVALID_IMAGE",
        idParts: [input.nodeId, layer.id, placedPlayer.playerId, placedPlayer.initialImageId],
        location: {
          kind: "placed-player",
          nodeId: input.nodeId,
          layerId: layer.id,
          playerId: placedPlayer.playerId,
          label: `${input.nodeLabel} > ${layerLabel} > Jugador ${playerLabel}`,
        },
        message: "El jugador colocado referencia una imagen inicial inexistente.",
      });
    }
  }
}

function diagnoseDialogue(issues: DiagnosticIssue[], indexes: ProjectReferenceIndexes, dialogue: Dialogue, input: { nodeId: ID; nodeLabel: string }): void {
  const dialogueLabel = label(dialogue.title, dialogue.id);
  const loc = dialogueLocation({ nodeId: input.nodeId, nodeLabel: input.nodeLabel, dialogueId: dialogue.id, dialogueLabel });

  if (!indexes.playerIds.has(dialogue.playerId) || !indexes.npcIds.has(dialogue.npcId)) {
    pushIssue(issues, {
      severity: "error",
      code: "BROKEN_EFFECT_REFERENCE",
      idParts: [input.nodeId, dialogue.id, dialogue.playerId, dialogue.npcId],
      location: loc,
      message: "El diálogo referencia un jugador o PNJ inexistente.",
    });
  }

  const nodeIds = new Set(dialogue.nodes.map((node) => node.id));
  const root = dialogue.nodes.find((node) => node.id === dialogue.rootId);

  if (!root || root.type !== "root") {
    pushIssue(issues, {
      severity: "error",
      code: "DIALOGUE_WITH_INVALID_ROOT",
      idParts: [input.nodeId, dialogue.id, dialogue.rootId],
      location: loc,
      message: "El diálogo tiene un rootId inválido.",
    });
  }

  diagnoseCondition(issues, indexes, dialogue.when, loc);

  for (const dialogueNode of dialogue.nodes) {
    if (dialogueNode.type !== "line") {
      for (const childId of dialogueNode.childrenIds) {
        if (!nodeIds.has(childId)) {
          pushIssue(issues, {
            severity: "error",
            code: "DIALOGUE_WITH_BROKEN_CHILD",
            idParts: [input.nodeId, dialogue.id, dialogueNode.id, childId],
            location: loc,
            message: "El diálogo contiene una referencia a una línea hija inexistente.",
          });
        }
      }

      continue;
    }

    const lineLoc = dialogueLineLocation({ nodeId: input.nodeId, nodeLabel: input.nodeLabel, dialogueId: dialogue.id, dialogueLabel, lineId: dialogueNode.id });

    if (!dialogueNode.text.trim()) {
      pushIssue(issues, {
        severity: "warning",
        code: "DIALOGUE_LINE_WITHOUT_TEXT",
        idParts: [input.nodeId, dialogue.id, dialogueNode.id],
        location: lineLoc,
        message: "La línea de diálogo no tiene texto.",
      });
    }

    diagnoseCondition(issues, indexes, dialogueNode.when, lineLoc);

    for (const childId of dialogueNode.childrenIds) {
      if (!nodeIds.has(childId)) {
        pushIssue(issues, {
          severity: "error",
          code: "DIALOGUE_WITH_BROKEN_CHILD",
          idParts: [input.nodeId, dialogue.id, dialogueNode.id, childId],
          location: lineLoc,
          message: "La línea referencia una línea hija inexistente.",
        });
      }
    }

    for (const effect of dialogueNode.effects ?? []) {
      diagnoseEffect(issues, indexes, effect, lineLoc);
    }
  }
}

/* ---------- Public API ---------- */
export function diagnoseProject(project: Project | null): ProjectDiagnostics {
  if (!project) return { errors: [], warnings: [] };

  const issues: DiagnosticIssue[] = [];
  const indexes = buildProjectReferenceIndexes(project);

  for (const player of project.players) {
    if (player.images.length === 0) {
      pushIssue(issues, {
        severity: "error",
        code: "PLAYER_WITHOUT_IMAGES",
        idParts: [player.id],
        location: {
          kind: "player",
          playerId: player.id,
          label: `Jugador ${label(player.name, player.id)}`,
        },
        message: "El jugador no tiene ninguna imagen.",
      });
    }

    for (const itemInstance of player.initialInventory ?? []) {
      if (!indexes.itemIds.has(itemInstance.itemId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_ITEM_REFERENCE",
          idParts: [player.id, itemInstance.itemInstanceId, itemInstance.itemId],
          location: {
            kind: "player",
            playerId: player.id,
            label: `Jugador ${label(player.name, player.id)}`,
          },
          message: "El inventario inicial del jugador referencia un objeto global inexistente.",
        });
      }
    }
  }

  for (const npc of project.npcs) {
    for (const itemInstance of npc.initialInventory ?? []) {
      if (!indexes.itemIds.has(itemInstance.itemId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_ITEM_REFERENCE",
          idParts: [npc.id, itemInstance.itemInstanceId, itemInstance.itemId],
          location: {
            kind: "npc",
            npcId: npc.id,
            label: `PNJ ${label(npc.name, npc.id)}`,
          },
          message: "El inventario inicial del PNJ referencia un objeto global inexistente.",
        });
      }
    }
  }

  for (const node of project.nodes) {
    const nodeLabel = label(node.title, node.id);

    if (node.layers.length === 0) {
      pushIssue(issues, {
        severity: "error",
        code: "NODE_WITHOUT_LAYERS",
        idParts: [node.id],
        location: nodeLocation(node.id, nodeLabel),
        message: "La escena no tiene ninguna variante.",
      });
    }

    if (node.musicTrackId && !indexes.musicIds.has(node.musicTrackId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_EFFECT_REFERENCE",
        idParts: [node.id, node.musicTrackId],
        location: nodeLocation(node.id, nodeLabel),
        message: "La escena referencia una música inexistente.",
      });
    }

    if (node.mapLocation) {
      if (!indexes.mapIds.has(node.mapLocation.mapId) || !hasMapRegion(indexes, node.mapLocation)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [node.id, node.mapLocation.mapId, node.mapLocation.regionId],
          location: nodeLocation(node.id, nodeLabel),
          message: "La escena referencia un mapa o región inexistente.",
        });
      }
    }

    for (const layer of node.layers) {
      diagnoseLayer(issues, indexes, project, layer, { nodeId: node.id, nodeLabel });
    }

    for (const dialogue of node.dialogues ?? []) {
      diagnoseDialogue(issues, indexes, dialogue, { nodeId: node.id, nodeLabel });
    }
  }

  for (const map of project.maps) {
    const mapLabel = label(map.name, map.id);

    if (map.visual.type === "singleImage" && !indexes.assetIds.has(map.visual.imageAssetId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_MAP_REFERENCE",
        idParts: [map.id, map.visual.imageAssetId, "map-image"],
        location: {
          kind: "map",
          mapId: map.id,
          label: `Mapa ${mapLabel}`,
        },
        message: "El mapa referencia una imagen inexistente.",
      });
    }

    if (map.visual.type === "composed" && !indexes.assetIds.has(map.visual.backgroundAssetId)) {
      pushIssue(issues, {
        severity: "error",
        code: "BROKEN_MAP_REFERENCE",
        idParts: [map.id, map.visual.backgroundAssetId, "map-background"],
        location: {
          kind: "map",
          mapId: map.id,
          label: `Mapa ${mapLabel}`,
        },
        message: "El mapa compuesto referencia una imagen de fondo inexistente.",
      });
    }

    for (const region of map.regions) {
      const regionLocation: DeleteLocation = {
        kind: "map-region",
        mapId: map.id,
        regionId: region.id,
        label: `Mapa ${mapLabel} > Región ${label(region.label, region.id)}`,
      };

      const regionNodes = project.nodes.filter((node) => node.mapLocation?.mapId === map.id && node.mapLocation.regionId === region.id);

      if (region.imageAssetId && !indexes.assetIds.has(region.imageAssetId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, region.imageAssetId, "region-image"],
          location: regionLocation,
          message: "La región referencia una imagen inexistente.",
        });
      }

      const entryNodes = regionNodes.filter((node) => Boolean(node.mapLocation?.isEntry));

      if (region.entrySceneId && !entryNodes.some((node) => node.id === region.entrySceneId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, region.entrySceneId, "entry-mismatch"],
          location: regionLocation,
          message: "La región tiene una escena de entrada que no coincide con ninguna escena marcada como entrada.",
        });
      }

      if (entryNodes.length > 1) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, "multiple-entry-scenes"],
          location: regionLocation,
          message: "La región tiene más de una escena marcada como entrada.",
        });
      }

      if (regionNodes.length > 0 && !region.entrySceneId) {
        pushIssue(issues, {
          severity: "warning",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, "missing-entry-scene"],
          location: regionLocation,
          message: "La región tiene escenas asociadas, pero ninguna escena de entrada.",
        });
      }

      if (region.musicTrackId && !indexes.musicIds.has(region.musicTrackId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, region.musicTrackId],
          location: regionLocation,
          message: "La región referencia una música inexistente.",
        });
      }

      if (region.subMapId && !indexes.mapIds.has(region.subMapId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, region.subMapId],
          location: regionLocation,
          message: "La región referencia un submapa inexistente.",
        });
      }

      if (region.entrySceneId && !indexes.nodeIds.has(region.entrySceneId)) {
        pushIssue(issues, {
          severity: "error",
          code: "BROKEN_MAP_REFERENCE",
          idParts: [map.id, region.id, region.entrySceneId],
          location: regionLocation,
          message: "La región referencia una escena de entrada inexistente.",
        });
      }

      for (const sceneId of region.sceneIds) {
        if (!indexes.nodeIds.has(sceneId)) {
          pushIssue(issues, {
            severity: "error",
            code: "BROKEN_MAP_REFERENCE",
            idParts: [map.id, region.id, sceneId],
            location: regionLocation,
            message: "La región referencia una escena inexistente.",
          });
        }
      }
    }
  }

  return {
    errors: issues.filter((issue) => issue.severity === "error"),
    warnings: issues.filter((issue) => issue.severity === "warning"),
  };
}
