import { z } from "zod";
import { HotspotDraftSchema, HotspotSchema } from "@/features/editor/scene/hotspots/hotspotSchemas";
import { createEntityValidators, createFieldErrors, hasDuplicateUseItemRules } from "@/features/editor/scene/interactiveComponents/interactiveValidator";

const hotspotErrorKeys = ["id", "label", "shape", "initialState", "vars", "rules"] as const;

export type HotspotFieldErrors = Record<(typeof hotspotErrorKeys)[number], string | undefined>;

type HotspotValidationEntity = z.output<typeof HotspotSchema> | z.output<typeof HotspotDraftSchema>;


function createHotspotFieldErrors(): HotspotFieldErrors {
  return createFieldErrors(hotspotErrorKeys);
}

function applyBusinessRules(hotspot: HotspotValidationEntity, errors: HotspotFieldErrors): void {
  if (hasDuplicateUseItemRules(hotspot)) errors.rules ??= "No puede haber dos reglas onUseItem para el mismo objeto.";
}

const validators = createEntityValidators(HotspotSchema, HotspotDraftSchema, createHotspotFieldErrors, applyBusinessRules);

export const validateHotspot = validators.validate;