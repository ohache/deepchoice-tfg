interface UserManualModalProps {
  open: boolean;
  onClose: () => void;
}

export function UserManualModal({ open, onClose }: UserManualModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="max-w-lg w-full mx-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-700 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Manual de usuario (versión inicial)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-slate-100 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3 text-sm text-slate-200">
          <p>
            Aquí irá una explicación breve de cómo usar la herramienta:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>
              <strong>Crear aventura</strong>: inicia una nueva historia
              desde cero en el editor.
            </li>
            <li>
              <strong>Editar aventura</strong>: carga y modifica una
              historia existente.
            </li>
            <li>
              <strong>Jugar aventura</strong>: selecciona una aventura y
              juégala con el motor interactivo.
            </li>
          </ul>
          <p>
            Más adelante podrás ampliar este texto, añadir ejemplos y
            capturas, o incluso enlazar a una versión más completa del
            manual.
          </p>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
