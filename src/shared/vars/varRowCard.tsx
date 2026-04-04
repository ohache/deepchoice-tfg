import { ChevronDown, ChevronRight, Check, Trash2 } from "lucide-react";
import type { VarRow, VarRowErrors } from "@/shared/vars/varRow";

export type VarRowCardProps = {
  row: VarRow;
  index: number;
  isOpen: boolean;
  disabled?: boolean;

  nameInputRef?: (el: HTMLInputElement | null) => void;
  onToggleOpen: () => void;
  onChange: (patch: Partial<VarRow>, opts?: { dirty?: boolean }) => void;
  onSwitchType: (nextType: "number" | "boolean") => void;
  onSave: () => void;
  onDelete: () => void;

  saveTitle?: string;
  deleteTitle?: string;
  saveVariant?: "player" | "npc" | "hotspot";
  errors?: VarRowErrors;
};

export function VarRowCard(props: VarRowCardProps) {
  const { row, index, isOpen, disabled = false, nameInputRef, onToggleOpen, onChange, onSwitchType, onSave,
    onDelete, saveTitle, deleteTitle, saveVariant, errors } = props;

  const variantClass = saveVariant ? `btn-save--${saveVariant}` : "";

  const inputBase = "w-full rounded-md bg-slate-900 border px-2 py-1.5 text-[12px] focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500";
  const okBorder = "border-slate-700";
  const errBorder = "border-rose-500/80 ring-rose-500/20";

  const titleText = row.name?.trim() ? row.name : `Variable ${index + 1}`;

  const hasNumberFieldErr = Boolean(errors?.min) || Boolean(errors?.max) || Boolean(errors?.initial);
  const showFormErrForNumber = Boolean(errors?.form) && !hasNumberFieldErr;

  const showFormErrForBoolean = Boolean(errors?.form) && !Boolean(errors?.name);

return (
  <div className="rounded-md border-2 border-slate-800 bg-slate-950/40 overflow-hidden">
    {/* Header */}
    <button
      type="button"
      onClick={onToggleOpen}
      className={"w-full px-3 py-3 flex items-center gap-3 text-left " + (isOpen ? "bg-slate-950/60" : "hover:bg-slate-900/60")}
      disabled={disabled}
      title={disabled ? "Completa los requisitos previos para editar variables" : "Abrir/cerrar"}
    >
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13px] text-slate-100 font-semibold">
        {titleText}
      </span>

      {isOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
    </button>

    {/* Body */}
    {isOpen && (
      <div className="p-3 border-t border-slate-800 space-y-3">
        {/* Fila superior */}
        <div className="flex gap-2 items-end">
          {/* Nombre */}
          <div className="flex-1 min-w-20">
            <label className="block text-[12px] text-slate-200 mb-1 text-center">Nombre</label>
            <input
              ref={nameInputRef}
              type="text"
              value={row.name}
              onChange={(e) => onChange({ name: e.target.value })}
              onFocus={(e) => {
                try {
                  e.currentTarget.select();
                } catch { }
              }}
              className={`${inputBase} ${errors?.name ? errBorder : okBorder}`}
              placeholder={`Variable${index + 1}`}
              disabled={disabled}
            />
            {errors?.name ? <div className="mt-1 text-[11px] text-rose-200">{errors.name}</div> : null}
          </div>

          {/* Tipo */}
          <div className="w-24 shrink-0">
            <label className="block text-[12px] text-slate-200 mb-1 text-center">Tipo</label>
            <select
              value={row.type}
              onChange={(e) => onSwitchType(e.target.value as "number" | "boolean")}
              className={`${inputBase} ${okBorder}`}
              disabled={disabled}
            >
              <option value="number">Número</option>
              <option value="boolean">Booleano</option>
            </select>
          </div>
        </div>

        {/* Slot estable + botones en misma fila */}
        <div className=" py-2 min-h-[70px] flex items-end gap-2">
          {/* Contenido */}
          <div className="flex-1 flex items-start justify-center pt-1">
            {row.type === "number" ? (
              <div className="w-full">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[12px] text-slate-200 mb-1 text-center">Min</label>
                    <input
                      type="number"
                      value={row.min}
                      onChange={(e) => onChange({ min: e.target.value })}
                      className={`${inputBase} text-center ${errors?.min ? errBorder : okBorder}`}
                      disabled={disabled}
                    />
                    {errors?.min ? <div className="mt-1 text-[11px] text-rose-200">Min: {errors.min}</div> : null}
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-200 mb-1 text-center">Max</label>
                    <input
                      type="number"
                      value={row.max}
                      onChange={(e) => onChange({ max: e.target.value })}
                      className={`${inputBase} text-center ${errors?.max ? errBorder : okBorder}`}
                      disabled={disabled}
                    />
                    {errors?.max ? <div className="mt-1 text-[11px] text-rose-200">Max: {errors.max}</div> : null}
                  </div>

                  <div>
                    <label className="block text-[12px] text-slate-200 mb-1 text-center">Inicial</label>
                    <input
                      type="number"
                      value={row.initial}
                      onChange={(e) => onChange({ initial: e.target.value })}
                      className={`${inputBase} text-center ${errors?.initial ? errBorder : okBorder}`}
                      disabled={disabled}
                    />
                    {errors?.initial ? <div className="mt-1 text-[11px] text-rose-200">Inicial: {errors.initial}</div> : null}
                  </div>
                </div>

                {showFormErrForNumber ? (
                  <div className="mt-2 text-[11px] text-rose-200 text-center">{errors!.form}</div>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="flex items-start justify-center gap-2">
                  <input
                    id={`varrow-${row.id}`}
                    type="checkbox"
                    checked={row.initial}
                    onChange={(e) => onChange({ initial: e.target.checked })}
                    className="relative -top-1.5 h-4 w-4 shrink-0"
                    disabled={disabled}
                  />
                  <label
                    htmlFor={`varrow-${row.id}`}
                    className="relative top-[-5px] text-[12px] text-slate-100"
                  >
                    Inicial (true/false)
                  </label>
                </div>

                {showFormErrForBoolean ? (
                  <div className="text-[11px] text-rose-200 text-center">{errors!.form}</div>
                ) : null}
              </div>
            )}
          </div>

          {/* Botones */}
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className={`btn btn-save ${variantClass} h-7.5 w-7.5 p-0 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed`}
              onClick={onSave}
              disabled={disabled}
              title={saveTitle ?? "Guardar"}
              aria-label="Guardar variable"
            >
              <Check className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="btn btn-danger h-7.5 w-7.5 p-0 inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
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
    )}
  </div>
);
}