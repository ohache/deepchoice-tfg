import type { Effect } from "@/domain/effects";
import type { ID, InteractionRules, Project } from "@/domain/types";

export function normalizeItemInstanceLabel(label?: string | null): string {
  return (label ?? "").trim().toLowerCase();
}

function pushLabel(labels: string[], label?: string | null) {
  const normalized = normalizeItemInstanceLabel(label);
  if (normalized) labels.push(normalized);
}

function collectEffectResultLabels(
  labels: string[],
  effects: Effect[] | undefined,
  excludeItemInstanceId?: ID,
) {
  for (const effect of effects ?? []) {
    if (
      (effect.type === "combineItems" || effect.type === "transformItem") &&
      effect.resultItemInstanceId !== excludeItemInstanceId
    ) {
      pushLabel(labels, effect.resultItemLabel);
    }
  }
}

function collectRulesResultLabels(
  labels: string[],
  rules: InteractionRules | undefined,
  excludeItemInstanceId?: ID,
) {
  for (const rule of rules?.onClick ?? []) {
    collectEffectResultLabels(labels, rule.effects, excludeItemInstanceId);
  }

  for (const rule of rules?.onUseItem ?? []) {
    collectEffectResultLabels(labels, rule.effects, excludeItemInstanceId);
  }
}

export function getAllItemInstanceLabels(
  project: Project,
  excludeItemInstanceId?: ID,
): string[] {
  const labels: string[] = [];

  for (const player of project.players ?? []) {
    for (const entry of player.initialInventory ?? []) {
      if (entry.itemInstanceId !== excludeItemInstanceId) {
        pushLabel(labels, entry.label);
      }

      collectRulesResultLabels(labels, entry.rules, excludeItemInstanceId);
    }
  }

  for (const npc of project.npcs ?? []) {
    for (const entry of npc.initialInventory ?? []) {
      if (entry.itemInstanceId !== excludeItemInstanceId) {
        pushLabel(labels, entry.label);
      }

      collectRulesResultLabels(labels, entry.rules, excludeItemInstanceId);
    }
  }

  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const placedItem of layer.placedItems ?? []) {
        if (placedItem.id !== excludeItemInstanceId) {
          pushLabel(labels, placedItem.label);
        }

        collectRulesResultLabels(labels, placedItem.rules, excludeItemInstanceId);
      }

      for (const hotspot of layer.hotspots ?? []) {
        collectRulesResultLabels(labels, hotspot.rules, excludeItemInstanceId);
      }

      for (const placedNpc of layer.placedNpcs ?? []) {
        collectRulesResultLabels(labels, placedNpc.rules, excludeItemInstanceId);
      }
    }

    for (const dialogue of node.dialogues ?? []) {
      for (const dialogueNode of dialogue.nodes ?? []) {
        if (dialogueNode.type !== "line") continue;
        collectEffectResultLabels(labels, dialogueNode.effects, excludeItemInstanceId);
      }
    }
  }

  return labels;
}

export function hasDuplicatedItemInstanceLabel(
  project: Project,
  label: string,
  excludeItemInstanceId?: ID,
): boolean {
  const normalized = normalizeItemInstanceLabel(label);
  if (!normalized) return false;

  return getAllItemInstanceLabels(project, excludeItemInstanceId).includes(normalized);
}