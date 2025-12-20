import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { buildStoryGraph } from "@/features/editor/utils/storyGraph";
import {
  type Point,
  GRID_SIZE,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "@/features/editor/components/history/view/types";
import { EdgesLayer } from "@/features/editor/components/history/view/EdgesLayer";
import { SceneNodeCard } from "@/features/editor/components/history/view/SceneNodeCard";

const PADDING = 80;
const AUTO_SCROLL_MARGIN = 40; // px desde el borde donde empieza a auto-scroll
const AUTO_SCROLL_SPEED = 18;  // px por evento (ajusta)


function snapToGrid(p: Point): Point {
  return {
    x: Math.round(p.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(p.y / GRID_SIZE) * GRID_SIZE,
  };
}

function cellOf(p: Point) {
  return { cx: Math.round(p.x / GRID_SIZE), cy: Math.round(p.y / GRID_SIZE) };
}

// “1 grid de separación” incluyendo los 8 vecinos
function tooCloseByGrid(a: Point, b: Point) {
  const A = cellOf(a);
  const B = cellOf(b);
  return Math.abs(A.cx - B.cx) <= 1 && Math.abs(A.cy - B.cy) <= 1;
}

export function HistoryViewPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  /* Store */
  const project = useEditorStore((s) => s.project);
  const zoom = useEditorStore((s) => s.zoom);
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
  const selectNode = useEditorStore((s) => s.selectNode);
  const updateNodeLayout = useEditorStore((s) => s.updateNodeLayout);

  /* Grafo */
  const graph = useMemo(() => buildStoryGraph(project), [project]);

  /* Viewport real del panel (para decidir si hace falta scroll) */
  const [viewport, setViewport] = useState({ w: 1200, h: 800 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    });

    ro.observe(el);
    setViewport({ w: el.clientWidth, h: el.clientHeight });

    return () => ro.disconnect();
  }, []);

  /* Posiciones locales (drag fluido) */
  const [nodePos, setNodePos] = useState(() => {
    const m = new Map<ID, Point>();
    for (const n of graph.nodes) m.set(n.id, snapToGrid({ ...n.pos }));
    return m;
  });

  /* Si cambia el proyecto/grafo, re-sincroniza posiciones locales */
  useEffect(() => {
    setNodePos(() => {
      const m = new Map<ID, Point>();
      for (const n of graph.nodes) m.set(n.id, snapToGrid({ ...n.pos }));
      return m;
    });
  }, [project?.id, graph.nodes]);

  /* Drag nodo */
  const draggingRef = useRef<{
    nodeId: ID;
    pointerId: number;
    originClient: Point;
    startPos: Point;
  } | null>(null);

  const scale = (zoom ?? 100) / 100;

  const startDragNode = (nodeId: ID, e: React.PointerEvent<SVGGElement>) => {
    e.stopPropagation();
    (e.currentTarget as SVGGElement).setPointerCapture(e.pointerId);

    const p = nodePos.get(nodeId) ?? { x: 0, y: 0 };
    draggingRef.current = {
      nodeId,
      pointerId: e.pointerId,
      originClient: { x: e.clientX, y: e.clientY },
      startPos: p,
    };
  };

  const moveDragNode = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = draggingRef.current;
    if (!d) return;
    if (d.pointerId !== e.pointerId) return;

    // movimiento en pantalla está escalado → convertir a coords “mundo”
    const dxWorld = (e.clientX - d.originClient.x) / scale;
    const dyWorld = (e.clientY - d.originClient.y) / scale;

    const raw = { x: d.startPos.x + dxWorld, y: d.startPos.y + dyWorld };
    const snapped = snapToGrid(raw);

    const container = containerRef.current;
    if (container) {
      const r = container.getBoundingClientRect();

      let vx = 0;
      let vy = 0;

      if (e.clientX < r.left + AUTO_SCROLL_MARGIN) vx = -AUTO_SCROLL_SPEED;
      else if (e.clientX > r.right - AUTO_SCROLL_MARGIN) vx = AUTO_SCROLL_SPEED;

      if (e.clientY < r.top + AUTO_SCROLL_MARGIN) vy = -AUTO_SCROLL_SPEED;
      else if (e.clientY > r.bottom - AUTO_SCROLL_MARGIN) vy = AUTO_SCROLL_SPEED;

      if (vx !== 0 || vy !== 0) {
        container.scrollLeft += vx;
        container.scrollTop += vy;

        // IMPORTANTÍSIMO: ajusta el origen del drag para que no “salte” el nodo
        d.originClient = { x: d.originClient.x + vx, y: d.originClient.y + vy };
      }
    }

    setNodePos((prev) => {
      const next = new Map(prev);
      next.set(d.nodeId, snapped);
      return next;
    });
  };

  const endDragNode = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = draggingRef.current;
    if (!d) return;

    const current = nodePos.get(d.nodeId);
    const snapped = current ? snapToGrid(current) : d.startPos;

    // validar separación mínima
    let invalid = false;
    nodePos.forEach((p, id) => {
      if (id === d.nodeId) return;
      if (tooCloseByGrid(snapped, p)) invalid = true;
    });

    if (invalid) {
      // revert
      setNodePos((prev) => {
        const next = new Map(prev);
        next.set(d.nodeId, d.startPos);
        return next;
      });
    } else {
      updateNodeLayout(d.nodeId, snapped);
    }

    draggingRef.current = null;

    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  /* Bounds del contenido (en coords mundo) */
  const contentBounds = useMemo(() => {
    if (nodePos.size === 0) return { minX: 0, minY: 0, maxX: 1200, maxY: 800 };

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    nodePos.forEach((p) => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_WIDTH);
      maxY = Math.max(maxY, p.y + NODE_HEIGHT);
    });

    // padding alrededor (sirve para que no pegues el contenido al borde)
    minX -= PADDING;
    minY -= PADDING;
    maxX += PADDING;
    maxY += PADDING;

    return { minX, minY, maxX, maxY };
  }, [nodePos]);

  // Origen “normalizado” (solo lo actualizamos cuando NO hay drag, para evitar saltos)
  const [origin, setOrigin] = useState<Point>({ x: 0, y: 0 });

  // Guardamos un “min estable” para usarlo durante el drag
  const stableMinRef = useRef<{ minX: number; minY: number }>({ minX: 0, minY: 0 });

  useEffect(() => {
    if (draggingRef.current) return;
    setOrigin({ x: contentBounds.minX, y: contentBounds.minY });
    stableMinRef.current = { minX: contentBounds.minX, minY: contentBounds.minY };
  }, [contentBounds.minX, contentBounds.minY]);

  // Bounds efectivos:
  // - min estable durante drag (para que no cambie el marco de referencia)
  // - max dinámico SIEMPRE (para que el SVG crezca durante drag → sin “muro”)
  const effectiveBounds = useMemo(() => {
    const dragging = !!draggingRef.current;

    const minX = dragging ? stableMinRef.current.minX : contentBounds.minX;
    const minY = dragging ? stableMinRef.current.minY : contentBounds.minY;

    let maxX = -Infinity;
    let maxY = -Infinity;

    nodePos.forEach((p) => {
      maxX = Math.max(maxX, p.x + NODE_WIDTH);
      maxY = Math.max(maxY, p.y + NODE_HEIGHT);
    });

    if (!Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      maxX = 1200;
      maxY = 800;
    }

    // padding hacia + (no tocamos el origen aquí)
    maxX += PADDING;
    maxY += PADDING;

    return { minX, minY, maxX, maxY };
  }, [nodePos, contentBounds.minX, contentBounds.minY]);

  // Origen que se usa para render: estable durante drag
  const renderOrigin: Point = draggingRef.current
    ? { x: stableMinRef.current.minX, y: stableMinRef.current.minY }
    : origin;

  const worldWidth = effectiveBounds.maxX - renderOrigin.x;
  const worldHeight = effectiveBounds.maxY - renderOrigin.y;

  // Tamaño real del SVG en px (para que el navegador genere scrollbars)
  const svgWidth = Math.max(viewport.w, worldWidth * scale);
  const svgHeight = Math.max(viewport.h, worldHeight * scale);

  /* “Pan” arrastrando fondo: se hace moviendo scroll del contenedor */
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{
    pointerId: number;
    originClient: Point;
    startScroll: { left: number; top: number };
  } | null>(null);

  const startPan = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    const clickedOnNode = target.closest?.("[data-story-node='true']");
    if (clickedOnNode) return;

    const container = containerRef.current;
    if (!container) return;

    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);

    setIsPanning(true);
    panStartRef.current = {
      pointerId: e.pointerId,
      originClient: { x: e.clientX, y: e.clientY },
      startScroll: { left: container.scrollLeft, top: container.scrollTop },
    };
  };

  const movePan = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;
    const st = panStartRef.current;
    if (!st || st.pointerId !== e.pointerId) return;

    const container = containerRef.current;
    if (!container) return;

    const dx = e.clientX - st.originClient.x;
    const dy = e.clientY - st.originClient.y;

    // drag “agarra el lienzo”: mover ratón a la derecha -> scroll a la izquierda
    container.scrollLeft = st.startScroll.left - dx;
    container.scrollTop = st.startScroll.top - dy;
  };

  const endPan = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isPanning) return;

    setIsPanning(false);
    panStartRef.current = null;

    try {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  /* Doble click: ir a escena */
  const handleNodeDoubleClick = (nodeId: ID) => {
    selectNode(nodeId);
    setPrimaryMode("escena");
    setSecondaryMode("crear");
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-lg border-2 border-slate-700 overflow-auto bg-slate-900"
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        onPointerDown={startPan}
        onPointerMove={(e) => {
          movePan(e);
          moveDragNode(e);
        }}
        onPointerUp={(e) => {
          endPan(e);
          endDragNode(e);
        }}
        onPointerCancel={(e) => {
          endPan(e);
          endDragNode(e);
        }}
        style={{
          touchAction: "none",
          cursor: isPanning ? "grabbing" : "grab",
          display: "block",
        }}
      >
        <defs>
          <pattern
            id="grid"
            width={GRID_SIZE * scale}
            height={GRID_SIZE * scale}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${GRID_SIZE * scale} 0 L 0 0 0 ${GRID_SIZE * scale}`}
              fill="none"
              stroke="currentColor"
              className="text-white"
              strokeWidth="2"
              strokeDasharray="3 6"
              opacity="0.15"
            />
          </pattern>

          <marker
            id="arrow-end"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            {/* Triángulo: M (start) + L + L + z (cierra) */}
            <path d="M 0 2 L 8 5 L 0 8 z" fill="#e9d9d9ff" />
          </marker>

          <marker
            id="arrow-start"
            viewBox="0 0 10 10"
            refX="2"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto"
          >
            <path d="M 8 2 L 0 5 L 8 8 z" fill="currentColor" />
          </marker>
        </defs>

        {/* Fondo con grid: un rect gigante relleno con el patrón */}
        <rect x={0} y={0} width={svgWidth} height={svgHeight} fill="url(#grid)" />

        <EdgesLayer
          edges={graph.edges}
          nodePos={nodePos}
          origin={renderOrigin}
          scale={scale}
          nodeWidth={NODE_WIDTH}
          nodeHeight={NODE_HEIGHT}
        />

        {graph.nodes.map((n) => {
          const p = nodePos.get(n.id) ?? n.pos;
          return (
            <SceneNodeCard
              key={n.id}
              node={n}
              pos={p}
              origin={renderOrigin}
              scale={scale}
              zoom={zoom ?? 100}
              onPointerDown={(e) => startDragNode(n.id, e)}
              onDoubleClick={() => handleNodeDoubleClick(n.id)}
            />
          );
        })}
      </svg>
    </div>
  );
}
