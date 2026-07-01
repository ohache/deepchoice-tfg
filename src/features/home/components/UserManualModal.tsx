import { useEffect } from "react";

type UserManualModalProps = {
  open: boolean;
  onClose: () => void;
  manualSrc: string;
};

export function UserManualModal({ open, onClose, manualSrc }: UserManualModalProps) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Manual de usuario"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-[92vh] w-[94vw] max-w-6xl flex-col rounded-xl border-2 border-slate-600 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b-2 border-slate-700 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-100">
            Manual de usuario
          </h2>

          <div className="flex items-center gap-3">
            <a
              href={manualSrc}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-500 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 hover:bg-slate-700"
            >
              Abrir en pestaña nueva
            </a>

            <button
              type="button"
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 bg-slate-950">
          <iframe
            src={manualSrc}
            title="Manual de usuario"
            className="h-full w-full"
          />
        </div>
      </div>
    </div>
  );
}