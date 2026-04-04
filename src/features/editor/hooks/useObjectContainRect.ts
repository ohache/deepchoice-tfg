import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type UseObjectContainRectParams = {
  containerRef: RefObject<HTMLElement | null>;
  imgRef: RefObject<HTMLImageElement | null>;
};

/* Comparación exacta de rects ya redondeados */
function areRectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/* Redondea para evitar ruido de decimales y renders innecesarios */
function roundRect(rect: Rect): Rect {
  return {
    x: Math.round(rect.x * 1000) / 1000,
    y: Math.round(rect.y * 1000) / 1000,
    w: Math.round(rect.w * 1000) / 1000,
    h: Math.round(rect.h * 1000) / 1000,
  };
}

/* Calcula el rectángulo real visible de una imagen con object-contain dentro del contenedor */
function calcContentRectInContainer(container: HTMLElement, img: HTMLImageElement): Rect | null {
  const containerBox = container.getBoundingClientRect();

  const naturalWidth = img.naturalWidth;
  const naturalHeight = img.naturalHeight;

  if (!naturalWidth || !naturalHeight) return null;
  if (containerBox.width <= 0 || containerBox.height <= 0) return null;

  const containerRatio = containerBox.width / containerBox.height;
  const imageRatio = naturalWidth / naturalHeight;

  let width = containerBox.width;
  let height = containerBox.height;

  if (imageRatio > containerRatio) {
    height = width / imageRatio;
  } else {
    width = height * imageRatio;
  }

  const x = (containerBox.width - width) / 2;
  const y = (containerBox.height - height) / 2;

  return { x, y, w: width, h: height };
}

/* Hook que calcula el área visible real de una imagen renderizada con object-contain */
export function useObjectContainRect({ containerRef, imgRef }: UseObjectContainRectParams) {
  const [contentRectInContainer, setContentRectInContainer] = useState<Rect | null>(null);
  const lastRectRef = useRef<Rect | null>(null);

  const updateRect = useCallback((next: Rect | null) => {
    if (areRectsEqual(next, lastRectRef.current)) return;

    lastRectRef.current = next;
    setContentRectInContainer(next);
  }, []);

  /* Recalcula el rectángulo visible actual */
  const recompute = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;

    if (!container || !img) {
      updateRect(null);
      return;
    }

    const next = calcContentRectInContainer(container, img);
    updateRect(next ? roundRect(next) : null);
  }, [containerRef, imgRef, updateRect]);

  useLayoutEffect(() => {
    let raf = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;

    const attachIfPossible = () => {
      const container = containerRef.current;
      const img = imgRef.current;

      if (!container || !img) {
        raf = requestAnimationFrame(attachIfPossible);
        return;
      }

      if (cleanup) return;

      const handleWindowChange = () => recompute();
      const handleImageLoad = () => recompute();

      resizeObserver = new ResizeObserver(() => recompute());
      resizeObserver.observe(container);

      window.addEventListener("resize", handleWindowChange, { passive: true });
      window.addEventListener("scroll", handleWindowChange, { passive: true });
      img.addEventListener("load", handleImageLoad);

      recompute();

      if (img.complete) requestAnimationFrame(() => recompute());

      cleanup = () => {
        resizeObserver?.disconnect();
        resizeObserver = null;

        window.removeEventListener("resize", handleWindowChange);
        window.removeEventListener("scroll", handleWindowChange);
        img.removeEventListener("load", handleImageLoad);

        cleanup = null;
      };
    };

    attachIfPossible();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (cleanup) cleanup();
    };
  }, [recompute, containerRef, imgRef]);

  /* Convierte un punto absoluto del viewport a coordenadas relativas al contenedor */
  const toContainerPx = useCallback(
    (point: { x: number; y: number }) => {
      const container = containerRef.current;
      if (!container) return null;

      const box = container.getBoundingClientRect();

      return {
        x: point.x - box.left,
        y: point.y - box.top,
      };
    },
    [containerRef],
  );

  return { contentRectInContainer, recompute, toContainerPx };
}