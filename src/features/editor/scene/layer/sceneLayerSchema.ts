import { z } from "zod";
import type { ConditionalTextEntry, ConditionalText, SceneImageLayer } from "@/domain/types";
import { IdSchema } from "@/validation/genericSchemas";
import { conditionSchema } from "@/validation/rulesSchemas";
import { HotspotSchema } from "@/features/editor/scene/hotspots/hotspotSchemas";
import { PlacedItemSchema } from "@/features/editor/scene/placedItems/placedItemSchemas";
import { PlacedPlayerSchema } from "@/features/editor/scene/placedPlayers/placedPlayerSchemas";
import { PlacedNpcSchema } from "@/features/editor/scene/placedNpcs/placedNpcSchemas";

export const textDockSchema = z.enum(["bottom", "top", "left", "right"]);

export const conditionalTextEntrySchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1, "El texto necesita un nombre.").max(60, "El nombre no puede tener más de 60 caracteres."),
  when: conditionSchema.optional(),
  content: z.string(),
}) satisfies z.ZodType<ConditionalTextEntry>;

export const conditionalTextSchema = z.array(conditionalTextEntrySchema) satisfies z.ZodType<ConditionalText>;

export const sceneLayerSchema = z.object({
  id: IdSchema,
  assetId: IdSchema,
  label: z.string().trim().min(1, "La capa necesita un nombre.").max(60, "El nombre no puede tener más de 60 caracteres."),
  when: conditionSchema.optional(),
  dock: textDockSchema,
  text: conditionalTextSchema,
  hotspots: z.array(HotspotSchema).optional(),
  placedItems: z.array(PlacedItemSchema).optional(),
  placedNpcs: z.array(PlacedNpcSchema).optional(),
  placedPlayers: z.array(PlacedPlayerSchema).optional(),
  musicTrackId: IdSchema.optional(),
}) satisfies z.ZodType<SceneImageLayer>;

export type SceneImageLayerDTO = z.infer<typeof sceneLayerSchema>;