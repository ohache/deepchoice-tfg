/* Identificador genérico */
export type ID = string;

/* Acciones posibles el jugador activa un hotspot */
export type Action =
    | {
        type: 'goToNode';
        targetNodeId: ID;
    }
    | {
        type: 'addItem';
        itemId: ID;
    }
    | {
        type: 'startDialogue';
        npcId: ID;
    }
    | {
        type: 'giveItemToNpc';
        npcId: ID;
        itemId: ID;
    };

/* Condiciones para que se pueda interactuar con un hotspot */
export type Condition =
    | {
        type: 'hasItem';
        itemId: ID;
    }
    | {
        type: 'flagIsTrue';
        flag: string;
    }
    | {
        type: 'flagIsFalse';
        flag: string;
    };

/* Zona interactiva de la escena */
export interface Hotspot {
    id: ID;
    label?: string;
    actions: Action[];
    conditions?: Condition[];
}

/* Objeto que puede cogerse */
export interface Item {
    id: ID;
    name: string;
    description?: string;
    image?: string;
}

/* Jugador no controlable */
export interface Npc {
    id: ID;
    name: string;
    description?: string;
    image?: string;
}

/* Música de la escena */
export interface MusicTrack {
    id: ID;
    name: string;
    file: string;
}

/* Parte del mapa global */
export interface WorldMap {
    id: ID;
    name: string;
    image: string;
}

/* Escena de la historia */
export interface Node {
    id: ID;
    title: string;
    text: string;
    image?: string;
    hotspots: Hotspot[];
    musicId?: ID;
    npcIds?: ID[];
    featuredItemId?: ID;
    mapId?: ID;
    isStart?: boolean;
    isFinal?: boolean;
    meta?: Record<string, unknown>;
}

/* Proyecto completo */
export interface Project {
    id: ID;
    title: string;
    description?: string;
    nodes: Node[];
    items: Item[];
    npcs: Npc[];
    musicTracks: MusicTrack[];
    maps: WorldMap[];
    meta?: Record<string, unknown>;
}