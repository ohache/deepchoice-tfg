import type { z } from "zod";
import type { ID, Project } from "@/domain/types";
import { PlayerDraftSchema, PlayerImageDraftSchema } from "@/features/editor/history/players/playerSchemas";
import { validateAssetBackedDraft, type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { validateVarsDraft, type VarsErrorBag } from "@/validation/varValidator";
import { hasDuplicateName } from "@/validation/genericValidator";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";

type PlayerDraftInput = z.input<typeof PlayerDraftSchema>;

type ImageErrors = {
  images?: string;
  imageById?: Record<ID, AssetDraftFieldErrors>;
};

type InventoryErrors = {
  initialInventory?: string;
  inventoryItemById?: Record<ID, string>;
};

export type PlayerFieldErrors = AssetDraftFieldErrors & ImageErrors & InventoryErrors & VarsErrorBag;

function ensureImageError(errors: ImageErrors, imageId: ID): AssetDraftFieldErrors {
  errors.imageById ??= {};
  errors.imageById[imageId] ??= {};
  return errors.imageById[imageId]!;
}

function hasErrors(errors: PlayerFieldErrors): boolean {
  return Object.values(errors).some((value) => {
    if (!value) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (typeof value === "object") return Object.keys(value).length > 0;
    return false;
  });
}

/* Valida reglas específicas del inventario inicial del Player */
function validatePlayerInitialInventoryDraft(input: PlayerDraftInput, project: Project): InventoryErrors {
  const out: InventoryErrors = {};
  const inventory = input.initialInventory ?? [];

  for (const item of inventory) {
    if (!item.itemId) {
      out.inventoryItemById ??= {};
      out.inventoryItemById[item.itemInstanceId] = "Selecciona un objeto.";
      continue;
    }

    const itemExists = project.items.some((entry) => entry.id === item.itemId);

    if (!itemExists) {
      out.inventoryItemById ??= {};
      out.inventoryItemById[item.itemInstanceId] = "El objeto seleccionado no existe.";
      continue;
    }

    if (hasDuplicatedItemInstanceLabel(project, item.label, item.itemInstanceId)) {
      out.inventoryItemById ??= {};
      out.inventoryItemById[item.itemInstanceId] = "Ya existe otro objeto instanciado con ese nombre.";
    }
  }

  return out;
}

/* Mapea errores Zod generales del Player */
function collectPlayerDraftZodErrors(input: PlayerDraftInput): { baseErrors: AssetDraftFieldErrors; imageErrors: ImageErrors; zodError?: z.ZodError } {
  const baseErrors: AssetDraftFieldErrors = {};
  const imageErrors: ImageErrors = {};

  const result = PlayerDraftSchema.safeParse(input);

  if (result.success) return { baseErrors, imageErrors };

  for (const issue of result.error.issues) {
    const [field, indexLike, subField] = issue.path;

    if (field === "name") {
      baseErrors.name ??= issue.message;
      continue;
    }

    if (field === "description") {
      baseErrors.description ??= issue.message;
      continue;
    }

    if (field === "images") {
      if (typeof indexLike === "number") {
        const image = input.images?.[indexLike];

        if (image?.id && typeof subField === "string") {
          const imgErrors = ensureImageError(imageErrors, image.id);

          if (subField === "name") imgErrors.name ??= issue.message;
          else if (subField === "file") imgErrors.file ??= issue.message;
          else imageErrors.images ??= issue.message;
        } else {
          imageErrors.images ??= issue.message;
        }

        continue;
      }

      imageErrors.images ??= issue.message;
      continue;
    }

    if (field === "defaultImageId") imageErrors.images ??= issue.message;
  }

  return { baseErrors, imageErrors, zodError: result.error };
}

/* Valida las imágenes del Player como assets independientes */
function validatePlayerImagesDraft(args: { input: PlayerDraftInput; project: Project }): ImageErrors {
  const { input, project } = args;
  const out: ImageErrors = {};

  const imageNames = input.images.map((image) => image.name.trim().toLowerCase()).filter(Boolean);

  if (new Set(imageNames).size !== imageNames.length) out.images ??= "Hay imágenes con nombre repetido.";

  const imageList = project.players.flatMap((player) => player.images.map((image) => ({ id: image.id, name: image.name })));

  const imageDraftSchema = PlayerImageDraftSchema.pick({ name: true, file: true });

  for (const image of input.images) {
    const base = validateAssetBackedDraft<{ id: ID; name: string }>({
      input: { name: image.name, file: image.file ?? undefined },
      opts: { mode: "edit", project, currentId: image.id },
      draftSchema: imageDraftSchema,
      list: imageList,
      assetKind: "players",
      messages: {
        duplicateName: "Ya existe otra imagen de jugador con ese nombre.",
        requireFileOnNew: "Selecciona una imagen antes de guardar.",
        requireFileOnEditMissingAsset: "Esta imagen no tiene asset en el proyecto. Selecciona una imagen antes de guardar.",
        duplicateFile: "Ya existe otra imagen de jugador que usa este archivo.",
      },
    });

    if (Object.keys(base.errors).length > 0) Object.assign(ensureImageError(out, image.id), base.errors);
  }

  return out;
}

/* Valida el draft completo del formulario de Players */
export function validatePlayerDraft(input: PlayerDraftInput, opts: { mode: "new" | "edit"; project: Project; currentPlayerId?: ID }): { ok: boolean; errors: PlayerFieldErrors } {
  const { baseErrors, imageErrors, zodError } = collectPlayerDraftZodErrors(input);

  const nameTrim = String(input.name ?? "").trim();

  if (!baseErrors.name && hasDuplicateName({ list: opts.project.players, incomingName: nameTrim, ignoreId: opts.mode === "edit" ? opts.currentPlayerId : undefined })) {
    baseErrors.name = "Ya existe otro jugador con ese nombre.";
  }

  const varBag = validateVarsDraft({ vars: input.vars, zodError });

  const inventoryBag = validatePlayerInitialInventoryDraft(input, opts.project);

  const playerImageBag = validatePlayerImagesDraft({ input, project: opts.project });

  const errors: PlayerFieldErrors = {
    ...baseErrors,
    ...imageErrors,
    ...playerImageBag,
    ...varBag,
    ...inventoryBag,
    imageById: { ...imageErrors.imageById, ...playerImageBag.imageById },
  };

  if (Object.keys(errors.imageById ?? {}).length === 0) delete errors.imageById;

  return { ok: !hasErrors(errors), errors };
}