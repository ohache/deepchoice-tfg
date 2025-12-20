/* Identificador genérico */
export type ID = string;

/* Visor de nodos*/
export interface NodeLayout {
    x: number;
    y: number;
}

export interface NodeMeta {
    layout?: NodeLayout;
}

/* Zona del hotspot / entidad */
export type HotspotShape =
    | {
        type: "rect";
        x: number;
        y: number;
        w: number;
        h: number;
    };

/* Condiciones */
export type Condition =
    | { type: "hasItem"; itemId: ID }
    | { type: "flagIsTrue"; flag: string }
    | { type: "flagIsFalse"; flag: string };

/* Efectos*/
export type Effect =
    // Navegación
    | { type: "goToNode"; targetNodeId: ID }

    // Inventario / flags
    | { type: "addItem"; itemId: ID }
    | { type: "removeItem"; itemId: ID }
    | { type: "setFlag"; flag: string; value: boolean }

    // Diálogo / PNJ
    | { type: "startDialogue"; npcId: ID }
    | { type: "giveItemToNpc"; npcId: ID; itemId: ID }

    // Feedback
    | { type: "showText"; text: string }
    | { type: "showMessage"; text: string }

    // Estado de entidades colocadas en escena
    | { type: "setPlacedItemVisible"; placedItemId: ID; value: boolean }
    | { type: "setPlacedItemReachable"; placedItemId: ID; value: boolean };

export type EffectType = Effect["type"];

/* Efectos permitidos solo en hotspots libres */
export type FreeHotspotEffect =
  | Extract<Effect, { type: "goToNode" }>
  | Extract<Effect, { type: "setFlag" }>
  | Extract<Effect, { type: "showText" }>
  | Extract<Effect, { type: "showMessage" }>;

export type FreeHotspotEffectType = FreeHotspotEffect["type"];

/* Verbos permitidos para zonas del escenario (hotspots "free") */
export type HotspotVerb = "go" | "look" | "use";

/* Interacción de un hotspot */
export interface HotspotInteraction {
    id: ID;
    verb: HotspotVerb;
    label?: string;
    cursor?: string;
    conditions?: Condition[];
    effects: FreeHotspotEffect[];
}

/* Zona interactiva del escenario */
export interface Hotspot {
    id: ID;
    shape: HotspotShape;
    label?: string;
    interactions: HotspotInteraction[];
}

/* Ítems */
export interface ItemDef {
    id: ID;
    name: string;
    description: string;
    image: string;
}

/* Estado del ítem colocado en escena */
export interface PlacedItemState {
    visible: boolean;
    reachable: boolean;
    notReachableText?: string;
}

/* Ítem colocado en una escena (instancia en un nodo) */
export interface PlacedItem {
    id: ID;
    itemId: ID;
    shape: HotspotShape;
    state: PlacedItemState;
    interactions?: ItemInteraction[];
}

/* Verbos del item */
export type ItemVerb = "look" | "take" | "use";

export interface ItemInteraction {
    id: ID;
    verb: ItemVerb;
    label?: string;
    cursor?: string;
    conditions?: Condition[];
    effects: Effect[];
}

/* PNJs */
export interface NpcDef {
    id: ID;
    name: string;
    description: string;
    image: string;
}

/* PNJ colocado en una escena (instancia en un nodo) */
export interface PlacedNpc {
    id: ID;
    npcId: ID;
    shape: HotspotShape;
    interactions?: NpcInteraction[];
}

/* Verbos del PNJ */
export type NpcVerb = "look" | "talk" | "use" | "give";

export interface NpcInteraction {
    id: ID;
    verb: NpcVerb;
    label?: string;
    cursor?: string;
    conditions?: Condition[];
    effects: Effect[];
}

/* Música */
export interface MusicTrack {
    id: ID;
    name: string;
    file: string;
    loop: boolean;
}

/* Mapa */
export interface WorldMap {
    id: ID;
    name: string;
    image: string;
}

/* Escena */
export interface Node {
    id: ID;
    title: string;
    text: string;
    image: string;
    hotspots: Hotspot[];
    musicId?: ID;
    mapId?: ID;
    placedItems?: PlacedItem[];
    placedNpcs?: PlacedNpc[];
    isStart?: boolean;
    isFinal?: boolean;
    meta?: NodeMeta;
}

/* Proyecto */
export interface Project {
    id: ID;
    title: string;
    nodes: Node[];
    items: ItemDef[];
    npcs: NpcDef[];
    musicTracks: MusicTrack[];
    maps: WorldMap[];
    meta?: Record<string, unknown>;
}