import type { ReactNode } from "react";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  className?: string;
  labelClassName?: string;
  boxClassName?: string;
  labelPosition?: "left" | "right";
};

/* Checkbox visual reutilizable para la UI del editor */
export function Checkbox({ checked, onChange, disabled = false, label, id, className, labelClassName, boxClassName, labelPosition = "right" }: CheckboxProps) {
  const hasLabel = label !== undefined && label !== null;

  const checkboxControl = (
    <span
      className={"flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors " +
        (checked
          ? "border-emerald-500 bg-emerald-600"
          : "border-slate-600 bg-slate-900") +
        (disabled ? " opacity-50" : "") +
        (boxClassName ? ` ${boxClassName}` : "")}
      aria-hidden="true"
    >
      {checked ? (
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      ) : null}
    </span>
  );

  return (
    <label
      htmlFor={id}
      className={"inline-flex items-center gap-2 " +
        (disabled ? "cursor-not-allowed" : "cursor-pointer") +
        (className ? ` ${className}` : "")}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="absolute -z-10 h-0 w-0 opacity-0"
      />

      {labelPosition === "left" && hasLabel ? (
        <span className={labelClassName}>{label}</span>
      ) : null}

      {checkboxControl}

      {labelPosition === "right" && hasLabel ? (
        <span className={labelClassName}>{label}</span>
      ) : null}
    </label>
  );
}