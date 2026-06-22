import type { ID } from "@/domain/types";

type MessageChannel = "toast" | "bubble" | "modal";

type MessageSpeaker = { kind: "narrator" } | { kind: "player"; playerId: ID } | { kind: "npc"; npcId: ID } | { kind: "system" };

export type RuntimeMessage = {
  id: string;
  text: string;
  speaker?: MessageSpeaker;
  preferredChannel?: MessageChannel;
  createdAt: number;
  durationMs?: number;
};

export type RuntimeMessageInput = Omit<RuntimeMessage, "id" | "createdAt">;

function generateMessageId(): string {
  return `${Date.now().toString(36)}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

export function createRuntimeMessage(input: RuntimeMessageInput): RuntimeMessage {
  return {
    id: generateMessageId(),
    text: input.text,
    speaker: input.speaker,
    preferredChannel: input.preferredChannel,
    createdAt: Date.now(),
    durationMs: input.durationMs,
  };
}