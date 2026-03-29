export function ConfirmDangerModal(props: {
  open: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const {
    open,
    title,
    description,
    confirmText = "Sí, continuar",
    cancelText = "Cancelar",
    onConfirm,
    onCancel,
  } = props;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-[460px] rounded-xl border border-slate-700 bg-slate-950 p-4">
        <h3 className="text-base font-semibold text-slate-100 text-center mb-2">{title}</h3>
        <p className="text-[12px] text-slate-300 text-center mb-4">{description}</p>

        <div className="flex justify-between gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-[12px] text-slate-100"
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-700 hover:bg-red-600 text-[12px] font-semibold text-white"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
