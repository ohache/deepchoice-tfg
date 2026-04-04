import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";
import type { PlacedItem, ID } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import { addInventoryInstance, applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";

function picksUpOwnItem(placedItem: PlacedItem, effects: Effect[]): boolean {
  return effects.some(
    (eff) => eff.type === "addItem" && eff.placedItemId === placedItem.id
  );
}

function stripOwnAddItemEffect(placedItem: PlacedItem, effects: Effect[]): Effect[] {
  return effects.filter((eff) => !(eff.type === "addItem" && eff.placedItemId === placedItem.id));
}

export function applyPlacedItemInteraction(state: GameState, placedItem: PlacedItem, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;

  let s = ensureNodeRuntime(state, nodeId);
  const rt = s.nodes[nodeId]!;
  const st = rt.placedItems[placedItem.id];

  if (!st) return s;

  const visible = st.visible !== false;
  const reachable = st.reachable !== false;

  if (!visible) return s;

  if (!reachable) {
    const msg = st.notReachableText?.trim() || "No puedes alcanzarlo.";
    return applyEffect(s, { type: "showMessage", text: msg }, ctx);
  }

  const result = pickClickRule(s, placedItem.rules ?? {});
  if (result.kind === "none") return s;
  if (result.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: result.phrase }, ctx);
  }

  const picksUp = picksUpOwnItem(placedItem, result.rule.effects ?? []);
  const effectsToApply = picksUp
    ? stripOwnAddItemEffect(placedItem, result.rule.effects ?? [])
    : (result.rule.effects ?? []);

  s = applyEffects(s, effectsToApply, ctx);

  if (picksUp) {
    s = addInventoryInstance(s, placedItem.id, placedItem.itemId);
    ctx.audio?.playSfxUrl("/sounds/add_item.wav");

    const nodeRt = s.nodes[nodeId]!;
    const prev = nodeRt.placedItems[placedItem.id];

    if (prev) {
      s = {
        ...s,
        nodes: {
          ...s.nodes,
          [nodeId]: {
            ...nodeRt,
            placedItems: {
              ...nodeRt.placedItems,
              [placedItem.id]: {
                ...prev,
                visible: false,
                reachable: false,
              },
            },
          },
        },
      };
    }
  }

  return s;
}

export function applyPlacedItemUseItem(state: GameState, placedItem: PlacedItem, inventoryInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;

  const nodeId = state.currentNodeId;

  let s = ensureNodeRuntime(state, nodeId);
  const rt = s.nodes[nodeId]!;
  const st = rt.placedItems[placedItem.id];

  if (!st) return s;

  const visible = st.visible !== false;
  const reachable = st.reachable !== false;

  if (!visible) return s;

  if (!reachable) {
    const msg = st.notReachableText?.trim() || "No puedes alcanzarlo.";
    return applyEffect(s, { type: "showMessage", text: msg }, ctx);
  }

  const result = pickUseItemRule(s, placedItem.rules ?? {}, inventoryInstanceId);
  if (result.kind === "none") return s;
  if (result.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: result.phrase }, ctx);
  }

  s = applyEffects(s, result.rule.effects ?? [], ctx);
  return s;
}