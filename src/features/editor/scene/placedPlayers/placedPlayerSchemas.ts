import { z } from "zod";
import { IdSchema, regionShapeSchema } from "@/validation/genericSchemas";

export const PlacedPlayerStateSchema = z.object({
  visible: z.boolean(),
});

const PlacedPlayerBaseSchema = z.object({
  playerId: IdSchema,
  initialImageId: IdSchema,
  initialState: PlacedPlayerStateSchema.default({
    visible: true,
  }),
});

export const PlacedPlayerSchema = PlacedPlayerBaseSchema.extend({
  shape: regionShapeSchema,
});

export const PlacedPlayerDraftSchema = PlacedPlayerBaseSchema.extend({
  shape: regionShapeSchema.nullable(),
});

/* Types inferidos */
export type PlacedPlayer = z.infer<typeof PlacedPlayerSchema>;
export type PlacedPlayerDraft = z.infer<typeof PlacedPlayerDraftSchema>;
export type PlacedPlayerState = z.infer<typeof PlacedPlayerStateSchema>;