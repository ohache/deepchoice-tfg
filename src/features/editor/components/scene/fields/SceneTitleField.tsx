import type { RefObject, KeyboardEvent, ChangeEvent } from "react";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

interface SceneTitleFieldProps {
    label?: string;
    value: string;
    error?: SceneValidationIssue;
    active: boolean;
    onToggle: () => void;
    inputRef: RefObject<HTMLInputElement | null>;
    onChange: (value: string) => void;
    onEnterDone?: () => void;
}

export function SceneTitleField({ label = "Título", value, error, active, onToggle, inputRef, onChange, onEnterDone }: SceneTitleFieldProps) {
    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
        onChange(event.currentTarget.value);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (onEnterDone) onEnterDone();
        }
    };

    return (
        <>
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
                        className="text-center w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                        placeholder="Ej: Entrada al bosque"
                    />
                </div>
            </ToggleFieldBlock>

            {error && (
                <p className="form-field-error">
                    {error.message}
                </p>
            )}
        </>
    );
}