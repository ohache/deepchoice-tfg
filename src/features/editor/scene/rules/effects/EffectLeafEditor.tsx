import { useMemo } from "react";
import type { FC, ReactNode } from "react";
import { buildInlineErrorMapByFirst, formatZodIssues } from "@/shared/zodIssues";
import type { EndGameLine, ID } from "@/domain/types";
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
  return path.split(".").reduce<unknown>((acc, key) => {
    if (typeof acc !== "object" || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, effect);
}

function buildNestedPatch(base: unknown, path: string, value: unknown): Partial<EnabledEffect> {
  const keys = path.split(".");

  const build = (current: unknown, remaining: string[]): unknown => {
    const [key, ...tail] = remaining;

    if (!key) return value;

    const currentObject =
      typeof current === "object" && current !== null
        ? (current as Record<string, unknown>)
        : {};

    return {
      ...currentObject,
      [key]: tail.length === 0
        ? value
        : build(currentObject[key], tail),
    };
  };

  return build(base, keys) as Partial<EnabledEffect>;
}

function getEndGameLines(effect: EnabledEffect): EndGameLine[] {
  if (effect.type !== "endGame") return [];
  return effect.ending?.lines ?? [];
}

function getMessageSpeakerValue(factory: FactoryCtx, effect: EnabledEffect): string {
  if (effect.type !== "showMessage") return "narrator";

  return factory.idx.formatMessageSpeakerOption({ speakerKind: effect.speakerKind, speakerId: effect.speakerId });
}

function getEffectVarKind(factory: FactoryCtx, effect: EnabledEffect): OwnerVarKind {
  switch (effect.type) {
    case "setHotspotVar":
    case "toggleHotspotVar":
    case "incHotspotVar":
    case "decHotspotVar": {
      const hotspot = factory.idx.getHotspotById(effect.hotspotId);
      const def = hotspot?.vars?.find((entry) => entry.id === effect.varId) ?? null;

      if (!def) return "unknown";

      return def.type === "boolean" ? "boolean" : "number";
    }

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

  const patchField = (path: string, value: unknown) => {
    if (!eff) return;
    patch(buildNestedPatch(eff, path, value));
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

  const hasPrimaryEntity = eff ? hasSelectedPrimaryEffectEntity(eff) : false;

  const showOptionField = family === "progress"
    ? filteredFamilyTypeOptions.length > 1
    : family === "dialogue"
      ? filteredFamilyTypeOptions.length >= 1
      : topLevelFamilyTypeOptions.length > 1 &&
      family !== "message" &&
      family !== "ending" &&
      (family === "player" ? hasPrimaryEntity : true);

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

    if (eff.type === "showMessage" && field.key === "speaker") {
      const speakerValue = getMessageSpeakerValue(factory, eff);

      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <Select<string>
            value={speakerValue}
            onChange={(nextValue) => {
              const parsed = factory.idx.parseMessageSpeakerOption(nextValue as never);

              patch({
                speakerKind: parsed.speakerKind,
                speakerId: parsed.speakerId,
              } as Partial<EnabledEffect>);
            }}
            options={options}
            disabled={disabled}
            placeholder="Selecciona…"
          />
        </Field>
      );
    }

    if (field.control === "id-select") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <Select<ID>
            value={typeof value === "string" ? value : ""}
            onChange={(nextValue) => patchField(field.path, nextValue)}
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
            onChange={(nextValue) => patchField(field.path, nextValue)}
            placeholder={field.path === "text" || field.path === "message" || field.path === "ending.message" || field.path === "ending.dockText" ? "Escribe…" : undefined}
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
            onChange={(nextValue) => patchField(field.path, nextValue)}
          />
        </Field>
      );
    }

    if (field.control === "number") {
      return (
        <Field key={field.key} label={field.label} className={field.className} errorText={errorText}>
          <NumberInput
            value={typeof value === "number" ? value : Number(value ?? 0)}
            onChange={(nextValue) => patchField(field.path, nextValue)}
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
              onChange={(nextValue) => patchField(field.path, nextValue)}
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

      {family === "message" && eff ? (
        <div className="grid grid-cols-1 gap-2">
          {renderField(fieldMap.speaker)}
          {renderField(fieldMap.text)}
        </div>
      ) : null}

      {family === "ending" && eff ? (
        <div className="grid grid-cols-1 gap-3">
          {renderField(fieldMap["ending.message"])}
          {renderField(fieldMap["ending.dockText"])}
          {renderField(fieldMap["ending.musicTrackId"])}

          {eff.type === "endGame" ? (
            <div className="rounded-md border border-slate-700 bg-slate-950/40 p-2 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[12px] text-slate-100">Líneas finales</div>

                <button
                  type="button"
                  className="btn btn-add-condition text-[12px] px-2 py-1"
                  onClick={() => {
                    patchField("ending.lines", [
                      ...getEndGameLines(eff),
                      {
                        id: crypto.randomUUID(),
                        text: "",
                        speaker: { kind: "narrator" },
                      },
                    ]);
                  }}
                >
                  + Añadir línea
                </button>
              </div>

              {getEndGameLines(eff).map((line, index) => {
                const speakerValue = line.speaker
                  ? line.speaker.kind === "player"
                    ? `player:${line.speaker.playerId}`
                    : line.speaker.kind === "npc"
                      ? `npc:${line.speaker.npcId}`
                      : "narrator"
                  : "narrator";

                const layerId =
                  factory.ctx.owner.kind === "hotspot" ||
                    factory.ctx.owner.kind === "placedItem" ||
                    factory.ctx.owner.kind === "placedNpc"
                    ? factory.ctx.owner.layerId
                    : null;

                const speakerOptions = factory.idx.getMessageSpeakerOptions({
                  nodeId: factory.ctx.nodeId,
                  layerId,
                });

                return (
                  <div
                    key={line.id}
                    className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)_auto] gap-2 items-end"
                  >
                    <Field label="Emisor">
                      <Select<string>
                        value={speakerValue}
                        onChange={(nextValue) => {
                          const parsed = factory.idx.parseMessageSpeakerOption(nextValue as never);

                          const nextLines = getEndGameLines(eff).map((entry, currentIndex) =>
                            currentIndex === index
                              ? {
                                ...entry,
                                speaker:
                                  parsed.speakerKind === "player"
                                    ? { kind: "player", playerId: parsed.speakerId ?? "" }
                                    : parsed.speakerKind === "npc"
                                      ? { kind: "npc", npcId: parsed.speakerId ?? "" }
                                      : { kind: "narrator" },
                              }
                              : entry,
                          );

                          patchField("ending.lines", nextLines);
                        }}
                        options={speakerOptions}
                        placeholder="Selecciona…"
                      />
                    </Field>

                    <Field label="Texto">
                      <TextInput
                        value={line.text}
                        onChange={(nextText) => {
                          const nextLines = getEndGameLines(eff).map((entry, currentIndex) =>
                            currentIndex === index ? { ...entry, text: nextText } : entry,
                          );

                          patchField("ending.lines", nextLines);
                        }}
                        placeholder="Escribe…"
                      />
                    </Field>

                    <button
                      type="button"
                      className="btn btn-danger-condition text-[12px] px-2 py-1"
                      onClick={() => {
                        patchField(
                          "ending.lines",
                          getEndGameLines(eff).filter((_, currentIndex) => currentIndex !== index),
                        );
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
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
          {eff.type === "transformItem" ? (
            <>
              <div className="grid grid-cols-1 gap-2">
                {renderField(fieldMap.sourceItemInstanceId)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
                {stackedOptionField}
                {renderField(fieldMap.resultItemId)}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {renderField(fieldMap.resultItemLabel)}
              </div>
            </>
          ) : eff.type === "combineItems" ? (
            <>
              <div className="grid grid-cols-1 gap-2">
                {renderField(fieldMap.sourceItemInstanceId)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_minmax(0,1fr)] gap-2">
                {stackedOptionField}
                {renderField(fieldMap.targetItemInstanceId)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)] gap-2">
                {renderField(fieldMap.resultItemId)}
              </div>

              <div className="grid grid-cols-1 gap-2">
                {renderField(fieldMap.resultItemLabel)}
              </div>
            </>
          ) : (
            <>
              {fieldMap.itemInstanceId ? (
                <div className="grid grid-cols-1 gap-2">{renderField(fieldMap.itemInstanceId)}</div>
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
          ) : eff.type === "setPlacedNpcVisible" || eff.type === "setPlacedNpcReachable" ? (
            <div className="grid grid-cols-1 md:grid-cols-[100px_minmax(0,2fr)_minmax(0,2fr)_96px] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.nodeId)}
              {renderField(fieldMap.layerId)}
              {renderField(fieldMap.value)}
            </div>
          ) : eff.type === "giveItemToNpc" || eff.type === "receiveItemFromNpc" ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.itemInstanceId)}
            </div>
          ) : null}
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
          ) : eff.type === "setPlacedPlayerVisible" ? (
            <div className="grid grid-cols-1 md:grid-cols-[100px_minmax(0,2fr)_minmax(0,2fr)_90px] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.nodeId)}
              {renderField(fieldMap.layerId)}
              {renderField(fieldMap.value)}
            </div>
          ) : eff.type === "setPlacedPlayerImage" ? (
            <div className="grid grid-cols-1 md:grid-cols-[100px_minmax(0,2fr)_minmax(0,2fr)_minmax(0,2fr)] gap-2">
              {stackedOptionField}
              {renderField(fieldMap.nodeId)}
              {renderField(fieldMap.layerId)}
              {renderField(fieldMap.imageId)}
            </div>
          ) : null}
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