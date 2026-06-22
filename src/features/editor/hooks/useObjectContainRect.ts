import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type Rect = { x: number; y: number; w: number; h: number };

type UseObjectContainRectParams = {
  containerRef: RefObject<HTMLElement | null>;
  imgRef: RefObject<HTMLImageElement | null>;
};

const RECT_PRECISION = 1000;

/* Comparación exacta de rects ya redondeados */
function areRectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function roundCoord(value: number): number {
  return Math.round(value * RECT_PRECISION) / RECT_PRECISION;
}

/* Redondea para evitar ruido de decimales y renders innecesarios */
function roundRect(rect: Rect): Rect {
  return { x: roundCoord(rect.x), y: roundCoord(rect.y), w: roundCoord(rect.w), h: roundCoord(rect.h) };
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

  if (!Number.isFinite(containerRatio) || !Number.isFinite(imageRatio)) return null;

  let width = containerBox.width;
  let height = containerBox.height;

  if (imageRatio > containerRatio) height = width / imageRatio;
  else width = height * imageRatio;

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
    let disposed = false;
    let attachRaf = 0;
    let recomputeRaf = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanupListeners: (() => void) | null = null;

    const cancelAttachRaf = () => {
      if (!attachRaf) return;

      cancelAnimationFrame(attachRaf);
      attachRaf = 0;
    };

    const cancelRecomputeRaf = () => {
      if (!recomputeRaf) return;

      cancelAnimationFrame(recomputeRaf);
      recomputeRaf = 0;
    };

    const requestRecompute = () => {
      cancelRecomputeRaf();

      recomputeRaf = requestAnimationFrame(() => {
        recomputeRaf = 0;

        if (!disposed) recompute();
      });
    };

    const attachIfPossible = () => {
      if (disposed) return;

      const container = containerRef.current;
      const img = imgRef.current;

      if (!container || !img) {
        attachRaf = requestAnimationFrame(attachIfPossible);
        return;
      }

      if (cleanupListeners) return;

      const handleWindowChange = () => requestRecompute();
      const handleImageChange = () => requestRecompute();

      resizeObserver = new ResizeObserver(requestRecompute);
      resizeObserver.observe(container);

      window.addEventListener("resize", handleWindowChange, { passive: true });
      window.addEventListener("scroll", handleWindowChange, { passive: true });

      img.addEventListener("load", handleImageChange);
      img.addEventListener("error", handleImageChange);

      requestRecompute();

      if (img.complete) requestRecompute();

      cleanupListeners = () => {
        resizeObserver?.disconnect();
        resizeObserver = null;

        window.removeEventListener("resize", handleWindowChange);
        window.removeEventListener("scroll", handleWindowChange);

        img.removeEventListener("load", handleImageChange);
        img.removeEventListener("error", handleImageChange);

        cleanupListeners = null;
      };
    };

    attachIfPossible();

    return () => {
      disposed = true;

      cancelAttachRaf();
      cancelRecomputeRaf();

      cleanupListeners?.();
    };
  }, [containerRef, imgRef, recompute]);

  /* Convierte un punto absoluto del viewport a coordenadas relativas al contenedor */
  const toContainerPx = useCallback((point: { x: number; y: number }) => {
    const container = containerRef.current;
    if (!container) return null;

    const box = container.getBoundingClientRect();

    return { x: point.x - box.left, y: point.y - box.top };
  }, [containerRef],
  );

  return { contentRectInContainer, recompute, toContainerPx };
}