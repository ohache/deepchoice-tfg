import { create } from "zustand";
import { createRuntimeMessage, type RuntimeMessage, type RuntimeMessageInput } from "./uiMessages";

type UiMessageState = {
  queue: RuntimeMessage[];
  push: (input: RuntimeMessageInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const DEFAULT_DURATION_MS = 3200;
const MAX_MESSAGES = 5;

export const useUiMessageStore = create<UiMessageState>((set, get) => ({
  queue: [],

  push: (input) => {
    const message = createRuntimeMessage(input);

    set((state) => ({
      ...state,
      queue: [message, ...state.queue].slice(0, MAX_MESSAGES),
    }));

    const ttl = message.durationMs ?? DEFAULT_DURATION_MS;

    if (ttl > 0) {
      window.setTimeout(() => {
        const exists = get().queue.some((m) => m.id === message.id);
        if (exists) get().dismiss(message.id);
      }, ttl);
    }

    return message.id;
  },

  dismiss: (id) =>
    set((state) => ({
      ...state,
      queue: state.queue.filter((m) => m.id !== id),
    })),

  clear: () =>
    set((state) => ({
      ...state,
      queue: [],
    })),
}));