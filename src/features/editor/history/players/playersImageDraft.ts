import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, PlayerDef, PlayerImage } from "@/domain/types";
import { generateId } from "@/utils/id";

export type DraftPlayerImage = {
  uiId: ID;
  imageId?: ID;
  name: string;
  file?: File;
  previewLogicalPath?: string;
};

function playerImagesToDraft(images: PlayerImage[] | undefined): DraftPlayerImage[] {
  return (images ?? []).map((img) => ({
    uiId: generateId.playerImage(),
    imageId: img.id,
    name: img.name,
    file: undefined,
    previewLogicalPath: img.id,
  }));
}

/* Devuelve el uiId draft que corresponde al defaultImageId del dominio */
function resolveDraftDefaultImageUiId(draft: DraftPlayerImage[], defaultImageId?: ID): string | null {
  if (!draft.length) return null;
  const found = defaultImageId ? draft.find((x) => x.imageId === defaultImageId)?.uiId : undefined;
  return found ?? draft[0]!.uiId;
}

/* Crea un draft a partir de un File entrante */
function createDraftImageFromFile(file: File): DraftPlayerImage {
  return {
    uiId: generateId.playerImage(),
    name: file.name.replace(/\.[^.]+$/, ""),
    file,
    previewLogicalPath: URL.createObjectURL(file),
  };
}

/* Revoca el blob si el draft apunta a blob:... */
function revokeDraftImageBlob(img?: DraftPlayerImage | null) {
  const p = img?.previewLogicalPath;
  if (p?.startsWith("blob:")) URL.revokeObjectURL(p);
}

/* Asegura que el default (uiId) es coherente con la lista */
function ensureDefaultImageUiId(list: DraftPlayerImage[], current: string | null): string | null {
  if (!list.length) return null;
  if (current && list.some((x) => x.uiId === current)) return current;
  return list[0]!.uiId;
}

/* Hook: usePlayerImagesDraft */
export function usePlayerImagesDraft() {
  const [draftImages, setDraftImages] = useState<DraftPlayerImage[]>([]);
  const [draftDefaultImageUiId, setDraftDefaultImageUiId] = useState<ID | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSelectButton, setIsHoveringSelectButton] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

useEffect(() => () => draftImages.forEach(revokeDraftImageBlob), []);

  /* Carga el draft desde un PlayerDef (dominio) */
  const loadFromPlayer = (p: PlayerDef) => {
    const next = playerImagesToDraft(p.images);
    const defUiId = resolveDraftDefaultImageUiId(next, p.defaultImageId ?? undefined);
    setDraftImages(next);
    setDraftDefaultImageUiId(defUiId);
  };

  /* Reset completo (y revoca blobs existentes) */
  const resetDraft = () => {
    setDraftImages((prev) => {
      prev.forEach((im) => revokeDraftImageBlob(im));
      return [];
    });
    setDraftDefaultImageUiId(null);
  };

  /** Añadir un File nuevo al draft */
  const addIncomingImageFile = (file: File) => {
    const next = createDraftImageFromFile(file);

    setDraftImages((prev) => {
      const out = [...prev, next];
      const nextDefault = ensureDefaultImageUiId(out, draftDefaultImageUiId);
      setDraftDefaultImageUiId(nextDefault ?? next.uiId);
      return out;
    });

    setDraftDefaultImageUiId((cur) => cur ?? next.uiId);

    return next.uiId;
  };

  /* Input file (añadir) */
  const handleFileChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0] ?? null;
    if (file) addIncomingImageFile(file);
    evt.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    addIncomingImageFile(file);
  };

  /* Eliminar una imagen del draft */
  const removeDraftImage = (uiId: string) => {
    setDraftImages((prev) => {
      const img = prev.find((x) => x.uiId === uiId);
      revokeDraftImageBlob(img);

      const out = prev.filter((x) => x.uiId !== uiId);

      const nextDefault = ensureDefaultImageUiId(out, draftDefaultImageUiId === uiId ? null : draftDefaultImageUiId);
      setDraftDefaultImageUiId(nextDefault);

      return out;
    });
  };

  /* Reemplazar el file de una imagen concreta */
  const replaceDraftImageFile = (uiId: string, file: File) => {
    setDraftImages((prev) =>
      prev.map((im) => {
        if (im.uiId !== uiId) return im;

        revokeDraftImageBlob(im);
        return { ...im, file, previewLogicalPath: URL.createObjectURL(file) };
      })
    );
  };

  const previewLogicalPath = useMemo(() => {
    const def = draftImages.find((x) => x.uiId === draftDefaultImageUiId) ?? draftImages[0];
    return def?.previewLogicalPath;
  }, [draftImages, draftDefaultImageUiId]);


  return { draftImages, setDraftImages, draftDefaultImageUiId, setDraftDefaultImageUiId, fileInputRef, previewLogicalPath, loadFromPlayer, resetDraft,
    addIncomingImageFile, removeDraftImage, replaceDraftImageFile, handleFileChange, isDragging, setIsDragging, isHoveringSelectButton, setIsHoveringSelectButton,
    handleDragOver, handleDragLeave, handleDrop };
}