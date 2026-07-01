import type { z } from "zod";
import type { Project, ID } from "@/domain/types";
import { ItemDraftSchema } from "@/features/editor/history/items/itemSchemas";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";
import { validateAssetBackedDraft } from "@/validation/validateAssetBackedDraft";

type ItemDraftInput = z.input<typeof ItemDraftSchema>;

/* Valida el draft del formulario de Items */
export function validateItemDraft( input: ItemDraftInput, opts: { mode: "new" | "edit"; project: Project; currentItemId?: ID }) {

  const result = validateAssetBackedDraft({
    input: { name: input.name, description: input.description, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentItemId },
    draftSchema: ItemDraftSchema,
    list: opts.project.items,
    assetKind: "items",
    messages: {
      duplicateName: "Ya existe otro ítem con ese nombre.",
      requireFileOnNew: "Selecciona una imagen antes de guardar.",
      requireFileOnEditMissingAsset: "Este ítem no tiene asset en el proyecto. Selecciona una imagen antes de guardar.",
      duplicateFile: "Ya existe un ítem que usa esta imagen.",
    },
  });

  if (!result.errors.name && hasDuplicatedItemInstanceLabel(opts.project, input.name)) result.errors.name = "Ya existe una instancia de objeto con ese nombre.";

  return {
    ...result,
    ok: Object.keys(result.errors).length === 0,
  };
}