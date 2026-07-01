import { z } from "zod";
import type { ItemInstance, ItemPlacement } from "@/domain/types";
import { IdSchema, placeableStateSchema, regionShapeSchema } from "@/validation/genericSchemas";
import { interactionRulesSchema } from "@/validation/rulesSchemas";

const ItemPlacementSchema = z.object({ shape: regionShapeSchema,  initialState: placeableStateSchema }) satisfies z.ZodType<ItemPlacement>;
const ItemDraftPlacementSchema = z.object({ shape: regionShapeSchema.nullable(), initialState: placeableStateSchema });

const placedItemBaseSchema = z.object({ itemInstanceId: IdSchema, itemId: IdSchema,
  label: z.string().trim().min(1, "El nombre del objeto es obligatorio").max(60, "Máximo 60 caracteres"),
  rules: interactionRulesSchema.default({}),
});

export const PlacedItemSchema = placedItemBaseSchema.extend({ placement: ItemPlacementSchema}) satisfies z.ZodType<ItemInstance>;
export const PlacedItemDraftSchema = placedItemBaseSchema.extend({ placement: ItemDraftPlacementSchema });
