import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { useGameStore } from "@/store/gameStore";
import { loadProjectFromDirectory } from "@/services/projectDirectoryLoader";
import { CreateAdventureModal } from "@/features/home/components/CreateAdventureModal";
import { UserManualModal } from "@/features/home/components/UserManualModal";
import { PlusCircleIcon, PencilSquareIcon, PlayCircleIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { toast } from "@/shared/toast/toastStore";


type LoadMode = "edit" | "play" | null;

function validateProjectTitle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "El título no puede estar vacío.";
  if (trimmed.length > 100) return "El título no puede tener más de 100 caracteres.";
  return null;
}

export function HomePage() {
  const navigate = useNavigate();

  const [newTitle, setNewTitle] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadModeRef = useRef<LoadMode | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const startGame = useGameStore((s) => s.startGame);

  /* Crear*/
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

    const trimmed = newTitle.trim();

    const editor = useEditorStore.getState();
    editor.resetEditor();
    editor.initNewProject(trimmed);

    setIsCreateModalOpen(false);
    setNewTitle("");
    setTitleError(null);

    navigate("/editor");
  };

  const handleCancelCreate = () => {
    setIsCreateModalOpen(false);
    setNewTitle("");
    setTitleError(null);
  };

  /* Editar / Jugar */
  function pickProjectDirectory(mode: LoadMode) {
    loadModeRef.current = mode;

    const input = folderInputRef.current;

    if (input) {
      input.value = "";
      input.click();
    }
  }

  const handleEdit = () => pickProjectDirectory("edit");
  const handlePlay = () => pickProjectDirectory("play");

  const handleFolderChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    
    if (!files || files.length === 0) return;

    const mode = loadModeRef.current;

    try {
      const { project, files: allFiles } = await loadProjectFromDirectory(files);

      if (mode === "edit") {
        useEditorStore.getState().loadProjectFromDirectory(project, allFiles);
        navigate("/editor");
        return;
      }

      if (mode === "play") {
        startGame(project, allFiles);
        navigate("/play");
        return;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Revisa que la carpeta contenga un proyecto válido"

      toast.error("No se pudo cargar el proyecto", message );
    } finally {
      event.target.value = "";
      loadModeRef.current = null;
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
          <span className="block text-fuchsia-700">Crea tu propia aventura</span>
        </h1>

        <p className="text-center text-slate-200 mb-6">Diseña, edita y juega historias interactivas</p>

        <div className="flex flex-col gap-3 mb-6">
          <button
            type="button"
            onClick={handleCreate}
            className="btn-home bg-emerald-900 hover:bg-emerald-800 active:bg-emerald-700"
          >
            <PlusCircleIcon className="btn-icon-left" />
            Crear
          </button>

          <button
            type="button"
            onClick={handleEdit}
            className="btn-home bg-sky-900 hover:bg-sky-800 active:bg-sky-700"
          >
            <PencilSquareIcon className="btn-icon-left" />
            Editar
          </button>

          <button
            type="button"
            onClick={handlePlay}
            className="btn-home bg-amber-900 hover:bg-amber-800 active:bg-amber-700"
          >
            <PlayCircleIcon className="btn-icon-left" />
            Jugar
          </button>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsManualOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-medium text-white border-2 border-black 
             bg-gray-600 hover:bg-gray-500 transition duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <DocumentTextIcon className="w-5 h-5 text-slate-300" />
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

      {/* Input oculto: seleccionar carpeta (editor / player) */}
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error webkitdirectory no está en el tipo estándar
        webkitdirectory=""
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