import type { ID, Project, AssetDef, WorldMap, MapRegion, RegionShape } from "@/domain/types";
import type { MapRegionDraft, MapRegionEditorState } from "@/features/editor/history/maps/mapEditorTypes";
import { validateMapRegion } from "@/features/editor/history/maps/mapRegionValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { upsertAsset, upsertAssetFile } from "@/features/editor/core/editorGenericSlice";
import { generateId } from "@/utils/id";

export const initialMapRegionEditorState: MapRegionEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { regionId: null },
  draft: null,
  drawing: null,
};

function defaultVisible(): MapRegion["visible"] {
  return true;
}

function rectFromGesture(g: { startX: number; startY: number; currentX: number; currentY: number }): RegionShape {
  const x = Math.min(g.startX, g.currentX);
  const y = Math.min(g.startY, g.currentY);
  const w = Math.abs(g.currentX - g.startX);
  const h = Math.abs(g.currentY - g.startY);
  return { type: "rect", x, y, w, h };
}

function buildContext(selectedMapId: ID | null) {
  if (!selectedMapId) return null;
  return { mapId: selectedMapId };
}

function getSelectedMap(project: Project | null, mapId: ID | null): WorldMap | null {
  if (!project || !mapId) return null;
  return (project.maps ?? []).find((m) => m.id === mapId) ?? null;
}

function isRegionLabelUnique(label: string, regions: MapRegion[], ignoreId?: ID): boolean {
  const key = label.trim().toLowerCase();
  if (!key) return true;

  return !regions.some((region) => {
    if (ignoreId && region.id === ignoreId) return false;
    return region.label.trim().toLowerCase() === key;
  });
}

function replaceRegion(map: WorldMap, nextRegion: MapRegion): WorldMap {
  return {
    ...map,
    regions: (map.regions ?? []).map((region) =>
      region.id === nextRegion.id ? nextRegion : region
    ),
  };
}

function addRegion(map: WorldMap, region: MapRegion): WorldMap {
  return {
    ...map,
    regions: [...(map.regions ?? []), region],
  };
}

function removeRegionFromMap(map: WorldMap, regionId: ID): WorldMap {
  return {
    ...map,
    regions: (map.regions ?? []).filter((region) => region.id !== regionId),
  };
}

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  selectedMapId: ID | null;
  mapRegionEditor: MapRegionEditorState;
  assetFiles: Record<ID, File>;
};

export interface EditorMapRegionsSlice {
  mapRegionEditor: MapRegionEditorState;

  clearMapRegionEditor: () => void;
  setMapRegionSelection: (input: { regionId: ID | null }) => void;

  addMapRegionImageAsset: (input: { file: File}) => ID | null;
  startPlacingMapRegion: (input?: { imageAssetId?: ID }) => void;
  editMapRegion: (regionId: ID) => void;
  cancelMapRegionDraft: () => void;

  setMapRegionDraftLabel: (label: string) => void;
  setMapRegionDraftVisible: (visible: boolean) => void;
  setMapRegionDraftImageAssetId: (imageAssetId?: ID) => void;
  setMapRegionDraftMusicTrackId: (musicTrackId?: ID) => void;
  setMapRegionDraftSubMapId: (subMapId?: ID) => void;

  setMapRegionDraftShape: (shape: RegionShape | null) => void;
  clearMapRegionDraftShape: () => void;
  updateDrawingMapRegion: (pt: { x: number; y: number }) => void;
  finishDrawingMapRegion: () => void;
  startRedrawMapRegionShape: () => void;

  validateMapRegionDraft: () => { ok: boolean; error?: string };
  saveMapRegionDraft: () => ID | null;
  removeMapRegion: (regionId: ID) => void;
}

export function createEditorMapRegionsSlice(set: ( partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMapRegionsSlice {
  return {
    mapRegionEditor: initialMapRegionEditorState,

    clearMapRegionEditor: () =>
      set((s) => ({
        ...s,
        mapRegionEditor: initialMapRegionEditorState,
      })),

    setMapRegionSelection: (input) =>
      set((s) => ({
        ...s,
        mapRegionEditor: {
          ...s.mapRegionEditor,
          selection: {
            regionId: input.regionId,
          },
        },
      })),

    addMapRegionImageAsset: (input) => {
      const s = get();
      const project = s.project;
      const file = input?.file;

      if (!project) return null;
      if (!(file instanceof File)) return null;

      const assetId = generateId.map();

      const asset: AssetDef = {
        id: assetId,
        kind: "maps",
        name: file.name?.trim() || "Region image",
        file: buildAssetPath("maps", file.name),
      };

      const nextAssets = upsertAsset(project.assets ?? [], asset).assets;
      const nextAssetFiles = upsertAssetFile(s.assetFiles, assetId, file).assetFiles;

      set({
        ...s,
        project: {
          ...project,
          assets: nextAssets,
        },
        assetFiles: nextAssetFiles,
      });

      return assetId;
    },

    startPlacingMapRegion: (input?) =>
      set((s) => {
        const map = getSelectedMap(s.project, s.selectedMapId);
        if (!map || !s.selectedMapId) return s;

        const draft: MapRegionDraft = {
          id: generateId.mapRegion(),
          label: "",
          shape: null,
          visible: defaultVisible(),
          imageAssetId: input?.imageAssetId,
          musicTrackId: undefined,
          subMapId: undefined,
          sceneIds: [],
          entrySceneId: undefined,
        };

        return {
          ...s,
          mapRegionEditor: {
            context: buildContext(s.selectedMapId),
            mode: { type: "drawing" },
            selection: { regionId: draft.id },
            draft,
            drawing: null,
          },
        };
      }),

    editMapRegion: (regionId) =>
      set((s) => {
        const map = getSelectedMap(s.project, s.selectedMapId);
        if (!map || !s.selectedMapId) return s;

        const region = (map.regions ?? []).find((r) => r.id === regionId);
        if (!region) return s;

        const draft: MapRegionDraft = {
          id: region.id,
          label: region.label,
          shape: region.shape,
          visible: region.visible,
          ...(region.imageAssetId ? { imageAssetId: region.imageAssetId } : null),
          ...(region.musicTrackId ? { musicTrackId: region.musicTrackId } : null),
          ...(region.subMapId ? { subMapId: region.subMapId } : null),
          sceneIds: [...(region.sceneIds ?? [])],
          entrySceneId: region.entrySceneId,
        };

        return {
          ...s,
          mapRegionEditor: {
            context: buildContext(s.selectedMapId),
            mode: { type: "editing", regionId },
            selection: { regionId },
            draft,
            drawing: null,
          },
        };
      }),

    cancelMapRegionDraft: () =>
      set((s) => ({
        ...s,
        mapRegionEditor: initialMapRegionEditorState,
      })),

    setMapRegionDraftLabel: (label) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: { ...draft, label },
          },
        };
      }),

    setMapRegionDraftVisible: (visible) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: {
              ...draft,
              visible,
            },
          },
        };
      }),

    setMapRegionDraftImageAssetId: (imageAssetId) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: {
              ...draft,
              ...(imageAssetId ? { imageAssetId } : { imageAssetId: undefined }),
            },
          },
        };
      }),

    setMapRegionDraftMusicTrackId: (musicTrackId) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: {
              ...draft,
              ...(musicTrackId ? { musicTrackId } : { musicTrackId: undefined }),
            },
          },
        };
      }),

    setMapRegionDraftSubMapId: (subMapId) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: {
              ...draft,
              ...(subMapId ? { subMapId } : { subMapId: undefined }),
            },
          },
        };
      }),

    setMapRegionDraftShape: (shape) =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: { ...draft, shape },
          },
        };
      }),

    clearMapRegionDraftShape: () =>
      set((s) => {
        const draft = s.mapRegionEditor.draft;
        if (!draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...s.mapRegionEditor,
            draft: { ...draft, shape: null },
          },
        };
      }),

    updateDrawingMapRegion: (pt) =>
      set((s) => {
        const ed = s.mapRegionEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        const drawing0 = ed.drawing;
        const nextDrawing = drawing0
          ? { ...drawing0, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const shape = rectFromGesture(nextDrawing);

        return {
          ...s,
          mapRegionEditor: {
            ...ed,
            drawing: nextDrawing,
            draft: { ...ed.draft, shape },
          },
        };
      }),

    finishDrawingMapRegion: () =>
      set((s) => {
        const ed = s.mapRegionEditor;
        if (ed.mode.type !== "drawing" || !ed.draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...ed,
            mode: { type: "editing", regionId: ed.draft.id },
            drawing: null,
          },
        };
      }),

    startRedrawMapRegionShape: () =>
      set((s) => {
        const ed = s.mapRegionEditor;
        if (!ed.draft) return s;

        return {
          ...s,
          mapRegionEditor: {
            ...ed,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...ed.draft, shape: null },
            selection: { regionId: ed.draft.id },
          },
        };
      }),

    validateMapRegionDraft: () => {
      const s = get();
      const draft = s.mapRegionEditor.draft;
      const selectedMap = getSelectedMap(s.project, s.selectedMapId);

      if (!draft) return { ok: false, error: "No hay borrador de región de mapa." };
      if (!selectedMap || !s.project || !s.selectedMapId) {
        return { ok: false, error: "No hay un mapa seleccionado." };
      }
      if (!draft.shape) {
        return { ok: false, error: "Debes dibujar un área válida antes de guardar la región." };
      }

      if (!isRegionLabelUnique(draft.label, selectedMap.regions ?? [], draft.id)) {
        return { ok: false, error: "Ya existe otra región con esa etiqueta dentro de este mapa." };
      }

      const candidate: MapRegion = {
        id: draft.id,
        label: draft.label.trim(),
        shape: draft.shape,
        visible: draft.visible,
        ...(draft.imageAssetId ? { imageAssetId: draft.imageAssetId } : null),
        ...(draft.musicTrackId ? { musicTrackId: draft.musicTrackId } : null),
        ...(draft.subMapId ? { subMapId: draft.subMapId } : null),
        sceneIds: [...(draft.sceneIds ?? [])],
        ...(draft.entrySceneId ? { entrySceneId: draft.entrySceneId } : null),
      };

      const result = validateMapRegion(candidate, {
        project: s.project,
        mapId: s.selectedMapId,
      });

      if (!result.ok) {
        const msg =
          result.errors.label ??
          result.errors.shape ??
          result.errors.visible ??
          result.errors.imageAssetId ??
          result.errors.sceneIds ??
          result.errors.entrySceneId ??
          result.errors.musicTrackId ??
          result.errors.subMapId ??
          result.errors.id ??
          "La región de mapa no es válida.";

        return { ok: false, error: msg };
      }

      return { ok: true };
    },

    saveMapRegionDraft: () => {
      const s = get();
      if (!s.project || !s.selectedMapId) return null;

      const selectedMap = getSelectedMap(s.project, s.selectedMapId);
      const draft = s.mapRegionEditor.draft;
      if (!selectedMap || !draft || !draft.shape) return null;

      if (!isRegionLabelUnique(draft.label, selectedMap.regions ?? [], draft.id)) {
        return null;
      }

      const candidate: MapRegion = {
        id: draft.id,
        label: draft.label.trim(),
        shape: draft.shape,
        visible: draft.visible,
        ...(draft.imageAssetId ? { imageAssetId: draft.imageAssetId } : null),
        ...(draft.musicTrackId ? { musicTrackId: draft.musicTrackId } : null),
        ...(draft.subMapId ? { subMapId: draft.subMapId } : null),
        sceneIds: [...(draft.sceneIds ?? [])],
        ...(draft.entrySceneId ? { entrySceneId: draft.entrySceneId } : null),
      };

      const validation = validateMapRegion(candidate, {
        project: s.project,
        mapId: s.selectedMapId,
      });
      if (!validation.ok) return null;

      const alreadyExists = (selectedMap.regions ?? []).some((region) => region.id === candidate.id);
      const nextMap = alreadyExists ? replaceRegion(selectedMap, candidate) : addRegion(selectedMap, candidate);

      set((state) => {
        if (!state.project) return state;

        const nextDraft: MapRegionDraft = {
          id: candidate.id,
          label: candidate.label,
          shape: candidate.shape,
          visible: candidate.visible,
          ...(candidate.imageAssetId ? { imageAssetId: candidate.imageAssetId } : null),
          ...(candidate.musicTrackId ? { musicTrackId: candidate.musicTrackId } : null),
          ...(candidate.subMapId ? { subMapId: candidate.subMapId } : null),
          sceneIds: [...(candidate.sceneIds ?? [])],
          entrySceneId: candidate.entrySceneId,
        };

        return {
          ...state,
          project: {
            ...state.project,
            maps: (state.project.maps ?? []).map((map) =>
              map.id === s.selectedMapId ? nextMap : map
            ),
          },
          mapRegionEditor: {
            context: buildContext(s.selectedMapId),
            mode: { type: "editing", regionId: candidate.id },
            selection: { regionId: candidate.id },
            draft: nextDraft,
            drawing: null,
          },
        };
      });

      return candidate.id;
    },

    removeMapRegion: (regionId) =>
      set((s) => {
        if (!s.project || !s.selectedMapId) return s;

        const selectedMap = getSelectedMap(s.project, s.selectedMapId);
        if (!selectedMap) return s;

        const exists = (selectedMap.regions ?? []).some((region) => region.id === regionId);
        if (!exists) return s;

        const nextMap = removeRegionFromMap(selectedMap, regionId);

        const shouldResetEditor =
          s.mapRegionEditor.selection.regionId === regionId ||
          s.mapRegionEditor.draft?.id === regionId;

        return {
          ...s,
          project: {
            ...s.project,
            maps: (s.project.maps ?? []).map((map) =>
              map.id === s.selectedMapId ? nextMap : map
            ),
          },
          mapRegionEditor: shouldResetEditor
            ? initialMapRegionEditorState
            : s.mapRegionEditor,
        };
      }),
  };
}