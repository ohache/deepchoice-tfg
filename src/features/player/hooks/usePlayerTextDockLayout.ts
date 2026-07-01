import { useCallback, useMemo, useState, type CSSProperties } from "react";
import type { Project } from "@/domain/types";
import { resolveTextTokensToParts } from "@/shared/textTokens/ResolveTextTokens";

export const HORIZONTAL_TEXT_DOCK_HEIGHT = 176;
export const VERTICAL_TEXT_DOCK_WIDTH = 320;

const DOCK_LAYOUT_TRANSITION_MS = 240;
const DOCK_LAYOUT_TRANSITION =
  `top ${DOCK_LAYOUT_TRANSITION_MS}ms ease, right ${DOCK_LAYOUT_TRANSITION_MS}ms ease, bottom ${DOCK_LAYOUT_TRANSITION_MS}ms ease, left ${DOCK_LAYOUT_TRANSITION_MS}ms ease`;

type TextDock = "bottom" | "top" | "left" | "right";
type SceneContentRect = { x: number; y: number; w: number; h: number };

type ActiveTextView = {
  text?: string;
  dock: TextDock;
};

function withDockLayoutTransition(style: CSSProperties, enabled: boolean): CSSProperties {
  if (!enabled) return style;

  return { ...style,  transition: DOCK_LAYOUT_TRANSITION,  willChange: "top, right, bottom, left" };
}

export function usePlayerTextDockLayout(args: { project: Project | null; activeText: ActiveTextView; bottomBarOpen: boolean;
  settingsOpen: boolean; inventoryOpen: boolean; isMapOpen: boolean; animateLayout?: boolean }) {
  const { project, activeText, bottomBarOpen, settingsOpen, inventoryOpen, isMapOpen, animateLayout = true } = args;

  const [sceneContentRect, setSceneContentRect] = useState<SceneContentRect | null>(null);

  const resolvedActiveText = useMemo(() => {
    if (!project) return activeText.text ?? "";

    const parts = resolveTextTokensToParts(activeText.text ?? "", project);

    return parts.map((part) => (part.type === "text" ? part.value : part.displayText ?? part.raw)).join("");
  }, [activeText.text, project]);

  const hasText = resolvedActiveText.trim().length > 0;

  const layoutClass = hasText && (activeText.dock === "left" || activeText.dock === "right") ? "flex-row" : "flex-col";

  const isHorizontalTextDock = hasText && (activeText.dock === "top" || activeText.dock === "bottom");
  const isVerticalTextDock = hasText && (activeText.dock === "left" || activeText.dock === "right");

  const sceneStageFrameStyle: CSSProperties = withDockLayoutTransition(
    isHorizontalTextDock
      ? activeText.dock === "top"
        ? { position: "absolute", left: 0, right: 0, top: HORIZONTAL_TEXT_DOCK_HEIGHT, bottom: 0 }
        : { position: "absolute", left: 0, right: 0, top: 0, bottom: HORIZONTAL_TEXT_DOCK_HEIGHT }
      : isVerticalTextDock
        ? activeText.dock === "left"
          ? { position: "absolute", left: VERTICAL_TEXT_DOCK_WIDTH, right: 0, top: 0, bottom: 0 }
          : { position: "absolute", left: 0, right: VERTICAL_TEXT_DOCK_WIDTH, top: 0, bottom: 0 }
        : { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
    animateLayout,
  );

  const handleSceneContentRectChange = useCallback((rect: SceneContentRect | null) => {
    if (!rect) {
        setSceneContentRect(null);
        return;
      }

      const xOffset = hasText && activeText.dock === "left" ? VERTICAL_TEXT_DOCK_WIDTH : 0;
      const yOffset = hasText && activeText.dock === "top" ? HORIZONTAL_TEXT_DOCK_HEIGHT : 0;

      setSceneContentRect({ ...rect, x: rect.x + xOffset, y: rect.y + yOffset });
    }, [hasText, activeText.dock],
  );

  const textPanelDisabled = bottomBarOpen || settingsOpen || inventoryOpen || isMapOpen;

  return {
    sceneContentRect, resolvedActiveText, hasText, layoutClass, sceneStageFrameStyle, textPanelDisabled, handleSceneContentRectChange,
    dockMainSize: HORIZONTAL_TEXT_DOCK_HEIGHT, dockSideSize: VERTICAL_TEXT_DOCK_WIDTH,
  };
}