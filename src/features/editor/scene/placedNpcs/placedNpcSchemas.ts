import { z } from "zod";
import { IdSchema, regionShapeSchema, placeableStateSchema } from "@/validation/genericSchemas";
import { InteractionRulesSchema, InteractiveClickRuleSchema, InteractiveUseItemRuleSchema } from "@/features/editor/scene/interactiveComponents/interactiveSchemas";

export const PlacedNpcClickRuleSchema = InteractiveClickRuleSchema;
export const PlacedNpcUseItemRuleSchema = InteractiveUseItemRuleSchema;
export const PlacedNpcInteractionRulesSchema = InteractionRulesSchema;

const PlacedNpcBaseSchema = z.object({
  npcId: IdSchema,
  initialState: placeableStateSchema,
  rules: PlacedNpcInteractionRulesSchema.default({}),
});

export const PlacedNpcSchema = PlacedNpcBaseSchema.extend({
  shape: regionShapeSchema,
});

export const PlacedNpcDraftSchema = PlacedNpcBaseSchema.extend({
  shape: regionShapeSchema.nullable(),
});

/* Types inferidos */
export type PlacedNpc = z.infer<typeof PlacedNpcSchema>;
export type PlacedNpcDraft = z.infer<typeof PlacedNpcDraftSchema>;
export type PlacedNpcInteractionRules = z.infer<typeof PlacedNpcInteractionRulesSchema>;
export type PlacedNpcClickRule = z.infer<typeof PlacedNpcClickRuleSchema>;
export type PlacedNpcUseItemRule = z.infer<typeof PlacedNpcUseItemRuleSchema>;