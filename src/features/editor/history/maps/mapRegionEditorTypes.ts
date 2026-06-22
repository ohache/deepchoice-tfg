import type { ID, RegionShape } from "@/domain/types";
import type { EditorDrawingState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

/* Estado de edición de regiones del mapa */
type MapRegionEditorMode =
  | { type: "idle" }
  | { type: "drawing" }
  | { type: "editing"; regionId: ID };

export type MapRegionDraft = {
  id: ID;
  label: string;
  shape: RegionShape | null;
  visible: boolean;
  imageAssetId?: ID;
  imageFile?: File | null;
  musicTrackId?: ID;
  subMapId?: ID;
  sceneIds: ID[];
  entrySceneId?: ID;
};

export type MapRegionEditorState = {
  mapId: ID | null;
  mode: MapRegionEditorMode;
  selectedRegionId: ID | null;
  draft: MapRegionDraft | null;
  drawing: EditorDrawingState;
};