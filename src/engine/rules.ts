import type { GameState } from "@/engine/state/runtimeState";
import type { InteractionRules, ClickRule, UseItemRule, ID } from "@/domain/types";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";

/* Regla onClick: primera que cumpla */
export function pickClickRule(state: GameState, rules: InteractionRules = {}): ClickRule | null {
  const list = rules.onClick ?? [];

  for (const rule of list) {
    if (!rule.when || evaluateCondition(state, rule.when)) return rule;
  }

  return null;
}

/* Regla onUseItem: primera que cumpla para ese itemId */
export function pickUseItemRule(state: GameState, rules: InteractionRules = {}, placedItemId: ID): UseItemRule | null {
  const list = (rules.onUseItem ?? []).filter((rule) => rule.placedItemId === placedItemId);

  for (const rule of list) {
    if (!rule.when || evaluateCondition(state, rule.when)) return rule;
  }

  return null;
}