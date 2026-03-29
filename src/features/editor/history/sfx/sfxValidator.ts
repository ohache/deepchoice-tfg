import type { z } from "zod";
import type { Project, ID } from "@/domain/types";
import { SfxDraftSchema  } from "@/features/editor/history/sfx/sfxSchemas";
import { validateAssetBackedDraft } from "@/validation/validateAssetBackedDraft";

type SfxDraftInput = z.input<typeof SfxDraftSchema>;

/* Valida el draft del formulario de SFX */
export function validateSfxDraft( input: SfxDraftInput, opts: { mode: "new" | "edit"; project: Project; currentSfxId?: ID }) {
  const sfxList = opts.project.soundEffects ?? [];

  return validateAssetBackedDraft({
    input: { name: input.name, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentSfxId },
    draftSchema: SfxDraftSchema,
    list: sfxList,
    assetKind: "sfx",
    messages: {
      duplicateName: "Ya existe otro efecto de sonido con ese título.",
      requireFileOnNew: "Selecciona un archivo de audio antes de guardar.",
      requireFileOnEditMissingAsset: "Este efecto no tiene asset en el proyecto. Selecciona un archivo de audio antes de guardar.",
      duplicateFile: "Ya existe un efecto que usa este archivo de audio.",
    },
  });
}