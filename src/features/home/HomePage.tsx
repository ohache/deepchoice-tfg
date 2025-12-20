import { useState, useRef, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { useGameStore } from "@/store/gameStore";
import { UserManualModal } from "@/features/home/components/UserManualModal";
import { CreateAdventureModal } from "@/features/home/components/CreateAdventureModal";
import { PlusCircleIcon, PencilSquareIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { loadProjectFromDirectory } from "@/services/projectDirectoryLoader";
import { normalizeProject } from "@/domain/normalize/normalizeProject";

type LoadMode = "edit" | "play" | null;

function validateProjectTitle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "El título no puede estar vacío.";
  if (trimmed.length > 100) return "El título no puede tener más de 100 caracteres.";
  return null;
}

export function HomePage() {
    const navigate = useNavigate();

    const [isManualOpen, setIsManualOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [loadMode, setLoadMode] = useState<LoadMode>(null);

    const [titleError, setTitleError] = useState<string | null>(null);
    
    const folderInputRef = useRef<HTMLInputElement | null>(null);
    const startGame = useGameStore((state) => state.startGame);

    /* Crear */
    const handleCreate = () => {
        setNewTitle("");
        setTitleError(null); 
        setIsCreateModalOpen(true);
    };

    const handleConfirmCreate = () => {
        const error = validateProjectTitle(newTitle);
        if (error) {
            setTitleError(error);
            return;
        }

        setTitleError(null);

        const trimmed = newTitle.trim();
        useEditorStore.getState().resetEditor();
        useEditorStore.getState().initNewProject(trimmed);

        setIsCreateModalOpen(false);
        setNewTitle("");
        navigate("/editor");
    };

    const handleCancelCreate = () => {
        setIsCreateModalOpen(false);
        setNewTitle("");
        setTitleError(null);   
    };

    /* Editar */
    const handleEdit = () => {
        setLoadMode("edit");
        folderInputRef.current?.click();
    };

    /* Jugar */
    const handlePlay = () => {
        setLoadMode("play");
        folderInputRef.current?.click();
    };

    const handleFolderChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        try {
            const { project: rawProject, files: allFiles } = await loadProjectFromDirectory(files);
            const project = normalizeProject(rawProject);

            if (loadMode === "edit") {
                useEditorStore.getState().loadProjectFromDirectory(project, allFiles);
                navigate("/editor");
            } else if (loadMode === "play") {
                startGame(project, allFiles);
                navigate("/play");
            }
        } catch (error: any) {
            alert(error.message ?? "No se ha podido cargar el proyecto.");
        } finally {
            event.target.value = "";
            setLoadMode(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
            <div className="home-card">
                <div className="flex items-center justify-center mb-6">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-32 w-32 rounded-2xl border-4 border-black object-contain"
                    />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-center mb-3">
                    Bienvenido a
                    <span className="block text-fuchsia-700">
                        Crea tu propia aventura
                    </span>
                </h1>

                <p className="text-center text-slate-300 mb-6">
                    Diseña, edita y juega historias interactivas
                </p>

                <div className="flex flex-col gap-3 mb-6">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="btn-home bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
                    >
                        <PlusCircleIcon className="btn-icon-left" />
                        Crear
                    </button>

                    <button
                        type="button"
                        onClick={handleEdit}
                        className="btn-home bg-sky-600 hover:bg-sky-500 active:bg-sky-700"
                    >
                        <PencilSquareIcon className="btn-icon-left" />
                        Editar
                    </button>

                    <button
                        type="button"
                        onClick={handlePlay}
                        className="btn-home bg-amber-600 hover:bg-amber-500 active:bg-amber-700"
                    >
                        <PlayCircleIcon className="btn-icon-left" />
                        Jugar
                    </button>
                </div>

                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => setIsManualOpen(true)}
                        className="link-underline"
                    >
                        <span>Manual de usuario</span>
                    </button>
                </div>
            </div>

            {/* Modal: crear nueva aventura */}
            <CreateAdventureModal
                open={isCreateModalOpen}
                title={newTitle}
                onTitleChange={(value) => {
                    setNewTitle(value);
                    setTitleError(validateProjectTitle(value));
                }}
                onConfirm={handleConfirmCreate}
                onCancel={handleCancelCreate}
                titleError={titleError}
            />

            {/* Input de carpeta del proyecto */}
            <input
                ref={folderInputRef}
                type="file"
                //@ts-expect-error webkitdirectory no está en el tipo estándar
                webkitdirectory="true"
                multiple
                className="hidden"
                onChange={handleFolderChange}
            />

            {/* Modal: manual de usuario */}
            <UserManualModal
                open={isManualOpen}
                onClose={() => setIsManualOpen(false)}
            />
        </div>
    );
}