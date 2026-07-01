import { useEffect, useRef, useState, type DragEvent } from "react";
import type { BaseInteractionRule, ClickRule, ID, Project, RulePhrase, UseItemRule } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { RuleChannel } from "@/features/editor/scene/interactiveComponents/interactiveEditorTypes";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";
import { Select, type Option } from "@/components/Select";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

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
  onMoveClickRule?: (fromIndex: number, toIndex: number) => void;

  onOpenAddUseItemRule: (itemInstanceId: ID) => void;
  onOpenEditUseItemRule: (itemInstanceId: ID, index: number) => void;
  onRemoveUseItemRule: (itemInstanceId: ID, index: number) => void;
  onMoveUseItemRule?: (itemInstanceId: ID, fromIndex: number, toIndex: number) => void;

  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; label: string; when?: Condition; phrase?: RulePhrase; effects: Effect[] }) => void;

  requiredErrorText?: string | null;
};

type RuleDragIndexRef = {
  current: number | null;
};

type SetOverRuleId = (value: ID | null | ((current: ID | null) => ID | null)) => void;

type RuleListCardProps = {
  index: number;
  ruleId: ID;
  ruleLabel: string;
  disabledEdit: boolean;
  disabledDelete: boolean;
  disabledDrag: boolean;
  isDragging: boolean;
  isOver: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: () => void;
  onDrop: () => void;
};

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

function getRuleCardClassName(args: { canEdit: boolean; canDrag: boolean; isDragging: boolean; isOver: boolean }): string {
  const { canEdit, canDrag, isDragging, isOver } = args;

  return cx(
    "select-none rounded-md border-2 border-fuchsia-950 bg-slate-950/30 px-3 py-2",
    canEdit ? "cursor-pointer hover:bg-fuchsia-900/20 hover:border-fuchsia-800" : "cursor-not-allowed opacity-50",
    canDrag && "variant-draggable",
    isDragging && "variant-dragging",
    isOver && "variant-drop-target",
  );
}

function getRuleDisplayLabel(rule: { label?: string }, index: number): string {
  return rule.label?.trim() || `Regla ${index + 1}`;
}

function handleRuleDragStart(args: { event: DragEvent<HTMLDivElement>; ruleId: ID; index: number; disabledDrag: boolean; dragFromIndexRef: RuleDragIndexRef;
  setDraggingId: (id: ID | null) => void}): void {
  const { event, ruleId, index, disabledDrag, dragFromIndexRef, setDraggingId } = args;

  if (disabledDrag) {
    event.preventDefault();
    return;
  }

  dragFromIndexRef.current = index;
  setDraggingId(ruleId);

  event.dataTransfer.effectAllowed = "move";
}

function handleRuleDragOver(args: { event: DragEvent<HTMLDivElement>; ruleId: ID; disabledDrag: boolean; setOverId: (id: ID | null) => void}): void {
  const { event, ruleId, disabledDrag, setOverId } = args;

  if (disabledDrag) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  setOverId(ruleId);
}

function handleRuleDragLeave(args: { ruleId: ID; setOverId: SetOverRuleId }): void {
  const { ruleId, setOverId } = args;

  setOverId((current) => (current === ruleId ? null : current));
}

function handleRuleDrop(args: { index: number; disabledDrag: boolean; dragFromIndexRef: RuleDragIndexRef; resetDragState: () => void;
  onReorder?: (fromIndex: number, toIndex: number) => void}): void {
  const { index, disabledDrag, dragFromIndexRef, resetDragState, onReorder } = args;

  if (disabledDrag || !onReorder) return;

  const fromIndex = dragFromIndexRef.current;
  resetDragState();

  if (fromIndex == null || fromIndex === index) return;

  onReorder(fromIndex, index);
}

/* Card reutilizable para cada regla guardada */
function RuleListCard({ ruleId, ruleLabel, disabledEdit, disabledDelete, disabledDrag, isDragging, isOver, onEdit, onDelete,
  onDragStart, onDragEnd, onDragOver, onDragLeave, onDrop }: RuleListCardProps) {
  const canEdit = !disabledEdit;
  const canDrag = !disabledDrag;

  const handleEdit = () => {
    if (!canEdit) return;
    onEdit();
  };

  return (
    <div
      role="button"
      tabIndex={canEdit ? 0 : -1}
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={handleEdit}
      onKeyDown={(event) => {
        if (!canEdit) return;

        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onEdit();
        }
      }}
      className={getRuleCardClassName({ canEdit, canDrag, isDragging, isOver })}
      title={canDrag ? "Arrastra para reordenar · Click para editar" : canEdit ? "Editar regla" : undefined}
      data-rule-id={ruleId}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cx("shrink-0 text-slate-300", canDrag ? "cursor-grab" : "opacity-40")}
            aria-hidden="true"
            title={canDrag ? "Arrastra para reordenar" : "Orden fijo"}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm text-slate-100">
              <span>{ruleLabel}</span>
            </div>
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
            aria-label={`Editar ${ruleLabel}`}
          >
            <Pencil className="h-4 w-4" />
          </button>

          <button
            type="button"
            className="btn border-2 border-rose-700/60 bg-rose-950/30 p-1 text-white hover:bg-rose-950/50"
            disabled={disabledDelete}
            onClick={onDelete}
            title="Eliminar"
            aria-label={`Eliminar ${ruleLabel}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

type DraggableRuleListProps = {
  rules: Array<{ id: ID; label?: string }>;
  disabledEdit: boolean;
  disabledDelete: boolean;
  disabledDrag: boolean;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
};

function DraggableRuleList({ rules, disabledEdit, disabledDelete, disabledDrag, onEdit, onDelete, onReorder }: DraggableRuleListProps) {
  const dragFromIndexRef = useRef<number | null>(null);

  const [draggingId, setDraggingId] = useState<ID | null>(null);
  const [overId, setOverId] = useState<ID | null>(null);

  const dragDisabled = disabledDrag || rules.length < 2 || !onReorder;

  const resetDragState = () => {
    dragFromIndexRef.current = null;
    setDraggingId(null);
    setOverId(null);
  };

  return (
    <div className="space-y-2">
      {rules.map((rule, index) => {
        const isDragging = draggingId === rule.id;
        const isOver = overId === rule.id && !isDragging;
        const ruleLabel = getRuleDisplayLabel(rule, index);

        return (
          <RuleListCard
            key={rule.id}
            ruleId={rule.id}
            ruleLabel={ruleLabel}
            index={index}
            disabledEdit={disabledEdit}
            disabledDelete={disabledDelete}
            disabledDrag={dragDisabled}
            isDragging={isDragging}
            isOver={isOver}
            onEdit={() => onEdit(index)}
            onDelete={() => onDelete(index)}
            onDragStart={(event) => handleRuleDragStart({ event, ruleId: rule.id, index, disabledDrag: dragDisabled, dragFromIndexRef, setDraggingId })}
            onDragEnd={resetDragState}
            onDragOver={(event) => handleRuleDragOver({ event, ruleId: rule.id, disabledDrag: dragDisabled, setOverId })}
            onDragLeave={() => handleRuleDragLeave({ ruleId: rule.id, setOverId })}
            onDrop={() => handleRuleDrop({ index, disabledDrag: dragDisabled, dragFromIndexRef, resetDragState, onReorder })}
          />
        );
      })}
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
  const getTabClassName = (selected: boolean) => `btn justify-center border-2 text-xs ${selected ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-100" : "border-slate-700 bg-slate-900 text-white hover:bg-fuchsia-950 hover:border-fuchsia-700"
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
  useItemOptions, ruleModalOpen, currentRuleValue, onOpenAddClickRule, onOpenEditClickRule, onRemoveClickRule, onMoveClickRule, onOpenAddUseItemRule,
  onOpenEditUseItemRule, onRemoveUseItemRule, onMoveUseItemRule, onCloseRuleModal, onSaveRule, requiredErrorText }: InteractionRulesSectionProps) {
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

            <DraggableRuleList
              rules={clickRules}
              disabledEdit={disableAllEditorFields || !owner}
              disabledDelete={disableAllEditorFields}
              disabledDrag={disableAllEditorFields || !owner}
              onEdit={onOpenEditClickRule}
              onDelete={onRemoveClickRule}
              onReorder={onMoveClickRule}
            />
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

            {selectedUseItemId ? (
              <DraggableRuleList
                rules={useItemRulesForSelected}
                disabledEdit={disableAllEditorFields || !owner}
                disabledDelete={disableAllEditorFields}
                disabledDrag={disableAllEditorFields || !owner || !selectedUseItemId}
                onEdit={(index) => onOpenEditUseItemRule(selectedUseItemId, index)}
                onDelete={(index) => onRemoveUseItemRule(selectedUseItemId, index)}
                onReorder={(fromIndex, toIndex) => onMoveUseItemRule?.(selectedUseItemId, fromIndex, toIndex)}
              />
            ) : null}
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