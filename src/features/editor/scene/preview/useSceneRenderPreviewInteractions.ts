import { useCallback, useMemo } from "react";
import type { CSSProperties } from "react";
import type { ID, ItemInstance, PlacedNpc, PlacedPlayer, RegionShape } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { useRegionShapeRectDrawing } from "@/features/editor/hooks/useRegionShapeRectDrawing";
import { useObjectContainRect } from "@/features/editor/hooks/useObjectContainRect";
import { rectStyleFromShape } from "@/features/editor/hooks/regionShape";
import { commitActiveInteractiveDrafts } from "@/features/editor/scene/interactiveComponents/interactiveDraftGuards";

export type PreviewInteractiveFieldId = "hotspots" | "placedItems" | "placedNpcs" | "placedPlayers";

type ObjectContainRectResult = ReturnType<typeof useObjectContainRect>;
type ContentRect = ObjectContainRectResult["contentRectInContainer"];
type ToContainerPx = ObjectContainRectResult["toContainerPx"];

type DraftEditorLike = DraftWithLayerContext & { mode?: { type?: string } | null };

type DraftWithLayerContext = {
  context?: { layerId?: ID | null } | null;
  draft?: {
    shape?: RegionShape | null;
    placement?: {
      shape?: RegionShape | null;
    } | null;
  } | null;
};

type OverlayDraftConfig = {
  style: CSSProperties | null;
  className: string;
};

type UseSceneRenderPreviewInteractionsArgs = {
  activeLayerId: ID | null;
  imageUrl: string | null | undefined;
  nodeMode: string | null | undefined;
  editingNodeId: ID | null;
  contentRectInContainer: ContentRect;
  toContainerPx:ToContainerPx;
  onOpenInteractiveField: (field: PreviewInteractiveFieldId) => void;
};

function isDrawingOnActiveLayer(editor: DraftEditorLike | null | undefined, activeLayerId: ID | null): boolean {
  return editor?.mode?.type === "drawing" && isDraftOnActiveLayer(editor, activeLayerId);
}

function isDraftOnActiveLayer(editor: DraftWithLayerContext | null | undefined, activeLayerId: ID | null): boolean {
  return (editor?.context?.layerId != null && activeLayerId != null && String(editor.context.layerId) === String(activeLayerId));
}

function getDraftShapeStyle(editor: DraftWithLayerContext | null | undefined, activeLayerId: ID | null,
  contentRectInContainer: ContentRect): CSSProperties | null {
  if (!isDraftOnActiveLayer(editor, activeLayerId)) return null;

  const shape = editor?.draft?.shape ?? editor?.draft?.placement?.shape ?? null;

  return rectStyleFromShape(shape, contentRectInContainer);
}

export function useSceneRenderPreviewInteractions({ activeLayerId, imageUrl, nodeMode, editingNodeId, contentRectInContainer, toContainerPx,
  onOpenInteractiveField }: UseSceneRenderPreviewInteractionsArgs) {
  const hotspotEditor = useEditorStore((state) => state.hotspotEditor);
  const placedItemEditor = useEditorStore((state) => state.placedItemEditor);
  const placedNpcEditor = useEditorStore((state) => state.placedNpcEditor);
  const placedPlayerEditor = useEditorStore((state) => state.placedPlayerEditor);

  const setHotspotDraftShape = useEditorStore((state) => state.setHotspotDraftShape);
  const finishDrawingHotspot = useEditorStore((state) => state.finishDrawingHotspot);

  const setPlacedItemDraftShape = useEditorStore((state) => state.setPlacedItemDraftShape);
  const finishDrawingPlacedItem = useEditorStore((state) => state.finishDrawingPlacedItem);

  const setPlacedNpcDraftShape = useEditorStore((state) => state.setPlacedNpcDraftShape);
  const finishDrawingPlacedNpc = useEditorStore((state) => state.finishDrawingPlacedNpc);

  const setPlacedPlayerDraftShape = useEditorStore((state) => state.setPlacedPlayerDraftShape);
  const finishDrawingPlacedPlayer = useEditorStore((state) => state.finishDrawingPlacedPlayer);

  const commitHotspotDraft = useEditorStore((state) => state.commitHotspotDraft);
  const commitPlacedItemDraft = useEditorStore((state) => state.commitPlacedItemDraft);
  const commitPlacedNpcDraft = useEditorStore((state) => state.commitPlacedNpcDraft);
  const commitPlacedPlayerDraft = useEditorStore((state) => state.commitPlacedPlayerDraft);

  const setPendingInteractiveOpen = useEditorStore((state) => state.setPendingInteractiveOpen);

  const resetKey = useMemo(() => [activeLayerId ?? "", hotspotEditor?.mode?.type ?? "idle", hotspotEditor?.selection?.hotspotId ?? "",
      placedItemEditor?.mode?.type ?? "idle", placedItemEditor?.selection?.placedItemId ?? "", placedPlayerEditor?.mode?.type ?? "idle",
      placedPlayerEditor?.selection?.playerId ?? "", placedNpcEditor?.mode?.type ?? "idle", placedNpcEditor?.selection?.npcId ?? "",
      nodeMode ?? "", editingNodeId ?? ""].join(":"),
  [activeLayerId, hotspotEditor?.mode?.type, hotspotEditor?.selection?.hotspotId, placedItemEditor?.mode?.type, placedItemEditor?.selection?.placedItemId,
    placedPlayerEditor?.mode?.type, placedPlayerEditor?.selection?.playerId, placedNpcEditor?.mode?.type, placedNpcEditor?.selection?.npcId, nodeMode, editingNodeId]
);

  const isDrawingHotspot = isDrawingOnActiveLayer(hotspotEditor, activeLayerId);
  const isDrawingPlacedItem = isDrawingOnActiveLayer(placedItemEditor, activeLayerId);
  const isDrawingPlacedPlayer = isDrawingOnActiveLayer(placedPlayerEditor, activeLayerId);
  const isDrawingPlacedNpc = isDrawingOnActiveLayer(placedNpcEditor, activeLayerId);
  const isDrawing = isDrawingHotspot || isDrawingPlacedItem || isDrawingPlacedPlayer || isDrawingPlacedNpc;

  const draw = useRegionShapeRectDrawing({
    contentRect: contentRectInContainer,
    enabled: Boolean(isDrawing && imageUrl),
    toContainerPx,
    onCommit: (shape: RegionShape) => {
      if (isDrawingHotspot) {
        setHotspotDraftShape(shape);
        finishDrawingHotspot();
        return;
      }

      if (isDrawingPlacedItem) {
        setPlacedItemDraftShape(shape);
        finishDrawingPlacedItem();
        return;
      }

      if (isDrawingPlacedPlayer) {
        setPlacedPlayerDraftShape(shape);
        finishDrawingPlacedPlayer();
        return;
      }

      if (isDrawingPlacedNpc) {
        setPlacedNpcDraftShape(shape);
        finishDrawingPlacedNpc();
      }
    },
    resetKey,
  });

  const hotspotDraftShapeStyle = getDraftShapeStyle(hotspotEditor, activeLayerId, contentRectInContainer);
  const placedItemDraftShapeStyle = getDraftShapeStyle(placedItemEditor, activeLayerId, contentRectInContainer);
  const placedPlayerDraftShapeStyle = getDraftShapeStyle(placedPlayerEditor, activeLayerId, contentRectInContainer);
  const placedNpcDraftShapeStyle = getDraftShapeStyle(placedNpcEditor, activeLayerId, contentRectInContainer);

  const placedItemDraftPreview = useMemo<ItemInstance | null>(() => {
    const draft = placedItemEditor?.draft;

    if (!draft || !isDraftOnActiveLayer(placedItemEditor, activeLayerId)) return null;

    const shape = draft.placement?.shape ?? null;
    const initialState = draft.placement?.initialState ?? null;

    if (!shape || !initialState) return null;

    return {
      itemInstanceId: draft.itemInstanceId,
      itemId: draft.itemId,
      label: draft.label,
      rules: draft.rules,
      placement: { shape, initialState },
    };
  }, [placedItemEditor, activeLayerId]);

  const placedPlayerDraftPreview = useMemo<PlacedPlayer | null>(() => {
    const draft = placedPlayerEditor?.draft;
    if (!draft || !draft.shape || !isDraftOnActiveLayer(placedPlayerEditor, activeLayerId)) return null;

    return { playerId: draft.playerId, initialState: draft.initialState, initialImageId: draft.initialImageId, shape: draft.shape };
  }, [placedPlayerEditor, activeLayerId]);

  const placedNpcDraftPreview = useMemo<PlacedNpc | null>(() => {
    const draft = placedNpcEditor?.draft;
    if (!draft || !draft.shape || !isDraftOnActiveLayer(placedNpcEditor, activeLayerId)) return null;

    return { npcId: draft.npcId, initialState: draft.initialState, shape: draft.shape, rules: draft.rules };
  }, [placedNpcEditor, activeLayerId]);

  const overlayDrafts = useMemo<OverlayDraftConfig[]>(() => [
    { style: draw.tempRectStyle, className: "absolute rounded-sm border-2 border-cyan-400/70 bg-cyan-500/10" },
    { style: hotspotDraftShapeStyle, className: "absolute rounded-sm border-2 border-fuchsia-400/70 bg-fuchsia-500/10" },
    { style: placedItemDraftShapeStyle, className: "absolute rounded-sm border-2 border-red-400/70 bg-red-500/10" },
    { style: placedPlayerDraftShapeStyle, className: "absolute rounded-sm border-2 border-emerald-400/70 bg-cyan-500/10" },
    { style: placedNpcDraftShapeStyle, className: "absolute rounded-sm border-2 border-lime-400/70 bg-lime-500/10" }],
  [draw.tempRectStyle, hotspotDraftShapeStyle, placedItemDraftShapeStyle, placedPlayerDraftShapeStyle, placedNpcDraftShapeStyle]);

  const canOpenInteractiveEditor = useCallback(() => {
    if (isDrawing) return false;

    return commitActiveInteractiveDrafts({
      hotspotEditorMode: hotspotEditor.mode,
      placedItemEditorMode: placedItemEditor.mode,
      placedNpcEditorMode: placedNpcEditor.mode,
      placedPlayerEditorMode: placedPlayerEditor.mode,

      hasHotspotDraft: Boolean(hotspotEditor.draft),
      hasPlacedItemDraft: Boolean(placedItemEditor.draft),
      hasPlacedNpcDraft: Boolean(placedNpcEditor.draft),
      hasPlacedPlayerDraft: Boolean(placedPlayerEditor.draft),

      commitHotspotDraft,
      commitPlacedItemDraft,
      commitPlacedNpcDraft,
      commitPlacedPlayerDraft,
    });
  }, [isDrawing, hotspotEditor.mode, hotspotEditor.draft, placedItemEditor.mode, placedItemEditor.draft, placedNpcEditor.mode, placedNpcEditor.draft,
    placedPlayerEditor.mode, placedPlayerEditor.draft, commitHotspotDraft, commitPlacedItemDraft, commitPlacedNpcDraft, commitPlacedPlayerDraft]);

  const requestOpenInteractive = useCallback(
    (field: PreviewInteractiveFieldId, kind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer", id: ID) => {
      if (!canOpenInteractiveEditor()) return;

      onOpenInteractiveField(field);
      setPendingInteractiveOpen({ kind, id });
    }, [canOpenInteractiveEditor, onOpenInteractiveField, setPendingInteractiveOpen],
  );

  const handleOpenHotspot = useCallback((hotspotId: ID) => { requestOpenInteractive("hotspots", "hotspot", hotspotId) }, [requestOpenInteractive]);
  const handleOpenPlacedItem = useCallback((placedItemId: ID) => { requestOpenInteractive("placedItems", "placedItem", placedItemId) }, [requestOpenInteractive]);
  const handleOpenPlacedNpc = useCallback((npcId: ID) => { requestOpenInteractive("placedNpcs", "placedNpc", npcId) }, [requestOpenInteractive]);
  const handleOpenPlacedPlayer = useCallback((playerId: ID) => { requestOpenInteractive("placedPlayers", "placedPlayer", playerId) }, [requestOpenInteractive]);

  return {
    draw, drawingCursorClass: isDrawing ? "cursor-crosshair" : "", overlayDrafts, placedItemDraftPreview, placedPlayerDraftPreview,
    placedNpcDraftPreview, handleOpenHotspot, handleOpenPlacedItem, handleOpenPlacedNpc, handleOpenPlacedPlayer
  };
}