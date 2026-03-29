import { useCallback, useRef } from "react";

export function useImageContentRect() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const getImageContentRect = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return null;

    const c = container.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return null;

    const containerRatio = c.width / c.height;
    const imgRatio = nw / nh;

    let w = c.width;
    let h = c.height;
    let x = 0;
    let y = 0;

    if (imgRatio > containerRatio) {
      // “cabe” por ancho, sobran bandas arriba/abajo
      h = w / imgRatio;
      y = (c.height - h) / 2;
    } else {
      // “cabe” por alto, sobran bandas izquierda/derecha
      w = h * imgRatio;
      x = (c.width - w) / 2;
    }

    // OJO: ahora x/y son relativos al contenedor
    return { x, y, w, h };
  }, []);

  return { containerRef, imgRef, getImageContentRect };
}