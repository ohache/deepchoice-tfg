import type { ID, Project, Node } from "@/domain/types";

/* Estado actual de una partida */
export interface GameState {
  project: Project;
  currentNodeId: ID;
  inventory: ID[];
  flags: Record<string, boolean>;
}

/* Devuelve el estado inicial de una partida */
export function createInitialGameState(project: Project): GameState {
  if (project.nodes.length === 0) {
    throw new Error("El proyecto no contiene escenas. No se puede iniciar una partida.");
  }

  const startNodes = project.nodes.filter((node) => node.isStart === true);

  if (startNodes.length > 1) {
    throw new Error("El proyecto tiene más de un nodo marcado como inicio.");
  }

  const startNode = startNodes[0] ?? project.nodes[0];
  if (!startNode) {
    throw new Error("No se pudo determinar el nodo inicial.");
  }

  return {
    project,
    currentNodeId: startNode.id,
    inventory: [],
    flags: {},
  };
}

/** Devuelve el nodo actual */
export function getCurrentNode(state: GameState): Node {
  const node = state.project.nodes.find((n) => n.id === state.currentNodeId);

  if (!node) {
    throw new Error(`No se encontró el nodo actual id=${state.currentNodeId}`);
  }

  return node;
}