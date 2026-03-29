import type { z } from "zod";
import type { Project, ID, NpcDef } from "@/domain/types";
import { NpcDraftSchema } from "@/features/editor/history/npcs/npcSchemas";
import { validateAssetBackedDraft, type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { validateVarsDraft, type VarsErrorBag } from "@/validation/varValidator";

type NpcDraftInput = z.input<typeof NpcDraftSchema>;

export type NpcFieldErrors = AssetDraftFieldErrors & VarsErrorBag;

/* Valida el draft del formulario de NPCs */
export function validateNpcDraft(input: NpcDraftInput, opts: { mode: "new" | "edit"; project: Project; currentNpcId?: ID }) : { ok: boolean; errors: NpcFieldErrors } {
  const npcList = opts.project.npcs ?? [];

  // Validación “asset-backed” (nombre + archivo + duplicados)
  const base = validateAssetBackedDraft<NpcDef>({
    input: { name: input.name, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentNpcId },
    draftSchema: NpcDraftSchema,
    list: npcList,
    assetKind: "npcs",
    messages: {
      duplicateName: "Ya existe otro PNJ con ese nombre.",
      requireFileOnNew: "Selecciona una imagen antes de guardar.",
      requireFileOnEditMissingAsset: "Este PNJ no tiene asset en el proyecto. Selecciona una imagen antes de guardar.",
      duplicateFile: "Ya existe un PNJ que usa esta imagen.",
    },
  });

  const errors: NpcFieldErrors = { ...base.errors };

  const varBag = validateVarsDraft({
    vars: input.vars,
    zodError: base.zodError,
  });

  Object.assign(errors, varBag);

  return { ok: Object.keys(errors).length === 0, errors };
}