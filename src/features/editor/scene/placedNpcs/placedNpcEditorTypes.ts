import type { ID, InteractionRules  } from "@/domain/types";
import type { EditorContext, EditorMode, RuleChannel, BaseShapeDraft, EditorSelection, BaseEditorState, CommitInteractiveDraftResult } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type PlacedNpcEditorMode = EditorMode<"npcId">;

export type PlacedNpcEditorContext = EditorContext;

export type PlacedNpcRuleChannel = RuleChannel;

export type PlacedNpcDraft = BaseShapeDraft<InteractionRules> & { npcId: ID };

export type PlacedNpcSelection = EditorSelection<"npcId", PlacedNpcRuleChannel>;

export type PlacedNpcEditorState = BaseEditorState<PlacedNpcEditorContext, PlacedNpcEditorMode, PlacedNpcSelection, PlacedNpcDraft>;

export type CommitPlacedNpcDraftResult = CommitInteractiveDraftResult<"npcId">;