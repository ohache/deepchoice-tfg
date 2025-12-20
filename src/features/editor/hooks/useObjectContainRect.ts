import { useCallback, useLayoutEffect, useMemo, useState, useRef } from "react";

export type Rect = { x: number; y: number; w: number; h: number };

export type ContainedRect = {
  contentViewport: { x: number; y: number; w: number; h: number };
  containerViewport: { x: number; y: number; w: number; h: number };
};

type UseObjectContainRectParams = {
  containerRef: React.RefObject<HTMLElement | null>;
  imgRef: React.RefObject<HTMLImageElement | null>;
};

function calcObjectContainRect(container: HTMLElement, img: HTMLImageElement): ContainedRect | null {
  const c = container.getBoundingClientRect();
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh || c.width <= 0 || c.height <= 0) return null;

  const containerRatio = c.width / c.height;
  const imgRatio = nw / nh;

  let w = c.width;
  let h = c.height;
  let x = c.left;
  let y = c.top;

  if (imgRatio > containerRatio) {
    h = w / imgRatio;
    y = c.top + (c.height - h) / 2;
  } else {
    w = h * imgRatio;
    x = c.left + (c.width - w) / 2;
  }

  const contentViewport = { x, y, w, h };
  const containerViewport = { x: c.left, y: c.top, w: c.width, h: c.height };

  return { contentViewport, containerViewport };
}

export function useObjectContainRect({ containerRef, imgRef }: UseObjectContainRectParams) {
  const [rect, setRect] = useState<ContainedRect | null>(null);
  const lastRect = useRef<ContainedRect | null>(null);

  const recompute = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) {
      if (lastRect.current !== null) {
        lastRect.current = null;
        setRect(null);
      }
      return;
    }

    const newRect = calcObjectContainRect(container, img);
    if (newRect && !areRectsEqual(newRect, lastRect.current)) {
      setRect(newRect); // Solo actualizamos si el nuevo rect es diferente
      lastRect.current = newRect; // Guardamos el rect actualizado
    }
  }, [containerRef, imgRef]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return;

    recompute();

    const ro = new ResizeObserver(() => recompute());
    ro.observe(container);

    const onWin = () => recompute();
    window.addEventListener("resize", onWin, { passive: true });
    window.addEventListener("scroll", onWin, { passive: true });

    const onImgLoad = () => recompute();
    img.addEventListener("load", onImgLoad);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin);
      img.removeEventListener("load", onImgLoad);
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

  const contentOffsetInContainer = useMemo(() => {
    if (!rect) return null;
    const container = containerRef.current;
    if (!container) return null;
    const box = container.getBoundingClientRect();
    return { ox: rect.contentViewport.x - box.left, oy: rect.contentViewport.y - box.top };
  }, [rect, containerRef]);

  // Función para comparar dos objetos Rect
  function areRectsEqual(a: ContainedRect | null, b: ContainedRect | null) {
    if (a === b) return true;
    if (!a || !b) return false;

    return (
      a.contentViewport.x === b.contentViewport.x &&
      a.contentViewport.y === b.contentViewport.y &&
      a.contentViewport.w === b.contentViewport.w &&
      a.contentViewport.h === b.contentViewport.h &&
      a.containerViewport.x === b.containerViewport.x &&
      a.containerViewport.y === b.containerViewport.y &&
      a.containerViewport.w === b.containerViewport.w &&
      a.containerViewport.h === b.containerViewport.h
    );
  }

  return { rect, recompute, toContainerPx, contentOffsetInContainer };
}
