import { z } from "zod";
import type { Project, ID } from "@/domain/types";

export const MusicFileSchema = z
  .custom<File>((val) => val instanceof File, {
    message: "Selecciona un archivo de audio.",
  })
  .refine(
    (file) => /\.(mp3|ogg|wav)$/i.test(file.name),
    { message: "Formato no válido. Usa .mp3, .ogg o .wav." }
  );

export const MusicDraftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "La pista necesita un nombre")
    .max(120, "El nombre no puede superar 120 caracteres"),
  loop: z.boolean(),
  file: MusicFileSchema.optional(),
});

export type MusicFieldErrors = {
  name?: string;
  file?: string;
};

interface ValidateMusicDraftOptions {
  mode: "new" | "edit";
  project: Project;
  currentTrackId?: ID;
}

export function validateMusicDraft(input: { name: string; loop: boolean; file?: File | null }, opts: ValidateMusicDraftOptions
   ): { ok: boolean; errors: MusicFieldErrors } {
  const { mode, project, currentTrackId } = opts;
  const errors: MusicFieldErrors = {};

  const baseResult = MusicDraftSchema.safeParse({
    name: input.name,
    loop: input.loop,
    file: input.file ?? undefined,
  });

  if (!baseResult.success) {
    for (const issue of baseResult.error.issues) {
      const field = issue.path[0];
      if (field === "name" || field === "file") {
        errors[field] = issue.message;
      }
    }
  }

  const trimmedName = input.name.trim();

  if (trimmedName) {
    const normalizedName = trimmedName.toLowerCase();

    const existsWithSameName = project.musicTracks.some((t) => {
      if (mode === "edit" && currentTrackId && t.id === currentTrackId) return false;
      return t.name.trim().toLowerCase() === normalizedName;
    });

    if (existsWithSameName) errors.name = "Ya existe otra pista de música con ese título.";
    
  }

  if (mode === "new") {
    if (!input.file) {
      errors.file = "Selecciona un archivo de audio antes de guardar.";
    } else {
      const duplicateFile = project.musicTracks.some((t) => {
        const existingFileName = t.file.split("/").pop()?.toLowerCase();
        return existingFileName === input.file!.name.toLowerCase();
      });

      if (duplicateFile) errors.file = "Ya existe una pista que usa este archivo de audio.";
    }
  }

  const ok = Object.keys(errors).length === 0;
  return { ok, errors };
}