import type { Project, Node, ID, NodeLayout } from "@/domain/types";
import { GRID_TILE_SIZE, HISTORY_VIEW_COLUMNS, NODE_SLOT_OFFSET, type SceneEdgeVM, type SceneNodeVM, type StoryGraphVM, type DirectedEdge } from "@/features/editor/history/view/historyViewTypes";

function clampToMinSlot(pos: NodeLayout): NodeLayout {
  return {
    x: Math.max(NODE_SLOT_OFFSET, pos.x),
    y: Math.max(NODE_SLOT_OFFSET, pos.y),
  };
}

function tileOriginFromLayout(pos: NodeLayout): NodeLayout {
  return {
    x: Math.floor((pos.x - NODE_SLOT_OFFSET) / GRID_TILE_SIZE) * GRID_TILE_SIZE,
    y: Math.floor((pos.y - NODE_SLOT_OFFSET) / GRID_TILE_SIZE) * GRID_TILE_SIZE,
  };
}

function snapLayoutToSlot(pos: NodeLayout): NodeLayout {
  const tile = tileOriginFromLayout(pos);
  return clampToMinSlot({
    x: tile.x + NODE_SLOT_OFFSET,
    y: tile.y + NODE_SLOT_OFFSET,
  });
}

function normalizeLayout(layout: NodeLayout): NodeLayout {
  const isAligned =
    (layout.x - NODE_SLOT_OFFSET) % GRID_TILE_SIZE === 0 &&
    (layout.y - NODE_SLOT_OFFSET) % GRID_TILE_SIZE === 0;

  return isAligned ? clampToMinSlot(layout) : snapLayoutToSlot(layout);
}

function readStableNodePos(node: Node, fallback: NodeLayout): NodeLayout {
  const layout = node.meta?.layout;

  if (layout && typeof layout.x === "number" && typeof layout.y === "number") return normalizeLayout(layout);

  return fallback;
}

function buildDefaultNodePos(index: number, baseOffsetX: number): NodeLayout {
  const col = index % HISTORY_VIEW_COLUMNS;
  const row = Math.floor(index / HISTORY_VIEW_COLUMNS);

  return {
    x: baseOffsetX + NODE_SLOT_OFFSET + col * GRID_TILE_SIZE,
    y: NODE_SLOT_OFFSET + row * GRID_TILE_SIZE,
  };
}

function makeDirectedEdgeId(from: ID, to: ID) {
  return `${from}-->${to}`;
}

function makeUndirectedPairKey(a: ID, b: ID) {
  return [a, b].sort().join("<->");
}

function collectGoToTargetsFromNode(node: Node): ID[] {
  const targets = new Set<ID>();

  const addTarget = (targetNodeId: ID) => {
    if (!targetNodeId || targetNodeId === node.id) return;
    targets.add(targetNodeId);
  };

  for (const layer of node.layers ?? []) {
    for (const hotspot of layer.hotspots ?? []) {
      const ruleLists = [hotspot.rules?.onClick, hotspot.rules?.onUseItem] as const;

      for (const rules of ruleLists) {
        for (const rule of rules ?? []) {
          for (const effect of rule.effects ?? []) {
            if (effect.type === "goToNode") addTarget(effect.targetNodeId);
          }
        }
      }
    }
  }

  return Array.from(targets);
}

function extractDirectedEdges(node: Node): DirectedEdge[] {
  return collectGoToTargetsFromNode(node).map((to) => ({ from: node.id, to }));
}

function computeBaseOffsetX(nodes: Node[]): number {
  let maxTileX = -Infinity;
  let hasAnyLayout = false;

  for (const node of nodes) {
    const layout = node.meta?.layout;
    if (!layout || typeof layout.x !== "number" || typeof layout.y !== "number") continue;

    hasAnyLayout = true;
    const stable = normalizeLayout(layout);
    maxTileX = Math.max(maxTileX, tileOriginFromLayout(stable).x);
  }

  return hasAnyLayout ? maxTileX + GRID_TILE_SIZE : 0;
}

function buildNodeVMs(nodes: Node[]): SceneNodeVM[] {
  const baseOffsetX = computeBaseOffsetX(nodes);

  return nodes.map((node, index) => {
    const fallback = buildDefaultNodePos(index, baseOffsetX);
    const pos = readStableNodePos(node, fallback);

    return { id: node.id, title: node.title, pos, isStart: !!node.isStart, isFinal: !!node.isFinal };
  });
}

function buildEdgeVMs(nodes: Node[], validNodeIds: Set<ID>): SceneEdgeVM[] {
  const directedIds = new Set<string>();

  for (const node of nodes) {
    for (const edge of extractDirectedEdges(node)) {
      if (!validNodeIds.has(edge.to)) continue;
      directedIds.add(makeDirectedEdgeId(edge.from, edge.to));
    }
  }

  const edges: SceneEdgeVM[] = [];
  const seenPairs = new Set<string>();

  for (const key of directedIds) {
    const [from, to] = key.split("-->") as [ID, ID];
    const pairKey = makeUndirectedPairKey(from, to);
    if (seenPairs.has(pairKey)) continue;

    const [a, b] = [from, to].sort() as [ID, ID];
    const hasAB = directedIds.has(makeDirectedEdgeId(a, b));
    const hasBA = directedIds.has(makeDirectedEdgeId(b, a));
    const bidirectional = hasAB && hasBA;

    const edgeFrom = bidirectional ? a : hasAB ? a : b;
    const edgeTo = bidirectional ? b : hasAB ? b : a;

    edges.push({ id: `edge:${pairKey}`, from: edgeFrom, to: edgeTo, bidirectional });

    seenPairs.add(pairKey);
  }

  return edges;
}

export function buildStoryGraph(project: Project | null): StoryGraphVM {
  if (!project) return { nodes: [], edges: [] };

  const nodes = buildNodeVMs(project.nodes ?? []);
  const nodeIdSet = new Set(nodes.map((node) => node.id));
  const edges = buildEdgeVMs(project.nodes ?? [], nodeIdSet);

  return { nodes, edges };
}