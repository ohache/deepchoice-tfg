import type { ZodError } from "zod";
import type { AssetDef, ID, Project } from "@/domain/types";

import { hasDuplicateName, hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";

export type AssetDraftFieldErrors = {
  name?: string;
  file?: string;
  description?: string;
};

type AssetBackedDraftInput = {
  name: string;
  file?: File | null;
  description?: string | null;
};

type AssetBackedDraftSchema = {
  safeParse: (input: AssetBackedDraftInput) =>
    | { success: true; data: unknown }
    | { success: false; error: ZodError };
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
  draftSchema: AssetBackedDraftSchema;
  list: TItem[];
  assetKind: AssetDef["kind"];
  messages: AssetDraftMessages;
}): { ok: boolean; errors: AssetDraftFieldErrors; zodError?: ZodError } {
  const { input, opts, list, assetKind, messages, draftSchema } = args;

  const ignoreId = opts.mode === "edit" ? opts.currentId : undefined;
  const errors: AssetDraftFieldErrors = {};

  const schemaInput = { name: input.name, file: input.file, description: input.description ?? undefined };

  const baseResult = draftSchema.safeParse(schemaInput);
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

  if (hasDuplicateName({ list, incomingName: input.name, ignoreId })) errors.name = errors.name ?? messages.duplicateName;

  const hasIncomingFile = input.file instanceof File;

  if (opts.mode === "new" && !hasIncomingFile) errors.file ??= messages.requireFileOnNew;

  if (opts.mode === "edit" && !hasIncomingFile) {
    const currentItem = opts.currentId != null ? list.find((item) => item.id === opts.currentId) ?? null : null;

    if (currentItem) {
      const hasAsset = opts.project.assets.some((asset) => asset.kind === assetKind && asset.id === currentItem.id);
      if (!hasAsset) errors.file ??= messages.requireFileOnEditMissingAsset;
    }
  }

  if (hasIncomingFile) {
    const duplicateFile = hasDuplicateFileByLinkedAssetId({ project: opts.project, list, assetKind, incomingFileName: input.file!.name, ignoreId });

    if (duplicateFile) errors.file ??= messages.duplicateFile;
  }

  return { ok: Object.keys(errors).length === 0, errors, zodError };
}