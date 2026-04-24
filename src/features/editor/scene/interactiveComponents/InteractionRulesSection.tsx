import type { BaseInteractionRule, ClickRule, ID, Project, UseItemRule } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";
import { Select, type Option } from "@/components/Select";
import { Pencil, Trash2 } from "lucide-react";

type RuleChannel =
  | { type: "onClick" }
  | { type: "onUseItem"; placedItemId: ID };

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

  onOpenAddUseItemRule: (placedItemId: ID) => void;
  onOpenEditUseItemRule: (placedItemId: ID, index: number) => void;
  onRemoveUseItemRule: (placedItemId: ID, index: number) => void;

  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => void;

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
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className="cursor-pointer select-none rounded-md border-2 border-fuchsia-800 bg-slate-950/30 px-3 py-2 hover:bg-fuchsia-900/20"
      title="Editar regla"
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
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 p-1 text-whote hover:bg-rose-950/50"
            disabled={disabledDelete}
            onClick={onDelete}
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Botones para alternar el canal de interacción activo */
function ChannelTabs({ activeChannel, disableAllEditorFields, onSelectOnClick, onSelectOnUseItem }:
  { activeChannel: RuleChannel;  disableAllEditorFields: boolean; onSelectOnClick: () => void; onSelectOnUseItem: () => void }) {
  const getTabClassName = (selected: boolean) => `btn justify-center border-2 text-xs ${
      selected
        ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-100"
        : "border-slate-700 bg-slate-900 text-white hover:bg-fuchsia-950 hover:border-fuchsia-700"
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
        disabled={disableAllEditorFields}
        onClick={onSelectOnUseItem}
        className={getTabClassName(activeChannel.type === "onUseItem")}
      >
        OnUseItem
      </button>
    </div>
  );
}

export function InteractionRulesSection({ owner, project, nodeId, disableAllEditorFields, activeChannel, setActiveChannel, clickRules,
  useItemRulesForSelected, useItemOptions, ruleModalOpen, currentRuleValue, onOpenAddClickRule, onOpenEditClickRule, onRemoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule, onRemoveUseItemRule, onCloseRuleModal,
  onSaveRule, requiredErrorText }: InteractionRulesSectionProps) {
  const firstUseItemId = useItemOptions[0]?.id ?? "";

  const selectedUseItemId = activeChannel.type === "onUseItem" ? activeChannel.placedItemId : firstUseItemId;

  const canOpenRuleModal = ruleModalOpen && owner && currentRuleValue;

  const hasUseItemOptions = useItemOptions.length > 0;

  return (
    <>
      {canOpenRuleModal ? (
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
          onSelectOnClick={() => setActiveChannel({ type: "onClick" })}
          onSelectOnUseItem={() => { setActiveChannel({ type: "onUseItem", placedItemId: activeChannel.type === "onUseItem" ? activeChannel.placedItemId : firstUseItemId})}}
        />

        {/* Reglas del canal onClick */}
        {activeChannel.type === "onClick" ? (
          <div className="space-y-2 bg-slate-950/20 px-2 py-2">
            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-rule text-[12px] disabled:cursor-not-allowed disabled:opacity-40 mb-1"
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

        {/* Reglas del canal onUseItem */}
        {activeChannel.type === "onUseItem" ? (
          <div className="space-y-2 bg-slate-950/20 px-2 py-2">
            <div className="flex items-center justify-center gap-2">
              <div className="text-[13px] text-slate-100">Item:</div>

              <Select<ID>
                value={selectedUseItemId}
                onChange={(value) => setActiveChannel({ type: "onUseItem", placedItemId: value })}
                options={useItemOptions}
                placeholder="Selecciona…"
                disabled={disableAllEditorFields || !hasUseItemOptions}
              />
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-rule text-[12px] disabled:cursor-not-allowed disabled:opacity-40 mt-1 mb-1"
                disabled={disableAllEditorFields || !owner || !selectedUseItemId || !hasUseItemOptions}
                onClick={() => onOpenAddUseItemRule(selectedUseItemId)}
              >
                + Añadir regla
              </button>
            </div>

            <div className="space-y-2">
              {useItemRulesForSelected.map((rule, index) => (
                <RuleListCard
                  key={rule.id}
                  ruleId={rule.id}
                  index={index}
                  disabledEdit={disableAllEditorFields || !owner}
                  disabledDelete={disableAllEditorFields}
                  onEdit={() => onOpenEditUseItemRule(selectedUseItemId, index)}
                  onDelete={() => onRemoveUseItemRule(selectedUseItemId, index)}
                />
              ))}
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