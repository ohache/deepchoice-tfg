import type { Hotspot, ID } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { applyEffects, ensureHotspotVars, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { applyBlockedPhrase, applyMessageEffect } from "@/engine/apply/applyHelpers";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";

const DEFAULT_CANNOT_USE_MESSAGE = "No puedes hacer eso.";

export function applyHotspot(state: GameState, hotspot: Hotspot, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const preparedState = ensureHotspotVars(state, hotspot);
  const result = pickClickRule(preparedState, hotspot.rules ?? {});

  if (result.kind === "none") return preparedState;

  if (result.kind === "blocked") return applyBlockedPhrase(preparedState, result.phrase, ctx);

  return applyEffects(preparedState, result.rule.effects ?? [], ctx);
}

export function applyHotspotUseItem(state: GameState, hotspot: Hotspot, itemInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const preparedState = ensureHotspotVars(state, hotspot);
  const result = pickUseItemRule(preparedState, hotspot.rules ?? {}, itemInstanceId);

  if (result.kind === "none") return applyMessageEffect(preparedState, DEFAULT_CANNOT_USE_MESSAGE, ctx);

  if (result.kind === "blocked") return applyBlockedPhrase(preparedState, result.phrase, ctx);

  return applyEffects(preparedState, result.rule.effects ?? [], ctx);
}