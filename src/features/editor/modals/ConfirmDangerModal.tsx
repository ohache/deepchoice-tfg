export function ConfirmDangerModal(props: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { open, title, description, confirmText = "Sí, continuar", cancelText = "Cancelar", onConfirm, onCancel } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-80 rounded-xl border-2 border-slate-700 bg-slate-900 p-4">
        <h3 className="text-[15px] font-semibold text-slate-100 text-center mb-3">{title}</h3>
        <p className="text-[13px] text-slate-200 text-center mb-5">{description}</p>

        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn btn-cancel text-[13px]"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="btn btn-danger text-[13px]"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
