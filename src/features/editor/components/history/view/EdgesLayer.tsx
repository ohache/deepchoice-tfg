import type { ID } from "@/domain/types";
import type { Point, SceneEdgeVM } from "@/features/editor/components/history/view/types";

interface Props {
  edges: SceneEdgeVM[];
  nodePos: Map<ID, Point>;   
  origin: Point;              
  scale: number;             
  nodeWidth: number;
  nodeHeight: number;
}

function worldToScreen(p: Point, origin: Point, scale: number): Point {
  return { x: (p.x - origin.x) * scale, y: (p.y - origin.y) * scale };
}

function rectExitPoint(from: Point, to: Point, w: number, h: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (dx === 0 && dy === 0) return from;

  const halfW = w / 2;
  const halfH = h / 2;

  const tx = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);

  return { x: from.x + dx * t, y: from.y + dy * t };
}

export function EdgesLayer({ edges, nodePos, origin, scale, nodeWidth, nodeHeight }: Props) {
  const getCenterScreen = (id: ID): Point | null => {
    const p = nodePos.get(id);
    if (!p) return null;

    const screenTopLeft = worldToScreen(p, origin, scale);
    return {
      x: screenTopLeft.x + (nodeWidth * scale) / 2,
      y: screenTopLeft.y + (nodeHeight * scale) / 2,
    };
  };

  return (
    <g>
      {edges.map((e) => {
        const a = getCenterScreen(e.from);
        const b = getCenterScreen(e.to);
        if (!a || !b) return null;

        const p1 = rectExitPoint(a, b, nodeWidth * scale, nodeHeight * scale);
        const p2 = rectExitPoint(b, a, nodeWidth * scale, nodeHeight * scale);
        const d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;

        return (
          <path
            key={e.id}
            d={d}
            fill="none"
            stroke="currentColor"
            className="text-white"
            strokeWidth={3}
            markerEnd="url(#arrow-end)"
            markerStart={e.bidirectional ? "url(#arrow-start)" : undefined}
            opacity={1}
            strokeDasharray={e.isConditional ? "6 6" : undefined}
          />
        );
      })}
    </g>
  );
}
