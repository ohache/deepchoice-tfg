import { z } from "zod";
import { IdSchema, createFileSchema, regionShapeSchema } from "@/validation/genericSchemas";

/* Archivos permitidos para mapa simple */
export const IMAGE_ALLOWED_MAP = /\.(png|jpg|jpeg|webp)$/i;

export const MapImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_MAP,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});


/* Fuente visual del mapa */
export const MapVisualSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("singleImage"),
    imageAssetId: IdSchema,
  }),
  z.object({
    type: z.literal("composed"),
    backgroundAssetId: IdSchema,
  }),
]);

/* Draft del mapa (panel/recurso global) */
export const MapDraftSchema = z.object({
  name: z.string().trim().min(1, "El mapa necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  file: MapImageFileSchema.optional(),
});

/* Región de mapa final */
export const MapRegionSchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1, "La región necesita una etiqueta").max(60, "La etiqueta no puede superar 60 caracteres"),
  shape: regionShapeSchema,
  visible: z.boolean(),
  imageAssetId: IdSchema.optional(),
  musicTrackId: IdSchema.optional(),
  subMapId: IdSchema.optional(),
  entrySceneId: IdSchema.optional(),
  sceneIds: z.array(IdSchema).default([]),
}).refine(
  (region) => (region.entrySceneId ? region.sceneIds.includes(region.entrySceneId) : true),
  { message: "La escena de entrada debe pertenecer a las escenas asociadas a la región.", path: ["entrySceneId"] }
);

/* Región de mapa draft */
export const MapRegionDraftSchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1, "La región necesita una etiqueta").max(60, "La etiqueta no puede superar 60 caracteres"),
  shape: regionShapeSchema.nullable(),
  visible: z.boolean(),
  imageAssetId: IdSchema.optional(),
  musicTrackId: IdSchema.optional(),
  subMapId: IdSchema.optional(),
  entrySceneId: IdSchema.optional(),
  sceneIds: z.array(IdSchema).default([]),
}).refine(
  (region) => (region.entrySceneId ? region.sceneIds.includes(region.entrySceneId) : true),
  { message: "La escena de entrada debe pertenecer a las escenas asociadas a la región.", path: ["entrySceneId"] }
);

/* Mapa final */
export const WorldMapSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1, "El mapa necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  visual: MapVisualSourceSchema,
  regions: z.array(MapRegionSchema).default([]),
});

/* Types inferidos */
export type MapVisualSource = z.infer<typeof MapVisualSourceSchema>;
export type MapDraftInput = z.input<typeof MapDraftSchema>;
export type MapDraftOutput = z.output<typeof MapDraftSchema>;

export type MapRegion = z.infer<typeof MapRegionSchema>;
export type MapRegionDraft = z.infer<typeof MapRegionDraftSchema>;
export type WorldMap = z.infer<typeof WorldMapSchema>;