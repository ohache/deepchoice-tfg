import { useCallback, useEffect, useState } from "react";

export type ImageContentRect = { x: number; y: number; w: number; h: number };

function areRectsEqual(a: ImageContentRect | null, b: ImageContentRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/* Calcula el rectángulo real ocupado por una imagen object-contain dentro de su contenedor */
function calculateImageContentRect(container: HTMLDivElement | null, image: HTMLImageElement | null): ImageContentRect | null {
  if (!container || !image) return null;

  const containerRect = container.getBoundingClientRect();
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;

  if (!naturalWidth || !naturalHeight || !containerRect.width || !containerRect.height) return null;

  const containerRatio = containerRect.width / containerRect.height;
  const imageRatio = naturalWidth / naturalHeight;

  let width = containerRect.width;
  let height = containerRect.height;
  let x = 0;
  let y = 0;

  if (imageRatio > containerRatio) {
    height = width / imageRatio;
    y = (containerRect.height - height) / 2;
  } else {
    width = height * imageRatio;
    x = (containerRect.width - width) / 2;
  }

  return { x, y, w: width, h: height };
}

/* Hook encargado de medir la zona real de imagen dentro de SceneStage */
export function useImageContentRect() {
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [contentRect, setContentRect] = useState<ImageContentRect | null>(null);

  const containerRef = useCallback((node: HTMLDivElement | null) => setContainerElement(node), []);
  const imgRef = useCallback((node: HTMLImageElement | null) => setImageElement(node), []);

  const getImageContentRect = useCallback((): ImageContentRect | null => {
    return calculateImageContentRect(containerElement, imageElement);
  }, [containerElement, imageElement]);

  /* Recalcula y guarda el rectángulo actual */
  const refreshImageContentRect = useCallback((): ImageContentRect | null => {
    const next = calculateImageContentRect(containerElement, imageElement);

    setContentRect((prev) => (areRectsEqual(prev, next) ? prev : next));

    return next;
  }, [containerElement, imageElement]);

  /* Observa cambios reales de tamaño del contenedor y de la imagen */
  useEffect(() => {
    if (!containerElement || !imageElement) {
      setContentRect(null);
      return;
    }

    refreshImageContentRect();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", refreshImageContentRect);
      return () => window.removeEventListener("resize", refreshImageContentRect);
    }

    const observer = new ResizeObserver(() => refreshImageContentRect());

    observer.observe(containerElement);
    observer.observe(imageElement);

    window.addEventListener("resize", refreshImageContentRect);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refreshImageContentRect);
    };
  }, [containerElement, imageElement, refreshImageContentRect]);

  return {
    containerRef, imgRef, containerElement, imageElement, contentRect, getImageContentRect, refreshImageContentRect
  };
}