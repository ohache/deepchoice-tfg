import type { AssetDef, ID, MapRegion, Project, RegionShape } from "@/domain/types";
import type { MapRegionDraft, MapRegionEditorState } from "@/features/editor/history/maps/mapEditorTypes";
import { validateMapRegion } from "@/features/editor/history/maps/mapRegionValidator";
import { upsertAsset, upsertAssetFile } from "@/features/editor/core/editorGenericSlice";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { findEntityById, replaceById, removeById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { initialMapRegionEditorState } from "@/features/editor/history/shared/genericHelpers";

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

  addMapRegionImageAsset: (input: { file: File }) => ID | null;
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

export function createEditorMapRegionsSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMapRegionsSlice {
  return {
    mapRegionEditor: initialMapRegionEditorState,

    /* Resetea todo el editor de regiones */
    clearMapRegionEditor: () =>
      set((state) => ({
        ...state,
        mapRegionEditor: initialMapRegionEditorState,
      })),

    /* Actualiza solo la selección actual */
    setMapRegionSelection: (input) =>
      set((state) => ({
        ...state,
        mapRegionEditor: {
          ...state.mapRegionEditor,
          selection: {
            regionId: input.regionId,
          },
        },
      })),

    /* Añade un asset de imagen para usarlo en una región compuesta */
    addMapRegionImageAsset: (input) => {
      const state = get();
      const project = state.project;
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

      const nextAssets = upsertAsset(project.assets, asset).assets;
      const nextAssetFiles = upsertAssetFile(state.assetFiles, assetId, file).assetFiles;

      set({
        ...state,
        project: {
          ...project,
          assets: nextAssets,
        },
        assetFiles: nextAssetFiles,
      });

      return assetId;
    },

    /* Empieza el flujo de creación de una nueva región */
    startPlacingMapRegion: (input) =>
      set((state) => {
        if (!state.project || !state.selectedMapId) return state;

        const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
        if (!selectedMap) return state;

        const draft: MapRegionDraft = {
          id: generateId.mapRegion(),
          label: "",
          shape: null,
          visible: true,
          imageAssetId: input?.imageAssetId,
          musicTrackId: undefined,
          subMapId: undefined,
          sceneIds: [],
          entrySceneId: undefined,
        };

        return {
          ...state,
          mapRegionEditor: {
            context: { mapId: state.selectedMapId },
            mode: { type: "drawing" },
            selection: { regionId: draft.id },
            draft,
            drawing: null,
          },
        };
      }),

    /* Carga en borrador una región ya existente */
    editMapRegion: (regionId) =>
      set((state) => {
        if (!state.project || !state.selectedMapId) return state;

        const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
        if (!selectedMap) return state;

        const region = selectedMap.regions.find((currentRegion) => currentRegion.id === regionId);
        if (!region) return state;

        return {
          ...state,
          mapRegionEditor: {
            context: { mapId: state.selectedMapId },
            mode: { type: "editing", regionId },
            selection: { regionId },
            draft: {
              id: region.id,
              label: region.label,
              shape: region.shape,
              visible: region.visible,
              ...(region.imageAssetId ? { imageAssetId: region.imageAssetId } : null),
              ...(region.musicTrackId ? { musicTrackId: region.musicTrackId } : null),
              ...(region.subMapId ? { subMapId: region.subMapId } : null),
              sceneIds: [...region.sceneIds],
              entrySceneId: region.entrySceneId,
            },
            drawing: null,
          },
        };
      }),

    /* Cancela creación/edición */
    cancelMapRegionDraft: () =>
      set((state) => ({
        ...state,
        mapRegionEditor: initialMapRegionEditorState,
      })),

    setMapRegionDraftLabel: (label) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              label,
            },
          },
        };
      }),

    setMapRegionDraftVisible: (visible) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              visible,
            },
          },
        };
      }),

    setMapRegionDraftImageAssetId: (imageAssetId) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              imageAssetId: imageAssetId || undefined,
            },
          },
        };
      }),

    setMapRegionDraftMusicTrackId: (musicTrackId) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              musicTrackId: musicTrackId || undefined,
            },
          },
        };
      }),

    setMapRegionDraftSubMapId: (subMapId) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              subMapId: subMapId || undefined,
            },
          },
        };
      }),

    setMapRegionDraftShape: (shape) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              shape,
            },
          },
        };
      }),

    clearMapRegionDraftShape: () =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              shape: null,
            },
          },
        };
      }),

    /* Mientras se dibuja, actualiza drawing y shape del draft */
    updateDrawingMapRegion: (pt) =>
      set((state) => {
        const editor = state.mapRegionEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        const nextDrawing = editor.drawing
          ? { ...editor.drawing, currentX: pt.x, currentY: pt.y }
          : { startX: pt.x, startY: pt.y, currentX: pt.x, currentY: pt.y };

        const x = Math.min(nextDrawing.startX, nextDrawing.currentX);
        const y = Math.min(nextDrawing.startY, nextDrawing.currentY);
        const w = Math.abs(nextDrawing.currentX - nextDrawing.startX);
        const h = Math.abs(nextDrawing.currentY - nextDrawing.startY);

        return {
          ...state,
          mapRegionEditor: {
            ...editor,
            drawing: nextDrawing,
            draft: {
              ...editor.draft,
              shape: { type: "rect", x, y, w, h },
            },
          },
        };
      }),

    /* Al terminar el dibujo pasa a modo edición */
    finishDrawingMapRegion: () =>
      set((state) => {
        const editor = state.mapRegionEditor;
        if (editor.mode.type !== "drawing" || !editor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...editor,
            mode: { type: "editing", regionId: editor.draft.id },
            drawing: null,
          },
        };
      }),

    /* Reinicia el dibujo de la forma */
    startRedrawMapRegionShape: () =>
      set((state) => {
        const editor = state.mapRegionEditor;
        if (!editor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...editor,
            mode: { type: "drawing" },
            drawing: null,
            draft: { ...editor.draft, shape: null },
            selection: { regionId: editor.draft.id },
          },
        };
      }),

    /* Valida el borrador y devuelve un mensaje único si hay error */
    validateMapRegionDraft: () => {
      const state = get();
      const draft = state.mapRegionEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de región de mapa." };

      if (!state.project || !state.selectedMapId) return { ok: false, error: "No hay un mapa seleccionado." };

      const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
      if (!selectedMap) return { ok: false, error: "No hay un mapa seleccionado." };

      if (!draft.shape) return { ok: false, error: "Debes dibujar un área válida antes de guardar la región." };

      const labelKey = draft.label.trim().toLowerCase();
      const isUnique = !labelKey || !selectedMap.regions.some((region) => {
        if (region.id === draft.id) return false;
        return region.label.trim().toLowerCase() === labelKey;
      });

      if (!isUnique) return { ok: false, error: "Ya existe otra región con esa etiqueta dentro de este mapa." };

      const candidate: MapRegion = {
        id: draft.id,
        label: draft.label.trim(),
        shape: draft.shape,
        visible: draft.visible,
        ...(draft.imageAssetId ? { imageAssetId: draft.imageAssetId } : null),
        ...(draft.musicTrackId ? { musicTrackId: draft.musicTrackId } : null),
        ...(draft.subMapId ? { subMapId: draft.subMapId } : null),
        sceneIds: [...draft.sceneIds],
        ...(draft.entrySceneId ? { entrySceneId: draft.entrySceneId } : null),
      };

      const result = validateMapRegion(candidate, {
        project: state.project,
        mapId: state.selectedMapId,
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

    /* Guarda el borrador validado en el mapa seleccionado */
    saveMapRegionDraft: () => {
      const state = get();
      if (!state.project || !state.selectedMapId) return null;

      const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
      const draft = state.mapRegionEditor.draft;
      if (!selectedMap || !draft) return null;

      const labelKey = draft.label.trim().toLowerCase();
      const isUnique = !labelKey || !selectedMap.regions.some((region) => {
        if (region.id === draft.id) return false;
        return region.label.trim().toLowerCase() === labelKey;
      });

      if (!isUnique) return null;
      if (!draft.shape) return null;

      const candidate: MapRegion = {
        id: draft.id,
        label: draft.label.trim(),
        shape: draft.shape,
        visible: draft.visible,
        ...(draft.imageAssetId ? { imageAssetId: draft.imageAssetId } : null),
        ...(draft.musicTrackId ? { musicTrackId: draft.musicTrackId } : null),
        ...(draft.subMapId ? { subMapId: draft.subMapId } : null),
        sceneIds: [...draft.sceneIds],
        ...(draft.entrySceneId ? { entrySceneId: draft.entrySceneId } : null),
      };

      const validation = validateMapRegion(candidate, {
        project: state.project,
        mapId: state.selectedMapId,
      });
      if (!validation.ok) return null;

      const alreadyExists = selectedMap.regions.some((region) => region.id === candidate.id);

      const nextMap = alreadyExists ? {
        ...selectedMap,
        regions: selectedMap.regions.map((region) =>
          region.id === candidate.id ? candidate : region,
        )
      }
        : {
          ...selectedMap,
          regions: [...selectedMap.regions, candidate],
        };

      set((currentState) => {
        if (!currentState.project) return currentState;

        return {
          ...currentState,
          project: {
            ...currentState.project,
            maps: replaceById(currentState.project.maps, state.selectedMapId!, nextMap),
          },
          mapRegionEditor: {
            context: { mapId: state.selectedMapId! },
            mode: { type: "editing", regionId: candidate.id },
            selection: { regionId: candidate.id },
            draft: {
              id: candidate.id,
              label: candidate.label,
              shape: candidate.shape,
              visible: candidate.visible,
              ...(candidate.imageAssetId ? { imageAssetId: candidate.imageAssetId } : null),
              ...(candidate.musicTrackId ? { musicTrackId: candidate.musicTrackId } : null),
              ...(candidate.subMapId ? { subMapId: candidate.subMapId } : null),
              sceneIds: [...candidate.sceneIds],
              entrySceneId: candidate.entrySceneId,
            },
            drawing: null,
          },
        };
      });

      return candidate.id;
    },

    /* Elimina una región del mapa seleccionado */
    removeMapRegion: (regionId) =>
      set((state) => {
        if (!state.project || !state.selectedMapId) return state;

        const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
        if (!selectedMap) return state;

        const exists = selectedMap.regions.some((region) => region.id === regionId);
        if (!exists) return state;

        const nextMap = {
          ...selectedMap,
          regions: removeById(selectedMap.regions, regionId),
        };

        const shouldResetEditor =
          state.mapRegionEditor.selection.regionId === regionId ||
          state.mapRegionEditor.draft?.id === regionId;

        return {
          ...state,
          project: {
            ...state.project,
            maps: replaceById(state.project.maps, state.selectedMapId, nextMap),
          },
          mapRegionEditor: shouldResetEditor
            ? initialMapRegionEditorState
            : state.mapRegionEditor,
        };
      }),
  };
}