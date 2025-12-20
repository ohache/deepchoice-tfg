import { FlagIcon, StopCircleIcon } from "@heroicons/react/24/outline";
import { SceneTypeButton } from "@/features/editor/components/scene/SceneFieldBlocks";

interface SceneTypeFieldProps {
  isStart: boolean;
  isFinal: boolean;
  onToggleStart: () => void;
  onToggleFinal: () => void;
}

export function SceneTypeField({ isStart, isFinal, onToggleStart, onToggleFinal }: SceneTypeFieldProps) {
  return (
    <div className="scene-type-toggle-container">
      <div className="flex items-center justify-center gap-10">
        <SceneTypeButton
          active={isStart}
          label="Inicio"
          icon={FlagIcon}
          onClick={onToggleStart}
        />

        <SceneTypeButton
          active={isFinal}
          label="Final"
          icon={StopCircleIcon}
          onClick={onToggleFinal}
        />
      </div>
    </div>
  );
}
