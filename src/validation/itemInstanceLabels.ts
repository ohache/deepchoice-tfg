import type { Effect } from "@/domain/effects";
import type { ID, InteractionRules, Project } from "@/domain/types";

/* Normaliza labels para comparaciones sin distinguir mayúsculas ni espacios */
function normalizeItemInstanceLabel(value?: string | null): string {
  return String(value ?? "").trim().toLowerCase();
}

/* Añade un label normalizado a la colección si no está vacío */
function addNormalizedLabel(labels: string[], value?: string | null): void {
  const normalized = normalizeItemInstanceLabel(value);
  if (normalized) labels.push(normalized);
}

/* Extrae labels generados por efectos que crean nuevas instancias de item */
function collectEffectItemInstanceLabels(labels: string[], effects: Effect[] | undefined, excludeItemInstanceId?: ID): void {
  for (const effect of effects ?? []) {
    if (effect.type !== "combineItems" && effect.type !== "transformItem") continue;
    if (effect.resultItemInstanceId === excludeItemInstanceId) continue;

    addNormalizedLabel(labels, effect.resultItemLabel);
  }
}

/* Extrae labels generados por las reglas de interacción */
function collectRulesItemInstanceLabels(labels: string[], rules: InteractionRules | undefined, excludeItemInstanceId?: ID): void {
  for (const rule of rules?.onClick ?? []) collectEffectItemInstanceLabels(labels, rule.effects, excludeItemInstanceId);

  for (const rule of rules?.onUseItem ?? []) collectEffectItemInstanceLabels(labels, rule.effects, excludeItemInstanceId);
}

/* Obtiene todos los labels de itemInstance existentes en el proyecto */
function getAllItemInstanceLabels(project: Project, excludeItemInstanceId?: ID): string[] {
  const labels: string[] = [];

  /* Inventario inicial de Players */
  for (const player of project.players ?? []) {
    for (const itemInstance of player.initialInventory ?? []) {
      if (itemInstance.itemInstanceId !== excludeItemInstanceId) addNormalizedLabel(labels, itemInstance.label);

      collectRulesItemInstanceLabels(labels, itemInstance.rules, excludeItemInstanceId);
    }
  }

  /* Inventario inicial de NPCs */
  for (const npc of project.npcs ?? []) {
    for (const itemInstance of npc.initialInventory ?? []) {
      if (itemInstance.itemInstanceId !== excludeItemInstanceId) addNormalizedLabel(labels, itemInstance.label);

      collectRulesItemInstanceLabels(labels, itemInstance.rules, excludeItemInstanceId);
    }
  }

  /* Instancias colocadas en escenas */
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const itemInstance of layer.placedItems ?? []) {
        if (itemInstance.itemInstanceId !== excludeItemInstanceId) addNormalizedLabel(labels, itemInstance.label);

        collectRulesItemInstanceLabels(labels, itemInstance.rules, excludeItemInstanceId);
      }

      /* Hotspots */
      for (const hotspot of layer.hotspots ?? []) collectRulesItemInstanceLabels(labels, hotspot.rules, excludeItemInstanceId);

      /* NPCs colocados */
      for (const placedNpc of layer.placedNpcs ?? []) collectRulesItemInstanceLabels(labels, placedNpc.rules, excludeItemInstanceId);
    }

    /* Diálogos */
    for (const dialogue of node.dialogues ?? []) {
      for (const dialogueNode of dialogue.nodes ?? []) {
        if (dialogueNode.type !== "line") continue;

        collectEffectItemInstanceLabels(labels, dialogueNode.effects, excludeItemInstanceId);
      }
    }
  }

  return labels;
}

/* Comprueba si un label ya está siendo utilizado por alguna itemInstance */
export function hasDuplicatedItemInstanceLabel(project: Project, label: string, excludeItemInstanceId?: ID): boolean {
  const normalized = normalizeItemInstanceLabel(label);
  if (!normalized) return false;

  return getAllItemInstanceLabels(project, excludeItemInstanceId).includes(normalized);
}