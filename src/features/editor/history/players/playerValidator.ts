import type { z } from "zod";
import type { ID, Project } from "@/domain/types";
import { PlayerBaseDraftSchema, PlayerDraftSchema } from "@/features/editor/history/players/playerSchemas";
import { validateAssetBackedDraft, type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { validateVarsDraft, type VarsErrorBag } from "@/validation/varValidator";
import { hasDuplicateName } from "@/validation/genericValidator";

type PlayerDraftInput = z.input<typeof PlayerDraftSchema>;

type ImageErrors = { images?: string; imageById?: Record<ID, AssetDraftFieldErrors>}

export type PlayerFieldErrors = AssetDraftFieldErrors & ImageErrors & VarsErrorBag;

function ensureImgErr(errors: PlayerFieldErrors, imgId: ID): AssetDraftFieldErrors {
  errors.imageById ??= {};
  errors.imageById[imgId] ??= {};
  return errors.imageById[imgId]!;
}

function pickPlayerCoverFile(input: PlayerDraftInput): File | undefined {
  if (input.images.length === 0) return undefined;

  const defaultImage = input.images.find((i) => i.id === input.defaultImageId);
  return defaultImage?.file ?? input.images[0]?.file ?? undefined;
}

function validatePlayerImagesDraft(args: { input: PlayerDraftInput; project: Project }): ImageErrors {
  const { input, project } = args;
  const out: ImageErrors = {};

  const ids = input.images.map((i) => i.id);
  if (new Set(ids).size !== ids.length) out.images = out.images ?? "Hay imágenes con id repetido.";

  const normalizedNames = input.images.map((i) => i.name.trim().toLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) out.images = out.images ?? "Hay imágenes con nombre repetido.";

  const imageList: Array<{ id: ID; name: string }> = project.players.flatMap((p) =>
    p.images.map((img) => ({ id: img.id, name: img.name }))
  );

    for (const img of input.images) {
    const base = validateAssetBackedDraft<{ id: ID; name: string }>({
      input: { name: img.name, file: img.file ?? undefined },
      opts: { mode: "edit", project, currentId: img.id },
      draftSchema: PlayerBaseDraftSchema.pick({ name: true, file: true }),
      list: imageList,
      assetKind: "players",
      messages: {
        duplicateName: "Ya existe otra imagen de personaje con ese nombre.",
        requireFileOnNew: "Selecciona una imagen antes de guardar.",
        requireFileOnEditMissingAsset: "Esta imagen no tiene asset en el proyecto. Selecciona una imagen antes de guardar.",
        duplicateFile: "Ya existe otra imagen de personaje que usa este archivo.",
      },
    });

    if (Object.keys(base.errors).length > 0) Object.assign(ensureImgErr(out, img.id), base.errors);
  }

  return out;
}

export function validatePlayerDraft( input: PlayerDraftInput, opts: { mode: "new" | "edit"; project: Project; currentPlayerId?: ID }): { ok: boolean; errors: PlayerFieldErrors } {
  const errors: PlayerFieldErrors = {};

  const parsedBase = PlayerBaseDraftSchema.safeParse({
    name: input.name,
    description: input.description ?? undefined,
    file: pickPlayerCoverFile(input),
  });

  const baseZodError = parsedBase.success ? undefined : parsedBase.error;

  if (baseZodError) {
    for (const issue of baseZodError.issues) {
      const p0 = issue.path[0];
      if (p0 === "name") errors.name = errors.name ?? issue.message;
      if (p0 === "description") errors.description = errors.description ?? issue.message;
    }
  }

  if (hasDuplicateName({list: opts.project.players, incomingName: String(input.name ?? "").trim(), ignoreId: opts.mode === "edit" ? opts.currentPlayerId : undefined }))
    {errors.name = errors.name ?? "Ya existe otro personaje con ese nombre." }

  const full = PlayerDraftSchema.safeParse(input);
  const fullZodError = full.success ? undefined : full.error;

  if (fullZodError) {
    for (const issue of fullZodError.issues) {
      const p0 = issue.path[0];
      if (p0 === "images" || p0 === "defaultImageId") errors.images = errors.images ?? issue.message;
    }
  }

  Object.assign(errors, validatePlayerImagesDraft({ input, project: opts.project }));

  Object.assign(errors, validateVarsDraft({ vars: input.vars, zodError: fullZodError ?? baseZodError }));

  return { ok: Object.keys(errors).length === 0, errors };
}