import type { Hotspot } from "@/domain/types";

export type InteractionKind =
  | "idle"
  | "travelUp"
  | "travelDown"
  | "travelLeft"
  | "travelRight"
  | "inspect"
  | "take"
  | "talk"
  | "dialogue"
  | "map";

const INTERACTION_ICONS: Record<InteractionKind, string> = {
  idle: "/cursor/idle.png",
  travelUp: "/cursor/goUp.png",
  travelDown: "/cursor/goDown.png",
  travelLeft: "/cursor/goLeft.png",
  travelRight: "/cursor/goRight.png",
  inspect: "/cursor/look.png",
  take: "/cursor/take.png",
  talk: "/cursor/talk.png",
  dialogue: "/cursor/dialogue.png",
  map: "/cursor/map.png",
};

function hasGoToNodeEffect(hotspot: Hotspot): boolean {
  const clickRules = hotspot.rules?.onClick ?? [];
  const useItemRules = hotspot.rules?.onUseItem ?? [];
  const rules = [...clickRules, ...useItemRules];

  return rules.some((rule) => {
    return (rule.effects ?? []).some((effect) => effect.type === "goToNode");
  });
}

export function getHotspotInteractionKind(hotspot: Hotspot): InteractionKind {
  return hasGoToNodeEffect(hotspot) ? "travelRight" : "inspect";
}

export function getTravelInteractionKindFromHotspotCenter(hotspot: Hotspot): InteractionKind {
  if (!hasGoToNodeEffect(hotspot)) return "inspect";

  const shape = hotspot.shape;
  if (shape.type !== "rect") return "travelRight";

  const centerX = shape.x + shape.w / 2;
  const centerY = shape.y + shape.h / 2;

  if (centerX < 1 / 3) return "travelLeft";
  if (centerX > 2 / 3) return "travelRight";

  if (centerY < 1 / 3) return "travelUp";
  if (centerY > 2 / 3) return "travelDown";

  return centerX < 0.5 ? "travelLeft" : "travelRight";
}

export function getDialogueInteractionKind(): InteractionKind {
  return "dialogue";
}

export function iconForInteractionKind(kind: InteractionKind): string {
  return INTERACTION_ICONS[kind];
}