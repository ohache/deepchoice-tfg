import { z } from "zod";
import { createFileSchema } from "@/validation/genericSchemas";

const AUDIO_ALLOWED_MUSIC = /\.(mp3|ogg|wav)$/i;

const MusicFileSchema = createFileSchema({
  allowed: AUDIO_ALLOWED_MUSIC,
  message: "Formato no válido. Usa .mp3, .ogg o .wav.",
});

export const MusicDraftSchema = z.object({
  name: z.string().trim().min(1, "El nombre de la pista es obligatorio").max(60, "El nombre no puede superar 60 caracteres"),
  file: MusicFileSchema.optional(),
});

export type MusicDraftInput = z.input<typeof MusicDraftSchema>;
export type MusicDraftOutput = z.output<typeof MusicDraftSchema>;