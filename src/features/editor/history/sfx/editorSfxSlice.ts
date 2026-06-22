import type { ID, Project, SoundEffectDef } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { safeTrim, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorDataUtils";
import { findAssetByIdAndKind, findEntityById, isNameChanged, normalizeOptionalFile, normalizeOptionalName, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedSfxId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorSfxSlice {
  selectedSfxId: ID | null;
  setSelectedSfxId: (id: ID | null) => void;
  addSfx: (file: File, name: string) => ID | null;
  updateSfx: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeSfx: (id: ID) => void;
}

export function createEditorSfxSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorSfxSlice {
  return {
    selectedSfxId: null,

    setSelectedSfxId: (id) => set({ selectedSfxId: id }),

    /* Añade un efecto de sonido */
    addSfx: (file: File, name: string) => {
      const { project, assetFiles } = get();
      if (!project) return null;
      if (!(file instanceof File)) return null;

      const nextName = normalizeOptionalName(name);
      if (!nextName) return null;

      if (hasDuplicateName({ list: project.soundEffects, incomingName: nextName })) return null;

      const id = generateId.sfx();
      const filePath = buildAssetPath("sfx", file.name);

      const newSfx: SoundEffectDef = { id, name: nextName };

      const assetResult = upsertAsset(project.assets, { id, kind: "sfx", name: nextName, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, id, file);

      set({
        project: {
          ...project,
          soundEffects: [...project.soundEffects, newSfx],
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
        selectedSfxId: id,
      });

      return id;
    },

    /* Actualiza nombre y/o fichero */
    updateSfx: (id, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevSfx = findEntityById(project.soundEffects, id);
        if (!prevSfx) return state;

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevSfx.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.soundEffects, incomingName: nextName, ignoreId: id })) return state;

        const nextFile = normalizeOptionalFile(changes.file);
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextSfx: SoundEffectDef = {
          ...prevSfx,
          ...(nameChanged ? { name: nextName } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "sfx");

        if (nameChanged && existingAsset) {
          const assetResult = upsertAsset(nextAssets, { id, kind: "sfx", name: nextSfx.name, file: safeTrim(existingAsset.file) });
          nextAssets = assetResult.assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("sfx", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id, kind: "sfx", name: nextSfx.name, file: filePath });
          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, id, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            soundEffects: replaceById(project.soundEffects, id, nextSfx),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Elimina un efecto de sonido */
    removeSfx: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.soundEffects.some((sfx) => sfx.id === id)) return;

      requestDelete({ kind: "sfx", sfxId: id });
    },
  };
}