import type { ID, Project } from "@/domain/types";

/* Estado actual de una partida */
export interface GameState {
    project: Project;
    currentNodeId: ID;
}

/* Devuelve el estado inicial de una partida */
export function createInitialGameState(project: Project): GameState {
    const startNode = project.nodes.find((node) => node.isStart);

    const fallbackNode = project.nodes[0];
    if (!fallbackNode) throw new Error("El proyecto no contiene nodos. No se puede iniciar una partida.");
    
    return { project, currentNodeId: startNode ? startNode.id : fallbackNode.id};
}