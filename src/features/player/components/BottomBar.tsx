type BottomBarProps = {
  open: boolean;
  isFinal?: boolean;
  onToggle: () => void;
  onOpenInventory: () => void;
  onOpenMap: () => void;
  onOpenSettings?: () => void;
  onToggleFullscreen?: () => void;
  onExit?: () => void;
};

export function BottomBar({
  open,
  isFinal = false,
  onToggle,
  onOpenInventory,
  onOpenMap,
  onOpenSettings,
  onToggleFullscreen,
  onExit,
}: BottomBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
      <style>{`
        @keyframes bottomBarUp {
          0% {
            opacity: 0;
            transform: translateY(24px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div className="relative flex w-full max-w-5xl flex-col items-center">
        {isFinal ? (
          <div className="pointer-events-auto mb-2 flex justify-center">
            <div className="text-center space-y-2 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-2 backdrop-blur-sm">
              <p className="text-sm text-emerald-300">Has llegado al final de esta aventura.</p>

              {onExit ? (
                <button
                  type="button"
                  onClick={onExit}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                  Volver al inicio
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {open ? (
          <div className="pointer-events-auto mb-2 flex items-center justify-center rounded-t-2xl border border-slate-800/90 border-b-0 bg-slate-950/90 px-6 py-3 shadow-2xl backdrop-blur animate-[bottomBarUp_180ms_ease-out]">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onOpenMap}
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 transition hover:border-slate-500 hover:bg-slate-800/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                aria-label="Abrir mapa"
                title="Mapa"
              >
                <img
                  src="/ui/map.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="h-9 w-9 object-contain select-none"
                />
              </button>

              <button
                type="button"
                onClick={onOpenInventory}
                className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 transition hover:border-slate-500 hover:bg-slate-800/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                aria-label="Abrir inventario"
                title="Inventario"
              >
                <img
                  src="/ui/inventory.png"
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  className="h-9 w-9 object-contain select-none"
                />
              </button>

              {onOpenSettings ? (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 transition hover:border-slate-500 hover:bg-slate-800/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  aria-label="Abrir configuración"
                  title="Configuración"
                >
                  <img
                    src="/ui/settings.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-9 w-9 object-contain select-none"
                  />
                </button>
              ) : null}

              {onToggleFullscreen ? (
                <button
                  type="button"
                  onClick={onToggleFullscreen}
                  className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/80 transition hover:border-slate-500 hover:bg-slate-800/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
                  aria-label="Pantalla completa"
                  title="Pantalla completa"
                >
                  <img
                    src="/ui/fullScene.png"
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className="h-9 w-9 object-contain select-none"
                  />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onToggle}
          className="pointer-events-auto mb-1 flex h-7 w-10 items-center justify-center rounded-md bg-slate-900/30 text-slate-200 transition hover:bg-slate-900/50 focus:outline-none opacity-70 hover:opacity-100"
          aria-label={open ? "Cerrar barra inferior" : "Abrir barra inferior"}
        >
          <span className="text-sm leading-none">{open ? "▼" : "▲"}</span>
        </button>
      </div>
    </div>
  );
}