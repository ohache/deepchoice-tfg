import React, { useMemo } from "react";
import type { ID } from "@/domain/types";
import { type EnabledLeafCondition, type EnabledLeafType, type LeafCtx, type LeafVarKind, applyLeafPatch, getLeafOptions, getLeafUi,
  getVarOpOptions, type LeafFieldSpec, getAvailableLeafTypesForFamily, leafFamily } from "@/features/editor/scene/rules/conditions/conditionLeafRegistry";
import { Select, type Option } from "@/components/Select";

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <div className={className}>
    {label ? <div className="text-[12px] text-slate-100 pb-1">{label}</div> : null}
    {children}
  </div>
);

const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Number(e.currentTarget.value))}
    disabled={disabled}
    className="input-conditions disabled:opacity-50"
  />
);

const BoolSelect: React.FC<{ value: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => (
  <select
    value={String(Boolean(value))}
    onChange={(e) => onChange(e.currentTarget.value === "true")}
    disabled={disabled}
    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
  >
    <option value="true">true</option>
    <option value="false">false</option>
  </select>
);

type Props = {
  ctx: LeafCtx;
  cond: EnabledLeafCondition | null;
  familyTypeOptions?: Option<EnabledLeafType>[];
  selectedFamily?: string;
  onChangeType?: (nextType: EnabledLeafType) => void;
  onChange: (next: EnabledLeafCondition) => void;
};

function getFieldValue(cond: EnabledLeafCondition, path: string): unknown {
  return (cond as Record<string, unknown>)[path];
}

function resolveVarKind(ctx: LeafCtx, cond: EnabledLeafCondition): LeafVarKind {
  if (cond.type === "playerVar") {
    const def = ctx.idx.getVarDef("player", cond.playerId, cond.varId);
    return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
  }

  if (cond.type === "npcVar") {
    const def = ctx.idx.getVarDef("npc", cond.npcId, cond.varId);
    return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
  }

  if (cond.type === "hotspotVar") {
    const def = ctx.idx.getVarDef("hotspot", cond.hotspotId, cond.varId);
    return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
  }

  return "unknown";
}

function isVarCondition(cond: EnabledLeafCondition): cond is Extract<EnabledLeafCondition, { type: "playerVar" | "npcVar" | "hotspotVar" }> {
  return cond.type === "playerVar" || cond.type === "npcVar" || cond.type === "hotspotVar";
}

function hasSelectedPrimaryEntity(cond: EnabledLeafCondition): boolean {
  switch (cond.type) {
    case "nodeVisited":
      return Boolean(cond.nodeId);
    case "mapRegionVisited":
      return Boolean(cond.regionId || cond.mapId);
    case "hasItem":
    case "placedItemVisible":
    case "placedItemReachable":
      return Boolean(cond.placedItemId);
    case "hotspotVisible":
    case "hotspotReachable":
    case "hotspotVar":
      return Boolean(cond.hotspotId);
    case "placedNpcVisible":
    case "placedNpcReachable":
    case "npcVar":
      return Boolean(cond.npcId);
    case "placedPlayerVisible":
    case "playerVar":
      return Boolean(cond.playerId);
    default:
      return false;
  }
}

function isProgressCondition(cond: EnabledLeafCondition): boolean {
  return cond.type === "nodeVisited" || cond.type === "mapRegionVisited";
}



export function ConditionLeafEditor({ ctx, cond, familyTypeOptions = [], selectedFamily, onChangeType, onChange }: Props) {
    if (!cond) {
    const isProgressFamily = selectedFamily === "progress";

    return (
      <div className="space-y-3">
        {isProgressFamily && familyTypeOptions.length > 0 ? (
          <div className="grid grid-cols-1 gap-2">
            <Field label="Opción">
              <Select<EnabledLeafType>
                value=""
                onChange={(v) => {
                  if (!v || !onChangeType) return;
                  onChangeType(v);
                }}
                options={familyTypeOptions}
                placeholder="Selecciona…"
              />
            </Field>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-2">
          <div className="input-conditions opacity-60 flex items-center">
            <span className="text-slate-400 text-[12px]">Selecciona…</span>
          </div>
        </div>
      </div>
    );
  }


  const ui = getLeafUi(cond.type);

  const patch = (p: Partial<EnabledLeafCondition>) => {
    const next = applyLeafPatch(ctx, cond, p);
    onChange(next);
  };

  const varKind = useMemo(() => resolveVarKind(ctx, cond), [ctx, cond]);
  const varOpOptions = useMemo<Option<string>[]>(() => getVarOpOptions(ctx, cond), [ctx, cond]);

  const family = leafFamily(cond.type);
  const filteredFamilyTypeOptions = useMemo<Option<EnabledLeafType>[]>(() => {
    const allowed = new Set(getAvailableLeafTypesForFamily(ctx, family, cond));
    return familyTypeOptions.filter((opt) => allowed.has(opt.id));
  }, [ctx, family, cond, familyTypeOptions]);

  const renderField = (f: LeafFieldSpec) => {
    if (f.visibleWhen && !f.visibleWhen(ctx, cond)) return null;

    const disabled = f.disabledWhen ? f.disabledWhen(cond) : false;
    const value = getFieldValue(cond, String(f.path));
    const options = getLeafOptions(ctx, cond, f);

    switch (f.control) {
      case "id-select":
        return (
          <Field key={f.key} label={f.label} className={f.className}>
            <Select<ID>
              value={(value as ID) ?? ""}
              onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
              options={options as Option<ID>[]}
              disabled={disabled}
              placeholder="Selecciona…"
            />
          </Field>
        );

      case "bool":
        return (
          <Field key={f.key} label={f.label} className={f.className}>
            <BoolSelect
              value={Boolean(value)}
              disabled={disabled}
              onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
            />
          </Field>
        );

      case "number":
        return (
          <Field key={f.key} label={f.label} className={f.className}>
            <NumberInput
              value={typeof value === "number" ? value : 0}
              disabled={disabled}
              onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
            />
          </Field>
        );

      case "var-op-select":
        return (
          <Field key={f.key} label={f.label} className={f.className}>
            <Select<string>
              value={String(value ?? "")}
              onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
              options={varOpOptions}
              disabled={disabled || varKind === "unknown"}
              placeholder="Selecciona…"
            />
          </Field>
        );

      case "var-value":
        return (
          <Field key={f.key} label={f.label} className={f.className}>
            {varKind === "boolean" ? (
              <BoolSelect
                value={Boolean(value)}
                disabled={disabled}
                onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
              />
            ) : (
              <NumberInput
                value={typeof value === "number" ? value : 0}
                disabled={disabled}
                onChange={(v) => patch({ [String(f.path)]: v } as Partial<EnabledLeafCondition>)}
              />
            )}
          </Field>
        );

      default:
        return null;
    }
  };

const shouldShowOptionField =
  filteredFamilyTypeOptions.length > 1 ||
  (family === "player" && filteredFamilyTypeOptions.length === 1);

const optionField =
  shouldShowOptionField ? (
    <Field label="Opción">
      <Select<EnabledLeafType>
        value={cond.type}
        onChange={(v) => {
          if (!v || !onChangeType) return;
          onChangeType(v);
        }}
        options={filteredFamilyTypeOptions}
        placeholder="Selecciona…"
        disabled={!isProgressCondition(cond) && !hasSelectedPrimaryEntity(cond)}
      />
    </Field>
  ) : null;

  if (cond.type === "nodeVisited") {
    const nodeField = ui.fields.find((x) => x.key === "nodeId");
    const valueField = ui.fields.find((x) => x.key === "value");

    return (
      <div className="space-y-3">
        {optionField ? <div className="grid grid-cols-1 gap-2">{optionField}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
          {nodeField ? renderField(nodeField) : null}
          {valueField ? renderField(valueField) : null}
        </div>
      </div>
    );
  }

  if (cond.type === "mapRegionVisited") {
    const mapField = ui.fields.find((x) => x.key === "mapId");
    const regionField = ui.fields.find((x) => x.key === "regionId");
    const valueField = ui.fields.find((x) => x.key === "value");
    const hasSeveralMaps = ctx.idx.getMapOptions().length > 1;

    return (
      <div className="space-y-3">
        {optionField ? <div className="grid grid-cols-1 gap-2">{optionField}</div> : null}

        <div
          className={
            hasSeveralMaps
              ? "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px] gap-2"
              : "grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2"
          }
        >
          {hasSeveralMaps && mapField ? renderField(mapField) : null}
          {regionField ? renderField(regionField) : null}
          {valueField ? renderField(valueField) : null}
        </div>
      </div>
    );
  }

  if (isVarCondition(cond)) {
    const ownerField =
      ui.fields.find((x) => x.key === "playerId") ??
      ui.fields.find((x) => x.key === "npcId") ??
      ui.fields.find((x) => x.key === "hotspotId");

    const varField = ui.fields.find((x) => x.key === "varId");
    const opField = ui.fields.find((x) => x.key === "op");
    const valueField = ui.fields.find((x) => x.key === "value");

    return (
      <div className="space-y-3">
        {ownerField ? <div className="grid grid-cols-1 gap-2">{renderField(ownerField)}</div> : null}

        {optionField ? <div className="grid grid-cols-1 gap-2">{optionField}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_140px] gap-2">
          {varField ? renderField(varField) : null}
          {opField ? renderField(opField) : null}
          {valueField ? renderField(valueField) : null}
        </div>
      </div>
    );
  }

  const entityField =
    ui.fields.find((x) => x.key === "placedItemId") ??
    ui.fields.find((x) => x.key === "hotspotId") ??
    ui.fields.find((x) => x.key === "npcId") ??
    ui.fields.find((x) => x.key === "playerId");

  const valueField = ui.fields.find((x) => x.key === "value");

  return (
    <div className="space-y-3">
      {entityField ? <div className="grid grid-cols-1 gap-2">{renderField(entityField)}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
        {optionField}
        {valueField ? renderField(valueField) : null}
      </div>
    </div>
  );
}