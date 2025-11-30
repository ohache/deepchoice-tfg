import type { ID, Node } from "@/domain/types";

export interface EditorSceneSlice {
    selectedNodeId: ID | null;

    createAndSelectNode: () => void;
    selectNode: (id: ID) => void;
    updateSelectedNodeFields: (patch: Partial<Pick<Node, "title" | "text" | "image" | "isStart" | "isFinal" >>) => void;
}

const generateNodeId = (): ID => `node-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function createEditorSceneSlice( set: any, get: any ): EditorSceneSlice {
    return {
        selectedNodeId: null,

        createAndSelectNode: () => {
            const state = get();
            const project = state.project as { nodes: Node[] } | null;

            if (!project) return;

            const newId = generateNodeId();

            const newNode: Node = {
                id: newId,
                title: "",
                text: "",
                image: undefined,
                hotspots: [],
                isStart: project.nodes.length === 0,
                isFinal: false,
            };

            const updatedNodes = [...project.nodes, newNode];

            set({
                project: {
                    ...project,
                    nodes: updatedNodes,
                },
                selectedNodeId: newId,
                isDirty: true,
            });
        },

        selectNode: (id: ID) => {
            const state = get();
            const project = state.project as { nodes: Node[] } | null;

            if (!project) return;

            const exists = project.nodes.some((node) => node.id === id);
            if (!exists) return;

            set({ selectedNodeId: id });
        },

        updateSelectedNodeFields: (patch) => {
            const state = get();
            const project = state.project as { nodes: Node[] } | null;
            const selectedNodeId = state.selectedNodeId as ID | null;

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
    };
}
