interface DeleteSceneModalProps {
    open: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  }
  
  export function DeleteSceneModal({ open, onCancel, onConfirm }: DeleteSceneModalProps) {
    if (!open) return null;
  
    return (
      <div className="modal-overlay">
        <div className="modal-card">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">
            Eliminar escena
          </h2>
          <p className="text-sm text-slate-300 mb-4">
            Vas a eliminar esta escena del proyecto. Esta acción no se puede
            deshacer. ¿Quieres continuar?
          </p>
  
          <div className="mt-4 flex justify-end gap-2 text-sm">
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
              className="btn bg-red-600 hover:bg-red-500 text-white font-semibold"
            >
              Eliminar
            </button>
          </div>
        </div>
      </div>
    );
  }
  