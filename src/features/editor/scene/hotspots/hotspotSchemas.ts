import { z } from "zod";
import { VarDefSchema } from "@/validation/genericSchemas";
import { effectSchema } from "@/validation/rulesSchemas";
import { buildInteractiveEntitySchemas, InteractionRulesSchema, InteractiveClickRuleSchema, InteractiveUseItemRuleSchema } from "@/features/editor/scene/interactiveComponents/interactiveSchemas";

export const HotspotClickRuleSchema = InteractiveClickRuleSchema;
export const HotspotUseItemRuleSchema = InteractiveUseItemRuleSchema;
export const HotspotInteractionRulesSchema = InteractionRulesSchema;

export const { finalSchema: HotspotSchema, draftSchema: HotspotDraftSchema } = buildInteractiveEntitySchemas({
  label: z.string().trim().min(1, "El label del hotspot es obligatorio").max(60, "Máximo 60 caracteres"),
  vars: z.array(VarDefSchema).default([]),
});

/* Types inferidos */
export type Hotspot = z.infer<typeof HotspotSchema>;
export type HotspotDraft = z.infer<typeof HotspotDraftSchema>;
export type HotspotInteractionRules = z.infer<typeof HotspotInteractionRulesSchema>;
export type HotspotClickRule = z.infer<typeof HotspotClickRuleSchema>;
export type HotspotUseItemRule = z.infer<typeof HotspotUseItemRuleSchema>;
export type HotspotEffect = z.infer<typeof effectSchema>;