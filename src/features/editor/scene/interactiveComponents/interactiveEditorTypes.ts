import type { ID, RegionShape, PlaceableState } from "@/domain/types";

export type EditorDrawingState = null | {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export type EditorContext = {
  layerId: ID;
};

export type EditorMode<EntityIdKey extends string> =
  | { type: "idle" }
  | { type: "drawing" }
  | { type: "editing" } & Record<EntityIdKey, ID>;

export type RuleChannel =
  | { type: "onClick" }
  | { type: "onUseItem"; placedItemId: ID };

export type BaseInteractiveDraft<Rules> = {
  id: ID;
  shape: RegionShape | null;
  initialState: PlaceableState;
  rules: Rules;
};

export type EditorSelection<EntityIdKey extends string, Channel> = Record<EntityIdKey, ID | null> & {
  selectedChannel: Channel | null;
  selectedRuleId: ID | null;
};

export type BaseEditorState<Context, Mode, Selection, Draft> = {
  context: Context | null;
  mode: Mode;
  selection: Selection;
  draft: Draft | null;
  drawing: EditorDrawingState;
};