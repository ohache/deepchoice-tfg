import type { GameState } from "@/engine/state/runtimeState";
import type { InteractionRules, ClickRule, UseItemRule, ID } from "@/domain/types";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";

type RuleMatchResult<T extends ClickRule | UseItemRule> =
  | { kind: "matched"; rule: T }
  | { kind: "blocked"; rule: T; phrase: string }
  | { kind: "none" };

/* Regla onClick: primera que cumpla */
export function pickClickRule(state: GameState, rules: InteractionRules = {}): RuleMatchResult<ClickRule> {
  const list = rules.onClick ?? [];

  for (const rule of list) {
    if (!rule.when || evaluateCondition(state, rule.when)) {
      return { kind: "matched", rule };
    }

    if (rule.phrase?.trim()) {
      return { kind: "blocked", rule, phrase: rule.phrase.trim() };
    }
  }

  return { kind: "none" };
}

/* Regla onUseItem: primera que cumpla para ese itemId */
export function pickUseItemRule(state: GameState, rules: InteractionRules = {}, placedItemId: ID): RuleMatchResult<UseItemRule> {
  const list = (rules.onUseItem ?? []).filter((rule) => rule.placedItemId === placedItemId);

  for (const rule of list) {
    if (!rule.when || evaluateCondition(state, rule.when)) {
      return { kind: "matched", rule };
    }

    if (rule.phrase?.trim()) {
      return { kind: "blocked", rule, phrase: rule.phrase.trim() };
    }
  }

  return { kind: "none" };
}