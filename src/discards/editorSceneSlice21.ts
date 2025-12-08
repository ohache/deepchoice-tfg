import type { ID, Node, Hotspot } from "@/domain/types";
import { generateNodeId , generateHotspotId} from "@/utils/id";

type NodeDraft = Omit<Node, "id">;
export type SceneMode = "creating" | "editing";

export interface EditorSceneSlice {
    selectedNodeId: ID | null;
    sceneMode: SceneMode;

    setSceneMode: (mode: SceneMode) => void;

    createNodeFromDraft: (draft: NodeDraft) => void;
    selectNode: (id: ID) => void;
    updateSelectedNodeFields: (fields: Partial<Node>) => void;

    addHotspotToSelectedNode: () => void;
    updateHotspotTarget: (hotspotId: ID, targetNodeId: ID) => void;
    removeHotspotFromSelectedNode: (hotspotId: ID) => void;
    deleteSelectedNode: () => void;
}

export function createEditorSceneSlice( set: any, get: any ): EditorSceneSlice {

    function getProjectAndSelectedNode() {
        const state = get();
        const project = state.project as { nodes: Node[] } | null;
        const selectedNodeId = state.selectedNodeId as ID | null;
        return { project, selectedNodeId, state };
    }

    return {
        selectedNodeId: null,
        sceneMode: "creating",

        setSceneMode: (mode) => {
            set((state: any) => ({
                ...state,
                sceneMode: mode,
            }));
        },

        /* Crea un nuevo nodo vacío */
        createNodeFromDraft: (draft: NodeDraft) => {
            const state = get();
            const project = state.project as { nodes: Node[] } | null;
            if (!project) return;

            const newId = generateNodeId();

            const newNode: Node = {
                id: newId,
                title: draft.title.trim(),
                text: draft.text,
                image: draft.image,
                hotspots: draft.hotspots ?? [],
                musicId: draft.musicId,
                npcIds: draft.npcIds,
                featuredItemId: draft.featuredItemId,
                mapId: draft.mapId,
                isStart: project.nodes.length === 0 || draft.isStart === true,
                isFinal: draft.isFinal ?? false,
                meta: draft.meta ?? {},
            };

            set({
                project: {
                    ...project,
                    nodes: [...project.nodes, newNode],
                },
                selectedNodeId: newId,
                sceneMode: "editing",
                isDirty: true,
            });
        },

        /* Selecciona un nodo existente por id (si existe) */
        selectNode: (id: ID) => {
            const { project } = getProjectAndSelectedNode();
            if (!project) return;

            const exists = project.nodes.some((node) => node.id === id);
            if (!exists) return;

            set({
                selectedNodeId: id,
                sceneMode: "editing",
              });
        },

        /* Actualiza campos del nodo seleccionado */
        updateSelectedNodeFields: (patch) => {
            const { project, selectedNodeId } = getProjectAndSelectedNode();
            if (!project || !selectedNodeId) return;

            let updatedNodes = project.nodes.map((node) =>
                node.id === selectedNodeId ? { ...node, ...patch } : node
            );

            if (patch.isStart === true) {
                updatedNodes = updatedNodes.map((node) =>
                    node.id === selectedNodeId
                        ? { ...node, isStart: true }
                        : { ...node, isStart: false }
                );
            }

            set({
                project: {
                    ...project,
                    nodes: updatedNodes,
                },
                isDirty: true,
            });
        },
        
        /* Añade un hotspot al nodo seleccionado */
        addHotspotToSelectedNode: () => {
            const { project, selectedNodeId } = getProjectAndSelectedNode();
            if (!project || !selectedNodeId) return;

            const newHotspotId = generateHotspotId();

            const updatedNodes = project.nodes.map((node) => {
                if (node.id !== selectedNodeId) return node;

                const newHotspot: Hotspot = {
                    id: newHotspotId,
                    actions: [],
                };

                return {
                    ...node,
                    hotspots: [...node.hotspots, newHotspot],
                };
            });

            set({
                project: {
                    ...project,
                    nodes: updatedNodes,
                },
                isDirty: true,
            });
        },

        /* Cambia el nodo destino de un hotspot (solo la primera acción goToNode) */
        updateHotspotTarget: (hotspotId: ID, targetNodeId: ID) => {
            const { project, selectedNodeId } = getProjectAndSelectedNode();
            if (!project || !selectedNodeId) return;

            const updatedNodes = project.nodes.map((node) => {
                if (node.id !== selectedNodeId) return node;

                const updatedHotspots = node.hotspots.map((hs) => {
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

                return {
                    ...node,
                    hotspots: updatedHotspots,
                };
            });

            set({
                project: {
                    ...project,
                    nodes: updatedNodes,
                },
                isDirty: true,
            });
        },

        /* Elimina un hotspot del nodo seleccionado */
        removeHotspotFromSelectedNode: (hotspotId: ID) => {
            const { project, selectedNodeId } = getProjectAndSelectedNode();
            if (!project || !selectedNodeId) return;

            const updatedNodes = project.nodes.map((node) => {
                if (node.id !== selectedNodeId) return node;

                return {
                    ...node,
                    hotspots: node.hotspots.filter((hs) => hs.id !== hotspotId),
                };
            });

            set({
                project: {
                    ...project,
                    nodes: updatedNodes,
                },
                isDirty: true,
            });
        },

        /** Elimina la escena seleccionada y limpia la selección */
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