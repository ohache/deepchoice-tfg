import { useMemo } from "react";
import type { ID } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { buildStoryGraph } from "@/features/editor/history/view/storyGraph";
import { GRID_TILE_SIZE, NODE_SIZE, NODE_SLOT_OFFSET } from "@/features/editor/history/view/historyViewTypes";
import { VIEW_CONFIG } from "@/features/editor/history/view/historyViewGeometry";
import { EdgesLayer } from "@/features/editor/history/view/EdgesLayer";
import { SceneNodeCard } from "@/features/editor/history/view/SceneNodeCard";
import { useHistoryInteraction } from "@/features/editor/history/view/useHistoryInteraction";

export function HistoryViewPanel() {
  const project = useEditorStore((s) => s.project);
  const zoom = useEditorStore((s) => s.zoom);

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);
  const enterEditNodeMode = useEditorStore((s) => s.enterEditNodeMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const updateNodeLayoutsBatch = useEditorStore((s) => s.updateNodeLayoutsBatch);

  const graph = useMemo(() => buildStoryGraph(project), [project]);
  const scale = (zoom ?? 100) / 100;

  const { svgRef, svgWidth, svgHeight, selectionBox, selected, nodePos, isPanning, beginBackgroundPointerDown, updatePan, updateSelectionBox,
    updateNodeDrag, endBackgroundPointerUp, endNodeDrag, onPointerCancel, beginNodeDrag }
    = useHistoryInteraction({ graphNodes: graph.nodes, scale, projectId: project?.id, primaryMode, secondaryMode, updateNodeLayoutsBatch });

  const openSceneFromNode = (nodeId: ID) => {
    setPrimaryMode("escena");
    setSecondaryMode("crear");
    enterEditNodeMode(nodeId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    updatePan(e);
    updateSelectionBox(e);
    updateNodeDrag(e);
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    endBackgroundPointerUp(e);
    endNodeDrag(e);
  };

  const svgCursor = isPanning ? "grabbing" : selectionBox ? "crosshair" : "default";

  const svgStyle: React.CSSProperties = { width: `${svgWidth}px`, height: `${svgHeight}px`, touchAction: "none", cursor: svgCursor, display: "block" };

  const gridWidth = Math.max(0, svgWidth - VIEW_CONFIG.gridInsetPx * 2);
  const gridHeight = Math.max(0, svgHeight - VIEW_CONFIG.gridInsetPx * 2);

  return (
    <div className="inline-block min-w-full rounded-lg border-2 border-slate-700 bg-slate-900">
      <svg
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={beginBackgroundPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={onPointerCancel}
        style={svgStyle}
      >
        <defs>
          <pattern
            id="grid"
            width={GRID_TILE_SIZE * scale}
            height={GRID_TILE_SIZE * scale}
            patternUnits="userSpaceOnUse"
            patternTransform="translate(0 0)"
          >
            <path
              d={`M ${GRID_TILE_SIZE * scale} 0 L 0 0 0 ${GRID_TILE_SIZE * scale}`}
              fill="none"
              stroke="currentColor"
              className="text-white"
              strokeWidth="2"
              opacity="0.12"
              strokeDasharray={`${6 * scale} ${6 * scale}`}
              strokeLinecap="round"
            />
            <rect
              x={NODE_SLOT_OFFSET * scale}
              y={NODE_SLOT_OFFSET * scale}
              width={NODE_SIZE * scale}
              height={NODE_SIZE * scale}
              fill="none"
              stroke="currentColor"
              className="text-white"
              strokeWidth="1"
              opacity="0.08"
              strokeDasharray={`${6 * scale} ${6 * scale}`}
              strokeLinecap="round"
            />
          </pattern>
        </defs>

        <rect
          x={VIEW_CONFIG.gridInsetPx}
          y={VIEW_CONFIG.gridInsetPx}
          width={gridWidth}
          height={gridHeight}
          fill="url(#grid)"
        />

        <g pointerEvents="none">
          <EdgesLayer
            edges={graph.edges}
            nodePos={nodePos}
            scale={scale}
            nodeWidth={NODE_SIZE}
            nodeHeight={NODE_SIZE}
          />
        </g>

        {selectionBox ? (
          <rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.w}
            height={selectionBox.h}
            fill="currentColor"
            className="text-sky-400"
            opacity={0.12}
            stroke="currentColor"
            strokeWidth={1}
          />
        ) : null}

        {graph.nodes.map((node) => {
          const pos = nodePos.get(node.id) ?? node.pos;
          const isSelected = selected.has(node.id);

          return (
            <g key={node.id}>
              {isSelected ? (
                <rect
                  x={pos.x * scale}
                  y={pos.y * scale}
                  width={NODE_SIZE * scale}
                  height={NODE_SIZE * scale}
                  rx={10 * scale}
                  fill="none"
                  stroke="currentColor"
                  className="text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]"
                  strokeWidth={6 * scale}
                  opacity={0.9}
                  pointerEvents="none"
                />
              ) : null}

              <SceneNodeCard
                node={node}
                pos={pos}
                scale={scale}
                onPointerDown={(e) => beginNodeDrag(node.id, e)}
                onDoubleClick={() => openSceneFromNode(node.id)}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}