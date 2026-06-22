import { create } from "zustand";
import type { ID } from "@/domain/types";
import { createRuntimeMessage, type RuntimeMessage, type RuntimeMessageInput } from "@/engine/messages/uiMessages";

type BubbleSpeakerInput = {
  kind: "narrator" | "player" | "npc";
  speakerId?: ID;
};

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

function normalizeBubbleSpeaker(speaker?: BubbleSpeakerInput): RuntimeMessageInput["speaker"] {
  if (speaker?.kind === "player" && speaker.speakerId) return { kind: "player", playerId: speaker.speakerId };
  if (speaker?.kind === "npc" && speaker.speakerId) return { kind: "npc", npcId: speaker.speakerId };
  if (speaker?.kind === "narrator") return { kind: "narrator" };

  return undefined;
}

export function pushBubbleMessage(text: string, speaker?: BubbleSpeakerInput): string {
  return useUiMessageStore.getState().push({ text, preferredChannel: "bubble", speaker: normalizeBubbleSpeaker(speaker) });
}