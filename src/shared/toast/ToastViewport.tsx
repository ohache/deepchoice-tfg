import { type ToastKind, useToastStore } from "@/shared/toast/toastStore";
import { CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

const TOAST_KIND_UI: Record<ToastKind, { ring: string; iconClass: string; Icon: React.ComponentType<{ className?: string }> }> = {
  success: { ring: "ring-emerald-500/50", iconClass: "text-emerald-400", Icon: CheckCircleIcon },
  info: { ring: "ring-sky-500/50", iconClass: "text-sky-400", Icon: InformationCircleIcon },
  warning: { ring: "ring-amber-500/50", iconClass: "text-amber-400", Icon: ExclamationTriangleIcon },
  error: { ring: "ring-red-500/50", iconClass: "text-red-500", Icon: XCircleIcon },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-9999 flex flex-col gap-2 w-[340px] max-w-[calc(100vw-2rem)]">
      {toasts.map((t) => {
        const ui = TOAST_KIND_UI[t.kind];
        const Icon = ui.Icon;

        return (
          <div
            key={t.id}
            className={`relative rounded-xl bg-slate-900/95 shadow-lg ring-3 ${ui.ring} px-3 py-2`}
          >
            {/* Botón cerrar (arriba-dcha) */}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="absolute top-2 right-2 text-slate-300 hover:text-white"
              title="Cerrar"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>

            {/* Layout: icono izquierda + textos */}
            <div className="flex items-start gap-3 pr-6">
              <Icon className={`-mt-2 w-10 h-10 ${ui.iconClass}`} />

              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-100 truncate">
                  {t.title}
                </p>

                <p className="text-[13px] text-slate-200 wrap-break-word">
                  {t.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
