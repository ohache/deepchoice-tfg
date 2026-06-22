import { z } from "zod";
import type { PlacedPlayer } from "@/domain/types";
import { IdSchema, regionShapeSchema } from "@/validation/genericSchemas";

const PlacedPlayerStateSchema = z.object({ visible: z.boolean() });

const PlacedPlayerBaseSchema = z.object({ playerId: IdSchema, initialImageId: IdSchema, initialState: PlacedPlayerStateSchema.default({ visible: true }) });

export const PlacedPlayerSchema = PlacedPlayerBaseSchema.extend({ shape: regionShapeSchema }) satisfies z.ZodType<PlacedPlayer>;
export const PlacedPlayerDraftSchema = PlacedPlayerBaseSchema.extend({ shape: regionShapeSchema.nullable() });
