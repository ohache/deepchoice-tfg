import type { Hotspot, ID, InteractionRules, Node, Project, SceneImageLayer } from "@/domain/types";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemEditorState } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import type { DialogueEditorState } from "@/features/editor/scene/dialogues/dialogueEditorTypes";
import { createEmptyDialogueEditorState } from "@/features/editor/scene/dialogues/dialogueHelpers";
import type { NodeFieldErrors } from "@/features/editor/scene/node/nodeValidator";
import type { LayerToggleFieldId } from "@/features/editor/scene/SceneCommon";
import {
  initialHotspotEditorState,
  initialPlacedItemEditorState,
  initialPlacedNpcEditorState,
  initialPlacedPlayerEditorState,
} from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import type { DeleteImpactReport, DeleteTarget, ProjectDiagnostics } from "@/features/editor/delete/deleteTypes";
import { analyzeDeleteImpact } from "@/features/editor/delete/deleteImpactAnalyzer";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import { diagnoseProject } from "@/features/editor/delete/projectDiagnostics";
import { removeAssetFile } from "@/features/editor/core/editorDataUtils";
import { initialMapRegionEditorState, nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapRegionEditorTypes";

type InteractionKind = "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";

type LayerEditSession =
  | { mode: "idle" }
  | { mode: "editing"; layerId: ID; isNew: boolean; snapshot: SceneImageLayer };

type EditorStoreLike = {
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

export type EditorDeleteSlice = {
  pendingDeleteImpact: DeleteImpactReport | null;
  pendingDeleteTarget: DeleteTarget | null;
  lastDeleteDiagnostics: ProjectDiagnostics | null;

  requestDelete: (target: DeleteTarget) => void;
  cancelPendingDelete: () => void;
  confirmPendingDelete: () => void;
  clearLastDeleteDiagnostics: () => void;
}

function applyDeleteToState(state: EditorStoreLike, target: DeleteTarget): EditorStoreLike {
  if (!state.project) return state;

  const assetFileIdsToRemove = collectAssetFileIdsForDelete(state.project, target);

  const nextProject = applyDeleteWithCleanup(state.project, target);
  const diagnostics = diagnoseProject(nextProject);
  const hasDiagnostics = diagnostics.errors.length > 0 || diagnostics.warnings.length > 0;

  let nextAssetFiles = removeAssetFilesByIds(state.assetFiles, assetFileIdsToRemove);

  let nextSelectedPlayerId = state.selectedPlayerId;
  let nextSelectedNpcId = state.selectedNpcId;
  let nextSelectedItemId = state.selectedItemId;
  let nextSelectedMusicTrackId = state.selectedMusicTrackId;
  let nextSelectedSfxId = state.selectedSfxId;
  let nextSelectedMapId = state.selectedMapId;
  let nextMapRegionEditor = state.mapRegionEditor;

  let nextNodeMode = state.nodeMode;
  let nextSelectedNodeId = state.selectedNodeId;
  let nextEditingNodeId = state.editingNodeId;
  let nextNodeDraft = state.nodeDraft;
  let nextNodeErrors = state.nodeErrors;

  let nextActiveLayerId = state.activeLayerId;
  let nextActiveTextEntryId = state.activeTextEntryId;
  let nextActiveLayerField = state.activeLayerField;
  let nextLayerEditSession = state.layerEditSession;

  let nextHotspotEditor = state.hotspotEditor;
  let nextPlacedItemEditor = state.placedItemEditor;
  let nextPlacedNpcEditor = state.placedNpcEditor;
  let nextPlacedPlayerEditor = state.placedPlayerEditor;
  let nextDialogueEditor = state.dialogueEditor;

  let nextSelectedInteractionKind = state.selectedInteractionKind;
  let nextSelectedInteractionId = state.selectedInteractionId;
  let nextPendingInteractiveOpen = state.pendingInteractiveOpen;

  if (shouldResetMapRegionEditor(state.mapRegionEditor, target)) nextMapRegionEditor = initialMapRegionEditorState;

  if (shouldResetNodeEditor(state, target)) {
    nextNodeMode = "creating";
    nextSelectedNodeId = null;
    nextEditingNodeId = null;
    nextNodeDraft = null;
    nextNodeErrors = {};

    nextActiveLayerId = null;
    nextActiveTextEntryId = null;
    nextActiveLayerField = null;
    nextLayerEditSession = { mode: "idle" };

    nextHotspotEditor = initialHotspotEditorState;
    nextPlacedItemEditor = initialPlacedItemEditorState;
    nextPlacedNpcEditor = initialPlacedNpcEditorState;
    nextPlacedPlayerEditor = initialPlacedPlayerEditorState;

    nextDialogueEditor = createEmptyDialogueEditorState();

    nextSelectedInteractionKind = null;
    nextSelectedInteractionId = null;
    nextPendingInteractiveOpen = null;
  }

  if (target.kind === "layer" && state.nodeDraft?.id === target.nodeId) {
    const layers0 = state.nodeDraft.layers ?? [];
    const removedLayer = layers0.find((layer) => layer.id === target.layerId);
    const nextLayers = layers0.filter((layer) => layer.id !== target.layerId);

    if (nextLayers.length !== layers0.length) {
      const layerPatch = buildLayerDeleteStatePatch(state, target.layerId, nextLayers, removedLayer);

      nextNodeDraft = {
        ...state.nodeDraft,
        layers: nextLayers,
      };

      nextNodeErrors = {};

      nextActiveLayerId = layerPatch.activeLayerId;
      nextActiveTextEntryId = layerPatch.activeTextEntryId;
      nextActiveLayerField = layerPatch.activeLayerField;
      nextLayerEditSession = layerPatch.layerEditSession;

      nextHotspotEditor = layerPatch.hotspotEditor;
      nextPlacedItemEditor = layerPatch.placedItemEditor;
      nextPlacedNpcEditor = layerPatch.placedNpcEditor;
      nextPlacedPlayerEditor = layerPatch.placedPlayerEditor;

      nextSelectedInteractionKind = layerPatch.selectedInteractionKind;
      nextSelectedInteractionId = layerPatch.selectedInteractionId;
      nextPendingInteractiveOpen = layerPatch.pendingInteractiveOpen;
    }
  }

  if (target.kind === "hotspot" && state.nodeDraft?.id === target.nodeId) {
    const result = removeHotspotFromNodeDraft(
      state.nodeDraft,
      target.layerId,
      target.hotspotId,
    );

    if (result.touched) {
      nextNodeDraft = result.nodeDraft;
      nextNodeErrors = {};

      if (hotspotEditorTargetsDeletedHotspot(state.hotspotEditor, target)) {
        nextHotspotEditor = initialHotspotEditorState;
      }

      if (
        state.selectedInteractionKind === "hotspot" &&
        state.selectedInteractionId === target.hotspotId
      ) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (
        state.pendingInteractiveOpen?.kind === "hotspot" &&
        state.pendingInteractiveOpen.id === target.hotspotId
      ) {
        nextPendingInteractiveOpen = null;
      }
    }
  }

  if (target.kind === "hotspotVar" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(
      state.project,
      state.nodeDraft,
      target,
    );

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (hotspotEditorTargetsDeletedHotspot(state.hotspotEditor, target)) {
        const cleanedHotspot = findHotspotInNodeDraft(
          draftResult.nodeDraft,
          target.layerId,
          target.hotspotId,
        );

        nextHotspotEditor = cleanedHotspot
          ? syncHotspotEditorAfterHotspotVarDelete(state.hotspotEditor, cleanedHotspot)
          : initialHotspotEditorState;
      }
    }
  }

  if (target.kind === "placedItem" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(
      state.project,
      state.nodeDraft,
      target,
    );

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedItemEditorTargetsDeletedPlacedItem(state.placedItemEditor, target)) {
        nextPlacedItemEditor = initialPlacedItemEditorState;
      }

      if (
        state.selectedInteractionKind === "placedItem" &&
        state.selectedInteractionId === target.placedItemId
      ) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (
        state.pendingInteractiveOpen?.kind === "placedItem" &&
        state.pendingInteractiveOpen.id === target.placedItemId
      ) {
        nextPendingInteractiveOpen = null;
      }
    }
  }

  if (target.kind === "placedPlayer" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(
      state.project,
      state.nodeDraft,
      target,
    );

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedPlayerEditorTargetsDeletedPlacedPlayer(state.placedPlayerEditor, target)) {
        nextPlacedPlayerEditor = initialPlacedPlayerEditorState;
      }

      if (
        state.selectedInteractionKind === "placedPlayer" &&
        state.selectedInteractionId === target.playerId
      ) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (
        state.pendingInteractiveOpen?.kind === "placedPlayer" &&
        state.pendingInteractiveOpen.id === target.playerId
      ) {
        nextPendingInteractiveOpen = null;
      }
    }
  }

  if (target.kind === "placedNpc" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(
      state.project,
      state.nodeDraft,
      target,
    );

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedNpcEditorTargetsDeletedPlacedNpc(state.placedNpcEditor, target)) {
        nextPlacedNpcEditor = initialPlacedNpcEditorState;
      }

      if (
        state.selectedInteractionKind === "placedNpc" &&
        state.selectedInteractionId === target.npcId
      ) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (
        state.pendingInteractiveOpen?.kind === "placedNpc" &&
        state.pendingInteractiveOpen.id === target.npcId
      ) {
        nextPendingInteractiveOpen = null;
      }
    }
  }

  if (target.kind === "dialogue" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(
      state.project,
      state.nodeDraft,
      target,
    );

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (dialogueEditorTargetsDeletedDialogue(state.dialogueEditor, target)) {
        nextDialogueEditor = createEmptyDialogueEditorState();
      }
    }
  }

  switch (target.kind) {
    case "player":
      nextSelectedPlayerId = nextSelectedAfterRemoval(nextSelectedPlayerId, target.playerId);
      break;

    case "npc":
      nextSelectedNpcId = nextSelectedAfterRemoval(nextSelectedNpcId, target.npcId);
      break;

    case "item":
      nextSelectedItemId = nextSelectedAfterRemoval(nextSelectedItemId, target.itemId);
      break;

    case "music":
      nextSelectedMusicTrackId = nextSelectedAfterRemoval(nextSelectedMusicTrackId, target.trackId);
      break;

    case "sfx":
      nextSelectedSfxId = nextSelectedAfterRemoval(nextSelectedSfxId, target.sfxId);
      break;

    case "map":
      nextSelectedMapId = nextSelectedAfterRemoval(nextSelectedMapId, target.mapId);
      break;
  }

  return {
    ...state,
    project: nextProject,
    assetFiles: nextAssetFiles,

    selectedPlayerId: nextSelectedPlayerId,
    selectedNpcId: nextSelectedNpcId,
    selectedItemId: nextSelectedItemId,
    selectedMusicTrackId: nextSelectedMusicTrackId,
    selectedSfxId: nextSelectedSfxId,
    selectedMapId: nextSelectedMapId,

    mapRegionEditor: nextMapRegionEditor,

    nodeMode: nextNodeMode,
    selectedNodeId: nextSelectedNodeId,
    editingNodeId: nextEditingNodeId,
    nodeDraft: nextNodeDraft,
    nodeErrors: nextNodeErrors,

    activeLayerId: nextActiveLayerId,
    activeTextEntryId: nextActiveTextEntryId,
    activeLayerField: nextActiveLayerField,
    layerEditSession: nextLayerEditSession,

    hotspotEditor: nextHotspotEditor,
    placedItemEditor: nextPlacedItemEditor,
    placedNpcEditor: nextPlacedNpcEditor,
    placedPlayerEditor: nextPlacedPlayerEditor,

    dialogueEditor: nextDialogueEditor,

    selectedInteractionKind: nextSelectedInteractionKind,
    selectedInteractionId: nextSelectedInteractionId,
    pendingInteractiveOpen: nextPendingInteractiveOpen,


    pendingDeleteImpact: null,
    pendingDeleteTarget: null,
    lastDeleteDiagnostics: hasDiagnostics ? diagnostics : null,
  };
}

function collectAssetFileIdsForDelete(project: Project, target: DeleteTarget): ID[] {
  switch (target.kind) {
    case "node":
      return collectNodeAssetFileIds(project, target.nodeId);

    case "layer":
      return collectLayerAssetFileIds(project, target);

    case "player":
      return collectPlayerAssetFileIds(project, target.playerId);

    case "playerImage":
      return [target.imageId];

    case "npc":
      return [target.npcId];

    case "item":
      return [target.itemId];

    case "music":
      return [target.trackId];

    case "sfx":
      return [target.sfxId];

    case "map":
      return collectMapAssetFileIds(project, target.mapId);

    case "mapRegion":
      return collectMapRegionAssetFileIds(project, target);

    default:
      return [];
  }
}

function collectNodeAssetFileIds(project: Project, nodeId: ID): ID[] {
  const node = project.nodes.find((entry) => entry.id === nodeId);
  if (!node) return [];

  const candidateIds = new Set<ID>(
    node.layers.map((layer) => layer.assetId).filter(Boolean),
  );

  if (candidateIds.size === 0) return [];

  const usedElsewhere = new Set<ID>();

  for (const currentNode of project.nodes) {
    if (currentNode.id === nodeId) continue;

    for (const layer of currentNode.layers ?? []) {
      if (layer.assetId) usedElsewhere.add(layer.assetId);
    }
  }

  return [...candidateIds].filter((assetId) => !usedElsewhere.has(assetId));
}

function collectLayerAssetFileIds(
  project: Project,
  input: { nodeId: ID; layerId: ID },
): ID[] {
  const node = project.nodes.find((entry) => entry.id === input.nodeId);
  const layer = node?.layers.find((entry) => entry.id === input.layerId);

  if (!layer?.assetId) return [];

  const usedElsewhere = new Set<ID>();

  for (const currentNode of project.nodes) {
    for (const currentLayer of currentNode.layers ?? []) {
      if (
        currentNode.id === input.nodeId &&
        currentLayer.id === input.layerId
      ) {
        continue;
      }

      if (currentLayer.assetId) usedElsewhere.add(currentLayer.assetId);
    }
  }

  return usedElsewhere.has(layer.assetId) ? [] : [layer.assetId];
}

function collectPlayerAssetFileIds(project: Project, playerId: ID): ID[] {
  const player = project.players.find((entry) => entry.id === playerId);
  if (!player) return [];

  return player.images.map((image) => image.id);
}

function collectMapAssetFileIds(project: Project, mapId: ID): ID[] {
  const map = project.maps.find((entry) => entry.id === mapId);
  if (!map) return [];

  const ids = new Set<ID>();

  if (map.visual.type === "singleImage") ids.add(map.visual.imageAssetId);
  if (map.visual.type === "composed") ids.add(map.visual.backgroundAssetId);

  for (const region of map.regions) {
    if (region.imageAssetId) ids.add(region.imageAssetId);
  }

  return [...ids];
}

function collectMapRegionAssetFileIds(
  project: Project,
  input: { mapId: ID; regionId: ID },
): ID[] {
  const map = project.maps.find((entry) => entry.id === input.mapId);
  const region = map?.regions.find((entry) => entry.id === input.regionId);

  return region?.imageAssetId ? [region.imageAssetId] : [];
}

function removeAssetFilesByIds(
  assetFiles: Record<ID, File>,
  assetIds: ID[],
): Record<ID, File> {
  let nextAssetFiles = assetFiles;

  for (const assetId of assetIds) {
    nextAssetFiles = removeAssetFile(nextAssetFiles, assetId).assetFiles;
  }

  return nextAssetFiles;
}

function getFirstTextEntryIdFromLayers(layers: SceneImageLayer[]): ID | null {
  for (const layer of layers) {
    const firstTextEntryId = layer.text?.[0]?.id;
    if (firstTextEntryId) return firstTextEntryId;
  }

  return null;
}

function collectLayerInteractionIds(layer: SceneImageLayer | undefined): {
  hotspotIds: Set<ID>;
  placedItemIds: Set<ID>;
  placedNpcIds: Set<ID>;
  placedPlayerIds: Set<ID>;
} {
  return {
    hotspotIds: new Set((layer?.hotspots ?? []).map((entry) => entry.id)),
    placedItemIds: new Set((layer?.placedItems ?? []).map((entry) => entry.itemInstanceId)),
    placedNpcIds: new Set((layer?.placedNpcs ?? []).map((entry) => entry.npcId)),
    placedPlayerIds: new Set((layer?.placedPlayers ?? []).map((entry) => entry.playerId)),
  };
}

function interactionWasRemoved(
  kind: InteractionKind | null,
  id: ID | null,
  ids: ReturnType<typeof collectLayerInteractionIds>,
): boolean {
  if (!kind || !id) return false;

  if (kind === "hotspot") return ids.hotspotIds.has(id);
  if (kind === "placedItem") return ids.placedItemIds.has(id);
  if (kind === "placedNpc") return ids.placedNpcIds.has(id);
  if (kind === "placedPlayer") return ids.placedPlayerIds.has(id);

  return false;
}

function buildLayerDeleteStatePatch(
  state: EditorStoreLike,
  layerId: ID,
  nextLayers: SceneImageLayer[],
  removedLayer: SceneImageLayer | undefined,
): Pick<
  EditorStoreLike,
  | "activeLayerId"
  | "activeTextEntryId"
  | "activeLayerField"
  | "layerEditSession"
  | "hotspotEditor"
  | "placedItemEditor"
  | "placedNpcEditor"
  | "placedPlayerEditor"
  | "selectedInteractionKind"
  | "selectedInteractionId"
  | "pendingInteractiveOpen"
> {
  const removedIds = collectLayerInteractionIds(removedLayer);

  const removedActiveLayer = state.activeLayerId === layerId;

  const removedHotspotLayer = state.hotspotEditor.context?.layerId === layerId;
  const removedPlacedItemLayer = state.placedItemEditor.context?.layerId === layerId;
  const removedPlacedNpcLayer = state.placedNpcEditor.context?.layerId === layerId;
  const removedPlacedPlayerLayer = state.placedPlayerEditor.context?.layerId === layerId;

  const removedLayerEditSession =
    state.layerEditSession.mode === "editing" &&
    state.layerEditSession.layerId === layerId;

  const selectedInteractionWasRemoved = interactionWasRemoved(
    state.selectedInteractionKind,
    state.selectedInteractionId,
    removedIds,
  );

  const pendingInteractiveWasRemoved = interactionWasRemoved(
    state.pendingInteractiveOpen?.kind ?? null,
    state.pendingInteractiveOpen?.id ?? null,
    removedIds,
  );

  const shouldResetHotspotEditor =
    removedActiveLayer ||
    removedHotspotLayer ||
    (
      state.selectedInteractionKind === "hotspot" &&
      selectedInteractionWasRemoved
    );

  const shouldResetPlacedItemEditor =
    removedActiveLayer ||
    removedPlacedItemLayer ||
    (
      state.selectedInteractionKind === "placedItem" &&
      selectedInteractionWasRemoved
    );

  const shouldResetPlacedNpcEditor =
    removedActiveLayer ||
    removedPlacedNpcLayer ||
    (
      state.selectedInteractionKind === "placedNpc" &&
      selectedInteractionWasRemoved
    );

  const shouldResetPlacedPlayerEditor =
    removedActiveLayer ||
    removedPlacedPlayerLayer ||
    (
      state.selectedInteractionKind === "placedPlayer" &&
      selectedInteractionWasRemoved
    );

  const shouldClearSelection =
    selectedInteractionWasRemoved ||
    shouldResetHotspotEditor ||
    shouldResetPlacedItemEditor ||
    shouldResetPlacedNpcEditor ||
    shouldResetPlacedPlayerEditor;

  return {
    activeLayerId: removedActiveLayer
      ? nextLayers[0]?.id ?? null
      : state.activeLayerId,

    activeTextEntryId: removedActiveLayer
      ? getFirstTextEntryIdFromLayers(nextLayers)
      : state.activeTextEntryId,

    activeLayerField: removedActiveLayer ? null : state.activeLayerField,

    layerEditSession: removedLayerEditSession
      ? { mode: "idle" }
      : state.layerEditSession,

    hotspotEditor: shouldResetHotspotEditor
      ? initialHotspotEditorState
      : state.hotspotEditor,

    placedItemEditor: shouldResetPlacedItemEditor
      ? initialPlacedItemEditorState
      : state.placedItemEditor,

    placedNpcEditor: shouldResetPlacedNpcEditor
      ? initialPlacedNpcEditorState
      : state.placedNpcEditor,

    placedPlayerEditor: shouldResetPlacedPlayerEditor
      ? initialPlacedPlayerEditorState
      : state.placedPlayerEditor,

    selectedInteractionKind: shouldClearSelection
      ? null
      : state.selectedInteractionKind,

    selectedInteractionId: shouldClearSelection
      ? null
      : state.selectedInteractionId,

    pendingInteractiveOpen:
      shouldClearSelection || pendingInteractiveWasRemoved
        ? null
        : state.pendingInteractiveOpen,
  };
}

function applyDeleteToNodeDraft(
  project: Project,
  nodeDraft: Node,
  target: DeleteTarget,
): { nodeDraft: Node; touched: boolean } {
  const cleanedProject = applyDeleteWithCleanup(
    {
      ...project,
      nodes: [nodeDraft],
    },
    target,
  );

  const cleanedNodeDraft = cleanedProject.nodes.find(
    (node) => node.id === nodeDraft.id,
  );

  if (!cleanedNodeDraft) return { nodeDraft, touched: false };

  return {
    nodeDraft: cleanedNodeDraft,
    touched: cleanedNodeDraft !== nodeDraft,
  };
}

function findHotspotInNodeDraft(
  nodeDraft: Node,
  layerId: ID,
  hotspotId: ID,
): Hotspot | null {
  const layer = nodeDraft.layers.find((entry) => entry.id === layerId);
  return layer?.hotspots?.find((entry) => entry.id === hotspotId) ?? null;
}

function ruleIdExistsInRules(
  rules: InteractionRules | undefined,
  ruleId: ID | null | undefined,
): boolean {
  if (!ruleId) return false;

  return (
    (rules?.onClick ?? []).some((rule) => rule.id === ruleId) ||
    (rules?.onUseItem ?? []).some((rule) => rule.id === ruleId)
  );
}

function syncHotspotEditorAfterHotspotVarDelete(
  editor: HotspotEditorState,
  cleanedHotspot: Hotspot,
): HotspotEditorState {
  const selectedRuleId = editor.selection?.selectedRuleId ?? null;

  const nextSelectedRuleId = ruleIdExistsInRules(cleanedHotspot.rules, selectedRuleId)
    ? selectedRuleId
    : null;

  return {
    ...editor,
    draft: cleanedHotspot,
    selection: editor.selection
      ? {
        ...editor.selection,
        hotspotId: cleanedHotspot.id,
        selectedRuleId: nextSelectedRuleId,
      }
      : editor.selection,
  };
}

function removeHotspotFromNodeDraft(
  nodeDraft: Node,
  layerId: ID,
  hotspotId: ID,
): { nodeDraft: Node; touched: boolean } {
  let touched = false;

  const nextLayers = (nodeDraft.layers ?? []).map((layer) => {
    if (layer.id !== layerId) return layer;

    const currentHotspots = layer.hotspots ?? [];
    const nextHotspots = currentHotspots.filter(
      (hotspot) => hotspot.id !== hotspotId,
    );

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

function hotspotEditorTargetsDeletedHotspot(
  editor: HotspotEditorState,
  target: { layerId: ID; hotspotId: ID },
): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsHotspot =
    editor.mode.type === "editing" &&
    editor.mode.hotspotId === target.hotspotId;

  return (
    modeTargetsHotspot ||
    editor.selection?.hotspotId === target.hotspotId ||
    editor.draft?.id === target.hotspotId
  );
}

function placedItemEditorTargetsDeletedPlacedItem(
  editor: PlacedItemEditorState,
  target: { layerId: ID; placedItemId: ID },
): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedItem =
    editor.mode.type === "editing" &&
    editor.mode.placedItemId === target.placedItemId;

  return (
    modeTargetsPlacedItem ||
    editor.selection?.placedItemId === target.placedItemId ||
    editor.draft?.itemInstanceId === target.placedItemId
  );
}

function placedNpcEditorTargetsDeletedPlacedNpc(
  editor: PlacedNpcEditorState,
  target: { layerId: ID; npcId: ID },
): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedNpc =
    editor.mode.type === "editing" &&
    editor.mode.npcId === target.npcId;

  return (
    modeTargetsPlacedNpc ||
    editor.selection?.npcId === target.npcId ||
    editor.draft?.npcId === target.npcId
  );
}

function placedPlayerEditorTargetsDeletedPlacedPlayer(
  editor: PlacedPlayerEditorState,
  target: { layerId: ID; playerId: ID },
): boolean {
  if (editor.context?.layerId !== target.layerId) return false;

  const modeTargetsPlacedPlayer =
    editor.mode.type === "editing" &&
    editor.mode.playerId === target.playerId;

  return (
    modeTargetsPlacedPlayer ||
    editor.selection?.playerId === target.playerId ||
    editor.draft?.playerId === target.playerId
  );
}

function dialogueEditorTargetsDeletedDialogue(
  editor: DialogueEditorState,
  target: { nodeId: ID; dialogueId: ID },
): boolean {
  if (editor.context?.nodeId && editor.context.nodeId !== target.nodeId) return false;

  const modeTargetsDialogue =
    editor.mode.type === "editing" &&
    editor.mode.dialogueId === target.dialogueId;

  return (
    modeTargetsDialogue ||
    editor.selection.selectedDialogueId === target.dialogueId ||
    editor.dialogueDraft?.id === target.dialogueId
  );
}

function shouldResetNodeEditor(
  state: EditorStoreLike,
  target: DeleteTarget,
): boolean {
  if (target.kind !== "node") return false;

  return (
    state.selectedNodeId === target.nodeId ||
    state.editingNodeId === target.nodeId ||
    state.nodeDraft?.id === target.nodeId
  );
}

function shouldResetMapRegionEditor(
  editor: MapRegionEditorState,
  target: DeleteTarget,
): boolean {
  if (target.kind === "map") {
    return editor.mapId === target.mapId;
  }

  if (target.kind === "mapRegion") {
    return (
      editor.mapId === target.mapId &&
      (
        editor.selectedRegionId === target.regionId ||
        editor.draft?.id === target.regionId
      )
    );
  }

  if (target.kind === "node") {
    return (
      editor.draft?.entrySceneId === target.nodeId ||
      Boolean(editor.draft?.sceneIds.includes(target.nodeId))
    );
  }

  return false;
}

export function createEditorDeleteSlice(
  set: (
    partial:
      | Partial<EditorStoreLike>
      | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)
  ) => void,
  get: () => EditorStoreLike,
): EditorDeleteSlice {
  return {
    pendingDeleteImpact: null,

    pendingDeleteTarget: null,

    lastDeleteDiagnostics: null,

    requestDelete: (target) => {
      const { project } = get();
      if (!project) return;

      const impact = analyzeDeleteImpact(project, target);

      if (impact.entries.length === 0) {
        set((state) => applyDeleteToState(state, target));
        return;
      }

      set({
        pendingDeleteImpact: impact,
        pendingDeleteTarget: target,
        lastDeleteDiagnostics: null,
      });
    },

    cancelPendingDelete: () => {
      set({
        pendingDeleteImpact: null,
        pendingDeleteTarget: null,
      });
    },

    confirmPendingDelete: () => {
      const target = get().pendingDeleteTarget;
      if (!target) return;

      set((state) => applyDeleteToState(state, target));
    },

    clearLastDeleteDiagnostics: () => {
      set({ lastDeleteDiagnostics: null });
    },
  };
}