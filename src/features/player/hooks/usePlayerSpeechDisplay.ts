import { useMemo } from "react";
import type { RuntimeMessage } from "@/engine/messages/uiMessages";
import type { GameState } from "@/engine/state/runtimeState";
import { findActiveDialogue, findCurrentDialogueNode, getActiveDialogueLine, getDialogueOptions } from "@/features/player/utils/playerDialogueResolution";

export function usePlayerSpeechDisplay(gameState: GameState | null, sceneMessage?: RuntimeMessage) {
  const gameEnded = Boolean(gameState?.gameEnded);
  const endingMessage = gameState?.ending?.message?.trim() ?? "";

  const hasSceneMessage = Boolean(sceneMessage?.text?.trim());
  const messageAsDialogueText = sceneMessage?.text ?? null;

  const endingLines = gameState?.ending?.lines ?? [];
  const endingLineIndex = gameState?.endingLineIndex ?? 0;
  const activeEndingLine = gameEnded && endingLineIndex < endingLines.length ? endingLines[endingLineIndex] : null;
  const endingLinesFinished = gameEnded && endingLineIndex >= endingLines.length;

  const endingLineText = activeEndingLine?.text?.trim() ?? "";
  const endingLineSpeaker = activeEndingLine?.speaker?.kind === "player" ? "player" : activeEndingLine?.speaker?.kind === "npc" ? "npc" : null;

  const endingLineSpeakerId = activeEndingLine?.speaker?.kind === "player" ? activeEndingLine.speaker.playerId : activeEndingLine?.speaker?.kind === "npc"
    ? activeEndingLine.speaker.npcId : null;

  const endingNarratorLineText = activeEndingLine?.speaker?.kind === "narrator" || !activeEndingLine?.speaker ? endingLineText : "";

  const activeDialogue = useMemo(() => {
    if (!gameState?.activeDialogue) return null;

    return findActiveDialogue(gameState);
  }, [gameState]);

  const currentDialogueNode = useMemo(() => {
    if (!gameState?.activeDialogue) return null;

    return findCurrentDialogueNode(gameState);
  }, [gameState]);

  const dialogueOptions = useMemo(() => {
    if (!gameState) return [];

    return getDialogueOptions(gameState);
  }, [gameState]);

  const activeDialogueLine = useMemo(() => {
    if (!gameState) return null;

    return getActiveDialogueLine(gameState);
  }, [gameState]);

  const isDialogueOpen = Boolean(gameState?.activeDialogue && activeDialogue && currentDialogueNode);
  const shouldShowDialogueChoices = isDialogueOpen && gameState?.activeDialogue?.phase === "choosing" && dialogueOptions.length > 0;

  const sceneBubbleText = sceneMessage?.speaker?.kind === "player" || sceneMessage?.speaker?.kind === "npc" ? messageAsDialogueText : null;

  const dialogueBubbleText = activeDialogueLine?.text ?? (endingLineSpeaker ? endingLineText : null) ?? sceneBubbleText ?? "";

  const dialogueBubbleSpeaker = activeDialogueLine?.speaker ?? endingLineSpeaker ?? 
    (sceneMessage?.speaker?.kind === "player" ? "player" : sceneMessage?.speaker?.kind === "npc" ? "npc" : null);

  const messageBubbleSpeakerId = sceneMessage?.speaker?.kind === "player" ? sceneMessage.speaker.playerId : sceneMessage?.speaker?.kind === "npc"
    ? sceneMessage.speaker.npcId : null;

  const dialogueBubbleSpeakerId = activeDialogueLine?.speaker === "player" ? activeDialogue?.playerId ?? null : activeDialogueLine?.speaker === "npc"
    ? activeDialogue?.npcId ?? null : endingLineSpeakerId ?? messageBubbleSpeakerId;

  const narratorMessageText = sceneMessage?.speaker?.kind === "narrator" && messageAsDialogueText ? messageAsDialogueText : "";

  return {
    gameEnded, endingMessage, endingLines, endingLineIndex, activeEndingLine, endingLinesFinished, endingNarratorLineText, hasSceneMessage,
    messageAsDialogueText, narratorMessageText, activeDialogue, currentDialogueNode, dialogueOptions, activeDialogueLine, isDialogueOpen,
    shouldShowDialogueChoices, dialogueBubbleText, dialogueBubbleSpeaker, dialogueBubbleSpeakerId,
  };
}