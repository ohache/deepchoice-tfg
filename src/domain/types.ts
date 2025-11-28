/* Identificador genérico */
export type ID = string;

/* Lo que ocurre cuando el jugador activa un hotspot */
export type Action = {
    type: 'goToNode';
    targetNodeId: ID;
};

/* Zona interactiva de la escena */
export interface Hotspot {
    id: ID;
    actions: Action[];
}

/* Escena de la historia */
export interface Node {
    id: ID;
    title: string;
    text: string;
    hotspots: Hotspot[];
    isStart?: boolean;
    isFinal?: boolean;
}

/* Proyecto completo */
export interface Project {
    id: ID;
    title: string;
    nodes: Node[];
}