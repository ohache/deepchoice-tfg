import type { RefObject, ChangeEvent } from "react";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";
import { CheckCircleIcon } from "@heroicons/react/24/outline";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

interface SceneTextFieldProps {
    label?: string;
    value: string;
    error?: SceneValidationIssue;
    active: boolean;
    onToggle: () => void;
    textareaRef: RefObject<HTMLTextAreaElement | null>;
    onChange: (value: string) => void;
    onMarkDone?: () => void;
}

export function SceneTextField({ label = "Texto", value, error, active, onToggle, textareaRef, onChange, onMarkDone }: SceneTextFieldProps) {
    const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(event.currentTarget.value);
    };

    return (
        <>
            <ToggleFieldBlock
                label={label}
                active={active}
                onToggle={onToggle}
            >
                <div className="pt-2">
                    <div className="relative">
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleChange}
                            className="w-full h-32 rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 pr-9 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 resize-none overflow-y-auto"
                            placeholder="Escribe aquí el texto de la escena…"
                        />
                        <button
                            type="button"
                            onClick={onMarkDone}
                            className="absolute bottom-2 right-2 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                            title="Marcar texto como listo"
                        >
                            <CheckCircleIcon className="w-4 h-4" />
                        </button>
                    </div>
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