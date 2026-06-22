import type { ID, Project, MusicTrackDef } from "@/domain/types";
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
  selectedMusicTrackId: ID | null;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorMusicSlice {
  selectedMusicTrackId: ID | null;
  setSelectedMusicTrackId: (id: ID | null) => void;
  addMusicTrack: (file: File, name: string) => ID | null;
  updateMusicTrack: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeMusicTrack: (id: ID) => void;
}

export function createEditorMusicSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMusicSlice {
  return {
    selectedMusicTrackId: null,

    setSelectedMusicTrackId: (id) => set({ selectedMusicTrackId: id }),

    /* Añade una pista nueva */
    addMusicTrack: (file: File, name: string) => {
      const { project, assetFiles } = get();
      if (!project) return null;
      if (!(file instanceof File)) return null;

      const nextName = normalizeOptionalName(name);
      if (!nextName) return null;

      if (hasDuplicateName({ list: project.musicTracks, incomingName: nextName })) return null;

      const id = generateId.music();
      const filePath = buildAssetPath("music", file.name);

      const newTrack: MusicTrackDef = { id, name: nextName };

      const assetResult = upsertAsset(project.assets, { id, kind: "music", name: nextName, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, id, file);

      set({
        project: {
          ...project,
          musicTracks: [...project.musicTracks, newTrack],
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
        selectedMusicTrackId: id,
      });

      return id;
    },

    /* Actualiza nombre y/o fichero */
    updateMusicTrack: (id, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevTrack = findEntityById(project.musicTracks, id);
        if (!prevTrack) return state;

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevTrack.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.musicTracks, incomingName: nextName, ignoreId: id })) return state;

        const nextFile = normalizeOptionalFile(changes.file);
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextTrack: MusicTrackDef = {
          ...prevTrack,
          ...(nameChanged ? { name: nextName } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "music");

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, { id, kind: "music", name: nextTrack.name, file: safeTrim(existingAsset.file) }).assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("music", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id, kind: "music", name: nextTrack.name, file: filePath });
          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, id, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            musicTracks: replaceById(project.musicTracks, id, nextTrack),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Elimina una pista de música */
    removeMusicTrack: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.musicTracks.some((track) => track.id === id)) return;

      requestDelete({ kind: "music", trackId: id });
    },
  };
}