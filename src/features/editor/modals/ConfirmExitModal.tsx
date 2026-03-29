type Props = {
  open: boolean;
  title?: string;
  description?: string;

  /** Botón principal: guarda y sale */
  onSaveAndExit: () => void;

  /** Salir sin guardar (descartar cambios) */
  onDiscardAndExit: () => void;

  /** Cerrar modal (no salir) */
  onCancel: () => void;

  /** Para deshabilitar el botón principal cuando no se puede guardar */
  canSave?: boolean;
};

export function ConfirmExitModal({
  open,
  title = "Salir",
  description = "Hay cambios sin guardar. ¿Qué quieres hacer?",
  onSaveAndExit,
  onDiscardAndExit,
  onCancel,
  canSave = true,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[460px] rounded-xl border border-slate-700 bg-slate-950 p-4">
        <h3 className="text-base font-semibold text-slate-100 text-center mb-2">{title}</h3>
        <p className="text-[12px] text-slate-300 text-center mb-4">{description}</p>

        {/* Botonera estilo ConfirmDangerModal */}
        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={onDiscardAndExit}
            className="btn btn-danger"
          >
            Salir
          </button>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-cancel"
            >
              Seguir editando
            </button>

            <button
              type="button"
              onClick={onSaveAndExit}
              disabled={!canSave}
              className="btn btn-create"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
