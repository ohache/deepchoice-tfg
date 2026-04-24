import type { ComponentType } from "react";
import { useToastStore, type ToastKind } from "@/shared/toast/toastStore";
import { CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, XCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

type ToastKindUi = {
  ring: string;
  iconClass: string;
  Icon: ComponentType<{ className?: string }>;
};

/* Configuración visual por tipo de toast */
const TOAST_KIND_UI: Record<ToastKind, ToastKindUi> = {
  success: { ring: "ring-emerald-500/50", iconClass: "text-emerald-400", Icon: CheckCircleIcon },
  info: { ring: "ring-sky-500/50", iconClass: "text-sky-400",Icon: InformationCircleIcon },
  warning: { ring: "ring-amber-500/50", iconClass: "text-amber-400", Icon: ExclamationTriangleIcon },
  error: { ring: "ring-red-500/50", iconClass: "text-red-500", Icon: XCircleIcon },
};

type ToastCardProps = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  onDismiss: (id: string) => void;
};

/* Card individual de toast */
function ToastCard({ id, kind, title, message, onDismiss }: ToastCardProps) {
  const ui = TOAST_KIND_UI[kind];
  const Icon = ui.Icon;

  return (
    <div className={`relative rounded-xl bg-slate-900/95 px-3 py-2 shadow-lg ring-3 ${ui.ring}`}>
      {/* Botón de cierre */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        className="absolute top-2 right-2 text-slate-300 hover:text-white"
        title="Cerrar"
        aria-label="Cerrar toast"
      >
        <XMarkIcon className="h-4 w-4" />
      </button>

      {/* Contenido */}
      <div className="flex items-start gap-3 pr-6">
        <Icon className={`-mt-2 h-10 w-10 ${ui.iconClass}`} />

        <div className="min-w-0">
          {title ? (
            <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          ) : null}

          <p className="text-[13px] text-slate-200 wrap-break-word">{message}</p>
        </div>
      </div>
    </div>
  );
}

/* Contenedor flotante de toasts */
export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 right-4 z-9999 flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          id={toast.id}
          kind={toast.kind}
          title={toast.title}
          message={toast.message}
          onDismiss={dismiss}
        />
      ))}
    </div>
  );
}