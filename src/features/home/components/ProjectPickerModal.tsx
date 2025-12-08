import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "@/store/gameStore";
import { useEditorStore } from "@/store/editorStore";
import { loadProjectFromFile } from "@/services/projectLoader";
import { getSavedProjectsIndex, loadProjectFromLocalStorage, type ProjectIndexEntry } from "@/features/editor/utils/editorPersistence";

type ProjectPickerMode = "edit" | "play";

interface ProjectPickerModalProps {
  open: boolean;
  mode: ProjectPickerMode;
  onClose: () => void;
}

export function ProjectPickerModal({ open, mode, onClose }: ProjectPickerModalProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [projects, setProjects] = useState<ProjectIndexEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const startGame = useGameStore((state) => state.startGame);
  const editorStoreRef = useRef(useEditorStore.getState());

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      editorStoreRef.current = state;
    });
    return unsub;
  }, []);

  // Cargar índice de proyectos cuando se abre el modal
  useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    try {
      const index = getSavedProjectsIndex();
      setProjects(index);
    } finally {
      setIsLoading(false);
    }
  }, [open]);

  if (!open) return null;

  const isEdit = mode === "edit";

  const title = isEdit ? "Editar aventura" : "Jugar aventura";
  const subtitle = isEdit
    ? "Selecciona una aventura guardada en este navegador para editarla, o carga un archivo JSON."
    : "Selecciona una aventura guardada en este navegador para jugarla, o carga un archivo JSON.";

  const emptyText = isEdit
    ? "No hay aventuras guardadas en este navegador. Puedes cargar una desde un archivo JSON."
    : "No hay aventuras guardadas en este navegador. Puedes cargar una aventura para jugar desde un archivo JSON.";

  const handleProjectClick = (entry: ProjectIndexEntry) => {
    const project = loadProjectFromLocalStorage(entry.id);
    if (!project) {
      alert("No se ha podido cargar esta aventura desde el navegador.");
      return;
    }

    if (isEdit) {
      editorStoreRef.current.loadProject(project);
      onClose();
      navigate("/editor");
    } else {
      startGame(project);
      onClose();
      navigate("/play", { state: { project } });
    }
  };

  const handleJsonButtonClick = () => { fileInputRef.current?.click(); };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".json")) {
      alert("Por favor, selecciona un archivo .json");
      event.target.value = "";
      return;
    }

    try {
      const project = await loadProjectFromFile(file);

      if (isEdit) {
        editorStoreRef.current.resetEditor();
        editorStoreRef.current.loadProject(project);
        onClose();
        navigate("/editor");
      } else {
        startGame(project);
        onClose();
        navigate("/play", { state: { project } });
      }
    } catch (error: any) {
      console.error(error);
      alert(error?.message ?? "No se ha podido cargar el proyecto desde el archivo.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          {subtitle}
        </p>

        <div className="mb-4 max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
          {isLoading ? (
            <div className="project-list-message">
              Cargando aventuras guardadas...
            </div>
          ) : projects.length === 0 ? (
            <div className="project-list-message">
              {emptyText}
            </div>
          ) : (
            <ul className="divide-y divide-slate-800">
              {projects.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleProjectClick(entry)}
                    className="project-list-item-btn"
                  >
                    <div className="font-semibold text-slate-100 truncate">
                      {entry.title || "(Sin título)"}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Última edición:{" "}
                      {new Date(entry.updatedAt).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex justify-between items-center">
          <button
            type="button"
            onClick={handleJsonButtonClick}
            className="btn btn-secondary"
          >
            Cargar JSON
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn"
          >
            Cancelar
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
