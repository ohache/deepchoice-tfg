import type { ID, ClickRule, InteractionRules, RulePhrase, UseItemRule } from "@/domain/types";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";
import type { GameState } from "@/engine/state/runtimeState";

type Rule = ClickRule | UseItemRule;

const DEFAULT_BLOCKED_PHRASE: RulePhrase = {
  text: "No puedes hacer eso.",
  speaker: { kind: "narrator" },
};

export type RuleMatchResult<T extends Rule> =
  | { kind: "matched"; rule: T }
  | { kind: "blocked"; rule: T; phrase: RulePhrase }
  | { kind: "none" };

function getBlockedPhrase(rule: Rule): RulePhrase | null {
  const text = rule.phrase?.text.trim();

  if (!text) return null;

  return {
    ...rule.phrase,
    text,
    speaker: rule.phrase?.speaker ?? { kind: "narrator" },
  };
}

function pickFirstMatchingRule<T extends Rule>(state: GameState, rules: T[]): RuleMatchResult<T> {
  let firstBlockedRule: T | null = null;

  for (const rule of rules) {
    if (!rule.when || evaluateCondition(state, rule.when)) {
      return { kind: "matched", rule };
    }

    const blockedPhrase = getBlockedPhrase(rule);

    if (blockedPhrase) {
      return {
        kind: "blocked",
        rule,
        phrase: blockedPhrase,
      };
    }

    firstBlockedRule ??= rule;
  }

  if (firstBlockedRule) {
    return {
      kind: "blocked",
      rule: firstBlockedRule,
      phrase: DEFAULT_BLOCKED_PHRASE,
    };
  }

  return { kind: "none" };
}

/* Devuelve la primera regla onClick aplicable */
export function pickClickRule(state: GameState, rules: InteractionRules = {}): RuleMatchResult<ClickRule> {
  return pickFirstMatchingRule(state, rules.onClick ?? []);
}

/* Devuelve la primera regla onUseItem aplicable para el objeto usado */
export function pickUseItemRule(state: GameState, rules: InteractionRules = {}, itemInstanceId: ID): RuleMatchResult<UseItemRule> {
  const matchingItemRules = (rules.onUseItem ?? []).filter((rule) => rule.itemInstanceId === itemInstanceId);

  return pickFirstMatchingRule(state, matchingItemRules);
}