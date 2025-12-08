interface UserManualModalProps {
  open: boolean;
  onClose: () => void;
}

export function UserManualModal({ open, onClose }: UserManualModalProps) {
  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card max-w-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            Manual de usuario (versión inicial)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="modal-close-btn"
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
      </div>
    </div>
  );
}
