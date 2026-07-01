import { z } from "zod";
import { createFileSchema, IdSchema } from "@/validation/genericSchemas";
import { VarDraftSchema} from "@/validation/varSchemas";
import { interactionRulesSchema } from "@/validation/rulesSchemas";

const IMAGE_ALLOWED_PLAYER = /\.(png|jpg|jpeg|webp)$/i;

const PlayerImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_PLAYER,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

export const PlayerImageDraftSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1, "La imagen necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  file: PlayerImageFileSchema.optional(),
});

const PlayerInventoryItemDraftSchema = z.object({
  itemInstanceId: IdSchema,
  itemId: IdSchema,
  label: z.string().trim().min(1, "El objeto necesita una nombre").max(60, "El nombre no puede superar 60 caracteres"),
  rules: interactionRulesSchema.optional(),
});

/* Draft completo del player en el editor */
export const PlayerDraftSchema = z.object({
  name: z.string().trim().min(1, "El jugador necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  images: z.array(PlayerImageDraftSchema).min(1, "Sube al menos una imagen"),
  defaultImageId: IdSchema,
  vars: z.array(VarDraftSchema).default([]),
  initialInventory: z.array(PlayerInventoryItemDraftSchema).default([]),
}).superRefine((draft, ctx) => {
  const defaultImageExists = draft.images.some((image) => image.id === draft.defaultImageId);

  if (!defaultImageExists) ctx.addIssue({ code: "custom", message: "La imagen por defecto no existe en la lista de imágenes.", path: ["defaultImageId"] });
});