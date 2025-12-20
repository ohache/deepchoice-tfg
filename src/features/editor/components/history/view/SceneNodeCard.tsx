import type React from "react";
import type { Point, SceneNodeVM } from "@/features/editor/components/history/view/types";
import { NODE_WIDTH, NODE_HEIGHT } from "@/features/editor/components/history/view/types";

interface Props {
  node: SceneNodeVM;
  pos: Point;        
  origin: Point;    
  scale: number;    
  zoom: number;     
  onPointerDown: (e: React.PointerEvent<SVGGElement>) => void;
  onDoubleClick: () => void;
}

function truncateForNodeTitle(title: string) {
    const paddingX = 10;
    const usablePx = NODE_WIDTH - paddingX * 2;

    const approxCharPx = 6;
    const maxChars = Math.max(3, Math.floor(usablePx / approxCharPx));

    const t = (title ?? "").trim();
    if (t.length <= maxChars) return t;
    return t.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function worldToScreen(p: Point, origin: Point, scale: number): Point {
  return { x: (p.x - origin.x) * scale, y: (p.y - origin.y) * scale };
}

export function SceneNodeCard({ node, pos, origin, scale, onPointerDown, onDoubleClick }: Props) {
  const screenPos = worldToScreen(pos, origin, scale);

  const w = NODE_WIDTH * scale;
  const h = NODE_HEIGHT * scale;
  const rx = 10 * scale;

  const title = truncateForNodeTitle(node.title);

  const stroke = node.isStart ? "stroke-emerald-400" : node.isFinal ? "stroke-red-700" : "stroke-gray-400";
  const fill = node.isStart ? "fill-emerald-950/50" : node.isFinal ? "fill-red-950/40" : "fill-gray-800";

  return (
    <g
      data-story-node="true"
      transform={`translate(${screenPos.x} ${screenPos.y})`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      style={{ cursor: "pointer" }}
    >
      <rect width={w} height={h} rx={rx} className={`${fill} ${stroke}`} strokeWidth={2} />

      {/* Título centrado */}
      <text
        x={w / 2}
        y={h / 2 - 2 * scale}
        textAnchor="middle"
        dominantBaseline="middle"
        className="fill-slate-200"
        fontSize={12 * scale}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {title}
      </text>
    </g>
  );
}
