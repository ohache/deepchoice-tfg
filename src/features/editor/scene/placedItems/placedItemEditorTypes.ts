import type { ItemInstance, InteractionRules } from "@/domain/types";
import type { EditorContext, EditorMode, RuleChannel, EditorSelection, BaseEditorState, PlacementDraft, CommitInteractiveDraftResult } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type PlacedItemEditorMode = EditorMode<"placedItemId">;

export type PlacedItemEditorContext = EditorContext;

export type PlacedItemRuleChannel = RuleChannel;

export type PlacedItemDraft = Omit<ItemInstance, "placement" | "rules"> & { rules: InteractionRules; placement: PlacementDraft};

export type PlacedItemSelection = EditorSelection<"placedItemId", PlacedItemRuleChannel>;

export type PlacedItemEditorState = BaseEditorState<PlacedItemEditorContext, PlacedItemEditorMode, PlacedItemSelection, PlacedItemDraft>;

export type CommitPlacedItemDraftResult = CommitInteractiveDraftResult<"placedItemId">;