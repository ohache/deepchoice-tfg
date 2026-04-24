import type { ChangeEvent, KeyboardEvent, RefObject } from "react";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";

interface SceneVariantLabelFieldProps {
  label?: string;
  value: string;
  active: boolean;
  onToggle: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onEnterDone?: () => void;
  placeholder?: string;
}

/* Campo toggle para editar el nombre/label de una variante */
export function SceneVariantLabelField({ label = "Nombre", value, active, onToggle, inputRef, onChange, onEnterDone, placeholder = "Ej: Capa bosque nocturno",
    }: SceneVariantLabelFieldProps) {  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.value);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;

    event.preventDefault();
    onEnterDone?.();
  };

  return (
    <ToggleFieldBlock
      label={label}
      active={active}
      onToggle={onToggle}
    >
      <div className="pt-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={150}
          className="text-start pl-4 w-full rounded-md bg-slate-950/70 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100
           placeholder:text-slate-400 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-600"
          placeholder={placeholder}
        />
      </div>
    </ToggleFieldBlock>
  );
}