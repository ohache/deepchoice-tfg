import type { InteractionRules, RulePhrase, Speaker } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { SceneTestConditionSummary, SceneTestEffectSummary, SceneTestFormatContext, SceneTestRuleSummary,
  SceneTestRulesSummary } from "@/features/editor/scene/test/sceneTestTypes";
import { isEmptyCondition } from "@/shared/helpers";

/* Convierte una condición en un texto legible resumido */
export function formatCondition(condition?: Condition, ctx?: SceneTestFormatContext): SceneTestConditionSummary | undefined {
  if (!condition || isEmptyCondition(condition)) return undefined;

  return { text: conditionToText(condition, ctx) };
}

function conditionToText(condition: Condition, ctx?: SceneTestFormatContext): string {
  switch (condition.type) {
    case "and":
      return condition.all.map((child) => `${conditionToText(child, ctx)}`).join(" y ");

    case "or":
      return condition.any.map((child) => `${conditionToText(child, ctx)}`).join(" o ");

    case "not":
      return `no ${conditionToText(condition.cond, ctx)}`;

    case "nodeVisited":
      return `Escena ${resolveNodeName(condition.nodeId, ctx)} visitada ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "hasItem":
      return `El jugador tiene ${resolvePlacedItemName(condition.itemInstanceId, ctx)} ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "npcHasItem":
      return `El PNJ ${resolveNpcName(condition.npcId, ctx)} tiene ${resolvePlacedItemName(condition.itemInstanceId, ctx)} ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "playerVar":
      return `Variable de jugador ${resolvePlayerName(condition.playerId, ctx)}.${resolvePlayerVarName(condition.playerId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "npcVar":
      return `Variable de PNJ ${resolveNpcName(condition.npcId, ctx)}.${resolveNpcVarName(condition.npcId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "hotspotVar":
      return `Variable de hotspot ${resolveHotspotName(condition.hotspotId, ctx)}.${resolveHotspotVarName(condition.hotspotId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "hotspotVisible":
      return `Hotspot ${resolveHotspotName(condition.hotspotId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "hotspotReachable":
      return `Hotspot ${resolveHotspotName(condition.hotspotId, ctx)} alcanzable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedItemVisible":
      return `Objeto colocado ${resolvePlacedItemName(condition.itemInstanceId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedItemReachable":
      return `Objeto colocado ${resolvePlacedItemName(condition.itemInstanceId, ctx)} alcanzable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedNpcVisible":
      return `PNJ ${resolveNpcName(condition.npcId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedNpcReachable":
      return `PNJ ${resolveNpcName(condition.npcId, ctx)} alcanzable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedPlayerVisible":
      return `Jugador ${resolvePlayerName(condition.playerId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedPlayerImage":
      return `Imagen de jugador ${resolvePlayerName(condition.playerId, ctx)} es ${resolveImageName(condition.imageId, ctx)} ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "musicPlaying":
      return `Música ${resolveMusicName(condition.trackId, ctx)} sonando ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "mapRegionVisited":
      return `Región ${resolveMapName(condition.mapId, ctx)}.${resolveRegionName(condition.mapId, condition.regionId, ctx)} visitada ${opToText(condition.op)} ${boolToText(condition.value)}`;

    default:
      return exhaustiveFallback(condition, "Condición desconocida");
  }
}

/* Convierte un efecto en texto legible resumido */
export function formatEffect(effect: Effect, ctx?: SceneTestFormatContext): SceneTestEffectSummary {
  return { text: effectToText(effect, ctx) };
}

function effectToText(effect: Effect, ctx?: SceneTestFormatContext): string {
  switch (effect.type) {
    case "goToNode":
      return `Ir a escena ${resolveNodeName(effect.targetNodeId, ctx)}`;

    case "addItem":
      return `Añadir objeto ${resolvePlacedItemName(effect.itemInstanceId, ctx)}`;

    case "removeItem":
      return `Eliminar objeto ${resolvePlacedItemName(effect.itemInstanceId, ctx)}`;

    case "transformItem": {
      const source = resolvePlacedItemName(effect.itemInstanceId, ctx);
      const resultType = resolveItemName(effect.resultItemId, ctx);
      const resultLabel = effect.resultItemLabel?.trim() || resultType;

      return `Transformar ${source} en ${resultLabel} (${resultType})`;
    }

    case "combineItems": {
      const itemA = resolvePlacedItemName(effect.itemAInstanceId, ctx);
      const itemB = resolvePlacedItemName(effect.itemBInstanceId, ctx);
      const resultType = resolveItemName(effect.resultItemId, ctx);
      const resultLabel = effect.resultItemLabel?.trim() || resultType;

      return `Combinar ${itemA} + ${itemB} → ${resultLabel} (${resultType})`;
    }

    case "startDialogue":
      return `Iniciar diálogo ${resolveDialogueName(effect.nodeDialogueId, ctx)}`;

    case "endDialogue":
      return "Finalizar diálogo";

    case "giveItemToNpc":
      return `Dar ${resolvePlacedItemName(effect.itemInstanceId, ctx)} a ${resolveNpcName(effect.npcId, ctx)}`;

    case "receiveItemFromNpc":
      return `Recibir ${resolvePlacedItemName(effect.itemInstanceId, ctx)} de ${resolveNpcName(effect.npcId, ctx)}`;

    case "showMessage": {
      const text = effect.text.trim();
      const speaker = speakerToText(effect.speaker, ctx);

      if (!text && !speaker) return "Mostrar mensaje";
      if (!text) return `Mostrar mensaje de ${speaker}`;

      return speaker ? `Mostrar mensaje de ${speaker}: "${text}"` : `Mostrar mensaje: "${text}"`;
    }

    case "setPlacedItemVisible":
      return `Cambiar visibilidad de ${resolvePlacedItemName(effect.itemInstanceId, ctx)} a ${boolToText(effect.value)}`;

    case "setPlacedItemReachable":
      return `Cambiar alcance de ${resolvePlacedItemName(effect.itemInstanceId, ctx)} a ${boolToText(effect.value)}`;

    case "setHotspotVisible":
      return `Cambiar visibilidad del hotspot ${resolveHotspotName(effect.hotspotId, ctx)} a ${boolToText(effect.value)}`;

    case "setHotspotReachable":
      return `Cambiar alcance del hotspot ${resolveHotspotName(effect.hotspotId, ctx)} a ${boolToText(effect.value)}`;

    case "setHotspotVar":
      return `Asignar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "toggleHotspotVar":
      return `Alternar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)}`;

    case "incHotspotVar":
      return `Incrementar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decHotspotVar":
      return `Reducir ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "setPlacedPlayerVisible":
      return `Cambiar visibilidad de ${resolvePlayerName(effect.playerId, ctx)} en ${resolveNodeName(effect.nodeId, ctx)} a ${boolToText(effect.value)}`;

    case "setPlacedPlayerImage":
      return `Cambiar imagen de ${resolvePlayerName(effect.playerId, ctx)} en ${resolveNodeName(effect.nodeId, ctx)} a ${resolveImageName(effect.imageId, ctx)}`;

    case "setPlacedNpcVisible":
      return `Cambiar visibilidad de ${resolveNpcName(effect.npcId, ctx)} en ${resolveNodeName(effect.nodeId, ctx)} a ${boolToText(effect.value)}`;

    case "setPlacedNpcReachable":
      return `Cambiar alcance de ${resolveNpcName(effect.npcId, ctx)} en ${resolveNodeName(effect.nodeId, ctx)} a ${boolToText(effect.value)}`;

    case "setPlayerVar":
      return `Asignar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "togglePlayerVar":
      return `Alternar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)}`;

    case "incPlayerVar":
      return `Incrementar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decPlayerVar":
      return `Reducir ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "setNpcVar":
      return `Asignar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "toggleNpcVar":
      return `Alternar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)}`;

    case "incNpcVar":
      return `Incrementar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decNpcVar":
      return `Reducir ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "playSfx":
      return `Reproducir SFX ${resolveSfxName(effect.sfxId, ctx)}`;

    case "playMusic":
      return `Reproducir música ${resolveMusicName(effect.trackId, ctx)}${effect.startAt ? ` (${musicStartModeToText(effect.startAt)})` : ""}`;

    case "stopMusic":
      return `Detener música ${resolveMusicName(effect.trackId, ctx)}`;

    case "setMapRegionAvailable":
      return `Cambiar disponibilidad de región ${resolveMapName(effect.mapId, ctx)}.${resolveRegionName(effect.mapId, effect.regionId, ctx)} a ${boolToText(effect.value)}`;

    case "endGame":
      return effect.ending?.message?.trim() ? `Finalizar juego: "${effect.ending.message.trim()}"` : "Finalizar juego";

    default:
      return exhaustiveFallback(effect, "Efecto desconocido");
  }
}

/* Convierte InteractionRules en un resumen estructurado */
export function formatRules(rules?: InteractionRules, ctx?: SceneTestFormatContext): SceneTestRulesSummary {
  return {
    onClick: formatRuleList(rules?.onClick, "onClick", ctx),
    onUseItem: formatRuleList(rules?.onUseItem, "onUseItem", ctx),
  };
}

function formatRulePhrase(phrase?: RulePhrase, ctx?: SceneTestFormatContext): string | undefined {
  if (!phrase) return undefined;
  
  const text = phrase?.text?.trim();
  if (!text) return undefined;

  const speaker = speakerToText(phrase.speaker, ctx);
  return speaker ? `${speaker}: ${text}` : text;
}

function formatRuleList(rules: InteractionRules["onClick"] | InteractionRules["onUseItem"] | undefined, channel: "onClick" | "onUseItem",
  ctx?: SceneTestFormatContext): SceneTestRuleSummary[] {
  if (!rules || rules.length === 0) return [];

  return rules.map((rule) => ({
    id: rule.id,
    channel,
    phrase: formatRulePhrase(rule.phrase, ctx),
    when: formatCondition(rule.when, ctx),
    effects: (rule.effects ?? []).map((effect) => formatEffect(effect, ctx)),
    itemLabel: channel === "onUseItem" && "itemInstanceId" in rule && typeof rule.itemInstanceId === "string" ? resolvePlacedItemName(rule.itemInstanceId, ctx) : undefined,
  }));
}

/* Helpers */
function opToText(op: string): string {
  switch (op) {
    case "==":
      return "=";
    case "!=":
      return "≠";
    case ">":
      return ">";
    case ">=":
      return ">=";
    case "<":
      return "<";
    case "<=":
      return "<=";
    default:
      return op;
  }
}

function boolToText(value: boolean): string {
  return value ? "sí" : "no";
}

function valueToText(value: unknown): string {
  if (typeof value === "boolean") return boolToText(value);
  if (typeof value === "number") return value.toString();
  if (value == null) return "null";
  return String(value);
}

function musicStartModeToText(startAt: "resume" | "restart"): string {
  return startAt === "resume" ? "reanudar" : "reiniciar";
}

function scopedKey(a: string, b: string): string {
  return `${a}:${b}`;
}

function resolveFromIndex(index: Record<string, string> | undefined, id: string, fallbackPrefix: string): string {
  return index?.[id] ?? `${fallbackPrefix} desconocido`;
}

function resolveNodeName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.nodeNamesById, id, "Escena");
}

function resolvePlacedItemName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.placedItemNamesById ?? ctx?.placedItemNamesById, id, "Objeto colocado");
}

function resolveItemName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.itemNameById ?? ctx?.itemNameById, id, "Objeto");
}

function resolveNpcName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.npcNameById ?? ctx?.npcNameById, id, "PNJ");
}

function resolvePlayerName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.playerNameById ?? ctx?.playerNameById, id, "Jugador");
}

function resolveHotspotName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.hotspotNamesById, id, "Hotspot");
}

function resolveMapName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.mapNamesById, id, "Mapa");
}

function resolveRegionName(mapId: string, regionId: string, ctx?: SceneTestFormatContext): string {
  return ctx?.regionNamesByScopedId?.[scopedKey(mapId, regionId)] ?? "Región desconocida";
}

function resolveDialogueName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.dialogueNamesById, id, "Diálogo");
}

function resolveMusicName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.musicNameById ?? ctx?.musicNameById, id, "Música");
}

function resolveSfxName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.sfxNamesById, id, "SFX");
}

function resolveImageName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.imageNamesById ?? ctx?.imageNamesById, id, "Imagen");
}

function resolvePlayerVarName(playerId: string, varId: string, ctx?: SceneTestFormatContext): string {
  return ctx?.playerVarNamesByScopedId?.[scopedKey(playerId, varId)] ?? "Variable desconocida";
}

function resolveNpcVarName(npcId: string, varId: string, ctx?: SceneTestFormatContext): string {
  return ctx?.npcVarNamesByScopedId?.[scopedKey(npcId, varId)] ?? "Variable desconocida";
}

function resolveHotspotVarName(hotspotId: string, varId: string, ctx?: SceneTestFormatContext): string {
  return ctx?.hotspotVarNamesByScopedId?.[scopedKey(hotspotId, varId)] ?? "Variable desconocida";
}

function speakerToText(speaker?: Speaker, ctx?: SceneTestFormatContext): string | undefined {
  if (!speaker) return undefined;

  switch (speaker.kind) {
    case "narrator":
      return "Narrador";

    case "player":
      return resolvePlayerName(speaker.playerId, ctx);

    case "npc":
      return resolveNpcName(speaker.npcId, ctx);

    default:
      return exhaustiveFallback(speaker, undefined);
  }
}

function exhaustiveFallback<T>(_value: never, fallback: T): T {
  return fallback;
}