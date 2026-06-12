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

type CursorSize = {
  width: number;
  height: number;
};

export function PlayerTextPanel(props: {
  text: string;
  cursor: TextCursor;
  dock: "bottom" | "top" | "left" | "right";
  rect: { x: number; y: number; w: number; h: number };
  dockMainSize?: number;
  dockSideSize?: number;
  onMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseEnter: (event: React.MouseEvent<HTMLDivElement>) => void;
  onMouseLeave: () => void;
  disabled?: boolean;
}) {
  const { text, cursor, dock, rect, dockMainSize = 160, dockSideSize = 280, onMouseMove, onMouseEnter, onMouseLeave, disabled } = props;

  if (!text.trim()) return null;

  const baseClass = [
    "absolute z-20 overflow-y-auto bg-[#0a0a0a] px-5 py-4 select-none",
    "flex items-center justify-center",
    dock === "top" ? "border-b border-slate-800" : "",
    dock === "bottom" ? "border-t border-slate-800" : "",
    dock === "left" ? "border-r border-slate-800" : "",
    dock === "right" ? "border-l border-slate-800" : "",
  ].join(" ");

  const styleByDock: React.CSSProperties =
    dock === "top"
      ? {
        left: rect.x,
        top: Math.max(0, rect.y - dockMainSize),
        width: rect.w,
        height: dockMainSize,
      }
      : dock === "bottom"
        ? {
          left: rect.x,
          top: rect.y + rect.h,
          width: rect.w,
          height: dockMainSize,
        }
        : dock === "left"
          ? {
            left: rect.x - dockSideSize,
            top: rect.y,
            width: dockSideSize,
            height: rect.h,
          }
          : {
            left: rect.x + rect.w,
            top: rect.y,
            width: dockSideSize,
            height: rect.h,
          };

  return (
    <div
      className={baseClass}
      style={{
        ...styleByDock,
        cursor: disabled ? "auto" : "none",
        userSelect: "none",
      }}
      onMouseMove={disabled ? undefined : onMouseMove}
      onMouseEnter={disabled ? undefined : onMouseEnter}
      onMouseLeave={disabled ? undefined : onMouseLeave}
    >
      <p className="max-w-3xl select-none whitespace-pre-line text-center text-sm leading-relaxed text-slate-100">
        {text}
      </p>

      {!disabled && cursor.visible && (
        <img
          src="/cursor/idle.png"
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none fixed z-40 h-12 w-12 object-contain select-none"
          style={{
            left: cursor.x - 24,
            top: cursor.y - 24,
            position: "fixed",
          }}
        />
      )}
    </div>
  );
}

export function PlayerCursor(props: {
  cursor: PlayerCursorState;
  src: string;
  size: CursorSize;
}) {
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
        left: cursor.x,
        top: cursor.y,
        width: size.width,
        height: size.height,
        transform: "translate(-50%, -50%)",
      }}
    />
  );
}

export function SceneMessageOverlay({ text }: { text?: string }) {
  if (!text) return null;

  return (
    <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
      <div className="pointer-events-auto max-w-2xl rounded-xl border border-slate-500/50 bg-slate-950/85 px-4 py-3 text-sm text-slate-100 shadow-xl backdrop-blur">
        <p className="whitespace-pre-line leading-relaxed">{text}</p>
      </div>
    </div>
  );
}