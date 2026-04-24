import { useCallback, useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import type { ID, Node, Project, TextDock, PlaceableState, SceneImageLayer, PlacedItem, AssetDef, ItemDef, PlacedPlayerState, PlacedNpc } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";
import { applyHotspotUseItem } from "@/engine/apply/applyHotspot";
import { applyPlacedItemUseItem } from "@/engine/apply/applyPlacedItem";
import { useGameStore } from "@/store/gameStore";
import { ensureNodeRuntime, type InventoryEntry } from "@/engine/state/runtimeState";
import { musicRememberPosition, musicPlay, musicStop, musicSetTargetTrack, selectSavedTrackPosition } from "@/engine/state/slices/musicSlice";
import { useSceneAudio } from "@/features/player/hooks/useSceneAudio";
import { evaluateCondition } from "@/engine/conditions/evaluateConditions";
import { SceneStage } from "@/features/player/components/SceneStage";
import { resolveTextTokensToParts } from "@/features/editor/scene/textTokens/ResolveTextTokens";
import { BottomBar } from "@/features/player/components/BottomBar";
import { InventoryOverlay, type InventoryItemView } from "@/features/player/components/InventoryOverlay";
import { MapOverlay } from "@/features/player/components/MapOVerlay";
import { useUiMessageStore } from "@/engine/messages/uiMessageStore";
import { iconForInteractionKind, type InteractionKind } from "@/features/player/components/interactionCursors";
import { applyInventoryItemUseItem } from "@/engine/apply/applyInventoryItem";
import { applyPlacedNpcUseItem } from "@/engine/apply/applyPlacedNpc";
import { DialogueChoicesPanel } from "@/features/player/components/DialogueChoicesPanel";
import { usePlayerKeyboard } from "@/features/player/hooks/usePlayerKeyboard";
import { isEmptyCondition } from "@/features/editor/core/editorGenericSlice";

type PlayerInteractionMode =
  | { type: "default" }
  | { type: "useItem"; item: InventoryItemView }

const DIALOGUE_AUTO_ADVANCE_MS = 2000;

function buildAssetIdToFile(project: Project): Map<ID, string> {
  const m = new Map<ID, string>();
  for (const a of project.assets ?? []) m.set(a.id as ID, a.file);
  return m;
}

function resolveAssetIdToSrc(assetId: ID | undefined, assetIdToFile: Map<ID, string>, assetUrls: Record<string, string>) {
  if (!assetId) return undefined;

  const file = assetIdToFile.get(assetId);
  if (!file) return undefined;

  return assetUrls[file] ?? file;
}

function pickNodeById(project: Project, id: ID): Node | null {
  return project.nodes.find((n) => n.id === id) ?? null;
}

function indexOfNode(project: Project, id: ID): number {
  return project.nodes.findIndex((n) => n.id === id);
}

function nodeIdAtIndex(project: Project, idx: number): ID | null {
  const n = project.nodes[idx];
  return n ? (n.id as ID) : null;
}

function pickActiveLayer(node: Node, gameState: GameState): SceneImageLayer | null {
  const layers = node.layers ?? [];

  if (layers.length === 0) return null;

  for (const layer of layers) {
    if (!layer.when) continue;
    if (isEmptyCondition(layer.when)) continue;

    if (evaluateCondition(gameState, layer.when)) return layer;
  }

  return layers[0] ?? null;
}

function pickActiveText(layer: SceneImageLayer | null, gameState: GameState): { text: string; dock: TextDock } {
  if (!layer) return { text: "", dock: "bottom" };

  const dock: TextDock = layer.dock ?? "bottom";
  const entries = layer.text ?? [];

  for (const entry of entries) {
    if (!entry.when) continue;
    if (isEmptyCondition(entry.when)) continue;

    if (evaluateCondition(gameState, entry.when)) {
      return { text: entry.content ?? "", dock };
    }
  }

  const fallback = entries.find((e) => !e.when) ?? entries[0];

  return { text: fallback?.content ?? "", dock };
}

function pickActiveMusicTrackId(node: Node, gameState: GameState): ID | undefined {
  const activeLayer = pickActiveLayer(node, gameState);

  if (activeLayer?.musicTrackId) return activeLayer.musicTrackId;
  if (node.musicTrackId) return node.musicTrackId;

  const loc = node.mapLocation;
  if (!loc) return undefined;

  const map = gameState.project.maps.find((m) => m.id === loc.mapId) ?? null;
  const region = map?.regions.find((r) => r.id === loc.regionId) ?? null;

  return region?.musicTrackId;
}

function findPlacedItemShapeByInstanceId(project: Project, instanceId: ID) {
  for (const node of project.nodes ?? []) {
    for (const layer of node.layers ?? []) {
      for (const placedItem of layer.placedItems ?? []) {
        if (placedItem.id === instanceId) {
          return placedItem.shape;
        }
      }
    }
  }

  return null;
}

function findActiveDialogue(gameState: GameState) {
  const active = gameState.activeDialogue;
  if (!active) return null;

  const node = gameState.project.nodes.find((n) => n.id === active.nodeId);
  if (!node) return null;

  return (node.dialogues ?? []).find((d) => d.id === active.dialogueId) ?? null;
}

function findCurrentDialogueNode(gameState: GameState) {
  const active = gameState.activeDialogue;
  const dialogue = findActiveDialogue(gameState);

  if (!active || !dialogue) return null;

  return dialogue.nodes.find((n) => n.id === active.currentNodeId) ?? null;
}

function withPreparedRuntimeAndMusic(state: GameState): GameState {
  const withRuntime = ensureNodeRuntime(state, state.currentNodeId);
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

  const closeMap = useGameStore((s) => s.closeMap);
  const toggleMap = useGameStore((s) => s.toggleMap);
  const cycleMapRegionSelection = useGameStore((s) => s.cycleMapRegionSelection);
  const travelToSelectedMapRegion = useGameStore((s) => s.travelToSelectedMapRegion);
  const selectMapRegion = useGameStore((s) => s.selectMapRegion);

  const saveGameToFile = useGameStore((s) => s.saveGameToFile);
  const loadGameFromFile = useGameStore((s) => s.loadGameFromFile);

  const currentNodeId = useGameStore((s) => s.gameState?.currentNodeId);

  const pushUiMessage = useUiMessageStore((s) => s.push);
  const sceneMessage = useUiMessageStore((s) => s.queue[0]);

  const project: Project | null = gameState?.project ?? null;

  const [isFading, setIsFading] = useState(false);
  const prevNodeIdRef = useRef<ID | null>(null);

  const [displayedNodeId, setDisplayedNodeId] = useState<ID | null>(currentNodeId ?? null);
  const [displayedGameState, setDisplayedGameState] = useState<GameState | null>(gameState ?? null);
  const fadeTimeoutRef = useRef<number | null>(null);

  const [textCursor, setTextCursor] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
  const [playerCursor, setPlayerCursor] = useState<{ visible: boolean; kind: InteractionKind; x: number; y: number }>({ visible: false, kind: "idle", x: 0, y: 0 });

  const playerCursorIconSrc = iconForInteractionKind(playerCursor.kind);

  const [bottomBarOpen, setBottomBarOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<PlayerInteractionMode>({ type: "default" });

  const loadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentNodeId) return;

    if (displayedNodeId == null) {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }

      setIsFading(false);
      setDisplayedNodeId(currentNodeId);
      prevNodeIdRef.current = currentNodeId;
      return;
    }

    if (prevNodeIdRef.current === currentNodeId) {
      setIsFading(false);
      return;
    }

    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }

    setIsFading(true);

    fadeTimeoutRef.current = window.setTimeout(() => {
  setDisplayedNodeId(currentNodeId);
  setDisplayedGameState(gameState ?? null);

  window.setTimeout(() => {
    setIsFading(false);
  }, 120);
}, 120);

    prevNodeIdRef.current = currentNodeId;
  }, [currentNodeId, displayedNodeId]);

  useEffect(() => {
  if (!gameState) {
    setDisplayedGameState(null);
    return;
  }

  if (displayedNodeId === gameState.currentNodeId) {
    setDisplayedGameState(gameState);
  }
}, [gameState, displayedNodeId]);

useEffect(() => {
  if (!gameState?.currentNodeId) return;

  if (fadeTimeoutRef.current) {
    window.clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = null;
  }

  setIsFading(false);
  setDisplayedNodeId(gameState.currentNodeId);
  setDisplayedGameState(gameState);
  prevNodeIdRef.current = gameState.currentNodeId;
}, [gameState?.project?.id]);

  useEffect(() => {
    return () => {
      if (fadeTimeoutRef.current) {
        window.clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = null;
      }
    };
  }, []);

  const handleLoadSaveFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await loadGameFromFile(file);

      pushUiMessage({
        text: "Partida cargada correctamente.",
        preferredChannel: "bubble",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido cargar la partida.";

      pushUiMessage({
        text: msg,
        preferredChannel: "bubble",
      });
    } finally {
      e.target.value = "";
    }
  };

  const assetIdToFile = useMemo(() => {
    if (!project) return new Map<ID, string>();
    return buildAssetIdToFile(project);
  }, [project]);

  const itemAssetIdByItemId = useMemo(() => {
    const map = new Map<ID, ID>();

    for (const asset of project?.assets ?? []) {
      if ((asset as AssetDef).kind !== "items") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project]);

  const itemById = useMemo(() => {
    const map = new Map<ID, ItemDef>();

    for (const item of project?.items ?? []) {
      map.set(item.id, item);
    }

    return map;
  }, [project]);

  const inventoryItems = useMemo<InventoryItemView[]>(() => {
    if (!gameState) return [];

    return gameState.inventory.map((entry: InventoryEntry) => {
      const item = itemById.get(entry.itemId);

      if (!item) return null;

      const assetId = itemAssetIdByItemId.get(entry.itemId);

      const imageSrc = assetId
        ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls)
        : undefined;

      const shape = project
        ? findPlacedItemShapeByInstanceId(project, entry.instanceId)
        : null;

      const cursorSize =
        shape?.type === "rect"
          ? {
            width: Math.max(28, Math.min(160, shape.w * 1000)),
            height: Math.max(28, Math.min(160, shape.h * 1000)),
          }
          : {
            width: 64,
            height: 64,
          };

      return {
        instanceId: entry.instanceId,
        itemId: entry.itemId,
        name: item.name,
        imageSrc: imageSrc ?? "",
        cursorSize,
      };
    })
      .filter((item): item is InventoryItemView => item !== null);
  }, [gameState, itemById, itemAssetIdByItemId, assetIdToFile, assetUrls]);

  const playerImageAssetIdByImageId = useMemo(() => {
    const map = new Map<ID, ID>();

    for (const asset of project?.assets ?? []) {
      if (asset.kind !== "players") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project]);

  const npcAssetIdByNpcId = useMemo(() => {
    const map = new Map<ID, ID>();

    for (const asset of project?.assets ?? []) {
      if (asset.kind !== "npcs") continue;
      map.set(asset.id, asset.id);
    }

    return map;
  }, [project]);

  usePlayerKeyboard({
    openInventory: () => {
      if (isDialogueOpen || isMapOpen) return;
      setInventoryOpen((prev) => !prev);
    },
    openMap: () => {
      if (isDialogueOpen) return;

      setInventoryOpen(false);
      setBottomBarOpen(false);
      setInteractionMode({ type: "default" });
      toggleMap();
    },
    openSettings: () => { },
    toggleFullscreen: () => { },
    onTab: () => {
      if (!isMapOpen) return;
      cycleMapRegionSelection();
    },
    onEnter: () => {
      if (!isMapOpen) return;
      travelToSelectedMapRegion();
    },
    onEscape: () => {
      if (isMapOpen) {
        closeMap();
        return;
      }

      setInventoryOpen(false);
      setBottomBarOpen(false);
      setInteractionMode({ type: "default" });
    },
  });

  const currentNode = useMemo(() => {
    if (!project || !displayedNodeId) return null;

    return pickNodeById(project, displayedNodeId);
  }, [project, displayedNodeId]);

  const runtimeNode = useMemo(() => {
    if (!project || !gameState?.currentNodeId) return null;

    return pickNodeById(project, gameState.currentNodeId);
  }, [project, gameState?.currentNodeId]);

  const currentIndex = useMemo(() => {
    if (!project || !gameState) return 0;

    const idx = indexOfNode(project, gameState.currentNodeId);

    return idx >= 0 ? idx : 0;
  }, [project, gameState]);

  const activeDialogue = useMemo(() => {
    if (!gameState?.activeDialogue) return null;
    return findActiveDialogue(gameState);
  }, [gameState]);

  const currentDialogueNode = useMemo(() => {
    if (!gameState?.activeDialogue) return null;
    return findCurrentDialogueNode(gameState);
  }, [gameState]);

  const dialogueOptions = useMemo(() => {
    if (!gameState || !activeDialogue || !currentDialogueNode) return [];
    if (gameState.activeDialogue?.phase !== "choosing") return [];

    return currentDialogueNode.childrenIds
      .map((childId) => activeDialogue.nodes.find((n) => n.id === childId))
      .filter((node): node is NonNullable<typeof node> => !!node)
      .filter((node) => node.type === "line")
      .filter((node) => node.speaker === "player")
      .filter((node) => !node.when || evaluateCondition(gameState, node.when));
  }, [gameState, activeDialogue, currentDialogueNode]);

  const isDialogueOpen = !!gameState?.activeDialogue && !!activeDialogue && !!currentDialogueNode;

  const isMapOpen = Boolean(gameState?.map.isOpen);

  const activeDialogueLine =
    currentDialogueNode &&
      currentDialogueNode.type === "line" &&
      gameState?.activeDialogue?.phase === "speaking"
      ? currentDialogueNode
      : null;

  const dialogueBubbleText = activeDialogueLine?.text ?? "";
  const dialogueBubbleSpeaker = activeDialogueLine?.speaker ?? null;

  const shouldShowDialogueChoices = useMemo(() => {
    if (!isDialogueOpen || !currentDialogueNode || !gameState?.activeDialogue) return false;
    return gameState.activeDialogue.phase === "choosing" && dialogueOptions.length > 0;
  }, [isDialogueOpen, currentDialogueNode, gameState?.activeDialogue, dialogueOptions.length]);

  const isFinal = currentNode?.isFinal === true;

  const canGoPrev = !!project && currentIndex > 0;
  const canGoNext = !!project && !!currentNode && !isFinal && currentIndex < project.nodes.length - 1;


  useEffect(() => {
    if (!isDialogueOpen) return;

    showPlayerCursor(playerCursor.x, playerCursor.y, "dialogue");

    setInventoryOpen(false);
    setBottomBarOpen(false);
    setInteractionMode({ type: "default" });
  }, [isDialogueOpen, playerCursor.x, playerCursor.y]);

  useEffect(() => {
    if (!isMapOpen) return;

    setInventoryOpen(false);
    setBottomBarOpen(false);
    setInteractionMode({ type: "default" });
  }, [isMapOpen]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (!project) return;

      const nextId = nodeIdAtIndex(project, nextIndex);
      if (!nextId) return;

      useGameStore.setState((prev) => {
        if (!prev.gameState) return prev;

        const prevId = prev.gameState.currentNodeId;
        const prevIdx = indexOfNode(project, prevId);

        const goingForward = typeof prevIdx === "number" && nextIndex > prevIdx;

        const visitedNodes = goingForward
          ? { ...prev.gameState.visitedNodes, [prevId]: true }
          : prev.gameState.visitedNodes;

        const s1 = {
          ...prev.gameState,
          visitedNodes,
          currentNodeId: nextId,
        };

        const s2 = ensureNodeRuntime(s1, nextId);
        const s3 = withPreparedRuntimeAndMusic(s2);

        return { ...prev, gameState: s3 };
      });
    },
    [project]
  );

  const showPlayerCursor = useCallback(
    (x: number, y: number, kind: InteractionKind = "idle") => {
      setPlayerCursor({ visible: true, x, y, kind });
    },
    []
  );

  const hidePlayerCursor = useCallback(() => {
    setPlayerCursor((prev) => ({ ...prev, visible: false }));
  }, []);

  const clearInteractionMode = useCallback(() => {
    setInteractionMode({ type: "default" });
  }, []);

  const updatePlayerCursorFromMouseEvent = useCallback(
    (e: React.MouseEvent, kind: InteractionKind = "idle") => {
      showPlayerCursor(e.clientX, e.clientY, kind);
    },
    [showPlayerCursor]
  );

  const useSelectedItemOnHotspot = useCallback((hotspot: import("@/domain/types").Hotspot) => {
    if (interactionMode.type !== "useItem") return;
    if (!gameState) return;

    try {
      const nextState = applyHotspotUseItem(
        gameState,
        hotspot,
        interactionMode.item.instanceId,
        {
          audio: audioAdapter,
          emitMessage: (text) =>
            useUiMessageStore.getState().push({
              text,
              preferredChannel: "bubble",
            }),
        }
      );

      useGameStore.setState({ gameState: withPreparedRuntimeAndMusic(nextState) });
      setInteractionMode({ type: "default" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido usar el objeto.";
      pushUiMessage({ text: msg, preferredChannel: "bubble" });
    }
  }, [gameState, interactionMode, pushUiMessage, audioAdapter]);

  const useSelectedItemOnPlacedItem = useCallback((placedItem: PlacedItem) => {
    if (interactionMode.type !== "useItem") return;
    if (!gameState) return;

    try {
      const nextState = applyPlacedItemUseItem(
        gameState,
        placedItem,
        interactionMode.item.instanceId,
        {
          audio: audioAdapter,
          emitMessage: (text) =>
            useUiMessageStore.getState().push({
              text,
              preferredChannel: "bubble",
            }),
        }
      );

      useGameStore.setState({ gameState: withPreparedRuntimeAndMusic(nextState) });
      setInteractionMode({ type: "default" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido usar el objeto.";
      pushUiMessage({ text: msg, preferredChannel: "bubble" });
    }
  }, [gameState, interactionMode, pushUiMessage, audioAdapter]);

  const useSelectedItemOnPlacedNpc = useCallback((placedNpc: PlacedNpc) => {
    if (interactionMode.type !== "useItem") return;
    if (!gameState) return;

    try {
      const nextState = applyPlacedNpcUseItem(
        gameState,
        placedNpc,
        interactionMode.item.instanceId,
        {
          audio: audioAdapter,
          emitMessage: (text) =>
            useUiMessageStore.getState().push({
              text,
              preferredChannel: "bubble",
            }),
        }
      );

      useGameStore.setState({ gameState: withPreparedRuntimeAndMusic(nextState) });
      setInteractionMode({ type: "default" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido usar el objeto.";
      pushUiMessage({ text: msg, preferredChannel: "bubble" });
    }
  }, [gameState, interactionMode, pushUiMessage, audioAdapter]);

  const useInventoryItemOnInventoryItem = useCallback((sourceItem: InventoryItemView, targetItem: InventoryItemView) => {
    if (!gameState) return;

    try {
      const nextState = applyInventoryItemUseItem(
        gameState,
        sourceItem.instanceId,
        targetItem.instanceId,
        {
          audio: audioAdapter,
          emitMessage: (text: string) =>
            useUiMessageStore.getState().push({
              text,
              preferredChannel: "bubble",
            }),
        }
      );

      useGameStore.setState({ gameState: withPreparedRuntimeAndMusic(nextState) });
      setInteractionMode({ type: "default" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se ha podido usar el objeto.";
      pushUiMessage({ text: msg, preferredChannel: "bubble" });
    }
  }, [audioAdapter, gameState, pushUiMessage]);

  useEffect(() => {
    if (!isDialogueOpen) return;

    setInventoryOpen(false);
    setBottomBarOpen(false);
    setInteractionMode({ type: "default" });

    setPlayerCursor((prev) => ({ ...prev, visible: true, kind: "dialogue" }));
  }, [isDialogueOpen]);

  useEffect(() => {
    if (!isDialogueOpen || !currentDialogueNode || !gameState?.activeDialogue) return;
    if (gameState.activeDialogue.phase !== "speaking") return;
    if (dialogueOptions.length > 0) return;

    const delay = currentDialogueNode.type === "root" ? 0 : DIALOGUE_AUTO_ADVANCE_MS;

    const timer = window.setTimeout(() => {
      useGameStore.getState().advanceDialogue();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    isDialogueOpen,
    currentDialogueNode?.id,
    currentDialogueNode?.type,
    gameState?.activeDialogue?.phase,
    dialogueOptions.length,
  ]);

  const handlePrev = useCallback(() => {
    if (!canGoPrev || isMapOpen) return;
    goToIndex(currentIndex - 1);
  }, [canGoPrev, currentIndex, goToIndex]);

  const handleNext = useCallback(() => {
    if (!canGoNext || isMapOpen) return;
    goToIndex(currentIndex + 1);
  }, [canGoNext, currentIndex, goToIndex]);

  const activeLayer = useMemo(() => {
    if (!currentNode || !displayedGameState) return null;

    return pickActiveLayer(currentNode, displayedGameState);
  }, [currentNode, displayedGameState]);

  const activeText = useMemo(() => {
    if (!displayedGameState) return { text: "", dock: "bottom" as TextDock };

    return pickActiveText(activeLayer, displayedGameState);
  }, [activeLayer, displayedGameState]);

  const activeImageSrc = useMemo(() => {
    if (!activeLayer || !project) return undefined;

    return resolveAssetIdToSrc(activeLayer.assetId, assetIdToFile, assetUrls);
  }, [activeLayer, project, assetIdToFile, assetUrls]);

  const activeMusicTrackId = useMemo(() => {
    if (!runtimeNode || !gameState) return undefined;
    return pickActiveMusicTrackId(runtimeNode, gameState);
  }, [runtimeNode, gameState]);

  const activeMusicSrc = useMemo(() => {
    if (!activeMusicTrackId) return undefined;
    return resolveAssetIdToSrc(activeMusicTrackId, assetIdToFile, assetUrls);
  }, [activeMusicTrackId, assetIdToFile, assetUrls]);

  const savedMusicPosition = useMemo(() => {
    if (!gameState?.music || !activeMusicTrackId) return 0;
    return selectSavedTrackPosition(gameState.music, activeMusicTrackId);
  }, [gameState?.music, activeMusicTrackId]);

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

  const resolvedActiveText = useMemo(() => {
    if (!project) return activeText.text ?? "";

    const parts = resolveTextTokensToParts(activeText.text ?? "", project);

    return parts
      .map((part) =>
        part.type === "text" ? part.value : part.resolvedText ?? part.raw
      )
      .join("");
  }, [activeText.text, project]);

  const hasText = resolvedActiveText.trim().length > 0;

  const layoutClass = !hasText
    ? "flex-col"
    : activeText.dock === "left" || activeText.dock === "right"
      ? "flex-row"
      : "flex-col";

  const isTextFirst =
    hasText && (activeText.dock === "top" || activeText.dock === "left");

  const nodeRt = useMemo(() => {
    if (!displayedGameState  || !currentNode?.id) return null;

    return displayedGameState .nodes?.[currentNode.id] ?? null;
  }, [displayedGameState ?.nodes, currentNode?.id]);

  const hotspotsForStage = useMemo(() => {
    const hs = activeLayer?.hotspots ?? [];

    return hs.map((hotspot) => {
      const rt: PlaceableState | undefined =
        nodeRt?.hotspots?.[hotspot.id] ?? hotspot.initialState;

      return { hotspot, runtime: rt };
    });
  }, [activeLayer, nodeRt]);

  const placedItemsForStage = useMemo(() => {
    const items = activeLayer?.placedItems ?? [];

    return items.map((placedItem) => {
      const rt: PlaceableState | undefined =
        nodeRt?.placedItems?.[placedItem.id] ?? placedItem.initialState;

      const assetId = itemAssetIdByItemId.get(placedItem.itemId);

      const imageSrc = assetId
        ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls)
        : undefined;

      return { placedItem, runtime: rt, imageSrc };
    });
  }, [activeLayer, nodeRt, itemAssetIdByItemId, assetIdToFile, assetUrls]);

  const placedPlayersForStage = useMemo(() => {
    const players = activeLayer?.placedPlayers ?? [];

    return players.map((placedPlayer) => {
      const rt: PlacedPlayerState | undefined = nodeRt?.placedPlayers?.[placedPlayer.playerId] ?? placedPlayer.initialState;

      const runtimeImageId = nodeRt?.placedPlayerImageId?.[placedPlayer.playerId] ?? placedPlayer.initialImageId;

      const assetId = playerImageAssetIdByImageId.get(runtimeImageId);

      const imageSrc = assetId ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) : undefined;

      return { placedPlayer, runtime: rt, imageSrc };
    });
  }, [activeLayer, nodeRt, itemAssetIdByItemId, assetIdToFile, assetUrls]);

  const placedNpcsForStage = useMemo(() => {
    const npcs = activeLayer?.placedNpcs ?? [];

    return npcs.map((placedNpc) => {
      const rt: PlaceableState | undefined = nodeRt?.placedNpcs?.[placedNpc.npcId] ?? placedNpc.initialState;

      const assetId = npcAssetIdByNpcId.get(placedNpc.npcId);

      const imageSrc = assetId ? resolveAssetIdToSrc(assetId, assetIdToFile, assetUrls) : undefined;

      return { placedNpc, runtime: rt, imageSrc };
    });
  }, [activeLayer, nodeRt, itemAssetIdByItemId, assetIdToFile, assetUrls]);

  const updateTextCursor = (e: React.MouseEvent<HTMLDivElement>) => {
    setTextCursor({
      visible: true,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const isUsingItem = interactionMode.type === "useItem";
  const selectedInventoryItem = interactionMode.type === "useItem" ? interactionMode.item : null;
  const selectedInventoryItemShape = useMemo(() => {
    if (!project || !selectedInventoryItem) return null;

    return findPlacedItemShapeByInstanceId(project, selectedInventoryItem.instanceId);
  }, [project, selectedInventoryItem]);

  const effectivePlayerCursorSrc = isUsingItem
    ? selectedInventoryItem?.imageSrc ?? playerCursorIconSrc
    : playerCursorIconSrc;

  const selectedItemCursorSize = useMemo(() => {
    if (!selectedInventoryItemShape || selectedInventoryItemShape.type !== "rect") {
      return { width: 64, height: 64 };
    }

    const MAX_CURSOR_SIZE = 160;
    const MIN_CURSOR_SIZE = 28;
    const BASE_SCENE_SIZE = 1000;

    const width = Math.max(
      MIN_CURSOR_SIZE,
      Math.min(MAX_CURSOR_SIZE, selectedInventoryItemShape.w * BASE_SCENE_SIZE)
    );

    const height = Math.max(
      MIN_CURSOR_SIZE,
      Math.min(MAX_CURSOR_SIZE, selectedInventoryItemShape.h * BASE_SCENE_SIZE)
    );

    return { width, height };
  }, [selectedInventoryItemShape]);

  if (!gameState || !project) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-slate-300">
          No hay ninguna partida en curso.
          <br />
          Carga una aventura desde la pantalla de inicio.
        </p>

        <button
          type="button"
          onClick={() => navigate("/")}
          className="btn-primary-player"
        >
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
    <div className="game-root">
      <audio ref={audioRef} className="hidden" />
      <div className="game-frame">
        <main className="game-main">
          <div className="game-scene-panel h-full min-h-0 flex flex-col">
            <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-select" onClick={handlePrev} disabled={!canGoPrev || isDialogueOpen || isMapOpen}>
                  Escena anterior
                </button>

                <button type="button" className="btn btn-select" onClick={handleNext} disabled={!canGoNext || isDialogueOpen || isMapOpen}>
                  Siguiente escena
                </button>

                <button
                  type="button"
                  className="btn btn-select"
                  onClick={() => {
                    try {
                      saveGameToFile();
                      pushUiMessage({ text: "Partida guardada.", preferredChannel: "bubble" });
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : "No se ha podido guardar la partida.";
                      pushUiMessage({ text: msg, preferredChannel: "bubble" });
                    }
                  }}
                >
                  Guardar
                </button>

                <button
                  type="button"
                  className="btn btn-select"
                  onClick={() => loadInputRef.current?.click()}
                >
                  Cargar
                </button>

                <input
                  ref={loadInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={handleLoadSaveFile}
                />
              </div>

              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => {
                  closeMap();
                  clearInteractionMode();
                  resetGame();
                  navigate("/");
                }}
              >
                Salir
              </button>
            </div>

            <div className={`w-full flex-1 min-h-0 flex ${layoutClass}`}>
              {isTextFirst && hasText && (
                <div
                  className="relative min-h-0 bg-slate-950/90 px-4 py-3 overflow-y-auto basis-1/4 border-b border-slate-800 select-none"
                  style={{ cursor: "none", userSelect: "none" }}
                  onMouseMove={updateTextCursor}
                  onMouseEnter={updateTextCursor}
                  onMouseLeave={() => setTextCursor((prev) => ({ ...prev, visible: false }))}
                >
                  <p className="text-slate-100 text-sm whitespace-pre-line text-left leading-relaxed select-none">
                    {resolvedActiveText}
                  </p>

                  {textCursor.visible && (
                    <img
                      src="/cursor/idle.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none fixed z-40 h-12 w-12 object-contain select-none"
                      style={{
                        left: textCursor.x - 24,
                        top: textCursor.y - 24,
                        position: "fixed",
                      }}
                    />
                  )}
                </div>
              )}

              <div className="relative flex-1 min-h-0">

                <SceneStage
                  imageSrc={activeImageSrc}
                  hotspots={hotspotsForStage}
                  placedItems={placedItemsForStage}
                  placedPlayers={placedPlayersForStage}
                  placedNpcs={placedNpcsForStage}
                  dialogueText={dialogueBubbleText}
                  dialogueSpeaker={dialogueBubbleSpeaker}
                  isUsingItem={isUsingItem}
                  onHotspotUseItem={(hotspot) => {
                    useSelectedItemOnHotspot(hotspot);
                  }}
                  onPlacedItemUseItem={(placedItem) => {
                    useSelectedItemOnPlacedItem(placedItem);
                  }}
                  onPlacedNpcUseItem={(placedNpc) => {
                    useSelectedItemOnPlacedNpc(placedNpc);
                  }}
                  onSceneBackgroundClick={() => {
                    if (isMapOpen) return;

                    if (isUsingItem) clearInteractionMode();
                  }}
                  onCursorMove={(e, kind) => updatePlayerCursorFromMouseEvent(e, kind)}
                  onCursorEnter={(e, kind) => updatePlayerCursorFromMouseEvent(e, kind)}
                  onCursorLeave={hidePlayerCursor}
                  onHotspotClick={(hotspot) => {
                    if (interactionMode.type === "useItem" || isMapOpen) return;
                    applyHotspot(hotspot);
                  }}
                  onPlacedItemClick={(placedItem: PlacedItem) => {
                    if (interactionMode.type === "useItem" || isMapOpen) return;
                    applyPlacedItemInteraction(placedItem);
                  }}
                  onPlacedNpcClick={(placedNpc: PlacedNpc) => {
                    if (interactionMode.type === "useItem" || isMapOpen) return;
                    applyPlacedNpcInteraction(placedNpc);
                  }}
                  onNotReachable={(_, text) => {
                    const msg = (text ?? "").trim();

                    if (isUsingItem) {
                      clearInteractionMode();
                    }

                    pushUiMessage({
                      text: msg || "No puedes interactuar con eso ahora.",
                      preferredChannel: "bubble",
                    });
                  }}
                  onPlacedItemNotReachable={(_, text) => {
                    const msg = (text ?? "").trim();

                    if (isUsingItem) {
                      clearInteractionMode();
                    }

                    pushUiMessage({
                      text: msg || "No puedes interactuar con eso ahora.",
                      preferredChannel: "bubble",
                    });
                  }}
                  onPlacedNpcNotReachable={(_, text) => {
                    const msg = (text ?? "").trim();

                    if (isUsingItem) {
                      clearInteractionMode();
                    }

                    pushUiMessage({
                      text: msg || "No puedes interactuar con eso ahora.",
                      preferredChannel: "bubble",
                    });
                  }}
                />

                <div
                  className={`absolute inset-0 z-200 pointer-events-none transition-opacity duration-150 ${isFading ? "opacity-100 bg-black" : "opacity-0 bg-black"
                    }`}
                />

                <BottomBar
                  open={bottomBarOpen}
                  onToggle={() => setBottomBarOpen((prev) => !prev)}
                  onOpenInventory={() => {
                    if (isDialogueOpen || isMapOpen) return;

                    setBottomBarOpen(true);
                    setInventoryOpen(true);
                  }}
                  onOpenMap={() => {
                    if (isDialogueOpen || inventoryOpen) return;

                    setBottomBarOpen(true);
                    toggleMap();
                  }}
                />

                <InventoryOverlay
                  open={!isDialogueOpen && !isMapOpen && inventoryOpen}
                  items={inventoryItems}
                  onClose={() => setInventoryOpen(false)}
                  onSelectItem={(item) => {
                    setInteractionMode({ type: "useItem", item });
                    setInventoryOpen(false);
                  }}
                  onUseItemOnInventoryItem={(sourceItem, targetItem) => {
                    useInventoryItemOnInventoryItem(sourceItem, targetItem);
                  }}
                />



                <DialogueChoicesPanel
                  open={shouldShowDialogueChoices}
                  options={dialogueOptions}
                  onSelectOption={(nodeId) => advanceDialogue(nodeId)}
                  onCursorMove={(e, kind) => updatePlayerCursorFromMouseEvent(e, kind)}
                  onCursorEnter={(e, kind) => updatePlayerCursorFromMouseEvent(e, kind)}
                  onCursorLeave={hidePlayerCursor}
                />

                {isMapOpen && (
                  <MapOverlay
                    gameState={gameState}
                    assetUrls={assetUrls}
                    onClose={closeMap}
                    onTravel={() => { travelToSelectedMapRegion(); }}
                    onSelectRegion={selectMapRegion}
                  />
                )}

                {sceneMessage && (
                  <div className="pointer-events-none absolute inset-x-4 top-4 z-30 flex justify-center">
                    <div className="pointer-events-auto max-w-2xl rounded-xl border border-slate-500/50 bg-slate-950/85 px-4 py-3 text-sm text-slate-100 shadow-xl backdrop-blur">
                      <div className="flex items-start gap-3">
                        <p className="whitespace-pre-line leading-relaxed">{sceneMessage.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {playerCursor.visible && (
                  <img
                    src={effectivePlayerCursorSrc}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    className={`pointer-events-none fixed z-999 object-contain select-none ${isUsingItem ? "" : "h-16 w-16"
                      }`}
                    style={
                      isUsingItem
                        ? {
                          left: playerCursor.x,
                          top: playerCursor.y,
                          width: selectedItemCursorSize.width,
                          height: selectedItemCursorSize.height,
                          transform: "translate(-50%, -50%)",
                        }
                        : {
                          left: playerCursor.x - 32,
                          top: playerCursor.y - 32,
                        }
                    }
                  />
                )}
              </div>

              {!isTextFirst && hasText && (
                <div
                  className="relative min-h-0 bg-slate-950/90 px-4 py-3 overflow-y-auto basis-1/4 border-t border-slate-800 select-none"
                  style={{ cursor: "none", userSelect: "none" }}
                  onMouseMove={updateTextCursor}
                  onMouseEnter={updateTextCursor}
                  onMouseLeave={() => setTextCursor((prev) => ({ ...prev, visible: false }))}
                >
                  <p className="text-slate-100 text-sm whitespace-pre-line text-left leading-relaxed select-none">
                    {resolvedActiveText}
                  </p>

                  {textCursor.visible && (
                    <img
                      src="/cursor/idle.png"
                      alt=""
                      aria-hidden="true"
                      draggable={false}
                      className="pointer-events-none fixed z-40 h-16 w-16 object-contain select-none"
                      style={{
                        left: textCursor.x - 32,
                        top: textCursor.y - 32,
                        position: "fixed",
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}