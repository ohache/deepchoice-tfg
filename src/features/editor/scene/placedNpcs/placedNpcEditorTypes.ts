import type { ID, PlacedNpc } from "@/domain/types";
import type { EditorContext, EditorMode, RuleChannel, BaseInteractiveDraft, EditorSelection, BaseEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type PlacedNpcEditorMode = EditorMode<"npcId">;

export type PlacedNpcEditorContext = EditorContext;

export type PlacedNpcRuleChannel = RuleChannel;

export type PlacedNpcDraft = Omit<BaseInteractiveDraft<PlacedNpc["rules"]>, "id"> & { npcId: ID };

export type PlacedNpcSelection = EditorSelection<"npcId", PlacedNpcRuleChannel>;

export type PlacedNpcEditorState = BaseEditorState<PlacedNpcEditorContext, PlacedNpcEditorMode, PlacedNpcSelection, PlacedNpcDraft>;