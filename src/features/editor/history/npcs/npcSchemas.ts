import { z } from "zod";
import { createFileSchema } from "@/validation/genericSchemas";
import { VarDraftSchema, type VarDraftInput, type VarDraftOutput } from "@/validation/varSchemas";

export const IMAGE_ALLOWED_NPC = /\.(png|jpg|jpeg|webp)$/i;

export const NpcImageFileSchema = createFileSchema({
  allowed: IMAGE_ALLOWED_NPC,
  message: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
});

export const NpcDraftSchema = z.object({
  name: z.string().trim().min(1, "El PNJ necesita un nombre").max(60, "El nombre no puede superar 60 caracteres"),
  description: z.string().trim().max(200, "La descripción no puede superar 200 caracteres").optional(),
  file: NpcImageFileSchema.optional(),
  vars: z.array(VarDraftSchema).default([]),
});

export type NpcDraftInput = z.input<typeof NpcDraftSchema>;
export type NpcDraftOutput = z.output<typeof NpcDraftSchema>;

/* Re-export semántico */
export type NpcVarDraftInput = VarDraftInput;
export type NpcVarDraftOutput = VarDraftOutput;