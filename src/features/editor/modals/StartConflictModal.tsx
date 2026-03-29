interface StartConflictModalProps {
  open: boolean;
  currentStartTitle: string;
  editingTitle: string;
  onConfirmReplace: () => void;
  onCancelKeep: () => void;
}

export function StartConflictModal({ open, currentStartTitle, editingTitle, onConfirmReplace, onCancelKeep }: StartConflictModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-100 shadow-2xl">
        <h2 className="text-[15px] font-semibold text-white mb-2 text-center">
          Escena inicial ya definida
        </h2>

        <p className="text-[13px] text-slate-200 mb-4 text-center">
          Actualmente la escena <strong className="font-bold">{currentStartTitle}</strong> es la inicial.  
          <br />
          ¿Quieres que la escena <strong className="font-bold">{editingTitle}</strong> pase a ser la inicial?
        </p>

        <div className="flex justify-between gap-3 mt-4">
          <button
            onClick={onCancelKeep}
            className="flex-1 btn btn-cancel"
          >
            No, mantener 
          </button>

          <button
            onClick={onConfirmReplace}
            className="flex-1 btn btn-add-condition"
          >
            Sí, cambiar
          </button>
        </div>
      </div>
    </div>
  );
}
