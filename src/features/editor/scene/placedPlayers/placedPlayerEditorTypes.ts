import type { ID, PlacedPlayerState, RegionShape } from "@/domain/types";
import type { BaseEditorState, EditorContext, EditorMode } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type PlacedPlayerEditorMode = EditorMode<"playerId">;

export type PlacedPlayerEditorContext = EditorContext;

export type PlacedPlayerDraft = {
  playerId: ID;
  initialImageId: ID;
  shape: RegionShape | null;
  initialState: PlacedPlayerState;
};

export type PlacedPlayerSelection = {
  playerId: ID | null;
};

export type PlacedPlayerEditorState = BaseEditorState<PlacedPlayerEditorContext, PlacedPlayerEditorMode, PlacedPlayerSelection, PlacedPlayerDraft>;