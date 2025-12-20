import type { ID, ItemDef, Node } from "@/domain/types";
import { buildItemImagePath } from "@/features/editor/components/scene/SceneCommon";
import { generateTagItemId } from "@/utils/id";

export interface EditorItemsSlice {
  selectedItemId: ID | null;
  setSelectedItemId: (id: ID | null) => void;

  addItemDef: (input: {
    name: string;
    description?: string;
    imageFile?: File | null;
  }) => ID | null;

  updateItemDef: (
    id: ID,
    patch: {
      name?: string;
      description?: string;
      imageFile?: File | null;
      clearImage?: boolean;
    }
  ) => void;

  removeItemDef: (id: ID) => void;
}

function isValidItemImageFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ( lower.endsWith(".png") || lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") || lower.endsWith(".webp"));
}

export function createEditorItemsSlice(set: any, get: any): EditorItemsSlice {
  return {
    selectedItemId: null,

    setSelectedItemId: (id) => set({ selectedItemId: id }),

    addItemDef: ({ name, description, imageFile }) => {
      const state = get();
      const project = state.project as { items?: ItemDef[] } | null;
      if (!project) return null;

      const trimmedName = (name ?? "").trim();
      if (!trimmedName) return null;

      let imagePath = "";

      if (imageFile) {
        if (!isValidItemImageFile(imageFile)) return null;

        const path = buildItemImagePath(imageFile.name);
        imagePath = path;

        set({
          assetFiles: {
            ...(state.assetFiles ?? {}),
            [path]: imageFile,
          },
        });
      }

      const newItem: ItemDef = {
        id: generateTagItemId(),
        name: trimmedName,
        description: description?.trim() || "",
        image: imagePath,
      };

      set({
        project: {
          ...(state.project as any),
          items: [...((state.project as any).items ?? []), newItem],
        },
        selectedItemId: newItem.id,
        isDirty: true,
      });

      return newItem.id;
    },

    updateItemDef: (id, patch) => {
      set((state: any) => {
        if (!state.project) return state;

        const items: ItemDef[] = state.project.items ?? [];
        const idx = items.findIndex((it) => it.id === id);
        if (idx === -1) return state;

        const prev = items[idx];
        let nextImage = prev.image ?? "";

        if (patch.clearImage) nextImage = "";
        
        if (patch.imageFile) {
          if (!isValidItemImageFile(patch.imageFile)) return state;

          const path = buildItemImagePath(patch.imageFile.name);
          nextImage = path;

          state.assetFiles = {
            ...(state.assetFiles ?? {}),
            [path]: patch.imageFile,
          };
        }

        const next: ItemDef = {
          ...prev,
          name: patch.name !== undefined ? patch.name.trim() || prev.name : prev.name,
          description: patch.description !== undefined ? patch.description.trim() : prev.description,
          image: nextImage,
        };

        const updated = items.map((it) => (it.id === id ? next : it));

        return {
          ...state,
          project: {
            ...state.project,
            items: updated,
          },
          assetFiles: state.assetFiles,
          isDirty: true,
        };
      });
    },

    removeItemDef: (id) => {
      set((state: any) => {
        if (!state.project) return state;

        const project = state.project as { items?: ItemDef[]; nodes?: Node[] };

        const nextItems = (project.items ?? []).filter((it) => it.id !== id);

        const nextNodes = (project.nodes ?? []).map((node) => {
          const nextPlacedItems = (node.placedItems ?? []).filter((pi) => pi.itemId !== id);
          return { ...node, placedItems: nextPlacedItems };
        });

        return {
          ...state,
          project: { ...project, items: nextItems, nodes: nextNodes },
          selectedItemId: state.selectedItemId === id ? null : state.selectedItemId,
          isDirty: true,
        };
      });
    },
  };
}
