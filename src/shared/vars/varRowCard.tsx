import type { VarRow, VarRowErrors } from "@/shared/vars/varRow";
import { Checkbox } from "@/components/Checkbox";
import { Select, type Option } from "@/components/Select";
import { ChevronDown, ChevronRight, Check, Trash2 } from "lucide-react";

const varTypeOptions: Option<"number" | "boolean">[] = [
  { id: "number", label: "Número" },
  { id: "boolean", label: "Booleano" }
];

export type VarRowCardProps = {
  row: VarRow;
  index: number;
  isOpen: boolean;
  disabled?: boolean;
  nameInputRef?: (element: HTMLInputElement | null) => void;
  onToggleOpen: () => void;
  onChange: (patch: Partial<VarRow>, opts?: { dirty?: boolean }) => void;
  onSwitchType: (nextType: "number" | "boolean") => void;
  onSave: () => void;
  onDelete: () => void;
  saveTitle?: string;
  deleteTitle?: string;
  saveVariant?: "player" | "npc" | "hotspot";
  errors?: VarRowErrors;
  tone?: "default" | "hotspot";
};

/* Estilos base reutilizables */
const INPUT_BASE_CLASS = "w-full rounded-md bg-slate-950 border px-2 py-1.5 text-[12px] focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500";
const INPUT_OK_CLASS = "border-2 border-slate-700";
const INPUT_ERROR_CLASS = "border-rose-500/80 ring-rose-500/20";

/* Devuelve la clase del input según tenga error o no */
function getInputClass(hasError: boolean, extraClassName = ""): string {
  return `${INPUT_BASE_CLASS} ${hasError ? INPUT_ERROR_CLASS : INPUT_OK_CLASS}${extraClassName ? ` ${extraClassName}` : ""}`;
}

/* Título visible en cabecera */
function getRowTitle(row: VarRow, index: number): string {
  return row.name?.trim() || `Variable ${index + 1}`;
}

/* Bloque visual de error */
function FieldError({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <div className="mt-1 text-[11px] text-rose-200 text-center">{children}</div>;
}

/* Input numérico con label y error */
function NumberField(props: { label: string; value: number | string; disabled: boolean; hasError: boolean; errorText?: string; onChange: (nextValue: string) => void }) {
  const { label, value, disabled, hasError, errorText, onChange } = props;

  return (
    <div>
      <label className="block text-[13px] text-slate-100 mb-1 text-center">{label}</label>

      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        className={getInputClass(hasError, "text-center")}
        disabled={disabled}
      />

      {errorText ? <FieldError>{errorText}</FieldError> : null}
    </div>
  );
}

function getToneClasses(tone: "default" | "hotspot") {
  if (tone === "hotspot") {
    return { card: "border-cyan-900 bg-slate-950/40", headerClosed: "hover:bg-cyan-500/10", headerOpen: "bg-slate-950/60" };
  }

  return { card: "border-slate-700 bg-slate-950/40", headerClosed: "hover:bg-slate-900/60", headerOpen: "bg-slate-950/60" };
}

export function VarRowCard(props: VarRowCardProps) {
  const { row, index, isOpen, disabled = false, nameInputRef, onToggleOpen, onChange, onSwitchType, onSave, onDelete, saveTitle, deleteTitle, saveVariant,
    errors, tone = "default" } = props;

  const variantClass = saveVariant ? `btn-save--${saveVariant}` : "";
  const titleText = getRowTitle(row, index);
  const toneClasses = getToneClasses(tone);

  return (
    <div className={`overflow-hidden rounded-md border-2 ${toneClasses.card}`}>
      {/* Header */}
      <button
        type="button"
        onClick={onToggleOpen}
        className={"flex w-full items-center gap-3 px-3 py-3 text-left " +
          (isOpen ? toneClasses.headerOpen : toneClasses.headerClosed)}
        disabled={disabled}
        title={disabled ? "Completa los requisitos previos para editar variables" : "Abrir/cerrar"}
      >
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] text-slate-100 font-semibold">
          {titleText}
        </span>

        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Body */}
      {isOpen ? (
        <div className="space-y-3 border-t border-slate-700 p-3">
          {/* Nombre + tipo */}
          <div className="flex gap-2 items-end">
            <div className="flex-1 min-w-20">
              <label className="block text-[13px] text-slate-100 mb-1 text-center">Nombre</label>

              <input
                ref={nameInputRef}
                type="text"
                value={row.name}
                onChange={(event) => onChange({ name: event.currentTarget.value })}
                onFocus={(event) => {
                  try { event.currentTarget.select(); }
                  catch {}
                }}
                className={getInputClass(Boolean(errors?.name))}
                placeholder={`Variable${index + 1}`}
                disabled={disabled}
              />

              {errors?.name ? <FieldError>{errors.name}</FieldError> : null}
            </div>

            <div className="w-24 shrink-0">
              <label className="block text-[13px] text-slate-100 mb-1 text-center">Tipo</label>

              <Select<"number" | "boolean">
                value={row.type}
                onChange={(value) => {
                  if (!value) return;
                  onSwitchType(value);
                }}
                options={varTypeOptions}
                disabled={disabled}
                className="w-full"
                buttonClassName={getInputClass(false)}
              />
            </div>
          </div>

          {/* Zona variable + acciones */}
          <div className="py-2 min-h-[70px] flex items-end gap-2">
            <div className="flex-1 flex items-start justify-center pt-1">
              {row.type === "number" ? (
                <div className="w-full">
                  <div className="grid grid-cols-3 gap-2">
                    <NumberField
                      label="Min"
                      value={row.min}
                      disabled={disabled}
                      hasError={Boolean(errors?.min)}
                      errorText={errors?.min}
                      onChange={(nextValue) => onChange({ min: nextValue })}
                    />

                    <NumberField
                      label="Max"
                      value={row.max}
                      disabled={disabled}
                      hasError={Boolean(errors?.max)}
                      errorText={errors?.max}
                      onChange={(nextValue) => onChange({ max: nextValue })}
                    />

                    <NumberField
                      label="Inicial"
                      value={row.initial}
                      disabled={disabled}
                      hasError={Boolean(errors?.initial)}
                      errorText={errors?.initial}
                      onChange={(nextValue) => onChange({ initial: nextValue })}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="flex items-start justify-center gap-2">
                    <Checkbox
                      id={`varrow-${row.id}`}
                      checked={row.initial}
                      disabled={disabled}
                      onChange={(checked) => onChange({ initial: checked })}
                      label="Inicial (true/false)"
                      boxClassName="-translate-y-1"
                      labelClassName="relative top-[-5px] text-[12px] text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                className={`btn btn-save ${variantClass} bg-lime-950 hover:bg-lime-900/80 border-lime-700 h-7.5 w-7.5 p-0 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
                onClick={onSave}
                disabled={disabled}
                title={saveTitle ?? "Guardar"}
                aria-label="Guardar variable"
              >
                <Check className="h-4 w-4" />
              </button>

              <button
                type="button"
                className="btn btn-danger bg-red-950 hover:bg-red-900/80 h-7.5 w-7.5 p-0 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={onDelete}
                disabled={disabled}
                title={deleteTitle ?? "Eliminar"}
                aria-label="Eliminar variable"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}