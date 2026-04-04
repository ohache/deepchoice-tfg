import { useMemo, type FC, type ReactNode } from "react";
import { buildInlineErrorMapByFirst, formatZodIssues } from "@/shared/zodIssues";
import type { ID } from "@/domain/types";
import { effectSchema } from "@/validation/rulesSchemas";
import {
  applyEffectPatch,
  effectFamilyOf,
  getEffectOptions,
  getEffectUi,
  hasSelectedPrimaryEffectEntity,
  getAvailableEffectTypesForCurrentSelection,
  type EffectFieldSpec,
  type FactoryCtx,
  type EnabledEffect,
  type EnabledEffectType,
  type OwnerVarKind,
} from "@/features/editor/scene/rules/effects/effectFactory";
import type { EffectFamilyId } from "@/features/editor/scene/rules/effects/effectFamilies";
import { Select, type Option } from "@/components/Select";

/* Helpers UI */
const Field: FC<{ label: string; children: ReactNode; className?: string; errorText?: string }> = ({
  label,
  children,
  className,
  errorText,
}) => (
  <div className={className}>
    {label ? <div className="text-[12px] text-slate-100 pb-1">{label}</div> : null}
    {children}
    {errorText ? <div className="pt-1 text-[11px] text-rose-300">{errorText}</div> : null}
  </div>
);

const TextInput: FC<{ value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }> = ({
  value,
  onChange,
  placeholder,
  autoFocus,
}) => (
  <input
    value={value}
    onChange={(e) => onChange(e.currentTarget.value)}
    placeholder={placeholder}
    autoFocus={autoFocus}
    className="input-conditions"
  />
);

const NumberInput: FC<{ value: number; onChange: (v: number) => void }> = ({ value, onChange }) => (
  <input
    type="number"
    value={Number.isFinite(value) ? value : 0}
    onChange={(e) => onChange(Number(e.currentTarget.value))}
    className="input-conditions"
  />
);

const BoolSelect: FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => (
  <select
    value={String(value)}
    onChange={(e) => onChange(e.currentTarget.value === "true")}
    className="w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
  >
    <option value="true">true</option>
    <option value="false">false</option>
  </select>
);

/* Component */
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

function getFieldValue(eff: EnabledEffect, path: string): unknown {
  return (eff as Record<string, unknown>)[path];
}

function getEffectVarKind(factory: FactoryCtx, eff: EnabledEffect): OwnerVarKind {
  switch (eff.type) {
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar":
      return factory.idx.getHotspotVarKind(factory.ctx.nodeId, eff.hotspotId, eff.varId);

    case "setPlayerVar":
    case "togglePlayerVar":
    case "incPlayerVar":
    case "decPlayerVar":
      return factory.idx.getPlayerVarKind(eff.playerId, eff.varId);

    case "setNpcVar":
    case "toggleNpcVar":
    case "incNpcVar":
    case "decNpcVar":
      return factory.idx.getNpcVarKind(eff.npcId, eff.varId);

    default:
      return "unknown";
  }
}

function getFieldByKey(fields: EffectFieldSpec[], key: string): EffectFieldSpec | undefined {
  return fields.find((f) => f.key === key);
}

export function EffectLeafEditor({
  factory,
  eff,
  selectedFamily,
  familyTypeOptions = [],
  onChangeType,
  onChange,
  errorsByPath,
  errorPrefix,
  showLocalErrors,
  forceEmptyAudioOption = false
}: Props) {
  const family = selectedFamily || (eff ? effectFamilyOf(eff.type) : "");
  const ui = eff ? getEffectUi(eff.type as EnabledEffectType) : null;

  const patch = (p: Partial<EnabledEffect>) => {
    if (!eff) return;
    const next = applyEffectPatch(factory, eff, p);
    onChange(next);
  };

  const validation = useMemo(() => {
    if (!eff) return { ok: true as const, inline: {} as Record<string, string>, global: "" };

    const res = effectSchema.safeParse(eff);
    if (res.success) return { ok: true as const, inline: {} as Record<string, string>, global: "" };

    const inline = buildInlineErrorMapByFirst(res.error.issues);
    const global = Object.keys(inline).length ? "" : formatZodIssues(res.error.issues);

    return { ok: false as const, inline, global };
  }, [eff]);

  const renderField = (f: EffectFieldSpec) => {
    if (!eff) return null;

    const visible = f.visibleWhen ? f.visibleWhen(factory, eff) : true;
    if (!visible) return null;

    const disabled = f.disabledWhen ? f.disabledWhen(factory, eff) : false;
    const value = getFieldValue(eff, f.path);
    const options = getEffectOptions(factory, eff, f);

    const externalKey = errorPrefix ? `${errorPrefix}.${f.path}` : f.path;
    const external = errorsByPath?.[externalKey];

    const local = showLocalErrors && !validation.ok ? validation.inline[f.path] : undefined;
    const errorText = external ?? local;

    const idValue = typeof value === "string" ? value : "";

    if (f.control === "id-select") {
      return (
        <Field key={f.key} label={f.label} className={f.className} errorText={errorText}>
          <Select<ID>
            value={idValue}
            onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
            options={options as Option<ID>[]}
            disabled={disabled}
            placeholder="Selecciona…"
          />
        </Field>
      );
    }

    if (f.control === "text") {
      return (
        <Field key={f.key} label={f.label} className={f.className} errorText={errorText}>
          <TextInput
            value={String(value ?? "")}
            onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
            placeholder={f.path === "text" || f.path === "message" ? "Escribe…" : undefined}
            autoFocus={family === "message" || family === "ending"}
          />
        </Field>
      );
    }

    if (f.control === "bool") {
      return (
        <Field key={f.key} label={f.label} className={f.className} errorText={errorText}>
          <BoolSelect value={Boolean(value)} onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)} />
        </Field>
      );
    }

    if (f.control === "number") {
      return (
        <Field key={f.key} label={f.label} className={f.className} errorText={errorText}>
          <NumberInput
            value={typeof value === "number" ? value : Number(value ?? 0)}
            onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
          />
        </Field>
      );
    }

    if (f.control === "var-value") {
      const kind = getEffectVarKind(factory, eff);

      return (
        <Field key={f.key} label={f.label} className={f.className} errorText={errorText}>
          {kind === "boolean" ? (
            <BoolSelect
              value={Boolean(value)}
              onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
            />
          ) : kind === "number" ? (
            <NumberInput
              value={typeof value === "number" ? value : Number(value ?? 0)}
              onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
            />
          ) : (
            <TextInput
              value={String(value ?? "")}
              onChange={(v) => patch({ [f.path]: v } as Partial<EnabledEffect>)}
            />
          )}
        </Field>
      );
    }

    return null;
  };

  const filteredFamilyTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    if (!selectedFamily) return familyTypeOptions;
    if (!eff) return familyTypeOptions;

    const allowed = new Set(
      getAvailableEffectTypesForCurrentSelection(factory, selectedFamily, eff)
    );

    return familyTypeOptions.filter((opt) => allowed.has(opt.id));
  }, [factory, selectedFamily, eff, familyTypeOptions]);

  const topLevelFamilyTypeOptions = useMemo<Option<EnabledEffectType>[]>(() => {
    const dedup = new Map<EnabledEffectType, Option<EnabledEffectType>>();

    for (const opt of filteredFamilyTypeOptions) {
      let topLevelType = opt.id;

      if (
        opt.id === "toggleHotspotVar" ||
        opt.id === "incHotspotVar" ||
        opt.id === "decHotspotVar"
      ) {
        topLevelType = "setHotspotVar";
      }

      if (
        opt.id === "toggleNpcVar" ||
        opt.id === "incNpcVar" ||
        opt.id === "decNpcVar"
      ) {
        topLevelType = "setNpcVar";
      }

      if (
        opt.id === "togglePlayerVar" ||
        opt.id === "incPlayerVar" ||
        opt.id === "decPlayerVar"
      ) {
        topLevelType = "setPlayerVar";
      }

      if (!dedup.has(topLevelType)) {
        const normalizedLabel =
          topLevelType === "setHotspotVar" ||
          topLevelType === "setNpcVar" ||
          topLevelType === "setPlayerVar"
            ? "Variable"
            : opt.label;

        dedup.set(topLevelType, { id: topLevelType, label: normalizedLabel });
      }
    }

    let out = Array.from(dedup.values());

    if (family === "npc") {
      const order: EnabledEffectType[] = [
        "setPlacedNpcVisible",
        "setPlacedNpcReachable",
        "setNpcVar",
        "giveItemToNpc",
        "receiveItemFromNpc",
      ];

      out = out.sort(
        (a, b) => order.indexOf(a.id) - order.indexOf(b.id)
      );
    }

    return out;
  }, [filteredFamilyTypeOptions, family]);

  const currentTopLevelType = useMemo<EnabledEffectType | "">(() => {
    if (!eff) return "";

    if (
      eff.type === "toggleHotspotVar" ||
      eff.type === "incHotspotVar" ||
      eff.type === "decHotspotVar"
    ) {
      return "setHotspotVar";
    }

    if (
      eff.type === "toggleNpcVar" ||
      eff.type === "incNpcVar" ||
      eff.type === "decNpcVar"
    ) {
      return "setNpcVar";
    }

    if (
      eff.type === "togglePlayerVar" ||
      eff.type === "incPlayerVar" ||
      eff.type === "decPlayerVar"
    ) {
      return "setPlayerVar";
    }

    return eff.type;
  }, [eff]);

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
      return options.filter((opt) =>
        filteredFamilyTypeOptions.some((familyOpt) => familyOpt.id === opt.id)
      );
    }

    if (family === "npc") {
      const options: Option<EnabledEffectType>[] = [{ id: "setNpcVar", label: "Asignar" }];
      if (kind === "boolean") options.push({ id: "toggleNpcVar", label: "Toggle" });
      if (kind === "number") {
        options.push({ id: "incNpcVar", label: "Incrementar" });
        options.push({ id: "decNpcVar", label: "Decrementar" });
      }
      return options.filter((opt) =>
        filteredFamilyTypeOptions.some((familyOpt) => familyOpt.id === opt.id)
      );
    }

    const options: Option<EnabledEffectType>[] = [{ id: "setPlayerVar", label: "Asignar" }];
    if (kind === "boolean") options.push({ id: "togglePlayerVar", label: "Toggle" });
    if (kind === "number") {
      options.push({ id: "incPlayerVar", label: "Incrementar" });
      options.push({ id: "decPlayerVar", label: "Decrementar" });
    }
    return options.filter((opt) =>
      filteredFamilyTypeOptions.some((familyOpt) => familyOpt.id === opt.id)
    );
  }, [family, factory, eff, filteredFamilyTypeOptions]);

  const showOptionField =
    family === "progress"
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
            ? (isUnselectedProgress ? "" : (eff?.type ?? "")) as EnabledEffectType
            : family === "audio" && forceEmptyAudioOption
              ? "" as EnabledEffectType
              : (currentTopLevelType as EnabledEffectType)
        }
        onChange={(v) => {
          if (!v || !onChangeType) return;
          onChangeType(v);
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
          onChange={(v) => {
            if (!v || !onChangeType) return;
            onChangeType(v);
          }}
          options={variableTypeOptions}
          placeholder="Selecciona…"
          disabled={!hasSelectedPrimaryEffectEntity(eff)}
        />
      </Field>
    ) : null;

  const fields = ui?.fields ?? [];

  const itemField = getFieldByKey(fields, "placedItemId");
  const hotspotField = getFieldByKey(fields, "hotspotId");
  const npcField = getFieldByKey(fields, "npcId");
  const playerField = getFieldByKey(fields, "playerId");
  const mapField = getFieldByKey(fields, "mapId");
  const regionField = getFieldByKey(fields, "regionId");
  const nodeField = getFieldByKey(fields, "targetNodeId");
  const dialogueField = getFieldByKey(fields, "nodeDialogueId");
  const sfxField = getFieldByKey(fields, "sfxId");
  const musicField = getFieldByKey(fields, "trackId");
  const musicStartField = getFieldByKey(fields, "startAt");
  const imageField = getFieldByKey(fields, "imageId");
  const varField = getFieldByKey(fields, "varId");
  const valueField = getFieldByKey(fields, "value");
  const amountField = getFieldByKey(fields, "amount");
  const textField = getFieldByKey(fields, "text");
  const messageField = getFieldByKey(fields, "message");

  const inlineOptionFieldForProgress =
    family === "progress" && filteredFamilyTypeOptions.length > 1 ? (
      <Field label="Opción">
        <Select<EnabledEffectType>
          value={(isUnselectedProgress ? "" : eff?.type ?? "") as EnabledEffectType}
          onChange={(v) => {
            if (!v || !onChangeType) return;
            onChangeType(v);
          }}
          options={filteredFamilyTypeOptions}
          placeholder="Selecciona…"
        />
      </Field>
    ) : null;

  const stackedOptionField =
    family === "progress" ? null : optionField;

  return (
    <div className="space-y-3">
      {showLocalErrors && !validation.ok && validation.global ? (
        <div className="rounded-md border border-rose-400/40 bg-rose-950/20 px-3 py-2 text-[12px] text-rose-200">
          {validation.global}
        </div>
      ) : null}

      {(family === "message" || family === "ending") && eff && (
        <div className="grid grid-cols-1 gap-2">
          {textField ? renderField(textField) : null}
          {messageField ? renderField(messageField) : null}
        </div>
      )}

      {family === "progress" && (
        <>
          <div className="grid grid-cols-1 gap-2">
            {inlineOptionFieldForProgress}
          </div>

          {!isUnselectedProgress && eff ? (
            eff.type === "goToNode" ? (
              <div className="grid grid-cols-1 gap-2">
                {nodeField ? renderField(nodeField) : null}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                {mapField ? renderField(mapField) : null}
                {regionField ? renderField(regionField) : null}
              </div>
            )
          ) : null}
        </>
      )}

      {family === "item" && eff && (
        <>
          {itemField ? <div className="grid grid-cols-1 gap-2">{renderField(itemField)}</div> : null}

          {eff.type === "addItem" || eff.type === "removeItem" ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
              {stackedOptionField}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {valueField ? renderField(valueField) : null}
            </div>
          )}
        </>
      )}

      {family === "hotspot" && eff && (
        <>
          {hotspotField ? <div className="grid grid-cols-1 gap-2">{renderField(hotspotField)}</div> : null}

          {eff.type === "setHotspotVar" ||
            eff.type === "toggleHotspotVar" ||
            eff.type === "incHotspotVar" ||
            eff.type === "decHotspotVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {varField ? renderField(varField) : null}
                {variableOptionField}
                {eff.type === "setHotspotVar"
                  ? valueField
                    ? renderField(valueField)
                    : null
                  : eff.type === "incHotspotVar" || eff.type === "decHotspotVar"
                    ? amountField
                      ? renderField(amountField)
                      : null
                    : null}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {valueField ? renderField(valueField) : null}
            </div>
          )}
        </>
      )}

      {family === "npc" && eff && (
        <>
          {npcField ? <div className="grid grid-cols-1 gap-2">{renderField(npcField)}</div> : null}

          {eff.type === "setNpcVar" ||
            eff.type === "toggleNpcVar" ||
            eff.type === "incNpcVar" ||
            eff.type === "decNpcVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {varField ? renderField(varField) : null}
                {variableOptionField}
                {eff.type === "setNpcVar"
                  ? valueField
                    ? renderField(valueField)
                    : null
                  : eff.type === "incNpcVar" || eff.type === "decNpcVar"
                    ? amountField
                      ? renderField(amountField)
                      : null
                    : null}
              </div>
            </>
          ) : eff.type === "giveItemToNpc" || eff.type === "receiveItemFromNpc" ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {itemField ? renderField(itemField) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {valueField ? renderField(valueField) : null}
            </div>
          )}
        </>
      )}

      {family === "player" && eff && (
        <>
          {playerField ? <div className="grid grid-cols-1 gap-2">{renderField(playerField)}</div> : null}

          {eff.type === "setPlayerVar" ||
            eff.type === "togglePlayerVar" ||
            eff.type === "incPlayerVar" ||
            eff.type === "decPlayerVar" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {stackedOptionField}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px_140px] gap-2">
                {varField ? renderField(varField) : null}
                {variableOptionField}
                {eff.type === "setPlayerVar"
                  ? valueField
                    ? renderField(valueField)
                    : null
                  : eff.type === "incPlayerVar" || eff.type === "decPlayerVar"
                    ? amountField
                      ? renderField(amountField)
                      : null
                    : null}
              </div>
            </>
          ) : eff.type === "setPlacedPlayerImage" ? (
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {imageField ? renderField(imageField) : null}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_140px] gap-2">
              {stackedOptionField}
              {valueField ? renderField(valueField) : null}
            </div>
          )}
        </>
      )}

      {family === "audio" && eff && (
        <>
          {eff.type === "playSfx" ? (
            <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
              {optionField}
              {sfxField ? renderField(sfxField) : null}
            </div>
          ) : eff.type === "playMusic" ? (
            <>
              {optionField}
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-2">
                {musicField ? renderField(musicField) : null}
                {musicStartField ? renderField(musicStartField) : null}
              </div>
            </>
          ) : (
            <>{optionField}</>
          )}
        </>
      )}

      {family === "dialogue" && eff && (
        <>
          {optionField}
          <div className="grid grid-cols-1 gap-2">
            {dialogueField ? renderField(dialogueField) : null}
          </div>
        </>
      )}
    </div>
  );
}