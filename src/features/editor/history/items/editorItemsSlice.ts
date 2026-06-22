import type { ID, Project, ItemDef } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { safeTrim, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorDataUtils";
import { findAssetByIdAndKind, findEntityById, isDescriptionChanged, isNameChanged, normalizeOptionalDescription, normalizeOptionalFile,
  normalizeOptionalName, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { hasDuplicatedItemInstanceLabel } from "@/validation/itemInstanceLabels";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedItemId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorItemsSlice {
  selectedItemId: ID | null;
  setSelectedItemId: (id: ID | null) => void;
  addItem: (input: { name: string; description?: string; file: File }) => ID | null;
  updateItem: (id: ID, changes: { name?: string; description?: string; file?: File | null }) => void;
  removeItem: (id: ID) => void;
}

export function createEditorItemsSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorItemsSlice {
  return {
    selectedItemId: null,

    setSelectedItemId: (id) => set({ selectedItemId: id }),

    /* Añade un objeto */
    addItem: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = normalizeOptionalName(input.name);
      const nextDescription = normalizeOptionalDescription(input.description);
      const file = input.file;

      if (!nextName) return null;
      if (!(file instanceof File)) return null;

      if (hasDuplicateName({ list: project.items, incomingName: nextName })) return null;

      if (hasDuplicatedItemInstanceLabel(project, nextName)) return null;

      const id = generateId.item();
      const filePath = buildAssetPath("items", file.name);

      const newItem: ItemDef = { id, name: nextName, ...(nextDescription ? { description: nextDescription } : null) };

      const assetResult = upsertAsset(project.assets, { id, kind: "items", name: nextName, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, id, file);

      set({
        project: {
          ...project,
          items: [...project.items, newItem],
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
        selectedItemId: id,
      });

      return id;
    },

    /* Actualiza nombre, descripción y/o fichero */
    updateItem: (id, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevItem = findEntityById(project.items, id);
        if (!prevItem) return state;

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevItem.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.items, incomingName: nextName, ignoreId: id })) return state;

        if (nameChanged && hasDuplicatedItemInstanceLabel(project, nextName)) return state;

        const hasIncomingDescription = typeof changes.description === "string";
        const nextDescription = normalizeOptionalDescription(changes.description);

        const descriptionChanged = isDescriptionChanged(prevItem.description, nextDescription, hasIncomingDescription);

        const nextFile = normalizeOptionalFile(changes.file);
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !descriptionChanged && !fileChanged) return state;

        const nextItem: ItemDef = {
          ...prevItem,
          ...(nameChanged ? { name: nextName } : null),
          ...(descriptionChanged ? { description: nextDescription || undefined } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "items");

        if (nameChanged && existingAsset) {
          const assetResult = upsertAsset(nextAssets, { id, kind: "items", name: nextItem.name, file: safeTrim(existingAsset.file) });

          nextAssets = assetResult.assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("items", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id, kind: "items", name: nextItem.name, file: filePath });

          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, id, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            items: replaceById(project.items, id, nextItem),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Elimina un item */
    removeItem: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.items.some((item) => item.id === id)) return;

      requestDelete({ kind: "item", itemId: id });
    },
  };
}