import { useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { useGameStore } from "@/store/gameStore";
import { loadProjectFromDirectory } from "@/services/projectDirectoryLoader";
import { CreateAdventureModal } from "@/features/home/components/CreateAdventureModal";
import { UserManualModal } from "@/features/home/components/UserManualModal";
import { PencilSquareIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Joystick, LightbulbIcon } from "lucide-react";
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
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="home-card">
        <div className="flex items-center justify-center mb-6">
          <img
            src="/logo.png"
            alt="Logo"
            className="h-32 w-32 rounded-2xl border-3 border-white object-contain"
          />
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-center mb-3">
          Bienvenido a
          <span className="block text-2xl text-fuchsia-500">Crea tu propia aventura</span>
        </h1>

        <p className="text-center mb-4">Diseña, edita y juega historias interactivas</p>

        <div className="flex flex-col gap-2 mb-4">
          <button
            type="button"
            onClick={handleCreate}
            className="btn-home bg-emerald-600 hover:bg-emerald-500"
          >
            <LightbulbIcon className="btn-icon-left" />
            Crear
          </button>

          <button
            type="button"
            onClick={handleEdit}
            className="btn-home bg-sky-600 hover:bg-sky-500"
          >
            <PencilSquareIcon className="btn-icon-left" />
            Editar
          </button>

          <button
            type="button"
            onClick={handlePlay}
            className="btn-home bg-yellow-600 hover:bg-yellow-500"
          >
            <Joystick className="btn-icon-left" />
            Jugar
          </button>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setIsManualOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-[15px] font-medium border-2 border-black 
             bg-gray-600 hover:bg-gray-500 transition duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
          >
            <DocumentTextIcon className="w-4.5 h-4.5 text-slate-300 relative -left-[3px] -top-[1.5px]" />
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