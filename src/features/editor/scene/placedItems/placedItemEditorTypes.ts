import type { PlacedItem, ID } from "@/domain/types";
import type { EditorContext, EditorMode, RuleChannel, BaseInteractiveDraft, EditorSelection, BaseEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type PlacedItemEditorMode = EditorMode<"placedItemId">;

export type PlacedItemEditorContext = EditorContext;

export type PlacedItemRuleChannel = RuleChannel;

export type PlacedItemDraft = BaseInteractiveDraft<PlacedItem["rules"]> & { itemId: ID; label: string };

export type PlacedItemSelection = EditorSelection<"placedItemId", PlacedItemRuleChannel>;

export type PlacedItemEditorState = BaseEditorState<PlacedItemEditorContext, PlacedItemEditorMode, PlacedItemSelection, PlacedItemDraft>;