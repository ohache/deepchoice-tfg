import type { ID, NodeLayout } from "@/domain/types";
import type { SceneEdgeVM } from "@/features/editor/history/view/historyViewTypes";

interface Props {
  edges: SceneEdgeVM[];
  nodePos: Map<ID, NodeLayout>;
  scale: number;
  nodeWidth: number;
  nodeHeight: number;
}

type Axis = "x" | "y";
type ApproachMode = "lr" | "tb";
type EndpointKey = string;

type Endpoint = {
  key: EndpointKey;
  nodeId: ID;
  source: NodeLayout;
  target: NodeLayout;
  mode: ApproachMode;
};

type CubicShape = {
  p1: NodeLayout;
  p2: NodeLayout;
  c1: NodeLayout;
  c2: NodeLayout;
};

type EndpointOffset = {
  axis: Axis;
  offsetPx: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function add(a: NodeLayout, b: NodeLayout): NodeLayout {
  return { x: a.x + b.x, y: a.y + b.y };
}

function sub(a: NodeLayout, b: NodeLayout): NodeLayout {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mul(a: NodeLayout, k: number): NodeLayout {
  return { x: a.x * k, y: a.y * k };
}

function normalize(v: NodeLayout): NodeLayout {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function farPointFrom(center: NodeLayout, dir: NodeLayout) {
  return add(center, mul(dir, 10_000));
}

function isInsideCenteredRect(p: NodeLayout, center: NodeLayout, w: number, h: number) {
  const halfW = w / 2;
  const halfH = h / 2;
  return Math.abs(p.x - center.x) < halfW && Math.abs(p.y - center.y) < halfH;
}

function rectExitPoint(from: NodeLayout, to: NodeLayout, w: number, h: number): NodeLayout {
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

function offsetOnRectBorder(args: { center: NodeLayout; pOnBorder: NodeLayout; w: number; h: number; axis: Axis; offsetPx: number; cornerMarginPx: number }): NodeLayout {
  const { center, pOnBorder, w, h, axis, offsetPx, cornerMarginPx } = args;

  const halfW = w / 2;
  const halfH = h / 2;

  if (axis === "y") {
    const minY = center.y - halfH + cornerMarginPx;
    const maxY = center.y + halfH - cornerMarginPx;
    return { x: pOnBorder.x, y: clamp(pOnBorder.y + offsetPx, minY, maxY) };
  }

  const minX = center.x - halfW + cornerMarginPx;
  const maxX = center.x + halfW - cornerMarginPx;
  return { x: clamp(pOnBorder.x + offsetPx, minX, maxX), y: pOnBorder.y };
}

function slideOnBorderAndReproject(args: { center: NodeLayout; pOnBorder: NodeLayout; w: number; h: number; axis: Axis; offsetPx: number; cornerMarginPx: number }): NodeLayout {
  const { center, pOnBorder, w, h, axis, offsetPx, cornerMarginPx } = args;

  const slid = offsetOnRectBorder({ center, pOnBorder, w, h, axis, offsetPx, cornerMarginPx });

  const dir = normalize(sub(slid, center));
  return rectExitPoint(center, farPointFrom(center, dir), w, h);
}

function approachMode(source: NodeLayout, target: NodeLayout): ApproachMode {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  return Math.abs(dx) >= Math.abs(dy) ? "lr" : "tb";
}

function buildCubic(args: { aC: NodeLayout; bC: NodeLayout; wExit: number; hExit: number }): CubicShape {
  const { aC, bC, wExit, hExit } = args;

  const dx = bC.x - aC.x;
  const dy = bC.y - aC.y;

  const EPS = 0.5;
  const sameX = Math.abs(dx) < EPS;
  const sameY = Math.abs(dy) < EPS;

  if (sameX || sameY) {
    const dirAB = normalize({ x: dx, y: dy });
    const dirBA = normalize({ x: -dx, y: -dy });

    const p1 = rectExitPoint(aC, farPointFrom(aC, dirAB), wExit, hExit);
    const p2 = rectExitPoint(bC, farPointFrom(bC, dirBA), wExit, hExit);

    const t = 0.33;
    const c1 = add(p1, mul(sub(p2, p1), t));
    const c2 = add(p1, mul(sub(p2, p1), 1 - t));

    return { p1, p2, c1, c2 };
  }

  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  const bend = clamp(Math.abs(dy) * 0.35, 30, 140);
  const bendSign = dy > 0 ? 1 : -1;

  const ox = nx * bend * bendSign;
  const oy = ny * bend * bendSign;

  const t = 0.25;
  const c1: NodeLayout = { x: aC.x + dx * t + ox, y: aC.y + dy * t + oy };
  const c2: NodeLayout = { x: bC.x - dx * t + ox, y: bC.y - dy * t + oy };

  const startDir = normalize(sub(c1, aC));
  const endDir = normalize(sub(c2, bC));

  const p1 = rectExitPoint(aC, farPointFrom(aC, startDir), wExit, hExit);
  const p2 = rectExitPoint(bC, farPointFrom(bC, endDir), wExit, hExit);

  return { p1, p2, c1, c2 };
}

function toPathD(shape: CubicShape): string {
  return `M ${shape.p1.x} ${shape.p1.y} C ${shape.c1.x} ${shape.c1.y}, ${shape.c2.x} ${shape.c2.y}, ${shape.p2.x} ${shape.p2.y}`;
}

function getCenterScreen(args: { nodeId: ID; nodePos: Map<ID, NodeLayout>; scale: number; nodeWidth: number; nodeHeight: number }): NodeLayout | null {
  const { nodeId, nodePos, scale, nodeWidth, nodeHeight } = args;

  const pWorld = nodePos.get(nodeId);
  if (!pWorld) return null;

  const topLeft = { x: pWorld.x * scale, y: pWorld.y * scale };

  return {
    x: topLeft.x + (nodeWidth * scale) / 2,
    y: topLeft.y + (nodeHeight * scale) / 2,
  };
}

function assignSlots(list: Endpoint[], mode: ApproachMode, slotStepPx: number, endpointOffsetByKey: Map<EndpointKey, EndpointOffset>) {
  if (list.length <= 1) {
    for (const ep of list) {
      endpointOffsetByKey.set(ep.key, {
        axis: mode === "lr" ? "y" : "x",
        offsetPx: 0,
      });
    }
    return;
  }

  const sorted = [...list].sort((a, b) => mode === "lr" ? a.source.y - b.source.y : a.source.x - b.source.x);

  const mid = (sorted.length - 1) / 2;

  for (let i = 0; i < sorted.length; i++) {
    const slot = i - mid;
    endpointOffsetByKey.set(sorted[i].key, {
      axis: mode === "lr" ? "y" : "x",
      offsetPx: slot * slotStepPx,
    });
  }
}

function buildEndpointOffsets(args: { edges: SceneEdgeVM[]; nodePos: Map<ID, NodeLayout>; scale: number; nodeWidth: number; nodeHeight: number; slotStepPx: number }) {
  const { edges, nodePos, scale, nodeWidth, nodeHeight, slotStepPx } = args;

  const endpointOffsetByKey = new Map<EndpointKey, EndpointOffset>();
  const endpointsByNode = new Map<ID, { lr: Endpoint[]; tb: Endpoint[] }>();

  const pushEndpoint = (ep: Endpoint) => {
    const bucket = endpointsByNode.get(ep.nodeId) ?? { lr: [], tb: [] };
    bucket[ep.mode].push(ep);
    endpointsByNode.set(ep.nodeId, bucket);
  };

  for (const edge of edges) {
    const aC = getCenterScreen({ nodeId: edge.from, nodePos, scale, nodeWidth, nodeHeight });
    const bC = getCenterScreen({ nodeId: edge.to, nodePos, scale, nodeWidth, nodeHeight });

    if (!aC || !bC) continue;

    pushEndpoint({ key: `${edge.id}:end`, nodeId: edge.to, source: aC, target: bC, mode: approachMode(aC, bC) });

    if (edge.bidirectional) pushEndpoint({ key: `${edge.id}:start`, nodeId: edge.from, source: bC, target: aC, mode: approachMode(bC, aC) });
  }

  endpointsByNode.forEach((bucket) => {
    assignSlots(bucket.lr, "lr", slotStepPx, endpointOffsetByKey);
    assignSlots(bucket.tb, "tb", slotStepPx, endpointOffsetByKey);
  });

  return endpointOffsetByKey;
}

function resolveEdgeShape(args: { edge: SceneEdgeVM; nodePos: Map<ID, NodeLayout>; scale: number; nodeWidth: number; nodeHeight: number;
  endpointOffsetByKey: Map<EndpointKey, EndpointOffset>; exitPadPx: number; cornerMarginPx: number; handlePushPx: number }): CubicShape | null {
  const { edge, nodePos, scale, nodeWidth, nodeHeight, endpointOffsetByKey, exitPadPx, cornerMarginPx, handlePushPx } = args;

  const aC = getCenterScreen({ nodeId: edge.from, nodePos, scale, nodeWidth, nodeHeight });
  const bC = getCenterScreen({ nodeId: edge.to, nodePos, scale, nodeWidth, nodeHeight });

  if (!aC || !bC) return null;

  const wScreen = nodeWidth * scale;
  const hScreen = nodeHeight * scale;
  const wExit = wScreen + exitPadPx * 2;
  const hExit = hScreen + exitPadPx * 2;

  const base = buildCubic({ aC, bC, wExit, hExit });

  let { p1, p2, c1, c2 } = base;

  const endSlot = endpointOffsetByKey.get(`${edge.id}:end`);
  if (endSlot) {
    const before = p2;

    p2 = slideOnBorderAndReproject({ center: bC, pOnBorder: p2, w: wExit, h: hExit, axis: endSlot.axis, offsetPx: endSlot.offsetPx, cornerMarginPx });

    c2 = add(c2, sub(p2, before));
  }

  if (edge.bidirectional) {
    const startSlot = endpointOffsetByKey.get(`${edge.id}:start`);
    if (startSlot) {
      const before = p1;

      p1 = slideOnBorderAndReproject({ center: aC, pOnBorder: p1, w: wExit, h: hExit, axis: startSlot.axis, offsetPx: startSlot.offsetPx, cornerMarginPx });

      c1 = add(c1, sub(p1, before));
    }
  }

  if (isInsideCenteredRect(c2, bC, wExit, hExit)) {
    const out = normalize(sub(p2, bC));
    c2 = add(p2, mul(out, handlePushPx));
  }

  if (edge.bidirectional && isInsideCenteredRect(c1, aC, wExit, hExit)) {
    const out = normalize(sub(p1, aC));
    c1 = add(p1, mul(out, handlePushPx));
  }

  return { p1, p2, c1, c2 };
}

export function EdgesLayer({ edges, nodePos, scale, nodeWidth, nodeHeight }: Props) {
  const EXIT_PAD_PX = 2;
  const SLOT_STEP_PX = 10;
  const CORNER_MARGIN_PX = 10;
  const HANDLE_PUSH_PX = 22;

  const strokeW = 2 * scale;
  const endDotR = 5 * scale;

  const endpointOffsetByKey = buildEndpointOffsets({ edges, nodePos, scale, nodeWidth, nodeHeight, slotStepPx: SLOT_STEP_PX });

  return (
    <g>
      {edges.map((edge) => {
        const shape = resolveEdgeShape({ edge, nodePos, scale, nodeWidth, nodeHeight, endpointOffsetByKey, exitPadPx: EXIT_PAD_PX, cornerMarginPx: CORNER_MARGIN_PX, handlePushPx: HANDLE_PUSH_PX });

        if (!shape) return null;

        const d = toPathD(shape);

        return (
          <g key={edge.id} pointerEvents="none">
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              className="text-white"
              strokeWidth={strokeW}
              strokeOpacity={0.8}
            />

            <circle
              cx={shape.p2.x}
              cy={shape.p2.y}
              r={endDotR}
              fill="currentColor"
              className="text-white"
              opacity={0.9}
            />

            {edge.bidirectional && (
              <circle
                cx={shape.p1.x}
                cy={shape.p1.y}
                r={endDotR}
                fill="currentColor"
                className="text-white"
                opacity={0.9}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}