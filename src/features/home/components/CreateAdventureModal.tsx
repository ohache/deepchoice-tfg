import { useEffect, useRef } from "react";

interface CreateAdventureModalProps {
  open: boolean;
  title: string;
  onTitleChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CreateAdventureModal({ open, title, onTitleChange, onConfirm, onCancel }: CreateAdventureModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onConfirm();
    }
  };

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="max-w-md w-full mx-4 bg-slate-900 rounded-2xl shadow-xl border-3 border-slate-700 p-6">
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
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-fuchsia-600"
          placeholder="Ej: La senda del bosque"
        />

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg bg-fuchsia-700 hover:bg-fuchsia-600 text-sm font-semibold"
          >
            Crear aventura
          </button>
        </div>
      </div>
    </div>
  );
}
