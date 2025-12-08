import { useEffect, useRef } from "react";

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
  const hasError = !!titleError;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h2 className="text-lg font-semibold mb-3 text-center">
          Nueva aventura
        </h2>

        <p className="text-sm text-slate-300 mb-4 text-center">
          Escribe el título de la aventura que vas a crear
        </p>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={["w-full rounded-md px-3 py-1.5 text-sm bg-slate-950 border focus:outline-none focus:ring-1",
              hasError
                ? "border-red-500 focus:ring-red-500"
                : "border-slate-600 focus:ring-fuchsia-500",
            ].join(" ")}
          placeholder="Ej: La senda del bosque"
        />

        {hasError && (
          <p className="form-field-error">
            {titleError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-primary-adventure"
          >
            Crear aventura
          </button>
        </div>
      </div>
    </div>
  );
}
