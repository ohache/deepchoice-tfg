export type Option<K extends string> = { id: K; label: string };

type Props<K extends string> = {
  value: K | "";
  onChange: (v: K | "") => void;
  options: Option<K>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Select<K extends string>({ value, onChange, options, placeholder, disabled, className }: Props<K>) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.currentTarget.value as K | "")}
      className={className ?? "w-full rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-xs text-white " +
        "focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:opacity-50"}
    >
      <option value="">{placeholder ?? "Selecciona…"}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}