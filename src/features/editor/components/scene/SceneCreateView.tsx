import type React from "react";
import { useState, useEffect, useRef} from "react";
import { useEditorStore } from "@/store/editorStore";
import { CheckCircleIcon, FlagIcon, StopCircleIcon } from "@heroicons/react/24/outline";

type SceneToggleFieldId = "title" | "text" | "image" | "hotspots" | "tags";

export function SceneCreateView() {
    const [activeField, setActiveField] = useState<SceneToggleFieldId | null>(null);

    const project = useEditorStore((s) => s.project);
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
    const createAndSelectNode = useEditorStore((s) => s.createAndSelectNode);
    const updateSelectedNodeFields = useEditorStore((s) => s.updateSelectedNodeFields);

    useEffect(() => {
        if (!project) return;
        const hasSelectedNode = selectedNodeId && project.nodes.some((n) => n.id === selectedNodeId);
        if (!hasSelectedNode) createAndSelectNode();
    }, [project, selectedNodeId, createAndSelectNode]);

    const currentNode = project && selectedNodeId
        ? project.nodes.find((n) => n.id === selectedNodeId) ?? null
        : null;

    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (activeField === "title" && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [activeField, currentNode?.id]);

    useEffect(() => {
        if (activeField === "text" && textAreaRef.current) {
            textAreaRef.current.focus();
            textAreaRef.current.select();
        }
    }, [activeField, currentNode?.id]);

    if (!currentNode) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                Preparando la escena…
            </div>
        );
    }

    const toggleField = (field: SceneToggleFieldId) => setActiveField((current) => (current === field ? null : field));

    const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const trimmed = event.currentTarget.value.trim();
            updateSelectedNodeFields({ title: trimmed });
            setActiveField(null);
        }
    };

    const handleImageButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        /*if (!file.type.startsWith("image/")) {
            alert("Por favor, selecciona un archivo de imagen válido.");
            event.target.value = "";
            return;
        }*/

        const url = URL.createObjectURL(file);
        updateSelectedNodeFields({ image: url });
    };

    return (
        <div className="flex flex-col md:flex-row gap-3 min-h-[420px] md:min-h-[600px]">
            <section className="w-full md:max-w-md bg-slate-800 border border-slate-700 rounded-lg
                            md:h-full md:overflow-y-auto p-3 space-y-3 text-center">
                <h4 className="text-base font-semibold text-slate-100">
                    Datos de la escena
                </h4>

                <div className="space-y-2 text-sm text-slate-200">
                    <ToggleFieldBlock
                        label="Título"
                        active={activeField === "title"}
                        onToggle={() => toggleField("title")}
                    >
                        <div className="pt-2">
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={currentNode.title}
                                onChange={(e) => updateSelectedNodeFields({ title: e.target.value })}
                                onKeyDown={handleTitleKeyDown}
                                className="text-center w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                placeholder="Ej: Entrada al bosque"
                            />
                        </div>
                    </ToggleFieldBlock>

                    <ToggleFieldBlock
                        label="Texto"
                        active={activeField === "text"}
                        onToggle={() => toggleField("text")}
                    >
                        <div className="pt-2">
                            <div className="relative">
                                <textarea
                                    ref={textAreaRef}
                                    value={currentNode.text}
                                    onChange={(e) => updateSelectedNodeFields({ text: e.target.value })}
                                    className="w-full h-32 rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 pr-9 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500 resize-none overflow-y-auto"
                                    placeholder="Escribe aquí el texto de la escena…"
                                />
                                <button
                                    type="button"
                                    onClick={() => setActiveField(null)}
                                    className="absolute bottom-2 right-2 p-1 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white"
                                    title="Marcar texto como listo"
                                >
                                    <CheckCircleIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </ToggleFieldBlock>

                    <ToggleFieldBlock
                        label="Imagen"
                        active={activeField === "image"}
                        onToggle={() => toggleField("image")}
                    >
                        <div className="pt-2 flex flex-col items-center gap-2">
                            <button
                                type="button"
                                onClick={handleImageButtonClick}
                                className="px-3 py-1.5 rounded-md border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-100"
                            >
                                Seleccionar imagen…
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                //accept="image/*"
                                className="hidden"
                                onChange={handleImageChange}
                            />

                            {currentNode.image && (
                                <span className="text-[11px] text-slate-500 text-center">
                                    Imagen seleccionada.
                                </span>
                            )}
                        </div>
                    </ToggleFieldBlock>

                    <ToggleFieldBlock
                        label="Hotspots"
                        active={activeField === "hotspots"}
                        onToggle={() => toggleField("hotspots")}
                    >
                        <p className="text-xs text-slate-400 mb-1 pt-2">
                            En esta primera versión solo permitiremos acciones de tipo{" "}
                            <span className="font-mono">goToNode</span>.
                        </p>
                    </ToggleFieldBlock>

                    <ToggleFieldBlock
                        label="Etiquetas"
                        active={activeField === "tags"}
                        onToggle={() => toggleField("tags")}
                    >
                        <p className="text-xs text-slate-400 pt-2">
                            Aquí podrás añadir etiquetas asociadas a esta escena.
                        </p>
                    </ToggleFieldBlock>

                    <div className="mt-2 border border-slate-800 rounded-md bg-slate-950/60 px-3 py-2">
                        <div className="flex items-center justify-center gap-10">
                            <SceneTypeButton
                                active={!!currentNode.isStart}
                                label="Inicio"
                                icon={FlagIcon}
                                onClick={() => {
                                    if (currentNode.isStart) {
                                        updateSelectedNodeFields({ isStart: false });
                                    } else {
                                        updateSelectedNodeFields({
                                            isStart: true,
                                            isFinal: false,
                                        });
                                    }
                                }}
                            />
                            <SceneTypeButton
                                active={!!currentNode.isFinal}
                                label="Final"
                                icon={StopCircleIcon}
                                onClick={() => {
                                    if (currentNode.isFinal) {
                                        updateSelectedNodeFields({ isFinal: false });
                                    } else {
                                        updateSelectedNodeFields({
                                            isStart: false,
                                            isFinal: true,
                                        });
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
            </section>

            <section className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-3">
                <div className="relative w-full h-full min-h-[280px] rounded-md border border-slate-700 bg-slate-950/60 overflow-hidden flex flex-col">
                    <div className="relative flex-1">
                        {currentNode.image ? (
                            <img
                                src={currentNode.image}
                                alt="Escena"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center px-4">
                                <span className="text-xs text-slate-500 text-center">
                                    Aquí se mostrará la imagen.
                                </span>
                            </div>
                        )}

                        {currentNode.title && (
                            <div
                                className="absolute top-3 inset-x-4 overflow-hidden text-center opacity-25"
                            >
                                <div
                                    className={[
                                        "inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow",
                                        currentNode.title.length > 80
                                            ? "animate-[scene-title-marquee_16s_linear_infinite]"
                                            : ""
                                    ].join(" ")}
                                >
                                    {currentNode.title}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="w-full bg-slate-950/85 border-t border-slate-700 px-4 py-3 h-20 md:h-20 overflow-y-auto">
                        {currentNode.text ? (
                            <p className="text-slate-100 text-sm whitespace-pre-line text-left">
                                {currentNode.text}
                            </p>
                        ) : (
                            <p className="text-slate-500 text-xs text-center">
                                El texto de la escena se mostrará aquí.
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}

interface ToggleFieldBlockProps {
    label: string;
    active: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function ToggleFieldBlock({ label, active, onToggle, children }: ToggleFieldBlockProps) {
    const containerClasses = "border rounded-md bg-slate-950/60 border-slate-800"
    const headerClasses = "w-full px-3 py-2 text-sm font-semibold text-center transition-colors text-slate-100"

    return (
        <div className={containerClasses}>
            <button
                type="button"
                onClick={onToggle}
                className={headerClasses}
            >
                {label}
            </button>

            {active && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-800 bg-slate-950/80">
                    {children}
                </div>
            )}
        </div>
    );
}

interface SceneTypeButtonProps {
    active: boolean;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    onClick: () => void;
}

function SceneTypeButton({ active, label, icon: Icon, onClick }: SceneTypeButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs",
                active
                    ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
                    : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
            ].join(" ")}
        >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
        </button>
    );
}