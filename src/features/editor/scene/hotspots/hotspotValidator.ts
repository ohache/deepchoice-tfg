import { HotspotDraftSchema, HotspotSchema } from "@/features/editor/scene/hotspots/hotspotSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const hotspotErrorKeys = ["id", "label", "shape", "initialState", "vars", "rules"] as const;

export type HotspotFieldErrors = Record<typeof hotspotErrorKeys[number], string | undefined>;

const missingRulesError = "El hotspot necesita al menos una regla.";
const duplicateUseItemRuleError = "No puede haber dos reglas onUseItem para el mismo item.";

type HotspotLikeForBusinessRules = {
  rules?: { onClick?: Array<unknown>; onUseItem?: Array<{ placedItemId: string }>};
};

function createHotspotFieldErrors(): HotspotFieldErrors {
  return createFieldErrors(hotspotErrorKeys);
}

function hasAtLeastOneRule(hotspot: HotspotLikeForBusinessRules): boolean {
  const clickCount = hotspot.rules?.onClick?.length ?? 0;
  const useCount = hotspot.rules?.onUseItem?.length ?? 0;
  return clickCount + useCount > 0;
}

function applyBusinessRules(hotspotLike: HotspotLikeForBusinessRules, errors: HotspotFieldErrors ): void {
  if (!hasAtLeastOneRule(hotspotLike)) errors.rules ??= missingRulesError;
  if (hasDuplicateUseItemRules(hotspotLike)) errors.rules ??= duplicateUseItemRuleError;
}

const validators = createEntityValidators(HotspotSchema, HotspotDraftSchema, createHotspotFieldErrors, applyBusinessRules);

export const validateHotspot = validators.validate;
export const validateHotspotDraft = validators.validateDraft;