import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";

export type Rect = { x: number; y: number; w: number; h: number };

type UseObjectContainRectParams = {
  containerRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
};

function areRectsEqual(a: Rect | null, b: Rect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

function calcContentRectInContainer(container: HTMLElement, img: HTMLImageElement): Rect | null {
  const c = container.getBoundingClientRect();

  const nw = img.naturalWidth;
  const nh = img.naturalHeight;

  if (!nw || !nh || c.width <= 0 || c.height <= 0) return null;

  const containerRatio = c.width / c.height;
  const imgRatio = nw / nh;

  let w = c.width;
  let h = c.height;

  if (imgRatio > containerRatio) h = w / imgRatio;
  else w = h * imgRatio;
  
  const x = (c.width - w) / 2;
  const y = (c.height - h) / 2;

  return { x, y, w, h };
}

export function useObjectContainRect({ containerRef, imgRef }: UseObjectContainRectParams) {
  const [contentRectInContainer, setContentRectInContainer] = useState<Rect | null>(null);
  const last = useRef<Rect | null>(null);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;

    if (!container || !img) {
      if (last.current !== null) {
        last.current = null;
        setContentRectInContainer(null);
      }
      return;
    }

    const next = calcContentRectInContainer(container, img);

    if (!next) {
      if (last.current !== null) {
        last.current = null;
        setContentRectInContainer(null);
      }
      return;
    }

    const rounded = {
      x: Math.round(next.x * 1000) / 1000,
      y: Math.round(next.y * 1000) / 1000,
      w: Math.round(next.w * 1000) / 1000,
      h: Math.round(next.h * 1000) / 1000,
    };

    if (!areRectsEqual(rounded, last.current)) {
      last.current = rounded;
      setContentRectInContainer(rounded);
    }
  }, [containerRef, imgRef]);

  useLayoutEffect(() => {
    let raf = 0;
    let ro: ResizeObserver | null = null;

    let cleanup: (() => void) | null = null;

    const attachIfPossible = () => {
      const container = containerRef.current;
      const img = imgRef.current;

      if (!container || !img) {
        raf = requestAnimationFrame(attachIfPossible);
        return;
      }

      if (cleanup) return;

      const onWin = () => recompute();
      const onImgLoad = () => recompute();

      ro = new ResizeObserver(() => recompute());
      ro.observe(container);

      window.addEventListener("resize", onWin, { passive: true });
      window.addEventListener("scroll", onWin, { passive: true });
      img.addEventListener("load", onImgLoad);

      recompute();
      if (img.complete) {
        requestAnimationFrame(() => recompute());
      }

      cleanup = () => {
        ro?.disconnect();
        ro = null;
        window.removeEventListener("resize", onWin);
        window.removeEventListener("scroll", onWin);
        img.removeEventListener("load", onImgLoad);
        cleanup = null;
      };
    };

    attachIfPossible();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (cleanup) cleanup();
    };
  }, [recompute, containerRef, imgRef]);

  const toContainerPx = useMemo(() => {
    return (p: { x: number; y: number }) => {
      const container = containerRef.current;
      if (!container) return null;
      const box = container.getBoundingClientRect();
      return { x: p.x - box.left, y: p.y - box.top };
    };
  }, [containerRef]);

  return { contentRectInContainer, recompute, toContainerPx };
}
