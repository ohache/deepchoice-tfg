import { z } from "zod";

export const ItemImageFileSchema = z
  .instanceof(File)
  .refine((file) => /\.(png|jpg|jpeg|webp)$/i.test(file.name), {
    message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
  });

export const ItemDraftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "El item necesita un nombre")
    .max(120, "El nombre no puede superar 120 caracteres"),

  description: z
    .string()
    .trim()
    .min(1, "La descripción es obligatoria")
    .max(800, "La descripción no puede superar 800 caracteres"),

  imageFile: ItemImageFileSchema.optional(),
});

export type ItemDraftInput = z.input<typeof ItemDraftSchema>;
export type ItemDraftOutput = z.output<typeof ItemDraftSchema>;