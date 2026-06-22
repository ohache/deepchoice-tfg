import { z } from "zod";
import type { Hotspot } from "@/domain/types";
import { VarDefSchema, IdSchema, placeableStateSchema, regionShapeSchema } from "@/validation/genericSchemas";
import { interactionRulesSchema } from "@/validation/rulesSchemas";


const HotspotBaseSchema = z.object({ id: IdSchema,
  label: z.string().trim().min(1, "El label del hotspot es obligatorio").max(60, "Máximo 60 caracteres"),
  initialState: placeableStateSchema, vars: z.array(VarDefSchema).default([]), rules: interactionRulesSchema.default({}) });

export const HotspotSchema = HotspotBaseSchema.extend({ shape: regionShapeSchema }) satisfies z.ZodType<Hotspot> ;
export const HotspotDraftSchema = HotspotBaseSchema.extend({ shape: regionShapeSchema.nullable() });