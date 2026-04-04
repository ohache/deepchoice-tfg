import { z } from "zod";
import { IdSchema } from "@/validation/genericSchemas";
import { buildInteractiveEntitySchemas, InteractionRulesSchema, InteractiveClickRuleSchema,
  InteractiveUseItemRuleSchema } from "@/features/editor/scene/interactiveComponents/interactiveSchemas";

export const PlacedItemClickRuleSchema = InteractiveClickRuleSchema;
export const PlacedItemUseItemRuleSchema = InteractiveUseItemRuleSchema;
export const PlacedItemInteractionRulesSchema = InteractionRulesSchema;

export const { finalSchema: PlacedItemSchema, draftSchema: PlacedItemDraftSchema } = buildInteractiveEntitySchemas({
  itemId: IdSchema,
  label: z.string().trim().min(1, "El label del item es obligatorio").max(60, "Máximo 60 caracteres"),
});

/* Types inferidos */
export type PlacedItem = z.infer<typeof PlacedItemSchema>;
export type PlacedItemDraft = z.infer<typeof PlacedItemDraftSchema>;
export type PlacedItemInteractionRules = z.infer<typeof PlacedItemInteractionRulesSchema>;
export type PlacedItemClickRule = z.infer<typeof PlacedItemClickRuleSchema>;
export type PlacedItemUseItemRule = z.infer<typeof PlacedItemUseItemRuleSchema>;