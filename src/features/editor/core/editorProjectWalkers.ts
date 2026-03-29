import type { ID, Node, Project, InteractionRules, ImageInteractionLayer } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { someEffectsInProject } from "@/features/editor/core/editorGenericSlice";

/* Firma de un “mapper” de when */
export type WhenMapper = (when: Condition | undefined) => {
  when: Condition | undefined;
  touched: boolean;
};

type WC = Condition;

/* Condition helpers */
export function mapCondition(cond: WC | undefined, mapper: (c: WC) => WC | undefined): { when: WC | undefined; touched: boolean } {
  if (!cond) return { when: cond, touched: false };

  const recur = (c: WC): WC | undefined => {
    switch (c.type) {
      case "and": {
        const all0 = c.all ?? [];
        let touched = false;

        const all1 = all0
          .map((x) => {
            const nx = x ? recur(x) : undefined;
            if (nx !== x) touched = true;
            return nx;
          })
          .filter(Boolean) as WC[];

        if (all1.length === 0) return undefined;
        if (all1.length === 1) return all1[0];

        const next = touched ? ({ ...c, all: all1 } as WC) : c;
        return mapper(next);
      }

      case "or": {
        const any0 = c.any ?? [];
        let touched = false;

        const any1 = any0
          .map((x) => {
            const nx = x ? recur(x) : undefined;
            if (nx !== x) touched = true;
            return nx;
          })
          .filter(Boolean) as WC[];

        if (any1.length === 0) return undefined;
        if (any1.length === 1) return any1[0];

        const next = touched ? ({ ...c, any: any1 } as WC) : c;
        return mapper(next);
      }

      case "not": {
        const inner0 = c.cond;
        const inner1 = inner0 ? recur(inner0) : undefined;
        if (!inner1) return undefined;

        const next = inner1 !== inner0 ? ({ ...c, cond: inner1 } as WC) : c;
        return mapper(next);
      }

      default:
        return mapper(c);
    }
  };

  const next = recur(cond);
  return { when: next, touched: next !== cond };
}

function someCondition(cond: WC | undefined, predicate: (c: WC) => boolean): boolean {
  if (!cond) return false;

  const visit = (c: WC): boolean => {
    if (predicate(c)) return true;

    switch (c.type) {
      case "and":
        return (c.all ?? []).some((x) => x && visit(x));
      case "or":
        return (c.any ?? []).some((x) => x && visit(x));
      case "not":
        return c.cond ? visit(c.cond) : false;
      default:
        return false;
    }
  };

  return visit(cond);
}

export function someWhenReferences(when: WC | undefined, predicate: (c: WC) => boolean): boolean {
  return someCondition(when, predicate);
}

/* InteractionRules walkers */
function mapWhensInInteractionRules(rules: InteractionRules | undefined, mapWhen: WhenMapper): { next: InteractionRules | undefined; touched: boolean } {
  if (!rules) return { next: rules, touched: false };

  let touched = false;

  const mapRuleList = <T extends { when?: WC }>(list0: T[] | undefined): T[] | undefined => {
    const arr0 = list0 ?? [];
    if (arr0.length === 0) return list0;

    let touchedList = false;

    const arr1 = arr0.map((r) => {
      const res = mapWhen(r.when);
      if (!res.touched) return r;
      touchedList = true;
      return { ...r, when: res.when };
    });

    if (touchedList) touched = true;
    return touchedList ? arr1 : list0;
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

  for (const r of rules.onClick ?? []) if (r.when && someCondition(r.when, predicate)) return true;
  for (const r of rules.onUseItem ?? []) if (r.when && someCondition(r.when, predicate)) return true;

  return false;
}

/* Dialogues (inside layers) */
function mapWhensInDialogues(dialogues: ImageInteractionLayer["dialogues"] | undefined, mapWhen: WhenMapper,
): { next: NonNullable<ImageInteractionLayer["dialogues"]>; touched: boolean } {
  const dialogues0 = dialogues ?? [];
  if (dialogues0.length === 0) return { next: dialogues0, touched: false };

  let touchedDialogues = false;

  const nextDialogues = dialogues0.map((d) => {
    const dNodes0 = d.nodes ?? [];
    if (dNodes0.length === 0) return d;

    let touchedDNodes = false;

    const nextDNodes = dNodes0.map((dn) => {
      const choices0 = dn.choices ?? [];
      if (choices0.length === 0) return dn;

      let touchedChoices = false;

      const nextChoices = choices0.map((ch) => {
        const res = mapWhen(ch.when);
        if (!res.touched) return ch;

        touchedChoices = true;
        return { ...ch, when: res.when };
      });

      if (!touchedChoices) return dn;

      touchedDNodes = true;
      return { ...dn, choices: nextChoices };
    });

    if (!touchedDNodes) return d;

    touchedDialogues = true;
    return { ...d, nodes: nextDNodes };
  });

  return { next: nextDialogues, touched: touchedDialogues };
}

function someWhenInDialogues(dialogues: ImageInteractionLayer["dialogues"] | undefined, predicate: (when: WC) => boolean): boolean {
  for (const d of dialogues ?? []) {
    for (const dn of d.nodes ?? []) {
      for (const ch of dn.choices ?? []) {
        if (ch.when && someCondition(ch.when, predicate)) return true;
      }
    }
  }
  return false;
}

/* Node-level traversal: imageInteractions layers */
function mapWhensInNode(node: Node, mapWhen: WhenMapper): { node: Node; touched: boolean } {
  const layers0 = node.imageInteractions ?? [];
  if (layers0.length === 0) return { node, touched: false };

  let touchedNode = false;

  const nextLayers = layers0.map((layer) => {
    let touchedLayer = false;

    // Hotspots.rules.when
    const hotspots0 = layer.hotspots ?? [];
    let nextHotspots = layer.hotspots;

    if (hotspots0.length > 0) {
      let touchedHotspots = false;

      const hs1 = hotspots0.map((hs) => {
        const res = mapWhensInInteractionRules(hs.rules, mapWhen);
        if (!res.touched) return hs;
        touchedHotspots = true;
        return { ...hs, rules: res.next ?? hs.rules };
      });

      if (touchedHotspots) {
        touchedLayer = true;
        nextHotspots = hs1;
      }
    }

    // PlacedItems.rules.when
    const placedItems0 = layer.placedItems ?? [];
    let nextPlacedItems = layer.placedItems;

    if (placedItems0.length > 0) {
      let touchedItems = false;

      const pi1 = placedItems0.map((pi) => {
        const res = mapWhensInInteractionRules(pi.rules, mapWhen);
        if (!res.touched) return pi;
        touchedItems = true;
        return { ...pi, rules: res.next ?? pi.rules };
      });

      if (touchedItems) {
        touchedLayer = true;
        nextPlacedItems = pi1;
      }
    }

    // PlacedNpcs.rules.when
    const placedNpcs0 = layer.placedNpcs ?? [];
    let nextPlacedNpcs = layer.placedNpcs;

    if (placedNpcs0.length > 0) {
      let touchedNpcs = false;

      const pn1 = placedNpcs0.map((pn) => {
        const res = mapWhensInInteractionRules(pn.rules, mapWhen);
        if (!res.touched) return pn;
        touchedNpcs = true;
        return { ...pn, rules: res.next ?? pn.rules };
      });

      if (touchedNpcs) {
        touchedLayer = true;
        nextPlacedNpcs = pn1;
      }
    }

    // Dialogues.choice.when
    const rDialogues = mapWhensInDialogues(layer.dialogues, mapWhen);
    if (rDialogues.touched) touchedLayer = true;

    if (!touchedLayer) return layer;

    touchedNode = true;
    return {
      ...layer,
      hotspots: nextHotspots,
      placedItems: nextPlacedItems,
      placedNpcs: nextPlacedNpcs,
      dialogues: rDialogues.touched ? rDialogues.next : layer.dialogues,
    };
  });

  if (!touchedNode) return { node, touched: false };

  return {
    node: {
      ...node,
      imageInteractions: nextLayers,
    },
    touched: true,
  };
}

/* Public: map + some */

/* Recorre el proyecto y permite transformar cualquier `when` (rules + dialogue choices) */
export function mapAllWhensInProject(project: Project, mapWhen: WhenMapper): Project {
  const nodes0 = project.nodes ?? [];
  let touchedNodes = false;

  const nextNodes = nodes0.map((node) => {
    const res = mapWhensInNode(node, mapWhen);
    if (res.touched) touchedNodes = true;
    return res.node;
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

/* Predicate rápido: true si existe algún when (en cualquier sitio) que cumpla */
export function someWhenInProject(project: Project, predicate: (when: WC) => boolean): boolean {
  for (const node of project.nodes ?? []) {
    for (const layer of node.imageInteractions ?? []) {
      for (const hs of layer.hotspots ?? []) if (someWhenInInteractionRules(hs.rules, predicate)) return true;
      for (const pi of layer.placedItems ?? []) if (someWhenInInteractionRules(pi.rules, predicate)) return true;
      for (const pn of layer.placedNpcs ?? []) if (someWhenInInteractionRules(pn.rules, predicate)) return true;
      if (someWhenInDialogues(layer.dialogues, predicate)) return true;
    }
  }
  return false;
}

/* Placed walkers */
type PlacedKey = "placedItems" | "placedNpcs" | "placedPlayers";
type PlacedElem<K extends PlacedKey> = NonNullable<ImageInteractionLayer[K]>[number];

function somePlaced<K extends PlacedKey>(project: Project, key: K, predicate: (x: PlacedElem<K>) => boolean): boolean {
  for (const n of project.nodes ?? []) {
    for (const layer of n.imageInteractions ?? []) {
      for (const x of (layer[key] ?? []) as PlacedElem<K>[]) {
        if (predicate(x)) return true;
      }
    }
  }
  return false;
}

function removePlaced<K extends PlacedKey>(project: Project, key: K, predicate: (x: PlacedElem<K>) => boolean): Project {
  const nodes0 = project.nodes ?? [];
  let touchedNodes = false;

  const nextNodes = nodes0.map((node) => {
    const layers0 = node.imageInteractions ?? [];
    if (layers0.length === 0) return node;

    let touchedLayers = false;

    const nextLayers = layers0.map((layer) => {
      const arr0 = (layer[key] ?? []) as PlacedElem<K>[];
      if (arr0.length === 0) return layer;

      const arr1 = arr0.filter((x) => !predicate(x));
      if (arr1.length === arr0.length) return layer;

      touchedLayers = true;
      return { ...layer, [key]: arr1 } as ImageInteractionLayer;
    });

    if (!touchedLayers) return node;

    touchedNodes = true;
    return { ...node, imageInteractions: nextLayers };
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

export function somePlacedItem(project: Project, predicate: (pi: NonNullable<ImageInteractionLayer["placedItems"]>[number]) => boolean): boolean {
  return somePlaced(project, "placedItems", predicate);
}

export function removePlacedItems(project: Project, predicate: (pi: NonNullable<ImageInteractionLayer["placedItems"]>[number]) => boolean): Project {
  return removePlaced(project, "placedItems", predicate);
}

export function somePlacedNpc(project: Project, predicate: (pn: NonNullable<ImageInteractionLayer["placedNpcs"]>[number]) => boolean): boolean {
  return somePlaced(project, "placedNpcs", predicate);
}

export function removePlacedNpcs(project: Project, predicate: (pn: NonNullable<ImageInteractionLayer["placedNpcs"]>[number]) => boolean): Project {
  return removePlaced(project, "placedNpcs", predicate);
}

export function somePlacedPlayer(project: Project, predicate: (pp: NonNullable<ImageInteractionLayer["placedPlayers"]>[number]) => boolean): boolean {
  return somePlaced(project, "placedPlayers", predicate);
}

export function removePlacedPlayers(project: Project, predicate: (pp: NonNullable<ImageInteractionLayer["placedPlayers"]>[number]) => boolean): Project {
  return removePlaced(project, "placedPlayers", predicate);
}

/* Dialogues helpers */
export function someDialogue(project: Project, predicate: (d: NonNullable<ImageInteractionLayer["dialogues"]>[number]) => boolean): boolean {
  for (const node of project.nodes ?? []) {
    for (const layer of node.imageInteractions ?? []) {
      for (const d of layer.dialogues ?? []) {
        if (predicate(d)) return true;
      }
    }
  }
  return false;
}

export function removeDialogues(project: Project, predicate: (d: NonNullable<ImageInteractionLayer["dialogues"]>[number]) => boolean): Project {
  const nodes0 = project.nodes ?? [];
  let touchedNodes = false;

  const nextNodes = nodes0.map((node) => {
    const layers0 = node.imageInteractions ?? [];
    if (layers0.length === 0) return node;

    let touchedLayers = false;

    const nextLayers = layers0.map((layer) => {
      const d0 = layer.dialogues ?? [];
      if (d0.length === 0) return layer;

      const d1 = d0.filter((d) => !predicate(d));
      if (d1.length === d0.length) return layer;

      touchedLayers = true;
      return { ...layer, dialogues: d1 };
    });

    if (!touchedLayers) return node;

    touchedNodes = true;
    return { ...node, imageInteractions: nextLayers };
  });

  if (!touchedNodes) return project;
  return { ...project, nodes: nextNodes };
}

export function collectDialogueIds(project: Project, predicate: (d: NonNullable<ImageInteractionLayer["dialogues"]>[number]) => boolean): Set<ID> {
  const ids = new Set<ID>();
  for (const node of project.nodes ?? []) {
    for (const layer of node.imageInteractions ?? []) {
      for (const d of layer.dialogues ?? []) {
        if (predicate(d)) ids.add(d.id);
      }
    }
  }
  return ids;
}

export function effectIsStartDialogueForAnyOf(e: Effect, dialogueIds: Set<ID>): boolean {
  if (e.type !== "startDialogue") return false;
  return dialogueIds.has(e.nodeDialogueId);
}

/* =========================================================
   Player removal from conditions (new model)
   ========================================================= */

export function removePlayerFromConditionsInProject(project: Project, playerId: ID): Project {
  return mapAllWhensInProject(project, (when) => {
    return mapCondition(when, (c) => {
      if (c.type === "playerVar" && c.playerId === playerId) return undefined;
      if (c.type === "playerMemory" && c.playerId === playerId) return undefined;
      if (c.type === "relationVar" && c.playerId === playerId) return undefined;
      return c;
    });
  });
}

/* =========================================================
   Entity referenced helper
   ========================================================= */

export function isEntityReferenced(
  project: Project,
  input: {
    someSceneRef?: (project: Project) => boolean;
    someWhenRef?: (when: Condition) => boolean;
    someEffectRef?: (e: Effect) => boolean;
  },
): boolean {
  if (input.someSceneRef && input.someSceneRef(project)) return true;

  if (input.someWhenRef && someWhenInProject(project, input.someWhenRef)) return true;

  if (input.someEffectRef && someEffectsInProject(project, input.someEffectRef)) return true;

  return false;
}