import type { ID, InventoryItemInstance, Project } from "@/domain/types";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { InteractionRulesSection } from "@/features/editor/scene/interactiveComponents/InteractionRulesSection";

type Props = {
  project: Project;
  npcId: ID;
  item: InventoryItemInstance;
  canEdit: boolean;
  onChange: (patch: Partial<InventoryItemInstance>) => void;
};

function isPersistedNpc(project: Project, npcId: ID): boolean {
  return project.npcs.some((npc) => npc.id === npcId);
}

export function NpcInventoryItemRulesEditor({ project, npcId, item, canEdit, onChange }: Props) {
  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule, openEditClickRule, openAddUseItemRule,
    openEditUseItemRule, removeClickRule, removeUseItemRule, closeRuleModal, saveRule } = useEntityRulesEditor({ rules: item.rules, onChangeRules: (rules) => onChange({ rules }) });

      const canEditRules = canEdit && isPersistedNpc(project, npcId);

  const owner: EffectOwner = {
    kind: "npcInventoryItem",
    npcId,
    itemInstance: item,
  };

  const useItemOptions = Array.from(
    new Map(
      [
        ...project.nodes.flatMap((node) =>
          node.layers.flatMap((layer) =>
            (layer.placedItems ?? []).map((placedItem) => ({
              id: placedItem.id,
              label: placedItem.label || placedItem.id,
            })),
          ),
        ),

        ...project.players.flatMap((player) =>
          (player.initialInventory ?? []).map((inventoryItem) => ({
            id: inventoryItem.itemInstanceId,
            label: inventoryItem.label || inventoryItem.itemInstanceId,
          })),
        ),

        ...project.npcs.flatMap((npc) =>
          (npc.initialInventory ?? []).map((inventoryItem) => ({
            id: inventoryItem.itemInstanceId,
            label: inventoryItem.label || inventoryItem.itemInstanceId,
          })),
        ),
      ]
        .filter((option) => option.id !== item.itemInstanceId)
        .map((option) => [option.id, option]),
    ).values(),
  );

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">

      {!isPersistedNpc(project, npcId) && (
        <p className="mb-2 text-center text-[11px] text-slate-400">
          Guarda primero el PNJ para poder añadir reglas a este item.
        </p>
      )}

      <InteractionRulesSection
        owner={owner}
        project={project}
        nodeId=""
        disableAllEditorFields={!canEditRules}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        clickRules={clickRules}
        useItemRulesForSelected={useItemRulesForSelected}
        useItemOptions={useItemOptions}
        ruleModalOpen={ruleModalOpen}
        currentRuleValue={currentRuleValue}
        onOpenAddClickRule={openAddClickRule}
        onOpenEditClickRule={openEditClickRule}
        onRemoveClickRule={removeClickRule}
        onOpenAddUseItemRule={openAddUseItemRule}
        onOpenEditUseItemRule={openEditUseItemRule}
        onRemoveUseItemRule={removeUseItemRule}
        onCloseRuleModal={closeRuleModal}
        onSaveRule={saveRule}
      />
    </div>
  );
}