import type { ID, Project, ItemDef } from "@/domain/types";
import { conditionReferences } from "@/domain/conditionRefs";
import { effectReferencesPlacedItem } from "@/domain/effectRefs";
import { hasDuplicateName } from "@/validation/genericValidator";
import { generateId } from "@/utils/id";
import { buildAssetPath } from "@/store/assets/assetPath";
import { safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile } from "@/features/editor/core/editorGenericSlice";
import { removePlacedItems, somePlacedItem, isEntityReferenced, removeEffectsInProject, removeConditionsInProject, collectPlaced } from "@/features/editor/core/editorProjectWalkers";
import { findAssetByIdAndKind, removeById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { collectIds, someReferenceForIds, nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedItemId: ID | null;
};

export interface EditorItemsSlice {
  selectedItemId: ID | null;
  setSelectedItemId: (id: ID | null) => void;
  addItem: (input: { name: string; description?: string; file: File }) => ID | null;
  updateItem: (id: ID, changes: { name?: string; description?: string; file?: File | null }) => void;
  removeItem: (id: ID) => void;
  isItemReferenced: (id: ID) => boolean;
}

export function createEditorItemsSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorItemsSlice {
  return {
    selectedItemId: null,

    setSelectedItemId: (id) => set({ selectedItemId: id }),

    /* Añade item */
    addItem: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = safeTrim(input?.name);
      const nextDescription = safeTrim(input?.description);
      const file = input?.file;

      if (!nextName) return null;
      if (!(file instanceof File)) return null;

      if (hasDuplicateName({ list: project.items, incomingName: nextName })) return null;

      const id = generateId.item();
      const filePath = buildAssetPath("items", file.name);

      const newItem: ItemDef = {
        id,
        name: nextName,
        ...(nextDescription ? { description: nextDescription } : null),
      };

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
        const prevItem = project.items.find((item) => item.id === id);
        if (!prevItem) return state;

        const nextName = typeof changes.name === "string" ? safeTrim(changes.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevItem.name;

        if (nameChanged && hasDuplicateName({ list: project.items, incomingName: nextName, ignoreId: id })) return state;

        const nextDescription = typeof changes.description === "string" ? safeTrim(changes.description) : "";

        const prevDescription = safeTrim(prevItem.description);
        const descriptionChanged = typeof changes.description === "string" && nextDescription !== prevDescription;

        const nextFile = changes.file instanceof File ? changes.file : null;
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
    removeItem: (id) =>
      set((state) => {
        if (!state.project) return state;
        if (!state.project.items.some((item) => item.id === id)) return state;

        const placedItemIds = collectIds(collectPlaced(state.project, "placedItems", (placedItem) => placedItem.itemId === id), (placedItem) => placedItem.id);

        let project = removeEffectsInProject(state.project, (effect) => someReferenceForIds(placedItemIds, effect, effectReferencesPlacedItem));

        project = removeConditionsInProject(project,
          (condition) =>
            (condition.type === "hasItem" && placedItemIds.has(condition.placedItemId)) ||
            (condition.type === "placedItemVisible" && placedItemIds.has(condition.placedItemId)) ||
            (condition.type === "placedItemReachable" && placedItemIds.has(condition.placedItemId)),
        );

        project = removePlacedItems(project, (placedItem) => placedItem.itemId === id);

        const assetResult = removeAsset(project.assets, { id, kind: "items" });
        const fileResult = removeAssetFile(state.assetFiles, id);

        return {
          ...state,
          project: {
            ...project,
            items: removeById(project.items, id),
            assets: assetResult.assets,
          },
          assetFiles: fileResult.assetFiles,
          selectedItemId: nextSelectedAfterRemoval(state.selectedItemId, id),
        };
      }),

    /* Comprueba si un item global está referenciado */
    isItemReferenced: (itemId: ID) => {
      const { project } = get();
      if (!project) return false;

      const placedItemIds = collectIds(collectPlaced(project, "placedItems", (placedItem) => placedItem.itemId === itemId), (placedItem) => placedItem.id);

      return isEntityReferenced(project, {
        someSceneRef: (currentProject) => somePlacedItem(currentProject, (placedItem) => placedItem.itemId === itemId),

        someWhenRef: (when) => someReferenceForIds(placedItemIds, when, conditionReferences.placedItem),

        someEffectRef: (effect) => someReferenceForIds(placedItemIds, effect, effectReferencesPlacedItem),
      });
    },
  };
}