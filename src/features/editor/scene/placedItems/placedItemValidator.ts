import { z } from "zod";
import type { Project } from "@/domain/types";
import { PlacedItemDraftSchema, PlacedItemSchema } from "@/features/editor/scene/placedItems/placedItemSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";

const placedItemErrorKeys = ["itemInstanceId", "itemId", "label", "placement", "rules"] as const;

export type PlacedItemFieldErrors = Record<(typeof placedItemErrorKeys)[number], string | undefined>;

type PlacedItemValidationEntity = z.output<typeof PlacedItemSchema> | z.output<typeof PlacedItemDraftSchema>;

type PlacedItemValidationContext = {
  project?: Project | null;
};

function createPlacedItemFieldErrors(): PlacedItemFieldErrors {
  return createFieldErrors(placedItemErrorKeys);
}

function applyBusinessRules(item: PlacedItemValidationEntity, errors: PlacedItemFieldErrors, ctx?: PlacedItemValidationContext): void {
  if (hasDuplicateUseItemRules(item)) errors.rules ??= "No puede haber dos reglas onUseItem para el mismo objeto.";;

  if (!ctx?.project) return;

  if (hasDuplicatedItemInstanceLabel(ctx.project, item.label, item.itemInstanceId)) {
    errors.label ??= "Ya existe otro placedItem con ese label. El label debe ser único en todo el proyecto.";
  }
}

const validators = createEntityValidators(PlacedItemSchema, PlacedItemDraftSchema, createPlacedItemFieldErrors, applyBusinessRules);

export const validatePlacedItem = validators.validate;