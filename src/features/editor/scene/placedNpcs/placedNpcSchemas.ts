import { z } from "zod";
import type { PlacedNpc } from "@/domain/types";
import { IdSchema, placeableStateSchema, regionShapeSchema } from "@/validation/genericSchemas";
import { interactionRulesSchema } from "@/validation/rulesSchemas";

const PlacedNpcBaseSchema = z.object({ npcId: IdSchema, initialState: placeableStateSchema, rules: interactionRulesSchema.default({})});

export const PlacedNpcSchema = PlacedNpcBaseSchema.extend({ shape: regionShapeSchema}) satisfies z.ZodType<PlacedNpc>;
export const PlacedNpcDraftSchema = PlacedNpcBaseSchema.extend({ shape: regionShapeSchema.nullable() });