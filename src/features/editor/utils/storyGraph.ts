import type { Project, Node, ID } from "@/domain/types";
import type { SceneEdgeVM, SceneNodeVM, StoryGraphVM, Point } from "@/features/editor/components/history/view/types";
import { GRID_SIZE } from "@/features/editor/components/history/view/types";

function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
  };
}

function readNodePos(node: Node, fallback: Point): Point {
  const layout = node.meta?.layout;
  if (layout && typeof layout.x === "number" && typeof layout.y === "number") {
    return snapToGrid({ x: layout.x, y: layout.y });
  }
  return snapToGrid(fallback);
}

function buildDefaultPos(index: number, baseOffsetX: number): Point {
  const cols = 10;
  const col = index % cols;
  const row = Math.floor(index / cols);

  const marginY = GRID_SIZE;
  return {
    x: baseOffsetX + col * 2 * GRID_SIZE,
    y: marginY + row * 2 * GRID_SIZE,
  };
}

type DirectedEdge = { from: ID; to: ID; isConditional: boolean };

function extractDirectedEdges(fromNode: Node): DirectedEdge[] {
  const res: DirectedEdge[] = [];
  const hotspots = fromNode.hotspots ?? [];

  for (const hs of hotspots) {
    for (const it of hs.interactions ?? []) {
      const conditional = (it.conditions?.length ?? 0) > 0;

      for (const ef of it.effects ?? []) {
        if (ef.type === "goToNode") {
          res.push({
            from: fromNode.id,
            to: ef.targetNodeId,
            isConditional: conditional,
          });
        }
      }
    }
  }

  return res;
}

function makeDirectedEdgeId(from: ID, to: ID) {
  return `${from}-->${to}`;
}

function makeUndirectedKey(a: ID, b: ID) {
  return [a, b].sort().join("<->");
}

export function buildStoryGraph(project: Project | null): StoryGraphVM {
  if (!project) return { nodes: [], edges: [] };

  let maxLayoutX = -Infinity;
  let hasAnyLayout = false;

  for (const n of project.nodes) {
    const layout = n.meta?.layout;
    if (layout && typeof layout.x === "number" && typeof layout.y === "number") {
      hasAnyLayout = true;
      maxLayoutX = Math.max(maxLayoutX, layout.x);
    }
  }

  const baseOffsetX = hasAnyLayout ? snapToGrid({ x: maxLayoutX + 2 * GRID_SIZE, y: 0 }).x : GRID_SIZE;

  const nodes: SceneNodeVM[] = project.nodes.map((n, index) => {
    const fallback = buildDefaultPos(index, baseOffsetX);
    const pos = readNodePos(n, fallback);

    const directed = extractDirectedEdges(n);
    const hasOutgoingLinks = directed.some((e) => e.to !== n.id); // ignora self-loop

    return {
      id: n.id,
      title: (n.title ?? "").trim() || n.id,
      pos,
      isStart: !!n.isStart,
      isFinal: !!n.isFinal,

      hasOutgoingLinks,
      hasMusic: !!n.musicId,
      hasNpc: (n.placedNpcs?.length ?? 0) > 0,
      hasItem: (n.placedItems?.length ?? 0) > 0,
      hasMap: !!n.mapId,
    };
  });

  const nodeIdSet = new Set(nodes.map((n) => n.id));

  const directedMap = new Map<string, boolean>();
  for (const n of project.nodes) {
    for (const e of extractDirectedEdges(n)) {
      if (!nodeIdSet.has(e.to)) continue;
      if (e.to === e.from) continue;

      const key = makeDirectedEdgeId(e.from, e.to);
      directedMap.set(key, (directedMap.get(key) ?? false) || e.isConditional);
    }
  }

  const edges: SceneEdgeVM[] = [];
  const seenPairs = new Set<string>();

  for (const key of directedMap.keys()) {
    const [from, to] = key.split("-->") as [ID, ID];

    const pairKey = makeUndirectedKey(from, to);
    if (seenPairs.has(pairKey)) continue;

    const [a, b] = [from, to].sort() as [ID, ID];
    const abKey = makeDirectedEdgeId(a, b);
    const baKey = makeDirectedEdgeId(b, a);

    const hasAB = directedMap.has(abKey);
    const hasBA = directedMap.has(baKey);

    const isConditional = (directedMap.get(abKey) ?? false) || (directedMap.get(baKey) ?? false);
    const bidirectional = hasAB && hasBA;

    let edgeFrom: ID = a;
    let edgeTo: ID = b;

    if (!bidirectional) {
      if (hasAB) {
        edgeFrom = a;
        edgeTo = b;
      } else {
        edgeFrom = b;
        edgeTo = a;
      }
    }

    edges.push({
      id: `edge:${pairKey}`,
      from: edgeFrom,
      to: edgeTo,
      bidirectional,
      isConditional,
    });

    seenPairs.add(pairKey);
  }

  return { nodes, edges };
}
