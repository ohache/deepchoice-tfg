import type { Hotspot } from "@/domain/types";

export type InteractionKind = "idle" | "travel" | "inspect" | "take" | "talk" | "dialogue" | "map";

const INTERACTION_ICONS = {
  idle: "/cursor/idle.png",
  travel: "/cursor/goRight.png",
  inspect: "/cursor/look.png",
  take: "/cursor/take.png",
  talk: "/cursor/talk.png",
  dialogue: "/cursor/dialogue.png",
  map: "/cursor/map.png"
} as const;

function hasGoToNodeEffect(hotspot: Hotspot): boolean {
  const clickRules = hotspot.rules?.onClick ?? [];
  const useItemRules = hotspot.rules?.onUseItem ?? [];
  const rules = [...clickRules, ...useItemRules];

  return rules.some((rule) => (rule.effects ?? []).some((eff) => eff.type === "goToNode"));
}

export function getHotspotInteractionKind(hotspot: Hotspot): InteractionKind {
  return hasGoToNodeEffect(hotspot) ? "travel" : "inspect";
}

export function getDialogueInteractionKind(): InteractionKind {
  return "dialogue";
}

export function iconForInteractionKind(kind: InteractionKind): string {
  return INTERACTION_ICONS[kind];
}