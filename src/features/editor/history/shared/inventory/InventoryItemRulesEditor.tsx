import { useMemo } from "react";
import type { ID, ItemInstance, Project } from "@/domain/types";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { useEntityRulesEditor } from "@/features/editor/scene/rules/entityRulesEditor";
import { InteractionRulesSection } from "@/features/editor/scene/interactiveComponents/InteractionRulesSection";

type InventoryItemRulesOwner = { kind: "npcInventoryItem"; npcId: ID } | { kind: "playerInventoryItem"; playerId: ID };

type Props = {
  project: Project;
  owner: InventoryItemRulesOwner;
  item: ItemInstance;
  onChange: (patch: Partial<ItemInstance>) => void;
};

function isPersistedOwner(project: Project, owner: InventoryItemRulesOwner): boolean {
  if (owner.kind === "npcInventoryItem") {
    return project.npcs.some((npc) => npc.id === owner.npcId);
  }

  return project.players.some((player) => player.id === owner.playerId);
}

function getOwnerLabel(owner: InventoryItemRulesOwner): string {
  return owner.kind === "npcInventoryItem" ? "PNJ" : "Jugador";
}

function buildEffectOwner(owner: InventoryItemRulesOwner, item: ItemInstance): EffectOwner {
  if (owner.kind === "npcInventoryItem") {
    return {
      kind: "npcInventoryItem",
      npcId: owner.npcId,
      itemInstance: item,
    };
  }

  return {
    kind: "playerInventoryItem",
    playerId: owner.playerId,
    itemInstance: item,
  };
}

export function InventoryItemRulesEditor({ project, owner, item, onChange }: Props) {
  const persisted = isPersistedOwner(project, owner);

  const { activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, openAddClickRule, openEditClickRule, openAddUseItemRule,
    openEditUseItemRule, removeClickRule, moveClickRule, removeUseItemRule, moveUseItemRule, closeRuleModal, saveRule }
    = useEntityRulesEditor({ rules: item.rules, onChangeRules: (rules) => onChange({ rules })});

  const canEditRules = persisted;

  const effectOwner = buildEffectOwner(owner, item);

  const useItemOptions = useMemo(() => {
    const options = new Map<ID, { id: ID; label: string }>();

    for (const node of project.nodes) {
      for (const layer of node.layers) {
        for (const placedItem of layer.placedItems ?? []) {
          const id = placedItem.itemInstanceId;

          options.set(id, {
            id,
            label: placedItem.label || id,
          });
        }
      }
    }

    for (const player of project.players) {
      for (const inv of player.initialInventory ?? []) {
        const id = inv.itemInstanceId;

        options.set(id, {
          id,
          label: inv.label || id,
        });
      }
    }

    for (const npc of project.npcs) {
      for (const inv of npc.initialInventory ?? []) {
        const id = inv.itemInstanceId;

        options.set(id, {
          id,
          label: inv.label || id,
        });
      }
    }

    options.delete(item.itemInstanceId);

    return Array.from(options.values());
  }, [project.nodes, project.players, project.npcs, item.itemInstanceId]);

  return (
    <div className="mt-3 border-t border-slate-700 pt-3">
      {!persisted && (
        <p className="mb-2 text-center text-[11px] text-slate-400">
          Guarda primero el {getOwnerLabel(owner)} para poder añadir reglas a este objeto.
        </p>
      )}

      <InteractionRulesSection
        owner={effectOwner}
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
        onMoveClickRule={moveClickRule}
        onOpenAddUseItemRule={openAddUseItemRule}
        onOpenEditUseItemRule={openEditUseItemRule}
        onRemoveUseItemRule={removeUseItemRule}
        onMoveUseItemRule={moveUseItemRule}
        onCloseRuleModal={closeRuleModal}
        onSaveRule={saveRule}
      />
    </div>
  );
}