import { z } from "zod";
import { IdSchema, createFileSchema, regionShapeSchema } from "@/validation/genericSchemas";

/* Formatos permitidos para mapa simple */
const IMAGE_ALLOWED_MAP = /\.(png|jpg|jpeg|webp)$/i;

/* Fomatos permitios para la imagen del mapa */
const MapImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_MAP,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

/* Draft del formulario de mapa */
export const MapDraftSchema = z.object({
  name: z.string().trim().min(1, "El mapa necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  file: MapImageFileSchema.optional(),
});

/* Base común de la región */
const MapRegionBaseSchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1, "La región necesita una nombre").max(60, "El nombre no puede superar 60 caracteres"),
  visible: z.boolean(),
  imageAssetId: IdSchema.optional(),
  musicTrackId: IdSchema.optional(),
  subMapId: IdSchema.optional(),
  entrySceneId: IdSchema.optional(),
  sceneIds: z.array(IdSchema).default([]),
});

/* Draft editable de región */
export const MapRegionDraftSchema = MapRegionBaseSchema.extend({
  shape: regionShapeSchema.nullable(),
});

/* Región persistida */
export const MapRegionSchema = MapRegionBaseSchema.extend({
  shape: regionShapeSchema,
});