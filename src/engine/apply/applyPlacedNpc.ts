import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";
import type { ID, PlacedNpc } from "@/domain/types";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import { applyEffect, applyEffects, type ApplyEffectCtx } from "@/engine/apply/applyEffect";


export function applyPlacedNpcInteraction(state: GameState, placedNpc: PlacedNpc, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;
  
  const nodeId = state.currentNodeId;

  let s = ensureNodeRuntime(state, nodeId);
  const rt = s.nodes[nodeId]!;
  const st = rt.placedNpcs[placedNpc.npcId];

  if (!st) return s;

  const visible = st.visible !== false;
  const reachable = st.reachable !== false;

  if (!visible) return s;

  if (!reachable) {
    const msg = st.notReachableText?.trim() || "No puedes alcanzar al NPC.";
    return applyEffect(s, { type: "showMessage", text: msg }, ctx);
  }

  const onClickRule = pickClickRule(s, placedNpc.rules ?? {});

  if (onClickRule) {
    if (onClickRule.phrase?.trim()) s = applyEffect(s, { type: "showMessage", text: onClickRule.phrase.trim() }, ctx);

    s = applyEffects(s, onClickRule.effects ?? [], ctx);
  }

  return s;
}

export function applyPlacedNpcUseItem(state: GameState, placedNpc: PlacedNpc, inventoryInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;
  
  const nodeId = state.currentNodeId;

  let s = ensureNodeRuntime(state, nodeId);
  const rt = s.nodes[nodeId]!;
  const st = rt.placedNpcs[placedNpc.npcId];

  if (!st) return s;

  const visible = st.visible !== false;
  const reachable = st.reachable !== false;

  if (!visible) return s;

  if (!reachable) {
    const msg = st.notReachableText?.trim() || "No puedes alcanzar al NPC.";
    return applyEffect(s, { type: "showMessage", text: msg }, ctx);
  }

  const rule = pickUseItemRule(s, placedNpc.rules ?? {}, inventoryInstanceId);
  if (!rule) return s;

  if (rule.phrase?.trim()) s = applyEffect(s, { type: "showMessage", text: rule.phrase.trim() }, ctx);

  s = applyEffects(s, rule.effects ?? [], ctx);

  return s;
}