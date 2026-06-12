import { useCallback, useRef } from "react";

export type ImageContentRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function useImageContentRect() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const getImageContentRect = useCallback((): ImageContentRect | null => {
    const container = containerRef.current;
    const image = imgRef.current;

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
  }, []);

  return { containerRef, imgRef, getImageContentRect };
}