import { useEffect } from "react";
import type { BaseInteractionRule, ClickRule, ID, Project, RulePhrase, UseItemRule } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { RuleChannel } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";
import { Select, type Option } from "@/components/Select";
import { Pencil, Trash2 } from "lucide-react";

type UseItemOption = Option<ID>;

type InteractionRulesSectionProps = {
  owner: EffectOwner | null;
  project: Project | null;
  nodeId: ID;
  disableAllEditorFields: boolean;

  activeChannel: RuleChannel;
  setActiveChannel: (channel: RuleChannel) => void;

  clickRules: ClickRule[];
  useItemRulesForSelected: UseItemRule[];
  useItemOptions: UseItemOption[];

  ruleModalOpen: boolean;
  currentRuleValue: BaseInteractionRule | null;

  onOpenAddClickRule: () => void;
  onOpenEditClickRule: (index: number) => void;
  onRemoveClickRule: (index: number) => void;

  onOpenAddUseItemRule: (itemInstanceId: ID) => void;
  onOpenEditUseItemRule: (itemInstanceId: ID, index: number) => void;
  onRemoveUseItemRule: (itemInstanceId: ID, index: number) => void;

  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; when?: Condition; phrase?: RulePhrase; effects: Effect[] }) => void;

  requiredErrorText?: string | null;
};

type RuleListCardProps = {
  index: number;
  ruleId: ID;
  disabledEdit: boolean;
  disabledDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

/* Card reutilizable para cada regla guardada */
function RuleListCard({ index, ruleId, disabledEdit, disabledDelete, onEdit, onDelete }: RuleListCardProps) {
  const canEdit = !disabledEdit;

  const handleEdit = () => {
    if (!canEdit) return;
    onEdit();
  };

  return (
    <div
      role="button"
      tabIndex={canEdit ? 0 : -1}
      onClick={handleEdit}
      onKeyDown={(event) => {
        if (!canEdit) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className={`select-none rounded-md border-2 border-fuchsia-800 bg-slate-950/30 px-3 py-2 ${
        canEdit ? "cursor-pointer hover:bg-fuchsia-900/20" : "cursor-not-allowed opacity-50"}`}
      title={canEdit ? "Editar regla" : undefined}
      data-rule-id={ruleId}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-slate-100">
            <span>Regla {index + 1}</span>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-900 p-1 text-white hover:bg-slate-800"
            disabled={disabledEdit}
            onClick={onEdit}
            title="Editar"
            aria-label={`Editar regla ${index + 1}`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 p-1 text-white hover:bg-rose-950/50"
            disabled={disabledDelete}
            onClick={onDelete}
            title="Eliminar"
            aria-label={`Eliminar regla ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type ChannelTabsProps = {
  activeChannel: RuleChannel;
  disableAllEditorFields: boolean;
  disabledOnUseItem: boolean;
  onSelectOnClick: () => void;
  onSelectOnUseItem: () => void;
};

/* Botones para alternar el canal de interacción activo */
function ChannelTabs({ activeChannel, disableAllEditorFields, disabledOnUseItem, onSelectOnClick, onSelectOnUseItem }: ChannelTabsProps) {
  const getTabClassName = (selected: boolean) => `btn justify-center border-2 text-xs ${
      selected ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-100" : "border-slate-700 bg-slate-900 text-white hover:bg-fuchsia-950 hover:border-fuchsia-700"
    } disabled:cursor-not-allowed disabled:opacity-40`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        disabled={disableAllEditorFields}
        onClick={onSelectOnClick}
        className={getTabClassName(activeChannel.type === "onClick")}
      >
        OnClick
      </button>

      <button
        type="button"
        disabled={disableAllEditorFields || disabledOnUseItem}
        onClick={onSelectOnUseItem}
        className={getTabClassName(activeChannel.type === "onUseItem")}
      >
        OnUseItem
      </button>
    </div>
  );
}

export function InteractionRulesSection({ owner, project, nodeId, disableAllEditorFields, activeChannel, setActiveChannel, clickRules, useItemRulesForSelected,
  useItemOptions, ruleModalOpen, currentRuleValue, onOpenAddClickRule, onOpenEditClickRule, onRemoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule,
  onRemoveUseItemRule, onCloseRuleModal, onSaveRule, requiredErrorText }: InteractionRulesSectionProps) {
  const firstUseItemId = useItemOptions[0]?.id ?? "";
  const hasUseItemOptions = useItemOptions.length > 0;

  const activeUseItemIdExists = activeChannel.type === "onUseItem" && useItemOptions.some((option) => option.id === activeChannel.itemInstanceId);

  const selectedUseItemId = activeChannel.type === "onUseItem" && activeUseItemIdExists ? activeChannel.itemInstanceId : firstUseItemId;

  useEffect(() => {
    if (activeChannel.type !== "onUseItem") return;

    if (!hasUseItemOptions) {
      setActiveChannel({ type: "onClick" });
      return;
    }

    if (!activeUseItemIdExists) setActiveChannel({ type: "onUseItem", itemInstanceId: firstUseItemId });
  }, [activeChannel, activeUseItemIdExists, firstUseItemId, hasUseItemOptions, setActiveChannel]);

  const selectOnUseItemChannel = () => {
    if (!selectedUseItemId) return;

    setActiveChannel({ type: "onUseItem", itemInstanceId: selectedUseItemId });
  };

  return (
    <>
      {ruleModalOpen && owner && currentRuleValue ? (
        <RuleBuilderModal
          open={ruleModalOpen}
          project={project}
          nodeId={nodeId}
          owner={owner}
          interactionKind={activeChannel.type}
          value={currentRuleValue}
          onClose={onCloseRuleModal}
          onSave={onSaveRule}
        />
      ) : null}

      <div className="space-y-3">
        <div className="text-[13px] text-white">Reglas</div>

        <ChannelTabs
          activeChannel={activeChannel}
          disableAllEditorFields={disableAllEditorFields}
          disabledOnUseItem={!hasUseItemOptions}
          onSelectOnClick={() => setActiveChannel({ type: "onClick" })}
          onSelectOnUseItem={selectOnUseItemChannel}
        />

        {activeChannel.type === "onClick" ? (
          <div className="space-y-2 bg-slate-950/20 px-2 py-2">
            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-rule mb-1 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disableAllEditorFields || !owner}
                onClick={onOpenAddClickRule}
              >
                + Añadir regla
              </button>
            </div>

            <div className="space-y-2">
              {clickRules.map((rule, index) => (
                <RuleListCard
                  key={rule.id}
                  ruleId={rule.id}
                  index={index}
                  disabledEdit={disableAllEditorFields || !owner}
                  disabledDelete={disableAllEditorFields}
                  onEdit={() => onOpenEditClickRule(index)}
                  onDelete={() => onRemoveClickRule(index)}
                />
              ))}
            </div>
          </div>
        ) : null}

        {activeChannel.type === "onUseItem" ? (
          <div className="space-y-2 bg-slate-950/20 px-2 py-2">
            <div className="flex items-center justify-center gap-2">
              <div className="text-[13px] text-slate-100">Objeto:</div>

              <Select<ID>
                value={selectedUseItemId}
                onChange={(value) => {
                  if (!value) return;
                  setActiveChannel({ type: "onUseItem", itemInstanceId: value });
                }}
                options={useItemOptions}
                placeholder="Selecciona objeto…"
                disabled={disableAllEditorFields || !hasUseItemOptions}
              />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-rule mt-1 mb-1 text-[12px] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={disableAllEditorFields || !owner || !selectedUseItemId || !hasUseItemOptions}
                onClick={() => {
                  if (!selectedUseItemId) return;
                  onOpenAddUseItemRule(selectedUseItemId);
                }}
              >
                + Añadir regla
              </button>
            </div>

            <div className="space-y-2">
              {selectedUseItemId
                ? useItemRulesForSelected.map((rule, index) => (
                    <RuleListCard
                      key={rule.id}
                      ruleId={rule.id}
                      index={index}
                      disabledEdit={disableAllEditorFields || !owner}
                      disabledDelete={disableAllEditorFields}
                      onEdit={() => onOpenEditUseItemRule(selectedUseItemId, index)}
                      onDelete={() => onRemoveUseItemRule(selectedUseItemId, index)}
                    />
                  ))
                : null}
            </div>
          </div>
        ) : null}

        {requiredErrorText ? (
          <div className="rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
            {requiredErrorText}
          </div>
        ) : null}
      </div>
    </>
  );
}