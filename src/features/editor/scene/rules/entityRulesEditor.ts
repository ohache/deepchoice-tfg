import { useMemo, useState } from "react";
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
  saveRule: (rule: { id: ID; when?: Condition; effects: Effect[] }) => void;
};

function ensureId(v: unknown): ID {
  const s = String(v ?? "").trim();
  return s || crypto.randomUUID();
}

export function useEntityRulesEditor({
  rules,
  onChangeRules,
  createId = () => generateId.rule(),
}: UseEntityRulesEditorArgs): UseEntityRulesEditorResult {
  const normalizedRules: InteractionRules = rules ?? {};

  const clickRules: ClickRule[] = normalizedRules.onClick ?? [];
  const useItemRulesAll: UseItemRule[] = normalizedRules.onUseItem ?? [];

  const [activeChannel, setActiveChannel] = useState<EntityRuleChannel>({ type: "onClick" });
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState<EntityRuleEditingInfo>(null);

  const selectedUseItemId = activeChannel.type === "onUseItem" ? activeChannel.placedItemId : "";

  const useItemRulesForSelected = useMemo(() => {
    if (activeChannel.type !== "onUseItem") return [];
    return useItemRulesAll.filter((r) => r.placedItemId === activeChannel.placedItemId);
  }, [activeChannel, useItemRulesAll]);

  const currentRuleValue = useMemo((): BaseInteractionRule | null => {
    if (!ruleModalOpen || !editingInfo) return null;

    if (editingInfo.channel === "onClick") {
      if (editingInfo.index < 0) return { id: createId(), when: undefined, effects: [] };

      const hit = clickRules[editingInfo.index];
      if (!hit) return { id: createId(), when: undefined, effects: [] };

      return {
        id: ensureId(hit.id),
        when: hit.when ?? undefined,
        phrase: hit.phrase ?? undefined,
        effects: hit.effects,
      };
    }

    const filtered = useItemRulesAll.filter((r) => r.placedItemId === editingInfo.placedItemId);

    if (editingInfo.index < 0) return { id: createId(), when: undefined, effects: [] };

    const hit = filtered[editingInfo.index];
    if (!hit) return { id: createId(), when: undefined, effects: [] };

    return {
      id: ensureId(hit.id),
      when: hit.when ?? undefined,
      phrase: hit.phrase ?? undefined,
      effects: hit.effects,
    };
  }, [ruleModalOpen, editingInfo, clickRules, useItemRulesAll, createId]);

  const openAddClickRule = () => {
    setEditingInfo({ channel: "onClick", index: -1 });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  };

  const openEditClickRule = (index: number) => {
    setEditingInfo({ channel: "onClick", index });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onClick" });
  };

  const openAddUseItemRule = (placedItemId: ID) => {
    setEditingInfo({ channel: "onUseItem", placedItemId, index: -1 });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onUseItem", placedItemId });
  };

  const openEditUseItemRule = (placedItemId: ID, indexInFiltered: number) => {
    setEditingInfo({ channel: "onUseItem", placedItemId, index: indexInFiltered });
    setRuleModalOpen(true);
    setActiveChannel({ type: "onUseItem", placedItemId });
  };

  const removeClickRule = (index: number) => {
    const next = [...clickRules];
    next.splice(index, 1);
    onChangeRules({ ...normalizedRules, onClick: next });
  };

  const removeUseItemRule = (placedItemId: ID, indexInFiltered: number) => {
    const filtered = useItemRulesAll.filter((r) => r.placedItemId === placedItemId);
    const hit = filtered[indexInFiltered];
    if (!hit) return;

    const nextAll = useItemRulesAll.filter((r) => r !== hit);
    onChangeRules({ ...normalizedRules, onUseItem: nextAll });
  };

  const closeRuleModal = () => {
    setRuleModalOpen(false);
    setEditingInfo(null);
  };

  const saveRule = (rule: { id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => {
    if (!editingInfo) return;

    if (editingInfo.channel === "onClick") {
      const next = [...clickRules];

      const packed: ClickRule = {
        id: rule.id,
        ...(rule.when ? { when: rule.when } : {}),
        phrase: rule.phrase,
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

    const filtered = useItemRulesAll.filter((r) => r.placedItemId === placedItemId);
    const hit = filtered[editingInfo.index];

    const nextAll =
      editingInfo.index >= 0 && hit
        ? useItemRulesAll.map((r) => (r === hit ? packed : r))
        : [...useItemRulesAll, packed];

    onChangeRules({ ...normalizedRules, onUseItem: nextAll });
    closeRuleModal();
  };

    return {
        activeChannel, setActiveChannel, clickRules, useItemRulesAll, useItemRulesForSelected, selectedUseItemId, ruleModalOpen, editingInfo, currentRuleValue,
        openAddClickRule, openEditClickRule, openAddUseItemRule, openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule
    };
}