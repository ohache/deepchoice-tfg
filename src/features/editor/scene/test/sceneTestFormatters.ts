import type { InteractionRules } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { SceneTestConditionSummary, SceneTestEffectSummary, SceneTestRuleSummary, SceneTestRulesSummary } from "@/features/editor/scene/test/sceneTestTypes";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";

/* Contexto opcional para resolver IDs a nombres legibles */
export interface SceneTestFormatContext {
  nodeNamesById?: Record<string, string>;
  placedItemNamesById?: Record<string, string>;
  itemNamesById?: Record<string, string>;
  npcNamesById?: Record<string, string>;
  playerNamesById?: Record<string, string>;
  hotspotNamesById?: Record<string, string>;
  mapNamesById?: Record<string, string>;
  regionNamesByScopedId?: Record<string, string>;
  dialogueNamesById?: Record<string, string>;
  musicNamesById?: Record<string, string>;
  sfxNamesById?: Record<string, string>;
  imageNamesById?: Record<string, string>;
  playerVarNamesByScopedId?: Record<string, string>;
  npcVarNamesByScopedId?: Record<string, string>;
  hotspotVarNamesByScopedId?: Record<string, string>;
}

/* Convierte una condición en un texto legible resumido */
export function formatCondition(condition?: Condition, ctx?: SceneTestFormatContext): SceneTestConditionSummary | undefined {
  if (!condition || isEmptyCondition(condition)) return undefined;

  return { text: conditionToText(condition, ctx) };
}

function conditionToText(condition: Condition, ctx?: SceneTestFormatContext): string {
  switch (condition.type) {
    case "and":
      return condition.all.map((child) => conditionToText(child, ctx)).join(" AND ");

    case "or":
      return condition.any.map((child) => conditionToText(child, ctx)).join(" OR ");

    case "not":
      return `NOT (${conditionToText(condition.cond, ctx)})`;

    case "nodeVisited":
      return `Nodo ${resolveNodeName(condition.nodeId, ctx)} ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "hasItem":
      return `Tiene item ${resolvePlacedItemName(condition.placedItemId, ctx)} ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "playerVar":
      return `PlayerVar ${resolvePlayerName(condition.playerId, ctx)}.${resolvePlayerVarName(condition.playerId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "npcVar":
      return `NpcVar ${resolveNpcName(condition.npcId, ctx)}.${resolveNpcVarName(condition.npcId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "hotspotVar":
      return `HotspotVar ${resolveHotspotName(condition.hotspotId, ctx)}.${resolveHotspotVarName(condition.hotspotId, condition.varId, ctx)} ${opToText(condition.op)} ${valueToText(condition.value)}`;

    case "hotspotVisible":
      return `Hotspot ${resolveHotspotName(condition.hotspotId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "hotspotReachable":
      return `Hotspot ${resolveHotspotName(condition.hotspotId, ctx)} reachable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedItemVisible":
      return `PlacedItem ${resolvePlacedItemName(condition.placedItemId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedItemReachable":
      return `PlacedItem ${resolvePlacedItemName(condition.placedItemId, ctx)} reachable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedNpcVisible":
      return `NPC ${resolveNpcName(condition.npcId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedNpcReachable":
      return `NPC ${resolveNpcName(condition.npcId, ctx)} reachable ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "placedPlayerVisible":
      return `Player ${resolvePlayerName(condition.playerId, ctx)} visible ${opToText(condition.op)} ${boolToText(condition.value)}`;

    case "mapRegionVisited":
      return `Región ${resolveMapName(condition.mapId, ctx)}.${resolveRegionName(condition.mapId, condition.regionId, ctx)} visitada ${opToText(condition.op)} ${boolToText(condition.value)}`;

    default:
      return "Condición desconocida";
  }
}

/* Convierte un efecto en texto legible resumido */
export function formatEffect(effect: Effect, ctx?: SceneTestFormatContext): SceneTestEffectSummary {
  return { text: effectToText(effect, ctx) };
}

function effectToText(effect: Effect, ctx?: SceneTestFormatContext): string {
  switch (effect.type) {
    case "goToNode":
      return `Ir a nodo ${resolveNodeName(effect.targetNodeId, ctx)}`;

    case "addItem":
      return `Añadir item ${resolvePlacedItemName(effect.placedItemId, ctx)}`;

    case "removeItem":
      return `Eliminar item ${resolvePlacedItemName(effect.placedItemId, ctx)}`;

    case "startDialogue":
      return `Iniciar diálogo ${resolveDialogueName(effect.nodeDialogueId, ctx)}`;

    case "endDialogue":
      return "Finalizar diálogo";

    case "giveItemToNpc":
      return `Dar item ${resolvePlacedItemName(effect.placedItemId, ctx)} a NPC ${resolveNpcName(effect.npcId, ctx)}`;

    case "receiveItemFromNpc":
      return `Recibir item ${resolvePlacedItemName(effect.placedItemId, ctx)} de NPC ${resolveNpcName(effect.npcId, ctx)}`;

    case "showMessage":
      return "Mostrar mensaje";

    case "setPlacedItemVisible":
      return `Set placedItem ${resolveNodeName(effect.nodeId, ctx)}.${resolvePlacedItemName(effect.placedItemId, ctx)} visible = ${boolToText(effect.value)}`;

    case "setPlacedItemReachable":
      return `Set placedItem ${resolveNodeName(effect.nodeId, ctx)}.${resolvePlacedItemName(effect.placedItemId, ctx)} reachable = ${boolToText(effect.value)}`;

    case "setHotspotVisible":
      return `Set hotspot ${resolveHotspotName(effect.hotspotId, ctx)} visible = ${boolToText(effect.value)}`;

    case "setHotspotReachable":
      return `Set hotspot ${resolveHotspotName(effect.hotspotId, ctx)} reachable = ${boolToText(effect.value)}`;

    case "setHotspotVar":
      return `Set hotspotVar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "toggleHotspotVar":
      return `Toggle hotspotVar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)}`;

    case "incHotspotVar":
      return `Inc hotspotVar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decHotspotVar":
      return `Dec hotspotVar ${resolveHotspotName(effect.hotspotId, ctx)}.${resolveHotspotVarName(effect.hotspotId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "setPlacedPlayerVisible":
      return `Set placedPlayer ${resolveNodeName(effect.nodeId, ctx)}.${resolvePlayerName(effect.playerId, ctx)} visible = ${boolToText(effect.value)}`;

    case "setPlacedPlayerImage":
      return `Set placedPlayer ${resolveNodeName(effect.nodeId, ctx)}.${resolvePlayerName(effect.playerId, ctx)} image = ${resolveImageName(effect.imageId, ctx)}`;

    case "setPlacedNpcVisible":
      return `Set placedNpc ${resolveNodeName(effect.nodeId, ctx)}.${resolveNpcName(effect.npcId, ctx)} visible = ${boolToText(effect.value)}`;

    case "setPlacedNpcReachable":
      return `Set placedNpc ${resolveNodeName(effect.nodeId, ctx)}.${resolveNpcName(effect.npcId, ctx)} reachable = ${boolToText(effect.value)}`;

    case "setPlayerVar":
      return `Set playerVar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "togglePlayerVar":
      return `Toggle playerVar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)}`;

    case "incPlayerVar":
      return `Inc playerVar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decPlayerVar":
      return `Dec playerVar ${resolvePlayerName(effect.playerId, ctx)}.${resolvePlayerVarName(effect.playerId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "setNpcVar":
      return `Set npcVar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} = ${valueToText(effect.value)}`;

    case "toggleNpcVar":
      return `Toggle npcVar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)}`;

    case "incNpcVar":
      return `Inc npcVar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "decNpcVar":
      return `Dec npcVar ${resolveNpcName(effect.npcId, ctx)}.${resolveNpcVarName(effect.npcId, effect.varId, ctx)} en ${valueToText(effect.amount ?? 1)}`;

    case "playSfx":
      return `Reproducir SFX ${resolveSfxName(effect.sfxId, ctx)}`;

    case "playMusic":
      return `Reproducir música ${resolveMusicName(effect.trackId, ctx)}`;

    case "pauseMusic":
      return "Pausar música";

    case "stopMusic":
      return "Detener música";

    case "setMapRegionAvailable":
      return `Set región ${resolveMapName(effect.mapId, ctx)}.${resolveRegionName(effect.mapId, effect.regionId, ctx)} available = ${boolToText(effect.value)}`;

    case "endGame":
      return "Finalizar juego";

    default:
      return "Efecto desconocido";
  }
}

/* Convierte InteractionRules en un resumen estructurado */
export function formatRules(rules?: InteractionRules, ctx?: SceneTestFormatContext): SceneTestRulesSummary {
  return {
    onClick: formatRuleList(rules?.onClick, "onClick", ctx),
    onUseItem: formatRuleList(rules?.onUseItem, "onUseItem", ctx),
  };
}

function formatRuleList(rules: InteractionRules["onClick"] | InteractionRules["onUseItem"] | undefined,
  channel: "onClick" | "onUseItem", ctx?: SceneTestFormatContext): SceneTestRuleSummary[] {
  if (!rules || rules.length === 0) return [];

  return rules.map((rule) => ({
    id: rule.id,
    channel,
    phrase: rule.phrase,
    when: formatCondition(rule.when, ctx),
    effects: (rule.effects ?? []).map((effect) => formatEffect(effect, ctx)),
    itemLabel: channel === "onUseItem" && "placedItemId" in rule ? resolvePlacedItemName(rule.placedItemId, ctx) : undefined,
  }));
}

/* Helpers */
function opToText(op: string): string {
  switch (op) {
    case "==": return "==";
    case "!=": return "!=";
    case ">": return ">";
    case ">=": return ">=";
    case "<": return "<";
    case "<=": return "<=";
    default: return op;
  }
}

function boolToText(value: boolean): string {
  return value ? "true" : "false";
}

function valueToText(value: unknown): string {
  if (typeof value === "boolean") return boolToText(value);
  if (typeof value === "number") return value.toString();
  if (value == null) return "null";
  return String(value);
}

function scopedKey(a: string, b: string): string {
  return `${a}:${b}`;
}

function resolveFromIndex(index: Record<string, string> | undefined, id: string, fallbackPrefix: string): string {
  return index?.[id] ?? `${fallbackPrefix} desconocido`;
}

function resolveNodeName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.nodeNamesById, id, "Nodo");
}

function resolvePlacedItemName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.placedItemNamesById ?? ctx?.itemNamesById, id, "Item");
}

function resolveNpcName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.npcNamesById, id, "NPC");
}

function resolvePlayerName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.playerNamesById, id, "Player");
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
  return resolveFromIndex(ctx?.musicNamesById, id, "Música");
}

function resolveSfxName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.sfxNamesById, id, "SFX");
}

function resolveImageName(id: string, ctx?: SceneTestFormatContext): string {
  return resolveFromIndex(ctx?.imageNamesById, id, "Imagen");
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