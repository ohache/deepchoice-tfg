import type { Project } from "@/domain/types";
import { PlacedItemDraftSchema, PlacedItemSchema } from "@/features/editor/scene/placedItems/placedItemSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const placedItemErrorKeys = ["id", "itemId", "label", "shape", "initialState", "rules"] as const;

export type PlacedItemFieldErrors = Record<typeof placedItemErrorKeys[number], string | undefined>;

const missingPickupEffectError = "El item necesita al menos un efecto addItem de su propio placedItemId para poder recogerse.";
const duplicateUseItemRuleError = "No puede haber dos reglas onUseItem para el mismo item.";
const duplicateLabelError = "Ya existe otro placedItem con ese label. El label debe ser único en todo el proyecto.";

type EffectLike = {
  type?: string;
  placedItemId?: string;
};

type RuleLike = {
  effects?: EffectLike[];
};

type PlacedItemLikeForBusinessRules = {
  id: string;
  itemId: string;
  label: string;
  rules?: { onClick?: RuleLike[]; onUseItem?: Array<{ placedItemId: string; effects?: EffectLike[] }> };
};

function createPlacedItemFieldErrors(): PlacedItemFieldErrors {
  return createFieldErrors(placedItemErrorKeys);
}

function hasDuplicatePlacedItemLabel(item: PlacedItemLikeForBusinessRules, project?: Project | null ): boolean {
  const labelKey = item.label?.trim().toLowerCase();
  if (!project || !labelKey) return false;

  return (project.nodes ?? []).some((node) =>
    (node.layers ?? []).some((layer) =>
      (layer.placedItems ?? []).some(
        (other) => other.id !== item.id && other.label.trim().toLowerCase() === labelKey
      )
    )
  );
}

function hasOwnAddItemEffect(item: PlacedItemLikeForBusinessRules): boolean {
  const targetPlacedItemId = item.id;
  const allRules = [...(item.rules?.onClick ?? []), ...(item.rules?.onUseItem ?? [])];

  return allRules.some((rule) =>
    (rule.effects ?? []).some(
      (effect) =>
        effect.type === "addItem" && effect.placedItemId === targetPlacedItemId,
    ),
  );
}

function applyBusinessRules(itemLike: PlacedItemLikeForBusinessRules, errors: PlacedItemFieldErrors, ctx?: { project?: Project | null}): void {
  if (hasDuplicateUseItemRules(itemLike)) errors.rules ??= duplicateUseItemRuleError;
  if (!hasOwnAddItemEffect(itemLike)) errors.rules ??= missingPickupEffectError;
  if (hasDuplicatePlacedItemLabel(itemLike, ctx?.project)) errors.label ??= duplicateLabelError;
}

const validators = createEntityValidators(PlacedItemSchema, PlacedItemDraftSchema, createPlacedItemFieldErrors, applyBusinessRules);

export const validatePlacedItem = validators.validate;
export const validatePlacedItemDraft = validators.validateDraft;