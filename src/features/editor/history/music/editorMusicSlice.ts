import type { ID, MusicTrackDef, Project } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { upsertAsset, upsertAssetFile, removeAssetFile } from "@/features/editor/core/editorGenericSlice";
import { someEffectsInProject } from "@/features/editor/core/editorProjectWalkers";
import {
  findAssetByIdAndKind, isFileChanged, isNameChanged, normalizeOptionalFile, normalizeOptionalName,
  replaceById
} from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { nextSelectedAfterRemoval, hasTrackReferenceOutsideEffects, effectMatchesTypedId } from "@/features/editor/history/shared/genericHelpers";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import type { DeleteApplyFn } from "@/features/editor/delete/editorDeleteSlice";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedMusicTrackId: ID | null;
  requestDelete: (input: {
    target: DeleteTarget;
    apply: DeleteApplyFn;
  }) => void;
};

export interface EditorMusicSlice {
  selectedMusicTrackId: ID | null;
  setSelectedMusicTrackId: (id: ID | null) => void;
  addMusicTrack: (file: File, name: string) => ID | null;
  updateMusicTrack: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeMusicTrack: (id: ID) => void;
  isMusicTrackReferenced(trackId: ID): boolean;
}

const applyMusicDeleteTarget = (
  target: DeleteTarget,
): DeleteApplyFn => (state) => {
  if (!state.project) return state;

  const nextProject = applyDeleteWithCleanup(state.project, target);

  let nextAssetFiles = state.assetFiles;
  let nextSelectedMusicTrackId = state.selectedMusicTrackId;

  if (target.kind === "music") {
    nextAssetFiles = removeAssetFile(nextAssetFiles, target.trackId).assetFiles;
    nextSelectedMusicTrackId = nextSelectedAfterRemoval(state.selectedMusicTrackId, target.trackId);
  }

  return {
    ...state,
    project: nextProject,
    assetFiles: nextAssetFiles,
    selectedMusicTrackId: nextSelectedMusicTrackId,
  };
};

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
        const prevTrack = project.musicTracks.find((track) => track.id === id);
        if (!prevTrack) return state;

        const nextName = normalizeOptionalName(changes.name);
        const nameChanged = isNameChanged(prevTrack.name, nextName);

        if (nameChanged && hasDuplicateName({ list: project.musicTracks, incomingName: nextName, ignoreId: id })) return state;

        const nextFile = normalizeOptionalFile(changes.file);
        const fileChanged = isFileChanged(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextTrack: MusicTrackDef = {
          ...prevTrack,
          ...(nameChanged ? { name: nextName } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "music");

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, { id, kind: "music", name: nextTrack.name, file: existingAsset.file.trim() }).assets;
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

    /* Elimina una pista */
    removeMusicTrack: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.musicTracks.some((track) => track.id === id)) return;

      requestDelete({
        target: { kind: "music", trackId: id },
        apply: applyMusicDeleteTarget({ kind: "music", trackId: id }),
      });
    },

    /* Comprueba si una pista está referenciada */
    isMusicTrackReferenced: (trackId: ID) => {
      const { project } = get();
      if (!project) return false;

      if (hasTrackReferenceOutsideEffects(project, trackId)) return true;

      return someEffectsInProject(project, (effect) => effectMatchesTypedId(effect, "playMusic", "trackId", trackId));
    },
  };
}