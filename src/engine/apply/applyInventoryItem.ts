import type { ID, PlacedItem } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { pickUseItemRule } from "@/engine/rules";
import { applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";

function findPlacedItemByInstanceId(state: GameState, instanceId: ID): PlacedItem | null {
  for (const node of state.project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const placedItem of layer.placedItems ?? []) {
        if (placedItem.id === instanceId) return placedItem;
      }
    }
  }

  return null;
}

export function applyInventoryItemUseItem(state: GameState, sourceInstanceId: ID, targetItemId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;
  
  const sourcePlacedItem = findPlacedItemByInstanceId(state, sourceInstanceId);
  if (!sourcePlacedItem) return applyEffect(state, { type: "showMessage", text: "No puedes usar eso ahí." }, ctx);

  const rule = pickUseItemRule(state, sourcePlacedItem.rules ?? {}, targetItemId);
  if (!rule) return applyEffect(state, { type: "showMessage", text: "No puedes usar eso ahí." }, ctx);

  let s = state;

  if (rule.phrase?.trim()) s = applyEffect(s, { type: "showMessage", text: rule.phrase.trim() }, ctx);

  s = applyEffects(s, rule.effects ?? [], ctx);

  return s;
}