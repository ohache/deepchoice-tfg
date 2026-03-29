import type { ID, SceneImageLayer, ConditionalTextEntry, TextDock, Node } from "@/domain/types";
import type { Condition } from "@/domain/conditions";
import { generateId } from "@/utils/id";
import type { HotspotEditorState } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import { initialHotspotEditorState } from "@/features/editor/scene/hotspots/editorHotspotsSlice";
import { safeTrim } from "@/features/editor/core/editorGenericSlice";

type EditorStoreLike = {
  nodeDraft: Node | null;
  activeLayerId: ID | null;
  hotspotEditor: HotspotEditorState;
  selectedInteractionKind: "hotspot" | "placedItem" | "placedNpc" | "placedPlayer" | null;
  selectedInteractionId: ID | null;
  clearInteractionSelection: () => void;
};

export interface EditorLayerSlice {
  activeLayerId: ID | null;

  setLayerAssetId: (assetId: ID) => void;
  setActiveLayerId: (layerId: ID | null) => void;

  getActiveLayer: () => SceneImageLayer | null;
  patchActiveLayer: (patcher: (layer: SceneImageLayer) => SceneImageLayer) => void;

  setLayerLabel: (label: string) => void;
  setLayerWhen: (when: Condition | null | undefined) => void;
  setLayerDock: (dock: TextDock) => void;

  addLayerTextEntry: (args?: { id?: ID; label?: string; when?: Condition; content?: string }) => ID | null;
  updateLayerTextEntry: (entryId: ID, patch: Partial<ConditionalTextEntry>) => void;
  removeLayerTextEntry: (entryId: ID) => void;
  reorderLayerTextEntries: (fromIndex: number, toIndex: number) => void;

  setLayerMusicTrackId: (musicTrackId: ID | null | undefined) => void;
}

function sameEntry(a: ConditionalTextEntry, b: ConditionalTextEntry): boolean {
  if (a === b) return true;
  return a.id === b.id && a.label === b.label && a.when === b.when && a.content === b.content;
}

function readActiveLayer(s: EditorStoreLike): SceneImageLayer | null {
  if (!s.nodeDraft || !s.activeLayerId) return null;
  return s.nodeDraft.layers?.find((l) => l.id === s.activeLayerId) ?? null;
}

export function createEditorLayerSlice(set: (partial: | Partial<EditorStoreLike> | ((state: EditorStoreLike) => Partial<EditorStoreLike> | EditorStoreLike)) => void,
  get: () => EditorStoreLike): EditorLayerSlice {

  function withActiveLayer(updater: (layer: SceneImageLayer) => SceneImageLayer) {
    set((s) => {
      if (!s.nodeDraft || !s.activeLayerId) return s;

      const layers0 = s.nodeDraft.layers ?? [];
      const idx = layers0.findIndex((l) => l.id === s.activeLayerId);
      if (idx < 0) return s;

      const prev = layers0[idx]!;
      const next = updater(prev);

      if (next === prev) return s;

      const layers1 = layers0.slice();
      layers1[idx] = next;

      return {
        ...s,
        nodeDraft: { ...s.nodeDraft, layers: layers1 },
      };
    });
  }

  return {
    activeLayerId: null,

    setLayerAssetId: (assetId: ID) => {
      const next = safeTrim(String(assetId ?? ""));
      if (!next) return;

      withActiveLayer((layer) =>
        layer.assetId === next ? layer : { ...layer, assetId: next }
      );
    },

    setActiveLayerId: (layerId) =>
      set((s) => {
        if (s.activeLayerId === layerId) return s;

        const hotspotLayerId = s.hotspotEditor.context?.layerId ?? null;
        const shouldResetHotspotEditor = Boolean(s.hotspotEditor.draft) || hotspotLayerId !== null;

        const next: Partial<EditorStoreLike> & {
          activeLayerId: ID | null;
          hotspotEditor?: typeof initialHotspotEditorState;
          selectedInteractionKind?: null;
          selectedInteractionId?: null;
        } = { activeLayerId: layerId };

        if (shouldResetHotspotEditor) next.hotspotEditor = initialHotspotEditorState;

        if (s.selectedInteractionKind || s.selectedInteractionId) {
          next.selectedInteractionKind = null;
          next.selectedInteractionId = null;
        }

        return next;
      }),

    getActiveLayer: () => readActiveLayer(get()),

    patchActiveLayer: (patcher) => { withActiveLayer((layer) => patcher(layer)) },

    setLayerLabel: (label) => {
      const next = safeTrim(label ?? "");
      withActiveLayer((layer) => layer.label === next ? layer : { ...layer, label: next });
    },

    setLayerWhen: (when) => {
      const next = when ?? undefined;
      withActiveLayer((layer) => layer.when === next ? layer : { ...layer, when: next });
    },

    setLayerDock: (dock) => {
      withActiveLayer((layer) => layer.dock === dock ? layer : { ...layer, dock });
    },

    addLayerTextEntry: (args) => {
      const s = get();
      const layer = readActiveLayer(s);
      if (!layer) return null;

      const id = args?.id ?? generateId.variant();
      const label = safeTrim(args?.label ?? "") || "Texto";
      const when = args?.when;
      const content = args?.content ?? "";

      const entry: ConditionalTextEntry = { id, label, when: when ?? undefined, content };

      withActiveLayer((l) => ({ ...l, text: [...(l.text ?? []), entry]}));

      return id;
    },

    updateLayerTextEntry: (entryId, patch) => {
      withActiveLayer((layer) => {
        const text0 = layer.text ?? [];
        const idx = text0.findIndex((t) => t.id === entryId);
        if (idx < 0) return layer;

        const prev = text0[idx]!;
        const next = { ...prev, ...patch };

        if (sameEntry(prev, next)) return layer;

        const text1 = text0.slice();
        text1[idx] = next;

        return { ...layer, text: text1 };
      });
    },

    removeLayerTextEntry: (entryId) => {
      withActiveLayer((layer) => {
        const text0 = layer.text ?? [];
        const next = text0.filter((t) => t.id !== entryId);

        if (next.length === text0.length) return layer;

        return { ...layer, text: next };
      });
    },

    reorderLayerTextEntries: (fromIndex, toIndex) => {
      withActiveLayer((layer) => {
        const text0 = layer.text ?? [];

        if ( fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= text0.length || toIndex >= text0.length) return layer;
        
        const next = text0.slice();
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        return { ...layer, text: next };
      });
    },

        setLayerMusicTrackId: (musicTrackId) => {
      const next = typeof musicTrackId === "string" && musicTrackId.trim() ? musicTrackId : undefined;

      withActiveLayer((layer) =>
        layer.musicTrackId === next ? layer : { ...layer, musicTrackId: next }
      );
    },
  };
}