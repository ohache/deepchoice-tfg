import type { AssetDef, ID, MapRegion, Project, RegionShape } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { MapRegionDraft, MapRegionEditorState } from "@/features/editor/history/maps/mapRegionEditorTypes";
import { validateMapRegion } from "@/features/editor/history/maps/mapRegionValidator";
import { removeAsset, removeAssetFile, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorDataUtils";
import { findEntityById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { initialMapRegionEditorState } from "@/features/editor/history/shared/genericHelpers";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  selectedMapId: ID | null;
  mapRegionEditor: MapRegionEditorState;
  assetFiles: Record<ID, File>;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorMapRegionsSlice {
  mapRegionEditor: MapRegionEditorState;

  clearMapRegionEditor: () => void;
  setMapRegionSelection: (input: { regionId: ID | null }) => void;

  startPlacingMapRegion: (input?: { imageFile?: File | null }) => void;
  editMapRegion: (regionId: ID) => void;
  cancelMapRegionDraft: () => void;

  setMapRegionDraftLabel: (label: string) => void;
  setMapRegionDraftVisible: (visible: boolean) => void;
  setMapRegionDraftImageFile: (imageFile?: File | null) => void;
  setMapRegionDraftMusicTrackId: (musicTrackId?: ID) => void;
  setMapRegionDraftSubMapId: (subMapId?: ID) => void;

  setMapRegionDraftShape: (shape: RegionShape | null) => void;
  clearMapRegionDraftShape: () => void;
  finishDrawingMapRegion: () => void;
  startRedrawMapRegionShape: () => void;

  validateMapRegionDraft: () => { ok: boolean; error?: string };
  saveMapRegionDraft: () => ID | null;
  removeMapRegion: (regionId: ID) => void;
}

function mapRegionDraftToRegion(draft: MapRegionDraft, imageAssetId = draft.imageAssetId): MapRegion | null {
  if (!draft.shape) return null;

  return {
    id: draft.id,
    label: draft.label.trim(),
    shape: draft.shape,
    visible: draft.visible,
    ...(imageAssetId ? { imageAssetId } : null),
    ...(draft.musicTrackId ? { musicTrackId: draft.musicTrackId } : null),
    ...(draft.subMapId ? { subMapId: draft.subMapId } : null),
    sceneIds: [...draft.sceneIds],
    ...(draft.entrySceneId ? { entrySceneId: draft.entrySceneId } : null),
  };
}

function mapRegionToDraft(region: MapRegion): MapRegionDraft {
  return {
    id: region.id,
    label: region.label,
    shape: region.shape,
    visible: region.visible,
    ...(region.imageAssetId ? { imageAssetId: region.imageAssetId } : null),
    ...(region.musicTrackId ? { musicTrackId: region.musicTrackId } : null),
    ...(region.subMapId ? { subMapId: region.subMapId } : null),
    sceneIds: [...region.sceneIds],
    entrySceneId: region.entrySceneId,
  };
}

function createMapRegionImageAsset(file: File): { assetId: ID; asset: AssetDef } {
  const assetId = generateId.map();

  return { assetId, asset: { id: assetId, kind: "maps", name: file.name?.trim() || "Region image", file: buildAssetPath("maps", file.name) } };
}

function getMapRegionErrorMessage(errors: ReturnType<typeof validateMapRegion>["errors"]): string {
  return (errors.label ?? errors.shape ?? errors.visible ?? errors.imageAssetId ?? errors.sceneIds ??
    errors.entrySceneId ?? errors.musicTrackId ?? errors.subMapId ?? errors.id ?? "La región de mapa no es válida.");
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
          selectedRegionId: input.regionId,
        },
      })),

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
          imageFile: input?.imageFile ?? null,
          musicTrackId: undefined,
          subMapId: undefined,
          sceneIds: [],
          entrySceneId: undefined,
        };

        return {
          ...state,
          mapRegionEditor: {
            mapId: state.selectedMapId,
            mode: { type: "drawing" },
            selectedRegionId: draft.id,
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
            mapId: state.selectedMapId,
            mode: { type: "editing", regionId },
            selectedRegionId: regionId,
            draft: mapRegionToDraft(region),
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

    /* Actualiza el nombre del borrador de región del mapa */
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

    /* Actualiza la visibilidad del borrador de región del mapa */
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

    /* Asigna o elimina la imagen temporal seleccionada para la región */
    setMapRegionDraftImageFile: (imageFile) =>
      set((state) => {
        if (!state.mapRegionEditor.draft) return state;

        return {
          ...state,
          mapRegionEditor: {
            ...state.mapRegionEditor,
            draft: {
              ...state.mapRegionEditor.draft,
              imageFile,
            },
          },
        };
      }),

    /* Asigna o elimina la pista de música asociada a la región del mapa en edición */
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

    /* Asigna o elimina el submapa asociado a la región del mapa en edición */
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

    /* Actualiza la forma del borrador de región del mapa */
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

    /* Limpia la forma (shape) del borrador de región del mapa */
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
            selectedRegionId: editor.draft.id,
          },
        };
      }),

    /* Valida el borrador y devuelve un mensaje único si hay error */
    validateMapRegionDraft: () => {
      const state = get();
      const draft = state.mapRegionEditor.draft;

      if (!draft) return { ok: false, error: "No hay borrador de región de mapa." };

      if (!state.project || !state.selectedMapId) return { ok: false, error: "No hay un mapa seleccionado." };

      const candidate = mapRegionDraftToRegion(draft);

      if (!candidate) return { ok: false, error: "Debes dibujar un área válida antes de guardar la región." };

      const result = validateMapRegion(candidate, { project: state.project, mapId: state.selectedMapId });

      if (!result.ok) return { ok: false, error: getMapRegionErrorMessage(result.errors) };

      return { ok: true };
    },

    /* Guarda el borrador validado en el mapa seleccionado */
    /* Guarda el borrador validado en el mapa seleccionado */
    saveMapRegionDraft: () => {
      const state = get();

      if (!state.project || !state.selectedMapId) return null;

      const selectedMap = findEntityById(state.project.maps, state.selectedMapId);
      const draft = state.mapRegionEditor.draft;

      if (!selectedMap || !draft) return null;

      let nextProject = state.project;
      let nextAssetFiles = state.assetFiles;
      let nextImageAssetId = draft.imageAssetId;

      const previousRegion = selectedMap.regions.find((region) => region.id === draft.id);

      if (draft.imageFile instanceof File) {
        const { assetId, asset } = createMapRegionImageAsset(draft.imageFile);

        nextImageAssetId = assetId;

        nextProject = {
          ...nextProject,
          assets: upsertAsset(nextProject.assets, asset).assets,
        };

        nextAssetFiles = upsertAssetFile(nextAssetFiles, assetId, draft.imageFile).assetFiles;

        if (
          previousRegion?.imageAssetId &&
          previousRegion.imageAssetId !== assetId
        ) {
          nextProject = {
            ...nextProject,
            assets: removeAsset(nextProject.assets, {
              id: previousRegion.imageAssetId,
              kind: "maps",
            }).assets,
          };

          nextAssetFiles = removeAssetFile(
            nextAssetFiles,
            previousRegion.imageAssetId,
          ).assetFiles;
        }
      }

      const candidate = mapRegionDraftToRegion(draft, nextImageAssetId);
      if (!candidate) return null;

      const validation = validateMapRegion(candidate, {
        project: nextProject,
        mapId: state.selectedMapId,
      });

      if (!validation.ok) return null;

      const alreadyExists = selectedMap.regions.some(
        (region) => region.id === candidate.id,
      );

      const nextMap = alreadyExists
        ? {
          ...selectedMap,
          regions: selectedMap.regions.map((region) =>
            region.id === candidate.id ? candidate : region,
          ),
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
            assets: nextProject.assets,
            maps: replaceById(
              currentState.project.maps,
              state.selectedMapId!,
              nextMap,
            ),
          },
          assetFiles: nextAssetFiles,
          mapRegionEditor: {
            mapId: state.selectedMapId!,
            mode: { type: "editing", regionId: candidate.id },
            selectedRegionId: candidate.id,
            draft: mapRegionToDraft(candidate),
            drawing: null,
          },
        };
      });

      return candidate.id;
    },

    /* Elimina una región del mapa seleccionado */
    removeMapRegion: (regionId) => {
      const { project, selectedMapId, requestDelete } = get();
      if (!project || !selectedMapId) return;

      const selectedMap = findEntityById(project.maps, selectedMapId);
      if (!selectedMap) return;

      const exists = selectedMap.regions.some((region) => region.id === regionId);

      if (!exists) return;

      requestDelete({ kind: "mapRegion", mapId: selectedMapId, regionId });
    },
  };
}