import type { CSSProperties } from "react";
import type { ID, Project } from "@/domain/types";

export function cssSizeToNumber(value: CSSProperties["width"] | CSSProperties["height"]): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value.replace("px", "")) || 0;
  return 0;
}

export function getCssRectSize(style: CSSProperties | null): { width: number; height: number } {
  if (!style) return { width: 0, height: 0 };

  return { width: cssSizeToNumber(style.width), height: cssSizeToNumber(style.height) };
}

export function canRenderPreviewLabel(args: { label?: string | null; width: number; height: number; minWidth?: number; minHeight?: number }): boolean {
  const minWidth = args.minWidth ?? 50;
  const minHeight = args.minHeight ?? 20;

  return Boolean(args.label?.trim()) && args.width >= minWidth && args.height >= minHeight;
}

export function mergePreviewDraft<T>(items: T[], draft: T | null | undefined, getId: (item: T) => ID): T[] {
  if (!draft) return items;

  const draftId = getId(draft);
  const baseItems = items.filter((item) => getId(item) !== draftId);

  return [...baseItems, draft];
}

export function getNpcName(project: Project | null, npcId: ID): string {
  const npc = project?.npcs.find((entry) => entry.id === npcId);
  return npc?.name?.trim() || "PNJ";
}

export function getPlayerName(project: Project | null, playerId: ID): string {
  const player = project?.players.find((entry) => entry.id === playerId);
  return player?.name?.trim() || "Jugador";
}
