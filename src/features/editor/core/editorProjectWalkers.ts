import type { Dialogue, ID, InteractionRules, Node, Project, SceneImageLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";

/* Firma de un “mapper” de when */
type WhenMapper = (when: Condition | undefined) => {
  when: Condition | undefined;
  touched: boolean;
};

type WC = Condition;

/* Recorre recursivamente una condición y permite transformarla */
function mapCondition(cond: WC | undefined, mapper: (c: WC) => WC | undefined): { when: WC | undefined; touched: boolean } {
  if (!cond) return { when: cond, touched: false };

  const recur = (current: WC): WC | undefined => {
    switch (current.type) {
      case "and": {
        let touched = false;

        const nextAll = current.all.map((child) => {
            const nextChild = recur(child);
            if (nextChild !== child) touched = true;
            return nextChild;
          }).filter(Boolean) as WC[];

        if (nextAll.length === 0) return undefined;
        if (nextAll.length === 1) return nextAll[0];

        const next = touched ? ({ ...current, all: nextAll } as WC) : current;
        return mapper(next);
      }

      case "or": {
        let touched = false;

        const nextAny = current.any.map((child) => {
            const nextChild = recur(child);
            if (nextChild !== child) touched = true;
            return nextChild;
          }).filter(Boolean) as WC[];

        if (nextAny.length === 0) return undefined;
        if (nextAny.length === 1) return nextAny[0];

        const next = touched ? ({ ...current, any: nextAny } as WC) : current;
        return mapper(next);
      }

      case "not": {
        const nextInner = recur(current.cond);
        if (!nextInner) return undefined;

        const next = nextInner !== current.cond
          ? ({ ...current, cond: nextInner } as WC)
          : current;

        return mapper(next);
      }

      default:
        return mapper(current);
    }
  };

  const next = recur(cond);
  return { when: next, touched: next !== cond };
}

/* Elimina condiciones que cumplan predicate en cualquier `when` del proyecto */
export function removeConditionsInProject(project: Project, predicate: (condition: Condition) => boolean): Project {
  return mapAllWhensInProject(project, (when) =>
    mapCondition(when, (condition) => (predicate(condition) ? undefined : condition)),
  );
}

/* True si alguna condición del árbol cumple el predicate */
function someCondition(cond: WC | undefined, predicate: (c: WC) => boolean): boolean {
  if (!cond) return false;

  const visit = (current: WC): boolean => {
    if (predicate(current)) return true;

    switch (current.type) {
      case "and":
        return current.all.some(visit);

      case "or":
        return current.any.some(visit);

      case "not":
        return visit(current.cond);

      default:
        return false;
    }
  };

  return visit(cond);
}

/* True si algún effect del array cumple el predicate */
function someEffectsInEffects(effects: Effect[] | undefined, predicate: (e: Effect) => boolean): boolean {
  if (!effects || effects.length === 0) return false;
  return effects.some(predicate);
}

/* True si algún effect de unas InteractionRules cumple el predicate */
function someEffectsInInteractionRules(rules: InteractionRules | undefined, predicate: (e: Effect) => boolean): boolean {
  if (!rules) return false;

  for (const rule of rules.onClick ?? []) {
    if (someEffectsInEffects(rule.effects, predicate)) return true;
  }

  for (const rule of rules.onUseItem ?? []) {
    if (someEffectsInEffects(rule.effects, predicate)) return true;
  }

  return false;
}

/* True si algún effect del nodo cumple el predicate */
function someEffectsInNode(node: Node, predicate: (e: Effect) => boolean): boolean {
  for (const layer of node.layers) {
    for (const hotspot of layer.hotspots ?? []) {
      if (someEffectsInInteractionRules(hotspot.rules, predicate)) return true;
    }

    for (const placedItem of layer.placedItems ?? []) {
      if (someEffectsInInteractionRules(placedItem.rules, predicate)) return true;
    }

    for (const placedNpc of layer.placedNpcs ?? []) {
      if (someEffectsInInteractionRules(placedNpc.rules, predicate)) return true;
    }
  }

  for (const dialogue of node.dialogues ?? []) {
    for (const dialogueNode of dialogue.nodes) {
      if (dialogueNode.type === "line" && someEffectsInEffects(dialogueNode.effects, predicate)) return true;
    }
  }

  return false;
}

/* True si existe algún effect en cualquier punto del proyecto */
export function someEffectsInProject(project: Project, predicate: (e: Effect) => boolean): boolean {
  for (const node of project.nodes) {
    if (someEffectsInNode(node, predicate)) return true;
  }

  return false;
}

/* Elimina effects que cumplan predicate en un bloque de InteractionRules */
function pruneEffectsInInteractionRules(rules: InteractionRules | undefined, predicate: (e: Effect) => boolean): { rules: InteractionRules | undefined; touched: boolean } {
  if (!rules) return { rules, touched: false };

  let touchedRules = false;

  const pruneRuleList = <T extends { effects: Effect[] }>(list: T[] | undefined): T[] | undefined => {
    if (!list || list.length === 0) return list;

    let touchedList = false;

    const nextList = list.map((rule) => {
      const nextEffects = rule.effects.filter((effect) => !predicate(effect));
      if (nextEffects.length === rule.effects.length) return rule;

      touchedList = true;
      return { ...rule, effects: nextEffects };
    });

    if (touchedList) touchedRules = true;
    return touchedList ? nextList : list;
  };

  const nextOnClick = pruneRuleList(rules.onClick);
  const nextOnUseItem = pruneRuleList(rules.onUseItem);

  if (!touchedRules) return { rules, touched: false };

  return {
    rules: {
      ...rules,
      onClick: nextOnClick,
      onUseItem: nextOnUseItem,
    },
    touched: true,
  };
}

/* Elimina effects que cumplan predicate dentro de un nodo */
function removeEffectsInNode(node: Node, predicate: (e: Effect) => boolean): { node: Node; touched: boolean } {
  let touchedNode = false;

  const nextLayers = node.layers.map((layer) => {
    let touchedLayer = false;

    const mapRuleContainers = <T extends { rules: InteractionRules }>(list: T[] | undefined): { list: T[] | undefined; touched: boolean } => {
      if (!list || list.length === 0) return { list, touched: false };

      let touchedList = false;

      const nextList = list.map((entry) => {
        const res = pruneEffectsInInteractionRules(entry.rules, predicate);
        if (!res.touched) return entry;

        touchedList = true;
        return { ...entry, rules: res.rules ?? entry.rules };
      });

      return {
        list: touchedList ? nextList : list,
        touched: touchedList,
      };
    };

    const hotspotRes = mapRuleContainers(layer.hotspots);
    const itemRes = mapRuleContainers(layer.placedItems);
    const npcRes = mapRuleContainers(layer.placedNpcs);

    if (hotspotRes.touched || itemRes.touched || npcRes.touched) touchedLayer = true;

    if (!touchedLayer) return layer;

    touchedNode = true;
    return {
      ...layer,
      hotspots: hotspotRes.touched ? hotspotRes.list : layer.hotspots,
      placedItems: itemRes.touched ? itemRes.list : layer.placedItems,
      placedNpcs: npcRes.touched ? npcRes.list : layer.placedNpcs,
    };
  });

  const nextDialogues = (node.dialogues ?? []).map((dialogue) => {
    let touchedDialogue = false;

    const nextNodes = dialogue.nodes.map((dialogueNode) => {
      if (dialogueNode.type !== "line" || !dialogueNode.effects || dialogueNode.effects.length === 0) return dialogueNode;

      const nextEffects = dialogueNode.effects.filter((effect) => !predicate(effect));
      if (nextEffects.length === dialogueNode.effects.length) return dialogueNode;

      touchedDialogue = true;
      return { ...dialogueNode, effects: nextEffects };
    });

    if (!touchedDialogue) return dialogue;

    touchedNode = true;
    return { ...dialogue, nodes: nextNodes };
  });

  if (!touchedNode) return { node, touched: false };

  return {
    node: {
      ...node,
      layers: nextLayers,
      dialogues: nextDialogues,
    },
    touched: true,
  };
}

/* Elimina effects que cumplan predicate en todo el proyecto */
export function removeEffectsInProject(project: Project, predicate: (e: Effect) => boolean): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    const res = removeEffectsInNode(node, predicate);
    if (res.touched) touchedNodes = true;
    return res.node;
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

/* Interaction Rule Walkers */
function mapWhensInInteractionRules(rules: InteractionRules | undefined, mapWhen: WhenMapper): { next: InteractionRules | undefined; touched: boolean } {
  if (!rules) return { next: rules, touched: false };

  let touched = false;

  const mapRuleList = <T extends { when?: WC }>(list: T[] | undefined): T[] | undefined => {
    if (!list || list.length === 0) return list;

    let touchedList = false;

    const nextList = list.map((rule) => {
      const res = mapWhen(rule.when);
      if (!res.touched) return rule;

      touchedList = true;
      return { ...rule, when: res.when };
    });

    if (touchedList) touched = true;
    return touchedList ? nextList : list;
  };

  const nextOnClick = mapRuleList(rules.onClick);
  const nextOnUseItem = mapRuleList(rules.onUseItem);

  if (!touched) return { next: rules, touched: false };

  return {
    next: {
      ...rules,
      onClick: nextOnClick,
      onUseItem: nextOnUseItem,
    },
    touched: true,
  };
}

function someWhenInInteractionRules(rules: InteractionRules | undefined, predicate: (when: WC) => boolean): boolean {
  if (!rules) return false;

  for (const rule of rules.onClick ?? []) {
    if (rule.when && someCondition(rule.when, predicate)) return true;
  }

  for (const rule of rules.onUseItem ?? []) {
    if (rule.when && someCondition(rule.when, predicate)) return true;
  }

  return false;
}

/* Dialogues */
function mapWhensInDialogues(dialogues: Node["dialogues"] | undefined, mapWhen: WhenMapper): { next: NonNullable<Node["dialogues"]>; touched: boolean } {
  const currentDialogues = dialogues ?? [];
  if (currentDialogues.length === 0) return { next: currentDialogues, touched: false };

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
    return {
      ...dialogue,
      when: dialogueWhenRes.when,
      nodes: nextNodes,
    };
  });

  return { next: nextDialogues, touched: touchedDialogues };
}

function someWhenInDialogues(dialogues: Node["dialogues"] | undefined, predicate: (when: WC) => boolean): boolean {
  for (const dialogue of dialogues ?? []) {
    if (dialogue.when && someCondition(dialogue.when, predicate)) return true;

    for (const dialogueNode of dialogue.nodes) {
      if (
        dialogueNode.type === "line" &&
        dialogueNode.when &&
        someCondition(dialogueNode.when, predicate)
      ) {
        return true;
      }
    }
  }

  return false;
}

/* Node-level walker */
function mapWhensInNode(node: Node, mapWhen: WhenMapper): { node: Node; touched: boolean } {
  let touchedNode = false;

  const nextLayers = node.layers.map((layer) => {
    let touchedLayer = false;

    const layerWhenRes = mapWhen(layer.when);
    if (layerWhenRes.touched) touchedLayer = true;

    let nextText = layer.text;
    if (layer.text.length > 0) {
      let touchedText = false;

      const mappedText = layer.text.map((entry) => {
        const res = mapWhen(entry.when);
        if (!res.touched) return entry;

        touchedText = true;
        return { ...entry, when: res.when };
      });

      if (touchedText) {
        touchedLayer = true;
        nextText = mappedText;
      }
    }

    let nextHotspots = layer.hotspots;
    if ((layer.hotspots ?? []).length > 0) {
      let touchedHotspots = false;

      const mappedHotspots = layer.hotspots!.map((hotspot) => {
        const res = mapWhensInInteractionRules(hotspot.rules, mapWhen);
        if (!res.touched) return hotspot;

        touchedHotspots = true;
        return { ...hotspot, rules: res.next ?? hotspot.rules };
      });

      if (touchedHotspots) {
        touchedLayer = true;
        nextHotspots = mappedHotspots;
      }
    }

    let nextPlacedItems = layer.placedItems;
    if ((layer.placedItems ?? []).length > 0) {
      let touchedItems = false;

      const mappedItems = layer.placedItems!.map((placedItem) => {
        const res = mapWhensInInteractionRules(placedItem.rules, mapWhen);
        if (!res.touched) return placedItem;

        touchedItems = true;
        return { ...placedItem, rules: res.next ?? placedItem.rules };
      });

      if (touchedItems) {
        touchedLayer = true;
        nextPlacedItems = mappedItems;
      }
    }

    let nextPlacedNpcs = layer.placedNpcs;
    if ((layer.placedNpcs ?? []).length > 0) {
      let touchedNpcs = false;

      const mappedNpcs = layer.placedNpcs!.map((placedNpc) => {
        const res = mapWhensInInteractionRules(placedNpc.rules, mapWhen);
        if (!res.touched) return placedNpc;

        touchedNpcs = true;
        return { ...placedNpc, rules: res.next ?? placedNpc.rules };
      });

      if (touchedNpcs) {
        touchedLayer = true;
        nextPlacedNpcs = mappedNpcs;
      }
    }

    if (!touchedLayer) return layer;

    touchedNode = true;
    return {
      ...layer,
      when: layerWhenRes.touched ? layerWhenRes.when : layer.when,
      text: nextText,
      hotspots: nextHotspots,
      placedItems: nextPlacedItems,
      placedNpcs: nextPlacedNpcs,
    };
  });

  const dialogueRes = mapWhensInDialogues(node.dialogues, mapWhen);
  if (dialogueRes.touched) touchedNode = true;

  if (!touchedNode) return { node, touched: false };

  return {
    node: {
      ...node,
      layers: nextLayers,
      dialogues: dialogueRes.touched ? dialogueRes.next : node.dialogues,
    },
    touched: true,
  };
}

/* Recorre el proyecto y permite transformar cualquier `when` */
function mapAllWhensInProject(project: Project, mapWhen: WhenMapper): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    const res = mapWhensInNode(node, mapWhen);
    if (res.touched) touchedNodes = true;
    return res.node;
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

/* True si existe algún `when` en cualquier punto del proyecto que cumpla */
function someWhenInProject(project: Project, predicate: (when: WC) => boolean): boolean {
  for (const node of project.nodes) {
    if (someWhenInDialogues(node.dialogues, predicate)) return true;

    for (const layer of node.layers) {
      if (layer.when && someCondition(layer.when, predicate)) return true;

      for (const textEntry of layer.text) {
        if (textEntry.when && someCondition(textEntry.when, predicate)) return true;
      }

      for (const hotspot of layer.hotspots ?? []) {
        if (someWhenInInteractionRules(hotspot.rules, predicate)) return true;
      }

      for (const placedItem of layer.placedItems ?? []) {
        if (someWhenInInteractionRules(placedItem.rules, predicate)) return true;
      }

      for (const placedNpc of layer.placedNpcs ?? []) {
        if (someWhenInInteractionRules(placedNpc.rules, predicate)) return true;
      }
    }
  }

  return false;
}

/* Placed walkers */
type PlacedKey = "placedItems" | "placedNpcs" | "placedPlayers";
type PlacedElem<K extends PlacedKey> = NonNullable<SceneImageLayer[K]>[number];

function somePlaced<K extends PlacedKey>(project: Project, key: K, predicate: (item: PlacedElem<K>) => boolean): boolean {
  for (const node of project.nodes) {
    for (const layer of node.layers) {
      for (const item of (layer[key] ?? []) as PlacedElem<K>[]) {
        if (predicate(item)) return true;
      }
    }
  }

  return false;
}

/* Recoge elementos placed de cualquier tipo según predicate */
export function collectPlaced<K extends PlacedKey>(project: Project, key: K, predicate: (item: PlacedElem<K>) => boolean = () => true): PlacedElem<K>[] {
  const collected: PlacedElem<K>[] = [];

  for (const node of project.nodes) {
    for (const layer of node.layers) {
      for (const item of (layer[key] ?? []) as PlacedElem<K>[]) {
        if (predicate(item)) collected.push(item);
      }
    }
  }

  return collected;
}

function removePlaced<K extends PlacedKey>(project: Project, key: K, predicate: (item: PlacedElem<K>) => boolean): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    let touchedLayers = false;

    const nextLayers = node.layers.map((layer) => {
      const currentItems = (layer[key] ?? []) as PlacedElem<K>[];
      if (currentItems.length === 0) return layer;

      const nextItems = currentItems.filter((item) => !predicate(item));
      if (nextItems.length === currentItems.length) return layer;

      touchedLayers = true;
      return { ...layer, [key]: nextItems } as SceneImageLayer;
    });

    if (!touchedLayers) return node;

    touchedNodes = true;
    return { ...node, layers: nextLayers };
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

export function somePlacedItem(project: Project, predicate: (item: NonNullable<SceneImageLayer["placedItems"]>[number]) => boolean): boolean {
  return somePlaced(project, "placedItems", predicate);
}

export function removePlacedItems(project: Project, predicate: (item: NonNullable<SceneImageLayer["placedItems"]>[number]) => boolean): Project {
  return removePlaced(project, "placedItems", predicate);
}

export function somePlacedNpc(project: Project, predicate: (npc: NonNullable<SceneImageLayer["placedNpcs"]>[number]) => boolean): boolean {
  return somePlaced(project, "placedNpcs", predicate);
}

export function removePlacedNpcs(project: Project, predicate: (npc: NonNullable<SceneImageLayer["placedNpcs"]>[number]) => boolean): Project {
  return removePlaced(project, "placedNpcs", predicate);
}

export function somePlacedPlayer(project: Project, predicate: (player: NonNullable<SceneImageLayer["placedPlayers"]>[number]) => boolean): boolean {  // USARLO
  return somePlaced(project, "placedPlayers", predicate);
}

export function removePlacedPlayers(project: Project, predicate: (player: NonNullable<SceneImageLayer["placedPlayers"]>[number]) => boolean): Project {
  return removePlaced(project, "placedPlayers", predicate);
}

/* Dialogue helpers */
export function someDialogue(project: Project, predicate: (dialogue: Dialogue) => boolean): boolean {  // USARLO Player
  for (const node of project.nodes) {
    for (const dialogue of node.dialogues ?? []) {
      if (predicate(dialogue)) return true;
    }
  }

  return false;
}

export function removeDialogues(project: Project, predicate: (dialogue: Dialogue) => boolean): Project {
  let touchedNodes = false;

  const nextNodes = project.nodes.map((node) => {
    const currentDialogues = node.dialogues ?? [];
    if (currentDialogues.length === 0) return node;

    const nextDialogues = currentDialogues.filter((dialogue) => !predicate(dialogue));
    if (nextDialogues.length === currentDialogues.length) return node;

    touchedNodes = true;
    return { ...node, dialogues: nextDialogues };
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

export function collectDialogueIds(project: Project, predicate: (dialogue: Dialogue) => boolean): Set<ID> {  // USARLO PLAYER
  const ids = new Set<ID>();

  for (const node of project.nodes) {
    for (const dialogue of node.dialogues ?? []) {
      if (predicate(dialogue)) ids.add(dialogue.id);
    }
  }

  return ids;
}

export function effectIsStartDialogueForAnyOf(effect: Effect, dialogueIds: Set<ID>): boolean {  // USARLO PLAYER
  return effect.type === "startDialogue" && dialogueIds.has(effect.nodeDialogueId);
}

/* Helper compuesto para comprobar si una entidad está referenciada */
export function isEntityReferenced(project: Project, input: {
    someSceneRef?: (project: Project) => boolean;
    someWhenRef?: (when: Condition) => boolean;
    someEffectRef?: (effect: Effect) => boolean;
  }): boolean {
  if (input.someSceneRef && input.someSceneRef(project)) return true;
  if (input.someWhenRef && someWhenInProject(project, input.someWhenRef)) return true;
  if (input.someEffectRef && someEffectsInProject(project, input.someEffectRef)) return true;

  return false;
}