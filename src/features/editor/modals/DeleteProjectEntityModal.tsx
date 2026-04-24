interface DeleteProjectEntityModalProps {
  open: boolean;       
  entityName?: string;         
  description?: string;        
  confirmLabel?: string;     
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteProjectEntityModal({ open, entityName, description, confirmLabel = "Eliminar", onConfirm, onCancel }: DeleteProjectEntityModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-slate-900 border-2 border-slate-600 shadow-xl p-4">
        <div className="text-[13px] text-slate-200 space-y-2 mb-4 text-center">
          <p>
            ¿Seguro que quieres eliminar{" "}
            {entityName ? (
                <span className="font-semibold text-[13px] text-white">{entityName}</span>
            ) : (
              " este elemento?"
            )}
            ?
          </p>

          {description && (
            <p className="text-[12px] text-slate-200">{description}</p>
          )}
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-cancel text-xs"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-danger text-xs"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
