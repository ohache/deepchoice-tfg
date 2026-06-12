import type { ID, Project, Node } from "@/domain/types";
import { analyzeDeleteImpact } from "@/features/editor/delete/deleteImpactAnalyzer";
import type { DeleteImpactReport, DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { MapRegionEditorState } from "@/features/editor/history/maps/mapEditorTypes";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { LayerToggleFieldId } from "../scene/SceneCommon";
import type { PlacedItemEditorState } from "../scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcEditorState } from "../scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerEditorState } from "../scene/placedPlayers/placedPlayerEditorTypes";

type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;

  selectedPlayerId: ID | null;
  selectedNpcId: ID | null;
  selectedItemId: ID | null;
  selectedMusicTrackId: ID | null;
  selectedSfxId: ID | null;
  selectedMapId: ID | null;

  mapRegionEditor: MapRegionEditorState;

  editingNodeId: ID | null;
  selectedNodeId: ID | null;
  nodeMode: "creating" | "editing";
  nodeDraft: Node | null;

  activeLayerId: ID | null;
  activeTextEntryId: ID | null;
  
  hotspotEditor: HotspotEditorState;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;

  activeLayerField: LayerToggleFieldId | null;

  placedItemEditor: PlacedItemEditorState;
  placedNpcEditor: PlacedNpcEditorState;
  placedPlayerEditor: PlacedPlayerEditorState;

  layerEditSession: { mode: "idle" } | {
    mode: "editing";
    layerId: ID;
    isNew: boolean;
    snapshot: Node["layers"][number];
  };

  pendingInteractiveOpen: {
    kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer";
    id: ID;
  } | null;

  pendingDeleteImpact: DeleteImpactReport | null;
  pendingDeleteApply: DeleteApplyFn | null;
};

export type DeleteApplyFn = (state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike;

export interface EditorDeleteSlice {
  pendingDeleteImpact: DeleteImpactReport | null;
  pendingDeleteApply: DeleteApplyFn | null;

  requestDelete: (input: {
    target: DeleteTarget;
    apply: DeleteApplyFn;
  }) => void;

  cancelPendingDelete: () => void;
  confirmPendingDelete: () => void;
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
    pendingDeleteApply: null,

    requestDelete: ({ target, apply }) => {
      const { project } = get();
      if (!project) return;

      const impact = analyzeDeleteImpact(project, target);

      if (impact.entries.length === 0) {
        set((state) => apply(state));
        return;
      }

      set({
        pendingDeleteImpact: impact,
        pendingDeleteApply: apply,
      });
    },

    cancelPendingDelete: () => {
      set({
        pendingDeleteImpact: null,
        pendingDeleteApply: null,
      });
    },

    confirmPendingDelete: () => {
      const apply = get().pendingDeleteApply;
      if (!apply) return;

      set((state) => ({
        ...apply(state),
        pendingDeleteImpact: null,
        pendingDeleteApply: null,
      }));
    },
  };
}