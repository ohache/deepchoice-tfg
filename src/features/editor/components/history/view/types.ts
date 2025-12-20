import type { ID } from "@/domain/types";

export const NODE_WIDTH = 80;
export const NODE_HEIGHT = 80;

export const GRID_SIZE = 80;

export type Point = { x: number; y: number };

export interface SceneNodeVM {
    id: ID;
    title: string;
    pos: Point;
    isStart: boolean;
    isFinal: boolean;
    hasOutgoingLinks: boolean;
    hasMusic: boolean;
    hasNpc: boolean;
    hasItem: boolean;
    hasMap: boolean;
}

export interface SceneEdgeVM {
    id: string;
    from: ID;
    to: ID;
    bidirectional: boolean;
    isConditional: boolean;
}

export interface StoryGraphVM {
    nodes: SceneNodeVM[];
    edges: SceneEdgeVM[];
}
