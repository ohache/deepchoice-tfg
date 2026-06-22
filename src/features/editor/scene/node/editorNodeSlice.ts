import type { ID, Node, Project, NodeMapLocation } from "@/domain/types";
import type { DeleteTarget } from "@/features/editor/delete/deleteTypes";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { NodeFieldErrors } from "@/features/editor/scene/node/nodeValidator";
import { deepClonePojo, safeTrim } from "@/features/editor/core/editorDataUtils";
import { cleanupUnusedBackgroundAssets, createEmptyDraftNode, reconcileNodeMapEntries, rebuildMapsFromNodes,
  sameMapLocation, normalizeOptionalId, resetInteractionState, buildNodeFromDraft, buildNodeFromEditDraft} from "@/features/editor/scene/node/NodeHelpers";
import { ensureNodeHasLayoutPure, computeNewNodeFallbackLayout, hasValidLayout } from "@/features/editor/history/view/nodeLayout";

type NodeMode = "creating" | "editing";

const emptyNodeErrors: NodeFieldErrors = {};

/* Mínimo contrato del store que necesita este slice */
type EditorStoreLike = {
  project: Project | null;
  assetFiles: Record<ID, File>;
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
  nodeMode: NodeMode;
  selectedNodeId: ID | null;
  editingNodeId: ID | null;
  nodeDraft: Node | null;
  nodeErrors: NodeFieldErrors;
  requestDelete: (target: DeleteTarget) => void;
};

export interface EditorNodesSlice {
  nodeMode: NodeMode;
  selectedNodeId: ID | null;
  editingNodeId: ID | null;
  nodeDraft: Node | null;
  nodeErrors: NodeFieldErrors;
  enterCreateNodeMode: () => void;
  enterEditNodeMode: (nodeId: ID) => void;
  cancelNodeDraft: () => void;
  setNodeErrors: (errors: NodeFieldErrors) => void;
  setNodeTitle: (title: string) => void;
  setNodeIsStart: (value: boolean) => void;
  setNodeIsFinal: (value: boolean) => void;
  setNodeMusicTrackId: (musicTrackId: ID | null | undefined) => void;
  setNodeMapLocation: (loc: NodeMapLocation | null | undefined) => void;
  commitNode: () => { id: ID; title: string; mode: NodeMode } | null;
  deleteNode: (nodeId: ID) => { deletedId: ID; deletedWasStart: boolean } | null;
  clearNodeErrors: () => void;
}

export function createEditorNodesSlice(set: (partial: Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorNodesSlice {
  const commitCreate = (): { id: ID; title: string; mode: NodeMode } | null => {
    const state = get();
    const project = state.project;
    const draft0 = state.nodeDraft;

    if (!project || !draft0) return null;

    const nodes0 = project.nodes ?? [];
    const fallbackLayout = computeNewNodeFallbackLayout(nodes0);
    const draft = ensureNodeHasLayoutPure(draft0, fallbackLayout);

    const id = draft.id;
    const title = safeTrim(draft.title);

    const hasStartAlready = nodes0.some((node) => Boolean(node.isStart));
    const willBeFinal = Boolean(draft.isFinal);
    const autoStart = !hasStartAlready && !willBeFinal;

    const newNode = buildNodeFromDraft({ draft, id: draft.id, fallbackLayout, autoStart });

    let nextNodes = [...nodes0, newNode];

    if (newNode.isStart) {
      nextNodes = nextNodes.map((node) => node.id === newNode.id
          ? { ...node, isStart: true }
          : { ...node, isStart: false },
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
      nodeErrors: emptyNodeErrors,
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
    const draftMeta = draft0.meta ?? prev.meta ?? {};

    const nextMeta = prevLayout && !hasValidLayout(draftMeta) ? { ...draftMeta, layout: prevLayout } : draftMeta;

    const draft: Node = { ...draft0, id: editingId, meta: nextMeta };

    const title = safeTrim(draft.title);

    const nextNode = buildNodeFromEditDraft({ prev, draft, nextMeta});
    let nextNodes = nodes0.map((node) => node.id === editingId ? nextNode : node);

    if (nextNode.isStart) nextNodes = nextNodes.map((node) => node.id === editingId ? node : { ...node, isStart: false });

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
      nodeMode: "editing",
      editingNodeId: editingId,
      nodeDraft: deepClonePojo(nextNode),
      nodeErrors: emptyNodeErrors,
    }));

    return { id: editingId, title, mode: "editing" };
  };

  return {
    nodeMode: "creating",

    selectedNodeId: null,

    editingNodeId: null,

    nodeDraft: null,

    nodeErrors: emptyNodeErrors,

    /* Inicia la creación de una nueva escena */
    enterCreateNodeMode: () => {
      const project = get().project;
      const nodes0 = project?.nodes ?? [];

      const fallbackLayout = computeNewNodeFallbackLayout(nodes0);
      const draft = ensureNodeHasLayoutPure(createEmptyDraftNode(), fallbackLayout);

      set((state) => ({
        ...state,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: draft,
        nodeErrors: emptyNodeErrors,
        ...resetInteractionState(),
      }));
    },

    /* Carga una escena existente */
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
          nodeErrors: emptyNodeErrors,
          ...resetInteractionState(),
        };
      });
    },

    /* Cancela la edición/creación actual */
    cancelNodeDraft: () =>
      set((state) => ({
        ...state,
        nodeMode: "creating",
        selectedNodeId: null,
        editingNodeId: null,
        nodeDraft: null,
        nodeErrors: emptyNodeErrors,
        ...resetInteractionState(),
      })),

    /* Guarda los errores de validación de la escena */
    setNodeErrors: (errors) => set({ nodeErrors: errors }),

    /* Actualiza el título */
    setNodeTitle: (title) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextTitle = typeof title === "string" ? title : "";

        if (state.nodeDraft.title === nextTitle) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            title: nextTitle,
          },
        };
      }),

    /* Marca o desmarca la opción de escena inicial */
    setNodeIsStart: (value) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextIsStart = value ? true : undefined;

        if (Boolean(state.nodeDraft.isStart) === Boolean(nextIsStart)) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            isStart: nextIsStart,
            isFinal: nextIsStart ? undefined : state.nodeDraft.isFinal,
          },
        };
      }),

    /* Marca o desmarca la opción de escena final */
    setNodeIsFinal: (value) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextIsFinal = value ? true : undefined;

        if (Boolean(state.nodeDraft.isFinal) === Boolean(nextIsFinal)) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            isFinal: nextIsFinal,
            isStart: nextIsFinal ? undefined : state.nodeDraft.isStart,
          },
        };
      }),

    /* Asigna o elimina la música asociada a la escena */
    setNodeMusicTrackId: (musicTrackId) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextMusicTrackId = normalizeOptionalId(musicTrackId);

        if (state.nodeDraft.musicTrackId === nextMusicTrackId) return state;

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            musicTrackId: nextMusicTrackId,
          },
        };
      }),

    /* Asigna o elimina la región de mapa a la escena */
    setNodeMapLocation: (loc) =>
      set((state) => {
        if (!state.nodeDraft) return state;

        const nextMapLocation = loc ?? undefined;

        if (sameMapLocation(state.nodeDraft.mapLocation, nextMapLocation)) {
          return state;
        }

        return {
          ...state,
          nodeDraft: {
            ...state.nodeDraft,
            mapLocation: nextMapLocation,
          },
        };
      }),

    /* Guarda el draft actual, creando o editando la escena */
    commitNode: () => {
      const state = get();

      if (!state.project || !state.nodeDraft) return null;

      if (state.nodeMode === "editing" && state.editingNodeId) {
        return commitEdit();
      }

      return commitCreate();
    },

    /* Solicita el borrado de la escena */
    deleteNode: (nodeId) => {
       const { project, requestDelete } = get();

      if (!project) return null;

      const node = (project.nodes ?? []).find((entry) => entry.id === nodeId);
      if (!node) return null;

      const deletedWasStart = Boolean(node.isStart);

      requestDelete({ kind: "node", nodeId });

      return { deletedId: nodeId, deletedWasStart };
    },

    /* Limpia los errores de validación de la escena */
    clearNodeErrors: () => set({ nodeErrors: emptyNodeErrors }),
  };
}