import type { ID, RegionShape } from "@/domain/types";
import type { EditorDrawingState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

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