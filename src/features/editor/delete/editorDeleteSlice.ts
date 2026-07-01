import type { DeleteImpactReport, DeleteTarget, ProjectDiagnostics } from "@/features/editor/delete/deleteTypes";
import { analyzeDeleteImpact } from "@/features/editor/delete/deleteImpactAnalyzer";
import { applyDeleteWithCleanup } from "@/features/editor/delete/deleteReferenceCleaner";
import { diagnoseProject } from "@/features/editor/delete/projectDiagnostics";
import { createEmptyDialogueEditorState } from "@/features/editor/scene/dialogues/dialogueHelpers";
import { initialHotspotEditorState, initialPlacedItemEditorState, initialPlacedNpcEditorState,
  initialPlacedPlayerEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import { initialMapRegionEditorState, nextSelectedAfterRemoval } from "@/features/editor/history/shared/genericHelpers";
import { applyDeleteToNodeDraft, buildLayerDeleteStatePatch, collectRemovedAssetFileIds, dialogueEditorTargetsDeletedDialogue, findHotspotInNodeDraft,
  hotspotEditorTargetsDeletedHotspot, placedItemEditorTargetsDeletedPlacedItem, placedNpcEditorTargetsDeletedPlacedNpc,
  placedPlayerEditorTargetsDeletedPlacedPlayer, removeAssetFilesByIds, removeHotspotFromNodeDraft, shouldResetMapRegionEditor,
  shouldResetNodeEditor, syncHotspotEditorAfterHotspotVarDelete, type EditorDeleteStateLike as EditorStoreLike } from "@/features/editor/delete/editorDeleteHelpers";

export interface EditorDeleteSlice {
  pendingDeleteImpact: DeleteImpactReport | null;
  pendingDeleteTarget: DeleteTarget | null;
  lastDeleteDiagnostics: ProjectDiagnostics | null;

  requestDelete: (target: DeleteTarget) => void;
  cancelPendingDelete: () => void;
  confirmPendingDelete: () => void;
  clearLastDeleteDiagnostics: () => void;
};

function applyDeleteToState(state: EditorStoreLike, target: DeleteTarget): EditorStoreLike {
  if (!state.project) return state;

  const nextProject = applyDeleteWithCleanup(state.project, target);
  const assetFileIdsToRemove = collectRemovedAssetFileIds(state.project, nextProject);
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
    const result = removeHotspotFromNodeDraft(state.nodeDraft, target.layerId, target.hotspotId);

    if (result.touched) {
      nextNodeDraft = result.nodeDraft;
      nextNodeErrors = {};

      if (hotspotEditorTargetsDeletedHotspot(state.hotspotEditor, target)) nextHotspotEditor = initialHotspotEditorState;

      if (state.selectedInteractionKind === "hotspot" && state.selectedInteractionId === target.hotspotId) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (state.pendingInteractiveOpen?.kind === "hotspot" && state.pendingInteractiveOpen.id === target.hotspotId) {
        nextPendingInteractiveOpen = null;
      }
    }
  }

  if (target.kind === "hotspotVar" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(state.project, state.nodeDraft, target);

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (hotspotEditorTargetsDeletedHotspot(state.hotspotEditor, target)) {
        const cleanedHotspot = findHotspotInNodeDraft(draftResult.nodeDraft, target.layerId, target.hotspotId);
        nextHotspotEditor = cleanedHotspot ? syncHotspotEditorAfterHotspotVarDelete(state.hotspotEditor, cleanedHotspot) : initialHotspotEditorState;
      }
    }
  }

  if (target.kind === "placedItem" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(state.project, state.nodeDraft, target);

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedItemEditorTargetsDeletedPlacedItem(state.placedItemEditor, target)) nextPlacedItemEditor = initialPlacedItemEditorState;

      if (state.selectedInteractionKind === "placedItem" && state.selectedInteractionId === target.placedItemId) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (state.pendingInteractiveOpen?.kind === "placedItem" && state.pendingInteractiveOpen.id === target.placedItemId) nextPendingInteractiveOpen = null;
    }
  }

  if (target.kind === "placedPlayer" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(state.project, state.nodeDraft, target);

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedPlayerEditorTargetsDeletedPlacedPlayer(state.placedPlayerEditor, target)) nextPlacedPlayerEditor = initialPlacedPlayerEditorState;

      if (state.selectedInteractionKind === "placedPlayer" && state.selectedInteractionId === target.playerId) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (state.pendingInteractiveOpen?.kind === "placedPlayer" && state.pendingInteractiveOpen.id === target.playerId) nextPendingInteractiveOpen = null;
    }
  }

  if (target.kind === "placedNpc" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(state.project, state.nodeDraft, target);

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (placedNpcEditorTargetsDeletedPlacedNpc(state.placedNpcEditor, target)) nextPlacedNpcEditor = initialPlacedNpcEditorState;

      if (state.selectedInteractionKind === "placedNpc" && state.selectedInteractionId === target.npcId) {
        nextSelectedInteractionKind = null;
        nextSelectedInteractionId = null;
      }

      if (state.pendingInteractiveOpen?.kind === "placedNpc" && state.pendingInteractiveOpen.id === target.npcId) nextPendingInteractiveOpen = null;
    }
  }

  if (target.kind === "dialogue" && state.nodeDraft?.id === target.nodeId) {
    const draftResult = applyDeleteToNodeDraft(state.project, state.nodeDraft, target);

    if (draftResult.touched) {
      nextNodeDraft = draftResult.nodeDraft;
      nextNodeErrors = {};

      if (dialogueEditorTargetsDeletedDialogue(state.dialogueEditor, target)) nextDialogueEditor = createEmptyDialogueEditorState();
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

export function createEditorDeleteSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorDeleteSlice {
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