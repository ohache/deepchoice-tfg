import type { ID, Node, NodeLayout, NodeMeta } from "@/domain/types";
import { type TileCell, GRID_TILE_SIZE, HISTORY_VIEW_COLUMNS, NODE_SLOT_OFFSET } from "@/features/editor/history/view/historyViewTypes";

const cellKey = (cell: TileCell) => `${cell.cx},${cell.cy}`;

function getTileCellFromLayout(pos: NodeLayout, tileSize: number, offset: number): TileCell {
  return { cx: Math.floor((pos.x - offset) / tileSize), cy: Math.floor((pos.y - offset) / tileSize) };
}

function layoutFromTileCell(cell: TileCell, tileSize: number, offset: number): NodeLayout {
  return { x: cell.cx * tileSize + offset, y: cell.cy * tileSize + offset };
}

function readNodeLayout(node: Node): NodeLayout | null {
  const layout = node.meta?.layout;
  return layout && typeof layout.x === "number" && typeof layout.y === "number" ? layout : null;
}

function getLastNodeLayout(nodes: Node[]): NodeLayout | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const layout = readNodeLayout(nodes[i]);
    if (layout) return layout;
  }
  return null;
}

function collectOccupiedCells(nodes: Node[], tileSize: number, offset: number) {
  const occupied = new Set<string>();

  for (const node of nodes) {
    const layout = readNodeLayout(node);
    if (!layout) continue;

    occupied.add(cellKey(getTileCellFromLayout(layout, tileSize, offset)));
  }

  return occupied;
}

export function computeLayoutForNewNode(args: { nodes: Node[]; tileSize: number; offset: number; start: NodeLayout; rowScan?: number }): NodeLayout {
  const { nodes, tileSize, offset, start, rowScan = HISTORY_VIEW_COLUMNS } = args;

  const occupied = collectOccupiedCells(nodes, tileSize, offset);
  const lastLayout = getLastNodeLayout(nodes);

  if (!lastLayout) return { x: start.x, y: start.y };

  const lastCell = getTileCellFromLayout(lastLayout, tileSize, offset);

  let cx = lastCell.cx + 1;

  while (true) {
    for (let cy = lastCell.cy; cy < lastCell.cy + rowScan; cy++) {
      const candidate: TileCell = { cx, cy };
      if (occupied.has(cellKey(candidate))) continue;

      return layoutFromTileCell(candidate, tileSize, offset);
    }

    cx++;
  }
}

export function hasValidLayout(meta?: NodeMeta): boolean {
  return Number.isFinite(meta?.layout?.x) && Number.isFinite(meta?.layout?.y);
}

export function ensureNodeHasLayoutPure(node: Node, fallback: NodeLayout): Node {
  return readNodeLayout(node) ? node : { ...node, meta: { ...(node.meta ?? {}), layout: fallback } };
}

export function updateManyNodeMetaLayoutsPure(args: { nodes: Node[]; positionsById: Map<ID, NodeLayout> }): Node[] {
  const { nodes, positionsById } = args;

  let changed = false;

  const nextNodes = nodes.map((node) => {
    const nextPos = positionsById.get(node.id);
    if (!nextPos) return node;

    const prevPos = node.meta?.layout;
    if (prevPos && prevPos.x === nextPos.x && prevPos.y === nextPos.y) return node;

    changed = true;

    return { ...node, meta: { ...(node.meta ?? {}), layout: { x: nextPos.x, y: nextPos.y }}};
  });

  return changed ? nextNodes : nodes;
}

export function resolveDraftMetaWithFallback(draft: Node, fallback: NodeLayout): NodeMeta {
  const meta = draft.meta ?? {};

  if (hasValidLayout(meta)) return meta;

  return {...meta, layout: fallback };
}

/* Calcula el fallback de layout para un nuevo nodo */
export function computeNewNodeFallbackLayout(nodes: Node[]): NodeLayout {
  return computeLayoutForNewNode({ nodes, tileSize: GRID_TILE_SIZE, offset: NODE_SLOT_OFFSET, start: { x: NODE_SLOT_OFFSET, y: NODE_SLOT_OFFSET }, rowScan: HISTORY_VIEW_COLUMNS });
}