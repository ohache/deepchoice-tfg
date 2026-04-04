import { useEffect, useRef, useState } from "react";
import type { DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { toast } from "@/shared/toast/toastStore";

type FieldCtx = {
  mode: DraftMode;
  selectedId: string | null;
};

type UseAudioFileDraftOptions = {
  mode: DraftMode;
  selectedId: string | null;
  isDuplicateFile: (file: File, ctx: FieldCtx) => boolean;
  messages: {
    duplicateFieldError: string;
    duplicateToastTitle: string;
    duplicateToastBody: string;
    playErrorTitle: string;
    playErrorBody: string;
  };
  getLoop?: () => boolean;
};

/* Hook reutilizable para gestionar un archivo de audio draft */
export function useAudioFileDraft(opts: UseAudioFileDraftOptions) {
  const { mode, selectedId, isDuplicateFile, messages, getLoop } = opts;

  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileName, setDraftFileName] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSelectButton, setIsHoveringSelectButton] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [fileError, setFileError] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasAudioLoaded = !!previewUrl;
  const isReady = Boolean(draftFile || previewUrl);

  /* Detiene el audio y resetea la posición de reproducción */
  const stopPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch { }

    setIsPlaying(false);
  };

  /* Revoca la blob URL si procede */
  const revokePreview = (url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  useEffect(() => stopPlayback(), [previewUrl]);

  useEffect(() => () => revokePreview(previewUrl), [previewUrl]);

  /* Reemplaza la preview actual por la de un fichero nuevo */
  const setPreviewFromFile = (file: File | null) => {
    setPreviewUrl((prev) => {
      revokePreview(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const loadPreviewFromExistingFile = (file: File | undefined) => {
    setPreviewFromFile(file ?? null);
  };

  const clearFileError = () => {
    setFileError(undefined);
  };

  /* Procesa un fichero entrante */
  const processIncomingFile = (file: File) => {
    const duplicate = isDuplicateFile(file, { mode, selectedId });

    if (duplicate) {
      setFileError(messages.duplicateFieldError);
      toast.warning(messages.duplicateToastTitle, messages.duplicateToastBody);
      return;
    }

    clearFileError();
    setDraftFile(file);
    setDraftFileName(file.name);
    setPreviewFromFile(file);
  };

  /* Selección desde input file */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) processIncomingFile(file);

    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (file) processIncomingFile(file);
  };

  /* Alterna play / stop del preview */
  const handlePlayToggle = async () => {
    if (!hasAudioLoaded || !audioRef.current) return;

    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (getLoop) audioRef.current.loop = !!getLoop();

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      toast.error(messages.playErrorTitle, messages.playErrorBody);
      setIsPlaying(false);
    }
  };

  /* Resetea el estado local del draft de audio */
  const resetAudioDraft = () => {
    setDraftFile(null);
    setDraftFileName("");
    setIsDragging(false);
    setIsHoveringSelectButton(false);
    setIsPlaying(false);
    setFileError(undefined);
    setPreviewFromFile(null);
  };

  return { draftFile, draftFileName, previewUrl, isPlaying, hasAudioLoaded, isDragging, isHoveringSelectButton, fileError, isReady, audioRef, fileInputRef, setDraftFileName,
    setIsHoveringSelectButton, clearFileError, loadPreviewFromExistingFile, processIncomingFile, handleFileChange, handleDragOver, handleDragLeave, handleDrop,
    handlePlayToggle, resetAudioDraft };
}