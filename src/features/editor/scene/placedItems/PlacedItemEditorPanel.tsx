import type { RefObject } from "react";
import type { ID, ClickRule, UseItemRule, ItemDef, BaseInteractionRule, Project, RulePhrase } from "@/domain/types";
import type { PlacedItemDraft, PlacedItemRuleChannel } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectShared";
import { RegionStatusNotice } from "@/features/editor/scene/interactiveComponents/RegionStatusNotice";
import { PlaceableStateSection } from "@/features/editor/scene/interactiveComponents/PlaceableStateSection";
import { InteractionRulesSection } from "@/features/editor/scene/interactiveComponents/InteractionRulesSection";
import { Select, type Option } from "@/components/Select";
import { Pencil } from "lucide-react";

type PlacedItemEditorPanelProps = {
  draft: PlacedItemDraft | null;
  selectedCatalogItemId: ID;
  projectItems: ItemDef[];
  onSelectedCatalogItemIdChange: (itemId: ID) => void;

  isDrawing: boolean;
  hasShape: boolean;
  isExistingPlacedItem: boolean;
  dupLabel: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  disableAllEditorFields: boolean;
  disableReachable: boolean;
  disableNotReachableText: boolean;
  disableRulesEditor: boolean;

  initialVisible: boolean;
  initialReachable: boolean;
  initialNotReachableText: string;

  labelInputRef: RefObject<HTMLInputElement | null>;
  notReachableInputRef: RefObject<HTMLInputElement | null>;

  onItemChange: (itemId: ID) => void;
  onLabelChange: (value: string) => void;
  onStartRedrawShape: () => void;
  onVisibleChange: (checked: boolean) => void;
  onReachableChange: (checked: boolean) => void;
  onNotReachableTextChange: (value: string) => void;

  owner: EffectOwner | null;
  activeChannel: PlacedItemRuleChannel;
  setActiveChannel: (channel: PlacedItemRuleChannel) => void;

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
  onOpenAddUseItemRule: (itemInstanceId: ID) => void;
  onOpenEditUseItemRule: (itemInstanceId: ID, index: number) => void;
  onRemoveUseItemRule: (itemInstanceId: ID, index: number) => void;
  onMoveUseItemRule: (itemInstanceId: ID, fromIndex: number, toIndex: number) => void;

  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; label: string; when?: Condition; phrase?: RulePhrase; effects: Effect[] }) => void;

  panelError: string | null;

  useItemSourceOptions: Option<ID>[];

  onDelete: () => void;
  onCancel: () => void;
  onCommit: () => void;
};

export function PlacedItemEditorPanel({ draft, selectedCatalogItemId, projectItems, onSelectedCatalogItemIdChange, isDrawing, hasShape,
  isExistingPlacedItem, dupLabel, hasCollisions, collisionSummary, collisionLock, disableAllEditorFields, disableReachable, disableRulesEditor,
  disableNotReachableText, initialVisible, initialReachable, initialNotReachableText, onItemChange, labelInputRef, notReachableInputRef,
  onLabelChange, onStartRedrawShape, onVisibleChange, onReachableChange, onNotReachableTextChange, owner, activeChannel, setActiveChannel,
  clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, nodeId, project, onOpenAddClickRule, onOpenEditClickRule,
  onRemoveClickRule, onMoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule, onRemoveUseItemRule, onMoveUseItemRule, onCloseRuleModal,
  onSaveRule, panelError, useItemSourceOptions, onDelete, onCancel, onCommit }: PlacedItemEditorPanelProps) {
  const itemOptions: Option<ID>[] = projectItems.map((item) => ({ id: item.id, label: item.name || item.id }));

  const saveButtonTitle = isDrawing ? "Termina o cancela el dibujo actual antes de guardar" : !hasShape
    ? "Dibuja una región válida antes de guardar" : !draft?.itemId
      ? "Debes seleccionar un objeto" : !draft?.label.trim()
        ? "El nombre es obligatorio" : dupLabel
          ? "Nombre duplicado" : hasCollisions
            ? "Colisión con otro clicable" : undefined;

  const selectButtonClassName = "w-full rounded-md border-2 border-slate-700 bg-slate-900/30 px-2 py-1.5 text-xs text-slate-100"
    + "focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50";

  /* Estado inicial del flujo: todavía no existe draft */
  if (!draft) {
    return (
      <div className="bg-slate-950/40 p-1 space-y-3">
        <div className="bg-slate-950/20 px-3 py-3 space-y-3">
          <div className="text-xs text-slate-200 text-center">
            Selecciona un objeto del catálogo para dibujarlo directamente en la escena
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-100">Objeto</div>

            <Select<ID>
              value={selectedCatalogItemId}
              onChange={onSelectedCatalogItemIdChange}
              options={itemOptions}
              placeholder="Seleccionar objeto"
              disabled={!projectItems.length}
              buttonClassName={selectButtonClassName}
            />
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-slate-950/40 p-1 space-y-2">
      {/* Aviso principal del panel: error propio o estado de la región */}
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
          missingShapeText="Falta una región válida. Dibuja un rectángulo dentro de la imagen para definir el objeto."
        />
      )}

      {/* Selector del item del catálogo */}
      <div className="space-y-1">
        <div className="mb-1.5 text-xs text-slate-100">Objeto</div>

        <Select<ID>
          value={draft.itemId}
          onChange={(value) => {
            if (!value) return;
            onItemChange(value);
          }}
          options={itemOptions}
          placeholder="Seleccionar objeto"
          disabled={!projectItems.length || disableAllEditorFields || isExistingPlacedItem}
          buttonClassName={selectButtonClassName}
        />
      </div>

      {/* Nombre visible de la instancia colocada */}
      <div className="space-y-1">
        <div className="mb-1.5 text-[13px] text-slate-100">Nombre</div>

        <div className="flex items-center gap-2">
          <input
            ref={labelInputRef}
            value={draft.label}
            onChange={(event) => onLabelChange(event.target.value)}
            className="flex min-w-0 flex-1 rounded-md border-2 border-slate-700 bg-slate-900/30 px-2 py-1.5 text-xs text-slate-100
              focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
            placeholder="Ej: Llave del cajón"
            disabled={disableAllEditorFields}
          />

          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-900 text-xs text-white hover:bg-slate-800"
            onClick={onStartRedrawShape}
            title={isDrawing ? "Termina o cancela el dibujo actual antes de editar la región" : "Editar región del objeto"}
            disabled={isDrawing}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {dupLabel ? (
          <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
            Ya existe un objeto con ese nombre en la aventura. Usa un nombre distinto.
          </div>
        ) : null}
      </div>

      <div className="my-2 h-[3px] bg-slate-800" />

      {/* Estado inicial del item */}
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

      {/* Reglas de interacción */}
      <InteractionRulesSection
        owner={owner}
        project={project}
        nodeId={nodeId}
        disableAllEditorFields={disableRulesEditor}
        activeChannel={activeChannel}
        setActiveChannel={setActiveChannel}
        clickRules={clickRules}
        useItemRulesForSelected={useItemRulesForSelected}
        useItemOptions={useItemSourceOptions}
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
          {isExistingPlacedItem ? (
            <button
              type="button"
              className="btn btn-danger text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onDelete}
              title="Eliminar objeto"
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
            className="btn btn-create text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
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