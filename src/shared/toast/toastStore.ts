import { create } from "zustand";

const TOAST_DURATION = 3000;
const MAX_TOASTS = 1;

export type ToastKind = "success" | "info" | "warning" | "error";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number;
  createdAt: number;
};

type ToastInput = Omit<ToastItem, "id" | "createdAt"> & {
  id?: string;
};

type ToastPushOptions = {
  title?: string;
  durationMs?: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (input: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

function genId(): string {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

/* Construye un ToastItem normalizado a partir del input */
function buildToast(input: ToastInput): ToastItem {
  return {
    id: input.id ?? genId(),
    kind: input.kind,
    title: input.title,
    message: input.message,
    durationMs: input.durationMs ?? TOAST_DURATION,
    createdAt: Date.now(),
  };
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  /* Añade un toast al store */
  push: (input) => {
    const toast = buildToast(input);

    set((state) => ({ toasts: [toast, ...state.toasts].slice(0, MAX_TOASTS) }));

    const duration = toast.durationMs ?? 0;

    if (duration > 0 && typeof window !== "undefined") {
      window.setTimeout(() => {
        const stillExists = get().toasts.some((currentToast) => currentToast.id === toast.id);
        if (stillExists) get().dismiss(toast.id);
      }, duration);
    }

    return toast.id;
  },

  /* Elimina un toast concreto por id */
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  /* Elimina todos los toasts */
  clear: () => set({ toasts: [] }),
}));

export const toast = { success: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "success", title, message, durationMs }),
  info: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "info", title, message, durationMs }),

  warning: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "warning", title, message, durationMs }),

  error: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "error", title, message, durationMs }),

  push: (kind: ToastKind, message: string, options?: ToastPushOptions) => useToastStore.getState().push({ kind, title: options?.title, message, durationMs: options?.durationMs })
};