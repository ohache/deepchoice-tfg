import type { Hotspot, ID, InteractionRules, Node, Project, SceneImageLayer } from "@/domain/types";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import type { DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import type { NodeFieldErrors } from "@/features/editor/scene/node/nodeValidator";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import { initialHotspotEditorState, initialPlacedItemEditorState, initialPlacedNpcEditorState,
  initialPlacedPlayerEditorState} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import type { DeleteImpactReport, DeleteTarget, ProjectDiagnostics } from "@/features/editor/delete/deleteTypes";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import { removeAssetFile } from "@/features/editor/core/editorDataUtils";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapRegionEditorTypes";

export type InteractionKind = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

export type LayerEditSession = { mode: "idle" } | { mode: "editing"; layerId: ID; isNew: boolean; snapshot: SceneImageLayer };

export type EditorDeleteStateLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;

  selectedPlayerId: ID | null;
  selectedNpcId: ID | null;
  selectedItemId: ID | null;
  selectedMusicTrackId: ID | null;
  selectedSfxId: ID | null;
  selectedMapId: ID | null;

  activeLayerId: ID | null;
  activeTextEntryId: ID | null;
  activeLayerField: LayerToggleFieldId | null;
  layerEditSession: LayerEditSession;

  hotspotEditor: HotspotEditorState;
  placedItemEditor: PlacedItemEditorState;
  placedNpcEditor: PlacedNpcEditorState;
  placedPlayerEditor: PlacedPlayerEditorState;

  dialogueEditor: DialogueEditorState;

  selectedInteractionKind: InteractionKind | null;
  selectedInteractionId: ID | null;
  pendingInteractiveOpen: { kind: InteractionKind; id: ID } | null;

  nodeMode: "creating" | "editing";
  selectedNodeId: ID | null;
  editingNodeId: ID | null;
  nodeDraft: Node | null;
  nodeErrors: NodeFieldErrors;

  mapRegionEditor: MapRegionEditorState;

  pendingDeleteImpact: DeleteImpactReport | null;
  pendingDeleteTarget: DeleteTarget | null;
  lastDeleteDiagnostics: ProjectDiagnostics | null;
};

export function collectRemovedAssetFileIds(prevProject: Project, nextProject: Project): ID[] {
  const nextAssetIds = new Set(nextProject.assets.map((asset) => asset.id));

  return prevProject.assets.map((asset) => asset.id).filter((assetId) => !nextAssetIds.has(assetId));
}

export function removeAssetFilesByIds(assetFiles: Record<ID, File>, assetIds: ID[]): Record<ID, File> {
  let nextAssetFiles = assetFiles;

  for (const assetId of assetIds) nextAssetFiles = removeAssetFile(nextAssetFiles, assetId).assetFiles;

  return nextAssetFiles;
}

function getFirstTextEntryIdFromLayers(layers: SceneImageLayer[]): ID | null {
  for (const layer of layers) {
    const firstTextEntryId = layer.text?.[0]?.id;
    if (firstTextEntryId) return firstTextEntryId;
  }

  return null;
}

function collectLayerInteractionIds(layer: SceneImageLayer | undefined): { hotspotIds: Set<ID>; placedItemIds: Set<ID>; placedNpcIds: Set<ID>; placedPlayerIds: Set<ID>} {
  return {
    hotspotIds: new Set((layer?.hotspots ?? []).map((entry) => entry.id)),
    placedItemIds: new Set((layer?.placedItems ?? []).map((entry) => entry.itemInstanceId)),
    placedNpcIds: new Set((layer?.placedNpcs ?? []).map((entry) => entry.npcId)),
    placedPlayerIds: new Set((layer?.placedPlayers ?? []).map((entry) => entry.playerId)),
  };
}

function interactionWasRemoved(kind: InteractionKind | null, id: ID | null, ids: ReturnType<typeof collectLayerInteractionIds>): boolean {
  if (!kind || !id) return false;

  if (kind === "hotspot") return ids.hotspotIds.has(id);
  if (kind === "placedItem") return ids.placedItemIds.has(id);
  if (kind === "placedNpc") return ids.placedNpcIds.has(id);
  if (kind === "placedPlayer") return ids.placedPlayerIds.has(id);

  return false;
}

export function buildLayerDeleteStatePatch(state: EditorDeleteStateLike, layerId: ID, nextLayers: SceneImageLayer[], removedLayer: SceneImageLayer | undefined): Pick<
  EditorDeleteStateLike, | "activeLayerId" | "activeTextEntryId" | "activeLayerField" | "layerEditSession" | "hotspotEditor" | "placedItemEditor"
  | "placedNpcEditor" | "placedPlayerEditor" | "selectedInteractionKind" | "selectedInteractionId" | "pendingInteractiveOpen"> {
  const removedIds = collectLayerInteractionIds(removedLayer);

  const removedActiveLayer = state.activeLayerId === layerId;

  const removedHotspotLayer = state.hotspotEditor.context?.layerId === layerId;
  const removedPlacedItemLayer = state.placedItemEditor.context?.layerId === layerId;
  const removedPlacedNpcLayer = state.placedNpcEditor.context?.layerId === layerId;
  const removedPlacedPlayerLayer = state.placedPlayerEditor.context?.layerId === layerId;

  const removedLayerEditSession = state.layerEditSession.mode === "editing" && state.layerEditSession.layerId === layerId;

  const selectedInteractionWasRemoved = interactionWasRemoved(state.selectedInteractionKind, state.selectedInteractionId, removedIds);

  const pendingInteractiveWasRemoved = interactionWasRemoved(state.pendingInteractiveOpen?.kind ?? null, state.pendingInteractiveOpen?.id ?? null, removedIds);

  const shouldResetHotspotEditor = removedActiveLayer || removedHotspotLayer || (state.selectedInteractionKind === "hotspot" && selectedInteractionWasRemoved);

  const shouldResetPlacedItemEditor = removedActiveLayer || removedPlacedItemLayer || (state.selectedInteractionKind === "placedItem" && selectedInteractionWasRemoved);

  const shouldResetPlacedNpcEditor = removedActiveLayer || removedPlacedNpcLayer || (state.selectedInteractionKind === "placedNpc" && selectedInteractionWasRemoved);

  const shouldResetPlacedPlayerEditor = removedActiveLayer || removedPlacedPlayerLayer || (state.selectedInteractionKind === "placedPlayer" && selectedInteractionWasRemoved);

  const shouldClearSelection = selectedInteractionWasRemoved || shouldResetHotspotEditor || shouldResetPlacedItemEditor ||
    shouldResetPlacedNpcEditor || shouldResetPlacedPlayerEditor;

  return {
    activeLayerId: removedActiveLayer ? nextLayers[0]?.id ?? null : state.activeLayerId,

    activeTextEntryId: removedActiveLayer ? getFirstTextEntryIdFromLayers(nextLayers) : state.activeTextEntryId,

    activeLayerField: removedActiveLayer ? null : state.activeLayerField,

    layerEditSession: removedLayerEditSession ? { mode: "idle" } : state.layerEditSession,

    hotspotEditor: shouldResetHotspotEditor ? initialHotspotEditorState : state.hotspotEditor,

    placedItemEditor: shouldResetPlacedItemEditor ? initialPlacedItemEditorState : state.placedItemEditor,

    placedNpcEditor: shouldResetPlacedNpcEditor ? initialPlacedNpcEditorState : state.placedNpcEditor,

    placedPlayerEditor: shouldResetPlacedPlayerEditor ? initialPlacedPlayerEditorState : state.placedPlayerEditor,

    selectedInteractionKind: shouldClearSelection ? null : state.selectedInteractionKind,

    selectedInteractionId: shouldClearSelection ? null : state.selectedInteractionId,

    pendingInteractiveOpen: shouldClearSelection || pendingInteractiveWasRemoved ? null : state.pendingInteractiveOpen,
  };
}

export function applyDeleteToNodeDraft(project: Project, nodeDraft: Node, target: DeleteTarget): { nodeDraft: Node; touched: boolean } {
  const cleanedProject = applyDeleteWithCleanup({ ...project, nodes: [nodeDraft]}, target);

  const cleanedNodeDraft = cleanedProject.nodes.find((node) => node.id === nodeDraft.id);

  if (!cleanedNodeDraft) return { nodeDraft, touched: false };

  return {
    nodeDraft: cleanedNodeDraft,
    touched: cleanedNodeDraft !== nodeDraft,
  };
}

export function findHotspotInNodeDraft(nodeDraft: Node, layerId: ID, hotspotId: ID): Hotspot | null {
  const layer = nodeDraft.layers.find((entry) => entry.id === layerId);
  return layer?.hotspots?.find((entry) => entry.id === hotspotId) ?? null;
}

function ruleIdExistsInRules(rules: InteractionRules | undefined, ruleId: ID | null | undefined): boolean {
  if (!ruleId) return false;

  return ((rules?.onClick ?? []).some((rule) => rule.id === ruleId) || (rules?.onUseItem ?? []).some((rule) => rule.id === ruleId));
}

export function syncHotspotEditorAfterHotspotVarDelete(editor: HotspotEditorState, cleanedHotspot: Hotspot): HotspotEditorState {
  const selectedRuleId = editor.selection?.selectedRuleId ?? null;

  const nextSelectedRuleId = ruleIdExistsInRules(cleanedHotspot.rules, selectedRuleId) ? selectedRuleId : null;

  return {
    ...editor,
    draft: cleanedHotspot,
    selection: editor.selection ? { ...editor.selection, hotspotId: cleanedHotspot.id, selectedRuleId: nextSelectedRuleId } : editor.selection,
  };
}

export function removeHotspotFromNodeDraft(nodeDraft: Node, layerId: ID, hotspotId: ID): { nodeDraft: Node; touched: boolean } {
  let touched = false;

  const nextLayers = (nodeDraft.layers ?? []).map((layer) => {
    if (layer.id !== layerId) return layer;

    const currentHotspots = layer.hotspots ?? [];
    const nextHotspots = currentHotspots.filter((hotspot) => hotspot.id !== hotspotId);

    if (nextHotspots.length === currentHotspots.length) return layer;

    touched = true;

    return {
      ...layer,
      hotspots: nextHotspots,
    };
  });

  if (!touched) return { nodeDraft, touched: false };

  return {
    nodeDraft: {
      ...nodeDraft,
      layers: nextLayers,
    },
    touched: true,
  };
}

export function hotspotEditorTargetsDeletedHotspot(editor: HotspotEditorState, target: { layerId: ID; hotspotId: ID }): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsHotspot = editor.mode.type === "editing" && editor.mode.hotspotId === target.hotspotId;

  return (modeTargetsHotspot || editor.selection?.hotspotId === target.hotspotId || editor.draft?.id === target.hotspotId);
}

export function placedItemEditorTargetsDeletedPlacedItem(editor: PlacedItemEditorState, target: { layerId: ID; placedItemId: ID }): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedItem = editor.mode.type === "editing" && editor.mode.placedItemId === target.placedItemId;

  return (modeTargetsPlacedItem || editor.selection?.placedItemId === target.placedItemId || editor.draft?.itemInstanceId === target.placedItemId);
}

export function placedNpcEditorTargetsDeletedPlacedNpc(editor: PlacedNpcEditorState, target: { layerId: ID; npcId: ID }): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedNpc = editor.mode.type === "editing" && editor.mode.npcId === target.npcId;

  return (modeTargetsPlacedNpc || editor.selection?.npcId === target.npcId || editor.draft?.npcId === target.npcId);
}

export function placedPlayerEditorTargetsDeletedPlacedPlayer(editor: PlacedPlayerEditorState, target: { layerId: ID; playerId: ID }): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedPlayer = editor.mode.type === "editing" && editor.mode.playerId === target.playerId;

  return (modeTargetsPlacedPlayer || editor.selection?.playerId === target.playerId || editor.draft?.playerId === target.playerId);
}

export function dialogueEditorTargetsDeletedDialogue(editor: DialogueEditorState, target: { nodeId: ID; dialogueId: ID }): boolean {
  if (editor.context?.nodeId && editor.context.nodeId !== target.nodeId) return false;

  const modeTargetsDialogue = editor.mode.type === "editing" && editor.mode.dialogueId === target.dialogueId;

  return (modeTargetsDialogue || editor.selection.selectedDialogueId === target.dialogueId || editor.dialogueDraft?.id === target.dialogueId);
}

export function shouldResetNodeEditor(state: EditorDeleteStateLike, target: DeleteTarget): boolean {
  if (target.kind !== "node") return false;

  return (state.selectedNodeId === target.nodeId || state.editingNodeId === target.nodeId || state.nodeDraft?.id === target.nodeId);
}

export function shouldResetMapRegionEditor(editor: MapRegionEditorState, target: DeleteTarget): boolean {
  if (target.kind === "map") return editor.mapId === target.mapId;

  if (target.kind === "mapRegion") {
    return (editor.mapId === target.mapId && (editor.selectedRegionId === target.regionId || editor.draft?.id === target.regionId));
  }

  if (target.kind === "node") {
    return (editor.draft?.entrySceneId === target.nodeId || Boolean(editor.draft?.sceneIds.includes(target.nodeId)));
  }

  return false;
}