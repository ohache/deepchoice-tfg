import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import type {
  BaseInteractionRule,
  ClickRule,
  ID,
  InteractionRules,
  RulePhrase,
  UseItemRule,
} from "@/domain/types";
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

function createEmptyRule(id: ID): BaseInteractionRule {
  return { id, effects: [] };
}

function normalizePhrase(phrase: RulePhrase | undefined): RulePhrase | undefined {
  const text = phrase?.text?.trim();

  if (!phrase || !text) return undefined;

  return { ...phrase, text };
}

function toBaseInteractionRule(rule: ClickRule | UseItemRule): BaseInteractionRule {
  return {
    id: rule.id,
    ...(rule.when ? { when: rule.when } : {}),
    ...(rule.phrase ? { phrase: rule.phrase } : {}),
    effects: rule.effects ?? [],
  };
}

function packClickRule(rule: BaseInteractionRule): ClickRule {
  const phrase = normalizePhrase(rule.phrase);

  return {
    id: rule.id,
    ...(rule.when ? { when: rule.when } : {}),
    ...(phrase ? { phrase } : {}),
    effects: rule.effects ?? [],
  };
}

function packUseItemRule(rule: BaseInteractionRule, itemInstanceId: ID): UseItemRule {
  const phrase = normalizePhrase(rule.phrase);

  return {
    id: rule.id,
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
      if (editingInfo.index < 0) return createEmptyRule(editingInfo.draftRuleId ?? createId());

      const rule = clickRules[editingInfo.index];

      return rule ? toBaseInteractionRule(rule) : createEmptyRule(editingInfo.draftRuleId ?? createId());
    }

    if (editingInfo.index < 0) return createEmptyRule(editingInfo.draftRuleId ?? createId());

    const rule = getRulesForItem(useItemRulesAll, editingInfo.itemInstanceId)[editingInfo.index];

    return rule ? toBaseInteractionRule(rule) : createEmptyRule(editingInfo.draftRuleId ?? createId());
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
    activeChannel, setActiveChannel, clickRules, useItemRulesAll, useItemRulesForSelected, selectedUseItemId, ruleModalOpen, editingInfo, currentRuleValue,
    openAddClickRule, openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule
  }
}