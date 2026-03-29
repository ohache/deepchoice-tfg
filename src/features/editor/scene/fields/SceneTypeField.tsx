import type { ComponentType, SVGProps } from "react";
import { FlagIcon, StopCircleIcon } from "@heroicons/react/24/outline";

interface SceneTypeButtonProps {
  active: boolean;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  variant: "start" | "final";
  onClick: () => void;
}

function SceneTypeButton({ active, label, icon: Icon, variant, onClick }: SceneTypeButtonProps) {
  const activeClasses = variant === "start"
    ? "border-emerald-500 bg-emerald-600/20 text-emerald-200"
    : "border-rose-500 bg-red-600/20 text-red-200";
  return (
    <button
      type="button"
      onClick={onClick}
      className={"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs " +
        (active
          ? activeClasses
          : "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-700")}
      aria-pressed={active}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

interface SceneTypeFieldProps {
  isStart: boolean;
  isFinal: boolean;
  onToggleStart: () => void;
  onToggleFinal: () => void;
}

export function SceneTypeField({ isStart, isFinal, onToggleStart, onToggleFinal}: SceneTypeFieldProps) {
  return (
    <>
      <div className="scene-type-toggle-container">
        <div className="flex items-center justify-center gap-10">
          <SceneTypeButton active={isStart} label="Inicio" icon={FlagIcon} variant="start" onClick={onToggleStart} />
          <SceneTypeButton active={isFinal} label="Final" icon={StopCircleIcon} variant="final" onClick={onToggleFinal} />
        </div>
      </div>
    </>
  );
}
