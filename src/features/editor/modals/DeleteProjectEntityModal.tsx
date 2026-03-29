import { TrashIcon } from "@heroicons/react/24/outline";

interface DeleteProjectEntityModalProps {
  open: boolean;
  title: string;               
  entityName?: string;         
  description?: string;        
  confirmLabel?: string;     
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteProjectEntityModal({ open, title, entityName, description, confirmLabel = "Eliminar", onConfirm, onCancel }: DeleteProjectEntityModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-sm rounded-xl bg-slate-900 border-2 border-slate-600 shadow-xl p-4">
        <div className="flex items-center justify-center mb-3">
          <div className="flex items-center gap-2">
            <TrashIcon className="w-5 h-5 text-red-700" />
            <h3 className="text-sm font-semibold text-white">{title}</h3>
          </div>
        </div>

        <div className="text-xs text-slate-100 space-y-2 mb-4 text-center">
          <p>
            ¿Seguro que quieres eliminar
            {entityName ? (
              <>
                {" "}
                <span className="font-semibold text-[13px] text-white">{entityName}</span>
                ?
              </>
            ) : (
              " este elemento?"
            )}
          </p>

          {description && (
            <p className="text-[11px] text-slate-200">{description}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
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
