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

  const onClickResult = pickClickRule(s, placedNpc.rules ?? {});

  if (onClickResult.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: onClickResult.phrase }, ctx);
  }

  if (onClickResult.kind === "matched") {
    s = applyEffects(s, onClickResult.rule.effects ?? [], ctx);
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

  const result = pickUseItemRule(s, placedNpc.rules ?? {}, inventoryInstanceId);
  if (result.kind === "none") return s;
  if (result.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: result.phrase }, ctx);
  }

  s = applyEffects(s, result.rule.effects ?? [], ctx);

  return s;
}