import { useEffect, useRef } from "react";
import { createCommitCancelKeyHandler } from "@/shared/keyboard";

interface CreateAdventureModalProps {
  open: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  titleError?: string | null;
}

export function CreateAdventureModal({ open, title, onTitleChange, onConfirm, onCancel, titleError }: CreateAdventureModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const hasError = Boolean(titleError);

  const handleKeyDown = createCommitCancelKeyHandler<HTMLInputElement>(onConfirm, onCancel, {stopPropagation: true});

  const isConfirmDisabled = hasError || title.trim().length === 0;

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <p className="text-[15px] text-slate-100 mb-4 text-center">
          Escribe el título de la aventura que vas a crear
        </p>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-md px-3 py-1.5 text-sm bg-slate-950 border focus:outline-none focus:ring-2 focus:border-transparent
            ${hasError ? "border-red-500 focus:ring-red-500" : "border-slate-600 focus:ring-fuchsia-500"}`}
          placeholder="Ej: La senda del bosque"
        />

        {hasError && (
          <p className="form-field-error">
            {titleError}
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-cancel"
          >
            Cancelar
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-create"
            disabled={isConfirmDisabled}
          >
            Crear aventura
          </button>
        </div>
      </div>
    </div>
  );
}