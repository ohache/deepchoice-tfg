import type { ID, NodeLayout } from "@/domain/types";

export const NODE_SIZE = 80;
export const GRID_GUTTER_SIZE = 40;
export const GRID_TILE_SIZE = NODE_SIZE + GRID_GUTTER_SIZE;
export const NODE_SLOT_OFFSET = GRID_GUTTER_SIZE / 2;
export const HISTORY_VIEW_COLUMNS = 10;

export interface SceneNodeVM {
  id: ID;
  title: string;
  pos: NodeLayout;
  isStart: boolean;
  isFinal: boolean;
}

/* ViewModel de una arista entre dos nodos */
export interface SceneEdgeVM {
  id: string;
  from: ID;
  to: ID;
  bidirectional: boolean;
}

/* Grafo completo para la vista */
export interface StoryGraphVM {
  nodes: SceneNodeVM[];
  edges: SceneEdgeVM[];
}

export type DirectedEdge = Pick<SceneEdgeVM, "from" | "to" >;

export type TileCell = { cx: number; cy: number };