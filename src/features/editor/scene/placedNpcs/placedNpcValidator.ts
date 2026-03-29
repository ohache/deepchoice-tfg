import { PlacedNpcDraftSchema, PlacedNpcSchema } from "@/features/editor/scene/placedNpcs/placedNpcSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const placedNpcErrorKeys = ["npcId", "shape", "initialState", "rules"] as const;

export type PlacedNpcFieldErrors = Record<typeof placedNpcErrorKeys[number], string | undefined>;

const missingRulesError = "El NPC necesita al menos una regla.";
const duplicateUseItemRuleError = "No puede haber dos reglas onUseItem para el mismo item.";

type PlacedNpcLikeForBusinessRules = {
  rules?: { onClick?: Array<unknown>; onUseItem?: Array<{ placedItemId: string }> };
};

function createPlacedNpcFieldErrors(): PlacedNpcFieldErrors {
  return createFieldErrors(placedNpcErrorKeys);
}

function hasAtLeastOneRule(npc: PlacedNpcLikeForBusinessRules): boolean {
  const clickCount = npc.rules?.onClick?.length ?? 0;
  const useCount = npc.rules?.onUseItem?.length ?? 0;
  return clickCount + useCount > 0;
}

function applyBusinessRules(npcLike: PlacedNpcLikeForBusinessRules, errors: PlacedNpcFieldErrors): void {
  if (!hasAtLeastOneRule(npcLike)) errors.rules ??= missingRulesError;
  if (hasDuplicateUseItemRules(npcLike)) errors.rules ??= duplicateUseItemRuleError;
}

const validators = createEntityValidators(PlacedNpcSchema, PlacedNpcDraftSchema, createPlacedNpcFieldErrors, applyBusinessRules );

export const validatePlacedNpc = validators.validate;
export const validatePlacedNpcDraft = validators.validateDraft;