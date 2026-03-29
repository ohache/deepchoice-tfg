import type { ID, RegionShape, WorldMap } from "@/domain/types";
import type { EditorDrawingState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

/* Mapa global */
export type MapDraft = {
  id: ID;
  name: string;
  visual: WorldMap["visual"];
};

export type MapSelection = {
  mapId: ID | null;
};

export type MapEditorState = {
  selection: MapSelection;
  draft: MapDraft | null;
};

/* Regiones del mapa */
export type MapRegionEditorMode =
  | { type: "idle" }
  | { type: "drawing" }
  | { type: "editing"; regionId: ID };

export type MapRegionEditorContext = {
  mapId: ID;
};

export type MapRegionDraft = {
  id: ID;
  label: string;
  shape: RegionShape | null;
  visible: boolean;
  imageAssetId?: ID;
  musicTrackId?: ID;
  subMapId?: ID;
  sceneIds: ID[];
  entrySceneId?: ID;
};

export type MapRegionSelection = {
  regionId: ID | null;
};

export type MapRegionEditorState = {
  context: MapRegionEditorContext | null;
  mode: MapRegionEditorMode;
  selection: MapRegionSelection;
  draft: MapRegionDraft | null;
  drawing: EditorDrawingState;
};