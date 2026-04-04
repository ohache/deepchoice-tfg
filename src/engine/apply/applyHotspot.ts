import type { GameState } from "@/engine/state/runtimeState";
import type { Hotspot, ID } from "@/domain/types";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";
import { applyEffect, applyEffects, ensureHotspotVars, type ApplyEffectCtx } from "@/engine/apply/applyEffect";

export function applyHotspot(state: GameState, hotspot: Hotspot, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;

  let s = ensureHotspotVars(state, hotspot);

  const rules = hotspot.rules ?? {};
  const onClickResult = pickClickRule(s, { onClick: rules.onClick ?? [] });

  if (onClickResult.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: onClickResult.phrase }, ctx);
  }

  if (onClickResult.kind === "matched") {
    s = applyEffects(s, onClickResult.rule.effects ?? [], ctx);
  }

  return s;
}

export function applyHotspotUseItem(state: GameState, hotspot: Hotspot, placedItemId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.activeDialogue) return state;

  let s = ensureHotspotVars(state, hotspot);

  const rules = hotspot.rules ?? {};
  const onUseItemResult = pickUseItemRule(s, { onUseItem: rules.onUseItem ?? [] }, placedItemId);

  if (onUseItemResult.kind === "blocked") {
    return applyEffect(s, { type: "showMessage", text: onUseItemResult.phrase }, ctx);
  }

  if (onUseItemResult.kind === "matched") {
    s = applyEffects(s, onUseItemResult.rule.effects ?? [], ctx);
  }

  return s;
}