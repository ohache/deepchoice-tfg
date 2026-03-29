import { z } from "zod";
import { createFileSchema } from "@/validation/genericSchemas";

const AUDIO_ALLOWED_SFX = /\.(mp3|ogg|wav)$/i;

const SfxFileSchema = createFileSchema({
  allowed: AUDIO_ALLOWED_SFX,
  message: "Formato no válido. Usa .mp3, .ogg o .wav.",
});

export const SfxDraftSchema = z.object({
  name: z.string().trim().min(1, "El nombre del efecto es obligatorio").max(60, "El nombre no puede superar 60 caracteres"),
  file: SfxFileSchema.optional(),
});

export type SfxDraftInput = z.input<typeof SfxDraftSchema>;
export type SfxDraftOutput = z.output<typeof SfxDraftSchema>;