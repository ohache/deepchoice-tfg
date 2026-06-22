import { publicPath } from "@/shared/helpers";
import type { CSSProperties } from "react";

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
};

type PlayerBottomBarButtonProps = {
  label: string;
  title: string;
  iconSrc: string;
  onClick: () => void;
};

function PlayerBottomBarButton({ label, title, iconSrc, onClick }: PlayerBottomBarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-20 w-20 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/85 p-0 transition hover:border-slate-500 hover:bg-slate-800/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
      aria-label={label}
      title={title}
      style={{ cursor: "pointer" }}
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

export function PlayerBottomBar({ open, anchorRect, onToggle, onClose, onOpenInventory, onOpenMap, onOpenSettings, onToggleFullscreen }: PlayerBottomBarProps) {
  const anchorStyle: CSSProperties = anchorRect
    ? { left: anchorRect.x, width: anchorRect.w, bottom: `calc(100% - ${anchorRect.y + anchorRect.h}px)` }
    : { left: "50%", width: "min(100%, 48rem)", bottom: 0, transform: "translateX(-50%)" };

  return (
    <div
      className={`absolute inset-0 z-30 +  ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      onClick={() => { if (open) onClose() }}
      style={{ cursor: "auto" }}
    >

      <div
        className="absolute flex flex-col items-center justify-end"
        style={{
          ...anchorStyle,
          cursor: "auto",
        }}
      >

        {open ? (
          <div
            className="pointer-events-auto flex min-h-32 w-full max-w-3xl items-center justify-center rounded-t-3xl border border-b-0 border-slate-800/90 bg-slate-950/92 px-10 py-5 shadow-2xl backdrop-blur animate-[bottomBarUp_180ms_ease-out]"
            onClick={(event) => event.stopPropagation()}
            onMouseMove={(event) => event.stopPropagation()}
            onMouseEnter={(event) => event.stopPropagation()}
            style={{ cursor: "auto" }}
          >
            <div className="flex w-full items-center justify-center gap-6">
              <PlayerBottomBarButton
                label="Abrir mapa"
                title="Mapa"
                iconSrc={publicPath("ui/map.png")}
                onClick={onOpenMap}
              />

              <PlayerBottomBarButton
                label="Abrir inventario"
                title="Inventario"
                iconSrc={publicPath("ui/inventory.png")}
                onClick={onOpenInventory}
              />

              {onOpenSettings ? (
                <PlayerBottomBarButton
                  label="Abrir configuración"
                  title="Configuración"
                  iconSrc={publicPath("ui/settings.png")}
                  onClick={onOpenSettings}
                />
              ) : null}

              {onToggleFullscreen ? (
                <PlayerBottomBarButton
                  label="Pantalla completa"
                  title="Pantalla completa"
                  iconSrc={publicPath("ui/fullScene.png")}
                  onClick={onToggleFullscreen}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="pointer-events-auto mb-2 flex h-8 w-12 items-center justify-center rounded-md bg-slate-900/35 text-slate-200 opacity-70 transition hover:bg-slate-900/60 hover:opacity-100 focus:outline-none"
            aria-label="Abrir barra inferior"
            style={{ cursor: "pointer" }}
          >
            <span className="text-sm leading-none">▲</span>
          </button>
        )}
      </div>
    </div>
  );
}