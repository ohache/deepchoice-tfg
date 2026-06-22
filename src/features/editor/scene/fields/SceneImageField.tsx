import { type ChangeEvent, type DragEvent, type RefObject, useMemo, useRef, useState } from "react";
import type { ID, TextDock } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { cx, DOCKS, getBackgroundFileName, getFileLabel, IMG_ACCEPT, isValidImageFile } from "@/features/editor/scene/fields/layerHelpers";
import { generateId } from "@/utils/id";
import { toast } from "@/shared/toast/toastStore";

type SceneImageFieldProps = {
  label?: string;
  value?: ID;
  active: boolean;
  onToggle: () => void;
  fileInputRef?: RefObject<HTMLInputElement | null>;
  onCommitAssetId: (assetId: ID) => void;
  dock?: TextDock | null;
  onDockChange?: (dock: TextDock) => void;
  showAddCondition?: boolean;
  addConditionLabel?: string;
  addConditionTitle?: string;
  onAddCondition?: () => void;
  addConditionDisabled?: boolean;
};

export function SceneImageField({ label = "Imagen", value, active, onToggle, fileInputRef: externalFileInputRef, onCommitAssetId, dock, onDockChange, showAddCondition,
  addConditionLabel = "+ Añadir condición", addConditionTitle, onAddCondition, addConditionDisabled }: SceneImageFieldProps) {
  const project = useEditorStore((state) => state.project);
  const assetFiles = useEditorStore((state) => state.assetFiles);
  const upsertBackgroundAsset = useEditorStore((state) => state.upsertBackgroundAsset);

  const internalFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);

  const fileInputRef = externalFileInputRef ?? internalFileInputRef;

  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const effectiveAssetId = value ? String(value) : "";
  const effectiveDock: TextDock = dock ?? "bottom";

  const currentFileName = useMemo(() => {
    if (!effectiveAssetId) return "";

    return getBackgroundFileName({ assetId: effectiveAssetId, assetFiles, assets: project?.assets ?? [] });
  }, [effectiveAssetId, assetFiles, project?.assets]);

  const fileLabel = getFileLabel(effectiveAssetId, currentFileName);
  const showDock = Boolean(effectiveAssetId);

  const openPicker = () => fileInputRef.current?.click();

  const commitFile = (file: File) => {
    if (!isValidImageFile(file)) {
      toast.warning("Formato no válido", "La imagen debe ser .png, .jpg, .jpeg, .gif o .webp.");
      return;
    }

    const assetId: ID = generateId.background();

    upsertBackgroundAsset(assetId, file);
    onCommitAssetId(assetId);

    if (!active) onToggle();
  };

  const resetDragState = () => {
    dragDepthRef.current = 0;
    setIsDragging(false);
    setIsHovering(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    if (!file) return;

    commitFile(file);
    event.currentTarget.value = "";
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);

    if (dragDepthRef.current === 0) setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    resetDragState();

    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    commitFile(file);
  };

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2 space-y-2">
        {showDock ? (
          <div className="pb-1">
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              {DOCKS.map((dockOption) => {
                const isActiveDock = effectiveDock === dockOption.id;

                return (
                  <button
                    key={dockOption.id}
                    type="button"
                    onClick={() => onDockChange?.(dockOption.id)}
                    disabled={!onDockChange}
                    className={cx("rounded-md border p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      isActiveDock
                        ? "border-fuchsia-500 bg-fuchsia-950/40 text-white"
                        : "border-slate-500 bg-slate-950/35 text-white hover:border-fuchsia-600 hover:bg-fuchsia-950")}
                    aria-label={`Dock: ${dockOption.label}`}
                    title={dockOption.label}
                    aria-pressed={isActiveDock}
                  >
                    <dockOption.Icon
                      className="h-2.5 w-2.5 drop-shadow"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div
          role="button"
          tabIndex={0}
          className={cx("mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-3 py-3.5 text-[13px] transition-colors duration-150",
            isDragging ? "border-fuchsia-500 bg-fuchsia-950/50" : cx("border-fuchsia-700 bg-slate-900/40", !isHovering && "hover:bg-fuchsia-950/50"),
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;

            event.preventDefault();
            openPicker();
          }}
        >
          <p className="mb-2 text-center text-slate-100">
            Arrastra aquí una imagen
            <span className="block text-[11px] text-slate-400">
              (o haz clic para seleccionarla)
            </span>
          </p>

          <button
            type="button"
            className="rounded-md border border-fuchsia-700 px-3 py-1.5 text-xs text-slate-100 hover:bg-fuchsia-900"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
          >
            Seleccionar imagen…
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={IMG_ACCEPT}
          className="hidden"
          onChange={handleInputChange}
        />

        <p className="break-all text-center text-[12px] text-slate-400">
          {fileLabel}
        </p>

        {showAddCondition ? (
          <div className="flex items-center justify-center pb-1 pt-1">
            <button
              type="button"
              onClick={() => onAddCondition?.()}
              disabled={Boolean(addConditionDisabled)}
              className="btn border-2 border-cyan-700 bg-cyan-900/60 text-xs text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
              title={addConditionTitle}
            >
              {addConditionLabel}
            </button>
          </div>
        ) : null}
      </div>
    </ToggleFieldBlock>
  );
}