import { useState, useEffect } from "react";
import type { Hotspot, ID, Node, PlacedItem, PlacedNpc } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";

export interface ActiveSceneHotspotsResult {
  nodeId: ID | "DRAFT_NODE" | null;
  hotspots: Hotspot[];
  placedItems: PlacedItem[];
  placedNpcs: PlacedNpc[];
  imageLogicalPath?: string;
  node?: Node;
}

export function useActiveSceneHotspots(): ActiveSceneHotspotsResult {
  const sceneMode = useEditorStore((s) => s.sceneMode);
  const draftScene = useEditorStore((s) => s.draftScene);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const project = useEditorStore((s) => s.project);

  const [activeScene, setActiveScene] = useState<ActiveSceneHotspotsResult>({
    nodeId: null,
    hotspots: [],
    placedItems: [],
    placedNpcs: [],
    imageLogicalPath: undefined,
  });

  useEffect(() => {
    if (sceneMode === "creating") {
      setActiveScene({
        nodeId: "DRAFT_NODE",
        hotspots: draftScene.hotspots ?? [],
        placedItems: draftScene.placedItems ?? [],
        placedNpcs: draftScene.placedNpcs ?? [],
        imageLogicalPath: draftScene.image,
      });
      return;
    }

    if (!project || !selectedNodeId) {
      setActiveScene({
        nodeId: null,
        hotspots: [],
        placedItems: [],
        placedNpcs: [],
        imageLogicalPath: undefined,
      });
      return;
    }

    const node = project.nodes.find((n) => n.id === selectedNodeId);

    setActiveScene({
      nodeId: selectedNodeId,
      hotspots: node?.hotspots ?? [],
      placedItems: node?.placedItems ?? [],
      placedNpcs: node?.placedNpcs ?? [],
      imageLogicalPath: node?.image,
      node,
    });
  }, [sceneMode, draftScene, selectedNodeId, project]);

  return activeScene;
}