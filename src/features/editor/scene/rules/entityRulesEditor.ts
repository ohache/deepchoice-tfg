import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type { BaseInteractionRule, ClickRule, ID, InteractionRules, RulePhrase, UseItemRule } from "@/domain/types";
import type { RuleChannel } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";
import { generateId } from "@/utils/id";

type EntityRuleEditingInfo =
  | null
  | { channel: "onClick"; index: number; draftRuleId?: ID }
  | { channel: "onUseItem"; itemInstanceId: ID; index: number; draftRuleId?: ID };

type UseEntityRulesEditorArgs = {
  rules?: InteractionRules;
  onChangeRules: (next: InteractionRules) => void;
  createId?: () => ID;
};

type UseEntityRulesEditorResult = {
  activeChannel: RuleChannel;
  setActiveChannel: Dispatch<SetStateAction<RuleChannel>>;

  clickRules: ClickRule[];
  useItemRulesAll: UseItemRule[];
  useItemRulesForSelected: UseItemRule[];
  selectedUseItemId: ID;

  ruleModalOpen: boolean;
  editingInfo: EntityRuleEditingInfo;
  currentRuleValue: BaseInteractionRule | null;

  openAddClickRule: () => void;
  openEditClickRule: (index: number) => void;
  openAddUseItemRule: (itemInstanceId: ID) => void;
  openEditUseItemRule: (itemInstanceId: ID, indexInFiltered: number) => void;

  removeClickRule: (index: number) => void;
  removeUseItemRule: (itemInstanceId: ID, indexInFiltered: number) => void;

  moveClickRule: (fromIndex: number, toIndex: number) => void;
  moveUseItemRule: (itemInstanceId: ID, fromIndex: number, toIndex: number) => void;

  closeRuleModal: () => void;
  saveRule: (rule: BaseInteractionRule) => void;
};

const EMPTY_RULES: InteractionRules = {};
const EMPTY_CLICK_RULES: ClickRule[] = [];
const EMPTY_USE_ITEM_RULES: UseItemRule[] = [];

const defaultCreateId = () => generateId.rule();

function getRulesForItem(rules: UseItemRule[], itemInstanceId: ID): UseItemRule[] {
  return rules.filter((rule) => rule.itemInstanceId === itemInstanceId);
}

function buildDefaultRuleLabel(rules: Array<Pick<BaseInteractionRule, "label">>): string {
  const usedLabels = new Set(rules.map((rule) => (rule.label ?? "").trim().toLowerCase()).filter(Boolean));

  let index = rules.length + 1;
  let label = `Regla ${index}`;

  while (usedLabels.has(label.toLowerCase())) {
    index += 1;
    label = `Regla ${index}`;
  }

  return label;
}

function normalizeRuleLabel(label: string | undefined, fallback: string): string {
  return label?.trim() || fallback;
}

function createEmptyRule(id: ID, label: string): BaseInteractionRule {
  return { id, label, effects: [] };
}

function normalizePhrase(phrase: RulePhrase | undefined): RulePhrase | undefined {
  const text = phrase?.text?.trim();

  if (!phrase || !text) return undefined;

  return { ...phrase, text };
}

function toBaseInteractionRule(rule: ClickRule | UseItemRule, fallbackLabel: string): BaseInteractionRule {
  return {
    id: rule.id,
    label: normalizeRuleLabel(rule.label, fallbackLabel),
    ...(rule.when ? { when: rule.when } : {}),
    ...(rule.phrase ? { phrase: rule.phrase } : {}),
    effects: rule.effects ?? [],
  };
}

function packClickRule(rule: BaseInteractionRule): ClickRule {
  const phrase = normalizePhrase(rule.phrase);

  return {
    id: rule.id,
    label: rule.label.trim(),
    ...(rule.when ? { when: rule.when } : {}),
    ...(phrase ? { phrase } : {}),
    effects: rule.effects ?? [],
  };
}

function packUseItemRule(rule: BaseInteractionRule, itemInstanceId: ID): UseItemRule {
  const phrase = normalizePhrase(rule.phrase);

  return {
    id: rule.id,
    label: rule.label.trim(),
    itemInstanceId,
    ...(rule.when ? { when: rule.when } : {}),
    ...(phrase ? { phrase } : {}),
    effects: rule.effects ?? [],
  };
}

function removeUseItemRuleAt(rules: UseItemRule[], itemInstanceId: ID, indexInFiltered: number): UseItemRule[] {
  let currentIndex = -1;

  return rules.filter((rule) => {
    if (rule.itemInstanceId !== itemInstanceId) return true;

    currentIndex += 1;

    return currentIndex !== indexInFiltered;
  });
}

function replaceUseItemRuleAt(rules: UseItemRule[], itemInstanceId: ID, indexInFiltered: number, nextRule: UseItemRule): UseItemRule[] {
  let currentIndex = -1;
  let replaced = false;

  const nextRules = rules.map((rule) => {
    if (rule.itemInstanceId !== itemInstanceId) return rule;

    currentIndex += 1;

    if (currentIndex !== indexInFiltered) return rule;

    replaced = true;
    return nextRule;
  });

  return replaced ? nextRules : [...nextRules, nextRule];
}

function canReorder(length: number, fromIndex: number, toIndex: number): boolean {
  if (fromIndex === toIndex) return false;
  if (fromIndex < 0 || fromIndex >= length) return false;
  if (toIndex < 0 || toIndex >= length) return false;

  return true;
}

function reorderList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (!canReorder(items.length, fromIndex, toIndex)) return items;

  const next = items.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);

  return next;
}

function reorderUseItemRuleAt(rules: UseItemRule[], itemInstanceId: ID, fromIndex: number, toIndex: number): UseItemRule[] {
  const selectedRules = getRulesForItem(rules, itemInstanceId);

  if (!canReorder(selectedRules.length, fromIndex, toIndex)) return rules;

  const reorderedSelectedRules = reorderList(selectedRules, fromIndex, toIndex);

  let selectedIndex = 0;

  return rules.map((rule) => {
    if (rule.itemInstanceId !== itemInstanceId) return rule;

    const nextRule = reorderedSelectedRules[selectedIndex];
    selectedIndex += 1;

    return nextRule ?? rule;
  });
}

/* Hook reutilizable para editar reglas de interacción de cualquier entidad */
export function useEntityRulesEditor({ rules, onChangeRules, createId = defaultCreateId }: UseEntityRulesEditorArgs): UseEntityRulesEditorResult {
  const normalizedRules = useMemo<InteractionRules>(() => rules ?? EMPTY_RULES, [rules]);

  const clickRules = normalizedRules.onClick ?? EMPTY_CLICK_RULES;
  const useItemRulesAll = normalizedRules.onUseItem ?? EMPTY_USE_ITEM_RULES;

  const [activeChannel, setActiveChannel] = useState<RuleChannel>({ type: "onClick" });
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EntityRuleEditingInfo>(null);

  const selectedUseItemId = activeChannel.type === "onUseItem" ? activeChannel.itemInstanceId : "";

  const useItemRulesForSelected = useMemo(() => {
    if (activeChannel.type !== "onUseItem") return EMPTY_USE_ITEM_RULES;

    return getRulesForItem(useItemRulesAll, activeChannel.itemInstanceId);
  }, [activeChannel, useItemRulesAll]);

  const currentRuleValue = useMemo((): BaseInteractionRule | null => {
    if (!ruleModalOpen || !editingInfo) return null;

    if (editingInfo.channel === "onClick") {
      const fallbackLabel = `Regla ${editingInfo.index + 1}`;

      if (editingInfo.index < 0) return createEmptyRule(editingInfo.draftRuleId ?? createId(), buildDefaultRuleLabel(clickRules));

      const rule = clickRules[editingInfo.index];

      return rule ? toBaseInteractionRule(rule, fallbackLabel) : createEmptyRule(editingInfo.draftRuleId ?? createId(), buildDefaultRuleLabel(clickRules));
    }

    const itemRules = getRulesForItem(useItemRulesAll, editingInfo.itemInstanceId);
    const fallbackLabel = `Regla ${editingInfo.index + 1}`;

    if (editingInfo.index < 0) return createEmptyRule(editingInfo.draftRuleId ?? createId(), buildDefaultRuleLabel(itemRules));

    const rule = itemRules[editingInfo.index];

    return rule ? toBaseInteractionRule(rule, fallbackLabel) : createEmptyRule(editingInfo.draftRuleId ?? createId(), buildDefaultRuleLabel(itemRules));
  }, [ruleModalOpen, editingInfo, clickRules, useItemRulesAll, createId]);

  const openAddClickRule = useCallback(() => {
    setEditingInfo({ channel: "onClick", index: -1, draftRuleId: createId() });

    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  }, [createId]);

  const openEditClickRule = useCallback((index: number) => {
    setEditingInfo({ channel: "onClick", index });

    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  }, []);

  const openAddUseItemRule = useCallback((itemInstanceId: ID) => {
    setEditingInfo({ channel: "onUseItem", itemInstanceId, index: -1, draftRuleId: createId() });

    setRuleModalOpen(true);
    setActiveChannel({ type: "onUseItem", itemInstanceId });
  }, [createId]);

  const openEditUseItemRule = useCallback((itemInstanceId: ID, indexInFiltered: number) => {
    setEditingInfo({ channel: "onUseItem", itemInstanceId, index: indexInFiltered });

    setRuleModalOpen(true);
    setActiveChannel({ type: "onUseItem", itemInstanceId });
  }, []);

  const removeClickRule = useCallback((index: number) => {
    const nextClickRules = clickRules.filter((_, currentIndex) => currentIndex !== index);

    onChangeRules({ ...normalizedRules, onClick: nextClickRules });
  }, [clickRules, normalizedRules, onChangeRules],
  );

  const removeUseItemRule = useCallback((itemInstanceId: ID, indexInFiltered: number) => {
    const nextUseItemRules = removeUseItemRuleAt(useItemRulesAll, itemInstanceId, indexInFiltered);

    onChangeRules({ ...normalizedRules, onUseItem: nextUseItemRules });
  }, [useItemRulesAll, normalizedRules, onChangeRules],
  );

  const moveClickRule = useCallback((fromIndex: number, toIndex: number) => {
    const nextClickRules = reorderList(clickRules, fromIndex, toIndex);

    if (nextClickRules === clickRules) return;

    onChangeRules({ ...normalizedRules, onClick: nextClickRules });
  }, [clickRules, normalizedRules, onChangeRules]);

  const moveUseItemRule = useCallback((itemInstanceId: ID, fromIndex: number, toIndex: number) => {
    const nextUseItemRules = reorderUseItemRuleAt(useItemRulesAll, itemInstanceId, fromIndex, toIndex);

    if (nextUseItemRules === useItemRulesAll) return;

    onChangeRules({ ...normalizedRules, onUseItem: nextUseItemRules });
  }, [useItemRulesAll, normalizedRules, onChangeRules]);

  const closeRuleModal = useCallback(() => {
    setRuleModalOpen(false);
    setEditingInfo(null);
  }, []);

  const saveRule = useCallback(
    (rule: BaseInteractionRule) => {
      if (!editingInfo) return;

      if (editingInfo.channel === "onClick") {
        const nextClickRules = [...clickRules];
        const packedRule = packClickRule(rule);

        if (editingInfo.index >= 0 && nextClickRules[editingInfo.index]) nextClickRules[editingInfo.index] = packedRule;
        else nextClickRules.push(packedRule);

        onChangeRules({ ...normalizedRules, onClick: nextClickRules });

        closeRuleModal();
        return;
      }

      const packedRule = packUseItemRule(rule, editingInfo.itemInstanceId);

      const nextUseItemRules = editingInfo.index >= 0 ? replaceUseItemRuleAt(useItemRulesAll, editingInfo.itemInstanceId, editingInfo.index, packedRule) : [...useItemRulesAll, packedRule];

      onChangeRules({ ...normalizedRules, onUseItem: nextUseItemRules });

      closeRuleModal();
    }, [editingInfo, clickRules, useItemRulesAll, normalizedRules, onChangeRules, closeRuleModal],
  );

  return {
    activeChannel, setActiveChannel, clickRules, useItemRulesAll, useItemRulesForSelected, selectedUseItemId, ruleModalOpen, editingInfo, currentRuleValue, openAddClickRule,
    openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, moveClickRule, moveUseItemRule, closeRuleModal, saveRule
  }
}