import type { Project, ID, ItemDef } from "@/domain/types";
import { ItemDraftSchema, type ItemDraftInput } from "@/features/editor/validation/itemSchemas";

export type ItemFieldErrors = {
    name?: string;
    description?: string;
    imageFile?: string;
};

interface ValidateItemDraftOptions {
    mode: "new" | "edit";
    project: Project;
    currentItemId?: ID;
}
export function validateItemDraft(input: { name: string; description: string; imageFile?: File | null }, opts: ValidateItemDraftOptions): { ok: boolean; errors: ItemFieldErrors } {
    const { mode, project, currentItemId } = opts;
    const errors: ItemFieldErrors = {};

    const baseResult = ItemDraftSchema.safeParse({
        name: input.name,
        description: input.description,
        imageFile: input.imageFile ?? undefined,
    } satisfies ItemDraftInput);

    if (!baseResult.success) {
        for (const issue of baseResult.error.issues) {
            const field = issue.path[0];
            if (field === "name" || field === "description" || field === "imageFile") {
                errors[field] = issue.message;
            }
        }
    }

    const trimmedName = input.name.trim();
    if (trimmedName) {
        const normalizedName = trimmedName.toLowerCase();

        const existsWithSameName = (project.items ?? []).some((it: ItemDef) => {
            if (mode === "edit" && currentItemId && it.id === currentItemId) return false;
            return it.name.trim().toLowerCase() === normalizedName;
        });

        if (existsWithSameName) errors.name = "Ya existe otro item con ese nombre.";
    }

    if (mode === "new") {
        if (!input.imageFile) errors.imageFile = "Selecciona una imagen antes de guardar.";
        
    } else {
        const current = currentItemId
            ? (project.items ?? []).find((it) => it.id === currentItemId) ?? null
            : null;

        if (!input.imageFile && !current?.image) errors.imageFile = "Este item no tiene imagen. Selecciona una imagen antes de guardar.";
    }

    const ok = Object.keys(errors).length === 0;
    return { ok, errors };
}
