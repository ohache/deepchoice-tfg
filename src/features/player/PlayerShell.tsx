import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { ItemInstance, PlacedNpc, Project } from "@/domain/types";
import { useGameStore } from "@/store/gameStore";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";
import { usePlayerKeyboard } from "@/features/player/hooks/usePlayerKeyboard";
import { usePlayerDisplayedNode } from "@/features/player/hooks/usePlayerDisplayedNode";
import { usePlayerCursor, PLAYER_CURSOR_DEFAULT_SIZE } from "@/features/player/hooks/usePlayerCursor";
import { usePlayerInventoryView } from "@/features/player/hooks/usePlayerInventoryView";
import { usePlayerSceneViewModel } from "@/features/player/hooks/usePlayerSceneViewModel";
import { usePlayerItemInteractions } from "@/features/player/hooks/usePlayerItemInteraction";
import { useFullscreen } from "@/features/player/hooks/useFullscreen";
import { usePlayerResolvedAssets } from "@/features/player/hooks/usePlayerResolvedAssets";
import { usePlayerTextDockLayout } from "@/features/player/hooks/usePlayerTextDockLayout";
import { usePlayerSpeechDisplay } from "@/features/player/hooks/usePlayerSpeechDisplay";
import { usePlayerMusicController } from "@/features/player/hooks/usePlayerMusicController";
import { SceneStage } from "@/features/player/components/SceneStage";
import { PlayerBottomBar } from "@/features/player/components/PlayerBottomBar";
import { PlayerSettingsOverlay } from "@/features/player/components/PlayerSettingsOverlay";
import { InventoryOverlay } from "@/features/player/components/InventoryOverlay";
import { MapOverlay } from "@/features/player/components/MapOverlay";
import { DialogueChoicesPanel } from "@/features/player/components/DialogueChoicesPanel";
import { PlayerCursor, PlayerTextPanel } from "@/features/player/components/PlayerOverlays";
import { pickNodeById } from "@/features/player/utils/playerSceneResolution";
import { usePlayerOverlayState } from "@/features/player/hooks/usePlayerOverlayState";

const DEFAULT_DIALOGUE_AUTO_ADVANCE_MS = 2000;
const DEFAULT_MUSIC_VOLUME = 1;
const DEFAULT_SFX_VOLUME = 1;

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
  const travelToMapRegion = useGameStore((s) => s.travelToMapRegion);
  const saveGameToFile = useGameStore((s) => s.saveGameToFile);
  const loadGameFromFile = useGameStore((s) => s.loadGameFromFile);

  const pushUiMessage = useUiMessageStore((s) => s.push);
  const dismissUiMessage = useUiMessageStore((s) => s.dismiss);
  const sceneMessage = useUiMessageStore((s) => s.queue[0]);

  const project: Project | null = gameState?.project ?? null;
  const currentNodeId = gameState?.currentNodeId;

  const [musicVolume, setMusicVolume] = useState(DEFAULT_MUSIC_VOLUME);
  const [sfxVolume, setSfxVolume] = useState(DEFAULT_SFX_VOLUME);
  const [dialogueDelayMs, setDialogueDelayMs] = useState(DEFAULT_DIALOGUE_AUTO_ADVANCE_MS);

  const { toggleFullscreen } = useFullscreen();

  const { isFading, displayedNodeId, displayedGameState } = usePlayerDisplayedNode(gameState, currentNodeId);

  const { bottomBarOpen, inventoryOpen, settingsOpen, interactionMode, revealSignal, blockTabUntil, clearInteractionMode, revealInteractiveElements,
    closeInventory, toggleInventory, openInventoryFromBottomBar, closeBottomBar, toggleBottomBar, openMapFromBottomBar, prepareForMapToggle,
    openSettingsOverlay, closeSettingsAndBottomBar, closeOverlays, startUseItemInteraction } = usePlayerOverlayState();

  const { assetIdToFile, resolvePlacedItemsForStage, resolvePlacedPlayersForStage, resolvePlacedNpcsForStage } = usePlayerResolvedAssets(project, assetUrls);

  const { inventoryItems } = usePlayerInventoryView(project, gameState, assetIdToFile, assetUrls, null);

  const { textCursor, playerCursor, isUsingItem, effectivePlayerCursorSrc, selectedItemCursorSize, showPlayerCursor, hidePlayerCursor,
    updatePlayerCursorFromMouseEvent, updateTextCursor, hideTextCursor, hideAllCursors } = usePlayerCursor(interactionMode);

  const playerCursorPositionRef = useRef({ x: playerCursor.x, y: playerCursor.y });

  useEffect(() => {
    playerCursorPositionRef.current = { x: playerCursor.x, y: playerCursor.y };
  }, [playerCursor.x, playerCursor.y]);

  const { currentNode, activeText, activeImageSrc, hotspotsForStage, placedItemsForStage: rawPlacedItemsForStage, placedPlayersForStage: rawPlacedPlayersForStage,
    placedNpcsForStage: rawPlacedNpcsForStage } = usePlayerSceneViewModel(project, displayedNodeId, displayedGameState, assetIdToFile, assetUrls);

  const placedItemsForStage = useMemo(() => {
    return resolvePlacedItemsForStage(rawPlacedItemsForStage);
  }, [rawPlacedItemsForStage, resolvePlacedItemsForStage]);

  const placedPlayersForStage = useMemo(() => {
    return resolvePlacedPlayersForStage(rawPlacedPlayersForStage, displayedGameState, currentNode);
  }, [rawPlacedPlayersForStage, displayedGameState, currentNode, resolvePlacedPlayersForStage]);

  const placedNpcsForStage = useMemo(() => {
    return resolvePlacedNpcsForStage(rawPlacedNpcsForStage);
  }, [rawPlacedNpcsForStage, resolvePlacedNpcsForStage]);

  const runtimeNode = useMemo(() => {
    if (!project || !gameState?.currentNodeId) return null;

    return pickNodeById(project, gameState.currentNodeId);
  }, [project, gameState?.currentNodeId]);

  const speech = usePlayerSpeechDisplay(gameState, sceneMessage);

  const { gameEnded, endingMessage, activeEndingLine, endingLinesFinished, endingNarratorLineText, hasSceneMessage, currentDialogueNode, dialogueOptions,
    isDialogueOpen, shouldShowDialogueChoices, dialogueBubbleText, dialogueBubbleSpeaker, dialogueBubbleSpeakerId, narratorMessageText } = speech;

  const isMapOpen = Boolean(gameState?.map.isOpen);

  const dismissSceneMessage = useCallback(() => {
    if (!sceneMessage) return;

    dismissUiMessage(sceneMessage.id);
  }, [sceneMessage, dismissUiMessage]);

  const { sceneContentRect, resolvedActiveText, hasText, layoutClass, sceneStageFrameStyle, textPanelDisabled, handleSceneContentRectChange,
    dockMainSize, dockSideSize } = usePlayerTextDockLayout({ project, activeText, bottomBarOpen, settingsOpen, inventoryOpen, isMapOpen });

  const { audioRef } = usePlayerMusicController({ gameState, runtimeNode, assetIdToFile, assetUrls, audioAdapter, musicVolume, sfxVolume });

  const { useOnHotspot, useOnPlacedItem, useOnPlacedNpc, useOnInventoryItem } = usePlayerItemInteractions(gameState,
    interactionMode.type === "useItem" ? interactionMode.item.itemInstanceId : null, audioAdapter, clearInteractionMode);

  const closePlayerOverlays = useCallback(() => {
    closeOverlays();
    hideAllCursors();
  }, [closeOverlays, hideAllCursors]);

  const openSettings = useCallback(() => {
    if (isDialogueOpen || isMapOpen || inventoryOpen) return;

    dismissSceneMessage();
    hidePlayerCursor();
    openSettingsOverlay();
  }, [isDialogueOpen, isMapOpen, inventoryOpen, dismissSceneMessage, hidePlayerCursor, openSettingsOverlay]);

  useEffect(() => {
    if (!sceneMessage) return;

    const messageId = sceneMessage.id;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ".") return;

      event.preventDefault();
      dismissUiMessage(messageId);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sceneMessage?.id, dismissUiMessage]);

  const handleSaveGame = useCallback((filename?: string) => {
    try {
      saveGameToFile(filename);

      closeOverlays(false);

      pushUiMessage({ text: "Partida guardada.", preferredChannel: "bubble" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido guardar la partida.";
      pushUiMessage({ text: msg, preferredChannel: "bubble" });
    }
  }, [saveGameToFile, pushUiMessage, closeOverlays],
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
    }, [loadGameFromFile, pushUiMessage, closePlayerOverlays],
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
    if (bottomBarOpen) return "playerBottomBar";
    if (gameEnded) return "settings";

    return "game";
  }, [isDialogueOpen, isMapOpen, settingsOpen, inventoryOpen, bottomBarOpen, gameEnded]);

  usePlayerKeyboard({
    mode: keyboardMode,
    blockTabUntil,
    openInventory: () => {
      if (isDialogueOpen || isMapOpen) return;

      dismissSceneMessage();
      toggleInventory();
    },
    openMap: () => {
      if (isDialogueOpen) return;

      dismissSceneMessage();
      prepareForMapToggle();
      toggleMap();
    },
    openSettings: () => {
      openSettings();
    },
    toggleFullscreen,
    onTab: () => {
      if (isMapOpen) {
        cycleMapRegionSelection();
        return;
      }

      revealInteractiveElements();
    },
    onEnter: () => {
      if (isMapOpen) {
        travelToSelectedMapRegion();
        return;
      }

      if (isDialogueOpen) advanceDialogue();
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

    closeOverlays(false);
    const { x, y } = playerCursorPositionRef.current;

    showPlayerCursor(x || window.innerWidth / 2, y || window.innerHeight / 2, "dialogue");
  }, [isDialogueOpen, closeOverlays, showPlayerCursor]);

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
  }, [isMapOpen, closePlayerOverlays]);

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
                scene={{
                  imageSrc: activeImageSrc,
                  gameEnded,
                  revealSignal,
                  keyboardBlocked: keyboardMode !== "game" && !hasSceneMessage,
                }}
                entities={{
                  hotspots: hotspotsForStage,
                  placedItems: placedItemsForStage,
                  placedPlayers: placedPlayersForStage,
                  placedNpcs: placedNpcsForStage,
                }}
                dialogue={{
                  text: dialogueBubbleText,
                  speaker: dialogueBubbleSpeaker,
                  speakerId: dialogueBubbleSpeakerId,
                }}
                itemUse={{
                  isUsingItem,
                  onHotspotUseItem: useOnHotspot,
                  onPlacedItemUseItem: useOnPlacedItem,
                  onPlacedNpcUseItem: useOnPlacedNpc,
                }}
                cursor={{
                  blocked: gameEnded || bottomBarOpen || settingsOpen || inventoryOpen || isMapOpen,
                  onMove: updatePlayerCursorFromMouseEvent,
                  onEnter: updatePlayerCursorFromMouseEvent,
                  onLeave: hidePlayerCursor,
                }}
                interactions={{
                  onSceneBackgroundClick: () => {
                    if (gameEnded || isMapOpen) return;

                    dismissSceneMessage();

                    if (isUsingItem) clearInteractionMode();
                  },
                  onHotspotClick: (hotspot) => {
                    if (gameEnded || interactionMode.type === "useItem" || isMapOpen) return;

                    dismissSceneMessage();
                    applyHotspot(hotspot);
                  },
                  onPlacedItemClick: (placedItem: ItemInstance) => {
                    if (gameEnded || interactionMode.type === "useItem" || isMapOpen) return;

                    dismissSceneMessage();
                    applyPlacedItemInteraction(placedItem);
                  },
                  onPlacedNpcClick: (placedNpc: PlacedNpc) => {
                    if (gameEnded || interactionMode.type === "useItem" || isMapOpen) return;

                    dismissSceneMessage();
                    applyPlacedNpcInteraction(placedNpc);
                  },
                  onHotspotNotReachable: (_, text) => {
                    if (isUsingItem) clearInteractionMode();
                    pushUiMessage({ text: text?.trim() || "No puedes interactuar con eso ahora.", preferredChannel: "bubble" });
                  },
                  onPlacedItemNotReachable: (_, text) => {
                    if (isUsingItem) clearInteractionMode();
                    pushUiMessage({ text: text?.trim() || "No puedes interactuar con eso ahora.", preferredChannel: "bubble" });
                  },
                  onPlacedNpcNotReachable: (_, text) => {
                    if (isUsingItem) clearInteractionMode();
                    pushUiMessage({ text: text?.trim() || "No puedes interactuar con eso ahora.", preferredChannel: "bubble" });
                  },
                }}
                onContentRectChange={handleSceneContentRectChange}
              />
            </div>

            {hasText && sceneContentRect ? (
              <PlayerTextPanel
                text={resolvedActiveText}
                cursor={textCursor}
                dock={activeText.dock}
                rect={sceneContentRect}
                dockMainSize={dockMainSize}
                dockSideSize={dockSideSize}
                disabled={textPanelDisabled}
                onMouseMove={updateTextCursor}
                onMouseEnter={updateTextCursor}
                onMouseLeave={hideTextCursor}
              />
            ) : null}

            <div className={`absolute inset-0 z-200 pointer-events-none transition-opacity duration-150 ${isFading ? "opacity-100 bg-black" : "opacity-0 bg-black"}`} />

            <PlayerBottomBar
              open={bottomBarOpen}
              anchorRect={sceneContentRect}
              onToggle={() => {
                if (gameEnded) return;

                hidePlayerCursor();
                toggleBottomBar();
              }}
              onClose={() => {
                if (gameEnded) return;
                closeBottomBar();
              }}
              onOpenInventory={() => {
                if (gameEnded || isDialogueOpen || isMapOpen) return;

                dismissSceneMessage();
                openInventoryFromBottomBar();
              }}
              onOpenMap={() => {
                if (gameEnded || isDialogueOpen || inventoryOpen) return;

                dismissSceneMessage();
                openMapFromBottomBar();
                toggleMap();
              }}
              onOpenSettings={openSettings}
              onToggleFullscreen={() => {
                toggleFullscreen();
                closeBottomBar();
              }}
            />

            <InventoryOverlay
              open={!gameEnded && !isDialogueOpen && !isMapOpen && inventoryOpen}
              items={inventoryItems}
              onClose={closeInventory}
              onSelectItem={startUseItemInteraction}
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

            {narratorMessageText && sceneContentRect ? (
              <div
                className="absolute z-40 max-w-md -translate-x-1/2 rounded-xl border border-slate-500 bg-slate-950/80 px-4 py-3 text-center text-base text-white shadow-xl"
                style={{
                  left: sceneContentRect.x + sceneContentRect.w / 2,
                  top: sceneContentRect.y + 24,
                  maxWidth: Math.min(480, sceneContentRect.w - 32),
                }}
              >
                {narratorMessageText}
              </div>
            ) : null}

            {isMapOpen ? (
              <MapOverlay
                gameState={gameState}
                assetUrls={assetUrls}
                onClose={closeMap}
                onTravelToRegion={travelToMapRegion}
              />
            ) : null}

            <PlayerCursor
              cursor={playerCursor}
              src={effectivePlayerCursorSrc}
              size={isUsingItem ? selectedItemCursorSize : PLAYER_CURSOR_DEFAULT_SIZE}
            />
          </div>
        </div>
      </div>
    </div>
  );
}