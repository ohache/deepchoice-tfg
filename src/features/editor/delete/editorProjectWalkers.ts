import type { ClickRule, Dialogue, ID, InteractionRules, Node, Project, RulePhrase, SceneImageLayer, UseItemRule } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";

type WhenMapper = (when: Condition | undefined) => {
  when: Condition | undefined;
  touched: boolean;
};

type InteractionRule = ClickRule | UseItemRule;

type InteractionRuleMappers = {
  onClick?: (rule: ClickRule) => ClickRule;
  onUseItem?: (rule: UseItemRule) => UseItemRule;
};

type EffectMapper = (effect: Effect) => Effect | undefined;

type RuleContainerKey = "hotspots" | "placedItems" | "placedNpcs";
type RuleContainerList<K extends RuleContainerKey> = NonNullable<SceneImageLayer[K]>;
type RuleContainerEntry<K extends RuleContainerKey> = RuleContainerList<K>[number];

const RULE_CONTAINER_KEYS = ["hotspots", "placedItems", "placedNpcs"] as const;

/* ---------- Conditions ---------- */
function mapCondition(cond: Condition | undefined, mapper: (condition: Condition) => Condition | undefined): { when: Condition | undefined; touched: boolean } {
  if (!cond) return { when: cond, touched: false };

  const recur = (current: Condition): Condition | undefined => {
    switch (current.type) {
      case "and": {
        let touched = false;

        const nextAll = current.all.map((child) => {
          const nextChild = recur(child);
          if (nextChild !== child) touched = true;
          return nextChild;
        })
        .filter(Boolean) as Condition[];

        if (nextAll.length === 0) return undefined;
        if (nextAll.length === 1) return nextAll[0];

        const next = touched ? ({ ...current, all: nextAll } as Condition) : current;
        return mapper(next);
      }

      case "or": {
        let touched = false;

        const nextAny = current.any.map((child) => {
          const nextChild = recur(child);
          if (nextChild !== child) touched = true;
          return nextChild;
        })
        .filter(Boolean) as Condition[];

        if (nextAny.length === 0) return undefined;
        if (nextAny.length === 1) return nextAny[0];

        const next = touched ? ({ ...current, any: nextAny } as Condition) : current;
        return mapper(next);
      }

      case "not": {
        const nextInner = recur(current.cond);
        if (!nextInner) return undefined;

        const next = nextInner !== current.cond ? ({ ...current, cond: nextInner } as Condition) : current;

        return mapper(next);
      }

      default:
        return mapper(current);
    }
  };

  const next = recur(cond);
  return { when: next, touched: next !== cond };
}

export function removeConditionsInProject(project: Project, predicate: (condition: Condition) => boolean): Project {
  return mapAllWhensInProject(project, (when) => mapCondition(when, (condition) => (predicate(condition) ? undefined : condition)));
}

function mapWhensInInteractionRules(rules: InteractionRules | undefined, mapWhen: WhenMapper): { rules: InteractionRules | undefined; touched: boolean } {
  const mapRuleWhen = <T extends InteractionRule>(rule: T): T => {
    const res = mapWhen(rule.when);
    if (!res.touched) return rule;

    return { ...rule, when: res.when } as T;
  };

  return mapInteractionRules(rules, { onClick: mapRuleWhen, onUseItem: mapRuleWhen });
}

function mapWhensInDialogues(dialogues: Node["dialogues"] | undefined, mapWhen: WhenMapper): { dialogues: NonNullable<Node["dialogues"]>; touched: boolean } {
  const currentDialogues = dialogues ?? [];
  if (currentDialogues.length === 0) return { dialogues: currentDialogues, touched: false };

  let touchedDialogues = false;

  const nextDialogues = currentDialogues.map((dialogue) => {
    let touchedDialogue = false;

    const dialogueWhenRes = mapWhen(dialogue.when);

    const nextNodes = dialogue.nodes.map((dialogueNode) => {
      if (dialogueNode.type !== "line") return dialogueNode;

      const lineWhenRes = mapWhen(dialogueNode.when);
      if (!lineWhenRes.touched) return dialogueNode;

      touchedDialogue = true;
      return { ...dialogueNode, when: lineWhenRes.when };
    });

    if (!dialogueWhenRes.touched && !touchedDialogue) return dialogue;

    touchedDialogues = true;
    return { ...dialogue, when: dialogueWhenRes.when, nodes: nextNodes };
  });

  return { dialogues: nextDialogues, touched: touchedDialogues };
}

function mapTextWhens(layer: SceneImageLayer, mapWhen: WhenMapper): Pick<SceneImageLayer, "text"> | null {
  if (layer.text.length === 0) return null;

  let touchedText = false;

  const nextText = layer.text.map((entry) => {
    const res = mapWhen(entry.when);
    if (!res.touched) return entry;

    touchedText = true;
    return { ...entry, when: res.when };
  });

  return touchedText ? { text: nextText } : null;
}

function mapWhensInLayer(layer: SceneImageLayer, mapWhen: WhenMapper): { layer: SceneImageLayer; touched: boolean } {
  const layerWhenRes = mapWhen(layer.when);
  const textPatch = mapTextWhens(layer, mapWhen);
  const rulesRes = mapRuleContainersInLayer(layer, (rules) => mapWhensInInteractionRules(rules, mapWhen));

  if (!layerWhenRes.touched && !textPatch && !rulesRes.touched) return { layer, touched: false };

  return {
    layer: {
      ...layer,
      when: layerWhenRes.touched ? layerWhenRes.when : layer.when,
      ...(textPatch ?? {}),
      ...rulesRes.patch,
    },
    touched: true,
  };
}

function mapWhensInNode(node: Node, mapWhen: WhenMapper): { node: Node; touched: boolean } {
  const layersRes = mapLayers(node.layers, (layer) => mapWhensInLayer(layer, mapWhen));
  const dialoguesRes = mapWhensInDialogues(node.dialogues, mapWhen);

  if (!layersRes.touched && !dialoguesRes.touched) return { node, touched: false };

  return {
    node: {
      ...node,
      layers: layersRes.layers,
      dialogues: dialoguesRes.touched ? dialoguesRes.dialogues : node.dialogues,
    },
    touched: true,
  };
}

function mapAllWhensInProject(project: Project, mapWhen: WhenMapper): Project {
  return mapNodesInProject(project, (node) => mapWhensInNode(node, mapWhen));
}

/* ---------- Interaction rules ---------- */
function shouldRemoveInteractionRule(rule: Pick<InteractionRule, "when" | "phrase" | "effects">): boolean {
  if (rule.effects.length > 0) return false;

  if (!rule.when) return true;

  return false;
}

function mapRuleList<T extends InteractionRule>(list: T[] | undefined, mapper: (rule: T) => T): { list: T[] | undefined; touched: boolean } {
  if (!list || list.length === 0) return { list, touched: false };

  let touched = false;
  const nextList: T[] = [];

  for (const rule of list) {
    const nextRule = mapper(rule);

    if (nextRule !== rule) touched = true;

    if (shouldRemoveInteractionRule(nextRule)) {
      touched = true;
      continue;
    }

    nextList.push(nextRule);
  }

  if (!touched) return { list, touched: false };

  return { list: nextList.length > 0 ? nextList : undefined, touched: true };
}

function mapInteractionRules(rules: InteractionRules | undefined, mappers: InteractionRuleMappers): { rules: InteractionRules | undefined; touched: boolean } {
  if (!rules) return { rules, touched: false };

  const onClickRes = mapRuleList(rules.onClick, mappers.onClick ?? ((rule) => rule));

  const onUseItemRes = mapRuleList(rules.onUseItem, mappers.onUseItem ?? ((rule) => rule));

  if (!onClickRes.touched && !onUseItemRes.touched) return { rules, touched: false };

  return {
    rules: {
      ...rules,
      onClick: onClickRes.list,
      onUseItem: onUseItemRes.list,
    },
    touched: true,
  };
}

function mapRuleContainerList<K extends RuleContainerKey>(list: RuleContainerList<K> | undefined,
  mapper: (rules: InteractionRules | undefined) => { rules: InteractionRules | undefined; touched: boolean },
): { list: RuleContainerList<K> | undefined; touched: boolean } {
  if (!list || list.length === 0) return { list, touched: false };

  let touchedList = false;

  const nextList = list.map((entry) => {
    const res = mapper(entry.rules);
    if (!res.touched) return entry;

    touchedList = true;
    return { ...entry, rules: res.rules ?? entry.rules } as RuleContainerEntry<K>;
  }) as RuleContainerList<K>;

  return { list: touchedList ? nextList : list, touched: touchedList };
}

function mapRuleContainersInLayer(layer: SceneImageLayer, mapper: (rules: InteractionRules | undefined) => { rules: InteractionRules | undefined; touched: boolean })
  : { patch: Partial<Pick<SceneImageLayer, RuleContainerKey>>; touched: boolean } {
  let touched = false;
  const patch: Partial<Pick<SceneImageLayer, RuleContainerKey>> = {};

  for (const key of RULE_CONTAINER_KEYS) {
    const res = mapRuleContainerList(layer[key] as RuleContainerList<typeof key> | undefined, mapper);
    if (!res.touched) continue;

    touched = true;
    patch[key] = res.list as never;
  }

  return { patch, touched };
}

function mapLayerInteractionRules(layer: SceneImageLayer, mappers: InteractionRuleMappers): { layer: SceneImageLayer; touched: boolean } {
  const res = mapRuleContainersInLayer(layer, (rules) => mapInteractionRules(rules, mappers));

  if (!res.touched) return { layer, touched: false };

  return {
    layer: { ...layer, ...res.patch },
    touched: true,
  };
}

function mapSceneInteractionRulesInProject(project: Project, mappers: InteractionRuleMappers): Project {
  return mapNodesInProject(project, (node) => mapSceneInteractionRulesInNodeValue(node, mappers));
}

function mapSceneInteractionRulesInNode(project: Project, nodeId: ID, mappers: InteractionRuleMappers): Project {
  return mapTargetNodeInProject(project, nodeId, (node) => mapSceneInteractionRulesInNodeValue(node, mappers));
}

function mapSceneInteractionRulesInNodeValue(node: Node, mappers: InteractionRuleMappers): { node: Node; touched: boolean } {
  const res = mapLayers(node.layers, (layer) => mapLayerInteractionRules(layer, mappers));

  if (!res.touched) return { node, touched: false };

  return {
    node: { ...node, layers: res.layers },
    touched: true,
  };
}

/* ---------- Effects ---------- */
function mapEffectArray(effects: Effect[] | undefined, mapper: EffectMapper): { effects: Effect[] | undefined; touched: boolean } {
  if (!effects || effects.length === 0) return { effects, touched: false };

  let touched = false;
  const nextEffects: Effect[] = [];

  for (const effect of effects) {
    const nextEffect = mapper(effect);

    if (nextEffect !== effect) touched = true;

    if (!nextEffect) {
      touched = true;
      continue;
    }

    nextEffects.push(nextEffect);
  }

  if (!touched) return { effects, touched: false };

  return { effects: nextEffects, touched: true };
}

function mapEffectsInInteractionRules(rules: InteractionRules | undefined, mapper: EffectMapper): { rules: InteractionRules | undefined; touched: boolean } {
  const mapRuleEffects = <T extends InteractionRule>(rule: T): T => {
    const res = mapEffectArray(rule.effects, mapper);
    if (!res.touched) return rule;

    return { ...rule, effects: res.effects ?? [] } as T;
  };

  return mapInteractionRules(rules, { onClick: mapRuleEffects, onUseItem: mapRuleEffects });
}

function mapEffectsInDialogues(dialogues: Node["dialogues"] | undefined, mapper: EffectMapper): { dialogues: NonNullable<Node["dialogues"]>; touched: boolean } {
  const currentDialogues = dialogues ?? [];
  if (currentDialogues.length === 0) return { dialogues: currentDialogues, touched: false };

  let touchedDialogues = false;

  const nextDialogues = currentDialogues.map((dialogue) => {
    let touchedDialogue = false;

    const nextNodes = dialogue.nodes.map((dialogueNode) => {
      if (dialogueNode.type !== "line") return dialogueNode;

      const res = mapEffectArray(dialogueNode.effects, mapper);
      if (!res.touched) return dialogueNode;

      touchedDialogue = true;
      return { ...dialogueNode, effects: res.effects };
    });

    if (!touchedDialogue) return dialogue;

    touchedDialogues = true;
    return { ...dialogue, nodes: nextNodes };
  });

  return { dialogues: nextDialogues, touched: touchedDialogues };
}

function mapEffectsInLayer(layer: SceneImageLayer, mapper: EffectMapper): { layer: SceneImageLayer; touched: boolean } {
  const res = mapRuleContainersInLayer(layer, (rules) => mapEffectsInInteractionRules(rules, mapper));

  if (!res.touched) return { layer, touched: false };

  return {
    layer: { ...layer, ...res.patch },
    touched: true,
  };
}

function mapEffectsInNodeValue(node: Node, mapper: EffectMapper): { node: Node; touched: boolean } {
  const layersRes = mapLayers(node.layers, (layer) => mapEffectsInLayer(layer, mapper));
  const dialoguesRes = mapEffectsInDialogues(node.dialogues, mapper);

  if (!layersRes.touched && !dialoguesRes.touched) return { node, touched: false };

  return {
    node: {
      ...node,
      layers: layersRes.layers,
      dialogues: dialoguesRes.touched ? dialoguesRes.dialogues : node.dialogues,
    },
    touched: true,
  };
}

export function mapEffectsInProject(project: Project, mapper: EffectMapper): Project {
  return mapNodesInProject(project, (node) => mapEffectsInNodeValue(node, mapper));
}

export function mapEffectsInNode(project: Project, nodeId: ID, mapper: EffectMapper): Project {
  return mapTargetNodeInProject(project, nodeId, (node) => mapEffectsInNodeValue(node, mapper));
}

export function removeEffectsInProject(project: Project, predicate: (effect: Effect) => boolean): Project {
  return mapEffectsInProject(project, (effect) => (predicate(effect) ? undefined : effect));
}

/* ---------- Rule phrases ---------- */
export function removeRulePhrasesInProject(project: Project, predicate: (phrase: RulePhrase) => boolean): Project {
  const removePhrase = <T extends InteractionRule>(rule: T): T => {
    if (!rule.phrase || !predicate(rule.phrase)) return rule;

    return { ...rule, phrase: undefined } as T;
  };

  return mapSceneInteractionRulesInProject(project, { onClick: removePhrase, onUseItem: removePhrase });
}

export function removeRulePhrasesInNode(project: Project, nodeId: ID, predicate: (phrase: RulePhrase) => boolean): Project {
  const removePhrase = <T extends InteractionRule>(rule: T): T => {
    if (!rule.phrase || !predicate(rule.phrase)) return rule;

    return { ...rule, phrase: undefined } as T;
  };

  return mapSceneInteractionRulesInNode(project, nodeId, { onClick: removePhrase, onUseItem: removePhrase });
}

/* ---------- Specific rule cleanup ---------- */
export function removeOnUseItemRulesForInstances(project: Project, removedInstanceIds: Set<ID>): Project {
  if (removedInstanceIds.size === 0) return project;

  return mapSceneInteractionRulesInProject(project, {
    onUseItem: (rule) => {
      if (!removedInstanceIds.has(rule.itemInstanceId)) return rule;

      return { ...rule, when: undefined, phrase: undefined, effects: [] };
    },
  });
}

export function removeEmptyInteractionRulesInProject(project: Project): Project {
  const keepRule = <T extends InteractionRule>(rule: T): T => rule;

  return mapSceneInteractionRulesInProject(project, { onClick: keepRule, onUseItem: keepRule });
}

/* ---------- Placed entities ---------- */
type PlacedKey = "placedItems" | "placedNpcs" | "placedPlayers";
type PlacedElem<K extends PlacedKey> = NonNullable<SceneImageLayer[K]>[number];

function removePlaced<K extends PlacedKey>(project: Project, key: K, predicate: (item: PlacedElem<K>) => boolean): Project {
  return mapNodesInProject(project, (node) => {
    const res = mapLayers(node.layers, (layer) => {
      const currentItems = (layer[key] ?? []) as PlacedElem<K>[];
      if (currentItems.length === 0) return { layer, touched: false };

      const nextItems = currentItems.filter((item) => !predicate(item));
      if (nextItems.length === currentItems.length) return { layer, touched: false };

      return {
        layer: { ...layer, [key]: nextItems } as SceneImageLayer,
        touched: true,
      };
    });

    if (!res.touched) return { node, touched: false };

    return {
      node: { ...node, layers: res.layers },
      touched: true,
    };
  });
}

export function removePlacedItems(project: Project, predicate: (item: NonNullable<SceneImageLayer["placedItems"]>[number]) => boolean): Project {
  return removePlaced(project, "placedItems", predicate);
}

export function removePlacedNpcs(project: Project, predicate: (npc: NonNullable<SceneImageLayer["placedNpcs"]>[number]) => boolean): Project {
  return removePlaced(project, "placedNpcs", predicate);
}

export function removePlacedPlayers(project: Project, predicate: (player: NonNullable<SceneImageLayer["placedPlayers"]>[number]) => boolean): Project {
  return removePlaced(project, "placedPlayers", predicate);
}

/* ---------- Dialogues ---------- */
export function removeDialogues(project: Project, predicate: (dialogue: Dialogue) => boolean): Project {
  return mapNodesInProject(project, (node) => {
    const currentDialogues = node.dialogues ?? [];
    if (currentDialogues.length === 0) return { node, touched: false };

    const nextDialogues = currentDialogues.filter((dialogue) => !predicate(dialogue));
    if (nextDialogues.length === currentDialogues.length) return { node, touched: false };

    return {
      node: { ...node, dialogues: nextDialogues },
      touched: true,
    };
  });
}

export function effectIsStartDialogueForAnyOf(effect: Effect, dialogueIds: Set<ID>): boolean {
  return effect.type === "startDialogue" && dialogueIds.has(effect.nodeDialogueId);
}

/* ---------- Generic project walkers ---------- */
function mapLayers(layers: SceneImageLayer[], mapper: (layer: SceneImageLayer) => { layer: SceneImageLayer; touched: boolean }): { layers: SceneImageLayer[]; touched: boolean } {
  let touchedLayers = false;

  const nextLayers = layers.map((layer) => {
    const res = mapper(layer);
    if (res.touched) touchedLayers = true;
    return res.layer;
  });

  return touchedLayers ? { layers: nextLayers, touched: true } : { layers, touched: false };
}

function mapNodesInProject(project: Project, mapper: (node: Node) => { node: Node; touched: boolean }): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    const res = mapper(node);
    if (res.touched) touchedNodes = true;
    return res.node;
  });

  return touchedNodes ? { ...project, nodes: nextNodes } : project;
}

function mapTargetNodeInProject(project: Project, nodeId: ID, mapper: (node: Node) => { node: Node; touched: boolean }): Project {
  return mapNodesInProject(project, (node) => {
    if (node.id !== nodeId) return { node, touched: false };
    return mapper(node);
  });
}
