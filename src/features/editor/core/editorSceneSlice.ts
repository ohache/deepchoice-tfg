import type { ID, Node, Hotspot } from "@/domain/types";
import { generateNodeId, generateHotspotId } from "@/utils/id";

export type SceneMode = "creating" | "editing";
export type NodeDraft = Omit<Node, "id">;

const createEmptyDraft = (): NodeDraft => ({
  title: "",
  text: "",
  image: undefined,
  hotspots: [],
  musicId: undefined,
  npcIds: [],
  featuredItemId: undefined,
  mapId: undefined,
  isStart: false,
  isFinal: false,
  meta: {},
});

export interface EditorSceneSlice {
  selectedNodeId: ID | null;
  sceneMode: SceneMode;
  draftScene: NodeDraft;

  enterCreateMode: () => void;
  selectNode: (id: ID) => void;
  updateDraftFields: (patch: Partial<NodeDraft>) => void;
  commitDraftAsNode: () => void;
  updateSelectedNodeFields: (patch: Partial<Node>) => void;

  addHotspotToActiveScene: () => void;
  updateHotspotTargetForActiveScene: (hotspotId: ID, targetNodeId: ID) => void;
  removeHotspotFromActiveScene: (hotspotId: ID) => void;

  deleteSelectedNode: () => void;
}

export function createEditorSceneSlice(set: any, get: any): EditorSceneSlice {
  const getProject = () => {
    const state = get();
    return (state.project as { nodes: Node[] } | null) ?? null;
  };

  const getProjectAndSelectedNode = () => {
    const state = get();
    const project = getProject();
    const selectedNodeId = state.selectedNodeId as ID | null;
    return { project, selectedNodeId, state };
  };

  const updateNodeHotspots = (nodes: Node[], nodeId: ID, updater: (hotspots: Hotspot[]) => Hotspot[]): Node[] => {
    return nodes.map((node) => node.id === nodeId
        ? { ...node, hotspots: updater(node.hotspots ?? []) }
        : node
    );
  };

  const updateDraftHotspots = (draft: NodeDraft, updater: (hotspots: Hotspot[]) => Hotspot[]): NodeDraft => ({
    ...draft,
    hotspots: updater(draft.hotspots ?? []),
  });

  return {
    selectedNodeId: null,
    sceneMode: "creating",
    draftScene: createEmptyDraft(),

    /* Modo crear: borrador limpio, sin escena seleccionada */
    enterCreateMode: () => {
      set((state: any) => ({
        ...state,
        sceneMode: "creating",
        selectedNodeId: null,
        draftScene: createEmptyDraft(),
      }));
    },

    /** Seleccionar nodo y pasar a edición */
    selectNode: (id: ID) => {
      const project = getProject();
      if (!project) return;

      const exists = project.nodes.some((n) => n.id === id);
      if (!exists) return;

      set((state: any) => ({
        ...state,
        selectedNodeId: id,
        sceneMode: "editing",
        draftScene: state.draftScene ?? createEmptyDraft(),
      }));
    },

    /** Actualizar borrador (modo crear) */
    updateDraftFields: (patch: Partial<NodeDraft>) => {
      set((state: any) => {
        const prevDraft: NodeDraft = state.draftScene ?? createEmptyDraft();

        let nextDraft: NodeDraft = { ...prevDraft, ...patch };

        if (patch.isStart === true) nextDraft = { ...nextDraft, isFinal: false };
        
        if (patch.isFinal === true) nextDraft = { ...nextDraft, isStart: false };
        
        return {
          ...state,
          draftScene: nextDraft,
          isDirty: true,
        };
      });
    },

    /** Crear nodo desde el borrador actual */
    commitDraftAsNode: () => {
      const project = getProject();
      if (!project) return;

      const state = get();
      const draft: NodeDraft = state.draftScene ?? createEmptyDraft();

        const trimmedTitle = draft.title.trim();
        if (!trimmedTitle) return;

        const newId = generateNodeId();

        const newNode: Node = {
            id: newId,
            title: trimmedTitle,
            text: draft.text ?? "",
            hotspots: draft.hotspots ?? [],
        };

        if (draft.image) newNode.image = draft.image;
        if (draft.musicId) newNode.musicId = draft.musicId;
        if (draft.npcIds && draft.npcIds.length > 0) newNode.npcIds = draft.npcIds;
        if (draft.featuredItemId) newNode.featuredItemId = draft.featuredItemId;
        if (draft.mapId) newNode.mapId = draft.mapId;
        if (draft.meta && Object.keys(draft.meta).length) newNode.meta = draft.meta;

        if (project.nodes.length === 0 || draft.isStart) newNode.isStart = true;
        if (draft.isFinal) newNode.isFinal = true;


      set({
        project: {
          ...project,
          nodes: [...project.nodes, newNode],
        },
        selectedNodeId: newId,
        sceneMode: "editing",
        draftScene: createEmptyDraft(),
        isDirty: true,
      });
    },

    /** Actualizar campos del nodo seleccionado (modo editar) */
    updateSelectedNodeFields: (patch: Partial<Node>) => {
      const { project, selectedNodeId } = getProjectAndSelectedNode();
      if (!project || !selectedNodeId) return;

      let updatedNodes = project.nodes.map((node) =>
        node.id === selectedNodeId ? { ...node, ...patch } : node
      );

      set({
        project: {
          ...project,
          nodes: updatedNodes,
        },
        isDirty: true,
      });
    },

    /** Añadir hotspot al borrador o al nodo seleccionado, según sceneMode */
    addHotspotToActiveScene: () => {
      const state = get();
      const project = getProject();

      const newHotspot: Hotspot = {
        id: generateHotspotId(),
        label: undefined,
        actions: [],
        conditions: [],
      };

      if (state.sceneMode === "creating") {
        const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
        const nextDraft = updateDraftHotspots(draft, (hs) => [...hs, newHotspot, ]);

        set({
          draftScene: nextDraft,
          isDirty: true,
        });
        return;
      }

      const selectedNodeId = state.selectedNodeId as ID | null;
      if (!project || !selectedNodeId) return;

      const updatedNodes = updateNodeHotspots(
        project.nodes,
        selectedNodeId,
        (hs) => [...hs, newHotspot]
      );

      set({
        project: {
          ...project,
          nodes: updatedNodes,
        },
        isDirty: true,
      });
    },

    /** Cambiar destino de un hotspot */
    updateHotspotTargetForActiveScene: (hotspotId: ID, targetNodeId: ID ) => {
      const state = get();
      const project = getProject();

      const updater = (hsList: Hotspot[]): Hotspot[] =>
        hsList.map((hs) => {
          if (hs.id !== hotspotId) return hs;

          const firstAction = hs.actions[0];
          if (!firstAction || firstAction.type !== "goToNode") {
            return {
              ...hs,
              actions: [
                {
                  type: "goToNode",
                  targetNodeId,
                },
                ...hs.actions.slice(1),
              ],
            };
          }

          return {
            ...hs,
            actions: [
              { ...firstAction, targetNodeId },
              ...hs.actions.slice(1),
            ],
          };
        });

      if (state.sceneMode === "creating") {
        const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
        const nextDraft = updateDraftHotspots(draft, updater);

        set({
          draftScene: nextDraft,
          isDirty: true,
        });
        return;
      }

      const selectedNodeId = state.selectedNodeId as ID | null;
      if (!project || !selectedNodeId) return;

      const updatedNodes = updateNodeHotspots(project.nodes, selectedNodeId, updater);

      set({
        project: {
          ...project,
          nodes: updatedNodes,
        },
        isDirty: true,
      });
    },

    /** Quitar un hotspot */
    removeHotspotFromActiveScene: (hotspotId: ID) => {
      const state = get();
      const project = getProject();

      const filterer = (hsList: Hotspot[]) =>
        hsList.filter((hs) => hs.id !== hotspotId);

      if (state.sceneMode === "creating") {
        const draft: NodeDraft = state.draftScene ?? createEmptyDraft();
        const nextDraft = updateDraftHotspots(draft, filterer);

        set({
          draftScene: nextDraft,
          isDirty: true,
        });
        return;
      }

      const selectedNodeId = state.selectedNodeId as ID | null;
      if (!project || !selectedNodeId) return;

      const updatedNodes = updateNodeHotspots(project.nodes, selectedNodeId, filterer);

      set({
        project: {
          ...project,
          nodes: updatedNodes,
        },
        isDirty: true,
      });
    },

    /** Eliminar el nodo seleccionado */
    deleteSelectedNode: () => {
      const { project, selectedNodeId } = getProjectAndSelectedNode();
      if (!project || !selectedNodeId) return;

      const remainingNodes = project.nodes.filter(
        (node) => node.id !== selectedNodeId
      );

      set({
        project: {
          ...project,
          nodes: remainingNodes,
        },
        selectedNodeId: null,
        isDirty: true,
      });
    },
  };
}