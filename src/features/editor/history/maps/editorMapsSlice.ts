import type { ID, Project, AssetDef, WorldMap, Node } from "@/domain/types";
import { hasDuplicateName } from "@/validation/genericValidator";
import { generateId } from "@/utils/id";
import { buildAssetPath } from "@/store/assets/assetPath";
import { safeTrim, upsertAsset, upsertAssetFile, removeAsset, removeAssetFile } from "@/features/editor/core/editorGenericSlice";

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  selectedMapId: ID | null;
};

type MapVisualType = WorldMap["visual"]["type"];

export interface EditorMapsSlice {
  selectedMapId: ID | null;
  setSelectedMapId: (id: ID | null) => void;
  addMap: (input: { name: string; file: File; visualType: MapVisualType }) => ID | null;
  updateMap: (id: ID, changes: { name?: string; file?: File | null; visualType?: MapVisualType }) => void;
  removeMap: (id: ID) => void;
}

function clearMapLocationFromNodes(nodes: Node[], mapId: ID): Node[] {
  return nodes.map((node) => {
    if (node.mapLocation?.mapId !== mapId) return node;
    return { ...node, mapLocation: undefined };
  });
}

function clearSubMapReferences(maps: WorldMap[], removedMapId: ID): WorldMap[] {
  return maps.map((map) => ({
    ...map,
    regions: (map.regions ?? []).map((region) =>
      region.subMapId === removedMapId ? { ...region, subMapId: undefined } : region
    ),
  }));
}

function buildMapVisual(mapId: ID, visualType: MapVisualType): WorldMap["visual"] {
  if (visualType === "composed") {
    return { type: "composed", backgroundAssetId: mapId };
  }

  return { type: "singleImage", imageAssetId: mapId };
}

export function createEditorMapsSlice(set: ( partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorMapsSlice {
  return {
    selectedMapId: null,

    setSelectedMapId: (id) => set({ selectedMapId: id }),

    addMap: (input) => {
      const { project, assetFiles } = get();
      if (!project) return null;

      const safeName = safeTrim(input?.name);
      if (!safeName) return null;

      const file = input?.file;
      if (!(file instanceof File)) return null;

      const visualType: MapVisualType = input?.visualType === "composed" ? "composed" : "singleImage";

      const currentMaps = project.maps ?? [];
      if (hasDuplicateName({ list: currentMaps, incomingName: safeName })) return null;

      const id = generateId.map();
      const filePath = buildAssetPath("maps", file.name);

      const newMap: WorldMap = {
        id,
        name: safeName,
        visual: buildMapVisual(id, visualType),
        regions: [],
      };

      const assets0: AssetDef[] = project.assets ?? [];
      const resA = upsertAsset(assets0, {
        id,
        kind: "maps",
        name: safeName,
        file: filePath,
      });
      const resF = upsertAssetFile(assetFiles, id, file);

      set({
        project: { ...project, maps: [...currentMaps, newMap], assets: resA.assets },
        assetFiles: resF.assetFiles,
        selectedMapId: id,
      });

      return id;
    },

    updateMap: (id, changes) =>
      set((state) => {
        if (!state.project) return state;
        const project = state.project;

        const mapList = project.maps ?? [];
        const prev = mapList.find((m) => m.id === id);
        if (!prev) return state;

        const nextNameRaw = typeof changes.name === "string" ? changes.name.trim() : "";
        const nameChanged = Boolean(nextNameRaw) && nextNameRaw !== prev.name;

        if (nameChanged) {
          if (hasDuplicateName({ list: mapList, incomingName: nextNameRaw, ignoreId: id })) return state;
        }

        const nextFile = changes.file instanceof File ? changes.file : null;
        const fileChanged = Boolean(nextFile);

        const nextVisualType = changes.visualType === "composed" || changes.visualType === "singleImage"
            ? changes.visualType
            : prev.visual.type;

        const visualChanged = nextVisualType !== prev.visual.type;

        if (!nameChanged && !fileChanged && !visualChanged) return state;

        const nextMap: WorldMap = {
          ...prev,
          ...(nameChanged ? { name: nextNameRaw } : null),
          ...(visualChanged ? { visual: buildMapVisual(id, nextVisualType) } : null),
        };

        let nextAssets = project.assets ?? [];
        const existingAsset = nextAssets.find((a) => a.id === id && a.kind === "maps") ?? null;

        if (nameChanged && existingAsset) {
          nextAssets = upsertAsset(nextAssets, {
            id,
            kind: "maps",
            name: nextMap.name,
            file: String(existingAsset.file ?? "").trim(),
          }).assets;
        }

        let nextAssetFiles = state.assetFiles;

        if (fileChanged && nextFile) {
          const newPath = buildAssetPath("maps", nextFile.name);

          nextAssets = upsertAsset(nextAssets, {
            id,
            kind: "maps",
            name: nextMap.name,
            file: newPath,
          }).assets;

          nextAssetFiles = upsertAssetFile(nextAssetFiles, id, nextFile).assetFiles;
        }

        return {
          ...state,
          project: {
            ...project,
            maps: mapList.map((m) => (m.id === id ? nextMap : m)),
            assets: nextAssets,
          },
          assetFiles: nextAssetFiles,
        };
      }),

    removeMap: (id) =>
      set((state) => {
        if (!state.project) return state;
        const project0 = state.project;

        const maps0 = project0.maps ?? [];
        const exists = maps0.some((m) => m.id === id);
        if (!exists) return state;

        const remainingMaps0 = maps0.filter((m) => m.id !== id);
        const remainingMaps = clearSubMapReferences(remainingMaps0, id);

        const cleanedNodes = clearMapLocationFromNodes(project0.nodes ?? [], id);
        const nextSelected = state.selectedMapId === id ? null : state.selectedMapId;

        const remA = removeAsset(project0.assets ?? [], { id, kind: "maps" });
        const remF = removeAssetFile(state.assetFiles, id);

        return {
          ...state,
          project: {
            ...project0,
            maps: remainingMaps,
            nodes: cleanedNodes,
            assets: remA.assets,
          },
          assetFiles: remF.assetFiles,
          selectedMapId: nextSelected,
        };
      }),
  };
}