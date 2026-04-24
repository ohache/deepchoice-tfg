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

/* Valida extensiones y mime permitidos para imágenes de fondo */
function isValidImageFile(file: File): boolean {
  const lower = (file.name ?? "").toLowerCase();

  const hasValidExt = lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".gif") || lower.endsWith(".webp");

  const hasValidMime = file.type === "image/png" || file.type === "image/jpeg" || file.type === "image/gif" || file.type === "image/webp" || file.type === "";

  return hasValidExt && hasValidMime;
}

/* Posiciones disponibles del bloque de texto respecto a la imagen */
const DOCKS: { id: TextDock; label: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }[] = [
  { id: "top", label: "Arriba", Icon: ArrowUpIcon },
  { id: "left", label: "Izquierda", Icon: ArrowLeftIcon },
  { id: "right", label: "Derecha", Icon: ArrowRightIcon },
  { id: "bottom", label: "Abajo", Icon: ArrowDownIcon },
];

export function SceneImageField({ label = "Imagen", value, active, onToggle, fileInputRef: externalFileInputRef, onCommitAssetId, dock, onDockChange,
  showAddCondition, addConditionLabel, addConditionTitle, onAddCondition, addConditionDisabled }: SceneImageFieldProps) {
  const project = useEditorStore((state) => state.project);
  const assetFiles = useEditorStore((state) => state.assetFiles);
  const upsertBackgroundAsset = useEditorStore((state) => state.upsertBackgroundAsset);

  const internalRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = externalFileInputRef ?? internalRef;

  const [isDragging, setIsDragging] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const effectiveAssetId = value ? String(value) : "";

  /* Nombre visible del fichero actualmente asociado al asset */
  const currentFileName = useMemo(() => {
    if (!effectiveAssetId) return "";

    const file = assetFiles?.[effectiveAssetId];
    if (file?.name) return file.name;

    const asset = (project?.assets ?? []).find((entry) => entry.kind === "backgrounds" && entry.id === effectiveAssetId) ?? null;

    const path = String(asset?.file ?? "").trim();
    if (!path) return "";

    return path.split("/").pop() ?? path;
  }, [assetFiles, project, effectiveAssetId]);

  const fileLabel = currentFileName ? `Imagen seleccionada: ${currentFileName}` : effectiveAssetId ? "Imagen seleccionada" : "No hay imagen seleccionada";

  const showDock = Boolean(effectiveAssetId);
  const effectiveDock: TextDock = dock ?? "bottom";

  const openPicker = () => { fileInputRef.current?.click() };

  /* Aplica el fichero al store y mantiene este toggle abierto */
  const applyFile = (file: File) => {
    if (!isValidImageFile(file)) {
      toast.warning("Formato no válido", "La imagen debe ser .png, .jpg, .jpeg, .gif o .webp.");
      return;
    }

    const assetId: ID = generateId.background();
    upsertBackgroundAsset(assetId, file);
    onCommitAssetId(assetId);

    if (!active) onToggle();
  };

  /* Cambio desde input nativo */
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    applyFile(file);
    event.target.value = "";
  };

  /* Drag over */
  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isDragging) setIsDragging(true);
  };

  /* Drag leave */
  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  /* Drop directo sobre la zona */
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0] ?? null;
    if (!file) return;

    applyFile(file);
  };

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="pt-2 space-y-2">
        {/* Selector de dock, disponible solo si la capa ya tiene imagen */}
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
                    className={"rounded-md border p-2 transition-colors " +
                      (isActiveDock
                        ? "border-fuchsia-500 bg-fuchsia-950/40 text-white"
                        : "border-slate-500 bg-slate-950/35 text-white hover:bg-fuchsia-950 hover:border-fuchsia-600")}
                    aria-label={`Dock: ${dockOption.label}`}
                    title={dockOption.label}
                    aria-pressed={isActiveDock}
                  >
                    <dockOption.Icon className="h-2.5 w-2.5 drop-shadow" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Zona de drop / click */}
        <div
          className={"mt-1.5 flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-3 py-3.5 text-[13px] transition-colors duration-150 " +
            (isDragging
              ? "border-fuchsia-500 bg-fuchsia-950/50"
              : "border-fuchsia-700 bg-slate-900/40 " + (isHovering ? "" : "hover:bg-fuchsia-950/50"))}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openPicker}
        >
          <p className="mb-2 text-center text-slate-100">
            Arrastra aquí una imagen
            <span className="block text-[11px] text-slate-400">(o haz clic para seleccionarla)</span>
          </p>

          {/* Botón explícito */}
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

        {/* Input real oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMG_ACCEPT}
          className="hidden"
          onChange={handleInputChange}
        />

        {/* Información del fichero actual */}
        <p className="break-all text-center text-[12px] text-slate-400">{fileLabel}</p>

        {/* Acción para añadir/editar condición de capa */}
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