import type React from "react";
import type { RefObject, ChangeEvent, DragEvent } from "react";
import { ToggleFieldBlock } from "@/features/editor/components/scene/SceneFieldBlocks";
import type { SceneValidationIssue } from "@/features/editor/validation/sceneValidator";

interface SceneImageFieldProps {
    label?: string;
    value?: string;
    schemaError?: SceneValidationIssue;
    localError?: string | null;
    active: boolean;
    onToggle: () => void;

    isDragging: boolean;
    onDragOver: (event: DragEvent<HTMLDivElement>) => void;
    onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
    onDrop: (event: DragEvent<HTMLDivElement>) => void;

    fileInputRef: RefObject<HTMLInputElement | null>;
    onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

export function SceneImageField({ label = "Imagen", value, schemaError, localError, active, onToggle,
    isDragging, onDragOver, onDragLeave, onDrop, fileInputRef, onFileChange }: SceneImageFieldProps) {
    const handleClickDropzone = () => {
        fileInputRef.current?.click();
    };

    const handleSelectButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        fileInputRef.current?.click();
    };

    const fileName = value ? (value.split("/").pop() ?? value) : null;

    return (
        <>
            <ToggleFieldBlock
                label={label}
                active={active}
                onToggle={onToggle}
            >
                <div className="pt-2">
                    <div
                        className={["mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px]",
                            "transition-colors duration-150 border-2 border-dashed cursor-pointer",
                            isDragging
                                ? "border-cyan-400 bg-cyan-950/40"
                                : "border-cyan-800 bg-slate-900/40 hover:bg-slate-800",
                        ].join(" ")}
                        onDragOver={onDragOver}
                        onDragLeave={onDragLeave}
                        onDrop={onDrop}
                        onClick={handleClickDropzone}
                    >
                        <p className="mb-2 text-slate-300 text-center">
                            Arrastra aquí una imagen
                            <span className="block text-[11px] text-slate-500">
                                (o haz clic para seleccionarla)
                            </span>
                        </p>

                        <button
                            type="button"
                            className="px-3 py-1.5 rounded-md border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
                            onClick={handleSelectButtonClick}
                        >
                            Seleccionar…
                        </button>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                        className="hidden"
                        onChange={onFileChange}
                    />

                    <p className="mt-2 text-[11px] text-slate-400 break-all text-center">
                        {fileName
                            ? `Imagen seleccionada: ${fileName}`
                            : "No hay imagen seleccionada"}
                    </p>
                </div>
            </ToggleFieldBlock>

            {schemaError && (
                <p className="form-field-error">
                    {schemaError.message}
                </p>
            )}

            {!schemaError && localError && (
                <p className="form-field-error">
                    {localError}
                </p>
            )}
        </>
    );
}