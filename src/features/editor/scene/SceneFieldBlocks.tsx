import type React from "react";
import { useId } from "react";

interface ToggleFieldBlockProps {
  label: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  contentClassName?: string;
}

export function ToggleFieldBlock({ label, active, onToggle, children, contentClassName }: ToggleFieldBlockProps) {

  const contentId = useId();

  return (
    <div className={`border-3 rounded-md bg-slate-950 ${active ? "border-cyan-800" : "border-black"}`}>
      <button
        type="button"
        onClick={onToggle}
        className={"w-full px-3 py-2 text-sm font-semibold text-center transition-colors text-slate-100 border-b-2 " +
          (active
            ? "bg-cyan-950/30 border-cyan-900/70 text-white"
            : "bg-transparent border-transparent hover:bg-cyan-950")
        }
        aria-expanded={active}
        aria-controls={contentId}
      >
        {label}
      </button>

      {active && (
        <div
          id={contentId}
          className={"px-3 pb-3 pt-1 bg-slate-950 " + (contentClassName ?? "")}
        >
          {children}
        </div>
      )}

    </div>
  );
}




