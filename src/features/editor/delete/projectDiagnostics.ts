import type { Dialogue, ID, InteractionRules, Project, RulePhrase, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { DeleteLocation, DiagnosticIssue, ProjectDiagnostics } from "@/features/editor/delete/deleteTypes";

function label(value?: string | null, fallback = "—"): string {
    const trimmed = value?.trim();
    return trimmed || fallback;
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
    return {
        kind: "node",
        nodeId,
        label: `Escena ${nodeLabel}`,
    };
}

function layerLocation(input: { nodeId: ID; nodeLabel: string; layerId: ID; layerLabel: string }): DeleteLocation {
    return {
        kind: "layer",
        nodeId: input.nodeId,
        layerId: input.layerId,
        label: `${input.nodeLabel} > ${input.layerLabel}`,
    };
}

function ruleLocation(input: {
    nodeId: ID;
    nodeLabel: string;
    layerId?: ID;
    layerLabel?: string;
    ownerKind: DeleteLocation["kind"];
    ownerId: ID;
    ownerLabel: string;
    ruleId: ID;
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
        label: [
            input.nodeLabel,
            input.layerLabel,
            input.ownerLabel,
            `Regla ${input.ruleId}`,
        ].filter(Boolean).join(" > "),
    };
}

function dialogueLocation(input: {
    nodeId: ID;
    nodeLabel: string;
    dialogueId: ID;
    dialogueLabel: string;
}): DeleteLocation {
    return {
        kind: "dialogue",
        nodeId: input.nodeId,
        dialogueId: input.dialogueId,
        label: `${input.nodeLabel} > Diálogo ${input.dialogueLabel}`,
    };
}

function dialogueLineLocation(input: {
    nodeId: ID;
    nodeLabel: string;
    dialogueId: ID;
    dialogueLabel: string;
    lineId: ID;
}): DeleteLocation {
    return {
        kind: "dialogue-line",
        nodeId: input.nodeId,
        dialogueId: input.dialogueId,
        dialogueLineId: input.lineId,
        label: `${input.nodeLabel} > Diálogo ${input.dialogueLabel} > Línea ${input.lineId}`,
    };
}

/* ---------- Índices ---------- */

function buildIndexes(project: Project) {
    const nodeIds = new Set(project.nodes.map((node) => node.id));
    const layerIdsByNodeId = new Map<ID, Set<ID>>();
    const playerIds = new Set(project.players.map((player) => player.id));
    const npcIds = new Set(project.npcs.map((npc) => npc.id));
    const itemIds = new Set(project.items.map((item) => item.id));
    const musicIds = new Set(project.musicTracks.map((track) => track.id));
    const sfxIds = new Set(project.soundEffects.map((sfx) => sfx.id));
    const mapIds = new Set(project.maps.map((map) => map.id));
    const assetIds = new Set(project.assets.map((asset) => asset.id));

    const playerImageIdsByPlayerId = new Map<ID, Set<ID>>();
    const playerVarIdsByPlayerId = new Map<ID, Set<ID>>();
    const npcVarIdsByNpcId = new Map<ID, Set<ID>>();

    for (const player of project.players) {
        playerImageIdsByPlayerId.set(
            player.id,
            new Set(player.images.map((image) => image.id)),
        );

        playerVarIdsByPlayerId.set(
            player.id,
            new Set((player.vars ?? []).map((variable) => variable.id)),
        );
    }

    for (const npc of project.npcs) {
        npcVarIdsByNpcId.set(
            npc.id,
            new Set((npc.vars ?? []).map((variable) => variable.id)),
        );
    }

    const gameItemInstanceIds = new Set<ID>();
    const placedItemInstanceIds = new Set<ID>();
    const placedNpcKeys = new Set<string>();
    const placedPlayerKeys = new Set<string>();
    const hotspotIds = new Set<ID>();
    const hotspotVarIdsByHotspotId = new Map<ID, Set<ID>>();
    const dialogueIdsByNodeId = new Map<ID, Set<ID>>();

    for (const player of project.players) {
        for (const item of player.initialInventory ?? []) {
            gameItemInstanceIds.add(item.itemInstanceId);
        }
    }

    for (const npc of project.npcs) {
        for (const item of npc.initialInventory ?? []) {
            gameItemInstanceIds.add(item.itemInstanceId);
        }
    }

    for (const node of project.nodes) {
        dialogueIdsByNodeId.set(
            node.id,
            new Set((node.dialogues ?? []).map((dialogue) => dialogue.id)),
        );

        layerIdsByNodeId.set(
            node.id,
            new Set(node.layers.map((layer) => layer.id)),
        );

        for (const layer of node.layers) {
            for (const placedItem of layer.placedItems ?? []) {
                placedItemInstanceIds.add(placedItem.itemInstanceId);
                gameItemInstanceIds.add(placedItem.itemInstanceId);
            }

            for (const hotspot of layer.hotspots ?? []) {
                hotspotIds.add(hotspot.id);
                hotspotVarIdsByHotspotId.set(
                    hotspot.id,
                    new Set(hotspot.vars.map((variable) => variable.id)),
                );
            }

            for (const placedNpc of layer.placedNpcs ?? []) {
                placedNpcKeys.add(`${node.id}::${layer.id}::${placedNpc.npcId}`);
            }

            for (const placedPlayer of layer.placedPlayers ?? []) {
                placedPlayerKeys.add(`${node.id}::${layer.id}::${placedPlayer.playerId}`);
            }
        }
    }

    const mapRegionIdsByMapId = new Map<ID, Set<ID>>();
    for (const map of project.maps) {
        mapRegionIdsByMapId.set(
            map.id,
            new Set(map.regions.map((region) => region.id)),
        );
    }

    return {
        nodeIds,
        layerIdsByNodeId,
        playerIds,
        npcIds,
        itemIds,
        musicIds,
        sfxIds,
        mapIds,
        assetIds,
        playerImageIdsByPlayerId,
        playerVarIdsByPlayerId,
        npcVarIdsByNpcId,
        gameItemInstanceIds,
        placedItemInstanceIds,
        placedNpcKeys,
        placedPlayerKeys,
        hotspotIds,
        hotspotVarIdsByHotspotId,
        dialogueIdsByNodeId,
        mapRegionIdsByMapId,
    };
}

type Indexes = ReturnType<typeof buildIndexes>;

/* ---------- Conditions ---------- */

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

function diagnoseCondition(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    condition: Condition | undefined,
    location: DeleteLocation,
): void {
    walkCondition(condition, (current) => {
        switch (current.type) {
            case "nodeVisited":
                if (!indexes.nodeIds.has(current.nodeId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.nodeId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una escena inexistente.`,
                    });
                }
                break;

            case "hasItem":
                if (!indexes.playerIds.has(current.playerId) || !indexes.gameItemInstanceIds.has(current.itemInstanceId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_ITEM_REFERENCE",
                        idParts: [location.label, current.type, current.playerId, current.itemInstanceId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un player o item de inventario inexistente.`,
                    });
                }
                break;

            case "npcHasItem":
                if (!indexes.npcIds.has(current.npcId) || !indexes.gameItemInstanceIds.has(current.itemInstanceId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_ITEM_REFERENCE",
                        idParts: [location.label, current.type, current.npcId, current.itemInstanceId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un NPC o item de inventario inexistente.`,
                    });
                }
                break;

            case "playerVar":
                if (
                    !indexes.playerIds.has(current.playerId) ||
                    !indexes.playerVarIdsByPlayerId.get(current.playerId)?.has(current.varId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.playerId, current.varId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una variable de player inexistente.`,
                    });
                }
                break;

            case "npcVar":
                if (
                    !indexes.npcIds.has(current.npcId) ||
                    !indexes.npcVarIdsByNpcId.get(current.npcId)?.has(current.varId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.npcId, current.varId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una variable de NPC inexistente.`,
                    });
                }
                break;

            case "hotspotVar":
                if (
                    !indexes.hotspotIds.has(current.hotspotId) ||
                    !indexes.hotspotVarIdsByHotspotId.get(current.hotspotId)?.has(current.varId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.hotspotId, current.varId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una variable de hotspot inexistente.`,
                    });
                }
                break;

            case "hotspotVisible":
            case "hotspotReachable":
                if (!indexes.hotspotIds.has(current.hotspotId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.hotspotId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un hotspot inexistente.`,
                    });
                }
                break;

            case "placedItemVisible":
            case "placedItemReachable":
                if (!indexes.placedItemInstanceIds.has(current.itemInstanceId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.itemInstanceId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un item colocado inexistente.`,
                    });
                }
                break;

            case "placedNpcVisible":
            case "placedNpcReachable": {
                const placedNpcKey = `${current.nodeId}::${current.layerId}::${current.npcId}`;

                if (
                    !indexes.nodeIds.has(current.nodeId) ||
                    !indexes.layerIdsByNodeId.get(current.nodeId)?.has(current.layerId) ||
                    !indexes.npcIds.has(current.npcId) ||
                    !indexes.placedNpcKeys.has(placedNpcKey)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.nodeId, current.layerId, current.npcId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un NPC colocado inexistente.`,
                    });
                }
                break;
            }

            case "placedPlayerVisible": {
                const placedPlayerKey = `${current.nodeId}::${current.layerId}::${current.playerId}`;

                if (
                    !indexes.nodeIds.has(current.nodeId) ||
                    !indexes.layerIdsByNodeId.get(current.nodeId)?.has(current.layerId) ||
                    !indexes.playerIds.has(current.playerId) ||
                    !indexes.placedPlayerKeys.has(placedPlayerKey)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.nodeId, current.layerId, current.playerId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia un player colocado inexistente.`,
                    });
                }
                break;
            }

            case "placedPlayerImage": {
                const placedPlayerKey = `${current.nodeId}::${current.layerId}::${current.playerId}`;

                if (
                    !indexes.nodeIds.has(current.nodeId) ||
                    !indexes.layerIdsByNodeId.get(current.nodeId)?.has(current.layerId) ||
                    !indexes.playerIds.has(current.playerId) ||
                    !indexes.placedPlayerKeys.has(placedPlayerKey) ||
                    !indexes.playerImageIdsByPlayerId.get(current.playerId)?.has(current.imageId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.nodeId, current.layerId, current.playerId, current.imageId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una imagen de player colocado inexistente.`,
                    });
                }
                break;
            }

            case "musicPlaying":
                if (!indexes.musicIds.has(current.trackId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_CONDITION_REFERENCE",
                        idParts: [location.label, current.type, current.trackId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una música inexistente.`,
                    });
                }
                break;


            case "mapRegionVisited":
                if (
                    !indexes.mapIds.has(current.mapId) ||
                    !indexes.mapRegionIdsByMapId.get(current.mapId)?.has(current.regionId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_MAP_REFERENCE",
                        idParts: [location.label, current.type, current.mapId, current.regionId],
                        location: { ...location, kind: "condition", conditionType: current.type },
                        message: `La condición referencia una región de mapa inexistente.`,
                    });
                }
                break;
        }
    });
}

/* ---------- Effects ---------- */

function effectReferencesMissingItem(indexes: Indexes, effect: Effect): boolean {
    switch (effect.type) {
        case "addItem":
        case "removeItem":
            return !indexes.gameItemInstanceIds.has(effect.itemInstanceId);

        case "transformItem":
            return (
                !indexes.gameItemInstanceIds.has(effect.itemInstanceId) ||
                !indexes.itemIds.has(effect.resultItemId)
            );

        case "combineItems":
            return (
                !indexes.gameItemInstanceIds.has(effect.itemAInstanceId) ||
                !indexes.gameItemInstanceIds.has(effect.itemBInstanceId) ||
                !indexes.itemIds.has(effect.resultItemId)
            );

        default:
            return false;
    }
}

function diagnoseEffect(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    effect: Effect,
    location: DeleteLocation,
): void {
    const effectLocation: DeleteLocation = {
        ...location,
        kind: "effect",
        effectType: effect.type,
    };

    switch (effect.type) {
        case "goToNode":
            if (!indexes.nodeIds.has(effect.targetNodeId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.targetNodeId],
                    location: effectLocation,
                    message: `El efecto referencia una escena inexistente.`,
                });
            }
            break;

        case "startDialogue": {
            const nodeId = location.nodeId;

            const existsInCurrentNode =
                typeof nodeId === "string" &&
                indexes.dialogueIdsByNodeId.get(nodeId)?.has(effect.nodeDialogueId) === true;

            if (!existsInCurrentNode) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.nodeDialogueId],
                    location: effectLocation,
                    message: `El efecto referencia un diálogo inexistente en esta escena.`,
                });
            }

            break;
        }

        case "playSfx":
            if (!indexes.sfxIds.has(effect.sfxId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.sfxId],
                    location: effectLocation,
                    message: `El efecto referencia un sonido inexistente.`,
                });
            }
            break;

        case "playMusic":
        case "stopMusic":
            if (!indexes.musicIds.has(effect.trackId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.trackId],
                    location: effectLocation,
                    message: `El efecto referencia una música inexistente.`,
                });
            }
            break;

        case "setMapRegionAvailable":
            if (
                !indexes.mapIds.has(effect.mapId) ||
                !indexes.mapRegionIdsByMapId.get(effect.mapId)?.has(effect.regionId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [location.label, effect.type, effect.mapId, effect.regionId],
                    location: effectLocation,
                    message: `El efecto referencia una región de mapa inexistente.`,
                });
            }
            break;

        case "setPlacedItemVisible":
        case "setPlacedItemReachable":
            if (!indexes.placedItemInstanceIds.has(effect.itemInstanceId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.itemInstanceId],
                    location: effectLocation,
                    message: `El efecto referencia un item colocado inexistente.`,
                });
            }
            break;

        case "setHotspotVisible":
        case "setHotspotReachable":
            if (!indexes.hotspotIds.has(effect.hotspotId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.hotspotId],
                    location: effectLocation,
                    message: `El efecto referencia un hotspot inexistente.`,
                });
            }
            break;

        case "setHotspotVar":
        case "toggleHotspotVar":
        case "incHotspotVar":
        case "decHotspotVar":
            if (
                !indexes.hotspotIds.has(effect.hotspotId) ||
                !indexes.hotspotVarIdsByHotspotId.get(effect.hotspotId)?.has(effect.varId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.hotspotId, effect.varId],
                    location: effectLocation,
                    message: `El efecto referencia una variable de hotspot inexistente.`,
                });
            }
            break;

        case "setPlayerVar":
        case "togglePlayerVar":
        case "incPlayerVar":
        case "decPlayerVar":
            if (
                !indexes.playerIds.has(effect.playerId) ||
                !indexes.playerVarIdsByPlayerId.get(effect.playerId)?.has(effect.varId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.playerId, effect.varId],
                    location: effectLocation,
                    message: `El efecto referencia una variable de player inexistente.`,
                });
            }
            break;

        case "setNpcVar":
        case "toggleNpcVar":
        case "incNpcVar":
        case "decNpcVar":
            if (
                !indexes.npcIds.has(effect.npcId) ||
                !indexes.npcVarIdsByNpcId.get(effect.npcId)?.has(effect.varId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.npcId, effect.varId],
                    location: effectLocation,
                    message: `El efecto referencia una variable de NPC inexistente.`,
                });
            }
            break;

        case "setPlacedPlayerVisible": {
            const placedPlayerKey = `${effect.nodeId}::${effect.layerId}::${effect.playerId}`;

            if (
                !indexes.nodeIds.has(effect.nodeId) ||
                !indexes.layerIdsByNodeId.get(effect.nodeId)?.has(effect.layerId) ||
                !indexes.playerIds.has(effect.playerId) ||
                !indexes.placedPlayerKeys.has(placedPlayerKey)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.nodeId, effect.layerId, effect.playerId],
                    location: effectLocation,
                    message: `El efecto referencia un player colocado inexistente.`,
                });
            }
            break;
        }

        case "setPlacedPlayerImage": {
            const placedPlayerKey = `${effect.nodeId}::${effect.layerId}::${effect.playerId}`;

            if (
                !indexes.nodeIds.has(effect.nodeId) ||
                !indexes.layerIdsByNodeId.get(effect.nodeId)?.has(effect.layerId) ||
                !indexes.playerIds.has(effect.playerId) ||
                !indexes.placedPlayerKeys.has(placedPlayerKey) ||
                !indexes.playerImageIdsByPlayerId.get(effect.playerId)?.has(effect.imageId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.nodeId, effect.layerId, effect.playerId, effect.imageId],
                    location: effectLocation,
                    message: `El efecto referencia una imagen de player colocado inexistente.`,
                });
            }
            break;
        }

        case "setPlacedNpcVisible":
        case "setPlacedNpcReachable": {
            const placedNpcKey = `${effect.nodeId}::${effect.layerId}::${effect.npcId}`;

            if (
                !indexes.nodeIds.has(effect.nodeId) ||
                !indexes.layerIdsByNodeId.get(effect.nodeId)?.has(effect.layerId) ||
                !indexes.npcIds.has(effect.npcId) ||
                !indexes.placedNpcKeys.has(placedNpcKey)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, effect.nodeId, effect.layerId, effect.npcId],
                    location: effectLocation,
                    message: `El efecto referencia un NPC colocado inexistente.`,
                });
            }
            break;
        }

        case "giveItemToNpc":
        case "receiveItemFromNpc":
            if (!indexes.npcIds.has(effect.npcId) || !indexes.gameItemInstanceIds.has(effect.itemInstanceId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_ITEM_REFERENCE",
                    idParts: [location.label, effect.type, effect.npcId, effect.itemInstanceId],
                    location: effectLocation,
                    message: `El efecto referencia un NPC o item inexistente.`,
                });
            }
            break;

        case "showMessage": {
            const speaker = effect.speaker;

            if (
                speaker?.kind === "player" &&
                !indexes.playerIds.has(speaker.playerId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, "player", speaker.playerId],
                    location: effectLocation,
                    message: `El mensaje referencia un player inexistente.`,
                });
            }

            if (
                speaker?.kind === "npc" &&
                !indexes.npcIds.has(speaker.npcId)
            ) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, "npc", speaker.npcId],
                    location: effectLocation,
                    message: `El mensaje referencia un NPC inexistente.`,
                });
            }

            break;


        }

        case "endGame": {
            const ending = effect.ending;

            if (ending?.musicTrackId && !indexes.musicIds.has(ending.musicTrackId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_EFFECT_REFERENCE",
                    idParts: [location.label, effect.type, "music", ending.musicTrackId],
                    location: effectLocation,
                    message: `El final referencia una música inexistente.`,
                });
            }

            for (const line of ending?.lines ?? []) {
                const speaker = line.speaker;

                if (
                    speaker?.kind === "player" &&
                    !indexes.playerIds.has(speaker.playerId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_EFFECT_REFERENCE",
                        idParts: [location.label, effect.type, line.id, "player", speaker.playerId],
                        location: effectLocation,
                        message: `Una línea del final referencia un player inexistente.`,
                    });
                }

                if (
                    speaker?.kind === "npc" &&
                    !indexes.npcIds.has(speaker.npcId)
                ) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_EFFECT_REFERENCE",
                        idParts: [location.label, effect.type, line.id, "npc", speaker.npcId],
                        location: effectLocation,
                        message: `Una línea del final referencia un NPC inexistente.`,
                    });
                }
            }

            break;
        }

    }



    if (effectReferencesMissingItem(indexes, effect)) {
        pushIssue(issues, {
            severity: "error",
            code: "BROKEN_ITEM_REFERENCE",
            idParts: [location.label, effect.type, "item"],
            location: effectLocation,
            message: `El efecto referencia un item inexistente.`,
        });
    }
}

/* ---------- Rule phrases ---------- */

function hasMeaningfulPhrase(phrase: RulePhrase | undefined): boolean {
    return Boolean(phrase?.text.trim());
}

function diagnosePhrase(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    phrase: RulePhrase | undefined,
    location: DeleteLocation,
): void {
    const speaker = phrase?.speaker;
    if (!speaker) return;

    if (speaker.kind === "player" && !indexes.playerIds.has(speaker.playerId)) {
        pushIssue(issues, {
            severity: "error",
            code: "BROKEN_EFFECT_REFERENCE",
            idParts: [location.label, "phrase", "player", speaker.playerId],
            location: { ...location, kind: "rule" },
            message: `La frase de la regla referencia un player inexistente.`,
        });
    }

    if (speaker.kind === "npc" && !indexes.npcIds.has(speaker.npcId)) {
        pushIssue(issues, {
            severity: "error",
            code: "BROKEN_EFFECT_REFERENCE",
            idParts: [location.label, "phrase", "npc", speaker.npcId],
            location: { ...location, kind: "rule" },
            message: `La frase de la regla referencia un NPC inexistente.`,
        });
    }
}

function diagnoseRuleStructure(
    issues: DiagnosticIssue[],
    rule: { when?: Condition; phrase?: RulePhrase; effects: Effect[] },
    location: DeleteLocation,
    idParts: Array<string | undefined>,
): void {
    const hasCondition = Boolean(rule.when);
    const hasPhrase = hasMeaningfulPhrase(rule.phrase);
    const hasEffects = rule.effects.length > 0;

    if (hasEffects) return;

    if (!hasCondition && !hasPhrase) {
        pushIssue(issues, {
            severity: "warning",
            code: "RULE_WITHOUT_EFFECTS",
            idParts: [...idParts, "empty"],
            location,
            message: `La regla está vacía y debería eliminarse.`,
        });
        return;
    }

    if (hasPhrase && !hasCondition) {
        pushIssue(issues, {
            severity: "warning",
            code: "RULE_WITHOUT_EFFECTS",
            idParts: [...idParts, "phrase-only"],
            location,
            message: `La regla solo muestra una frase y no tiene efectos.`,
        });
        return;
    }

    if (hasCondition && !hasPhrase) {
        pushIssue(issues, {
            severity: "warning",
            code: "RULE_WITHOUT_EFFECTS",
            idParts: [...idParts, "condition-only"],
            location,
            message: `La regla solo tiene condición y no tiene efectos.`,
        });
        return;
    }

    pushIssue(issues, {
        severity: "warning",
        code: "RULE_WITHOUT_EFFECTS",
        idParts: [...idParts, "phrase-and-condition"],
        location,
        message: `La regla tiene frase y condición, pero no tiene efectos.`,
    });
}

/* ---------- Rules ---------- */
function diagnoseRules(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    rules: InteractionRules | undefined,
    input: {
        nodeId: ID;
        nodeLabel: string;
        layerId: ID;
        layerLabel: string;
        ownerKind: DeleteLocation["kind"];
        ownerId: ID;
        ownerLabel: string;
    },
): void {
    const diagnoseRuleList = (
        list: NonNullable<InteractionRules["onClick"]> | NonNullable<InteractionRules["onUseItem"]> | undefined,
        kind: "onClick" | "onUseItem",
    ) => {
        for (const rule of list ?? []) {
            const loc = ruleLocation({
                ...input,
                ruleId: rule.id,
            });

            diagnoseRuleStructure(
                issues,
                rule,
                loc,
                [input.nodeId, input.layerId, input.ownerId, rule.id],
            );

            diagnosePhrase(issues, indexes, rule.phrase, loc);

            if (kind === "onUseItem") {
                const itemInstanceId = "itemInstanceId" in rule && typeof rule.itemInstanceId === "string"
                    ? rule.itemInstanceId
                    : null;

                if (!itemInstanceId || !indexes.gameItemInstanceIds.has(itemInstanceId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_ITEM_REFERENCE",
                        idParts: [input.nodeId, input.layerId, input.ownerId, rule.id, itemInstanceId ?? "missing"],
                        location: loc,
                        message: `La regla de uso referencia un item inexistente.`,
                    });
                }
            }

            diagnoseCondition(issues, indexes, rule.when, loc);

            for (const effect of rule.effects) {
                diagnoseEffect(issues, indexes, effect, loc);
            }
        }
    };

    diagnoseRuleList(rules?.onClick, "onClick");
    diagnoseRuleList(rules?.onUseItem, "onUseItem");
}

/* ---------- Scene ---------- */

function diagnoseLayer(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    layer: SceneImageLayer,
    input: { nodeId: ID; nodeLabel: string },
): void {
    const layerLabel = label(layer.label, layer.id);
    const loc = layerLocation({
        nodeId: input.nodeId,
        nodeLabel: input.nodeLabel,
        layerId: layer.id,
        layerLabel,
    });

    if (!layer.assetId) {
        pushIssue(issues, {
            severity: "error",
            code: "LAYER_WITHOUT_IMAGE",
            idParts: [input.nodeId, layer.id],
            location: loc,
            message: `La variante no tiene imagen de fondo.`,
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
                    label: `${input.nodeLabel} > ${layerLabel} > Item ${label(placedItem.label, placedItem.itemInstanceId)}`,
                },
                message: `El item colocado referencia un item global inexistente.`,
            });
        }

        diagnoseRules(issues, indexes, placedItem.rules, {
            nodeId: input.nodeId,
            nodeLabel: input.nodeLabel,
            layerId: layer.id,
            layerLabel,
            ownerKind: "placed-item",
            ownerId: placedItem.itemInstanceId,
            ownerLabel: `Item ${label(placedItem.label, placedItem.itemInstanceId)}`,
        });
    }

    for (const placedNpc of layer.placedNpcs ?? []) {
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
                    label: `${input.nodeLabel} > ${layerLabel} > NPC ${placedNpc.npcId}`,
                },
                message: `El NPC colocado referencia un NPC global inexistente.`,
            });
        }

        diagnoseRules(issues, indexes, placedNpc.rules, {
            nodeId: input.nodeId,
            nodeLabel: input.nodeLabel,
            layerId: layer.id,
            layerLabel,
            ownerKind: "placed-npc",
            ownerId: placedNpc.npcId,
            ownerLabel: `NPC ${placedNpc.npcId}`,
        });
    }

    for (const placedPlayer of layer.placedPlayers ?? []) {
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
                    label: `${input.nodeLabel} > ${layerLabel} > Player ${placedPlayer.playerId}`,
                },
                message: `El player colocado referencia un player global inexistente.`,
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
                    label: `${input.nodeLabel} > ${layerLabel} > Player ${placedPlayer.playerId}`,
                },
                message: `El player colocado referencia una imagen inicial inexistente.`,
            });
        }
    }
}

function diagnoseDialogue(
    issues: DiagnosticIssue[],
    indexes: Indexes,
    dialogue: Dialogue,
    input: { nodeId: ID; nodeLabel: string },
): void {
    const dialogueLabel = label(dialogue.title, dialogue.id);
    const loc = dialogueLocation({
        nodeId: input.nodeId,
        nodeLabel: input.nodeLabel,
        dialogueId: dialogue.id,
        dialogueLabel,
    });

    if (!indexes.playerIds.has(dialogue.playerId) || !indexes.npcIds.has(dialogue.npcId)) {
        pushIssue(issues, {
            severity: "error",
            code: "BROKEN_EFFECT_REFERENCE",
            idParts: [input.nodeId, dialogue.id, dialogue.playerId, dialogue.npcId],
            location: loc,
            message: `El diálogo referencia un player o NPC inexistente.`,
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
            message: `El diálogo tiene un rootId inválido.`,
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
                        message: `El diálogo contiene una referencia a una línea hija inexistente.`,
                    });
                }
            }

            continue;
        }

        const lineLoc = dialogueLineLocation({
            nodeId: input.nodeId,
            nodeLabel: input.nodeLabel,
            dialogueId: dialogue.id,
            dialogueLabel,
            lineId: dialogueNode.id,
        });

        if (!dialogueNode.text.trim()) {
            pushIssue(issues, {
                severity: "warning",
                code: "DIALOGUE_LINE_WITHOUT_TEXT",
                idParts: [input.nodeId, dialogue.id, dialogueNode.id],
                location: lineLoc,
                message: `La línea de diálogo no tiene texto.`,
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
                    message: `La línea referencia una línea hija inexistente.`,
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
    if (!project) {
        return {
            errors: [],
            warnings: [],
        };
    }

    const issues: DiagnosticIssue[] = [];
    const indexes = buildIndexes(project);

    for (const player of project.players) {
        if (player.images.length === 0) {
            pushIssue(issues, {
                severity: "error",
                code: "PLAYER_WITHOUT_IMAGES",
                idParts: [player.id],
                location: {
                    kind: "player",
                    playerId: player.id,
                    label: `Player ${label(player.name, player.id)}`,
                },
                message: `El player no tiene ninguna imagen.`,
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
                        label: `Player ${label(player.name, player.id)}`,
                    },
                    message: `El inventario inicial del player referencia un item global inexistente.`,
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
                        label: `NPC ${label(npc.name, npc.id)}`,
                    },
                    message: `El inventario inicial del NPC referencia un item global inexistente.`,
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
                message: `La escena no tiene ninguna variante.`,
            });
        }

        if (node.musicTrackId && !indexes.musicIds.has(node.musicTrackId)) {
            pushIssue(issues, {
                severity: "error",
                code: "BROKEN_EFFECT_REFERENCE",
                idParts: [node.id, node.musicTrackId],
                location: nodeLocation(node.id, nodeLabel),
                message: `La escena referencia una música inexistente.`,
            });
        }

        if (node.mapLocation) {
            const regionIds = indexes.mapRegionIdsByMapId.get(node.mapLocation.mapId);

            if (!indexes.mapIds.has(node.mapLocation.mapId) || !regionIds?.has(node.mapLocation.regionId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [node.id, node.mapLocation.mapId, node.mapLocation.regionId],
                    location: nodeLocation(node.id, nodeLabel),
                    message: `La escena referencia un mapa o región inexistente.`,
                });
            }
        }

        for (const layer of node.layers) {
            diagnoseLayer(issues, indexes, layer, {
                nodeId: node.id,
                nodeLabel,
            });
        }

        for (const dialogue of node.dialogues ?? []) {
            diagnoseDialogue(issues, indexes, dialogue, {
                nodeId: node.id,
                nodeLabel,
            });
        }
    }

    for (const map of project.maps) {
        if (map.visual.type === "singleImage" && !indexes.assetIds.has(map.visual.imageAssetId)) {
            pushIssue(issues, {
                severity: "error",
                code: "BROKEN_MAP_REFERENCE",
                idParts: [map.id, map.visual.imageAssetId, "map-image"],
                location: {
                    kind: "map",
                    mapId: map.id,
                    label: `Mapa ${label(map.name, map.id)}`,
                },
                message: `El mapa referencia una imagen inexistente.`,
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
                    label: `Mapa ${label(map.name, map.id)}`,
                },
                message: `El mapa compuesto referencia una imagen de fondo inexistente.`,
            });
        }
        for (const region of map.regions) {
            const regionNodes = project.nodes.filter(
                (node) =>
                    node.mapLocation?.mapId === map.id &&
                    node.mapLocation.regionId === region.id,
            );

            if (region.imageAssetId && !indexes.assetIds.has(region.imageAssetId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, region.imageAssetId, "region-image"],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región referencia una imagen inexistente.`,
                });
            }

            const entryNodes = regionNodes.filter((node) => Boolean(node.mapLocation?.isEntry));

            if (region.entrySceneId && !entryNodes.some((node) => node.id === region.entrySceneId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, region.entrySceneId, "entry-mismatch"],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región tiene una escena de entrada que no coincide con ninguna escena marcada como entrada.`,
                });
            }

            if (entryNodes.length > 1) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, "multiple-entry-scenes"],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región tiene más de una escena marcada como entrada.`,
                });
            }

            if (regionNodes.length > 0 && !region.entrySceneId) {
                pushIssue(issues, {
                    severity: "warning",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, "missing-entry-scene"],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región tiene escenas asociadas, pero ninguna escena de entrada.`,
                });
            }

            if (region.musicTrackId && !indexes.musicIds.has(region.musicTrackId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, region.musicTrackId],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región referencia una música inexistente.`,
                });
            }

            if (region.subMapId && !indexes.mapIds.has(region.subMapId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, region.subMapId],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región referencia un submapa inexistente.`,
                });
            }

            if (region.entrySceneId && !indexes.nodeIds.has(region.entrySceneId)) {
                pushIssue(issues, {
                    severity: "error",
                    code: "BROKEN_MAP_REFERENCE",
                    idParts: [map.id, region.id, region.entrySceneId],
                    location: {
                        kind: "map-region",
                        mapId: map.id,
                        regionId: region.id,
                        label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                    },
                    message: `La región referencia una escena de entrada inexistente.`,
                });
            }

            for (const sceneId of region.sceneIds) {
                if (!indexes.nodeIds.has(sceneId)) {
                    pushIssue(issues, {
                        severity: "error",
                        code: "BROKEN_MAP_REFERENCE",
                        idParts: [map.id, region.id, sceneId],
                        location: {
                            kind: "map-region",
                            mapId: map.id,
                            regionId: region.id,
                            label: `Mapa ${label(map.name, map.id)} > Región ${label(region.label, region.id)}`,
                        },
                        message: `La región referencia una escena inexistente.`,
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