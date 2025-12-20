import { useState, useRef, useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { MusicTrack } from "@/domain/types";
import { validateMusicDraft, type MusicFieldErrors } from "@/features/editor/validation/musicValidator";
import { DeleteProjectEntityModal } from "../modals/DeleteProjectEntityModal";

type DraftMode = "none" | "new" | "edit";
type FileStatus = "idle" | "loading" | "ready";

export function HistoryMusicPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);
  const addMusicTrack = useEditorStore((s) => s.addMusicTrack);
  const updateMusicTrack = useEditorStore((s) => s.updateMusicTrack);
  const removeMusicTrack = useEditorStore((s) => s.removeMusicTrack);

  /* UI State */
  const [mode, setMode] = useState<DraftMode>("none");
  const selectedTrackId = useEditorStore((s) => s.selectedMusicTrackId);
  const setSelectedTrackId = useEditorStore((s) => s.setSelectedMusicTrackId);

  /* Draft fields */
  const [draftName, setDraftName] = useState("");
  const [draftLoop, setDraftLoop] = useState(true);
  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileName, setDraftFileName] = useState<string>("");

  /* Validation */
  const [fieldErrors, setFieldErrors] = useState<MusicFieldErrors>({});

  /* File loading */
  const [fileStatus, setFileStatus] = useState<FileStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);

  /* Preview audio */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  /* Refs */
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const musicTracks = project?.musicTracks ?? [];

  /* Play/Stop */
  const hasAudioLoaded = !!previewUrl;

  /* Delete track */
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const selectedTrack = selectedTrackId && project
    ? project.musicTracks.find((t) => t.id === selectedTrackId) ?? null
    : null;

  const rightTitle = mode === "new" ? "Nueva pista"
    : mode === "edit" ? "Editar pista" : "Detalle de pista";

  useEffect(() => {
    return () => {
      if (audioRef.current) {audioRef.current.pause();}
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!project || !selectedTrackId) return;
    const track = project.musicTracks.find((t) => t.id === selectedTrackId);
    if (!track) return;

    if (mode === "edit" && draftName === track.name) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    setMode("edit");
    setDraftName(track.name);
    setDraftLoop(track.loop ?? true);
    setDraftFile(null);
    setDraftFileName(track.file.split("/").pop() ?? track.file);
    setFieldErrors({});
    setFileStatus("idle");
    setIsPlaying(false);

    const file = assetFiles[track.file];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setFileStatus("ready");
    } else {
      setPreviewUrl(null);
      setFileStatus("idle");
    }
  }, [project, selectedTrackId, assetFiles]);

  const resetDraft = () => {
    setMode("none");
    setSelectedTrackId(null);
    setDraftName("");
    setDraftLoop(true);
    setDraftFile(null);
     setDraftFileName("");
    setFieldErrors({});
    setFileStatus("idle");
    setIsPlaying(false);

    if (previewUrl){
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const startNewTrack = () => {
    resetDraft();
    setMode("new");

    setTimeout(() => nameInputRef.current?.focus(), 0);
  };

  const handleListClick = (track: MusicTrack) => {
    if (track.id === selectedTrackId) {
      resetDraft();
      return;
    }

    setSelectedTrackId(track.id);
  };

  const processIncomingFile = (file: File) => {
    const validExt = /\.(mp3|ogg|wav)$/i.test(file.name);

    if (!validExt) {
      setFieldErrors({ file: "Formato no válido. Usa .mp3, .ogg o .wav." });
      setDraftFile(null);
      setFileStatus("idle");

      if (previewUrl){
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }

    const state = useEditorStore.getState();
    const proj = state.project;

    if (proj) {
      const duplicateFile = proj.musicTracks.some((t) => {
        const existingFileName = t.file.split("/").pop()?.toLowerCase();

        if (mode === "edit" && selectedTrackId && t.id === selectedTrackId)  return false;
        
        return existingFileName === file.name.toLowerCase();
      });

      if (duplicateFile) {
        setFieldErrors({ file: "Ya existe una pista que usa este archivo de audio." });
        return;
      }
    }

    setFieldErrors({});
    setDraftFile(file);
    setFileStatus("loading");

    if (previewUrl){
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setFileStatus("ready");
  };

  const handleFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0] ?? null;
    if (file) processIncomingFile(file);
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

  const handlePlayToggle = async () => {
    if (!hasAudioLoaded || !audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      return;
    }

    audioRef.current.loop = draftLoop;

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (err) {
      console.error("No se ha podido reproducir el audio", err);
      setIsPlaying(false);
    }
  };

  const validateDraft = (): boolean => {
    if (!project) return false;

    const { ok, errors } = validateMusicDraft(
      {
        name: draftName,
        loop: draftLoop,
        file: draftFile ?? undefined,
      },
      {
        mode: mode === "edit" ? "edit" : "new",
        project,
        currentTrackId: selectedTrackId ?? undefined,
      }
    );

    setFieldErrors(errors);
    return ok;
  };

  const handleSave = () => {
    if (!validateDraft()) return;

    const trimmedName = draftName.trim();
    const displayName = trimmedName || draftFile?.name?.replace(/\.[^.]+$/, "") || "Pista";

    if (mode === "new" && draftFile) {
      const id = addMusicTrack(draftFile);

      if (id) updateMusicTrack(id, { name: displayName, loop: draftLoop });
      
      resetDraft();
      return;
    }

    if (mode === "edit" && selectedTrackId) {
      updateMusicTrack(selectedTrackId, {
        name: displayName,
        loop: draftLoop,
      });
      resetDraft();
    }
  };

  const handleDeleteClick = () => {
    if (selectedTrackId) setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedTrackId) removeMusicTrack(selectedTrackId);
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
            onClick={startNewTrack}
            className="px-3 py-2 text-base font-semibold bg-cyan-900 hover:bg-cyan-700 text-white rounded-t-lg"
          >
            + Añadir pista
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {musicTracks.length === 0 ? (
              <p className="p-4 text-[11px] text-slate-320 text-center">
                Aún no hay pistas de música en el proyecto
              </p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {musicTracks.map((track) => {
                  const isSelected = track.id === selectedTrackId;
                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => handleListClick(track)}
                        className={[
                          "w-full text-left px-6 py-3 text-[15px]",
                          isSelected
                            ? "bg-sky-950 text-slate-50"
                            : "hover:bg-slate-900 text-slate-200",
                        ].join(" ")}
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {track.name}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Columna derecha: formulario de la pista */}
        <section className="relative flex-1 border border-slate-800 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          
          {mode !== "none" && (
            <img
              src="/ui/music-watermark.jpg"
              alt=""
              className="px-3 pointer-events-none absolute right-0 top-46/100 -translate-y-1/2 w-3/4 opacity-[0.05]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-cyan-800/80 border-b border-cyan-900 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">
              {rightTitle}
            </h4>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {mode === "none" ? (
              <p className="text-[11px] text-slate-200 text-center">
                Selecciona una pista en la lista de la izquierda o pulsa{" "}
                <span className="font-semibold">“Añadir pista”</span> para crear una nueva
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
                    placeholder="Ej: Tema de la mansión"
                  />
                  {fieldErrors.name && (
                    <p className="form-field-error mt-1">{fieldErrors.name}</p>
                  )}
                </div>

                {/* Archivo */}
                  <div className="mb-2 mt-2">
                    <label className="block text-[13px] text-slate-200 mb-1 text-center">
                      Archivo de música
                    </label>

                    <div
                      className={["mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px]",
                        "transition-colors duration-150 border-2 border-dashed cursor-pointer",
                        isDragging
                          ? "border-cyan-400 bg-cyan-950/40"
                          : "border-cyan-800 bg-slate-900/40 hover:bg-slate-800"
                      ].join(" ")}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <p className="mb-2 text-slate-300 text-center">
                        Arrastra aquí un archivo de audio
                        <span className="block text-[11px] text-slate-500">
                          (o haz clic para seleccionarlo)
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
                      accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
                      className="hidden"
                      onChange={handleFileChange}
                    />

                    <p className="mt-2 text-[11px] text-slate-400 break-all text-center">
                      {draftFile
                        ? `Archivo seleccionado: ${draftFile.name}`
                        : mode === "edit" && selectedTrackId
                          ? `Archivo seleccionado: ${draftFileName}`
                          : "No hay archivo seleccionado"}
                    </p>

                    {fieldErrors.file && (
                    <p className="form-field-error mt-1">{fieldErrors.file}</p>
                  )}
                  </div>

                  {/* Estado de carga del archivo */}
                  {fileStatus !== "idle" && (
                  <div className="mt-1 text-[11px] text-slate-400 flex justify-center mb-1">
                    {fileStatus === "loading" && (
                      <>
                        <span className="inline-block h-3 w-3 rounded-full border border-slate-400 border-t-transparent animate-spin text-center" />
                        <span>Cargando archivo…</span>
                      </>
                    )}
                    {fileStatus === "ready" && (
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                        <span>Archivo listo</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Loop */}
                <div className="mb-2 flex items-center gap-2 mt-3">
                  <input
                    id="music-loop"
                    type="checkbox"
                    checked={draftLoop}
                    onChange={(e) => setDraftLoop(e.target.checked)}
                    className="h-3 w-3"
                  />
                  <label htmlFor="music-loop" className="text-[12px]">
                    Reproducir en bucle
                  </label>
                </div>

                {/* Audio hidden para preview */}
                <audio
                  ref={audioRef}
                  src={previewUrl ?? undefined}
                  loop={draftLoop}
                  className="hidden"
                />

                {/* Botón Reproducir / Detener */}
                  <div className="flex justify-center mt-2 mb-6">
                    <button
                      type="button"
                      onClick={handlePlayToggle}
                      disabled={!hasAudioLoaded}
                      className={
                        `px-10 py-2 rounded-md text-[12px] font-medium text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed ` +
                        (isPlaying
                          ? "bg-red-800 hover:bg-red-700"
                          : "bg-cyan-700 hover:bg-cyan-600")
                      }
                    >
                      {isPlaying ? "⏹\u00A0\u00A0\u00A0Detener" : "▶\u00A0\u00A0\u00A0Reproducir"}
                    </button>
                  </div>

                {/* Botones inferiores */}
                <div className="mt-auto flex justify-between">
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={!selectedTrackId}
                    className="px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-[12px] font-semibold text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar pista
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
                      Guardar pista
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
        title="Eliminar música"
        entityName={selectedTrack?.name ?? ""}
        description="Esta acción lo quitará del proyecto y dejará de estar disponible para las escenas que lo usen."
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}