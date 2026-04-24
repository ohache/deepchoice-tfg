import { useMemo } from "react";
import type { FC, ReactNode } from "react";
import { buildInlineErrorMapByFirst, formatZodIssues } from "@/shared/zodIssues";
import type { ID } from "@/domain/types";
import { effectSchema } from "@/validation/rulesSchemas";
import {
  applyEffectPatch, effectFamilyOf, getEffectOptions, getEffectUi, hasSelectedPrimaryEffectEntity, getAvailableEffectTypesForCurrentSelection,
  type EffectFieldSpec, type FactoryCtx, type EnabledEffect, type EnabledEffectType, type OwnerVarKind
} from "@/features/editor/scene/rules/effects/effectFactory";
import type { EffectFamilyId } from "@/features/editor/scene/rules/effects/effectFamilies";
import { Select, type Option } from "@/components/Select";

const booleanOptions: Option<"true" | "false">[] = [
  { id: "true", label: "true" },
  { id: "false", label: "false" },
];

/* Helpers UI */
const Field: FC<{ label: string; children: ReactNode; className?: string; errorText?: string }> = ({ label, children, className, errorText }) => (
  <div className={className}>
    {label ? <div className="text-[12px] text-slate-100 pb-1">{label}</div> : null}
    {children}
    {errorText ? (
      <div className="pt-1 text-[11px] text-rose-300">{errorText}</div>
    ) : null}
  </div>
);

const TextInput: FC<{ value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean }> = ({ value, onChange, placeholder, autoFocus }) => (
  <input
    value={value}
    onChange={(e) => onChange(e.currentTarget.value)}
    placeholder={placeholder}
    autoFocus={autoFocus}
    className="input-conditions"
  />
);

const NumberInput: FC<{ value: number; onChange: (value: number) => void }> = ({ value, onChange }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Number(e.currentTarget.value))}
    className="input-conditions"
  />
);

const BoolSelect: FC<{ value: boolean; onChange: (value: boolean) => void }> = ({ value, onChange }) => (
  <Select<"true" | "false">
    value={String(value) as "true" | "false"}
    onChange={(next) => onChange(next === "true")}
    options={booleanOptions}
    buttonClassName="border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
  />
);

type Props = {
  factory: FactoryCtx;
  eff: EnabledEffect | null;
  selectedFamily?: EffectFamilyId | "";
  familyTypeOptions?: Option<EnabledEffectType>[];
  onChangeType?: (nextType: EnabledEffectType) => void;
  onChange: (next: EnabledEffect) => void;
  errorsByPath?: Record<string, string>;
  errorPrefix?: string;
  showLocalErrors?: boolean;
  forceEmptyAudioOption?: boolean;
};

/* Helpers */
function getFieldValue(effect: EnabledEffect, path: string): unknown {
  return (effect as Record<string, unknown>)[path];
}

function getEffectVarKind(factory: FactoryCtx, effect: EnabledEffect): OwnerVarKind {
  switch (effect.type) {
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return factory.idx.getHotspotVarKind(factory.ctx.nodeId, effect.hotspotId, effect.varId);

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return factory.idx.getPlayerVarKind(effect.playerId, effect.varId);

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return factory.idx.getNpcVarKind(effect.npcId, effect.varId);

    default:
      return "unknown";
  }
}

function buildFieldMap(fields: EffectFieldSpec[]): Partial<Record<string, EffectFieldSpec>> {
  return fields.reduce<Partial<Record<string, EffectFieldSpec>>>((acc, field) => { acc[field.key] = field; return acc }, {});
}

function getTopLevelEffectType(effect: EnabledEffect | null): EnabledEffectType | "" {
  if (!effect) return "";

  if (effect.type === "toggleHotspotVar" || effect.type === "incHotspotVar" || effect.type === "decHotspotVar") return "setHotspotVar";

  if (effect.type === "toggleNpcVar" || effect.type === "incNpcVar" || effect.type === "decNpcVar") return "setNpcVar";

  if (effect.type === "togglePlayerVar" || effect.type === "incPlayerVar" || effect.type === "decPlayerVar") return "setPlayerVar";

  return effect.type;
}

export function EffectLeafEditor({ factory, eff, selectedFamily, familyTypeOptions = [], onChangeType, onChange, errorsByPath,
  errorPrefix, showLocalErrors, forceEmptyAudioOption = false }: Props) {
  const family = selectedFamily || (eff ? effectFamilyOf(eff.type) : "");
  const ui = eff ? getEffectUi(eff.type) : null;
  const fields = ui?.fields ?? [];
  const fieldMap = useMemo(() => buildFieldMap(fields), [fields]);

  const patch = (partial: Partial<EnabledEffect>) => {
    if (!eff) return;
    const next = applyEffectPatch(factory, eff, partial);
    onChange(next);
  };

  const validation = useMemo(() => {
    if (!eff) return { ok: true as const, inline: {} as Record<string, string>, global: "" };

    const result = effectSchema.safeParse(eff);
    if (result.success) return { ok: true as const, inline: {} as Record<string, string>, global: "" };

    const inline = buildInlineErrorMapByFirst(result.error.issues);
    const global = Object.keys(inline).length ? "" : formatZodIssues(result.error.issues);

    return { ok: false as const, inline, global };
  }, [eff]);

  const filteredFamilyTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!selectedFamily || !eff) return familyTypeOptions;

    const allowed = new Set(getAvailableEffectTypesForCurrentSelection(factory, selectedFamily, eff));

    return familyTypeOptions.filter((option) => allowed.has(option.id));
  }, [factory, selectedFamily, eff, familyTypeOptions]);

  const topLevelFamilyTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    const dedup = new Map<EnabledEffectType, Option<EnabledEffectType>>();

    for (const option of filteredFamilyTypeOptions) {
      let topLevelType = option.id;

      if (option.id === "toggleHotspotVar" || option.id === "incHotspotVar" || option.id === "decHotspotVar") topLevelType = "setHotspotVar";

      if (option.id === "toggleNpcVar" || option.id === "incNpcVar" || option.id === "decNpcVar") topLevelType = "setNpcVar";

      if (option.id === "togglePlayerVar" || option.id === "incPlayerVar" || option.id === "decPlayerVar") topLevelType = "setPlayerVar";


      if (!dedup.has(topLevelType)) {
        dedup.set(topLevelType, {
          id: topLevelType,
          label: topLevelType === "setHotspotVar" || topLevelType === "setNpcVar" || topLevelType === "setPlayerVar" ? "Variable" : option.label,
        });
      }
    }

    let out = Array.from(dedup.values());

    if (family === "npc") {
      const order: EnabledEffectType[] = ["setPlacedNpcVisible", "setPlacedNpcReachable", "setNpcVar", "giveItemToNpc", "receiveItemFromNpc"];

      out = out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }

    return out;
  }, [filteredFamilyTypeOptions, family]);

  const currentTopLevelType = useMemo(() => getTopLevelEffectType(eff), [eff]);

  const variableTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!eff) return [];
    if (family !== "hotspot" && family !== "npc" && family !== "player") return [];

    const kind = getEffectVarKind(factory, eff);

    if (family === "hotspot") {
      const options: Option<EnabledEffectType>[] = [{ id: "setHotspotVar", label: "Asignar" }];

      if (kind === "boolean") options.push({ id: "toggleHotspotVar", label: "Toggle" });

      if (kind === "number") {
        options.push({ id: "incHotspotVar", label: "Incrementar" });
        options.push({ id: "decHotspotVar", label: "Decrementar" });
      }

      return options.filter((option) => filteredFamilyTypeOptions.some((familyOption) => familyOption.id === option.id));
    }

    if (family === "npc") {
      const options: Option<EnabledEffectType>[] = [{ id: "setNpcVar", label: "Asignar" }];

      if (kind === "boolean") options.push({ id: "toggleNpcVar", label: "Toggle" });

      if (kind === "number") {
        options.push({ id: "incNpcVar", label: "Incrementar" });
        options.push({ id: "decNpcVar", label: "Decrementar" });
      }

      return options.filter((option) => filteredFamilyTypeOptions.some((familyOption) => familyOption.id === option.id));
    }

    const options: Option<EnabledEffectType>[] = [{ id: "setPlayerVar", label: "Asignar" }];

    if (kind === "boolean") options.push({ id: "togglePlayerVar", label: "Toggle" });

    if (kind === "number") {
      options.push({ id: "incPlayerVar", label: "Incrementar" });
      options.push({ id: "decPlayerVar", label: "Decrementar" });
    }

    return options.filter((option) => filteredFamilyTypeOptions.some((familyOption) => familyOption.id === option.id));
  }, [family, factory, eff, filteredFamilyTypeOptions]);

  const showOptionField = family === "progress"
    ? filteredFamilyTypeOptions.length > 1
    : family === "dialogue"
      ? filteredFamilyTypeOptions.length >= 1
      : (topLevelFamilyTypeOptions.length > 1 ||
        (family === "player" && topLevelFamilyTypeOptions.length === 1)) &&
      family !== "message" &&
      family !== "ending";

  const isUnselectedProgress = family === "progress" && !eff;

  const optionField = showOptionField ? (
    <Field label="Opción">
      <Select<EnabledEffectType>
        value={
          family === "progress"
            ? ((isUnselectedProgress ? "" : eff?.type ?? "") as EnabledEffectType)
            : family === "audio" && forceEmptyAudioOption
              ? ("" as EnabledEffectType)
              : (currentTopLevelType as EnabledEffectType)
        }
        onChange={(value) => {
          if (!value || !onChangeType) return;
          onChangeType(value);
        }}
        options={family === "progress" ? filteredFamilyTypeOptions : topLevelFamilyTypeOptions}
        placeholder="Selecciona…"
        disabled={
          family === "progress" || family === "audio"
            ? false
            : family === "player" && topLevelFamilyTypeOptions.length === 1
              ? false
              : !eff || !hasSelectedPrimaryEffectEntity(eff)
        }
      />
    </Field>
  ) : null;

  const variableOptionField =
    eff && variableTypeOptions.length > 1 ? (
      <Field label="Opción">
        <Select<EnabledEffectType>
          value={eff.type}
          onChange={(value) => {
            if (!value || !onChangeType) return;
            onChangeType(value);
          }}
          options={variableTypeOptions}
          placeholder="Selecciona…"
          disabled={!hasSelectedPrimaryEffectEntity(eff)}
        />
      </Field>
    ) : null;

  const inlineOptionFieldForProgress = family === "progress" && filteredFamilyTypeOptions.length > 1 ? (
    <Field label="Opción">
      <Select<EnabledEffectType>
        value={(isUnselectedProgress ? "" : eff?.type ?? "") as EnabledEffectType}
        onChange={(value) => {
          if (!value || !onChangeType) return;
          onChangeType(value);
        }}
        options={filteredFamilyTypeOptions}
        placeholder="Selecciona…"
      />
    </Field>
  ) : null;

  const stackedOptionField = family === "progress" ? null : optionField;

  const renderField = (field?: EffectFieldSpec) => {
    if (!eff || !field) return null;

    const visible = field.visibleWhen ? field.visibleWhen(factory, eff) : true;
    if (!visible) return null;

    const disabled = field.disabledWhen ? field.disabledWhen(factory, eff) : false;
    const value = getFieldValue(eff, field.path);
    const options = getEffectOptions(factory, eff, field);

    const externalKey = errorPrefix ? `${errorPrefix}.${field.path}` : field.path;
    const externalError = errorsByPath?.[externalKey];
    const localError = showLocalErrors && !validation.ok ? validation.inline[field.path] : undefined;
    const errorText = externalError ?? localError;

    if (field.control === "id-select") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <Select<ID>
            value={typeof value === "string" ? value : ""}
            onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
            options={options as Option<ID>[]}
            disabled={disabled}
            placeholder="Selecciona…"
          />
        </Field>
      );
    }

    if (field.control === "text") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <TextInput
            value={String(value ?? "")}
            onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
            placeholder={field.path === "text" || field.path === "message" ? "Escribe…" : undefined}
            autoFocus={family === "message" || family === "ending"}
          />
        </Field>
      );
    }

    if (field.control === "bool") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <BoolSelect
            value={Boolean(value)}
            onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
          />
        </Field>
      );
    }

    if (field.control === "number") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <NumberInput
            value={typeof value === "number" ? value : Number(value ?? 0)}
            onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
          />
        </Field>
      );
    }

    if (field.control === "var-value") {
      const kind = getEffectVarKind(factory, eff);

      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          {kind === "boolean" ? (
            <BoolSelect
              value={Boolean(value)}
              onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
            />
          ) : kind === "number" ? (
            <NumberInput
              value={typeof value === "number" ? value : Number(value ?? 0)}
              onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
            />
          ) : (
            <TextInput
              value={String(value ?? "")}
              onChange={(nextValue) => patch({ [field.path]: nextValue } as Partial<EnabledEffect>)}
            />
          )}
        </Field>
      );
    }

    return null;
  };

  return (
    <div className="space-y-3">
      {showLocalErrors && !validation.ok && validation.global ? (
        <div className="rounded-md border border-rose-400/40 bg-rose-950/20 px-3 py-2 text-[12px] text-rose-200">
          {validation.global}
        </div>
      ) : null}

      {(family === "message" || family === "ending") && eff ? (
        <div className="grid grid-cols-1 gap-2">
          {renderField(fieldMap.text)}
          {renderField(fieldMap.message)}
        </div>
      ) : null}

      {family === "progress" ? (
        <>
          <div className="grid grid-cols-1 gap-2">{inlineOptionFieldForProgress}</div>

          {!isUnselectedProgress && eff ? (
            eff.type === "goToNode" ? (
              <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.targetNodeId)}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                {renderField(fieldMap.mapId)}
                {renderField(fieldMap.regionId)}
              </div>
            )
          ) : null}
        </>
      ) : null}

      {family === "item" && eff ? (
        <>
          {fieldMap.placedItemId ? (
            <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.placedItemId)}</div>
          ) : null}

          {eff.type === "addItem" || eff.type === "removeItem" ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
              {stackedOptionField}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.value)}
            </div>
          )}
        </>
      ) : null}

      {family === "hotspot" && eff ? (
        <>
          {fieldMap.hotspotId ? (
            <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.hotspotId)}</div>
          ) : null}

          {eff.type === "setHotspotVar" || eff.type === "toggleHotspotVar" || eff.type === "incHotspotVar" || eff.type === "decHotspotVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {renderField(fieldMap.varId)}
                {variableOptionField}
                {eff.type === "setHotspotVar"
                  ? renderField(fieldMap.value)
                  : eff.type === "incHotspotVar" || eff.type === "decHotspotVar"
                    ? renderField(fieldMap.amount)
                    : null}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.value)}
            </div>
          )}
        </>
      ) : null}

      {family === "npc" && eff ? (
        <>
          {fieldMap.npcId ? (
            <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.npcId)}</div>
          ) : null}

          {eff.type === "setNpcVar" || eff.type === "toggleNpcVar" || eff.type === "incNpcVar" || eff.type === "decNpcVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {renderField(fieldMap.varId)}
                {variableOptionField}
                {eff.type === "setNpcVar"
                  ? renderField(fieldMap.value)
                  : eff.type === "incNpcVar" || eff.type === "decNpcVar"
                    ? renderField(fieldMap.amount)
                    : null}
              </div>
            </>
          ) : eff.type === "giveItemToNpc" || eff.type === "receiveItemFromNpc" ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.placedItemId)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.value)}
            </div>
          )}
        </>
      ) : null}

      {family === "player" && eff ? (
        <>
          {fieldMap.playerId ? (
            <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.playerId)}</div>
          ) : null}

          {eff.type === "setPlayerVar" || eff.type === "togglePlayerVar" || eff.type === "incPlayerVar" || eff.type === "decPlayerVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {renderField(fieldMap.varId)}
                {variableOptionField}
                {eff.type === "setPlayerVar"
                  ? renderField(fieldMap.value)
                  : eff.type === "incPlayerVar" || eff.type === "decPlayerVar"
                    ? renderField(fieldMap.amount)
                    : null}
              </div>
            </>
          ) : eff.type === "setPlacedPlayerImage" ? (
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.imageId)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.value)}
            </div>
          )}
        </>
      ) : null}

      {family === "audio" && eff ? (
        <>
          {eff.type === "playSfx" ? (
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
              {optionField}
              {renderField(fieldMap.sfxId)}
            </div>
          ) : eff.type === "playMusic" ? (
            <>
              {optionField}
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-2">
                {renderField(fieldMap.trackId)}
                {renderField(fieldMap.startAt)}
              </div>
            </>
          ) : (
            <>{optionField}</>
          )}
        </>
      ) : null}

      {family === "dialogue" && eff ? (
        <>
          {optionField}
          <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.nodeDialogueId)}</div>
        </>
      ) : null}
    </div>
  );
}