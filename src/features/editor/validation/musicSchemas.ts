import { z } from "zod";

export const MusicFileSchema = z
    .instanceof(File)
    .refine((file) => {const lower = file.name.toLowerCase();
        return (lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.endsWith(".wav"));
    }, {
        message: "Formato no válido. Usa .mp3, .ogg o .wav.",
    });

export const MusicDraftSchema = z.object({
    name: z
        .string()
        .trim()
        .min(1, "El nombre de la pista es obligatorio")
        .max(120, "El nombre no puede superar 120 caracteres"),

    loop: z.boolean().default(true),

    file: MusicFileSchema.optional(),
});

export type MusicDraftInput = z.input<typeof MusicDraftSchema>;
export type MusicDraftOutput = z.output<typeof MusicDraftSchema>;
