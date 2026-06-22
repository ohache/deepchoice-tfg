import { z } from "zod";
import { createFileSchema, IdSchema } from "@/validation/genericSchemas";
import { VarDraftSchema } from "@/validation/varSchemas";
import { interactionRulesSchema } from "@/validation/rulesSchemas";

const IMAGE_ALLOWED_NPC = /\.(png|jpg|jpeg|webp)$/i;

const NpcImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_NPC,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

const NpcInventoryItemDraftSchema = z.object({
  itemInstanceId: IdSchema,
  itemId: IdSchema,
  label: z.string().trim().min(1, "El item necesita una etiqueta").max(60, "La etiqueta no puede superar 60 caracteres"),
  rules: interactionRulesSchema.optional(),
});

export const NpcDraftSchema = z.object({
  name: z.string().trim().min(1, "El PNJ necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  file: NpcImageFileSchema.optional(),
  vars: z.array(VarDraftSchema).default([]),
  initialInventory: z.array(NpcInventoryItemDraftSchema).default([]),
});
