import type React from "react";
import { useId } from "react";

interface ToggleFieldBlockProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ToggleFieldBlock({ label, active, onToggle, children }: ToggleFieldBlockProps) {

  const contentId = useId();

  return (
    <div className={`border rounded-md bg-slate-950/80 ${active ? "border-fuchsia-900/40" : "border-slate-800"}`}>
      <button
        type="button"
        onClick={onToggle}
        className={"w-full px-3 py-2 text-sm font-semibold text-center transition-colors text-slate-100 border-b " +
          (active
            ? "bg-fuchsia-950/20 border-fuchsia-700/40 text-fuchsia-100"
            : "bg-transparent border-transparent hover:bg-slate-900/40")
        }
        aria-expanded={active}
        aria-controls={contentId}
      >
        {label}
      </button>

      {active && (
        <div id={contentId} className="px-3 pb-3 pt-1 border-t border-slate-800 bg-slate-950/90">
          {children}
        </div>
      )}

    </div>
  );
}




