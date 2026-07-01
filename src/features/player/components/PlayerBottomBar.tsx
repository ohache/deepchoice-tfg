import type { CSSProperties, MouseEvent } from "react";
import { publicPath } from "@/shared/helpers";
import { CircleSmall } from "lucide-react";

type AnchorRect = { x: number; y: number; w: number; h: number };

type PlayerBottomBarProps = {
  open: boolean;
  anchorRect?: AnchorRect | null;
  onToggle: () => void;
  onClose: () => void;
  onOpenInventory: () => void;
  onOpenMap: () => void;
  onOpenSettings?: () => void;
  onToggleFullscreen?: () => void;
  onCursorMove?: (event: MouseEvent) => void;
  onCursorEnter?: (event: MouseEvent) => void;
  onCursorLeave?: () => void;
};

type PlayerBottomBarButtonProps = {
  label: string;
  title: string;
  iconSrc: string;
  onClick: () => void;
  onCursorMove?: (event: MouseEvent) => void;
  onCursorEnter?: (event: MouseEvent) => void;
  onCursorLeave?: () => void;
};

function PlayerBottomBarButton({ label, title, iconSrc, onClick, onCursorMove, onCursorEnter, onCursorLeave }: PlayerBottomBarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseMove={onCursorMove}
      onMouseEnter={onCursorEnter}
      onMouseLeave={onCursorLeave}
      className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/85 p-0 transition hover:border-slate-500 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
      aria-label={label}
      title={title}
      style={{ cursor: "none" }}
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-full w-full object-contain select-none p-1"
      />
    </button>
  );
}

export function PlayerBottomBar({ open, anchorRect, onToggle, onClose, onOpenInventory, onOpenMap, onOpenSettings, onToggleFullscreen,
  onCursorMove, onCursorEnter, onCursorLeave }: PlayerBottomBarProps) {
  const anchorStyle: CSSProperties = anchorRect
    ? { left: anchorRect.x, width: anchorRect.w, bottom: `calc(100% - ${anchorRect.y + anchorRect.h}px)` }
    : { left: "50%", width: "min(100%, 48rem)", bottom: 0, transform: "translateX(-50%)" };

  return (
    <div
      className={`absolute inset-0 z-30 ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      onClick={() => { if (open) onClose() }}
      onMouseMove={open ? onCursorMove : undefined}
      onMouseEnter={open ? onCursorEnter : undefined}
      onMouseLeave={open ? onCursorLeave : undefined}
      style={{ cursor: "none" }}
    >

      <div
        className="absolute flex flex-col items-center justify-end"
        style={{
          ...anchorStyle,
          cursor: "none",
        }}
      >

        {open ? (
          <div
            className="pointer-events-auto flex min-h-32 w-full max-w-3xl items-center justify-center rounded-t-3xl border border-b-0 border-slate-800/90 bg-slate-950/92 px-10 py-5 shadow-2xl backdrop-blur animate-[bottomBarUp_180ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
            onMouseMove={(event) => {
              onCursorMove?.(event);
              event.stopPropagation();
            }}
            onMouseEnter={(event) => {
              onCursorEnter?.(event);
              event.stopPropagation();
            }}
            onMouseLeave={(event) => {
              onCursorMove?.(event);
            }}
            style={{ cursor: "none" }}
          >
            <div className="flex w-full items-center justify-center gap-6">
              <PlayerBottomBarButton
                label="Abrir mapa"
                title="Mapa"
                iconSrc={publicPath("ui/map.png")}
                onClick={onOpenMap}
                onCursorMove={onCursorMove}
                onCursorEnter={onCursorEnter}
                onCursorLeave={onCursorLeave}
              />

              <PlayerBottomBarButton
                label="Abrir inventario"
                title="Inventario"
                iconSrc={publicPath("ui/inventory.png")}
                onClick={onOpenInventory}
                onCursorMove={onCursorMove}
                onCursorEnter={onCursorEnter}
                onCursorLeave={onCursorLeave}
              />

              {onOpenSettings ? (
                <PlayerBottomBarButton
                  label="Abrir configuración"
                  title="Configuración"
                  iconSrc={publicPath("ui/settings.png")}
                  onClick={onOpenSettings}
                  onCursorMove={onCursorMove}
                  onCursorEnter={onCursorEnter}
                  onCursorLeave={onCursorLeave}
                />
              ) : null}

              {onToggleFullscreen ? (
                <PlayerBottomBarButton
                  label="Pantalla completa"
                  title="Pantalla completa"
                  iconSrc={publicPath("ui/fullScene.png")}
                  onClick={onToggleFullscreen}
                  onCursorMove={onCursorMove}
                  onCursorEnter={onCursorEnter}
                  onCursorLeave={onCursorLeave}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            onMouseMove={onCursorMove}
            onMouseEnter={onCursorEnter}
            onMouseLeave={onCursorLeave}
            className="pointer-events-auto mb-2 flex h-9 w-13 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-950/25 text-slate-300 opacity-75 
              shadow-lg shadow-black/20 backdrop-blur transition hover:border-slate-500/80 hover:bg-slate-950/40 hover:text-slate-100 hover:opacity-100 focus:outline-none 
              focus-visible:ring-2 focus-visible:ring-amber-400/70"
            aria-label="Abrir barra inferior"
            style={{ cursor: "none" }}
          >
            <CircleSmall
              aria-hidden="true"
              size={18}
              strokeWidth={1.8}
            />
          </button>
        )}
      </div>
    </div>
  );
}