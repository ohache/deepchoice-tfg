import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ID, NodeLayout } from "@/domain/types";
import { NODE_SIZE } from "@/features/editor/history/view/historyViewTypes";
import { ORIGIN, VIEW_CONFIG, MIN_WORLD_X, MIN_WORLD_Y, nodeRectWorld, rectsIntersect, shareSameTile, snapToNodeSlotNearest } from "@/features/editor/history/view/historyViewGeometry";

type GraphNodeRef = { id: ID; pos: NodeLayout };

type DragState = {
  pointerId: number;
  startClient: { x: number; y: number };
  startPosWorldById: Map<ID, NodeLayout>;
  lastRawById: Map<ID, NodeLayout>;
  dragging: boolean;
  lastClient: { x: number; y: number };
};

type SelectionState = {
  pointerId: number;
  startScreen: { x: number; y: number };
  active: boolean;
};

type PanState = {
  pointerId: number;
  originClient: NodeLayout;
  startScroll: { left: number; top: number };
};

type AutoScrollState = {
  raf: number | null;
  vx: number;
  vy: number;
  lastTs: number;
};

function buildSnappedNodePosMap(graphNodes: GraphNodeRef[]) {
  const map = new Map<ID, NodeLayout>();
  for (const n of graphNodes) map.set(n.id, snapToNodeSlotNearest(n.pos));
  return map;
}

function computeEdgeSpeed(client: number, min: number, max: number, margin: number, maxSpeed: number) {
  if (client < min + margin) {
    const t = (min + margin - client) / margin;
    return -maxSpeed * Math.min(1, t * t);
  }

  if (client > max - margin) {
    const t = (client - (max - margin)) / margin;
    return +maxSpeed * Math.min(1, t * t);
  }

  return 0;
}

function hasInvalidDrop(args: { finalById: Map<ID, NodeLayout>; nodePos: Map<ID, NodeLayout> }) {
  const { finalById, nodePos } = args;

  let invalid = false;
  const movedIds = new Set(finalById.keys());

  nodePos.forEach((pos, id) => {
    if (movedIds.has(id)) return;

    const staticSnapped = snapToNodeSlotNearest(pos);
    finalById.forEach((pFinal) => {
      if (shareSameTile(pFinal, staticSnapped)) invalid = true;
    });
  });

  const finals = Array.from(finalById.values());
  for (let i = 0; i < finals.length; i++) {
    for (let j = i + 1; j < finals.length; j++) {
      if (shareSameTile(finals[i], finals[j])) invalid = true;
    }
  }

  return invalid;
}

export function useHistoryInteraction(args: { graphNodes: GraphNodeRef[]; scale: number; projectId: string | undefined; primaryMode: string;
  secondaryMode: string; updateNodeLayoutsBatch: (items: Array<{ id: ID; pos: { x: number; y: number } }>) => void }) {
  const { graphNodes, scale, projectId, primaryMode, secondaryMode, updateNodeLayoutsBatch } = args;

  const scrollHostRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [viewport, setViewport] = useState({ w: 1200, h: 800 });

  const [selected, setSelected] = useState<Set<ID>>(() => new Set());
  const selectedRef = useRef<Set<ID>>(new Set());

  useEffect(() => {selectedRef.current = selected;}, [selected]);

  const [selectionBox, setSelectionBox] = useState<null | { x: number; y: number; w: number; h: number }>(null);

  const [nodePos, setNodePos] = useState(() => buildSnappedNodePosMap(graphNodes));
  const [isPanning, setIsPanning] = useState(false);

  const dragStateRef = useRef<DragState | null>(null);
  const selectStateRef = useRef<SelectionState | null>(null);
  const panStateRef = useRef<PanState | null>(null);

  const autoScrollRef = useRef<AutoScrollState>({ raf: null, vx: 0, vy: 0, lastTs: 0 });

  const getScrollEl = () => scrollHostRef.current;

  const clearSelectionInteraction = () => {
    selectStateRef.current = null;
    setSelectionBox(null);
  };

  const clearPanInteraction = () => {
    setIsPanning(false);
    panStateRef.current = null;
  };

  const stopAutoScroll = () => {
    autoScrollRef.current.vx = 0;
    autoScrollRef.current.vy = 0;

    if (autoScrollRef.current.raf) {
      cancelAnimationFrame(autoScrollRef.current.raf);
      autoScrollRef.current.raf = null;
    }
  };

  const clearDragInteraction = () => {
    dragStateRef.current = null;
    stopAutoScroll();
  };

  const startPan = (pointerId: number, clientX: number, clientY: number, host: HTMLElement) => {
    setIsPanning(true);
    panStateRef.current = {
      pointerId,
      originClient: { x: clientX, y: clientY },
      startScroll: { left: host.scrollLeft, top: host.scrollTop },
    };
  };

  const clientToSvgScreen = (clientX: number, clientY: number) => {
    const svgEl = svgRef.current;
    if (!svgEl) return { x: 0, y: 0 };

    const rect = svgEl.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const screenToWorld = (pScreen: { x: number; y: number }, originWorld: NodeLayout) => ({
    x: pScreen.x / scale + originWorld.x,
    y: pScreen.y / scale + originWorld.y,
  });

  useLayoutEffect(() => {
    scrollHostRef.current = (svgRef.current?.closest?.("[data-editor-scroll='true']") as HTMLElement | null) ?? null;}, []);

  useLayoutEffect(() => {
    const host = scrollHostRef.current;
    if (!host) return;

    const ro = new ResizeObserver(() => setViewport({ w: host.clientWidth, h: host.clientHeight }));

    ro.observe(host);
    setViewport({ w: host.clientWidth, h: host.clientHeight });

    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (dragStateRef.current) return;
    if (selectStateRef.current) return;

    setNodePos(buildSnappedNodePosMap(graphNodes));
  }, [projectId, graphNodes.length]);

  const applyDragFromClient = (clientX: number, clientY: number) => {
    const drag = dragStateRef.current;
    if (!drag) return;

    const dxPx = clientX - drag.startClient.x;
    const dyPx = clientY - drag.startClient.y;

    let dxWorld = dxPx / scale;
    let dyWorld = dyPx / scale;

    let minX = Infinity;
    let minY = Infinity;

    drag.startPosWorldById.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
    });

    if (minX + dxWorld < MIN_WORLD_X) dxWorld = MIN_WORLD_X - minX;
    if (minY + dyWorld < MIN_WORLD_Y) dyWorld = MIN_WORLD_Y - minY;

    const nextRawById = new Map<ID, NodeLayout>();

    drag.startPosWorldById.forEach((startPos, id) => {
      nextRawById.set(id, {
        x: Math.max(MIN_WORLD_X, startPos.x + dxWorld),
        y: Math.max(MIN_WORLD_Y, startPos.y + dyWorld),
      });
    });

    drag.lastRawById = nextRawById;

    setNodePos((prev) => {
      const next = new Map(prev);
      nextRawById.forEach((p, id) => next.set(id, p));
      return next;
    });
  };

  const beginNodeDrag = (nodeId: ID, e: React.PointerEvent<SVGGElement>) => {
    if (e.button === 2) return;
    e.stopPropagation();

    if (selectStateRef.current) return;

    if (!selectedRef.current.has(nodeId)) {
      const only = new Set<ID>([nodeId]);
      setSelected(only);
      selectedRef.current = only;
    }

    const idsToDrag = Array.from(selectedRef.current);
    const startPosWorldById = new Map<ID, NodeLayout>();
    const lastRawById = new Map<ID, NodeLayout>();

    for (const id of idsToDrag) {
      const p0 = nodePos.get(id) ?? { x: MIN_WORLD_X, y: MIN_WORLD_Y };
      const p = snapToNodeSlotNearest(p0);
      startPosWorldById.set(id, p);
      lastRawById.set(id, p);
    }

    dragStateRef.current = {
      pointerId: e.pointerId,
      startClient: { x: e.clientX, y: e.clientY },
      startPosWorldById,
      lastRawById,
      dragging: false,
      lastClient: { x: e.clientX, y: e.clientY },
    };

    try {e.currentTarget.setPointerCapture(e.pointerId);}
    catch {}
  };

  const updateNodeDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;
    if (selectStateRef.current) return;

    drag.lastClient = { x: e.clientX, y: e.clientY };

    const dx0 = e.clientX - drag.startClient.x;
    const dy0 = e.clientY - drag.startClient.y;

    if (!drag.dragging) {
      const dist2 = dx0 * dx0 + dy0 * dy0;
      const t = VIEW_CONFIG.dragStartThresholdPx;
      if (dist2 < t * t) return;
      drag.dragging = true;
    }

    const scrollEl = getScrollEl();
    if (scrollEl) {
      const rect = scrollEl.getBoundingClientRect();
      const margin = VIEW_CONFIG.autoScroll.marginPx;
      const maxSpeed = VIEW_CONFIG.autoScroll.speedPx;

      autoScrollRef.current.vx = computeEdgeSpeed(e.clientX, rect.left, rect.right, margin, maxSpeed);
      autoScrollRef.current.vy = computeEdgeSpeed(e.clientY, rect.top, rect.bottom, margin, maxSpeed);

      if (autoScrollRef.current.vx !== 0 || autoScrollRef.current.vy !== 0) {
        if (!autoScrollRef.current.raf) {
          autoScrollRef.current.lastTs = performance.now();

          const step = (ts: number) => {
            autoScrollRef.current.raf = requestAnimationFrame(step);

            const scrollEl2 = getScrollEl();
            const drag2 = dragStateRef.current;

            if (!scrollEl2 || !drag2 || !drag2.dragging) {
              stopAutoScroll();
              return;
            }

            const dtMs = ts - autoScrollRef.current.lastTs;
            autoScrollRef.current.lastTs = ts;

            const k = Math.min(3, dtMs / 16.67);
            const wantX = autoScrollRef.current.vx * k;
            const wantY = autoScrollRef.current.vy * k;

            if (wantX === 0 && wantY === 0) return;

            const prevLeft = scrollEl2.scrollLeft;
            const prevTop = scrollEl2.scrollTop;

            scrollEl2.scrollLeft = prevLeft + wantX;
            scrollEl2.scrollTop = prevTop + wantY;

            const realDx = scrollEl2.scrollLeft - prevLeft;
            const realDy = scrollEl2.scrollTop - prevTop;

            drag2.startClient = {
              x: drag2.startClient.x - realDx,
              y: drag2.startClient.y - realDy,
            };

            applyDragFromClient(drag2.lastClient.x, drag2.lastClient.y);
          };

          autoScrollRef.current.raf = requestAnimationFrame(step);
        }
      } else {
        stopAutoScroll();
      }
    }

    applyDragFromClient(e.clientX, e.clientY);
  };

  const endNodeDrag = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    if (drag.pointerId !== e.pointerId) return;

    if (!drag.dragging) {
      dragStateRef.current = null;
      return;
    }

    const startPosWorldById = drag.startPosWorldById;
    const lastRawById = drag.lastRawById;

    const finalById = new Map<ID, NodeLayout>();
    lastRawById.forEach((raw, id) => finalById.set(id, snapToNodeSlotNearest(raw)));

    if (hasInvalidDrop({ finalById, nodePos })) {
      setNodePos((prev) => {
        const next = new Map(prev);
        startPosWorldById.forEach((p, id) => next.set(id, p));
        return next;
      });

      clearDragInteraction();
      return;
    }

    setNodePos((prev) => {
      const next = new Map(prev);
      finalById.forEach((pFinal, id) => next.set(id, pFinal));
      return next;
    });

    const batchItems: Array<{ id: ID; pos: { x: number; y: number } }> = [];
    finalById.forEach((pFinal, id) => batchItems.push({ id, pos: pFinal }));
    updateNodeLayoutsBatch(batchItems);

    clearDragInteraction();
  };

  const contentBounds = useMemo(() => {
    if (nodePos.size === 0) return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodePos.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_SIZE);
      maxY = Math.max(maxY, p.y + NODE_SIZE);
    });

    return {
      minX: Math.max(0, minX - VIEW_CONFIG.paddingPx),
      minY: Math.max(0, minY - VIEW_CONFIG.paddingPx),
      maxX: maxX + VIEW_CONFIG.paddingPx,
      maxY: maxY + VIEW_CONFIG.paddingPx,
    };
  }, [nodePos]);

  const svgWidth = Math.max(viewport.w, (contentBounds.maxX || 1200) * scale);
  const svgHeight = Math.max(viewport.h, (contentBounds.maxY || 800) * scale);

  const lastFrameKeyRef = useRef<string>("");

  useEffect(() => {
    const host = scrollHostRef.current;
    if (!host) return;
    if (dragStateRef.current || selectStateRef.current) return;

    const isHistoriaVista = primaryMode === "historia" && secondaryMode === "vista";
    if (!isHistoriaVista) return;

    const key = `${projectId ?? "no-project"}|${primaryMode}|${secondaryMode}`;
    if (lastFrameKeyRef.current === key) return;
    lastFrameKeyRef.current = key;

    const left = Math.max(0, contentBounds.minX * scale);
    const top = Math.max(0, contentBounds.minY * scale);

    host.scrollLeft = left;
    host.scrollTop = top;
  }, [projectId, primaryMode, secondaryMode, scale, contentBounds.minX, contentBounds.minY]);

  const beginBackgroundPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const host = scrollHostRef.current;
    if (!host) return;

    if (e.button === 2 || e.button === 1) {
      if (e.button === 2) e.preventDefault();

      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
      startPan(e.pointerId, e.clientX, e.clientY, host);
      return;
    }

    const target = e.target as Element;

    if (dragStateRef.current) return;
    if (target.closest?.("[data-story-node='true']")) return;
    if (target.tagName.toLowerCase() === "path") return;

    if (e.button === 0) {
      const startScreen = clientToSvgScreen(e.clientX, e.clientY);

      selectStateRef.current = { pointerId: e.pointerId, startScreen, active: false };
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);

      const empty = new Set<ID>();
      setSelected(empty);
      selectedRef.current = empty;
    }
  };

  const updatePan = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;

    const pan = panStateRef.current;
    if (!pan || pan.pointerId !== e.pointerId) return;

    const host = scrollHostRef.current;
    if (!host) return;

    const dx = e.clientX - pan.originClient.x;
    const dy = e.clientY - pan.originClient.y;

    host.scrollLeft = pan.startScroll.left - dx;
    host.scrollTop = pan.startScroll.top - dy;
  };

  const updateSelectionBox = (e: React.PointerEvent<SVGSVGElement>) => {
    const sel = selectStateRef.current;
    if (!sel) return;
    if (sel.pointerId !== e.pointerId) return;
    if (dragStateRef.current) return;

    const cur = clientToSvgScreen(e.clientX, e.clientY);

    const x1 = Math.min(sel.startScreen.x, cur.x);
    const y1 = Math.min(sel.startScreen.y, cur.y);
    const x2 = Math.max(sel.startScreen.x, cur.x);
    const y2 = Math.max(sel.startScreen.y, cur.y);

    const w = x2 - x1;
    const h = y2 - y1;

    if (!sel.active) {
      if (w < VIEW_CONFIG.selectBoxMinPx && h < VIEW_CONFIG.selectBoxMinPx) return;
      sel.active = true;
    }

    setSelectionBox({ x: x1, y: y1, w, h });

    const boxWorldTopLeft = screenToWorld({ x: x1, y: y1 }, ORIGIN);
    const boxWorld = {
      x: boxWorldTopLeft.x,
      y: boxWorldTopLeft.y,
      w: w / scale,
      h: h / scale,
    };

    const nextSel = new Set<ID>();
    graphNodes.forEach((n) => {
      const raw = nodePos.get(n.id) ?? n.pos;
      const p = snapToNodeSlotNearest(raw);
      if (rectsIntersect(nodeRectWorld(p), boxWorld)) nextSel.add(n.id);
    });

    setSelected(nextSel);
    selectedRef.current = nextSel;
  };

  const endBackgroundPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPanning) {
      clearPanInteraction();
      try {(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);} 
      catch {}
      return;
    }

    const sel = selectStateRef.current;
    if (sel && sel.pointerId === e.pointerId) {
      clearSelectionInteraction();
      try {(e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);} 
      catch {}
    }
  };

  const onPointerCancel = (e: React.PointerEvent<SVGSVGElement>) => {
    clearSelectionInteraction();
    clearDragInteraction();
    clearPanInteraction();

    endBackgroundPointerUp(e);
    endNodeDrag(e);
  };

  return { svgRef, svgWidth, svgHeight, selectionBox, selected, nodePos, viewport, isPanning, beginBackgroundPointerDown, updatePan,
    updateSelectionBox, updateNodeDrag, endBackgroundPointerUp, endNodeDrag, onPointerCancel, beginNodeDrag, stopAutoScroll };
}