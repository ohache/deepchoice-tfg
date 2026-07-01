import { memo, useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { PLAYER_CURSOR_DEFAULT_SIZE, type CursorSize } from "@/features/player/hooks/usePlayerCursor";
import { publicPath } from "@/shared/helpers";

type TextCursor = {
  visible: boolean;
  x: number;
  y: number;
};

type PlayerCursorState = {
  visible: boolean;
  x: number;
  y: number;
};

const TEXT_PANEL_SCROLL_TOLERANCE = 2;
const TEXT_PANEL_SCROLLBAR_HIT_AREA_PX = 18;

function hiddenDockTransform(dock: "bottom" | "top" | "left" | "right"): string {
  switch (dock) {
    case "top": return "translateY(-10px)";
    case "bottom": return "translateY(10px)";
    case "left": return "translateX(-10px)";
    case "right": return "translateX(10px)";
  }
}

export const PlayerTextPanel = memo(function PlayerTextPanel(props: {
  text: string;
  cursor: TextCursor;
  dock: "bottom" | "top" | "left" | "right";
  rect: { x: number; y: number; w: number; h: number };
  dockMainSize?: number;
  dockSideSize?: number;
  onMouseMove: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseEnter: (event: MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  disabled?: boolean;
  visible?: boolean;
}) {
  const {
    text,
    cursor,
    dock,
    rect,
    dockMainSize = 176,
    dockSideSize = 320,
    onMouseMove,
    onMouseEnter,
    onMouseLeave,
    disabled,
    visible = true,
  } = props;

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const textContentRef = useRef<HTMLParagraphElement | null>(null);

  const [needsScroll, setNeedsScroll] = useState(false);
  const [useNativeScrollbarCursor, setUseNativeScrollbarCursor] = useState(false);

  const isVerticalDock = dock === "left" || dock === "right";

  function isPointerOverScrollbar(event: MouseEvent<HTMLDivElement>): boolean {
    if (!needsScroll) return false;

    const container = scrollContainerRef.current;
    if (!container) return false;

    const rect = container.getBoundingClientRect();

    return (
      event.clientX >= rect.right - TEXT_PANEL_SCROLLBAR_HIT_AREA_PX &&
      event.clientX <= rect.right + 1 &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  function updateScrollbarCursorMode(event: MouseEvent<HTMLDivElement>): boolean {
    const nextUseNativeCursor = isPointerOverScrollbar(event);

    setUseNativeScrollbarCursor((current) => (current === nextUseNativeCursor ? current : nextUseNativeCursor));

    return nextUseNativeCursor;
  }

  function handlePanelMouseMove(event: MouseEvent<HTMLDivElement>) {
    const shouldUseNativeCursor = updateScrollbarCursorMode(event);

    if (shouldUseNativeCursor) return;

    onMouseMove(event);
  }

  function handlePanelMouseEnter(event: MouseEvent<HTMLDivElement>) {
    const shouldUseNativeCursor = updateScrollbarCursorMode(event);

    if (shouldUseNativeCursor) return;

    onMouseEnter(event);
  }

  function handlePanelMouseLeave() {
    setUseNativeScrollbarCursor(false);
    onMouseLeave();
  }

  useEffect(() => {
    const container = scrollContainerRef.current;
    const content = textContentRef.current;

    if (!container || !content) {
      setNeedsScroll(false);
      return;
    }

    const updateNeedsScroll = () => {
      const nextNeedsScroll = content.scrollHeight > container.clientHeight + TEXT_PANEL_SCROLL_TOLERANCE;

      setNeedsScroll((current) => (current === nextNeedsScroll ? current : nextNeedsScroll));
    };

    updateNeedsScroll();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateNeedsScroll);

    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, [text, dock, rect.x, rect.y, rect.w, rect.h, dockMainSize, dockSideSize, visible]);

  useEffect(() => {
    if (!disabled && visible && needsScroll) return;

    setUseNativeScrollbarCursor(false);
  }, [disabled, visible, needsScroll]);

  if (!text.trim()) return null;

  const baseClass = `absolute z-20 overflow-hidden select-none flex items-center justify-center
    border-slate-700/70 transition-[opacity,transform] duration-200 ease-out
    ${dock === "top" ? "border-b" : dock === "bottom"
      ? "border-t" : dock === "left"
        ? "border-r" : dock === "right"
          ? "border-l" : ""
    }`;

  const styleByDock: CSSProperties = dock === "top"
    ? { left: rect.x, top: Math.max(0, rect.y - dockMainSize), width: rect.w, height: dockMainSize }
    : dock === "bottom"
      ? { left: rect.x, top: rect.y + rect.h, width: rect.w, height: dockMainSize }
      : dock === "left"
        ? { left: rect.x - dockSideSize, top: rect.y, width: dockSideSize, height: rect.h }
        : { left: rect.x + rect.w, top: rect.y, width: dockSideSize, height: rect.h };

  return (
    <div
      className={baseClass}
      style={{
        ...styleByDock,
        cursor: disabled ? "auto" : "none",
        userSelect: "none",
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : hiddenDockTransform(dock),
        pointerEvents: visible ? "auto" : "none",
        padding: isVerticalDock ? "22px 24px" : "24px 34px",
        background: "linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 48px rgba(0,0,0,0.45)",
      }}
      onMouseMove={disabled ? undefined : handlePanelMouseMove}
      onMouseEnter={disabled ? undefined : handlePanelMouseEnter}
      onMouseLeave={disabled ? undefined : handlePanelMouseLeave}
    >
      <div className="pointer-events-none absolute inset-x-8 top-3 h-px bg-linear-to-r from-transparent via-amber-200/20 to-transparent" />
      <div className="pointer-events-none absolute inset-x-8 bottom-3 h-px bg-linear-to-r from-transparent via-cyan-200/10 to-transparent" />

      <div
        ref={scrollContainerRef}
        className={`relative z-10 max-h-full w-full ${needsScroll ? "editor-scroll overflow-y-auto pr-2" : "overflow-y-hidden"}`}
        style={{
          cursor: disabled || useNativeScrollbarCursor ? "auto" : "none",
        }}
      >
        <p
          ref={textContentRef}
          lang="es"
          className={`mx-auto select-none whitespace-pre-line font-light tracking-[0.01em] text-slate-100/95 ${
            isVerticalDock ? "max-w-none text-sm leading-6" : "max-w-[78ch] text-base leading-7"
          }`}
          style={{
            textAlign: "justify",
            textAlignLast: "left",
            hyphens: "auto",
          }}
        >
          {text}
        </p>
      </div>

      {!disabled && !useNativeScrollbarCursor && cursor.visible && (
        <img
          src={publicPath("cursor/idle.png")}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none fixed z-40 object-contain select-none"
          style={{
            left: 0,
            top: 0,
            width: PLAYER_CURSOR_DEFAULT_SIZE.width,
            height: PLAYER_CURSOR_DEFAULT_SIZE.height,
            transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0) translate(-50%, -50%)`,
            willChange: "transform",
            position: "fixed",
          }}
        />
      )}
    </div>
  );
});

export const PlayerCursor = memo(function PlayerCursor(props: { cursor: PlayerCursorState; src: string; size: CursorSize }) {
  const { cursor, src, size } = props;

  if (!cursor.visible) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="pointer-events-none fixed z-999 object-contain select-none"
      style={{
        left: 0,
        top: 0,
        width: size.width,
        height: size.height,
        transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0) translate(-50%, -50%)`,
        willChange: "transform",
      }}
    />
  );
});