import type { RefObject } from "react";
import type { ID, ClickRule, UseItemRule, NpcDef, BaseInteractionRule, Project, RulePhrase } from "@/domain/types";
import type { PlacedNpcDraft, PlacedNpcRuleChannel } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { RegionStatusNotice } from "@/features/editor/scene/interactiveComponents/RegionStatusNotice";
import { PlaceableStateSection } from "@/features/editor/scene/interactiveComponents/PlaceableStateSection";
import { InteractionRulesSection } from "@/features/editor/scene/interactiveComponents/InteractionRulesSection";
import { Select, type Option } from "@/components/Select";
import { Pencil } from "lucide-react";

type PlacedNpcEditorPanelProps = {
  draft: PlacedNpcDraft | null;
  selectedCatalogNpcId: ID;
  projectNpcs: NpcDef[];
  onSelectedCatalogNpcIdChange: (npcId: ID) => void;

  isDrawing: boolean;
  hasShape: boolean;
  isExistingPlacedNpc: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  disableAllEditorFields: boolean;
  disableReachable: boolean;
  disableNotReachableText: boolean;

  initialVisible: boolean;
  initialReachable: boolean;
  initialNotReachableText: string;

  notReachableInputRef: RefObject<HTMLInputElement | null>;

  onNpcChange: (npcId: ID) => void;
  onStartRedrawShape: () => void;
  onVisibleChange: (checked: boolean) => void;
  onReachableChange: (checked: boolean) => void;
  onNotReachableTextChange: (value: string) => void;

  owner: EffectOwner | null;
  activeChannel: PlacedNpcRuleChannel;
  setActiveChannel: (channel: PlacedNpcRuleChannel) => void;

  clickRules: ClickRule[];
  useItemRulesForSelected: UseItemRule[];

  ruleModalOpen: boolean;
  currentRuleValue: BaseInteractionRule | null;
  nodeId: ID;
  project: Project | null;

  onOpenAddClickRule: () => void;
  onOpenEditClickRule: (index: number) => void;
  onRemoveClickRule: (index: number) => void;
  onMoveClickRule: (fromIndex: number, toIndex: number) => void;
  onOpenAddUseItemRule: (placedItemId: ID) => void;
  onOpenEditUseItemRule: (placedItemId: ID, index: number) => void;
  onRemoveUseItemRule: (placedItemId: ID, index: number) => void;
  onMoveUseItemRule: (placedItemId: ID, fromIndex: number, toIndex: number) => void;
  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; label: string; when?: Condition; phrase?: RulePhrase; effects: Effect[] }) => void;

  panelError: string | null;
  showRulesRequiredError: boolean;

  useItemSourceOptions: Array<{ id: ID; label: string }>;

  onDelete: () => void;
  onCancel: () => void;
  onCommit: () => void;
};

export function PlacedNpcEditorPanel({ draft, selectedCatalogNpcId, projectNpcs, onSelectedCatalogNpcIdChange, isDrawing, hasShape, isExistingPlacedNpc,
  hasCollisions, collisionSummary, collisionLock, disableAllEditorFields, disableReachable, disableNotReachableText, initialVisible,
  initialReachable, initialNotReachableText, notReachableInputRef, onNpcChange, onStartRedrawShape, onVisibleChange, onReachableChange,
  onNotReachableTextChange, owner, activeChannel, setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue,
  nodeId, project, onOpenAddClickRule, onOpenEditClickRule, onRemoveClickRule, onMoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule,
  onRemoveUseItemRule, onMoveUseItemRule, onCloseRuleModal, onSaveRule, panelError, useItemSourceOptions, onDelete, onCancel, onCommit }: PlacedNpcEditorPanelProps) {
  const npcOptions: Option<ID>[] = projectNpcs.map((npc) => ({ id: npc.id, label: npc.name || npc.id }));

  const useItemOptions: Option<ID>[] = useItemSourceOptions;

  const saveButtonTitle = isDrawing ? "Termina o cancela el dibujo actual antes de guardar" : !hasShape
        ? "Dibuja una región válida antes de guardar" : !draft?.npcId
          ? "Debes seleccionar un PNJ" : hasCollisions
            ? "Colisión con otro clicable" : undefined;

  const selectButtonClassName = "w-full rounded-md border-2 border-slate-700 bg-slate-900/30 px-2 py-1.5 text-xs text-slate-100"
    + "focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50";

  if (!draft) {
    return (
      <div className="bg-slate-950/40 p-1 space-y-3">
        <div className="bg-slate-950/20 px-3 py-3 space-y-3">
          <div className="text-xs text-slate-200 text-center">
            Selecciona un PNJ del catálogo para dibujarlo directamente en la escena
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">PNJ</div>

            <Select<ID>
              value={selectedCatalogNpcId}
              onChange={onSelectedCatalogNpcIdChange}
              options={npcOptions}
              placeholder="Seleccionar PNJ"
              disabled={!projectNpcs.length}
              buttonClassName={selectButtonClassName}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950/40 p-1 space-y-2">
      {/* Error propio del panel o estado de la región */}
      {panelError ? (
        <div className="rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
          {panelError}
        </div>
      ) : (
        <RegionStatusNotice
          isDrawing={isDrawing}
          hasShape={hasShape}
          hasCollisions={hasCollisions}
          collisionSummary={collisionSummary}
          collisionLock={collisionLock}
          drawingText="Dibuja una región en la imagen (arrastra con el ratón). Pulsa “Cancelar” para salir."
          missingShapeText="Falta una región válida. Dibuja un rectángulo dentro de la imagen para definir el PNJ."
        />
      )}

      {/* Selector del NPC y botón para redibujar la región */}
      <div className="space-y-1">
        <div className="mb-1.5 text-xs text-slate-100">PNJ</div>

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select<ID>
              value={draft.npcId}
              onChange={(value) => {
                if (!value) return;
                onNpcChange(value);
              }}
              options={npcOptions}
              placeholder="Seleccionar PNJ"
              disabled={!projectNpcs.length || disableAllEditorFields || isExistingPlacedNpc}
              buttonClassName={selectButtonClassName}
            />
          </div>

          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
            onClick={onStartRedrawShape}
            title={isDrawing ? "Termina o cancela el dibujo actual antes de editar la región" : "Editar región del PNJ"}
            disabled={isDrawing}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="my-2 h-[3px] bg-slate-800" />

      {/* Estado inicial del NPC */}
      <PlaceableStateSection
        initialVisible={initialVisible}
        initialReachable={initialReachable}
        initialNotReachableText={initialNotReachableText}
        disableAllEditorFields={disableAllEditorFields}
        disableReachable={disableReachable}
        disableNotReachableText={disableNotReachableText}
        notReachableInputRef={notReachableInputRef}
        onVisibleChange={onVisibleChange}
        onReachableChange={onReachableChange}
        onNotReachableTextChange={onNotReachableTextChange}
      />

      <div className="my-2 h-[3px] bg-slate-800" />

      {/* Reglas de interacción del NPC */}
      <InteractionRulesSection
        owner={owner}
        project={project}
        nodeId={nodeId}
        disableAllEditorFields={disableAllEditorFields}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        clickRules={clickRules}
        useItemRulesForSelected={useItemRulesForSelected}
        useItemOptions={useItemOptions}
        ruleModalOpen={ruleModalOpen}
        currentRuleValue={currentRuleValue}
        onOpenAddClickRule={onOpenAddClickRule}
        onOpenEditClickRule={onOpenEditClickRule}
        onRemoveClickRule={onRemoveClickRule}
        onMoveClickRule={onMoveClickRule}
        onOpenAddUseItemRule={onOpenAddUseItemRule}
        onOpenEditUseItemRule={onOpenEditUseItemRule}
        onRemoveUseItemRule={onRemoveUseItemRule}
        onMoveUseItemRule={onMoveUseItemRule}
        onCloseRuleModal={onCloseRuleModal}
        onSaveRule={onSaveRule}
      />

      {/* Acciones finales */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isExistingPlacedNpc ? (
            <button
              type="button"
              className="btn btn-danger text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onDelete}
              title="Eliminar PNJ"
              disabled={isDrawing}
            >
              Eliminar
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-cancel text-[11px]" onClick={onCancel}>
            Cancelar
          </button>

          <button
            type="button"
            className="btn btn-create text-[11px]  disabled:cursor-not-allowed"
            onClick={onCommit}
            title={saveButtonTitle}
            disabled={isDrawing}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}