import { useEffect, useRef, useState } from "react";
import type { DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { toast } from "@/shared/toast/toastStore";

type FieldCtx = {
  mode: DraftMode;
  selectedId: string | null;
};

type UseImageFileDraftOptions = {
  mode: DraftMode;
  selectedId: string | null;
  isDuplicateFile: (file: File, ctx: FieldCtx) => boolean;
  messages: {
    duplicateFieldError: string;
    duplicateToastTitle: string;
    duplicateToastBody: string;
  };
};

/* Hook reutilizable para gestionar un archivo de imagen draft */
export function useImageFileDraft(opts: UseImageFileDraftOptions) {
  const { mode, selectedId, isDuplicateFile, messages } = opts;

  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileName, setDraftFileName] = useState("");

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSelectButton, setIsHoveringSelectButton] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [fileError, setFileError] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isReady = Boolean(draftFile || previewUrl);

  /* Revoca la blob URL si procede */
  const revokePreview = (url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  };

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

  /* Resetea el estado local del draft de imagen */
  const resetImageDraft = () => {
    setDraftFile(null);
    setDraftFileName("");
    setIsDragging(false);
    setIsHoveringSelectButton(false);
    setPreviewFromFile(null);
    setFileError(undefined);
  };

  return { draftFile, draftFileName, previewUrl, isDragging, isHoveringSelectButton, fileError, isReady, fileInputRef, setDraftFileName, setIsHoveringSelectButton,
    clearFileError, loadPreviewFromExistingFile, processIncomingFile, handleFileChange, handleDragOver, handleDragLeave, handleDrop, resetImageDraft };
}