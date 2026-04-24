import type { ID, Node, Project, NodeMapLocation, NodeMeta } from "@/domain/types";
import { createDefaultNodeMeta, deepClonePojo, safeTrim } from "@/features/editor/core/editorGenericSlice";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { initialHotspotEditorState } from "@/features/editor/scene/interactiveComponents/interactiveEditorHelpers";
import {
  cleanupUnusedBackgroundAssets, computeNewNodeFallbackLayout, createEmptyDraftNode, ensureDraftHasLayout, indexNodeIssues, reconcileNodeMapEntries,
  reconcileRegionEntryAfterNodeDeletion, rebuildMapsFromNodes, sameMapLocation, validateNodeDraft,
  type NodeValidationIssue
} from "@/features/editor/scene/node/editorNodeHelpersSlice";

export type NodeMode = "creating" | "editing";

type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
};

export interface EditorNodesSlice {
  nodeMode: NodeMode;
  selectedNodeId: ID | null;
  editingNodeId: ID | null;
  nodeDraft: Node | null;
  nodeIssues: NodeValidationIssue[];

  getActiveNode: () => Node | null;
  getNodeIssueIndex: () => Record<string, NodeValidationIssue>;
  enterCreateNodeMode: () => void;
  enterEditNodeMode: (nodeId: ID) => void;
  cancelNodeDraft: () => void;
  setSelectedNodeId: (id: ID | null) => void;

  setNodeTitle: (title: string) => void;
  setNodeIsStart: (value: boolean) => void;
  setNodeIsFinal: (value: boolean) => void;
  setNodeMusicTrackId: (musicTrackId: ID | null | undefined) => void;
  setNodeMapLocation: (loc: NodeMapLocation | null | undefined) => void;
  setNodeLayout: (nodeId: ID, layout: { x: number; y: number }) => void;

  getSceneTestNodeId: () => ID | null;
  canOpenSceneTest: () => boolean;

  validateActiveNode: () => boolean;
  commitNode: () => { id: ID; title: string; mode: NodeMode } | null;
  deleteNode: (nodeId: ID) => { deletedId: ID; deletedWasStart: boolean } | null;
  clearNodeIssues: () => void;
}

type Store = EditorStoreLike & EditorNodesSlice;

export function createEditorNodesSlice(set: (partial: Partial<Store> | ((state: Store) => Partial<Store> | Store)) => void, get: () => Store): EditorNodesSlice {
  const commitCreate = (): { id: ID; title: string; mode: NodeMode } | null => {
    const state = get();
    const project = state.project;
    const draft0 = state.nodeDraft;
    if (!project || !draft0) return null;

    const nodes0 = project.nodes ?? [];
    const fallbackLayout = computeNewNodeFallbackLayout(nodes0);
    const draft = ensureDraftHasLayout(draft0, fallbackLayout);

    const issues = validateNodeDraft({ draft, project, editingId: null });

    if (issues.length) {
      set({ nodeIssues: issues });
      return null;
    }

    const id = draft.id;
    const title = safeTrim(draft.title);

    const hasStartAlready = nodes0.some((node) => Boolean(node.isStart));
    const willBeFinal = Boolean(draft.isFinal);
    const autoStart = !hasStartAlready && !willBeFinal;

    const newNodeBase: Node = {
      ...draft,
      id,
      title,
      layers: deepClonePojo(draft.layers ?? []),
      dialogues: deepClonePojo(draft.dialogues ?? []),
      meta: draft.meta ?? createDefaultNodeMeta(),
      musicTrackId: draft.musicTrackId || undefined,
      mapLocation: draft.mapLocation || undefined,
      isFinal: willBeFinal ? true : undefined,
      isStart: willBeFinal ? undefined : draft.isStart ? true : autoStart ? true : undefined,
    };

    const newNode = ensureDraftHasLayout(newNodeBase, fallbackLayout);

    let nextNodes = [...nodes0, newNode];

    if (newNode.isStart) {
      nextNodes = nextNodes.map((node) =>
        node.id === newNode.id
          ? { ...node, isStart: true }
          : { ...node, isStart: false }
      );
    }

    if (newNode.isFinal) {
      nextNodes = nextNodes.map((node) =>
        node.id === newNode.id
          ? { ...node, isFinal: true }
          : { ...node, isFinal: false }
      );
    }

    nextNodes = reconcileNodeMapEntries(nextNodes, newNode.id);
    const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

    set((currentState) => ({
      ...currentState,
      project: { ...project, nodes: nextNodes, maps: nextMaps },
      selectedNodeId: id,
      nodeMode: "editing",
      editingNodeId: id,
      nodeDraft: deepClonePojo(newNode),
      nodeIssues: [],
    }));

    return { id, title, mode: "creating" };
  };

  const commitEdit = (): { id: ID; title: string; mode: NodeMode } | null => {
    const state = get();
    const project = state.project;
    const draft0 = state.nodeDraft;
    const editingId = state.editingNodeId;
    if (!project || !draft0 || !editingId) return null;

    const nodes0 = project.nodes ?? [];
    const prev = nodes0.find((node) => node.id === editingId);
    if (!prev) return null;

    const prevLayout = prev.meta?.layout;
    const draftMeta = draft0.meta ?? prev.meta ?? createDefaultNodeMeta();

    const nextMeta = prevLayout &&
      (!draftMeta?.layout ||
        !Number.isFinite(draftMeta.layout.x) ||
        !Number.isFinite(draftMeta.layout.y))
      ? { ...draftMeta, layout: prevLayout }
      : draftMeta;

    const draft: Node = { ...draft0, id: editingId, meta: nextMeta };

    const issues = validateNodeDraft({ draft, project, editingId });

    if (issues.length) {
      set({ nodeIssues: issues });
      return null;
    }

    const title = safeTrim(draft.title);

    const nextNode: Node = {
      ...prev,
      title,
      layers: deepClonePojo(draft.layers ?? prev.layers ?? []),
      dialogues: deepClonePojo(draft.dialogues ?? prev.dialogues ?? []),
      musicTrackId: draft.musicTrackId || undefined,
      mapLocation: draft.mapLocation || undefined,
      isStart: draft.isStart || undefined,
      isFinal: draft.isFinal || undefined,
      meta: nextMeta,
    };

    let nextNodes = nodes0.map((node) => node.id === editingId ? nextNode : node);

    if (nextNode.isStart) {
      nextNodes = nextNodes.map((node) => node.id === editingId ? node : { ...node, isStart: false });
    }

    if (nextNode.isFinal) {
      nextNodes = nextNodes.map((node) => node.id === editingId ? node : { ...node, isFinal: false });
    }

    nextNodes = reconcileNodeMapEntries(nextNodes, nextNode.id, prev.mapLocation);
    const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

    const cleaned = cleanupUnusedBackgroundAssets({
      project: { ...project, nodes: nextNodes, maps: nextMaps },
      assetFiles: state.assetFiles,
      nodes: nextNodes,
    });

    set((currentState) => ({
      ...currentState,
      project: cleaned.project,
      assetFiles: cleaned.assetFiles,
      selectedNodeId: editingId,
      nodeDraft: deepClonePojo(nextNode),
      nodeIssues: [],
      nodeMode: "editing",
      editingNodeId: editingId,
    }));

    return { id: editingId, title, mode: "editing" };
  };

  return {
    nodeMode: "creating",

    selectedNodeId: null,

    editingNodeId: null,

    nodeDraft: null,

    nodeIssues: [],

    getActiveNode: () => {
      const state = get();

      if (state.nodeDraft) return state.nodeDraft;

      const project = state.project;
      if (!project) return null;

      const id = state.selectedNodeId;
      if (!id) return null;

      return (project.nodes ?? []).find((node) => node.id === id) ?? null;
    },

    getNodeIssueIndex: () => indexNodeIssues(get().nodeIssues),

    enterCreateNodeMode: () => {
      const draft = createEmptyDraftNode();
      const project = get().project;
      const nodes0 = project?.nodes ?? [];
      const fallbackLayout = computeNewNodeFallbackLayout(nodes0);
      const nextDraft = ensureDraftHasLayout(draft, fallbackLayout);

      set((state) => ({
        ...state,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: nextDraft,
        nodeIssues: [],
        activeLayerId: null,
        hotspotEditor: initialHotspotEditorState,
        selectedInteractionKind: null,
        selectedInteractionId: null,
      }));
    },

    enterEditNodeMode: (nodeId) => {
      set((state) => {
        const project = state.project;
        if (!project) return state;

        const node = (project.nodes ?? []).find((entry) => entry.id === nodeId);
        if (!node) return state;

        return {
          ...state,
          nodeMode: "editing",
          selectedNodeId: nodeId,
          editingNodeId: nodeId,
          nodeDraft: deepClonePojo(node),
          nodeIssues: [],
          activeLayerId: null,
          hotspotEditor: initialHotspotEditorState,
          selectedInteractionKind: null,
          selectedInteractionId: null,
        };
      });
    },

    cancelNodeDraft: () =>
      set((state) => ({
        ...state,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: null,
        nodeIssues: [],
        activeLayerId: null,
        hotspotEditor: initialHotspotEditorState,
        selectedInteractionKind: null,
        selectedInteractionId: null,
      })),

    setSelectedNodeId: (id) => set({ selectedNodeId: id }),

    setNodeTitle: (title) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextTitle = typeof title === "string" ? title : "";
        if (state.nodeDraft.title === nextTitle) return state;

        return {
          ...state,
          nodeDraft: { ...state.nodeDraft, title: nextTitle },
        };
      }),

    setNodeIsStart: (value) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextIsStart = Boolean(value) ? true : undefined;
        if (Boolean(state.nodeDraft.isStart) === Boolean(nextIsStart)) return state;

        const nextIsFinal = nextIsStart ? undefined : state.nodeDraft.isFinal;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            isStart: nextIsStart,
            isFinal: nextIsFinal,
          },
        };
      }),

    setNodeIsFinal: (value) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextIsFinal = Boolean(value) ? true : undefined;
        if (Boolean(state.nodeDraft.isFinal) === Boolean(nextIsFinal)) return state;

        const nextIsStart = nextIsFinal ? undefined : state.nodeDraft.isStart;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            isFinal: nextIsFinal,
            isStart: nextIsStart,
          },
        };
      }),

    setNodeMusicTrackId: (musicTrackId) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextMusicTrackId = typeof musicTrackId === "string" && musicTrackId.trim() ? musicTrackId : undefined;

        if (state.nodeDraft.musicTrackId === nextMusicTrackId) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            musicTrackId: nextMusicTrackId,
          },
        };
      }),

    setNodeMapLocation: (loc) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextMapLocation = loc ?? undefined;
        if (sameMapLocation(state.nodeDraft.mapLocation, nextMapLocation)) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            mapLocation: nextMapLocation,
          },
        };
      }),

    setNodeLayout: (nodeId, layout) =>
      set((state) => {
        const project = state.project;
        if (!project) return state;

        const nodes0 = project.nodes ?? [];
        const index = nodes0.findIndex((node) => node.id === nodeId);
        if (index < 0) return state;

        const prev = nodes0[index]!;
        const meta0 = prev.meta ?? createDefaultNodeMeta();
        const nextMeta: NodeMeta = {
          ...meta0,
          layout: { x: layout.x, y: layout.y },
        };

        const nextNodes = nodes0.slice();
        nextNodes[index] = { ...prev, meta: nextMeta };

        const nextDraft = state.nodeDraft && state.editingNodeId === nodeId
          ? { ...state.nodeDraft, meta: nextMeta }
          : state.nodeDraft;

        return {
          ...state,
          project: { ...project, nodes: nextNodes },
          nodeDraft: nextDraft,
        };
      }),

    getSceneTestNodeId: () => {
      const state = get();
      const project = state.project;
      if (!project) return null;

      const candidates = [state.selectedNodeId, state.editingNodeId].filter(Boolean) as ID[];

      for (const id of candidates) {
        const exists = (project.nodes ?? []).some((node) => node.id === id);
        if (exists) return id;
      }

      return null;
    },

    canOpenSceneTest: () => {
      return get().getSceneTestNodeId() != null;
    },

    validateActiveNode: () => {
      const state = get();
      const project = state.project;
      const draft = state.nodeDraft;

      if (!draft) {
        set({ nodeIssues: [] });
        return true;
      }

      const issues = validateNodeDraft({ draft, project, editingId: state.editingNodeId });

      if (issues.length === 0) {
        set({ nodeIssues: [] });
        return true;
      }

      set({ nodeIssues: issues });
      return false;
    },

    commitNode: () => {
      const state = get();
      if (!state.project || !state.nodeDraft) return null;

      if (state.nodeMode === "editing" && state.editingNodeId) return commitEdit();

      return commitCreate();
    },

    deleteNode: (nodeId) => {
      const state = get();
      const project = state.project;
      if (!project) return null;

      const nodes0 = project.nodes ?? [];
      const node = nodes0.find((entry) => entry.id === nodeId) ?? null;
      if (!node) return null;

      const deletedWasStart = Boolean(node.isStart);
      let nextNodes = nodes0.filter((entry) => entry.id !== nodeId);

      if (deletedWasStart && nextNodes.length > 0) {
        const firstId = nextNodes[0]!.id;
        nextNodes = nextNodes.map((entry) => entry.id === firstId
          ? { ...entry, isStart: true }
          : { ...entry, isStart: false }
        );
      }

      nextNodes = reconcileRegionEntryAfterNodeDeletion(nextNodes, node.mapLocation);
      const nextMaps = rebuildMapsFromNodes(project.maps ?? [], nextNodes);

      const cleaned = cleanupUnusedBackgroundAssets({
        project: { ...project, nodes: nextNodes, maps: nextMaps },
        assetFiles: state.assetFiles,
        nodes: nextNodes,
      });

      set((currentState) => {
        const draftKilled = currentState.editingNodeId === nodeId;
        const selectedKilled = currentState.selectedNodeId === nodeId;

        return {
          ...currentState,
          project: cleaned.project,
          assetFiles: cleaned.assetFiles,
          selectedNodeId: selectedKilled ? null : currentState.selectedNodeId,
          nodeMode: draftKilled ? "creating" : currentState.nodeMode,
          editingNodeId: draftKilled ? null : currentState.editingNodeId,
          nodeDraft: draftKilled ? null : currentState.nodeDraft,
          nodeIssues: [],
          activeLayerId: draftKilled || selectedKilled ? null : currentState.activeLayerId,
          hotspotEditor: draftKilled || selectedKilled ? initialHotspotEditorState : currentState.hotspotEditor,
          selectedInteractionKind: draftKilled || selectedKilled ? null : currentState.selectedInteractionKind,
          selectedInteractionId: draftKilled || selectedKilled ? null : currentState.selectedInteractionId,
        };
      });

      return { deletedId: nodeId, deletedWasStart };
    },

    clearNodeIssues: () => set({ nodeIssues: [] }),
  };
}