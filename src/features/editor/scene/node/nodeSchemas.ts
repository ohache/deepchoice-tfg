import { z } from "zod";
import type { Node, NodeMeta, NodeLayout, NodeMapLocation } from "@/domain/types";
import { IdSchema } from "@/validation/genericSchemas";
import { sceneLayerSchema } from "@/features/editor/scene/layer/sceneLayerSchema";
import { DialogueSchema } from "@/features/editor/scene/dialogues/dialogueSchemas";

const MSG = {
  titleRequired: "La escena necesita un título",
  layersRequired: "La escena necesita al menos una capa",
};

export const nodeLayoutSchema = z.object({
  x: z.number(),
  y: z.number(),
}) satisfies z.ZodType<NodeLayout>;

export const nodeMetaSchema = z.object({
  layout: nodeLayoutSchema.optional(),
}) satisfies z.ZodType<NodeMeta>;

export const nodeMapLocationSchema = z.object({
  mapId: IdSchema,
  regionId: IdSchema,
  isEntry: z.boolean().optional(),
}) satisfies z.ZodType<NodeMapLocation>;

/* Node: Contenedor de capas ordenadas */
export const nodeSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1, MSG.titleRequired).max(100, "El título no puede tener más de 100 caracteres"),
  layers: z.array(sceneLayerSchema).min(1, MSG.layersRequired),
  dialogues: z.array(DialogueSchema).optional(),
  musicTrackId: IdSchema.optional(),
  mapLocation: nodeMapLocationSchema.optional(),
  isStart: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  meta: nodeMetaSchema.optional(),
}) satisfies z.ZodType<Node>;

export type NodeDTO = z.infer<typeof nodeSchema>;

export const nodeDraftSchema = nodeSchema.omit({ id: true });

export type NodeDraftDTO = z.infer<typeof nodeDraftSchema>;