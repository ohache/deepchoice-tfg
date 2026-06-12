import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ID, PlacedItem, PlacedNpc, Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { ensureNodeRuntime } from "@/engine/state/runtimeState";
import { musicPlay, musicRememberPosition, musicSetTargetTrack, musicStop, selectSavedTrackPosition } from "@/engine/state/slices/musicSlice";
import { useGameStore } from "@/store/gameStore";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";
import { useSceneAudio } from "@/features/player/hooks/useSceneAudio";
import { usePlayerKeyboard } from "@/features/player/hooks/usePlayerKeyboard";
import { usePlayerDisplayedNode } from "@/features/player/hooks/usePlayerDisplayedNode";
import { usePlayerCursor } from "@/features/player/hooks/usePlayerCursor";
import { usePlayerInventoryView } from "@/features/player/hooks/usePlayerInventoryView";
import { usePlayerSceneViewModel } from "@/features/player/hooks/usePlayerSceneViewModel";
import { usePlayerItemInteractions } from "./hooks/usePlayerItemInteraction";
import { SceneStage } from "@/features/player/components/SceneStage";
import { PlayerBottomBar } from "@/features/player/components/PlayerBottomBar";
import { PlayerSettingsOverlay } from "@/features/player/components/PlayerSettingsOverlay";
import { useFullscreen } from "@/features/player/hooks/useFullscreen";
import { InventoryOverlay, type InventoryItemView } from "@/features/player/components/InventoryOverlay";
import { MapOverlay } from "@/features/player/components/MapOVerlay";
import { DialogueChoicesPanel } from "@/features/player/components/DialogueChoicesPanel";
import { PlayerCursor, PlayerTextPanel } from "@/features/player/components/PlayerOverlays";
import { resolveTextTokensToParts } from "@/features/editor/scene/textTokens/ResolveTextTokens";
import { buildAssetIdByKind, buildAssetIdToFile, resolveAssetIdToSrc } from "@/features/player/utils/playerAssetResolution";
import { pickActiveMusicTrackId, pickNodeById } from "@/features/player/utils/playerSceneResolution";
import { findActiveDialogue, findCurrentDialogueNode, getActiveDialogueLine, getDialogueOptions } from "@/features/player/utils/playerDialogueResolution";

const DEFAULT_DIALOGUE_AUTO_ADVANCE_MS = 2000;
const DEFAULT_MUSIC_VOLUME = 1;
const DEFAULT_SFX_VOLUME = 1;
const HORIZONTAL_TEXT_DOCK_HEIGHT = 160;
const VERTICAL_TEXT_DOCK_WIDTH = 280;

function withPreparedRuntimeAndMusic(state: GameState): GameState {
  const withRuntime = ensureNodeRuntime(state, state.currentNodeId);

  if (withRuntime.gameEnded) return withRuntime;

  const node = pickNodeById(withRuntime.project, withRuntime.currentNodeId);

  if (!node) return withRuntime;

  const targetTrackId = pickActiveMusicTrackId(node, withRuntime);
  const nextMusic = musicSetTargetTrack(withRuntime.music, targetTrackId);

  if (nextMusic === withRuntime.music) return withRuntime;

  return {
    ...withRuntime,
    music: nextMusic,
  };
}

export function PlayerShell() {
  const navigate = useNavigate();

  const gameState = useGameStore((s) => s.gameState);
  const assetUrls = useGameStore((s) => s.assetUrls);
  const resetGame = useGameStore((s) => s.reset);
  const applyHotspot = useGameStore((s) => s.applyHotspot);
  const applyPlacedItemInteraction = useGameStore((s) => s.applyPlacedItemInteraction);
  const applyPlacedNpcInteraction = useGameStore((s) => s.applyPlacedNpcInteraction);
  const audioAdapter = useGameStore((s) => s.audioAdapter);
  const advanceDialogue = useGameStore((s) => s.advanceDialogue);
  const advanceEndingLine = useGameStore((s) => s.advanceEndingLine);
  const closeMap = useGameStore((s) => s.closeMap);
  const toggleMap = useGameStore((s) => s.toggleMap);
  const cycleMapRegionSelection = useGameStore((s) => s.cycleMapRegionSelection);
  const travelToSelectedMapRegion = useGameStore((s) => s.travelToSelectedMapRegion);
  const selectMapRegion = useGameStore((s) => s.selectMapRegion);
  const saveGameToFile = useGameStore((s) => s.saveGameToFile);
  const loadGameFromFile = useGameStore((s) => s.loadGameFromFile);

  const gameEnded = Boolean(gameState?.gameEnded);
  const endingMessage = gameState?.ending?.message?.trim() ?? "";

  const pushUiMessage = useUiMessageStore((s) => s.push);
  const clearUiMessages = useUiMessageStore((s) => s.clear);
  const sceneMessage = useUiMessageStore((s) => s.queue[0]);

  const hasSceneMessage = Boolean(sceneMessage?.text?.trim());
  const messageAsDialogueText = sceneMessage?.text ?? null;

  const project: Project | null = gameState?.project ?? null;
  const currentNodeId = gameState?.currentNodeId;

  const endingLines = gameState?.ending?.lines ?? [];
  const endingLineIndex = gameState?.endingLineIndex ?? 0;
  const activeEndingLine = gameEnded && endingLineIndex < endingLines.length
    ? endingLines[endingLineIndex]
    : null;

  const endingLinesFinished = gameEnded && endingLineIndex >= endingLines.length;

  const [bottomBarOpen, setBottomBarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<{ type: "default" } | { type: "useItem"; item: InventoryItemView }>({ type: "default" });

  const [revealSignal, setRevealSignal] = useState(0);
  const [blockTabUntil, setBlockTabUntil] = useState(0);

  const [sceneContentRect, setSceneContentRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [musicVolume, setMusicVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SFX_VOLUME);
  const [dialogueDelayMs, setDialogueDelayMs] = useState(DEFAULT_DIALOGUE_AUTO_ADVANCE_MS);

  const { toggleFullscreen } = useFullscreen();

  const { isFading, displayedNodeId, displayedGameState } = usePlayerDisplayedNode(gameState, currentNodeId);

  const endingLineText = activeEndingLine?.text?.trim() ?? "";

  const endingLineSpeaker =
    activeEndingLine?.speaker?.kind === "player"
      ? "player"
      : activeEndingLine?.speaker?.kind === "npc"
        ? "npc"
        : null;

  const endingLineSpeakerId =
    activeEndingLine?.speaker?.kind === "player"
      ? activeEndingLine.speaker.playerId
      : activeEndingLine?.speaker?.kind === "npc"
        ? activeEndingLine.speaker.npcId
        : null;

  const endingNarratorLineText =
    activeEndingLine?.speaker?.kind === "narrator" || !activeEndingLine?.speaker
      ? endingLineText
      : "";

  const assetIdToFile = useMemo(() => {
    if (!project) return new Map<ID, string>();
    return buildAssetIdToFile(project);
  }, [project]);

  const itemAssetIdByItemId = useMemo(() => {
    if (!project) return new Map<ID, ID>();
    return buildAssetIdByKind(project, "items");
  }, [project]);

  const playerImageAssetIdByImageId = useMemo(() => {
    if (!project) return new Map<ID, ID>();
    return buildAssetIdByKind(project, "players");
  }, [project]);

  const npcAssetIdByNpcId = useMemo(() => {
    if (!project) return new Map<ID, ID>();
    return buildAssetIdByKind(project, "npcs");
  }, [project]);

  const { inventoryItems } = usePlayerInventoryView(project, gameState, assetIdToFile, assetUrls, sceneContentRect);

  const { textCursor, playerCursor, isUsingItem, effectivePlayerCursorSrc, selectedItemCursorSize, showPlayerCursor, hidePlayerCursor,
    updatePlayerCursorFromMouseEvent, updateTextCursor, hideTextCursor, hideAllCursors } = usePlayerCursor(interactionMode);

  const { currentNode, activeText, activeImageSrc, hotspotsForStage,
    placedItemsForStage: rawPlacedItemsForStage,
    placedPlayersForStage: rawPlacedPlayersForStage,
    placedNpcsForStage: rawPlacedNpcsForStage,
  } = usePlayerSceneViewModel(project, displayedNodeId, gameState, assetIdToFile, assetUrls);

  const placedItemsForStage = useMemo(() => {
    return rawPlacedItemsForStage.map(({ placedItem, runtime }) => {
      const assetId = itemAssetIdByItemId.get(placedItem.itemId);
      const imageSrc = assetId ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) : undefined;

      return { placedItem, runtime, imageSrc };
    });
  }, [rawPlacedItemsForStage, itemAssetIdByItemId, assetIdToFile, assetUrls]);

  const placedPlayersForStage = useMemo(() => {
    const nodeRt = displayedGameState && currentNode ? displayedGameState.nodes?.[currentNode.id] : null;

    return rawPlacedPlayersForStage.map(({ placedPlayer, runtime }) => {
      const runtimeImageId = nodeRt?.placedPlayerImageId?.[placedPlayer.playerId] ?? placedPlayer.initialImageId;

      const assetId = playerImageAssetIdByImageId.get(runtimeImageId);
      const imageSrc = assetId ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) : undefined;

      return { placedPlayer, runtime, imageSrc };
    });
  }, [rawPlacedPlayersForStage, displayedGameState, currentNode, playerImageAssetIdByImageId, assetIdToFile, assetUrls]);

  const placedNpcsForStage = useMemo(() => {
    return rawPlacedNpcsForStage.map(({ placedNpc, runtime }) => {
      const assetId = npcAssetIdByNpcId.get(placedNpc.npcId);
      const imageSrc = assetId ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) : undefined;

      return { placedNpc, runtime, imageSrc };
    });
  }, [rawPlacedNpcsForStage, npcAssetIdByNpcId, assetIdToFile, assetUrls]);

  const runtimeNode = useMemo(() => {
    if (!project || !gameState?.currentNodeId) return null;
    return pickNodeById(project, gameState.currentNodeId);
  }, [project, gameState?.currentNodeId]);

  const activeMusicTrackId = useMemo(() => {
    if (!gameState) return undefined;

    if (gameState.gameEnded && gameState.ending?.musicTrackId) {
      return gameState.ending.musicTrackId;
    }

    return (
      gameState.music.targetTrackId ??
      gameState.music.currentTrackId ??
      (runtimeNode ? pickActiveMusicTrackId(runtimeNode, gameState) : undefined)
    );
  }, [runtimeNode, gameState]);

  const activeMusicSrc = useMemo(() => {
    return resolveAssetIdToSrc(activeMusicTrackId, assetIdToFile, assetUrls);
  }, [activeMusicTrackId, assetIdToFile, assetUrls]);

  const savedMusicPosition = useMemo(() => {
    if (!gameState?.music || !activeMusicTrackId) return 0;

    if (gameState.gameEnded && gameState.ending?.musicTrackId === activeMusicTrackId) return 0;

    return selectSavedTrackPosition(gameState.music, activeMusicTrackId);
  }, [gameState?.music, gameState?.gameEnded, gameState?.ending?.musicTrackId, activeMusicTrackId]);

  const { audioRef } = useSceneAudio({
    targetTrackId: gameState?.music.targetTrackId,
    currentTrackId: gameState?.music.currentTrackId,
    musicSrc: activeMusicSrc,
    savedPosition: savedMusicPosition,
    loop: true,
    onRememberPosition: (trackId, seconds) => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicRememberPosition(prev.gameState.music, trackId, seconds),
          },
        };
      });
    },
    onPlaybackStarted: (trackId) => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicPlay(prev.gameState.music, trackId, { startAt: "resume" }),
          },
        };
      });
    },
    onPlaybackStopped: () => {
      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        return {
          ...prev,
          gameState: {
            ...prev.gameState,
            music: musicStop(prev.gameState.music, { keepLastTrackId: true }),
          },
        };
      });
    },
  });

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = musicVolume;
  }, [audioRef, musicVolume]);

  useEffect(() => {
    audioAdapter?.setSfxVolume(sfxVolume);
  }, [audioAdapter, sfxVolume]);


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

  const closeSettingsAndBottomBar = useCallback(() => {
    setSettingsOpen(false);
    setBottomBarOpen(false);
    setBlockTabUntil(Date.now() + 150);
  }, []);

  const isDialogueOpen = Boolean(gameState?.activeDialogue && activeDialogue && currentDialogueNode);
  const isMapOpen = Boolean(gameState?.map.isOpen);

const sceneBubbleText =
  sceneMessage?.speaker?.kind === "player" || sceneMessage?.speaker?.kind === "npc"
    ? messageAsDialogueText
    : null;

const dialogueBubbleText =
  activeDialogueLine?.text ??
  (endingLineSpeaker ? endingLineText : null) ??
  sceneBubbleText ??
  "";

  const dialogueBubbleSpeaker =
    activeDialogueLine?.speaker ??
    endingLineSpeaker ??
    (sceneMessage?.speaker?.kind === "player"
      ? "player"
      : sceneMessage?.speaker?.kind === "npc"
        ? "npc"
        : null);

  const messageBubbleSpeakerId =
    sceneMessage?.speaker?.kind === "player"
      ? sceneMessage.speaker.playerId
      : sceneMessage?.speaker?.kind === "npc"
        ? sceneMessage.speaker.npcId
        : null;

  const dialogueBubbleSpeakerId =
    activeDialogueLine?.speaker === "player"
      ? activeDialogue?.playerId ?? null
      : activeDialogueLine?.speaker === "npc"
        ? activeDialogue?.npcId ?? null
        : endingLineSpeakerId ?? messageBubbleSpeakerId;

  const shouldShowDialogueChoices = isDialogueOpen && gameState?.activeDialogue?.phase === "choosing" && dialogueOptions.length > 0;

  const resolvedActiveText = useMemo(() => {
    if (!project) return activeText.text ?? "";

    const parts = resolveTextTokensToParts(activeText.text ?? "", project);

    return parts.map((part) => (part.type === "text" ? part.value : part.resolvedText ?? part.raw)).join("");
  }, [activeText.text, project]);

  const hasText = resolvedActiveText.trim().length > 0;

  const layoutClass =
    hasText && (activeText.dock === "left" || activeText.dock === "right")
      ? "flex-row"
      : "flex-col";

  const isHorizontalTextDock =
    hasText && (activeText.dock === "top" || activeText.dock === "bottom");

  const isVerticalTextDock =
    hasText && (activeText.dock === "left" || activeText.dock === "right");

  const sceneStageFrameStyle: React.CSSProperties =
    isHorizontalTextDock
      ? activeText.dock === "top"
        ? {
          position: "absolute",
          left: 0,
          right: 0,
          top: HORIZONTAL_TEXT_DOCK_HEIGHT,
          bottom: 0,
        }
        : {
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          bottom: HORIZONTAL_TEXT_DOCK_HEIGHT,
        }
      : isVerticalTextDock
        ? activeText.dock === "left"
          ? {
            position: "absolute",
            left: VERTICAL_TEXT_DOCK_WIDTH,
            right: 0,
            top: 0,
            bottom: 0,
          }
          : {
            position: "absolute",
            left: 0,
            right: VERTICAL_TEXT_DOCK_WIDTH,
            top: 0,
            bottom: 0,
          }
        : {
          position: "absolute",
          inset: 0,
        };

  const textPanelDisabled = bottomBarOpen || settingsOpen || inventoryOpen || isMapOpen;

  const clearInteractionMode = useCallback(() => setInteractionMode({ type: "default" }), []);

  const { useOnHotspot, useOnPlacedItem, useOnPlacedNpc, useOnInventoryItem } =
    usePlayerItemInteractions(gameState, interactionMode.type === "useItem" ? interactionMode.item.itemInstanceId : null,
      audioAdapter, withPreparedRuntimeAndMusic, clearInteractionMode);

  const handleSceneContentRectChange = useCallback(
    (rect: { x: number; y: number; w: number; h: number } | null) => {
      if (!rect) {
        setSceneContentRect(null);
        return;
      }

      const xOffset =
        hasText && activeText.dock === "left"
          ? VERTICAL_TEXT_DOCK_WIDTH
          : 0;

      const yOffset =
        hasText && activeText.dock === "top"
          ? HORIZONTAL_TEXT_DOCK_HEIGHT
          : 0;

      setSceneContentRect({
        ...rect,
        x: rect.x + xOffset,
        y: rect.y + yOffset,
      });
    },
    [hasText, activeText.dock]
  );

  const closePlayerOverlays = useCallback(() => {
    setInventoryOpen(false);
    setBottomBarOpen(false);
    setSettingsOpen(false);
    clearInteractionMode();
    hideAllCursors();

    setBlockTabUntil(Date.now() + 150);
  }, [clearInteractionMode, hideAllCursors]);

  const openSettings = useCallback(() => {
    if (isDialogueOpen || isMapOpen || inventoryOpen) return;

    hidePlayerCursor();
    setInventoryOpen(false);
    setBottomBarOpen(true);
    setSettingsOpen(true);
    clearInteractionMode();
  }, [isDialogueOpen, isMapOpen, inventoryOpen, clearInteractionMode]);

  useEffect(() => {
    if (!hasSceneMessage) return;

    closePlayerOverlays();
    hideAllCursors();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ".") return;

      event.preventDefault();
      clearUiMessages();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasSceneMessage, clearUiMessages, closePlayerOverlays, hideAllCursors]);

  const handleSaveGame = useCallback(
    (filename?: string) => {
      try {
        saveGameToFile(filename);

        setSettingsOpen(false);
        setBottomBarOpen(false);
        setInventoryOpen(false);
        clearInteractionMode();

        pushUiMessage({ text: "Partida guardada.", preferredChannel: "bubble" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se ha podido guardar la partida.";
        pushUiMessage({ text: msg, preferredChannel: "bubble" });
      }
    },
    [saveGameToFile, pushUiMessage, clearInteractionMode]
  );

  const handleLoadGame = useCallback(
    async (file: File) => {
      try {
        await loadGameFromFile(file);

        closePlayerOverlays();

        pushUiMessage({ text: "Partida cargada correctamente.", preferredChannel: "bubble" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se ha podido cargar la partida.";
        pushUiMessage({ text: msg, preferredChannel: "bubble" });
      }
    },
    [loadGameFromFile, pushUiMessage, closePlayerOverlays]
  );

  const handleExitGame = useCallback(() => {
    closeMap();
    clearInteractionMode();
    resetGame();
    navigate("/");
  }, [closeMap, clearInteractionMode, resetGame, navigate]);

  const keyboardMode = useMemo(() => {
    if (isDialogueOpen) return "dialogue";
    if (isMapOpen) return "map";
    if (settingsOpen) return "settings";
    if (inventoryOpen) return "inventory";
    if (bottomBarOpen) return "bottomBar";
    if (gameEnded) return "settings";

    return "game";
  }, [isDialogueOpen, isMapOpen, settingsOpen, inventoryOpen, bottomBarOpen, gameEnded]);

  usePlayerKeyboard({
    mode: keyboardMode,
    blockTabUntil,
    openInventory: () => {
      if (hasSceneMessage || isDialogueOpen || isMapOpen) return;
      setInventoryOpen((prev) => !prev);
    },
    openMap: () => {
      if (hasSceneMessage || isDialogueOpen) return;

      setInventoryOpen(false);
      setBottomBarOpen(false);
      clearInteractionMode();
      toggleMap();
    },
    openSettings: () => {
      if (hasSceneMessage) return;
      openSettings();
    },
    toggleFullscreen,
    onTab: () => {
      if (isMapOpen) {
        cycleMapRegionSelection();
        return;
      }

      setRevealSignal((prev) => prev + 1);
    },
    onEnter: () => {
      if (isMapOpen) {
        travelToSelectedMapRegion();
        return;
      }

      if (isDialogueOpen) {
        advanceDialogue();
      }
    },
    onEscape: () => {
      if (isMapOpen) {
        closeMap();
        return;
      }

      closePlayerOverlays();
    },
  });

  useEffect(() => {
    if (!isDialogueOpen) return;

    setInventoryOpen(false);
    setBottomBarOpen(false);
    setSettingsOpen(false);
    clearInteractionMode();

    showPlayerCursor(
      playerCursor.x || window.innerWidth / 2,
      playerCursor.y || window.innerHeight / 2,
      "dialogue"
    );
  }, [isDialogueOpen, clearInteractionMode, showPlayerCursor]);

  useEffect(() => {
    if (!isDialogueOpen) return;
    if (gameState?.activeDialogue?.phase !== "speaking") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ".") return;

      event.preventDefault();
      advanceDialogue();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogueOpen, gameState?.activeDialogue?.phase, advanceDialogue]);

  useEffect(() => {
    if (!isMapOpen) return;

    closePlayerOverlays();
  }, [isMapOpen, clearInteractionMode]);

  useEffect(() => {
    if (!isDialogueOpen || !currentDialogueNode || !gameState?.activeDialogue) return;
    if (gameState.activeDialogue.phase !== "speaking") return;
    if (dialogueOptions.length > 0) return;

    const delay = currentDialogueNode.type === "root" ? 0 : dialogueDelayMs;

    const timer = window.setTimeout(() => useGameStore.getState().advanceDialogue(), delay);

    return () => window.clearTimeout(timer);
  }, [isDialogueOpen, currentDialogueNode?.id, currentDialogueNode?.type, gameState?.activeDialogue?.phase, dialogueOptions.length, dialogueDelayMs]);

  useEffect(() => {
    if (!gameEnded) return;
    if (!activeEndingLine) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ".") return;

      event.preventDefault();
      advanceEndingLine();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameEnded, activeEndingLine, advanceEndingLine]);

  useEffect(() => {
    if (!gameEnded || !activeEndingLine) return;

    const timer = window.setTimeout(() => {
      useGameStore.getState().advanceEndingLine();
    }, dialogueDelayMs);

    return () => window.clearTimeout(timer);
  }, [gameEnded, activeEndingLine, dialogueDelayMs]);

  if (!gameState || !project) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-slate-300">
          No hay ninguna partida en curso.
          <br />
          Carga una aventura desde la pantalla de inicio.
        </p>

        <button type="button" onClick={() => navigate("/")} className="btn-primary-player">
          Volver al inicio
        </button>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-red-300">
          Error interno: no se ha encontrado el nodo actual con id{" "}
          <span className="font-mono">{gameState.currentNodeId}</span>.
        </p>

        <button
          type="button"
          onClick={() => {
            resetGame();
            navigate("/");
          }}
          className="btn-primary-player"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <audio ref={audioRef} className="hidden" />

      <div className="h-full min-h-0 flex flex-col bg-black">
        <div className={`flex min-h-0 flex-1 bg-black ${layoutClass}`}>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
            <div style={sceneStageFrameStyle}>
              <SceneStage
                key={`${currentNode.id}-${activeText.dock}-${hasText ? "text" : "no-text"}`}
                gameEnded={gameEnded}
                dialogueSpeakerId={dialogueBubbleSpeakerId}
                revealSignal={revealSignal}
                keyboardBlocked={keyboardMode !== "game"}
                onContentRectChange={handleSceneContentRectChange}
                imageSrc={activeImageSrc}
                hotspots={hotspotsForStage}
                placedItems={placedItemsForStage}
                placedPlayers={placedPlayersForStage}
                placedNpcs={placedNpcsForStage}
                dialogueText={dialogueBubbleText}
                dialogueSpeaker={dialogueBubbleSpeaker}
                isUsingItem={isUsingItem}
                onHotspotUseItem={useOnHotspot}
                onPlacedItemUseItem={useOnPlacedItem}
                onPlacedNpcUseItem={useOnPlacedNpc}
                onSceneBackgroundClick={() => {
                  if (gameEnded || hasSceneMessage || isMapOpen) return;
                  if (isUsingItem) clearInteractionMode();
                }}
                onCursorMove={updatePlayerCursorFromMouseEvent}
                onCursorEnter={updatePlayerCursorFromMouseEvent}
                onCursorLeave={hidePlayerCursor}
                onHotspotClick={(hotspot) => {
                  if (gameEnded || hasSceneMessage || interactionMode.type === "useItem" || isMapOpen) return;
                  applyHotspot(hotspot);
                }}
                onPlacedItemClick={(placedItem: PlacedItem) => {
                  if (gameEnded || hasSceneMessage || interactionMode.type === "useItem" || isMapOpen) return;
                  applyPlacedItemInteraction(placedItem);
                }}
                onPlacedNpcClick={(placedNpc: PlacedNpc) => {
                  if (gameEnded || hasSceneMessage || interactionMode.type === "useItem" || isMapOpen) return;
                  applyPlacedNpcInteraction(placedNpc);
                }}
                onNotReachable={(_, text) => {
                  if (isUsingItem) clearInteractionMode();
                  pushUiMessage({
                    text: text?.trim() || "No puedes interactuar con eso ahora.",
                    preferredChannel: "bubble",
                  });
                }}
                onPlacedItemNotReachable={(_, text) => {
                  if (isUsingItem) clearInteractionMode();
                  pushUiMessage({
                    text: text?.trim() || "No puedes interactuar con eso ahora.",
                    preferredChannel: "bubble",
                  });
                }}
                onPlacedNpcNotReachable={(_, text) => {
                  if (isUsingItem) clearInteractionMode();
                  pushUiMessage({
                    text: text?.trim() || "No puedes interactuar con eso ahora.",
                    preferredChannel: "bubble",
                  });
                }}
                cursorBlocked={gameEnded || hasSceneMessage || bottomBarOpen || settingsOpen || inventoryOpen || isMapOpen}
              />
            </div>

            {hasText && sceneContentRect ? (
              <PlayerTextPanel
                text={resolvedActiveText}
                cursor={textCursor}
                dock={activeText.dock}
                rect={sceneContentRect}
                dockMainSize={HORIZONTAL_TEXT_DOCK_HEIGHT}
                dockSideSize={VERTICAL_TEXT_DOCK_WIDTH}
                disabled={textPanelDisabled}
                onMouseMove={updateTextCursor}
                onMouseEnter={updateTextCursor}
                onMouseLeave={hideTextCursor}
              />
            ) : null}

            <div className={`absolute inset-0 z-200 pointer-events-none transition-opacity duration-150 ${isFading ? "opacity-100 bg-black" : "opacity-0 bg-black"}`}
            />

            <PlayerBottomBar
              open={bottomBarOpen}
              anchorRect={sceneContentRect}
              onToggle={() => {
                if (gameEnded) return;
                hidePlayerCursor();
                setBottomBarOpen((prev) => !prev);
              }}
              onClose={() => {
                if (gameEnded) return;
                setBottomBarOpen(false);
                setBlockTabUntil(Date.now() + 150);
              }}
              onOpenInventory={() => {
                if (gameEnded || isDialogueOpen || isMapOpen) return;
                setBottomBarOpen(true);
                setInventoryOpen(true);
              }}
              onOpenMap={() => {
                if (gameEnded || isDialogueOpen || inventoryOpen) return;
                setBottomBarOpen(true);
                toggleMap();
              }}
              onOpenSettings={openSettings}
              onToggleFullscreen={() => {
                toggleFullscreen();
                setBottomBarOpen(false);
                setBlockTabUntil(Date.now() + 150);
              }}
            />

            <InventoryOverlay
              open={!gameEnded && !isDialogueOpen && !isMapOpen && inventoryOpen}
              items={inventoryItems}
              onClose={() => setInventoryOpen(false)}
              onSelectItem={(item) => {
                setInteractionMode({ type: "useItem", item });
                setInventoryOpen(false);
              }}
              onUseItemOnInventoryItem={useOnInventoryItem}
            />

            <PlayerSettingsOverlay
              open={!isDialogueOpen && !isMapOpen && settingsOpen}
              musicVolume={musicVolume}
              sfxVolume={sfxVolume}
              dialogueDelayMs={dialogueDelayMs}
              onMusicVolumeChange={setMusicVolume}
              onSfxVolumeChange={setSfxVolume}
              onDialogueDelayChange={setDialogueDelayMs}
              onClose={closeSettingsAndBottomBar}
              onContinue={closeSettingsAndBottomBar}
              onSaveGame={handleSaveGame}
              onLoadGame={handleLoadGame}
              onExit={handleExitGame}
            />

            <DialogueChoicesPanel
              open={shouldShowDialogueChoices}
              options={dialogueOptions}
              anchorRect={sceneContentRect}
              onSelectOption={(nodeId) => advanceDialogue(nodeId)}
              onCursorMove={updatePlayerCursorFromMouseEvent}
              onCursorEnter={updatePlayerCursorFromMouseEvent}
              onCursorLeave={hidePlayerCursor}
            />

            {endingNarratorLineText && sceneContentRect ? (
              <div
                className="absolute z-50 max-w-md -translate-x-1/2 rounded-xl border border-slate-500 bg-slate-950/80 px-4 py-3 text-center text-base text-white shadow-xl"
                style={{
                  left: sceneContentRect.x + sceneContentRect.w / 2,
                  top: sceneContentRect.y + 24,
                  maxWidth: Math.min(480, sceneContentRect.w - 32),
                }}
              >
                {endingNarratorLineText}
              </div>
            ) : null}

            {gameEnded && endingLinesFinished && endingMessage && sceneContentRect ? (
              <div
                className="absolute z-50 max-w-md -translate-x-1/2 rounded-xl border border-slate-500 bg-slate-950/85 px-5 py-4 text-center text-lg font-semibold text-white shadow-2xl"
                style={{
                  left: sceneContentRect.x + sceneContentRect.w / 2,
                  top: sceneContentRect.y + 24,
                  maxWidth: Math.min(480, sceneContentRect.w - 32),
                }}
              >
                {endingMessage}
              </div>
            ) : null}

            {gameEnded && endingLinesFinished && sceneContentRect ? (
              <div
                className="absolute z-50 -translate-x-1/2"
                style={{
                  left: sceneContentRect.x + sceneContentRect.w / 2,
                  top: sceneContentRect.y + sceneContentRect.h - 98,
                }}
              >
                <button
                  type="button"
                  className="rounded-2xl border-2 border-cyan-300/70 bg-cyan-800 px-8 py-4 text-base font-bold text-white shadow-2xl hover:bg-cyan-700"
                  onClick={handleExitGame}
                >
                  Volver al inicio
                </button>
              </div>
            ) : null}

            {sceneMessage?.speaker?.kind === "narrator" && messageAsDialogueText && sceneContentRect ? (
              <div
                className="absolute z-40 max-w-md -translate-x-1/2 rounded-xl border border-slate-500 bg-slate-950/80 px-4 py-3 text-center text-base text-white shadow-xl"
                style={{
                  left: sceneContentRect.x + sceneContentRect.w / 2,
                  top: sceneContentRect.y + 24,
                  maxWidth: Math.min(480, sceneContentRect.w - 32),
                }}
              >
                {messageAsDialogueText}
              </div>
            ) : null}

            {isMapOpen && (
              <MapOverlay
                gameState={gameState}
                assetUrls={assetUrls}
                onClose={closeMap}
                onTravel={travelToSelectedMapRegion}
                onSelectRegion={selectMapRegion}
              />
            )}

            <PlayerCursor
              cursor={playerCursor}
              src={effectivePlayerCursorSrc}
              size={isUsingItem ? selectedItemCursorSize : { width: 64, height: 64 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}