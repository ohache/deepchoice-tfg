import { useEffect, useRef, useState } from "react";
import type { SoundEffectDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { validateSfxDraft } from "@/features/editor/history/sfx/sfxValidator";
import { hasDuplicateFileByLinkedAssetId } from "@/validation/genericValidator";
import { type AssetDraftFieldErrors } from "@/validation/validateAssetBackedDraft";
import { useAssetDraftPanel } from "@/features/editor/history/shared/useAssetDraftPanel";
import { useAudioFileDraft } from "@/features/editor/history/shared/useAudioFileDraft";
import { DeleteProjectEntityModal } from "@/features/editor/modals/DeleteProjectEntityModal";
import { PlayIcon, StopIcon } from "@heroicons/react/24/solid";
import { toast } from "@/shared/toast/toastStore";

export function HistorySfxPanel() {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);

  const selectedSfxId = useEditorStore((s) => s.selectedSfxId);
  const setSelectedSfxId = useEditorStore((s) => s.setSelectedSfxId);
  const addSfx = useEditorStore((s) => s.addSfx);
  const updateSfx = useEditorStore((s) => s.updateSfx);
  const removeSfx = useEditorStore((s) => s.removeSfx);

  const [draftName, setDraftName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<AssetDraftFieldErrors>({});
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const sfxList = project?.soundEffects ?? [];
  const selectedSfx = selectedSfxId && project ? sfxList.find((s) => s.id === selectedSfxId) ?? null : null;

  const inferredMode: "none" | "edit" = selectedSfxId ? "edit" : "none";

  const audio = useAudioFileDraft({
    mode: inferredMode,
    selectedId: selectedSfxId,
    isDuplicateFile: (file, ctx) => {
      if (!project) return false;

    return hasDuplicateFileByLinkedAssetId({
      project,
      list: project.soundEffects ?? [],
      assetKind: "sfx",
      incomingFileName: file.name,
      ignoreId: ctx.mode === "edit" ? ctx.selectedId ?? undefined : undefined,
    });
    },
    messages: {
      duplicateFieldError: "Ya existe un efecto que usa este archivo de audio.",
      duplicateToastTitle: "Archivo duplicado",
      duplicateToastBody: "Ya hay un efecto usando ese archivo.",
      playErrorTitle: "No se pudo reproducir",
      playErrorBody: "El navegador bloqueó la reproducción o el audio falló.",
    },
  });

useEffect(() => () => { setSelectedSfxId(null); }, [setSelectedSfxId]);

  /* Hook común de panel “draft” */
  const panel = useAssetDraftPanel<SoundEffectDef>({
    hasProject: !!project,
    selectedId: selectedSfxId,
    focusRef: nameInputRef,
    items: sfxList,
    setSelectedId: setSelectedSfxId,

    onLoadDraftFieldsFromSelected: (sfx) => {
      setDraftName(sfx.name);
      setFieldErrors({});
      audio.resetAudioDraft();

      const assetPath = (project?.assets ?? []).find((a) => a.kind === "sfx" && a.id === sfx.id)?.file?.trim() ?? "";

      audio.setDraftFileName(assetPath ? assetPath.split("/").pop() ?? assetPath : "");

      audio.loadPreviewFromExistingFile(assetFiles?.[sfx.id]);
    },

    onResetDraftFields: () => {
      setDraftName("");
      setFieldErrors({});
      audio.resetAudioDraft();
    },
  });

  const modeTitle = (mode: "none" | "new" | "edit") => mode === "new" ? "Nuevo efecto" : mode === "edit" ? "Editar efecto" : "Detalle de efecto";
  const mode = panel.mode;
  const rightTitle = modeTitle(mode);

  /* Validación - Guardado */
  const validateDraft = (): boolean => {
    if (!project) return false;

    const { ok, errors } = validateSfxDraft(
      { name: draftName, file: audio.draftFile ?? undefined },
      { mode: mode === "edit" ? "edit" : "new", project, currentSfxId: selectedSfxId ?? undefined }
    );

    setFieldErrors(errors);

    if (!ok) toast.warning("Revisa el formulario", "Hay campos con errores.");
    return ok;
  };

  const handleSave = () => {
    if (!project) return;
    if (!validateDraft()) return;

    const displayName = draftName.trim();

    if (mode === "new") {
      if (!audio.draftFile) {
        toast.error("Falta archivo", "Selecciona un archivo de audio antes de guardar.");
        return;
      }

      const id = addSfx(audio.draftFile, displayName);
      if (!id) {
        toast.error("No se pudo crear", "Puede que el archivo ya esté en uso por otro efecto.");
        return;
      }

      toast.success("Efecto creado", `“${displayName}”`);
      panel.reset();
      return;
    }

    if (mode === "edit" && selectedSfxId) {
      const replacingFile = !!audio.draftFile;

      updateSfx(selectedSfxId, {
        name: displayName,
        file: audio.draftFile ?? undefined,
      });

      toast.success(replacingFile ? "Efecto actualizado (archivo reemplazado)" : "Efecto actualizado", `“${displayName}”`);
      panel.reset();
    }
  };

  const handleConfirmDelete = () => {
    if (selectedSfxId) {
      const deletedName = selectedSfx?.name ?? "Efecto";
      removeSfx(selectedSfxId);
      toast.success("Efecto eliminado", `“${deletedName}”`);
    }

    panel.reset();
  };

  if (!project) return null;

  return (
    <div className="max-w-[900px] mx-auto rounded-xl border-2 border-slate-700 bg-slate-900 p-4 space-y-3">
      <div className="flex gap-4 h-full">
        {/* Columna izquierda: lista + botón añadir */}
        <aside className="w-1/3 rounded-lg bg-slate-950 flex flex-col overflow-hidden">
          <button
            type="button"
            onClick={panel.startNew}
            className="px-3 py-2 text-base font-semibold bg-indigo-800 hover:bg-indigo-700 text-white rounded-t-lg"
          >
            + Añadir efecto
          </button>

          <div className="flex-1 overflow-y-auto text-[15px]">
            {sfxList.length === 0 ? (
              <p className="p-4 text-xs text-slate-320 text-center">No hay efectos de sonido en el proyecto</p>
            ) : (
              <ul className="divide-y-2 divide-slate-700">
                {sfxList.map((sfx) => {
                  const isSelected = sfx.id === selectedSfxId;
                  return (
                    <li key={sfx.id}>
                      <button
                        type="button"
                        onClick={() => panel.handleListClick(sfx)}
                        className={"w-full text-left px-6 py-3 text-[15px] border-t border-t-black " +
                          (isSelected ? "bg-indigo-900/60 text-slate-50" : "hover:bg-indigo-900/60 text-slate-200")}
                      >
                        <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">{sfx.name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Columna derecha: formulario */}
        <section className="relative flex-1 rounded-lg bg-slate-950 text-sm text-slate-100 flex flex-col overflow-hidden">
          {mode !== "none" && (
            <img
              src="/ui/sfx-watermark.png"
              alt="Logo de efecto de sonido"
              className="px-3 pointer-events-none absolute right-[-10%] top-42/100 -translate-y-1/2 w-[220%] opacity-[0.07]"
              draggable="false"
            />
          )}

          <div className="relative z-10 bg-indigo-800/80 border-b border-indigo-900 rounded-t-lg px-4 py-2">
            <h4 className="text-base font-semibold text-center text-white m-0">{rightTitle}</h4>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            {mode === "none" ? (
              <p className="text-[11px] text-slate-200 text-center">
                Selecciona un efecto en la lista de la izquierda o pulsa <span className="font-semibold">“Añadir efecto”</span>{" "}
                para crear uno nuevo
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
                    className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100
                    focus:outline-none focus:border-transparent focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ej: Puerta abriéndose"
                  />
                  {fieldErrors.name && <p className="form-field-error mt-1">{fieldErrors.name}</p>}
                </div>

                {/* Archivo */}
                <div className="mb-2 mt-2">
                  <label className="block text-[13px] text-slate-200 mb-1 text-center">Archivo de sonido</label>

                  <div
                    className={
                      "group relative mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
                      "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
                      (audio.isDragging
                        ? "border-indigo-400 bg-indigo-800"
                        : "border-indigo-800 bg-slate-900/40 " + (audio.isHoveringSelectButton ? "" : "hover:bg-indigo-900/60"))
                    }
                    onDragOver={audio.handleDragOver}
                    onDragLeave={audio.handleDragLeave}
                    onDrop={audio.handleDrop}
                    onClick={() => audio.fileInputRef.current?.click()}
                  >
                    <p className="mb-2 text-slate-200 text-center">
                      Arrastra aquí un archivo de audio
                      <span className="block text-xs text-slate-400">(o haz clic para seleccionarlo)</span>
                      {mode === "edit" && (
                        <span className="block text-xs text-slate-400 mt-2">En edición, sustituirá el archivo actual.</span>
                      )}
                    </p>

                    <button
                      type="button"
                      className="btn btn-select"
                      onMouseEnter={() => audio.setIsHoveringSelectButton(true)}
                      onMouseLeave={() => audio.setIsHoveringSelectButton(false)}
                      onClick={(e) => {
                        e.stopPropagation();
                        audio.fileInputRef.current?.click();
                      }}
                    >
                      Seleccionar…
                    </button>
                  </div>

                  <input
                    ref={audio.fileInputRef}
                    type="file"
                    accept=".mp3,.ogg,.wav,audio/mpeg,audio/ogg,audio/wav"
                    className="hidden"
                    onChange={audio.handleFileChange}
                  />

                  <p className="mt-2 text-[11px] text-slate-400 break-all text-center">
                    {audio.draftFile
                      ? `Archivo seleccionado: ${audio.draftFile.name}`
                      : mode === "edit" && selectedSfxId
                        ? `Archivo actual: ${audio.draftFileName}`
                        : "No hay archivo seleccionado"}
                  </p>

                  {fieldErrors.file && <p className="form-field-error mt-1">{fieldErrors.file}</p>}
                </div>

                {audio.isReady && (
                  <div className="mt-1 text-[11px] text-slate-400 flex justify-center mb-1">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <span className="inline-block h-3 w-3 rounded-full bg-emerald-400" />
                      <span>Archivo listo</span>
                    </span>
                  </div>
                )}

                {/* Audio hidden para preview */}
                <audio ref={audio.audioRef} src={audio.previewUrl ?? undefined} className="hidden" />

                {/* Play / stop */}
                <div className="flex justify-center mt-2 mb-6">
                  <button
                    type="button"
                    onClick={audio.handlePlayToggle}
                    disabled={!audio.hasAudioLoaded}
                    className={
                      "min-w-35 px-6 py-2 rounded-md text-[12px] font-semibold text-white " +
                      "inline-flex justify-center " +
                      "disabled:opacity-40 disabled:cursor-not-allowed " +
                      (audio.isPlaying ? "bg-red-800 hover:bg-red-700" : "bg-indigo-700 hover:bg-indigo-600")
                    }
                  >
                    <span className="inline-flex items-center gap-2">
                      {audio.isPlaying ? (
                        <>
                          <StopIcon className="h-4 w-4" />
                          <span>Detener</span>
                        </>
                      ) : (
                        <>
                          <PlayIcon className="h-4 w-4" />
                          <span>Reproducir</span>
                        </>
                      )}
                    </span>
                  </button>
                </div>

                {/* Botones */}
                <div className="mt-auto flex justify-between">
                  <button
                    type="button"
                    onClick={panel.openDelete}
                    disabled={!selectedSfxId}
                    className="btn btn-danger text-[12px] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Eliminar efecto
                  </button>

                  <div className="flex gap-3 panel--sfx">
                    <button type="button" onClick={panel.reset} className="btn btn-cancel text-[12px]">
                      Cancelar
                    </button>
                    <button type="button" onClick={handleSave} className="btn btn-save">
                      Guardar efecto
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <DeleteProjectEntityModal
        open={panel.isDeleteModalOpen}
        title="Eliminar efecto de sonido"
        entityName={selectedSfx?.name ?? ""}
        description="El archivo dejará de estar disponible para las escenas que lo usen."
        onConfirm={handleConfirmDelete}
        onCancel={panel.cancelDelete}
      />
    </div>
  );

}
