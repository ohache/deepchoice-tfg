import type { ID, MusicTrackDef, AssetDef, Project } from "@/domain/types";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { upsertAsset, upsertAssetFile, removeAsset, removeAssetFile, someEffectsInProject, removeEffectsInProject, safeTrim } from "@/features/editor/core/editorGenericSlice";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedMusicTrackId: ID | null;
};

export interface EditorMusicSlice {
  selectedMusicTrackId: ID | null;
  setSelectedMusicTrackId: (id: ID | null) => void;
  addMusicTrack: (file: File, name: string) => ID | null;
  updateMusicTrack: (id: ID, changes: { name?: string; file?: File | null }) => void;
  removeMusicTrack: (id: ID) => void;
  isMusicTrackReferenced(trackId: ID): boolean;
}

export function createEditorMusicSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMusicSlice {
  return {
    selectedMusicTrackId: null,

    setSelectedMusicTrackId: (id) => set({ selectedMusicTrackId: id }),

    addMusicTrack: (file: File, name: string) => {
      const { project, assetFiles } = get();
      if (!project) return null;
      if (!(file instanceof File)) return null;

      const safeName = safeTrim(name);
      if (!safeName) return null;

      const currentTracks = project.musicTracks ?? [];
      if (hasDuplicateName({ list: currentTracks, incomingName: safeName })) return null;

      const id = generateId.music();
      const filePath = buildAssetPath("music", file.name);

      const newTrack: MusicTrackDef = { id, name: safeName };

      const assets0: AssetDef[] = project.assets ?? [];
      const resA = upsertAsset(assets0, { id, kind: "music", name: safeName, file: filePath });
      const resF = upsertAssetFile(assetFiles, id, file);

      set({
        project: { ...project, musicTracks: [...currentTracks, newTrack], assets: resA.assets },
        assetFiles: resF.assetFiles,
        selectedMusicTrackId: id,
      });

      return id;
    },

    updateMusicTrack: (id, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const trackList = project.musicTracks ?? [];
        const prev = trackList.find((x) => x.id === id);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: trackList, incomingName: nextNameRaw, ignoreId: id })) return state;
        }

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        if (!nameChanged && !fileChanged) return state;

        const nextTrack: MusicTrackDef = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
        };

        let nextAssets = project.assets ?? [];
        const existingAsset = nextAssets.find((a) => a.id === id && a.kind === "music") ?? null;

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, {
            id,
            kind: "music",
            name: nextTrack.name,
            file: String(existingAsset.file ?? "").trim(),
          }).assets;
        }

        let nextAssetFiles = state.assetFiles;

        if (fileChanged && nextFile) {
          const newPath = buildAssetPath("music", nextFile.name);

          nextAssets = upsertAsset(nextAssets, {
            id,
            kind: "music",
            name: nextTrack.name,
            file: newPath,
          }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, id, nextFile).assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            musicTracks: trackList.map((x) => (x.id === id ? nextTrack : x)),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    removeMusicTrack: (id) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const tracks0 = project0.musicTracks ?? [];
        const exists = tracks0.some((t) => t.id === id);
        if (!exists) return state;

        let project = removeEffectsInProject(project0, (e) => e.type === "playMusic" && e.trackId === id);

        const nodes0 = project.nodes ?? [];
        const nextNodes = nodes0.map((n) => ({
          ...n,
          ...(n.musicTrackId === id ? { musicTrackId: undefined } : null),
          layers: (n.layers ?? []).map((layer) =>
            layer.musicTrackId === id ? { ...layer, musicTrackId: undefined } : layer
          ),
        }));

        project = {
          ...project,
          maps: (project.maps ?? []).map((map) => ({
            ...map,
            regions: (map.regions ?? []).map((region) =>
              region.musicTrackId === id ? { ...region, musicTrackId: undefined } : region
            ),
          })),
          nodes: nextNodes,
        };

        const remainingTracks = (project.musicTracks ?? []).filter((t) => t.id !== id);
        const nextSelected = state.selectedMusicTrackId === id ? null : state.selectedMusicTrackId;

        const remA = removeAsset(project.assets ?? [], { id, kind: "music" });
        const remF = removeAssetFile(state.assetFiles, id);

        return {
          ...state,
          project: { ...project, musicTracks: remainingTracks, assets: remA.assets },
          assetFiles: remF.assetFiles,
          selectedMusicTrackId: nextSelected,
        };
      }),

    isMusicTrackReferenced: (id: ID) => {
      const { project } = get();
      if (!project) return false;

      const referencedByNode = (project.nodes ?? []).some(
        (n) =>
          n.musicTrackId === id ||
          (n.layers ?? []).some((layer) => layer.musicTrackId === id)
      );
      if (referencedByNode) return true;

      const referencedByRegion = (project.maps ?? []).some((map) =>
        (map.regions ?? []).some((region) => region.musicTrackId === id)
      );
      if (referencedByRegion) return true;

      return someEffectsInProject(project, (e) => e.type === "playMusic" && e.trackId === id);
    },
  };
}