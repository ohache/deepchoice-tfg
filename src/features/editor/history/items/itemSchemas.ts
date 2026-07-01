import { z } from "zod";
import { createFileSchema } from "@/validation/genericSchemas";

export const IMAGE_ALLOWED_ITEM = /\.(png|jpg|jpeg|webp)$/i;

export const ItemImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_ITEM,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

export const ItemDraftSchema = z.object({
  name: z.string().trim().min(1, "El objeto necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  file: ItemImageFileSchema.optional(),
})