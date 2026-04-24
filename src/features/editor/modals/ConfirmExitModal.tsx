type Props = {
  open: boolean;
  title?: string;
  description?: string;
  onSaveAndExit: () => void;
  onDiscardAndExit: () => void;
  onCancel: () => void;
  canSave?: boolean;
};

export function ConfirmExitModal({ open, title, description, onSaveAndExit, onDiscardAndExit, onCancel, canSave = true }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-[400px] rounded-xl border border-slate-700 bg-slate-950 p-4">
        <h3 className="text-base font-semibold text-slate-100 text-center mb-2">{title}</h3>
        <p className="text-[13px] text-slate-300 text-center mb-4">{description}</p>

        {/* Botonera estilo ConfirmDangerModal */}
        <div className="flex justify-between">
          <button
            type="button"
            onClick={onDiscardAndExit}
            className="btn btn-danger text-[13px]"
          >
            Salir
          </button>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-cancel text-[13px]"
            >
              Seguir editando
            </button>

            <button
              type="button"
              onClick={onSaveAndExit}
              disabled={!canSave}
              className="btn btn-create font-normal bg-fuchsia-950 hover:bg-fuchsia-900 text-[13px]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
