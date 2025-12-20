import type { ID, MusicTrack } from "@/domain/types";
import { buildMusicPath } from "@/features/editor/components/scene/SceneCommon";

export interface EditorMusicSlice {
  selectedMusicTrackId: ID | null;
  setSelectedMusicTrackId: (id: ID | null) => void;

  addMusicTrack: (file: File) => ID | null;
  updateMusicTrack: (id: ID, changes: Partial<MusicTrack>) => void;
  removeMusicTrack: (id: ID) => void;
}

export function createEditorMusicSlice(set: any, get: any): EditorMusicSlice {
  return {
    selectedMusicTrackId: null,

    setSelectedMusicTrackId: (id) => set({ selectedMusicTrackId: id }),

    addMusicTrack: (file: File) => {
      const state = get();
      const project = state.project as { musicTracks?: MusicTrack[] } | null;
      if (!project) return null;

      const lower = file.name.toLowerCase();
      const isValidExt = lower.endsWith(".mp3") || lower.endsWith(".ogg") || lower.endsWith(".wav");
      if (!isValidExt) return null;

      const path = buildMusicPath(file.name);

      const alreadyExists = (project.musicTracks ?? []).some(
        (m) => m.file.toLowerCase() === path.toLowerCase()
      );
      
      if (alreadyExists) return null;

      const newTrack: MusicTrack = {
        id: crypto.randomUUID(),
        name: file.name.replace(/\.[^.]+$/, ""),
        file: path,
        loop: true,
      };

      set({
        project: {
          ...(state.project as any),
          musicTracks: [...((state.project as any).musicTracks ?? []), newTrack],
        },
        assetFiles: {
          ...(state.assetFiles ?? {}),
          [path]: file,
        },
        isDirty: true,
      });

      return newTrack.id;
    },

    updateMusicTrack: (id: ID, changes: Partial<MusicTrack>) =>
      set((state: any) => {
        if (!state.project) return state;

        const current: MusicTrack[] = state.project.musicTracks ?? [];
        const updated = current.map((t) => (t.id === id ? { ...t, ...changes } : t));

        return {
          ...state,
          project: {
            ...state.project,
            musicTracks: updated,
          },
          isDirty: true,
        };
      }),

    removeMusicTrack: (id: ID) =>
      set((state: any) => {
        if (!state.project) return state;

        const current: MusicTrack[] = state.project.musicTracks ?? [];
        const remaining = current.filter((t) => t.id !== id);

        const nextSelected =
          state.selectedMusicTrackId === id ? null : state.selectedMusicTrackId;

        return {
          ...state,
          project: {
            ...state.project,
            musicTracks: remaining,
          },
          selectedMusicTrackId: nextSelected,
          isDirty: true,
        };
      }),
  };
}
