import type { z } from "zod";
import type { Project, ID } from "@/domain/types";
import { MapDraftSchema } from "@/features/editor/history/maps/mapSchemas";
import { validateAssetBackedDraft } from "@/validation/validateAssetBackedDraft";

type MapDraftInput = z.input<typeof MapDraftSchema>;

/* Valida el draft del formulario de Maps */
export function validateMapDraft(input: MapDraftInput, opts: { mode: "new" | "edit"; project: Project; currentMapId?: ID }) {

  return validateAssetBackedDraft({
    input: { name: input.name, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentMapId },
    draftSchema: MapDraftSchema,
    list: opts.project.maps,
    assetKind: "maps",
    messages: {
      duplicateName: "Ya existe otro mapa con ese nombre.",
      requireFileOnNew: "Selecciona una imagen antes de guardar.",
      requireFileOnEditMissingAsset: "Este mapa no tiene imagen asociada. Selecciona una imagen antes de guardar.",
      duplicateFile: "Ya existe un mapa que usa esta imagen.",
    },
  });
}