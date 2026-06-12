import type { z } from "zod";
import type { Project, ID, NpcDef } from "@/domain/types";
import { NpcDraftSchema } from "@/features/editor/history/npcs/npcSchemas";
import { validateAssetBackedDraft, type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { validateVarsDraft, type VarsErrorBag } from "@/validation/varValidator";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";

type NpcDraftInput = z.input<typeof NpcDraftSchema>;

type InventoryErrors = { initialInventory?: string; inventoryItemById?: Record<ID, string> };

export type NpcFieldErrors = AssetDraftFieldErrors & InventoryErrors & VarsErrorBag;

function validateNpcInitialInventoryDraft(input: NpcDraftInput, project: Project): InventoryErrors {
  const out: InventoryErrors = {};
  const inventory = input.initialInventory ?? [];

  const ids = inventory.map((item) => item.itemInstanceId);
  if (new Set(ids).size !== ids.length) {
    out.initialInventory = out.initialInventory ?? "Hay items de inventario con id repetido.";
  }

  const normalizedLabels = inventory.map((item) => item.label.trim().toLowerCase()).filter(Boolean);;
  if (new Set(normalizedLabels).size !== normalizedLabels.length) {
    out.initialInventory = out.initialInventory ?? "Hay items de inventario con etiqueta repetida.";
  }

  for (const item of inventory) {
    if (!item.itemId) {
      out.inventoryItemById ??= {};
      out.inventoryItemById[item.itemInstanceId] = "Selecciona un item.";
    }

    if (hasDuplicatedItemInstanceLabel(project, item.label, item.itemInstanceId)) {
      out.inventoryItemById ??= {};
      out.inventoryItemById[item.itemInstanceId] = "Ya existe otro item instanciado con ese nombre.";
    }
  }

  return out;
}

/* Valida el draft del formulario de NPCs */
export function validateNpcDraft(input: NpcDraftInput, opts: { mode: "new" | "edit"; project: Project; currentNpcId?: ID }): { ok: boolean; errors: NpcFieldErrors } {

  // Validación “asset-backed” (nombre + archivo + duplicados)
  const base = validateAssetBackedDraft<NpcDef>({
    input: { name: input.name, file: input.file ?? undefined },
    opts: { mode: opts.mode, project: opts.project, currentId: opts.currentNpcId },
    draftSchema: NpcDraftSchema,
    list: opts.project.npcs,
    assetKind: "npcs",
    messages: {
      duplicateName: "Ya existe otro PNJ con ese nombre.",
      requireFileOnNew: "Selecciona una imagen antes de guardar.",
      requireFileOnEditMissingAsset: "Este PNJ no tiene asset en el proyecto. Selecciona una imagen antes de guardar.",
      duplicateFile: "Ya existe un PNJ que usa esta imagen.",
    },
  });

  const varBag = validateVarsDraft({
    vars: input.vars,
    zodError: base.zodError,
  });

  const inventoryBag = validateNpcInitialInventoryDraft(input, opts.project);

  const errors: NpcFieldErrors = {
    ...base.errors,
    ...varBag,
    ...inventoryBag,
  };

  return {
    ok: Object.keys(errors).length === 0,
    errors,
  };
}