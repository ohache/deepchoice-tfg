import type { ID, ClickRule, UseItemRule, BaseInteractionRule, Project } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { RuleBuilderModal } from "@/features/editor/scene/rules/RuleBuilderModal";
import { Pencil, Trash2 } from "lucide-react";

type RuleChannel =
  | { type: "onClick" }
  | { type: "onUseItem"; placedItemId: ID };

type UseItemOption = {
  id: ID;
  label: string;
};


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

export function InteractionRulesSection({ owner, project, nodeId, disableAllEditorFields, activeChannel, setActiveChannel, clickRules, useItemRulesForSelected,
  useItemOptions, ruleModalOpen, currentRuleValue, onOpenAddClickRule, onOpenEditClickRule, onRemoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule,
  onRemoveUseItemRule, onCloseRuleModal, onSaveRule, requiredErrorText }: InteractionRulesSectionProps) {
  const firstUseItemId = useItemOptions[0]?.id ?? ("" as ID);

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
        <div className="text-[13px] text-slate-200">Reglas</div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={disableAllEditorFields}
            onClick={() => setActiveChannel({ type: "onClick" })}
            className={`btn text-xs border-2 justify-center ${activeChannel.type === "onClick"
                ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-100"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            OnClick
          </button>

          <button
            type="button"
            disabled={disableAllEditorFields}
            onClick={() => {
              setActiveChannel({
                type: "onUseItem",
                placedItemId:
                  activeChannel.type === "onUseItem"
                    ? activeChannel.placedItemId
                    : firstUseItemId,
              });
            }}
            className={`btn text-xs border-2 justify-center ${activeChannel.type === "onUseItem"
                ? "border-fuchsia-500/50 bg-fuchsia-950/30 text-fuchsia-100"
                : "border-slate-700 bg-slate-900 text-white hover:bg-slate-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            OnUseItem
          </button>
        </div>

        {activeChannel.type === "onClick" ? (
          <div className=" bg-slate-950/20 px-2 py-2 space-y-2">
            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-variant text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={disableAllEditorFields || !owner}
                onClick={onOpenAddClickRule}
              >
                + Añadir regla
              </button>
            </div>

            <div className="space-y-2">
              {clickRules.map((rule, index) => (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEditClickRule(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenEditClickRule(index);
                    }
                  }}
                  className="rounded-md border px-3 py-2 cursor-pointer select-none border-slate-700 bg-slate-950/30 hover:bg-fuchsia-900/20"
                  title="Editar regla"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 truncate">
                        <span className="font-semibold">Regla {index + 1}</span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white p-1"
                        disabled={disableAllEditorFields || !owner}
                        onClick={() => onOpenEditClickRule(index)}
                        title="Editar"
                        aria-label="Editar regla"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 p-1"
                        disabled={disableAllEditorFields}
                        onClick={() => onRemoveClickRule(index)}
                        title="Eliminar"
                        aria-label="Eliminar regla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {activeChannel.type === "onUseItem" ? (
          <div className=" bg-slate-950/20 px-2 py-2 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className="text-[13px] text-slate-200">Item:</div>
              <select
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white"
                value={activeChannel.placedItemId}
                onChange={(e) =>
                  setActiveChannel({
                    type: "onUseItem",
                    placedItemId: e.currentTarget.value,
                  })
                }
                disabled={disableAllEditorFields || useItemOptions.length === 0}
              >
                {useItemOptions.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                className="btn btn-add-variant text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={
                  disableAllEditorFields ||
                  !owner ||
                  !activeChannel.placedItemId ||
                  useItemOptions.length === 0
                }
                onClick={() => onOpenAddUseItemRule(activeChannel.placedItemId)}
              >
                + Añadir regla
              </button>
            </div>

            <div className="space-y-2">
              {useItemRulesForSelected.map((rule, index) => (
                <div
                  key={rule.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onOpenEditUseItemRule(activeChannel.placedItemId, index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenEditUseItemRule(activeChannel.placedItemId, index);
                    }
                  }}
                  className="rounded-md border px-3 py-2 cursor-pointer select-none border-slate-700 bg-slate-950/30 hover:bg-fuchsia-900/20"
                  title="Editar regla"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm text-slate-100 truncate">
                        <span className="font-semibold">Regla {index + 1}</span>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-2 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn border-2 border-slate-700 bg-slate-800 hover:bg-slate-700 text-white p-1"
                        disabled={disableAllEditorFields || !owner}
                        onClick={() => onOpenEditUseItemRule(activeChannel.placedItemId, index)}
                        title="Editar"
                        aria-label="Editar regla"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        className="btn border-2 border-rose-700/60 bg-rose-950/30 hover:bg-rose-950/50 text-rose-100 p-1"
                        disabled={disableAllEditorFields}
                        onClick={() => onRemoveUseItemRule(activeChannel.placedItemId, index)}
                        title="Eliminar"
                        aria-label="Eliminar regla"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
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