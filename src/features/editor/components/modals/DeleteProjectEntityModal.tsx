import { XMarkIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

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
      <div className="w-full max-w-sm rounded-xl bg-slate-900 border border-slate-700 shadow-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-100"
            aria-label="Cerrar"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="text-xs text-slate-200 space-y-2 mb-4">
          <p>
            ¿Seguro que quieres eliminar
            {entityName ? (
              <>
                {" "}
                <span className="font-semibold text-slate-100">{entityName}</span>
                ?
              </>
            ) : (
              " este elemento?"
            )}
          </p>

          {description && (
            <p className="text-[11px] text-slate-400">{description}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-100"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-[11px] font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
