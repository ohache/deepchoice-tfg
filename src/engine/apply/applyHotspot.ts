import type { GameState } from "@/engine/state/runtimeState";
import type { Hotspot, ID } from "@/domain/types";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import { applyEffect, applyEffects, ensureHotspotVars, type ApplyEffectCtx } from "@/engine/apply/applyEffect";

export function applyHotspot(state: GameState, hotspot: Hotspot, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;
  
  let s = ensureHotspotVars(state, hotspot);

  const rules = hotspot.rules ?? {};
  const onClickRule = pickClickRule(s, { onClick: rules.onClick ?? [] });

  if (onClickRule) {
    if (onClickRule.phrase?.trim()) s = applyEffect(s, { type: "showMessage", text: onClickRule.phrase.trim() }, ctx);

    s = applyEffects(s, onClickRule.effects ?? [], ctx);
  }

  return s;
}

export function applyHotspotUseItem(state: GameState, hotspot: Hotspot, placedItemId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;
  
  let s = ensureHotspotVars(state, hotspot);

  const rules = hotspot.rules ?? {};
  const onUseItemRule = pickUseItemRule(s, { onUseItem: rules.onUseItem ?? [] }, placedItemId);

  if (onUseItemRule) {
    if (onUseItemRule.phrase?.trim()) s = applyEffect(s, { type: "showMessage", text: onUseItemRule.phrase.trim() }, ctx);

    s = applyEffects(s, onUseItemRule.effects ?? [], ctx);
  }

  return s;
}