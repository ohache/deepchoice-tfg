import { useMemo } from "react";
import type { ID, Project, Hotspot, FreeHotspotEffect, FreeHotspotEffectType } from "@/domain/types";
import { getAvailableTargetNodes } from "@/features/editor/utils/hotspotUtils";

export type SceneHotspotMode = "create" | "edit";

interface UseSceneHotspotsLogicOptions {
  mode: SceneHotspotMode;
  project: Project | null | undefined;
  hotspots: Hotspot[];
  contextNodeId: ID | "DRAFT_NODE";

  addHotspot: () => void;
  removeHotspot: (hotspotId: ID) => void;

  setHotspotAction: (hotspotId: ID, actionType: FreeHotspotEffectType) => void;
  updateHotspotTarget: (hotspotId: ID, targetNodeId: ID) => void;

  activeDrawingHotspotId: ID | null;
  setActiveHotspotDrawingId: (hotspotId: ID | null) => void;
  clearHotspotShape: (hotspotId: ID) => void;

  hasImage: boolean;
}

/* Convención temporal: el "tipo" del hotspot es el tipo del primer effect de la primera interaction */
function getPrimaryEffect(hs: Hotspot): FreeHotspotEffect | undefined {
  return hs.interactions?.[0]?.effects?.[0];
}

function getHotspotActionType(hs: Hotspot): FreeHotspotEffectType | undefined {
  const t = getPrimaryEffect(hs)?.type;
  if (t === "goToNode" || t === "showText" || t === "showMessage" || t === "setFlag") return t;
  return undefined;
}

function getHotspotTargetId(hs: Hotspot): ID | "" {
  const eff = getPrimaryEffect(hs);
  return eff && eff.type === "goToNode" ? (eff.targetNodeId as ID) : "";
}

function isGoToNodeHotspot(hs: Hotspot): boolean {
  return getHotspotActionType(hs) === "goToNode";
}

function resolveNodeLabel(project: Project, nodeId: ID): string | undefined {
  const node = project.nodes.find((n) => n.id === nodeId);
  return node?.title || node?.id;
}

export function useSceneHotspotsLogic(options: UseSceneHotspotsLogicOptions) {
  const {
    mode,
    project,
    hotspots,
    contextNodeId,
    addHotspot,
    removeHotspot,
    setHotspotAction,
    updateHotspotTarget,
    activeDrawingHotspotId,
    setActiveHotspotDrawingId,
    clearHotspotShape,
    hasImage,
  } = options;

  const canChooseTargets = useMemo(() => {
    if (!project) return false;
    if (mode === "create") return project.nodes.length > 0;
    return project.nodes.length >= 2;
  }, [project, mode]);

  const targetUseCount = useMemo(() => {
    const counts = new Map<ID, number>();

    for (const hs of hotspots) {
      if (!isGoToNodeHotspot(hs)) continue;
      const t = getHotspotTargetId(hs);
      if (!t) continue;
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }

    return counts;
  }, [hotspots]);

  const usedTargetsByHotspotId = useMemo(() => {
    const out = new Map<ID, Set<ID>>();

    for (const hs of hotspots) {
      const usedByOthers = new Set<ID>();
      const myTarget = isGoToNodeHotspot(hs) ? getHotspotTargetId(hs) : "";

      for (const [targetId, count] of targetUseCount.entries()) {
        const effectiveCount = targetId === myTarget ? count - 1 : count;
        if (effectiveCount > 0) usedByOthers.add(targetId);
      }

      out.set(hs.id, usedByOthers);
    }

    return out;
  }, [hotspots, targetUseCount]);

  const availableNodesByHotspotId = useMemo(() => {
    const out = new Map<ID, { id: ID; title?: string }[]>();

    if (!project) {
      for (const hs of hotspots) out.set(hs.id, []);
      return out;
    }

    for (const hs of hotspots) {
      if (!isGoToNodeHotspot(hs) || !canChooseTargets) {
        out.set(hs.id, []);
        continue;
      }

      const usedByOthers = usedTargetsByHotspotId.get(hs.id) ?? new Set<ID>();

      const baseNodes = getAvailableTargetNodes(project.nodes, contextNodeId, Array.from(usedByOthers));
      const baseOptions = baseNodes.map((n) => ({ id: n.id as ID, title: n.title }));

      const currentTargetId = getHotspotTargetId(hs);
      const hasCurrentInBase = !!currentTargetId && baseOptions.some((n) => n.id === currentTargetId);

      const patched =
        currentTargetId && !hasCurrentInBase
          ? [{ id: currentTargetId, title: resolveNodeLabel(project, currentTargetId) }, ...baseOptions]
          : baseOptions;

      out.set(hs.id, patched);
    }

    return out;
  }, [project, hotspots, contextNodeId, canChooseTargets, usedTargetsByHotspotId]);

  const handleHotspotRemove = (hotspotId: ID) => {
    if (activeDrawingHotspotId === hotspotId) setActiveHotspotDrawingId(null);
    removeHotspot(hotspotId);
  };

  const handleHotspotActionChange = (hotspotId: ID, actionType: FreeHotspotEffectType) => {
    if (activeDrawingHotspotId === hotspotId) setActiveHotspotDrawingId(null);
    setHotspotAction(hotspotId, actionType);
  };

  const handleHotspotTargetChange = (hotspotId: ID, targetNodeId: ID) => {
    const usedByOthers = usedTargetsByHotspotId.get(hotspotId);
    if (usedByOthers?.has(targetNodeId)) return;

    updateHotspotTarget(hotspotId, targetNodeId);

    if (!hasImage) return;

    setActiveHotspotDrawingId(hotspotId);
    clearHotspotShape(hotspotId);
  };

  const handleStartDrawing = (hotspotId: ID) => {
    const hs = hotspots.find((h) => h.id === hotspotId);
    if (!hs) return;

    if (getHotspotActionType(hs) !== "goToNode") return;

    const currentTargetId = getHotspotTargetId(hs);
    if (!currentTargetId) return;

    if (!hasImage) return;

    setActiveHotspotDrawingId(hotspotId);
    clearHotspotShape(hotspotId);
  };

  const canBindTargetsForHotspot = (hs: Hotspot) => canChooseTargets && getHotspotActionType(hs) === "goToNode";

  const resolveNodeLabelFn = (nodeId: ID): string | undefined => {
    if (!project) return undefined;
    return resolveNodeLabel(project, nodeId);
  };

  return {
    canBindHotspotTargets: canChooseTargets,
    canBindTargetsForHotspot,
    availableNodesByHotspotId,
    activeDrawingHotspotId,
    resolveNodeLabel: resolveNodeLabelFn,
    handleAddHotspot: addHotspot,
    handleHotspotRemove,
    handleHotspotActionChange,
    handleHotspotTargetChange,
    handleStartDrawing,
  };
}
