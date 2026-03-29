import type { ID, Project, SoundEffectDef, AssetDef } from "@/domain/types";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile, someEffectsInProject, removeEffectsInProject } from "@/features/editor/core/editorGenericSlice";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedSfxId: ID | null;
};

export interface EditorSfxSlice {
  selectedSfxId: ID | null;
  setSelectedSfxId: (id: ID | null) => void;
  addSfx: (file: File, name: string) => ID | null;
  updateSfx: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeSfx: (id: ID) => void;
  isSfxReferenced: (sfxId: ID) => boolean;
}

export function createEditorSfxSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorSfxSlice {
  return {
    selectedSfxId: null,

    setSelectedSfxId: (id) => set({ selectedSfxId: id }),

    addSfx: (file: File, name: string) => {
      const { project, assetFiles } = get();
      if (!project) return null;
      if (!(file instanceof File)) return null;

      const safeName = safeTrim(name);
      if (!safeName) return null;

      const currentSfx = project.soundEffects ?? [];
      if (hasDuplicateName({ list: currentSfx, incomingName: safeName })) return null;

      const id = generateId.sfx();
      const filePath = buildAssetPath("sfx", file.name);

      const newSfx: SoundEffectDef = { id, name: safeName };

      const assets0: AssetDef[] = project.assets ?? [];
      const resA = upsertAsset(assets0, { id, kind: "sfx", name: safeName, file: filePath });
      const resF = upsertAssetFile(assetFiles, id, file);

      set({
        project: { ...project, soundEffects: [...currentSfx, newSfx], assets: resA.assets },
        assetFiles: resF.assetFiles,
        selectedSfxId: id,
      });

      return id;
    },

    updateSfx: (id, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const sfxList = project.soundEffects ?? [];
        const prev = sfxList.find((x) => x.id === id);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: sfxList, incomingName: nextNameRaw, ignoreId: id })) return state;
        }

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextSfx: SoundEffectDef = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
        };

        let nextAssets = project.assets ?? [];
        const existingAsset = nextAssets.find((a) => a.id === id && a.kind === "sfx") ?? null;

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, { id, kind: "sfx", name: nextSfx.name, file: String(existingAsset.file ?? "").trim()}).assets;
        }

        let nextAssetFiles = state.assetFiles;
        if (fileChanged && nextFile) {
          const newPath = buildAssetPath("sfx", nextFile.name);

          nextAssets = upsertAsset(nextAssets, { id, kind: "sfx", name: nextSfx.name, file: newPath }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, id, nextFile).assetFiles;
        }

        return {
          ...state,
          project: { ...project, soundEffects: sfxList.map((x) => (x.id === id ? nextSfx : x)), assets: nextAssets },
          assetFiles: nextAssetFiles,
        };
      }),

    removeSfx: (id) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const sfxList0 = project0.soundEffects ?? [];
        const exists = sfxList0.some((x) => x.id === id);
        if (!exists) return state;

        const project = removeEffectsInProject(project0, (e) => e.type === "playSfx" && e.sfxId === id);

        const remainingSfx = (project.soundEffects ?? []).filter((x) => x.id !== id);
        const nextSelected = state.selectedSfxId === id ? null : state.selectedSfxId;

        const remA = removeAsset(project.assets ?? [], { id, kind: "sfx" });
        const remF = removeAssetFile(state.assetFiles, id);

        return {
          project: { ...project, soundEffects: remainingSfx, assets: remA.assets },
          assetFiles: remF.assetFiles,
          selectedSfxId: nextSelected,
        };
      }),


    isSfxReferenced: (sfxId: ID) => {
      const { project } = get();
      if (!project) return false;
      return someEffectsInProject(project, (e) => e.type === "playSfx" && e.sfxId === sfxId);
    },
  };
}
