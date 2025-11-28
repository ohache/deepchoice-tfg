import type { Action, Hotspot, ID } from "@/domain/types";
import type { GameState } from "@/engine/gameState";

/* Aplica una única acción sobre el estado de juego y devuelve un nuevo GameState */
export function applyAction(state: GameState, action: Action): GameState {
    switch (action.type) {
        case "goToNode": {
            const targetId: ID = action.targetNodeId;

            const exists = state.project.nodes.some((node) => node.id === targetId);
            if (!exists) throw new Error(`Acción goToNode apunta a un nodo inexistente: "${targetId}".`);

            return {
                ...state,
                currentNodeId: targetId,
            };
        }

        default: { return state; }
    }
}

/* Aplica todas las acciones asociadas a un hotspot */
export function applyHotspot(state: GameState, hotspot: Hotspot): GameState {
    let newState = state;

    for (const action of hotspot.actions) {
        newState = applyAction(newState, action);
    }

    return newState;
}