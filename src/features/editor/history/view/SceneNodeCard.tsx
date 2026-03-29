import type React from "react";
import type { NodeLayout } from "@/domain/types";
import { NODE_SIZE, type SceneNodeVM } from "@/features/editor/history/view/historyViewTypes";

interface Props {
  node: SceneNodeVM;
  pos: NodeLayout;
  scale: number;
  onPointerDown: (e: React.PointerEvent<SVGGElement>) => void;
  onDoubleClick: () => void;
}

function truncateForNodeTitle(title: string, scale: number) {
  const paddingX = 10;
  const usablePx = NODE_SIZE * scale - paddingX * 2 * scale;
  const approxCharPx = 6 * scale;
  const maxChars = Math.max(3, Math.floor(usablePx / approxCharPx));

  const text = (title ?? "").trim();
  if (text.length <= maxChars) return text;

  return text.slice(0, Math.max(0, maxChars - 1)) + "…";
}

function getNodeTone(node: SceneNodeVM) {
  if (node.isStart) {
    return {
      stroke: "stroke-emerald-400",
      fill: "fill-emerald-900/45",
    };
  }

  if (node.isFinal) {
    return {
      stroke: "stroke-rose-400",
      fill: "fill-rose-900/45",
    };
  }

  return {
    stroke: "stroke-slate-200",
    fill: "fill-slate-800/35",
  };
}

export function SceneNodeCard({ node, pos, scale, onPointerDown, onDoubleClick }: Props) {
  const screenPos: NodeLayout = { x: pos.x * scale, y: pos.y * scale };
  const w = NODE_SIZE * scale;
  const h = NODE_SIZE * scale;
  const rx = 10 * scale;

  const title = truncateForNodeTitle(node.title, scale);
  const tone = getNodeTone(node);

  return (
    <g
      data-story-node="true"
      transform={`translate(${screenPos.x} ${screenPos.y})`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      style={{ cursor: "pointer" }}
    >
      <rect
        width={w}
        height={h}
        rx={rx}
        className={`${tone.fill} ${tone.stroke}`}
        strokeWidth={2 * scale}
      />

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