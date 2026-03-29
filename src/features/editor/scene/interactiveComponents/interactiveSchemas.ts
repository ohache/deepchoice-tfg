import { z } from "zod";
import { IdSchema, regionShapeSchema, placeableStateSchema } from "@/validation/genericSchemas";
import { conditionSchema, effectSchema } from "@/validation/rulesSchemas";

export const InteractiveClickRuleSchema = z.object({
  id: IdSchema,
  when: conditionSchema.optional(),
  phrase: z.string().trim().optional(),
  effects: z.array(effectSchema).default([]),
});

export const InteractiveUseItemRuleSchema = z.object({
  id: IdSchema,
  placedItemId: IdSchema,
  when: conditionSchema.optional(),
  phrase: z.string().trim().optional(),
  effects: z.array(effectSchema).default([]),
});

export const InteractionRulesSchema = z.object({
  onClick: z.array(InteractiveClickRuleSchema).optional(),
  onUseItem: z.array(InteractiveUseItemRuleSchema).optional(),
});

export const InteractiveEntityBaseSchema = z.object({
  id: IdSchema,
  initialState: placeableStateSchema,
  rules: InteractionRulesSchema.default({}),
});

export function buildInteractiveEntitySchemas<T extends z.ZodRawShape>(extraShape: T ) {
  const baseSchema = InteractiveEntityBaseSchema.extend(extraShape);

  return {
    baseSchema,
    finalSchema: baseSchema.extend({
      shape: regionShapeSchema,
    }),
    draftSchema: baseSchema.extend({
      shape: regionShapeSchema.nullable(),
    }),
  };
}

export type InteractionRules = z.infer<typeof InteractionRulesSchema>;
export type InteractiveClickRule = z.infer<typeof InteractiveClickRuleSchema>;
export type InteractiveUseItemRule = z.infer<typeof InteractiveUseItemRuleSchema>;