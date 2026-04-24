import { useCallback, useMemo, useState } from "react";
import type { ID, BaseInteractionRule, ClickRule, InteractionRules, UseItemRule } from "@/domain/types";
import type { Effect } from "@/domain/effects";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";

export type EntityRuleChannel =
  | { type: "onClick" }
  | { type: "onUseItem"; placedItemId: ID };

export type EntityRuleEditingInfo =
  | null
  | { channel: "onClick"; index: number }
  | { channel: "onUseItem"; placedItemId: ID; index: number };

type UseEntityRulesEditorArgs = {
  rules?: InteractionRules;
  onChangeRules: (next: InteractionRules) => void;
  createId?: () => ID;
};

type RuleDraftValue = {
  id: ID;
  when?: Condition;
  phrase?: string;
  effects: Effect[];
};

type UseEntityRulesEditorResult = {
  activeChannel: EntityRuleChannel;
  setActiveChannel: React.Dispatch<React.SetStateAction<EntityRuleChannel>>;

  clickRules: ClickRule[];
  useItemRulesAll: UseItemRule[];
  useItemRulesForSelected: UseItemRule[];
  selectedUseItemId: ID;

  ruleModalOpen: boolean;
  editingInfo: EntityRuleEditingInfo;
  currentRuleValue: BaseInteractionRule | null;

  openAddClickRule: () => void;
  openEditClickRule: (index: number) => void;
  openAddUseItemRule: (placedItemId: ID) => void;
  openEditUseItemRule: (placedItemId: ID, indexInFiltered: number) => void;

  removeClickRule: (index: number) => void;
  removeUseItemRule: (placedItemId: ID, indexInFiltered: number) => void;

  closeRuleModal: () => void;
  saveRule: (rule: RuleDraftValue) => void;
};

function ensureId(value: unknown): ID {
  const normalized = String(value ?? "").trim();
  return normalized || crypto.randomUUID();
}


function createEmptyRule(createId: () => ID): BaseInteractionRule {
  return { id: createId(), when: undefined, effects: [] };
}

/* Convierte una regla persistida en el formato que consume el modal */
function toBaseInteractionRule(rule: ClickRule | UseItemRule): BaseInteractionRule {
  return { id: ensureId(rule.id), when: rule.when ?? undefined, phrase: rule.phrase ?? undefined, effects: rule.effects };
}

/* Hook reutilizable para editar reglas de interacción de cualquier entidad */
export function useEntityRulesEditor({ rules, onChangeRules, createId = () => generateId.rule() }: UseEntityRulesEditorArgs): UseEntityRulesEditorResult {
  const normalizedRules: InteractionRules = rules ?? {};
  const clickRules: ClickRule[] = normalizedRules.onClick ?? [];
  const useItemRulesAll: UseItemRule[] = normalizedRules.onUseItem ?? [];

  const [activeChannel, setActiveChannel] = useState<EntityRuleChannel>({ type: "onClick" });
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EntityRuleEditingInfo>(null);

  const selectedUseItemId = activeChannel.type === "onUseItem" ? activeChannel.placedItemId : "";

  const useItemRulesForSelected = useMemo(() => {
    if (activeChannel.type !== "onUseItem") return [];

    return useItemRulesAll.filter((rule) => rule.placedItemId === activeChannel.placedItemId);
  }, [activeChannel, useItemRulesAll]);

  /* Valor actual que debe cargarse en el modal */
  const currentRuleValue = useMemo((): BaseInteractionRule | null => {
    if (!ruleModalOpen || !editingInfo) return null;

    if (editingInfo.channel === "onClick") {
      if (editingInfo.index < 0) return createEmptyRule(createId);

      const rule = clickRules[editingInfo.index];
      return rule ? toBaseInteractionRule(rule) : createEmptyRule(createId);
    }

    const filteredRules = useItemRulesAll.filter((rule) => rule.placedItemId === editingInfo.placedItemId);

    if (editingInfo.index < 0) return createEmptyRule(createId);

    const rule = filteredRules[editingInfo.index];
    return rule ? toBaseInteractionRule(rule) : createEmptyRule(createId);
  }, [ruleModalOpen, editingInfo, clickRules, useItemRulesAll, createId]);

  const openAddClickRule = useCallback(() => {
    setEditingInfo({ channel: "onClick", index: -1 });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  }, []);

  const openEditClickRule = useCallback((index: number) => {
    setEditingInfo({ channel: "onClick", index });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  }, []);

  const openAddUseItemRule = useCallback((placedItemId: ID) => {
    setEditingInfo({ channel: "onUseItem", placedItemId, index: -1 });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onUseItem", placedItemId });
  }, []);

  const openEditUseItemRule = useCallback(
    (placedItemId: ID, indexInFiltered: number) => {setEditingInfo({ channel: "onUseItem", placedItemId, index: indexInFiltered });
      setRuleModalOpen(true);
      setActiveChannel({ type: "onUseItem", placedItemId });
    }, [],
  );

  const removeClickRule = useCallback(
    (index: number) => {
      const next = [...clickRules];
      next.splice(index, 1);

      onChangeRules({ ...normalizedRules, onClick: next });
    }, [clickRules, normalizedRules, onChangeRules],
  );

  const removeUseItemRule = useCallback(
    (placedItemId: ID, indexInFiltered: number) => {
      const filteredRules = useItemRulesAll.filter((rule) => rule.placedItemId === placedItemId);

      const targetRule = filteredRules[indexInFiltered];
      if (!targetRule) return;

      const nextAll = useItemRulesAll.filter((rule) => rule !== targetRule);

      onChangeRules({ ...normalizedRules, onUseItem: nextAll });
    }, [useItemRulesAll, normalizedRules, onChangeRules],
  );

  const closeRuleModal = useCallback(() => {
    setRuleModalOpen(false);
    setEditingInfo(null);
  }, []);

  const saveRule = useCallback(
    (rule: RuleDraftValue) => {
      if (!editingInfo) return;

      if (editingInfo.channel === "onClick") {
        const next = [...clickRules];

        const packed: ClickRule = {
          id: rule.id,
          ...(rule.when ? { when: rule.when } : {}),
          ...(rule.phrase ? { phrase: rule.phrase } : {}),
          effects: rule.effects,
        };

        if (editingInfo.index >= 0) next[editingInfo.index] = packed;
        else next.push(packed);

        onChangeRules({ ...normalizedRules, onClick: next });

        closeRuleModal();
        return;
      }

      const placedItemId = editingInfo.placedItemId;

      const packed: UseItemRule = {
        id: rule.id,
        placedItemId,
        ...(rule.when ? { when: rule.when } : {}),
        ...(rule.phrase ? { phrase: rule.phrase } : {}),
        effects: rule.effects,
      };

      const filteredRules = useItemRulesAll.filter((currentRule) => currentRule.placedItemId === placedItemId);

      const targetRule = filteredRules[editingInfo.index];

      const nextAll = editingInfo.index >= 0 && targetRule
          ? useItemRulesAll.map((currentRule) => currentRule === targetRule ? packed : currentRule)
          : [...useItemRulesAll, packed];

      onChangeRules({ ...normalizedRules, onUseItem: nextAll });

      closeRuleModal();
    }, [editingInfo, clickRules, useItemRulesAll, normalizedRules, onChangeRules, closeRuleModal ],
  );

  return { activeChannel, setActiveChannel, clickRules, useItemRulesAll, useItemRulesForSelected, selectedUseItemId, ruleModalOpen, editingInfo, currentRuleValue,
    openAddClickRule, openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule };
}