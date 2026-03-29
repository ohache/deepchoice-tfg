import type { ID } from "@/domain/types";

export type MessageChannel = "toast" | "bubble" | "modal";

export type MessageSpeaker =
  | { kind: "narrator" }
  | { kind: "player"; playerId: ID }
  | { kind: "npc"; npcId: ID }
  | { kind: "system" };

export type RuntimeMessage = {
  id: string;
  text: string;
  speaker?: MessageSpeaker;
  preferredChannel?: MessageChannel;
  createdAt: number;
  durationMs?: number;
};

export type RuntimeMessageInput = Omit<RuntimeMessage, "id" | "createdAt">;

export function createRuntimeMessage(input: RuntimeMessageInput): RuntimeMessage {
  return {
    id: `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`,
    text: input.text,
    speaker: input.speaker,
    preferredChannel: input.preferredChannel,
    createdAt: Date.now(),
    durationMs: input.durationMs,
  };
}
