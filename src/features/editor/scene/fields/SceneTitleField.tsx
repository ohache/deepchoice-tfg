import type { RefObject, KeyboardEvent, ChangeEvent } from "react";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";

interface SceneTitleFieldProps {
  label?: string;
  value: string;
  active: boolean;
  onToggle: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
  onChange: (value: string) => void;
  onEnterDone?: () => void;
}

export function SceneTitleField({ label = "Título", value, active, onToggle, inputRef, onChange, onEnterDone}: SceneTitleFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => { onChange(event.currentTarget.value) };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onEnterDone?.();
  };

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          maxLength={120}
          className="text-center w-full rounded-md bg-slate-900/30 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-600"
          placeholder="Ej: Entrada al bosque"
        />
      </div>
    </ToggleFieldBlock>
  );
}