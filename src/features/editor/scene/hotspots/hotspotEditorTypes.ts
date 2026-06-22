import type { InteractionRules, VarDef } from "@/domain/types";
import type { BaseEditorState, CommitInteractiveDraftResult, EditorContext, EditorMode, EditorSelection, IdentifiedShapeDraft, RuleChannel } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type HotspotEditorMode = EditorMode<"hotspotId">;

export type HotspotEditorContext = EditorContext;

export type HotspotRuleChannel = RuleChannel;

export type HotspotDraft = IdentifiedShapeDraft<InteractionRules> & { label: string; vars: VarDef[] };

export type HotspotSelection = EditorSelection<"hotspotId", HotspotRuleChannel>;

export type HotspotEditorState = BaseEditorState<HotspotEditorContext, HotspotEditorMode, HotspotSelection, HotspotDraft>

export type CommitHotspotDraftResult = CommitInteractiveDraftResult<"hotspotId">;