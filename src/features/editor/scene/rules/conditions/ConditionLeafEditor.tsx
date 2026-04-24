import React, { useMemo } from "react";
import type { ID } from "@/domain/types";
import {
  type EnabledLeafCondition, type EnabledLeafType, type LeafCtx, type LeafVarKind, applyLeafPatch, getLeafOptions, getLeafUi, getVarOpOptions,
  type LeafFieldSpec, getAvailableLeafTypesForFamily, leafFamily
} from "@/features/editor/scene/rules/conditions/conditionLeafRegistry";
import { Select, type Option } from "@/components/Select";

const booleanOptions: Option<"true" | "false">[] = [
  { id: "true", label: "true" },
  { id: "false", label: "false" },
];

/* Wrapper visual simple para cada campo */
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      {label ? <div className="text-[12px] text-slate-100 pb-1">{label}</div> : null}
      {children}
    </div>
  );
}

/* Input numérico reutilizable */
function NumberInput({ value, onChange, disabled }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Number(e.currentTarget.value))}
      disabled={disabled}
      className="input-conditions disabled:opacity-50"
    />
  );
}

/* Selector booleano reutilizable */
function BoolSelect({ value, onChange, disabled }: { value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <Select<"true" | "false">
      value={String(Boolean(value)) as "true" | "false"}
      onChange={(next) => onChange(next === "true")}
      disabled={disabled}
      options={booleanOptions}
      buttonClassName="border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"
    />
  );
}

type Props = {
  ctx: LeafCtx;
  cond: EnabledLeafCondition | null;
  familyTypeOptions?: Option<EnabledLeafType>[];
  selectedFamily?: string;
  onChangeType?: (nextType: EnabledLeafType) => void;
  onChange: (next: EnabledLeafCondition) => void;
};

/* Helpers */
function getFieldValue(cond: EnabledLeafCondition, path: string): unknown {
  return (cond as Record<string, unknown>)[path];
}

function resolveVarKind(ctx: LeafCtx, cond: EnabledLeafCondition): LeafVarKind {
  switch (cond.type) {
    case "playerVar": {
      const def = ctx.idx.getVarDef("player", cond.playerId, cond.varId);
      return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
    }

    case "npcVar": {
      const def = ctx.idx.getVarDef("npc", cond.npcId, cond.varId);
      return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
    }

    case "hotspotVar": {
      const def = ctx.idx.getVarDef("hotspot", cond.hotspotId, cond.varId);
      return def ? (def.type === "boolean" ? "boolean" : "number") : "unknown";
    }

    default:
      return "unknown";
  }
}


function isVarCondition(cond: EnabledLeafCondition): cond is Extract<EnabledLeafCondition, { type: "playerVar" | "npcVar" | "hotspotVar" }> {
  return cond.type === "playerVar" || cond.type === "npcVar" || cond.type === "hotspotVar";
}

/* Indica si la condición ya tiene elegida su entidad primaria */
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

/* Construye un pequeño índice local por key para evitar varios find repetidos */
function buildFieldMap(fields: LeafFieldSpec[]): Partial<Record<string, LeafFieldSpec>> {
  return fields.reduce<Partial<Record<string, LeafFieldSpec>>>((acc, field) => {
    acc[field.key] = field;
    return acc;
  }, {});
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
                onChange={(value) => {
                  if (!value || !onChangeType) return;
                  onChangeType(value);
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

  const fieldMap = useMemo(() => buildFieldMap(ui.fields), [ui.fields]);

  const patch = (partial: Partial<EnabledLeafCondition>) => {
    const next = applyLeafPatch(ctx, cond, partial);
    onChange(next);
  };

  const varKind = useMemo(() => resolveVarKind(ctx, cond), [ctx, cond]);

  const varOpOptions = useMemo<Option<string>[]>(() => getVarOpOptions(ctx, cond), [ctx, cond]);

  const family = leafFamily(cond.type);

  /* Filtra opciones de subtipo dentro de la familia actual según lo que sea válido en este contexto */
  const filteredFamilyTypeOptions = useMemo<Option<EnabledLeafType>[]>(() => {
    const allowed = new Set(getAvailableLeafTypesForFamily(ctx, family, cond));
    return familyTypeOptions.filter((option) => allowed.has(option.id));
  }, [ctx, family, cond, familyTypeOptions]);

  /* Render de campo genérico*/
  const renderField = (field?: LeafFieldSpec | null) => {
    if (!field) return null;
    if (field.visibleWhen && !field.visibleWhen(ctx, cond)) return null;

    const disabled = field.disabledWhen ? field.disabledWhen(cond) : false;
    const value = getFieldValue(cond, String(field.path));
    const options = getLeafOptions(ctx, cond, field);

    switch (field.control) {
      case "id-select":
        return (
          <Field key={field.key} label={field.label} className={field.className}>
            <Select<ID>
              value={(value as ID) ?? ""}
              onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
              options={options as Option<ID>[]}
              disabled={disabled}
              placeholder="Selecciona…"
            />
          </Field>
        );

      case "bool":
        return (
          <Field key={field.key} label={field.label} className={field.className}>
            <BoolSelect
              value={Boolean(value)}
              disabled={disabled}
              onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
            />
          </Field>
        );

      case "number":
        return (
          <Field key={field.key} label={field.label} className={field.className}>
            <NumberInput
              value={typeof value === "number" ? value : 0}
              disabled={disabled}
              onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
            />
          </Field>
        );

      case "var-op-select":
        return (
          <Field key={field.key} label={field.label} className={field.className}>
            <Select<string>
              value={String(value ?? "")}
              onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
              options={varOpOptions}
              disabled={disabled || varKind === "unknown"}
              placeholder="Selecciona…"
            />
          </Field>
        );

      case "var-value":
        return (
          <Field key={field.key} label={field.label} className={field.className}>
            {varKind === "boolean" ? (
              <BoolSelect
                value={Boolean(value)}
                disabled={disabled}
                onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
              />
            ) : (
              <NumberInput
                value={typeof value === "number" ? value : 0}
                disabled={disabled}
                onChange={(nextValue) => patch({ [String(field.path)]: nextValue } as Partial<EnabledLeafCondition>)}
              />
            )}
          </Field>
        );

      default:
        return null;
    }
  };

  /* Selector de subtipo dentro de una familia*/
  const shouldShowOptionField = filteredFamilyTypeOptions.length > 1 || (family === "player" && filteredFamilyTypeOptions.length === 1);

  const optionField = shouldShowOptionField ? (
    <Field label="Opción">
      <Select<EnabledLeafType>
        value={cond.type}
        onChange={(nextType) => {
          if (!nextType || !onChangeType) return;
          onChangeType(nextType);
        }}
        options={filteredFamilyTypeOptions}
        placeholder="Selecciona…"
        disabled={!isProgressCondition(cond) && !hasSelectedPrimaryEntity(cond)}
      />
    </Field>
  ) : null;

  /*  Casos de layout específicos */
  if (cond.type === "nodeVisited") {
    return (
      <div className="space-y-3">
        {optionField ? <div className="grid grid-cols-1 gap-2">{optionField}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
          {renderField(fieldMap.nodeId)}
          {renderField(fieldMap.value)}
        </div>
      </div>
    );
  }

  if (cond.type === "mapRegionVisited") {
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
          {hasSeveralMaps ? renderField(fieldMap.mapId) : null}
          {renderField(fieldMap.regionId)}
          {renderField(fieldMap.value)}
        </div>
      </div>
    );
  }

  if (isVarCondition(cond)) {
    const ownerField =
      fieldMap.playerId ?? fieldMap.npcId ?? fieldMap.hotspotId ?? null;

    return (
      <div className="space-y-3">
        {ownerField ? <div className="grid grid-cols-1 gap-2">{renderField(ownerField)}</div> : null}

        {optionField ? <div className="grid grid-cols-1 gap-2">{optionField}</div> : null}

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_140px] gap-2">
          {renderField(fieldMap.varId)}
          {renderField(fieldMap.op)}
          {renderField(fieldMap.value)}
        </div>
      </div>
    );
  }

  const entityField = fieldMap.placedItemId ?? fieldMap.hotspotId ?? fieldMap.npcId ?? fieldMap.playerId ?? null;

  return (
    <div className="space-y-3">
      {entityField ? <div className="grid grid-cols-1 gap-2">{renderField(entityField)}</div> : null}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
        {optionField}
        {renderField(fieldMap.value)}
      </div>
    </div>
  );
}