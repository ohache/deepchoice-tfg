import type React from "react";

interface ToggleFieldBlockProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ToggleFieldBlock({ label, active, onToggle, children }: ToggleFieldBlockProps) {
  const containerClasses = "border rounded-md bg-slate-950/60 border-slate-800";
  const headerClasses = "w-full px-3 py-2 text-sm font-semibold text-center transition-colors text-slate-100";

  return (
    <div className={containerClasses}>
      <button type="button" onClick={onToggle} className={headerClasses}>
        {label}
      </button>

      {active && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-800 bg-slate-950/80">
          {children}
        </div>
      )}
    </div>
  );
}

interface SceneTypeButtonProps {
  active: boolean;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  onClick: () => void;
}

export function SceneTypeButton({ active, label, icon: Icon, onClick }: SceneTypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[ "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs", active
          ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
          : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800",
      ].join(" ")}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}
