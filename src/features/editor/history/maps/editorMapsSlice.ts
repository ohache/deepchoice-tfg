import type { ID, Project, WorldMap } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import { hasDuplicateName } from "@/validation/genericValidator";
import { buildAssetPath } from "@/store/assets/assetPath";
import { generateId } from "@/utils/id";
import { removeAssetFile, safeTrim, upsertAsset, upsertAssetFile } from "@/features/editor/core/editorGenericSlice";
import { findAssetByIdAndKind, findEntityById, replaceById } from "@/features/editor/history/shared/assetBackedEntityHelpers";
import { nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import type { DeleteApplyFn } from "@/features/editor/delete/editorDeleteSlice";

/* Contrato mínimo del store */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedMapId: ID | null;
  requestDelete: (input: {
    target: DeleteTarget;
    apply: DeleteApplyFn;
  }) => void;
};

type MapVisualType = WorldMap["visual"]["type"];

export interface EditorMapsSlice {
  selectedMapId: ID | null;
  setSelectedMapId: (id: ID | null) => void;
  addMap: (input: { name: string; file: File; visualType: MapVisualType }) => ID | null;
  updateMap: (id: ID, changes: { name?: string; file?: File | null; visualType?: MapVisualType }) => void;
  removeMap: (id: ID) => void;
}

const applyMapDeleteTarget = (
  target: DeleteTarget,
): DeleteApplyFn => (state) => {
  if (!state.project) return state;

  const nextProject = applyDeleteWithCleanup(state.project, target);

  let nextAssetFiles = state.assetFiles;
  let nextSelectedMapId = state.selectedMapId;

  if (target.kind === "map") {
    nextAssetFiles = removeAssetFile(nextAssetFiles, target.mapId).assetFiles;
    nextSelectedMapId = nextSelectedAfterRemoval(state.selectedMapId, target.mapId);
  }

  return {
    ...state,
    project: nextProject,
    assetFiles: nextAssetFiles,
    selectedMapId: nextSelectedMapId,
  };
};

/* Slice */
export function createEditorMapsSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMapsSlice {
  return {
    selectedMapId: null,

    setSelectedMapId: (id) => set({ selectedMapId: id }),

    /* Añade un mapa  */
    addMap: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const nextName = safeTrim(input?.name);
      const file = input?.file;
      const visualType: MapVisualType = input?.visualType === "composed" ? "composed" : "singleImage";

      if (!nextName) return null;
      if (!(file instanceof File)) return null;

      if (hasDuplicateName({ list: project.maps, incomingName: nextName })) return null;

      const id = generateId.map();
      const filePath = buildAssetPath("maps", file.name);

      const newMap: WorldMap = {
        id,
        name: nextName,
        visual: visualType === "composed"
          ? { type: "composed", backgroundAssetId: id }
          : { type: "singleImage", imageAssetId: id },
        regions: [],
      };

      const assetResult = upsertAsset(project.assets, { id, kind: "maps", name: nextName, file: filePath });

      const fileResult = upsertAssetFile(assetFiles, id, file);

      set({
        project: {
          ...project,
          maps: [...project.maps, newMap],
          assets: assetResult.assets,
        },
        assetFiles: fileResult.assetFiles,
        selectedMapId: id,
      });

      return id;
    },

    /* Actualiza nombre, fichero y/o tipo visual del mapa */
    updateMap: (id, changes) =>
      set((state) => {
        if (!state.project) return state;

        const project = state.project;
        const prevMap = findEntityById(project.maps, id);
        if (!prevMap) return state;

        const nextName = typeof changes.name === "string" ? safeTrim(changes.name) : "";
        const nameChanged = Boolean(nextName) && nextName !== prevMap.name;

        if (nameChanged && hasDuplicateName({ list: project.maps, incomingName: nextName, ignoreId: id })) return state;

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        const nextVisualType: MapVisualType = changes.visualType === "composed" || changes.visualType === "singleImage"
          ? changes.visualType
          : prevMap.visual.type;

        const visualChanged = nextVisualType !== prevMap.visual.type;

        if (!nameChanged && !fileChanged && !visualChanged) return state;

        const nextMap: WorldMap = {
          ...prevMap,
          ...(nameChanged ? { name: nextName } : null),
          ...(visualChanged ? {
            visual: nextVisualType === "composed"
              ? { type: "composed", backgroundAssetId: id }
              : { type: "singleImage", imageAssetId: id },
          } : null),
        };

        let nextAssets = project.assets;
        let nextAssetFiles = state.assetFiles;

        const existingAsset = findAssetByIdAndKind(nextAssets, id, "maps");

        if (nameChanged && existingAsset) {
          const assetResult = upsertAsset(nextAssets, { id, kind: "maps", name: nextMap.name, file: safeTrim(existingAsset.file) });
          nextAssets = assetResult.assets;
        }

        if (fileChanged && nextFile) {
          const filePath = buildAssetPath("maps", nextFile.name);

          const assetResult = upsertAsset(nextAssets, { id, kind: "maps", name: nextMap.name, file: filePath });
          nextAssets = assetResult.assets;

          const fileResult = upsertAssetFile(nextAssetFiles, id, nextFile);
          nextAssetFiles = fileResult.assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            maps: replaceById(project.maps, id, nextMap),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    /* Elimina un mapa global */
    removeMap: (id) => {
      const { project, requestDelete } = get();
      if (!project) return;
      if (!project.maps.some((map) => map.id === id)) return;

      requestDelete({
        target: { kind: "map", mapId: id },
        apply: applyMapDeleteTarget({ kind: "map", mapId: id }),
      });
    },
  };
}