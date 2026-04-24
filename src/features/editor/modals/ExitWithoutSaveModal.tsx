interface ExitWithoutSaveModalProps {
    open: boolean;
    onCancel: () => void;
    onExit: () => void;
    onExitAndDownloadJSON: () => void;
    onExitAndDownloadProject: () => void;
}

export function ExitWithoutSaveModal({ open, onCancel, onExit, onExitAndDownloadJSON, onExitAndDownloadProject }: ExitWithoutSaveModalProps) {
    if (!open) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-card text-center">
                <p className="text-[15px] text-slate-100 mb-4">
                   Va salir del editor. ¿Quiere exportar el proyecto antes?
                </p>

                <div className="mt-4 flex flex-col items-center gap-3">
                    
                    <button
                        type="button"
                        onClick={onExitAndDownloadJSON}
                        className="btn btn-json text-sm min-w-[230px]"
                    >
                        Descargar el archivo JSON
                    </button>
                    <button
                        type="button"
                        onClick={onExitAndDownloadProject}
                        className="btn btn-add-condition text-sm min-w-[230px]"
                    >
                        Descargar el proyecto completo
                    </button>

                    <button
                        type="button"
                        onClick={onCancel}
                        className="btn btn-select text-sm min-w-[200px]"
                    >
                        Continuar editando
                    </button>
                                        <button
                        type="button"
                        onClick={onExit}
                        className="btn btn-danger-condition text-sm min-w-[200px]"
                    >
                        Salir sin exportar
                    </button>
                </div>
            </div>
        </div>
    );
}
