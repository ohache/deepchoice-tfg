import type { AssetDef, ID, Project } from "@/domain/types";
import type { z } from "zod";
import type { ZodError } from "zod";
import { hasDuplicateName, hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";

export type AssetDraftFieldErrors = {
  name?: string;
  file?: string;
  description?: string;
};

interface ValidateAssetDraftOptions {
  mode: "new" | "edit";
  project: Project;
  currentId?: ID;
}

type AssetDraftMessages = {
  duplicateName: string;
  requireFileOnNew: string;
  requireFileOnEditMissingAsset: string;
  duplicateFile: string;
};

/* Validador genérico para drafts “asset-backed” */
export function validateAssetBackedDraft<TItem extends { id: ID; name: string }>(args: {
  input: { name: string; file?: File | null; description?: string | null };
  opts: ValidateAssetDraftOptions;
  draftSchema: z.ZodTypeAny;
  list: TItem[];
  assetKind: AssetDef["kind"];
  messages: AssetDraftMessages;
}): { ok: boolean; errors: AssetDraftFieldErrors; zodError?: ZodError } {
  const { input, opts, list, assetKind, messages, draftSchema } = args;

  const ignoreId = opts.mode === "edit" ? opts.currentId : undefined;
  const errors: AssetDraftFieldErrors = {};

  // Zod (solo base)
  const basePayload = { name: input.name, file: input.file, description: input.description ?? undefined };

  const baseResult = draftSchema.safeParse(basePayload);
  const zodError = baseResult.success ? undefined : baseResult.error;

  if (zodError) {
    for (const issue of zodError.issues) {
      const field = issue.path[0];

      if (field === "name") {
        errors.name = issue.message;
        continue;
      }

      if (field === "description") {
        errors.description = issue.message;
        continue;
      }

      if (field === "file") {
        errors.file = issue.message;
        continue;
      }
    }
  }

  // Nombre duplicado
  if (hasDuplicateName({ list, incomingName: input.name, ignoreId })) errors.name = errors.name ?? messages.duplicateName;

  const hasIncomingFile = Boolean(input.file);

  // En new: SIEMPRE requerir file
  if (opts.mode === "new" && !hasIncomingFile) errors.file ??= messages.requireFileOnNew;

  // En edit: si no hay file nuevo, pero el item no tiene asset, exigir file para “arreglarlo”
  if (opts.mode === "edit" && !hasIncomingFile) {
    const current = opts.currentId != null ? list.find((t) => t.id === opts.currentId) ?? null : null;

    if (current) {
      const hasAsset = (opts.project.assets ?? []).some((a) => a.kind === assetKind && a.id === current.id);
      if (!hasAsset) errors.file ??= messages.requireFileOnEditMissingAsset;
    }
  }

  // Duplicado de fichero
  if (hasIncomingFile) {
    const duplicateFile = hasDuplicateFileByLinkedAssetId({
      project: opts.project,
      list,
      assetKind,
      incomingFileName: input.file!.name,
      ignoreId,
    });

    if (duplicateFile) errors.file ??= messages.duplicateFile;
  }

  return { ok: Object.keys(errors).length === 0, errors, zodError };
}