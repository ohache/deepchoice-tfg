import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEditorStore } from "@/store/editorStore";
import { useGameStore } from "@/store/gameStore";
import { type EditorPrimaryMode, PRIMARY_TABS } from "@/features/editor/core/editorModes";
import { createCommitCancelKeyHandler } from "@/shared/keyboard";
import { ExitWithoutSaveModal } from "@/features/editor/modals/ExitWithoutSaveModal";
import { DocumentArrowDownIcon, ArchiveBoxArrowDownIcon } from "@heroicons/react/24/outline";
import { toast } from "@/shared/toast/toastStore";

export function TopBar() {
  const navigate = useNavigate();

  const project = useEditorStore((s) => s.project);

  const primaryMode = useEditorStore((s) => s.primaryMode);
  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const secondaryMode = useEditorStore((s) => s.secondaryMode);

  const updateProjectTitle = useEditorStore((s) => s.updateProjectTitle);
  const downloadProjectJson = useEditorStore((s) => s.downloadProjectJson);
  const exportProject = useEditorStore((s) => s.exportProject);

  const zoom = useEditorStore((s) => s.zoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const zoomReset = useEditorStore((s) => s.zoomReset);

  const startGameFromEditor = useGameStore((s) => s.startGameFromEditor);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(project?.title ?? "");
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  const canZoom = primaryMode === "historia" && secondaryMode === "vista";

  useEffect(() => {
    if (!project) return;

    if (!isEditingTitle) {
      setTempTitle(project.title);
      document.title = project.title;
    }
  }, [project, isEditingTitle]);

  const handleModeClick = (mode: EditorPrimaryMode) => {
    if (mode === primaryMode) return;
    setPrimaryMode(mode);
  };

  const commitTitle = () => {
    if (!project) return;

    const trimmed = tempTitle.trim();
    const finalTitle = trimmed || project.title;

    updateProjectTitle(finalTitle);
    setIsEditingTitle(false);

    if (finalTitle !== project.title) {
      toast.info("Título actualizado", `Nuevo título: "${finalTitle}"`);
    }
  };

  const cancelTitleEdit = () => {
    if (!project) return;

    setIsEditingTitle(false);
    setTempTitle(project.title);
  };

  const handleTitleKeyDown = createCommitCancelKeyHandler<HTMLInputElement>(commitTitle, cancelTitleEdit, { stopPropagation: true });

  /* Intenta arrancar el player usando el proyecto actual y los assets cargados */
  const handlePlayRequested = () => {
    const { project, assetFiles } = useEditorStore.getState();
    if (!project) return;

    const totalAssets = project.assets?.length ?? 0;
    const totalFiles = Object.keys(assetFiles ?? {}).length;

    if (totalAssets > 0 && totalFiles === 0) {
      toast.error("No se puede jugar", "No hay assets cargados. Carga el proyecto desde carpeta o reimporta los assets.");
      return;
    }

    try {
      startGameFromEditor(project, assetFiles);
      navigate("/play");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      toast.error("No se pudo iniciar el juego", message);
    }
  };

  /* Descarga el JSON del proyecto */
  const handleSaveClick = () => {
    try {
      downloadProjectJson();
      toast.success("Descargado", "Se descargó el JSON del proyecto.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se ha podido descargar el project.json.";

      toast.error("Error al descargar", message);
    }
  };

  /* Exporta el proyecto completo como ZIP */
  const handleExportClick = async () => {
    try {
      await exportProject();
      toast.success("Exportado", "Se descargó el ZIP (JSON + assets).");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "No se ha podido exportar el ZIP.";

      toast.error("Error al exportar", message);
      throw error;
    }
  };

  const resetDocumentTitle = () => {
    document.title = "Crea tu propia aventura";
  };

  const handleLogoClick = () => {
    setIsExitModalOpen(true);
  };

  const handleExit = () => {
    setIsExitModalOpen(false);
    resetDocumentTitle();
    navigate("/");
  };

  const handleExitAndJSON = () => {
    handleSaveClick();
    handleExit();
  };

  const handleExitAndProject = async () => {
    try {
      await handleExportClick();
      handleExit();
    } catch { }
  };

  if (!project) return null;

  return (
    <header className="h-14 bg-slate-900 border-b-2 border-slate-700 flex items-center justify-between px-4 gap-10">
      {/* Navegación principal + jugar */}
      <div className="flex items-center gap-3">
        <nav className="flex items-center gap-2">
          {PRIMARY_TABS.map((tab) => {
            const isActive = primaryMode === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleModeClick(tab.id)}
                className={ "px-3 py-1.5 rounded-lg text-base transition-colors " +
                  (isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-100 hover:text-white hover:bg-slate-800/60")}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={handlePlayRequested}
          className="ml-2 px-3 py-1.5 rounded-lg text-base btn-create"
          title="Jugar con el proyecto actual"
        >
          Jugar
        </button>
      </div>

      {/* Persistencia / zoom / título / salida */}
      <div className="flex items-center gap-4">
        {/* Guardar / exportar */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleSaveClick}
            className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
            title="Guardar (descargar JSON)"
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleExportClick}
            className="p-1.5 rounded-md bg-slate-700 hover:bg-slate-600"
            title="Exportar (ZIP con JSON + assets)"
          >
            <ArchiveBoxArrowDownIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1 text-sm text-white">
          <button
            type="button"
            onClick={zoomOut}
            disabled={!canZoom}
            className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canZoom ? "Zoom out" : "El zoom solo está disponible en Historia → Vista"}
          >
            -
          </button>

          <button
            type="button"
            onClick={zoomReset}
            disabled={!canZoom}
            className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 min-w-12 text-center disabled:opacity-40 disabled:cursor-not-allowed"
            title={canZoom ? "Reset zoom" : "El zoom solo está disponible en Historia → Vista"}
          >
            {zoom}%
          </button>

          <button
            type="button"
            onClick={zoomIn}
            disabled={!canZoom}
            className="px-2 py-1 rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
            title={canZoom ? "Zoom in" : "El zoom solo está disponible en Historia → Vista"}
          >
            +
          </button>
        </div>

        {/* Título editable + logo */}
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
              aria-label="Título del proyecto"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="hover:text-fuchsia-400 truncate text-right"
              title="Editar título de la aventura"
            >
              {project.title}
            </button>
          )}

          <button
            type="button"
            onClick={handleLogoClick}
            className="shrink-0"
            title="Volver al inicio"
          >
            <img
              src="/logo.png"
              alt="Volver al inicio"
              className="w-10 h-10 rounded-lg border-2 border-fuchsia-600 bg-slate-900 object-contain"
            />
          </button>
        </div>
      </div>

      {/* Modal de salida */}
      <ExitWithoutSaveModal
        open={isExitModalOpen}
        onCancel={() => setIsExitModalOpen(false)}
        onExit={handleExit}
        onExitAndDownloadJSON={handleExitAndJSON}
        onExitAndDownloadProject={handleExitAndProject}
      />
    </header>
  );
}