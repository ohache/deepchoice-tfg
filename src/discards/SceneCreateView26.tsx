import type React from "react";
import { useState, useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editorStore";
import { DeleteSceneModal } from "@/features/editor/components/modals/DeleteSceneModal";
import { CheckCircleIcon, FlagIcon, StopCircleIcon, PlusCircleIcon, TrashIcon } from "@heroicons/react/24/outline";

type SceneToggleFieldId = "title" | "text" | "image" | "hotspots" | "tags";

export function SceneCreateView() {
    const project = useEditorStore((s) => s.project);
    const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
    const sceneMode = useEditorStore((s) => s.sceneMode);

    const createNodeFromDraft = useEditorStore((s) => s.createNodeFromDraft);
    const updateSelectedNodeFields = useEditorStore((s) => s.updateSelectedNodeFields);
    const addHotspotToSelectedNode = useEditorStore((s) => s.addHotspotToSelectedNode);
    const updateHotspotTarget = useEditorStore((s) => s.updateHotspotTarget);
    const removeHotspotFromSelectedNode = useEditorStore((s) => s.removeHotspotFromSelectedNode);
    const deleteSelectedNode = useEditorStore((s) => s.deleteSelectedNode);
    const registerAssetFile = useEditorStore((s) => s.registerAssetFile)
    const assetFiles = useEditorStore((s) => s.assetFiles);

    const buildBackgroundPath = (fileName: string): string => `assets/backgrounds/${fileName}`;

    const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
    const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);
    const setSceneMode = useEditorStore((s) => s.setSceneMode);

    const [activeField, setActiveField] = useState<SceneToggleFieldId | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [draftTitle, setDraftTitle] = useState("");
    const [draftText, setDraftText] = useState("");
    const [draftImage, setDraftImage] = useState<string | undefined>(undefined);
    const [draftIsStart, setDraftIsStart] = useState(false);
    const [draftIsFinal, setDraftIsFinal] = useState(false);

    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

    const [resolvedImageUrl, setResolvedImageUrl] = useState<string | undefined>(undefined);

    const titleInputRef = useRef<HTMLInputElement | null>(null);
    const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const currentNode = sceneMode === "editing" && project && selectedNodeId
            ? project.nodes.find((n) => n.id === selectedNodeId) ?? null
            : null;

    const isEditing = sceneMode === "editing" && !!currentNode;
    const canEditHotspots = sceneMode === "editing" && !!currentNode && !!project;

    const previewTitle = sceneMode === "editing" && currentNode ? currentNode.title : draftTitle;
    const previewText = sceneMode === "editing" && currentNode ? currentNode.text : draftText;
    const previewImage = sceneMode === "editing" && currentNode ? currentNode.image : draftImage;
    
    useEffect(() => {
        setDraftTitle("");
        setDraftText("");
        setDraftImage(undefined);

        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
            setImagePreviewUrl(null);
        }

        setDraftIsStart(false);
        setDraftIsFinal(false);
    }, [project?.id]);

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

    useEffect(() => {
        const logicalPath = sceneMode === "editing" ? currentNode?.image : draftImage;

        if (!logicalPath) {
            setResolvedImageUrl(undefined);
            return;
        }

        const file = assetFiles[logicalPath];

        if (!file) {
            setResolvedImageUrl(logicalPath);
            return;
        }

        const objectUrl = URL.createObjectURL(file);
        setResolvedImageUrl(objectUrl);

        return () => { URL.revokeObjectURL(objectUrl);};
    }, [sceneMode, currentNode?.image, draftImage, assetFiles]);


    if (sceneMode === "editing" && !currentNode) {
        return (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                No se ha encontrado la escena seleccionada. Elige una escena desde
                &quot;Listar&quot; o cambia a modo &quot;Crear&quot;.
            </div>
        );
    }

    const toggleField = (field: SceneToggleFieldId) => setActiveField((current) => (current === field ? null : field));

    const goToHistoriaVista = () => {
        setPrimaryMode("historia");
        setSecondaryMode("vista");
        setSceneMode("creating"); 
    };

    const handleTitleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (sceneMode === "editing" && currentNode) {
                const trimmed = event.currentTarget.value.trim();
                updateSelectedNodeFields({ title: trimmed });
            }
            setActiveField(null);
        }
  };

    const handleImageButtonClick = () => fileInputRef.current?.click();

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const relativePath = buildBackgroundPath(file.name);

        if (sceneMode === "editing" && currentNode) {
            updateSelectedNodeFields({ image: relativePath });
        } else {
            setDraftImage(relativePath);
        }

        registerAssetFile(relativePath, file);

        if (imagePreviewUrl) {
            URL.revokeObjectURL(imagePreviewUrl);
        }

        const preview = URL.createObjectURL(file);
        setImagePreviewUrl(preview);
    };


    const handleCreateSceneFromDraft = () => {
        const title = draftTitle.trim();
        if (!title) {
            alert("Introduce un título para la escena.");
            return;
        }

        createNodeFromDraft({
            title,
            text: draftText,
            image: draftImage,
            hotspots: [],         
            musicId: undefined,
            npcIds: [],
            featuredItemId: undefined,
            mapId: undefined,
            isStart: draftIsStart,
            isFinal: draftIsFinal,
            meta: {},
        });

        setDraftTitle("");
        setDraftText("");
        setDraftImage(undefined);
        setDraftIsStart(false);
        setDraftIsFinal(false);
        setActiveField(null);

        goToHistoriaVista();
    };

    const handleDeleteConfirm = () => {
        if (!isEditing) {
            setIsDeleteModalOpen(false);
            return;
        }
        deleteSelectedNode();
        setIsDeleteModalOpen(false);
        setActiveField("title");
        goToHistoriaVista();
    };

    return (
        <>
            <div className="scene-editor-layout">
                <section className="scene-editor-panel-left">
                    <h4 className="text-base font-semibold text-slate-100">
                        {isEditing ? "Editar escena" : "Nueva escena"}
                    </h4>

                    <div className="space-y-2 text-sm text-slate-200">
                        {/* Título */}
                        <ToggleFieldBlock
                            label="Título"
                            active={activeField === "title"}
                            onToggle={() => toggleField("title")}
                        >
                            <div className="pt-2">
                                <input
                                    ref={titleInputRef}
                                    type="text"
                                    value={previewTitle}
                                    onChange={(e) => {
                                        if (isEditing) {
                                            updateSelectedNodeFields({ title: e.target.value });
                                        } else {
                                            setDraftTitle(e.target.value);
                                        }
                                    }}
                                    onKeyDown={handleTitleKeyDown}
                                    className="text-center w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                    placeholder="Ej: Entrada al bosque"
                                />
                            </div>
                        </ToggleFieldBlock>

                        {/* Texto */}
                        <ToggleFieldBlock
                            label="Texto"
                            active={activeField === "text"}
                            onToggle={() => toggleField("text")}
                        >
                            <div className="pt-2">
                                <div className="relative">
                                    <textarea
                                        ref={textAreaRef}
                                        value={previewText}
                                        onChange={(e) => {
                                            if (isEditing) {
                                                updateSelectedNodeFields({ text: e.target.value });
                                            } else {
                                                setDraftText(e.target.value);
                                            }
                                        }}
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

                        {/* Imagen */}
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
                                    className="hidden"
                                    onChange={handleImageChange}
                                />

                                {previewImage && (
                                    <span className="text-[11px] text-slate-500 text-center">
                                        Imagen seleccionada.
                                    </span>
                                )}
                            </div>
                        </ToggleFieldBlock>

                        {/* Hotspots */}
                        <ToggleFieldBlock
                            label="Hotspots"
                            active={activeField === "hotspots"}
                            onToggle={() => toggleField("hotspots")}
                        >
                            <div className="pt-2 space-y-2 text-left">
                                {!canEditHotspots ? (
                                    <p className="text-xs text-slate-400">
                                        Para crear hotspots de navegación necesitas al menos dos escenas en el proyecto.
                                    </p>
                                ) : (
                                    <>
                                        {currentNode.hotspots.length === 0 && (
                                            <p className="text-xs text-slate-400">
                                                Aún no hay hotspots en esta escena. Puedes crear uno para ir a otra escena.
                                            </p>
                                        )}

                                        <div className="space-y-2">
                                            {currentNode!.hotspots.map((hs, index) => {
                                                const firstAction = hs.actions[0];
                                                const currentTargetId =
                                                    firstAction && firstAction.type === "goToNode"
                                                        ? firstAction.targetNodeId
                                                        : "";

                                                return (
                                                    <div key={hs.id} className="scene-hotspot-row">
                                                        <span className="text-[11px] text-slate-400 min-w-[70px]">
                                                            Hotspot {index + 1}
                                                        </span>

                                                        <select
                                                            value={currentTargetId}
                                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateHotspotTarget(hs.id, e.target.value)}
                                                            className="flex-1 bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                                        >
                                                            <option value="">
                                                                Selecciona destino…
                                                            </option>
                                                            {project.nodes
                                                                .filter((node) => node.id !== currentNode!.id)
                                                                .map((node) => (
                                                                    <option key={node.id} value={node.id}>
                                                                        {node.title || node.id}
                                                                    </option>
                                                            ))}
                                                        </select>

                                                        <button
                                                            type="button"
                                                            onClick={() =>removeHotspotFromSelectedNode(hs.id)}
                                                            className="p-1 rounded-md bg-slate-800 hover:bg-red-700/70 text-slate-300 hover:text-white"
                                                            title="Eliminar hotspot"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={addHotspotToSelectedNode}
                                            className="scene-hotspot-add-btn"
                                        >
                                            <PlusCircleIcon className="w-3.5 h-3.5" />
                                            Añadir hotspot
                                        </button>
                                    </>
                                )}
                            </div>
                        </ToggleFieldBlock>

                        {/* Etiquetas */}
                        <ToggleFieldBlock
                            label="Etiquetas"
                            active={activeField === "tags"}
                            onToggle={() => toggleField("tags")}
                        >
                            <p className="text-xs text-slate-400 pt-2">
                                Aquí podrás añadir etiquetas asociadas a esta escena.
                            </p>
                        </ToggleFieldBlock>

                        {/* Inicio / Final */}
                        <div className="scene-type-toggle-container">
                            <div className="flex items-center justify-center gap-10">
                                <SceneTypeButton
                                    active={isEditing ? !!currentNode?.isStart : draftIsStart}
                                    label="Inicio"
                                    icon={FlagIcon}
                                    onClick={() => {
                                        if (isEditing && currentNode) {
                                            if (currentNode.isStart) {
                                                updateSelectedNodeFields({ isStart: false });
                                            } else {
                                                updateSelectedNodeFields({
                                                    isStart: true,
                                                    isFinal: false,
                                                });
                                            }
                                        } else {
                                            setDraftIsStart(prev => {
                                                const next = !prev;
                                                if (next) {
                                                    setDraftIsFinal(false);
                                                }
                                                return next;
                                            });
                                        }
                                    }}
                                />

                                <SceneTypeButton
                                    active={isEditing ? !!currentNode?.isFinal : draftIsFinal}
                                    label="Final"
                                    icon={StopCircleIcon}
                                    onClick={() => {
                                        if (isEditing && currentNode) {
                                            if (currentNode.isFinal) {
                                                updateSelectedNodeFields({ isFinal: false });
                                            } else {
                                                updateSelectedNodeFields({
                                                    isFinal: true,
                                                    isStart: false,
                                                });
                                            }
                                        } else {
                                            setDraftIsFinal(prev => {
                                                const next = !prev;
                                                if (next) {
                                                    setDraftIsStart(false);
                                                }
                                                return next;
                                            });
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Botones inferiores */}
                    <div className="mt-3 flex justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => isEditing && setIsDeleteModalOpen(true)}
                            disabled={!isEditing}
                            className={["px-3 py-1.5 rounded-lg text-xs font-semibold",
                                isEditing
                                    ? "bg-red-700 hover:bg-red-600 text-white"
                                    : "bg-slate-700 text-slate-400 cursor-not-allowed",
                            ].join(" ")}
                        >
                            Eliminar escena
                        </button>

                        <button
                            type="button"
                            onClick={isEditing ? goToHistoriaVista : handleCreateSceneFromDraft}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white"
                        >
                            {isEditing ? "Guardar cambios" : "Crear escena"}
                        </button>
                    </div>
                </section>

                {/* Panel derecho: previsualización */}
                <section className="scene-editor-panel-right">
                    <div className="scene-preview-card">
                        <div className="scene-preview-image-wrapper">
                            {resolvedImageUrl   ? (
                                <>
                                    <img
                                        src={resolvedImageUrl }
                                        alt=""
                                        aria-hidden="true"
                                        className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60 z-0"
                                    />

                                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                                        <img
                                            src={resolvedImageUrl }
                                            alt="Escena"
                                            className="max-w-full max-h-full object-contain drop-shadow"
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="w-full h-full flex items-center justify-center px-4">
                                    <span className="text-xs text-slate-500 text-center">
                                        Aquí se mostrará la imagen de la escena cuando la selecciones.
                                    </span>
                                </div>
                            )}

                            {previewTitle && (
                                <div className="absolute top-3 inset-x-4 overflow-hidden text-center z-20 pointer-events-none">
                                    <div
                                        className={[
                                            "inline-block whitespace-nowrap text-xl font-semibold text-white/80 drop-shadow",
                                            previewTitle.length > 80
                                                ? "animate-[scene-title-marquee_16s_linear_infinite]"
                                                : "",
                                        ].join(" ")}
                                    >
                                        {previewTitle}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="scene-preview-text-box">
                            {previewText? (
                                <p className="text-slate-100 text-sm whitespace-pre-line text-left">
                                    {previewText}
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

            {/* Modal de eliminación */}
            <DeleteSceneModal
                open={isDeleteModalOpen}
                onCancel={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteConfirm}
            />
        </>
    );
}

interface ToggleFieldBlockProps {
    label: string;
    active: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function ToggleFieldBlock({ label, active, onToggle, children }: ToggleFieldBlockProps) {
    const containerClasses = "border rounded-md bg-slate-950/60 border-slate-800";
    const headerClasses = "w-full px-3 py-2 text-sm font-semibold text-center transition-colors text-slate-100";

    return (
        <div className={containerClasses}>
            <button type="button" onClick={onToggle} className={headerClasses}>
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
