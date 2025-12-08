interface ExitWithoutSaveModalProps {
    open: boolean;
    onCancel: () => void;
    onExitWithoutSave: () => void;
    onExitSaveAndGo: () => void;
}

export function ExitWithoutSaveModal({ open, onCancel, onExitWithoutSave, onExitSaveAndGo }: ExitWithoutSaveModalProps) {
    if (!open) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-card text-center">
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
                        className="btn btn-secondary"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={onExitWithoutSave}
                        className="btn btn-danger"
                    >
                        Salir sin guardar
                    </button>
                    <button
                        type="button"
                        onClick={onExitSaveAndGo}
                        className="btn btn-primary-adventure"
                    >
                        Guardar y salir
                    </button>
                </div>
            </div>
        </div>
    );
}
