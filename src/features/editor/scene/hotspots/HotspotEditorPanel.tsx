import type { RefObject } from "react";
import type { ID, ClickRule, UseItemRule, BaseInteractionRule, Project } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import type { HotspotRuleChannel, HotspotDraft } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { VarRowCard } from "@/shared/vars/varRowCard";
import type { VarRow, VarRowErrors } from "@/shared/vars/varRow";
import type { EffectOwner } from "@/features/editor/scene/rules/effects/effectFactory";
import { RegionStatusNotice } from "@/features/editor/scene/interactiveComponents/RegionStatusNotice";
import { PlaceableStateSection } from "@/features/editor/scene/interactiveComponents/PlaceableStateSection";
import { InteractionRulesSection } from "@/features/editor/scene/interactiveComponents/InteractionRulesSection";
import { Pencil } from "lucide-react";


type HotspotEditorPanelProps = {
  draft: HotspotDraft;
  isDrawing: boolean;
  hasShape: boolean;
  isExistingHotspot: boolean;
  dupLabelInLayer: boolean;
  hasCollisions: boolean;
  collisionSummary: string;
  collisionLock: { active: boolean; summary: string };
  disableAllEditorFields: boolean;
  disableReachable: boolean;
  disableNotReachableText: boolean;
  initialVisible: boolean;
  initialReachable: boolean;
  initialNotReachableText: string;
  labelInputRef: RefObject<HTMLInputElement | null>;
  notReachableInputRef: RefObject<HTMLInputElement | null>;

  onLabelChange: (value: string) => void;
  onStartRedrawShape: () => void;
  onVisibleChange: (checked: boolean) => void;
  onReachableChange: (checked: boolean) => void;
  onNotReachableTextChange: (value: string) => void;

  hasAnyRules: boolean;
  panelError: string | null;
  varPanelError: string | null;
  showRulesRequiredError: boolean;
  draftVarsUI: VarRow[];
  openVarId: string | null;
  varErrorsById: Record<string, VarRowErrors | undefined>;
  onAddVar: () => void;
  onToggleVarOpen: (id: string) => void;
  onChangeVar: (id: string, patch: Partial<VarRow>, opts?: { dirty?: boolean }) => void;
  onSwitchVarType: (id: string, nextType: "number" | "boolean") => void;
  onSaveVar: (row: VarRow) => void;
  onDeleteVar: (id: string) => void;
  onBindVarNameInputRef: (id: string, el: HTMLInputElement | null) => void;

  owner: EffectOwner | null;
  useItemSourceOptions: Array<{ id: ID; label: string }>;
  activeChannel: HotspotRuleChannel;
  setActiveChannel: (channel: HotspotRuleChannel) => void;

  clickRules: ClickRule[];
  useItemRulesForSelected: UseItemRule[];

  ruleModalOpen: boolean;
  currentRuleValue: BaseInteractionRule | null;
  nodeId: ID;
  project: Project | null;

  onOpenAddClickRule: () => void;
  onOpenEditClickRule: (index: number) => void;
  onRemoveClickRule: (index: number) => void;
  onOpenAddUseItemRule: (itemId: ID) => void;
  onOpenEditUseItemRule: (itemId: ID, index: number) => void;
  onRemoveUseItemRule: (itemId: ID, index: number) => void;

  onCloseRuleModal: () => void;
  onSaveRule: (rule: { id: ID; when?: Condition; phrase?: string; effects: Effect[] }) => void;

  onDelete: () => void;
  onCancel: () => void;
  onCommit: () => void;
};

export function HotspotEditorPanel({ draft, isDrawing, hasShape, isExistingHotspot, dupLabelInLayer, hasCollisions, collisionSummary, collisionLock, disableAllEditorFields,
  disableReachable, disableNotReachableText, initialVisible, initialReachable, initialNotReachableText, labelInputRef, notReachableInputRef, onLabelChange, onStartRedrawShape,
  onVisibleChange, onReachableChange, onNotReachableTextChange, hasAnyRules, panelError, varPanelError, showRulesRequiredError, draftVarsUI, openVarId,
  varErrorsById, onAddVar, onToggleVarOpen, onChangeVar, onSwitchVarType, onSaveVar, onDeleteVar, onBindVarNameInputRef, owner, useItemSourceOptions, activeChannel,
  setActiveChannel, clickRules, useItemRulesForSelected, ruleModalOpen, currentRuleValue, nodeId, project, onOpenAddClickRule, onOpenEditClickRule,
  onRemoveClickRule, onOpenAddUseItemRule, onOpenEditUseItemRule, onRemoveUseItemRule, onCloseRuleModal, onSaveRule, onDelete, onCancel, onCommit }: HotspotEditorPanelProps) {

  const rulesRequiredErrorText = showRulesRequiredError ? "Debes añadir al menos una regla para guardar el hotspot." : null;

  const saveButtonTitle = isDrawing ? "Termina o cancela el dibujo actual antes de guardar" : !hasShape
    ? "Dibuja una región válida antes de guardar" : !(draft.label ?? "").trim()
      ? "La etiqueta es obligatoria" : dupLabelInLayer
        ? "Etiqueta duplicada" : hasCollisions
          ? "Colisión con otro clicable" : !hasAnyRules
            ? "Intenta guardar para ver el aviso y añade al menos una regla" : undefined;

  return (
    <div className="bg-slate-950/40 p-1 space-y-2">
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
          missingShapeText="Falta una región válida. Pulsa “+ Añadir hotspot” y dibuja un rectángulo dentro de la imagen."
        />
      )}

      <div className="space-y-1">
        <div className="text-[13px] text-slate-100 mb-1.5">Nombre</div>

        <div className="flex items-center gap-2">
          <input
            ref={labelInputRef}
            value={draft.label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="flex flex-1 min-w-0 rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
              focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
            placeholder="Ej: Puerta al pasillo"
            disabled={disableAllEditorFields}
          />

          <button
            type="button"
            className="btn border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-white"
            onClick={onStartRedrawShape}
            title={isDrawing ? "Termina o cancela el dibujo actual antes de editar la región" : "Editar región del hotspot"}
            disabled={isDrawing}
          >
            <Pencil className="w-4 h-4" />
          </button>
        </div>

        {dupLabelInLayer ? (
          <div className="mt-2 rounded-md border border-rose-500/40 bg-rose-950/20 px-2 py-1 text-[11px] text-rose-100">
            Ya existe un hotspot con esa etiqueta en esta capa. Usa un nombre distinto.
          </div>
        ) : null}
      </div>

      <div className="h-[3px] bg-slate-800 my-2" />

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

      <div className="h-[3px] bg-slate-800 my-2" />

      <div className="bg-slate-950/30 px-2 py-2">
        <div className="text-[13px] text-slate-100 text-center">Variables</div>

        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className="btn btn-add-variant text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={disableAllEditorFields || openVarId !== null}
            onClick={onAddVar}
            title={openVarId ? "Termina la edición de la variable abierta (guarda o descarta cambios)." : "Añadir variable"}
          >
            + Añadir variable
          </button>
        </div>

        <div className="space-y-2 mt-3">
          {draftVarsUI.map((row, idxRow) => {
            const isOpen = row.id === openVarId;

            return (
              <div key={row.id}>
                <VarRowCard
                  row={row}
                  index={idxRow}
                  isOpen={isOpen}
                  disabled={disableAllEditorFields}
                  nameInputRef={(el) => onBindVarNameInputRef(row.id, el)}
                  onToggleOpen={() => onToggleVarOpen(row.id)}
                  onChange={(patch, opts) => onChangeVar(row.id, patch, opts)}
                  onSwitchType={(nextType) => onSwitchVarType(row.id, nextType)}
                  onSave={() => onSaveVar(row)}
                  onDelete={() => onDeleteVar(row.id)}
                  saveTitle="Guardar"
                  deleteTitle="Eliminar variable"
                  saveVariant="hotspot"
                  errors={varErrorsById[row.id]}
                  tone="hotspot"
                />
              </div>
            );
          })}
        </div>

        {varPanelError ? (
          <div className="mt-3 rounded-md border border-red-500/40 bg-red-950/20 px-2 py-1 text-[11px] text-red-100">
            {varPanelError}
          </div>
        ) : null}
      </div>

      <div className="h-[3px] bg-slate-800 my-2" />

      <InteractionRulesSection
        owner={owner}
        project={project}
        nodeId={nodeId}
        disableAllEditorFields={disableAllEditorFields}
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
        onOpenAddUseItemRule={onOpenAddUseItemRule}
        onOpenEditUseItemRule={onOpenEditUseItemRule}
        onRemoveUseItemRule={onRemoveUseItemRule}
        onCloseRuleModal={onCloseRuleModal}
        onSaveRule={onSaveRule}
        requiredErrorText={rulesRequiredErrorText}
      />

      <div className="flex items-center justify-between gap-2 mt-4">
        <div className="flex items-center gap-2">
          {isExistingHotspot ? (
            <button
              type="button"
              className="btn btn-danger text-[11px] disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onDelete}
              title="Eliminar hotspot"
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
            className="btn btn-guardar text-[11px]"
            onClick={onCommit}
            title={saveButtonTitle}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}