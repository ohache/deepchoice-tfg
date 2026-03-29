import { useEffect, useRef, useState } from "react";
import type { DraftMode } from "@/features/editor/history/shared/useAssetDraftPanel";
import { toast } from "@/shared/toast/toastStore";

type FieldCtx = { mode: DraftMode; selectedId: string | null };

export function useImageFileDraft(opts: {
  mode: DraftMode;
  selectedId: string | null;
  isDuplicateFile: (file: File, ctx: FieldCtx) => boolean;
  messages: { duplicateFieldError: string; duplicateToastTitle: string; duplicateToastBody: string; };
}) {
  const { mode, selectedId, isDuplicateFile, messages } = opts;

  const [draftFile, setDraftFile] = useState<File | null>(null);
  const [draftFileName, setDraftFileName] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSelectButton, setIsHoveringSelectButton] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [fileError, setFileError] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isReady = Boolean(draftFile || previewUrl);

  const revokePreview = (url: string | null) => {
    if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  useEffect(() => () => revokePreview(previewUrl), [previewUrl]);

  const setPreviewFromFile = (file: File | null) => {
    setPreviewUrl((prev) => {
      revokePreview(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  };

  const loadPreviewFromExistingFile = (file: File | undefined) => {
    if (file) setPreviewFromFile(file);
    else setPreviewFromFile(null);
  };

  const clearFileError = () => setFileError(undefined);

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

  const handleFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0] ?? null;
    if (file) processIncomingFile(file);

    evt.target.value = "";
  };

  /* Drag&drop */
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

  /* Reset “solo imagen draft” */
  const resetImageDraft = () => {
    setDraftFile(null);
    setDraftFileName("");
    setIsDragging(false);
    setIsHoveringSelectButton(false);
    setPreviewFromFile(null);
    clearFileError();
  };

  return { draftFile, draftFileName, previewUrl, isDragging, isHoveringSelectButton, fileError, isReady, fileInputRef, setDraftFileName, setIsHoveringSelectButton,
    clearFileError, loadPreviewFromExistingFile, processIncomingFile, handleFileChange, handleDragOver, handleDragLeave, handleDrop, resetImageDraft };
}