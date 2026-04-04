import type { z } from "zod";
import type { Project, ID } from "@/domain/types";
import { MusicDraftSchema } from "@/features/editor/history/music/musicSchemas";
import { validateAssetBackedDraft } from "@/validation/validateAssetBackedDraft";

type MusicDraftInput = z.input<typeof MusicDraftSchema>;

/* Valida el draft del formulario de Music */
export function validateMusicDraft( input: MusicDraftInput, opts: { mode: "new" | "edit"; project: Project; currentTrackId?: ID }) {

  return validateAssetBackedDraft({
    input: { name: input.name, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentTrackId },
    draftSchema: MusicDraftSchema,
    list: opts.project.musicTracks,
    assetKind: "music",
    messages: {
      duplicateName: "Ya existe otra pista de música con ese título.",
      requireFileOnNew: "Selecciona un archivo de audio antes de guardar.",
      requireFileOnEditMissingAsset: "Esta pista no tiene asset en el proyecto. Selecciona un archivo de audio antes de guardar.",
      duplicateFile: "Ya existe una pista que usa este archivo de audio.",
    },
  });
}