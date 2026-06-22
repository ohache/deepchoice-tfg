import type { PointerEvent } from "react";
import type { NodeLayout } from "@/domain/types";
import { NODE_SIZE, type SceneNodeVM } from "@/features/editor/history/view/historyViewTypes";

type Props = {
  node: SceneNodeVM;
  pos: NodeLayout;
  scale: number;
  onPointerDown: (e: PointerEvent<SVGGElement>) => void;
  onDoubleClick: () => void;
}

function truncateForNodeTitle(title: string, scale: number): string {
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

function getIssueBadgeTitle(node: SceneNodeVM, hasErrors: boolean): string {
  if (hasErrors) return `${node.errorCount} error${node.errorCount === 1 ? "" : "es"} en esta escena`;

  return `${node.warningCount} aviso${node.warningCount === 1 ? "" : "s"} en esta escena`;
}

export function SceneNodeCard({ node, pos, scale, onPointerDown, onDoubleClick }: Props) {
  const screenPos: NodeLayout = { x: pos.x * scale, y: pos.y * scale };
  const w = NODE_SIZE * scale;
  const h = NODE_SIZE * scale;
  const rx = 10 * scale;

  const title = truncateForNodeTitle(node.title, scale);
  const tone = getNodeTone(node);

  const hasErrors = (node.errorCount ?? 0) > 0;
  const hasWarnings = (node.warningCount ?? 0) > 0;
  const showIssueBadge = hasErrors || hasWarnings;

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

      {showIssueBadge && (
        <g transform={`translate(${w - 6 * scale} ${6 * scale})`}>
          <title>{getIssueBadgeTitle(node, hasErrors)}</title>

          <circle
            r={9 * scale}
            className={hasErrors ? "fill-red-500" : "fill-amber-400"}
          />

          <path
            d={`M ${-4 * scale} ${-4 * scale} L ${4 * scale} ${4 * scale} M ${4 * scale} ${-4 * scale} L ${-4 * scale} ${4 * scale}`}
            stroke="white"
            strokeWidth={2 * scale}
            strokeLinecap="round"
          />
        </g>
      )}
    </g>
  );
}