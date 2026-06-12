import type { Hotspot, ID, RulePhrase } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { applyEffect, applyEffects, ensureHotspotVars, type ApplyEffectCtx } from "@/engine/apply/applyEffect";
import { pickClickRule, pickUseItemRule } from "@/engine/rules";

const DEFAULT_CANNOT_USE_MESSAGE = "No puedes hacer eso.";

function showMessage(state: GameState, text: string, ctx: ApplyEffectCtx): GameState {
  return applyEffect(state, { type: "showMessage", text, speakerKind: "narrator" }, ctx);
}

function showBlockedPhrase(state: GameState, phrase: RulePhrase, ctx: ApplyEffectCtx): GameState {
  return applyEffect( state,
    {
      type: "showMessage",
      text: phrase.text,
      speakerKind: phrase.speaker?.kind ?? "narrator",
      speakerId: phrase.speaker?.kind === "player" ? phrase.speaker.playerId : phrase.speaker?.kind === "npc" ? phrase.speaker.npcId : undefined,
    },
    ctx
  );
}

export function applyHotspot(state: GameState, hotspot: Hotspot, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const preparedState = ensureHotspotVars(state, hotspot);
  const result = pickClickRule(preparedState, hotspot.rules ?? {});

  if (result.kind === "none") return preparedState;

  if (result.kind === "blocked") return showBlockedPhrase(preparedState, result.phrase, ctx);

  return applyEffects(preparedState, result.rule.effects ?? [], ctx);
}

export function applyHotspotUseItem(state: GameState, hotspot: Hotspot, itemInstanceId: ID, ctx: ApplyEffectCtx = {}): GameState {
  if (state.gameEnded) return state;
  if (state.activeDialogue) return state;

  const preparedState = ensureHotspotVars(state, hotspot);
  const result = pickUseItemRule(preparedState, hotspot.rules ?? {}, itemInstanceId);

  if (result.kind === "none") {
    return showMessage(preparedState, DEFAULT_CANNOT_USE_MESSAGE, ctx);
  }

  if (result.kind === "blocked") return showBlockedPhrase(preparedState, result.phrase, ctx);

  return applyEffects(preparedState, result.rule.effects ?? [], ctx);
}