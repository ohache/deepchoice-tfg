import type { ID } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import { isEnabledLeaf, type EnabledLeafCondition } from "@/features/editor/scene/rules/conditions/conditionLeafRegistry";

/* Átomo editable en UI */
export type UiAtom = {
  id: ID;
  not: boolean;
  cond: EnabledLeafCondition;
  collapsed: boolean;
};

export type UiGroup = {
  id: ID;
  atoms: UiAtom[];
};

export type UiDraft = {
  groups: UiGroup[];
  lastGroupId?: ID;
};

/* API pública */
export function createDefaultRootCondition(): Condition {
  return { type: "and", all: [] };
}

export function createEmptyUiDraft(): UiDraft {
  return {
    groups: [{ id: generateId.conditionGroup(), atoms: [] }],
    lastGroupId: undefined,
  };
}

export function ensureAtLeastOneGroup(draft: UiDraft): UiDraft {
  if ((draft.groups ?? []).length > 0) return draft;

  const group = { id: generateId.conditionGroup(), atoms: [] };
  return { ...draft, groups: [group], lastGroupId: group.id };
}

export function makeAtom(cond: EnabledLeafCondition, not: boolean): UiAtom {
  return { id: generateId.condition(), not, cond, collapsed: true };
}

export function moveAtomBetweenGroups(args: {
  draft: UiDraft;
  fromGroupId: ID;
  fromIndex: number;
  toGroupId: ID;
  toIndex: number | null;
}): UiDraft {
  const { draft, fromGroupId, fromIndex, toGroupId, toIndex } = args;

  const groups = (draft.groups ?? []).map((g) => ({ ...g, atoms: [...(g.atoms ?? [])] }));

  const fromG = groups.find((g) => g.id === fromGroupId);
  const toG = groups.find((g) => g.id === toGroupId);
  if (!fromG || !toG) return draft;

  const atom = fromG.atoms[fromIndex];
  if (!atom) return draft;

  fromG.atoms.splice(fromIndex, 1);

  const insertAt = toIndex == null ? toG.atoms.length : Math.max(0, Math.min(toG.atoms.length, toIndex));
  toG.atoms.splice(insertAt, 0, atom);

  const prunedGroups = groups.filter((g) => (g.atoms?.length ?? 0) > 0);
  if (prunedGroups.length === 0) return createEmptyUiDraft();

  const nextLast = prunedGroups.some((g) => g.id === toGroupId)
    ? toGroupId
    : prunedGroups[prunedGroups.length - 1].id;

  return { ...draft, groups: prunedGroups, lastGroupId: nextLast };
}

export function pruneEmptyGroups(draft: UiDraft): UiDraft {
  const kept = (draft.groups ?? []).filter((g) => (g.atoms ?? []).length > 0);
  if (kept.length === 0) return createEmptyUiDraft();
  return { ...draft, groups: kept };
}

/* Convierte una condiciónd de dominio al modelo editable por UI */
export function conditionToUiDraft(value: Condition | null | undefined): UiDraft {
  if (!value) return createEmptyUiDraft();

  const mkAtomFromCondition = (c: Condition): UiAtom | null => {
    if (c.type === "not") {
      const inner = c.cond;
      if (!isEnabledLeaf(inner)) return null;
      return { id: generateId.condition(), not: true, cond: inner, collapsed: true };
    }

    if (isEnabledLeaf(c)) {
      return { id: generateId.condition(), not: false, cond: c, collapsed: true };
    }

    return null;
  };

  const mkGroupFromCondition = (c: Condition): UiGroup => {
    if (c.type === "and") {
      const atoms = (c.all ?? []).map(mkAtomFromCondition).filter(Boolean) as UiAtom[];
      return { id: generateId.conditionGroup(), atoms };
    }

    const atom = mkAtomFromCondition(c);
    return { id: generateId.conditionGroup(), atoms: atom ? [atom] : [] };
  };

  if (value.type === "or") {
    const groups = (value.any ?? []).map((child) => mkGroupFromCondition(child));
    return {
      groups: groups.length ? groups : createEmptyUiDraft().groups,
      lastGroupId: groups[0]?.id,
    };
  }

  if (value.type === "and") {
    const g = mkGroupFromCondition(value);
    return { groups: [g], lastGroupId: g.id };
  }

  const g = mkGroupFromCondition(value);
  return { groups: [g], lastGroupId: g.id };
}

/* Convierte el modelo UI a condición de dominio */
export function uiDraftToCondition(draft: UiDraft): Condition {
  const groups = draft.groups ?? [];
  if (!groups.length) return createDefaultRootCondition();

  const atomToCondition = (a: UiAtom): Condition => (a.not ? { type: "not", cond: a.cond } : a.cond);
  const groupToAnd = (g: UiGroup): Condition => ({ type: "and", all: (g.atoms ?? []).map(atomToCondition) });

  if (groups.length === 1) return groupToAnd(groups[0]);

  return { type: "or", any: groups.map(groupToAnd) };
}