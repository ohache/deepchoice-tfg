import type { ID, Project, Node } from "@/domain/types";

/* Estado actual de una partida */
export interface GameState {
    project: Project;
    currentNodeId: ID;
}

/* Devuelve el estado inicial de una partida */
export function createInitialGameState(project: Project): GameState {
    if (project.nodes.length === 0) throw new Error("El proyecto no contiene escenas. No se puede iniciar una partida.");

    const startNodes = project.nodes.filter((node) => node.isStart);

    if (startNodes.length > 1) throw new Error("El proyecto tiene más de un nodo marcado como inicio.");

    const startNode = startNodes[0] ?? project.nodes[0];

    return {
        project,
        currentNodeId: startNode.id,
    };
}

/** Devuelve el nodo actual */
export function getCurrentNode(state: GameState): Node {
    const node = state.project.nodes.find( (n) => n.id === state.currentNodeId );

    if (!node) {throw new Error(`No se encontró el nodo actual id=${state.currentNodeId}`);}

    return node;
}