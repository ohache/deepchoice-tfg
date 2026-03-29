import type { ID, Project, ItemDef, AssetDef } from "@/domain/types";
import { effectReferencesItem } from "@/domain/effectRefs";
import { hasDuplicateName } from "@/validation/genericValidator";
import { generateId } from "@/utils/id";
import { buildAssetPath } from "@/store/assets/assetPath";
import { safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile, removeEffectsInProject, removeItemFromConditionsInProject, conditionReferencesItem } from "@/features/editor/core/editorGenericSlice";
import { removePlacedItems, somePlacedItem, isEntityReferenced } from "@/features/editor/core/editorProjectWalkers";

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

    addItem: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const safeName = safeTrim(input?.name);
      const safeDesc = safeTrim(input?.description);

      if (!safeName) return null;

      const file = input?.file;
      if (!(file instanceof File)) return null;

      const currentItems = project.items ?? [];
      if (hasDuplicateName({ list: currentItems, incomingName: safeName })) return null;

      const id = generateId.item();
      const filePath = buildAssetPath("items", file.name);

      const newItem: ItemDef = { id, name: safeName, ...(safeDesc ? { description: safeDesc } : null) };

      const assets0: AssetDef[] = project.assets ?? [];
      const resA = upsertAsset(assets0, { id, kind: "items", name: safeName, file: filePath });
      const resF = upsertAssetFile(assetFiles, id, file);

      set({
        project: { ...project, items: [...currentItems, newItem], assets: resA.assets },
        assetFiles: resF.assetFiles,
        selectedItemId: id,
      });

      return id;
    },

    updateItem: (id, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const itemList = project.items ?? [];
        const prev = itemList.find((x) => x.id === id);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: itemList, incomingName: nextNameRaw, ignoreId: id })) return state;
        }

        const nextDescRaw = typeof changes.description === "string" ? changes.description.trim() : "";
        const prevDescRaw = String(prev.description ?? "").trim();
        const descChanged = typeof changes.description === "string" && nextDescRaw !== prevDescRaw;

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !descChanged && !fileChanged) return state;

        const nextItem: ItemDef = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
          ...(descChanged ? { description: nextDescRaw || undefined } : null),
        };

        let nextAssets = project.assets ?? [];
        const existingAsset = nextAssets.find((a) => a.id === id && a.kind === "items") ?? null;

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, { id, kind: "items", name: nextItem.name, file: String(existingAsset.file ?? "").trim() }).assets;
        }

        let nextAssetFiles = state.assetFiles;

        if (fileChanged && nextFile) {
          const newPath = buildAssetPath("items", nextFile.name);

          nextAssets = upsertAsset(nextAssets, { id, kind: "items", name: nextItem.name, file: newPath }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, id, nextFile).assetFiles;
        }

        return {
          ...state,
          project: { ...project, items: itemList.map((x) => (x.id === id ? nextItem : x)), assets: nextAssets },
          assetFiles: nextAssetFiles,
        };
      }),

    removeItem: (id) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const items0 = project0.items ?? [];
        const exists = items0.some((x) => x.id === id);
        if (!exists) return state;

        let project = removeEffectsInProject(project0, (e) => effectReferencesItem(e, id));

        project = removeItemFromConditionsInProject(project, id);

        project = removePlacedItems(project, (pi) => pi.itemId === id);

        const remainingItems = (project.items ?? []).filter((x) => x.id !== id);

        const nextSelected = state.selectedItemId === id ? null : state.selectedItemId;

        const remA = removeAsset(project.assets ?? [], { id, kind: "items" });
        const remF = removeAssetFile(state.assetFiles, id);

        return {
          project: { ...project, items: remainingItems, assets: remA.assets },
          assetFiles: remF.assetFiles,
          selectedItemId: nextSelected,
        };
      }),

    isItemReferenced: (itemId: ID) => {
      const { project } = get();
      if (!project) return false;

      return isEntityReferenced(project, {
        someSceneRef: (p) => somePlacedItem(p, (pi) => pi.itemId === itemId),
        someWhenRef: (when) => conditionReferencesItem(when, itemId),
        someEffectRef: (e) => effectReferencesItem(e, itemId),
      });
    },
  };
}