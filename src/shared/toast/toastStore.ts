import { create } from "zustand";

const TOAST_DURATION = 3000;

export type ToastKind = "success" | "info" | "warning" | "error";

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title?: string;
  message: string;
  durationMs?: number;
  createdAt: number;
};

type ToastState = {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, "id" | "createdAt"> & { id?: string }) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

function genId(): string {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  push: (input) => {
    const id = input.id ?? genId();
    const toast: ToastItem = {
      id,
      kind: input.kind,
      title: input.title,
      message: input.message,
      durationMs: input.durationMs ?? TOAST_DURATION,
      createdAt: Date.now(),
    };

    set((s) => ({
      ...s,
      toasts: [toast, ...s.toasts].slice(0, 5),
    }));

    const duration = toast.durationMs ?? 0;
    if (duration > 0) {
      window.setTimeout(() => {
        const stillThere = get().toasts.some((t) => t.id === id);
        if (stillThere) get().dismiss(id);
      }, duration);
    }

    return id;
  },

  dismiss: (id) => set((s) => ({ ...s, toasts: s.toasts.filter((t) => t.id !== id) })),

  clear: () => set((s) => ({ ...s, toasts: [] })),
}));

export const toast = {
  success: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "success", title, message, durationMs }),
  info: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "info", title, message, durationMs }),
  warning: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "warning", title, message, durationMs }),
  error: (title: string, message: string, durationMs?: number) => useToastStore.getState().push({ kind: "error", title, message, durationMs }),

  push: (kind: ToastKind, message: string, opts?: { title?: string; durationMs?: number }) =>
    useToastStore.getState().push({
      kind,
      title: opts?.title,
      message,
      durationMs: opts?.durationMs,
    }),
};