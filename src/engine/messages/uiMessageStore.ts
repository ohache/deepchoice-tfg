import { create } from "zustand";
import { createRuntimeMessage, type RuntimeMessage, type RuntimeMessageInput } from "./uiMessages";

type UiMessageState = {
  queue: RuntimeMessage[];
  push: (input: RuntimeMessageInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const DEFAULT_DURATION_MS = 3200;

export const useUiMessageStore = create<UiMessageState>((set, get) => ({
  queue: [],

  push: (input) => {
    const msg = createRuntimeMessage(input);
    set((s) => ({ ...s, queue: [msg, ...s.queue].slice(0, 5) }));

    const ttl = msg.durationMs ?? DEFAULT_DURATION_MS;
    if (ttl > 0) {
      window.setTimeout(() => {
        const stillExists = get().queue.some((m) => m.id === msg.id);
        if (stillExists) get().dismiss(msg.id);
      }, ttl);
    }

    return msg.id;
  },

  dismiss: (id) => set((s) => ({ ...s, queue: s.queue.filter((m) => m.id !== id) })),

  clear: () => set((s) => ({ ...s, queue: [] })),
}));
