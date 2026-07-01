import { z } from "zod";
import { PlacedNpcDraftSchema, PlacedNpcSchema } from "@/features/editor/scene/placedNpcs/placedNpcSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const placedNpcErrorKeys = ["npcId", "shape", "initialState", "rules"] as const;

export type PlacedNpcFieldErrors = Record<(typeof placedNpcErrorKeys)[number], string | undefined>;

type PlacedNpcValidationEntity = z.output<typeof PlacedNpcSchema> | z.output<typeof PlacedNpcDraftSchema>;

function createPlacedNpcFieldErrors(): PlacedNpcFieldErrors {
  return createFieldErrors(placedNpcErrorKeys);
}

function applyBusinessRules(npc: PlacedNpcValidationEntity, errors: PlacedNpcFieldErrors): void {
  if (hasDuplicateUseItemRules(npc)) errors.rules ??= "No puede haber dos reglas onUseItem para el mismo objeto.";
}

const validators = createEntityValidators(PlacedNpcSchema, PlacedNpcDraftSchema, createPlacedNpcFieldErrors, applyBusinessRules);

export const validatePlacedNpc = validators.validate;