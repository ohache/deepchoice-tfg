import { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ItemDef } from "@/domain/types";
import { useResolvedSceneImage } from "@/features/editor/components/scene/SceneCommon";
import { type ItemFieldErrors, validateItemDraft } from "@/features/editor/validation/itemValidator";
import { DeleteProjectEntityModal } from "@/features/editor/components/modals/DeleteProjectEntityModal";

type DraftMode = "none" | "new" | "edit";
type FileStatus = "idle" | "loading" | "ready";

export function HistoryItemsPanel() {
    const project = useEditorStore((s) => s.project);

    const addItemDef = useEditorStore((s) => s.addItemDef);
    const updateItemDef = useEditorStore((s) => s.updateItemDef);
    const removeItemDef = useEditorStore((s) => s.removeItemDef);

    /* UI State */
    const [mode, setMode] = useState<DraftMode>("none");
    const selectedItemId = useEditorStore((s) => s.selectedItemId);
    const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);

    /* Draft fields */
    const [draftName, setDraftName] = useState("");
    const [draftDescription, setDraftDescription] = useState("");
    const [draftImageFile, setDraftImageFile] = useState<File | null>(null);
    const [draftImageFileName, setDraftImageFileName] = useState<string>("");

    /* Validation */
    const [fieldErrors, setFieldErrors] = useState<ItemFieldErrors>({});

    /* File loading */
    const [fileStatus, setFileStatus] = useState<FileStatus>("idle");
    const [isDragging, setIsDragging] = useState(false);

    /* Preview imagen */
    const [previewLogicalPath, setPreviewLogicalPath] = useState<string | undefined>(undefined);
    const previewUrl = useResolvedSceneImage(previewLogicalPath);

    /* Refs */
    const nameInputRef = useRef<HTMLInputElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const items = project?.items ?? [];

    const selectedItem =
        selectedItemId && project
            ? project.items.find((it) => it.id === selectedItemId) ?? null
            : null;

    const rightTitle =
        mode === "new" ? "Nuevo item"
            : mode === "edit" ? "Editar item"
                : "Detalle de item";

    /* Delete modal */
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        if (!project || !selectedItemId) return;
        const item = project.items.find((it) => it.id === selectedItemId);
        if (!item) return;

        setMode("edit");
        setDraftName(item.name);
        setDraftDescription(item.description ?? "");
        setDraftImageFile(null);
        setDraftImageFileName(item.image?.split("/").pop() ?? "");
        setFieldErrors({});
        setFileStatus(item.image ? "ready" : "idle");
        setPreviewLogicalPath(item.image);
    }, [project, selectedItemId]);

    const resetDraft = () => {
        setMode("none");
        setSelectedItemId(null);

        setDraftName("");
        setDraftDescription("");
        setDraftImageFile(null);
        setDraftImageFileName("");
        setFieldErrors({});
        setFileStatus("idle");
        setPreviewLogicalPath(undefined);
    };

    const startNewItem = () => {
        resetDraft();
        setMode("new");
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const handleListClick = (item: ItemDef) => {
        if (item.id === selectedItemId) {
            resetDraft();
            return;
        }
        setSelectedItemId(item.id);
    };

    const processIncomingFile = (file: File) => {
        const validExt = /\.(png|jpg|jpeg|webp)$/i.test(file.name);

        if (!validExt) {
            setFieldErrors((prev) => ({
                ...prev,
                imageFile: "Formato no válido. Usa .png, .jpg, .jpeg o .webp.",
            }));
            setDraftImageFile(null);
            setFileStatus("idle");
            setPreviewLogicalPath(undefined);
            return;
        }

        setFieldErrors((prev) => ({ ...prev, imageFile: undefined }));
        setDraftImageFile(file);
        setDraftImageFileName(file.name);
        setFileStatus("loading");

        const url = URL.createObjectURL(file);
        setPreviewLogicalPath(url);
        setFileStatus("ready");
    };

    useEffect(() => {
        return () => {
            if (previewLogicalPath?.startsWith("blob:")) {
                URL.revokeObjectURL(previewLogicalPath);
            }
        };
    }, [previewLogicalPath]);

    const handleFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const file = evt.target.files?.[0] ?? null;
        if (file) processIncomingFile(file);
        evt.target.value = "";
    };

    const handleDragOver = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (evt: React.DragEvent<HTMLDivElement>) => {
        evt.preventDefault();
        setIsDragging(false);

        const file = evt.dataTransfer.files?.[0];
        if (file) processIncomingFile(file);
    };

    const validateDraft = (): boolean => {
        if (!project) return false;

        const { ok, errors } = validateItemDraft(
            {
                name: draftName,
                description: draftDescription,
                imageFile: draftImageFile,
            },
            {
                mode: mode === "edit" ? "edit" : "new",
                project,
                currentItemId: selectedItemId ?? undefined,
            }
        );

        setFieldErrors(errors);
        return ok;
    };

    const handleSave = () => {
        if (!validateDraft()) return;

        const name = draftName.trim();
        const description = draftDescription.trim();

        if (mode === "new") {
            const id = addItemDef({
                name,
                description,
                imageFile: draftImageFile ?? undefined,
            });

            if (id) resetDraft();
            return;
        }

        if (mode === "edit" && selectedItemId) {
            updateItemDef(selectedItemId, {
                name,
                description,
                imageFile: draftImageFile ?? undefined,
            });
            resetDraft();
        }
    };

    const handleDeleteClick = () => {
        if (selectedItemId) setIsDeleteModalOpen(true);
    }

    const handleConfirmDelete = () => {
        if (selectedItemId) removeItemDef(selectedItemId);
        resetDraft();
        setIsDeleteModalOpen(false);
    };

    const handleCancelDelete = () => setIsDeleteModalOpen(false);

    return (
        <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex gap-4 h-full">
                {/* Columna izquierda: lista + botón añadir */}
                <aside className="w-2/5 border border-black rounded-lg bg-slate-950 flex flex-col">
                    <button
                        type="button"
                        onClick={startNewItem}
                        className="px-3 py-2 text-base font-semibold bg-orange-950 hover:bg-orange-900 text-white rounded-t-lg"
                    >
                        + Añadir item
                    </button>

                    <div className="flex-1 overflow-y-auto text-[15px]">
                        {items.length === 0 ? (
                            <p className="p-4 text-[11px] text-slate-320 text-center">
                                Aún no hay items en el proyecto
                            </p>
                        ) : (
                            <ul className="divide-y-2 divide-slate-700">
                                {items.map((it) => {
                                    const isSelected = it.id === selectedItemId;
                                    return (
                                        <li key={it.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleListClick(it)}
                                                className={[
                                                    "w-full text-left px-6 py-3 text-[15px]",
                                                    isSelected
                                                        ? "bg-orange-950 text-slate-50"
                                                        : "hover:bg-slate-900 text-slate-200",
                                                ].join(" ")}
                                            >
                                                <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {it.name}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </aside>

                {/* Columna derecha: formulario del item */}
                <section className="relative flex-1 border border-slate-800 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
                    {mode !== "none" && (
                        <img
                            src="/ui/item-watermark.png"
                            alt=""
                            className="px-3 pointer-events-none absolute left-1/12 top-19/40 -translate-y-1/2 scale-125 opacity-[0.05]"
                            draggable="false"
                        />
                    )}

                    <div className="relative z-10 bg-orange-950 border-b border-orange-950 rounded-t-lg px-4 py-2">
                        <h4 className="text-base font-semibold text-center text-white m-0">
                            {rightTitle}
                        </h4>
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                        {mode === "none" ? (
                            <p className="text-[11px] text-slate-200 text-center">
                                Selecciona un item en la lista de la izquierda o pulsa{" "}
                                <span className="font-semibold">“Añadir item”</span> para crear uno nuevo
                            </p>
                        ) : (
                            <>
                                {/* Nombre */}
                                <div className="mb-2">
                                    <label className="block text-[13px] text-slate-200 mb-1 text-center">Nombre</label>
                                    <input
                                        ref={nameInputRef}
                                        type="text"
                                        value={draftName}
                                        onChange={(e) => setDraftName(e.target.value)}
                                        className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                        placeholder="Ej: Llave oxidada"
                                    />
                                    {fieldErrors.name && (
                                        <p className="form-field-error mt-1">{fieldErrors.name}</p>
                                    )}
                                </div>

                                {/* Descripción */}
                                    <div className="mb-2">
                                        <label className="block text-[13px] text-slate-200 mb-1 text-center">Descripción</label>
                                        <textarea
                                            value={draftDescription}
                                            onChange={(e) => setDraftDescription(e.target.value)}
                                            className="w-full min-h-[90px] rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-fuchsia-500"
                                            placeholder="Texto que se mostrará al mirar el objeto…"
                                        />
                                        {fieldErrors.description && (
                                            <p className="form-field-error mt-1">{fieldErrors.description}</p>
                                        )}
                                    </div>

                                {/* Imagen */}
                                <div className="mb-2 mt-2">
                                    <label className="block text-[13px] text-slate-200 mb-1 text-center">
                                        Imagen del item
                                    </label>

                                    <div
                                        className={[
                                            "mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px]",
                                            "transition-colors duration-150 border-2 border-dashed cursor-pointer",
                                            isDragging
                                                ? "border-orange-600 bg-amber-950/40"
                                                : "border-orange-950 bg-slate-900/40 hover:bg-slate-800",
                                        ].join(" ")}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <p className="mb-2 text-slate-300 text-center">
                                            Arrastra aquí una imagen
                                            <span className="block text-[11px] text-slate-500">
                                                (o haz clic para seleccionarla)
                                            </span>
                                        </p>

                                        <button
                                            type="button"
                                            className="px-3 py-1.5 rounded-md border-2 border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                fileInputRef.current?.click();
                                            }}
                                        >
                                            Seleccionar…
                                        </button>
                                    </div>

                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />

                                    <p className="mt-2 text-[11px] text-slate-400 break-all text-center">
                                        {draftImageFile
                                            ? `Archivo seleccionado: ${draftImageFile.name}`
                                            : mode === "edit" && selectedItemId
                                                ? `Archivo seleccionado: ${draftImageFileName || "—"}`
                                                : "No hay archivo seleccionado"}
                                    </p>

                                    {fieldErrors.imageFile && (
                                        <p className="form-field-error mt-1">{fieldErrors.imageFile}</p>
                                    )}
                                </div>

                                {/* Estado de carga */}
                                {fileStatus !== "idle" && (
                                    <div className="mt-1 text-[11px] text-slate-400 flex justify-center mb-2">
                                        {fileStatus === "loading" && (
                                            <>
                                                <span className="inline-block h-3 w-3 rounded-full border border-slate-400 border-t-transparent animate-spin text-center" />
                                                <span>Cargando imagen…</span>
                                            </>
                                        )}
                                        {fileStatus === "ready" && (
                                            <span className="inline-flex items-center gap-1 text-emerald-400">
                                                <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                                                <span>Imagen lista</span>
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* Preview */}
                                <div className="mt-2 mb-6 flex justify-center">
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt=""
                                            className="max-h-40 max-w-full rounded-md border border-slate-700 bg-slate-900 object-contain"
                                            draggable={false}
                                        />
                                    ) : (
                                        <div className="h-40 w-full rounded-md border border-slate-800 bg-slate-900/40 flex items-center justify-center text-[11px] text-slate-500">
                                            No hay imagen cargada
                                        </div>
                                    )}
                                </div>

                                {/* Botones inferiores */}
                                <div className="mt-auto flex justify-between">
                                        <button
                                            type="button"
                                            onClick={handleDeleteClick}
                                            disabled={!selectedItemId}
                                            className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-[12px] font-semibold text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Eliminar item
                                        </button>

                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={resetDraft}
                                            className="px-4 py-2 rounded-md bg-slate-700 hover:bg-slate-600 text-[12px] text-slate-100"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 text-[12px] font-semibold text-white"
                                        >
                                            Guardar item
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>

            <DeleteProjectEntityModal
                open={isDeleteModalOpen}
                title="Eliminar item"
                entityName={selectedItem?.name ?? ""}
                description="Esta acción lo quitará del proyecto y dejará de estar disponible para las escenas que lo usen."
                onConfirm={handleConfirmDelete}
                onCancel={handleCancelDelete}
            />
        </div>
    );
}
