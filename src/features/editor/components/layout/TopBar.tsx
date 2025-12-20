import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUturnLeftIcon, ArrowUturnRightIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useEditorStore } from "@/store/editorStore";
import type { EditorPrimaryMode } from "@/features/editor/core/editorModes";
import { downloadProjectJson, exportProjectAsZip } from "@/features/editor/utils/editorPersistence";
import { ExitWithoutSaveModal } from "@/features/editor/components/modals/ExitWithoutSaveModal";
import { createCommitCancelKeyHandler } from "@/utils/keyboard";

interface TopBarProps {
    onPlayRequested: () => void;
}

const PRIMARY_TABS: { id: EditorPrimaryMode; label: string }[] = [
    { id: "historia", label: "Historia" },
    { id: "escena", label: "Escena" },
    { id: "test", label: "Test" },
];

function getValidationIndicator( validationStatus: "idle" | "ok" | "warning" | "error",
        errorCount: number,isDirty: boolean ): { statusColor: string; statusText: string } {
    let statusColor = "bg-slate-500";
    let statusText = "Sin validar";
  
    if (validationStatus === "error" || errorCount > 0) {
      statusColor = "bg-red-500";
      statusText = `Errores (${errorCount})`;
    } else if (isDirty) {
      statusColor = "bg-amber-400";
      statusText = "Cambios sin guardar";
    } else if (validationStatus === "ok") {
      statusColor = "bg-emerald-400";
      statusText = "Validado";
    } else if (validationStatus === "warning") {
      statusColor = "bg-amber-500";
      statusText = `Avisos (${errorCount})`;
    }
  
    return { statusColor, statusText };
  }

export function TopBar({ onPlayRequested }: TopBarProps) {
    const navigate = useNavigate();

    const assetFiles = useEditorStore((s) => s.assetFiles);
    const project = useEditorStore((s) => s.project);
    const primaryMode = useEditorStore((s) => s.primaryMode);
    const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
    const updateProjectTitle = useEditorStore((s) => s.updateProjectTitle);
    const isDirty = useEditorStore((s) => s.isDirty);
    const validationStatus = useEditorStore((s) => s.validationStatus);
    const errorCount = useEditorStore((s) => s.errorCount);
    const markSaved = useEditorStore((s) => s.markSaved);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(project!.title);

    const [isExitModalOpen, setIsExitModalOpen] = useState(false);

    const zoom = useEditorStore((s) => s.zoom);
    const zoomIn = useEditorStore((s) => s.zoomIn);
    const zoomOut = useEditorStore((s) => s.zoomOut);
    const zoomReset = useEditorStore((s) => s.zoomReset);

    if (!project) return null;

    const projectTitle = project.title;

    useEffect(() => {
        if (!isEditingTitle) {
            setTempTitle(projectTitle);
            document.title = projectTitle;
        }
    }, [projectTitle, isEditingTitle]);

    const handleModeClick = (mode: EditorPrimaryMode) => {
        if (mode === primaryMode) return;
        setPrimaryMode(mode);
    };

    const handlePlayClick = () => onPlayRequested();

    const commitTitle = () => {
        const trimmed = tempTitle.trim();
        const finalTitle = trimmed || projectTitle;
        updateProjectTitle(finalTitle);
        setIsEditingTitle(false);
    };

    const handleTitleKeyDown = createCommitCancelKeyHandler(commitTitle, () => {
        setIsEditingTitle(false);
        setTempTitle(projectTitle);
    });

    const { statusColor, statusText } = getValidationIndicator(
        validationStatus,
        errorCount,
        isDirty
      );

    const handleSaveClick = () => {
        try {
            downloadProjectJson(project);
            markSaved();
            console.log("Aventura guardada en este navegador."); // toast
        } catch (error: any) {
            alert(error.message ?? "No se ha podido guardar el project.json.");
        }
    };

    const handleExportClick = async () => {
        try {
            await exportProjectAsZip(project, assetFiles);
        } catch (error: any) {
            alert(error.message ?? "No se ha podido exportar el proyecto a ZIP.");
        }
  };

    const resetDocumentTitle = () => document.title = "Crea tu propia aventura";

    const handleLogoClick = () => {
        if (!isDirty) {
            resetDocumentTitle();
            navigate("/");
            return;
        }
        setIsExitModalOpen(true);
    };

    const handleExitWithoutSave = () => {
        setIsExitModalOpen(false);
        resetDocumentTitle();
        navigate("/");
    };

    const handleExitSaveAndGo = () => {
        handleSaveClick();                              
        setIsExitModalOpen(false);
        resetDocumentTitle();
        navigate("/");
    };

    return (
        <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 gap-10">
            {/* Tabs + Jugar */}
            <div className="flex items-center gap-3">
                <nav className="flex items-center gap-2">
                    {PRIMARY_TABS.map((tab) => {
                        const isActive = primaryMode === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleModeClick(tab.id)}
                                className={[
                                    "px-3 py-1.5 rounded-lg text-base transition-colors",
                                    isActive
                                        ? "bg-slate-700 text-white"
                                        : "text-slate-300 hover:text-slate-100 hover:bg-slate-800/60",
                                ].join(" ")}
                            >
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>

                <button
                    type="button"
                    onClick={handlePlayClick}
                    className="ml-2 px-3 py-1.5 rounded-lg text-base btn-primary-adventure"
                >
                    Jugar
                </button>
            </div>
            
            {/* Controles de guardado / zoom / estado / título / logo */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={handleSaveClick}
                        className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
                        title="Guardar aventura"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleExportClick}
                        className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
                        title="Exportar a JSON"
                    >
                        <ArrowUpTrayIcon className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-1 text-sm text-white">
                    <button
                        type="button"
                        onClick={zoomOut}
                        className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600"
                    >
                        -
                    </button>
                    <button
                        type="button"
                        onClick={zoomReset}
                        className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 min-w-12 text-center"
                    >
                        {zoom}%
                    </button>
                    <button
                        type="button"
                        onClick={zoomIn}
                        className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600"
                    >
                        +
                    </button>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        disabled
                        className="p-1.5 rounded-md bg-slate-700 cursor-not-allowed"
                        title="Deshacer (no disponible aún)"
                    >
                        <ArrowUturnLeftIcon className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        disabled
                        className="p-1.5 rounded-md bg-slate-700 cursor-not-allowed"
                        title="Rehacer (no disponible aún)"
                    >
                        <ArrowUturnRightIcon className="w-4 h-4" />
                    </button>
                </div>

                <div
                    className="flex items-center"
                    title={statusText}
                >
                    <span className={`w-3 h-3 rounded-full ${statusColor}`} />
                </div>

                <div className="flex items-center max-w-xs gap-2 text-white text-base">
                    {isEditingTitle ? (
                        <input
                            type="text"
                            autoFocus
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={commitTitle}
                            onKeyDown={handleTitleKeyDown}
                            className="w-full bg-slate-900 border-b-2 border-fuchsia-600 focus:outline-none px-1 pb-0.5"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsEditingTitle(true)}
                            className="hover:text-fuchsia-400 truncate text-right"
                            title="Editar título de la aventura"
                        >
                            {projectTitle}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleLogoClick}
                        className="shrink-0"
                        title={isDirty ? "Volver al inicio (hay cambios sin guardar)" : "Volver al inicio"}
                    >
                        <img
                            src="/logo.png"
                            alt="Volver al inicio"
                            className="w-9 h-9 rounded-lg border border-slate-700 bg-slate-900 object-contain"
                        />
                    </button>
                </div>
            </div>

            <ExitWithoutSaveModal
                open={isExitModalOpen}
                onCancel={() => setIsExitModalOpen(false)}
                onExitWithoutSave={handleExitWithoutSave}
                onExitSaveAndGo={handleExitSaveAndGo}
            />

        </header>
    );
}
