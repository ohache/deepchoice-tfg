import { useEffect, useMemo, useRef, useState } from "react";
import type { ID, PlayerDef, PlayerImage } from "@/domain/types";
import { generateId } from "@/utils/id";

type DraftPlayerImage = {
  uiId: ID;
  imageId?: ID;
  name: string;
  file?: File;
  previewSource?: string;
};

function playerImagesToDraft(images: PlayerImage[] | undefined): DraftPlayerImage[] {
  return (images ?? []).map((img) => ({ uiId: generateId.playerImage(), imageId: img.id, name: img.name, file: undefined, previewSource: img.id }));
}

/* Devuelve el uiId draft que corresponde al defaultImageId del dominio */
function resolveDraftDefaultImageUiId(draft: DraftPlayerImage[], defaultImageId?: ID): string | null {
  if (!draft.length) return null;

  const found = defaultImageId ? draft.find((image) => image.imageId === defaultImageId)?.uiId : undefined;

  return found ?? draft[0]!.uiId;
}

/* Crea un draft a partir de un File entrante */
function createDraftImageFromFile(file: File): DraftPlayerImage {
  return { uiId: generateId.playerImage(), name: file.name.replace(/\.[^.]+$/, ""), file, previewSource: URL.createObjectURL(file) };
}

/* Revoca el blob si el draft apunta a blob:... */
function revokeDraftImageBlob(image?: DraftPlayerImage | null) {
  const path = image?.previewSource;
  if (path?.startsWith("blob:")) URL.revokeObjectURL(path);
}

function revokeDraftImageBlobs(images: DraftPlayerImage[]) {
  images.forEach(revokeDraftImageBlob);
}

/* Asegura que el default (uiId) es coherente con la lista */
function ensureDefaultImageUiId(list: DraftPlayerImage[], current: string | null): string | null {
  if (!list.length) return null;
  if (current && list.some((image) => image.uiId === current)) return current;
  return list[0]!.uiId;
}

export function usePlayerImagesDraft() {
  const [draftImages, setDraftImages] = useState<DraftPlayerImage[]>([]);
  const [draftDefaultImageUiId, setDraftDefaultImageUiId] = useState<ID | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringSelectButton, setIsHoveringSelectButton] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const latestDraftImagesRef = useRef<DraftPlayerImage[]>([]);

  useEffect(() => { latestDraftImagesRef.current = draftImages; }, [draftImages]);

  useEffect(() => () => revokeDraftImageBlobs(latestDraftImagesRef.current), []);

  /* Carga el draft desde un PlayerDef (dominio) */
  const loadFromPlayer = (player: PlayerDef) => {
    const nextDraft = playerImagesToDraft(player.images);

    setDraftImages((prev) => {
      revokeDraftImageBlobs(prev);
      return nextDraft;
    });

    setDraftDefaultImageUiId(resolveDraftDefaultImageUiId(nextDraft, player.defaultImageId ?? undefined));
    setIsDragging(false);
    setIsHoveringSelectButton(false);
  };

  /* Reset completo (y revoca blobs existentes) */
  const resetDraft = () => {
    setDraftImages((prev) => {
      revokeDraftImageBlobs(prev);
      return [];
    });

    setDraftDefaultImageUiId(null);
    setIsDragging(false);
    setIsHoveringSelectButton(false);
  };

  /* Añadir un File nuevo al draft */
  const addIncomingImageFile = (file: File) => {
    const nextImage = createDraftImageFromFile(file);

    setDraftImages((prev) => {
      const nextList = [...prev, nextImage];
      return nextList;
    });

    setDraftDefaultImageUiId((current) => current ?? nextImage.uiId);

    return nextImage.uiId;
  };

  /* Input file (añadir) */
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) addIncomingImageFile(file);
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    addIncomingImageFile(file);
  };

  /* Eliminar una imagen del draft */
  const removeDraftImage = (uiId: string) => {
    setDraftImages((prev) => {
      const image = prev.find((current) => current.uiId === uiId);
      revokeDraftImageBlob(image);

      const nextList = prev.filter((current) => current.uiId !== uiId);

      setDraftDefaultImageUiId((currentDefault) => ensureDefaultImageUiId(nextList, currentDefault === uiId ? null : currentDefault));

      return nextList;
    });
  };

  /* Reemplazar el file de una imagen concreta y actualizar su nombre */
  const replaceDraftImageFile = (uiId: string, file: File) => {
    setDraftImages((prev) =>
      prev.map((image) => {
        if (image.uiId !== uiId) return image;

        revokeDraftImageBlob(image);

        return {
          ...image,
          name: file.name.replace(/\.[^.]+$/, ""),
          file,
          previewSource: URL.createObjectURL(file),
        };
      }),
    );
  };

  const renameDraftImage = (uiId: string, name: string) => setDraftImages((prev) => prev.map((image) => image.uiId === uiId ? { ...image, name } : image));

  const previewSource = useMemo(() => {
    const defaultImage = draftImages.find((image) => image.uiId === draftDefaultImageUiId) ?? draftImages[0];

    return defaultImage?.previewSource;
  }, [draftImages, draftDefaultImageUiId]);

  return {
    draftImages, draftDefaultImageUiId, setDraftDefaultImageUiId, fileInputRef, previewSource, loadFromPlayer, resetDraft, addIncomingImageFile,
    renameDraftImage, removeDraftImage, replaceDraftImageFile, handleFileChange, isDragging, setIsDragging, isHoveringSelectButton,
    setIsHoveringSelectButton, handleDragOver, handleDragLeave, handleDrop
  };
}