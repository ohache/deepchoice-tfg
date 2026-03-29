import { type ChangeEvent, type DragEvent, type RefObject, useMemo, useRef, useState } from "react";
import type { ID, TextDock } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { generateId } from "@/utils/id";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { ArrowDownIcon, ArrowUpIcon, ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { toast } from "@/shared/toast/toastStore";

interface SceneImageFieldProps {
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
}

const IMG_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp,image/png,image/jpeg,image/gif,image/webp";

function isValidImageFile(file: File) {
  const lower = (file.name ?? "").toLowerCase();
  const hasValidExt = lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp");
  const hasValidMime = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/gif" || file.type === "image/webp" || file.type === "";

  return hasValidExt && hasValidMime;
}

const DOCKS: { id: TextDock; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "top", label: "Arriba", Icon: ArrowUpIcon },
  { id: "left", label: "Izquierda", Icon: ArrowLeftIcon },
  { id: "right", label: "Derecha", Icon: ArrowRightIcon },
  { id: "bottom", label: "Abajo", Icon: ArrowDownIcon },
];


export function SceneImageField({ label = "Imagen", value, active, onToggle, fileInputRef: externalFileInputRef, onCommitAssetId, dock, onDockChange,
  showAddCondition, addConditionLabel = "Añadir condición", addConditionTitle, onAddCondition, addConditionDisabled }: SceneImageFieldProps) {
  const project = useEditorStore((s) => s.project);
  const assetFiles = useEditorStore((s) => s.assetFiles);
  const upsertBackgroundAsset = useEditorStore((s) => s.upsertBackgroundAsset);
  const registerAssetFile = useEditorStore((s) => s.registerAssetFile);

  const internalRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = externalFileInputRef ?? internalRef;

  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const effectiveAssetId = value ? String(value) : "";

  const currentFileName = useMemo(() => {
    if (!effectiveAssetId) return "";

    const f = assetFiles?.effectiveAssetId;
    if (f?.name) return f.name;

    const asset = (project?.assets ?? []).find((a) => a.kind === "backgrounds" && a.id === effectiveAssetId) ?? null;

    const path = String(asset?.file ?? "").trim();
    if (!path) return "";

    return path.split("/").pop() ?? path;
  }, [assetFiles, project, effectiveAssetId]);

  const fileLabel = currentFileName ? `Imagen seleccionada: ${currentFileName}`
    : effectiveAssetId ? "Imagen seleccionada" : "No hay imagen seleccionada";

  const openPicker = () => fileInputRef.current?.click();

  const applyFile = (file: File) => {
    if (!isValidImageFile(file)) {
      const msg = "La imagen debe ser .png, .jpg, .jpeg, .gif o .webp.";
      toast.warning("Formato no válido", msg);
      return;
    }

    const assetId: ID = generateId.background();
    upsertBackgroundAsset(assetId, file);
    registerAssetFile(assetId, file);

    onCommitAssetId(assetId);
  };

  const onInputChange = (evt: ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0] ?? null;
    if (!file) return;

    applyFile(file);
    evt.target.value = "";
  };

  const onDragOver = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (evt: DragEvent<HTMLDivElement>) => {
    evt.preventDefault();
    evt.stopPropagation();
    setIsDragging(false);

    const file = evt.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    applyFile(file);
  };

  const showDock = Boolean(effectiveAssetId);
  const effectiveDock: TextDock = dock ?? "bottom";

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2 space-y-2">
        {showDock ? (
          <div className="pb-1">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {DOCKS.map((d) => {
                const activeDock = effectiveDock === d.id;

                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onDockChange?.(d.id)}
                    className={
                      "p-2 rounded-md border transition-colors " +
                      (activeDock
                        ? "border-fuchsia-500 bg-fuchsia-950/40 text-white"
                        : "border-slate-500 bg-slate-950/35 hover:bg-slate-800 text-white")
                    }
                    aria-label={`Dock: ${d.label}`}
                    title={d.label}
                    aria-pressed={activeDock}
                  >
                    <d.Icon className="w-2 h-2 drop-shadow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Dropzone */}
        <div
          className={"mt-1.5 px-3 py-3.5 rounded-md flex flex-col items-center justify-center text-[12px] " +
            "transition-colors duration-150 border-2 border-dashed cursor-pointer " +
            (isDragging
              ? "border-fuchsia-500 bg-fuchsia-900/50"
              : "border-fuchsia-700 bg-slate-900/40 " + (isHovering ? "" : "hover:bg-fuchsia-900/50"))}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={openPicker}
        >
          <p className="mb-2 text-slate-100 text-center">
            Arrastra aquí una imagen
            <span className="block text-[11px] text-slate-400">(o haz clic para seleccionarla)</span>
          </p>

          {/* Botón explícito */}
          <button
            type="button"
            className="px-3 py-1.5 rounded-md border-2 border-slate-700 bg-slate-900 hover:bg-slate-700 text-xs text-slate-100"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onClick={(e) => {
              e.stopPropagation();
              openPicker();
            }}
          >
            Seleccionar imagen…
          </button>
        </div>

        {/* Input real */}
        <input ref={fileInputRef} type="file" accept={IMG_ACCEPT} className="hidden" onChange={onInputChange} />

        {/* Info */}
        <p className="mt-1 text-[11px] text-slate-400 break-all text-center">{fileLabel}</p>

        {/* Botón de condición */}
        {showAddCondition ? (
          <div className="pb-1 flex items-center justify-center">
            <button
              type="button"
              onClick={() => onAddCondition?.()}
              disabled={Boolean(addConditionDisabled)}
              className="btn border-2 border-cyan-700 bg-cyan-900/60 hover:bg-cyan-800 text-xs text-white disabled:opacity-40 disabled:cursor-not-allowed"
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