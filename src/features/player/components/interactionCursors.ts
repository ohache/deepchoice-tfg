import type { Hotspot } from "@/domain/types";
import { publicPath } from "@/shared/helpers";

/* Tipos de cursor que puede mostrar el Player */
export type InteractionKind = "idle" | "travelUp" | "travelDown" | "travelLeft" | "travelRight" | "inspect" | "take" | "talk" | "dialogue" | "map";

const INTERACTION_ICONS: Record<InteractionKind, string> = {
  idle: publicPath("cursor/idle.png"),
  travelUp: publicPath("cursor/goUp.png"),
  travelDown: publicPath("cursor/goDown.png"),
  travelLeft: publicPath("cursor/goLeft.png"),
  travelRight: publicPath("cursor/goRight.png"),
  inspect: publicPath("cursor/look.png"),
  take: publicPath("cursor/take.png"),
  talk: publicPath("cursor/talk.png"),
  dialogue: publicPath("cursor/dialogue.png"),
  map: publicPath("cursor/map.png"),
};

/* Determina si un hotspot puede llegar a provocar navegación */
function hasGoToNodeEffect(hotspot: Hotspot): boolean {
  const clickRules = hotspot.rules?.onClick ?? [];
  const useItemRules = hotspot.rules?.onUseItem ?? [];
  const rules = [...clickRules, ...useItemRules];

  return rules.some((rule) => {
    return (rule.effects ?? []).some((effect) => effect.type === "goToNode");
  });
}

/* Resuelve el cursor de navegación según la posición del hotspot */
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

export function iconForInteractionKind(kind: InteractionKind): string {
  return INTERACTION_ICONS[kind];
}