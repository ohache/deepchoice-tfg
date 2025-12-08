interface StartConflictModalProps {
  open: boolean;
  currentStartTitle: string;
  onConfirmReplace: () => void;
  onCancelKeep: () => void;
}

export function StartConflictModal({ open, currentStartTitle, onConfirmReplace, onCancelKeep }: StartConflictModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-80 shadow-2xl">
        <h2 className="text-lg font-semibold text-slate-100 mb-2 text-center">
          Escena inicial ya definida
        </h2>

        <p className="text-sm text-slate-300 mb-4 text-center">
          Actualmente la escena <strong>{currentStartTitle}</strong> es la inicial.  
          <br />
          ¿Quieres que esta nueva escena pase a ser la inicial?
        </p>

        <div className="flex justify-between gap-3 mt-4">
          <button
            onClick={onCancelKeep}
            className="flex-1 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm text-slate-200"
          >
            Mantener actual
          </button>

          <button
            onClick={onConfirmReplace}
            className="flex-1 px-3 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-sm text-white font-semibold"
          >
            Sí, cambiar
          </button>
        </div>
      </div>
    </div>
  );
}
