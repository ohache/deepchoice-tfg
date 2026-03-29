import type { Hotspot, VarDef } from "@/domain/types";
import type { EditorContext, EditorMode, RuleChannel, BaseInteractiveDraft, EditorSelection, BaseEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";

export type HotspotEditorMode = EditorMode<"hotspotId">;

/* Contexto explícito del editor */
export type HotspotEditorContext = EditorContext;

/* Canal de reglas */
export type HotspotRuleChannel = RuleChannel;

/* Draft durante creación/edición */
export type HotspotDraft = BaseInteractiveDraft<Hotspot["rules"]> & { label: string; vars: VarDef[] };

/* Estado de selección dentro del editor */
export type HotspotSelection = EditorSelection<"hotspotId", HotspotRuleChannel>;

/* Estado completo del sub-sistema hotspots dentro del editor */
export type HotspotEditorState = BaseEditorState<HotspotEditorContext, HotspotEditorMode, HotspotSelection, HotspotDraft>