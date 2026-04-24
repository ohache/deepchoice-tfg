import type { ReactNode } from "react";

interface SceneTestToolbarProps {
  canGoPrevScene: boolean;
  canGoNextScene: boolean;
  onPrevScene: () => void;
  onNextScene: () => void;
}

function ToolbarButton({ children, onClick, disabled = false }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={"rounded-md border px-2.5 py-1 text-xs transition-colors " +
        (disabled
          ? "border-slate-700 bg-slate-900/50 text-slate-500 cursor-not-allowed"
          : "border-slate-600 bg-slate-950 text-slate-100 hover:border-fuchsia-700 hover:bg-slate-900")}
    >
      {children}
    </button>
  );
}

export function SceneTestToolbar({ canGoPrevScene, canGoNextScene, onPrevScene, onNextScene }: SceneTestToolbarProps) {
  return (
    <div className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5">
      <div className="flex items-center justify-center gap-2 w-full">
        <ToolbarButton onClick={onPrevScene} disabled={!canGoPrevScene}>
          Escena anterior
        </ToolbarButton>

        <ToolbarButton onClick={onNextScene} disabled={!canGoNextScene}>
          Siguiente escena
        </ToolbarButton>
      </div>
    </div>
  );
}