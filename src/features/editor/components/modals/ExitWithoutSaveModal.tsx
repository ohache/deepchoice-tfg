interface ExitWithoutSaveModalProps {
    open: boolean;
    onCancel: () => void;
    onExitWithoutSave: () => void;
    onExitSaveAndGo: () => void;
}

export function ExitWithoutSaveModal({ open, onCancel, onExitWithoutSave, onExitSaveAndGo }: ExitWithoutSaveModalProps) {
    if (!open) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <div className="text-center max-w-md w-full mx-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-700 p-6">
                <h2 className="text-lg font-semibold mb-3">
                    Cambios sin guardar
                </h2>
                <p className="text-sm text-slate-300 mb-4">
                    Hay cambios sin guardar en la aventura. ¿Qué quieres hacer?
                </p>

                <div className="mt-4 flex justify-center gap-2 text-sm">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onExitWithoutSave}
                        className="px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 text-white"
                    >
                        Salir sin guardar
                    </button>
                    <button
                        type="button"
                        onClick={onExitSaveAndGo}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                    >
                        Guardar y salir
                    </button>
                </div>
            </div>
        </div>
    );
}
