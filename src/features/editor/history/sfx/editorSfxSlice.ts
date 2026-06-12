import type { ID, Project, SoundEffectDef } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { safeTrim, upsertAsset, upsertAssetFile, removeAssetFile } from "@/features/editor/core/editorGenericSlice";
import { someEffectsInProject } from "@/features/editor/core/editorProjectWalkers";
import { findAssetByIdAndKind, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { effectMatchesTypedId, nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import type { DeleteApplyFn } from "@/features/editor/delete/editorDeleteSlice";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedSfxId: ID | null;
  requestDelete: (input: {
    target: DeleteTarget;
    apply: DeleteApplyFn;
  }) => void;
};

export interface EditorSfxSlice {
  selectedSfxId: ID | null;
  setSelectedSfxId: (id: ID | null) => void;
  addSfx: (file: File, name: string) => ID | null;
  updateSfx: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeSfx: (id: ID) => void;
  isSfxReferenced: (sfxId: ID) => boolean;
}

const applySfxDeleteTarget = (
  target: DeleteTarget,
): DeleteApplyFn => (state) => {
  if (!state.project) return state;

  const nextProject = applyDeleteWithCleanup(state.project, target);

  let nextAssetFiles = state.assetFiles;
  let nextSelectedSfxId = state.selectedSfxId;

  if (target.kind === "sfx") {
    nextAssetFiles = removeAssetFile(nextAssetFiles, target.sfxId).assetFiles;
    nextSelectedSfxId = nextSelectedAfterRemoval(state.selectedSfxId, target.sfxId);
  }

  return {
    ...state,
    project: nextProject,
    assetFiles: nextAssetFiles,
    selectedSfxId: nextSelectedSfxId,
  };
};

export function createEditorSfxSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorSfxSlice {
  return {
    selectedSfxId: null,

    setSelectedSfxId: (id) => set({ selectedSfxId: id }),

    /* Añade un Sfx */
    addSfx: (file: File, name: string) => {
      const { project, assetFiles } = get();
      if (!project) return null;
      if (!(file instanceof File)) return null;

      const nextName = safeTrim(name);
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
        const prevSfx = project.soundEffects.find((sfx) => sfx.id === id);
        if (!prevSfx) return state;

        const nextName = typeof changes.name === "string" ? safeTrim(changes.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevSfx.name;

        if (nameChanged && hasDuplicateName({ list: project.soundEffects, incomingName: nextName, ignoreId: id })) return state;

        const nextFile = changes.file instanceof File ? changes.file : null;
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

    /* Elimina un Sfx */
    removeSfx: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.soundEffects.some((sfx) => sfx.id === id)) return;

      requestDelete({
        target: { kind: "sfx", sfxId: id },
        apply: applySfxDeleteTarget({ kind: "sfx", sfxId: id }),
      });
    },

    /* Comprueba si un Sfx está referenciado en efectos */
    isSfxReferenced: (sfxId: ID) => {
      const { project } = get();
      if (!project) return false;

      return someEffectsInProject(project, (effect) => effectMatchesTypedId(effect, "playSfx", "sfxId", sfxId)
      );
    },
  };
}