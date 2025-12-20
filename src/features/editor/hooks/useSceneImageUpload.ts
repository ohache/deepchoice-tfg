import { useCallback, useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { handleSceneImageFileChange, processSceneImageFile } from "@/features/editor/components/scene/SceneCommon";

interface UseSceneImageUploadOptions {
    onImagePathChange: (relativePath: string) => void;
    registerAssetFile: (relativePath: string, file: File) => void;
}

export function useSceneImageUpload({ onImagePathChange, registerAssetFile }: UseSceneImageUploadOptions) {
    const [imageLocalError, setImageLocalError] = useState<string | null>(null);
    const [isImageDragging, setIsImageDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleImageChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            handleSceneImageFileChange(event, {
                setImageLocalError,
                onValidImagePath: (relativePath, file) => {
                    onImagePathChange(relativePath);
                    registerAssetFile(relativePath, file);
                },
            });
        }, [onImagePathChange, registerAssetFile]
    );

    const handleImageDragOver = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setIsImageDragging(true);
        }, []
    );

    const handleImageDragLeave = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setIsImageDragging(false);
        }, []
    );

    const handleImageDrop = useCallback(
        (event: DragEvent<HTMLDivElement>) => {
            event.preventDefault();
            event.stopPropagation();
            setIsImageDragging(false);

            const file = event.dataTransfer.files?.[0];
            if (!file) return;

            processSceneImageFile(file, {
                setImageLocalError,
                onValidImagePath: (relativePath, validFile) => {
                    onImagePathChange(relativePath);
                    registerAssetFile(relativePath, validFile);
                },
            });
        }, [onImagePathChange, registerAssetFile]
    );

    return { fileInputRef, imageLocalError, isImageDragging, handleImageChange,
        handleImageDragOver, handleImageDragLeave, handleImageDrop
    };
}