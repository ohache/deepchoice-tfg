import type { ID, RegionShape, PlaceableState, InteractionRules } from "@/domain/types";

export type EditorDrawingState = null | { startX: number; startY: number; currentX: number; currentY: number };

export type EditorContext = { layerId: ID };

export type EditorMode<EntityIdKey extends string> = { type: "idle" } | { type: "drawing" } | ({ type: "editing" } & Record<EntityIdKey, ID>);

export type RuleChannel = { type: "onClick" } | { type: "onUseItem"; itemInstanceId: ID };

export type BaseShapeDraft<Rules = InteractionRules> = { shape: RegionShape | null; initialState: PlaceableState; rules: Rules };

export type IdentifiedShapeDraft<Rules = InteractionRules> = BaseShapeDraft<Rules> & { id: ID };

export type PlacementDraft = { shape: RegionShape | null; initialState: PlaceableState };

export type EditorSelection<EntityIdKey extends string, Channel> = Record<EntityIdKey, ID | null> & { selectedChannel: Channel | null; selectedRuleId: ID | null };

export type BaseEditorState<Context, Mode, Selection, Draft> = { context: Context | null; mode: Mode; selection: Selection; draft: Draft | null; drawing: EditorDrawingState };

export type CommitDraftErrorCode = "missing_draft" | "invalid_draft";

export type CommitInteractiveDraftResult<SuccessKey extends string> = ({ ok: true } & Record<SuccessKey, ID>) | { ok: false; code: CommitDraftErrorCode; error: string };