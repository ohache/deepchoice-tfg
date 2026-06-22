import { create } from "zustand";

const TOAST_DURATION = 3000;
const MAX_TOASTS = 1;

export type ToastKind = "success" | "info" | "warning" | "error";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message: string;
};

type ToastState = {
  toasts: ToastItem[];
  show: (kind: ToastKind, title: string, message: string) => void;
  dismiss: (id: string) => void;
};

function genId(): string {
  return `${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

/* Construye un ToastItem normalizado a partir del input */
function buildToast(kind: ToastKind, title: string, message: string): ToastItem {
  return {
    id: genId(),
    kind,
    title,
    message,
  };
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  show: (kind, title, message) => {
    const toast = buildToast(kind, title, message);

    set((state) => ({ toasts: [toast, ...state.toasts].slice(0, MAX_TOASTS) }));

    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const stillExists = get().toasts.some((currentToast) => currentToast.id === toast.id);

        if (stillExists) get().dismiss(toast.id);
      }, TOAST_DURATION);
    }
  },

  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

export const toast = {
  success: (title: string, message: string) => useToastStore.getState().show("success", title, message),
  info: (title: string, message: string) => useToastStore.getState().show("info", title, message),
  warning: (title: string, message: string) => useToastStore.getState().show("warning", title, message),
  error: (title: string, message: string) => useToastStore.getState().show("error", title, message),
};