import type { Hotspot, ID, InteractionRules, PlaceableState, PlacedItem, PlacedNpc, PlacedPlayer, PlacedPlayerState, RegionShape } from "@/domain/types";
import type { HotspotDraft, HotspotEditorState, HotspotRuleChannel } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemDraft, PlacedItemEditorState, PlacedItemRuleChannel } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcDraft, PlacedNpcEditorState, PlacedNpcRuleChannel } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerDraft, PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { validateHotspot } from "@/features/editor/scene/hotspots/hotspotValidator";
import { validatePlacedItem } from "@/features/editor/scene/placedItems/placedItemValidator";
import { validatePlacedNpc } from "@/features/editor/scene/placedNpcs/placedNpcValidator";
import { validatePlacedPlayer } from "@/features/editor/scene/placedPlayers/placedPlayerValidator";
import { generateId } from "@/utils/id";

export function defaultInitialState(): PlaceableState {
  return { visible: true, reachable: true };
}

export function defaultPlayerInitialState(): PlacedPlayerState {
  return { visible: true };
}

export function defaultRules(): InteractionRules {
  return {};
}

export function defaultChannel(): { type: "onClick" } {
  return { type: "onClick" };
}

export function buildContext(activeLayerId: ID | null): { layerId: ID } | null {
  if (!activeLayerId) return null;
  return { layerId: activeLayerId };
}

/* Convierte el gesto de dibujo actual en un rectángulo normalizado */
export function rectFromGesture(gesture: { startX: number; startY: number; currentX: number; currentY: number }): RegionShape {
  const x = Math.min(gesture.startX, gesture.currentX);
  const y = Math.min(gesture.startY, gesture.currentY);
  const w = Math.abs(gesture.currentX - gesture.startX);
  const h = Math.abs(gesture.currentY - gesture.startY);

  return { type: "rect", x, y, w, h };
}

export function addRuleToRules(rules: InteractionRules | undefined, channel: { type: "onClick" } | { type: "onUseItem"; placedItemId: ID },
  ruleId: ID, phrase?: string ): InteractionRules {
  const nextPhrase = (phrase ?? "").trim();

  const baseRule = { id: ruleId, ...(nextPhrase ? { phrase: nextPhrase } : {}), effects: [] };

  const currentRules = rules ?? {};

  return channel.type === "onClick"
    ? { ...currentRules,
        onClick: [...(currentRules.onClick ?? []), baseRule] }
    : { ...currentRules,
        onUseItem: [...(currentRules.onUseItem ?? []), { ...baseRule, placedItemId: channel.placedItemId }]};
}

export function removeRuleFromRules(rules: InteractionRules | undefined, channel: { type: "onClick" } | { type: "onUseItem"; placedItemId: ID },
  ruleId: ID): InteractionRules {
  const currentRules = rules ?? {};

  return channel.type === "onClick"
    ? { ...currentRules, onClick: (currentRules.onClick ?? []).filter((rule) => rule.id !== ruleId)}
    : { ...currentRules, onUseItem: (currentRules.onUseItem ?? []).filter((rule) => rule.id !== ruleId)};
}

export function isLabelUnique<T>(label: string, items: T[], getId: (item: T) => ID, getLabel: (item: T) => string, selfId?: ID): boolean {
  const nextLabel = label.trim().toLowerCase();

  return !items.some((item) => {
    if (selfId && getId(item) === selfId) return false;
    return getLabel(item).trim().toLowerCase() === nextLabel;
  });
}

/* ------------------------------- Hotspots ----------------------------------- */
export const initialHotspotEditorState: HotspotEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { hotspotId: null, selectedChannel: null, selectedRuleId: null },
  draft: null,
  drawing: null,
};

export function buildEmptyHotspotDraft(): HotspotDraft {
  return {
    id: generateId.hotspot(),
    label: "",
    shape: null,
    initialState: defaultInitialState(),
    vars: [],
    rules: defaultRules(),
  };
}

export function buildDraftFromHotspot(hotspot: Hotspot): HotspotDraft {
  return {
    id: hotspot.id,
    label: hotspot.label,
    shape: hotspot.shape,
    initialState: hotspot.initialState,
    vars: hotspot.vars ?? [],
    rules: hotspot.rules ?? {},
  };
}

export function buildHotspotCandidateFromDraft(draft: HotspotDraft & { shape: RegionShape }): Hotspot {
  return {
    id: draft.id,
    label: (draft.label ?? "").trim(),
    shape: draft.shape,
    initialState: draft.initialState,
    vars: draft.vars ?? [],
    rules: draft.rules ?? {},
  };
}

export function validateHotspotDraftCandidate(draft: HotspotDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de hotspot." };

  if (!draft.shape) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el hotspot." };

  const candidate = buildHotspotCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validateHotspot(candidate);

  if (!result.ok) {
    const message =
      result.errors.rules ??
      result.errors.label ??
      result.errors.shape ??
      result.errors.initialState ??
      "El hotspot no es válido.";

    return { ok: false as const, error: message };
  }

  return { ok: true as const, candidate };
}

/* ----------------------------- Placed items --------------------------------- */
export const initialPlacedItemEditorState: PlacedItemEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { placedItemId: null, selectedChannel: null, selectedRuleId: null },
  draft: null,
  drawing: null,
};

export function createDefaultPlacedItemRules(placedItemId: ID): InteractionRules {
  return { onClick: [{ id: generateId.rule(), effects: [{ type: "addItem", placedItemId }] }]};
}

export function buildEmptyPlacedItemDraft(input: { itemId: ID; label?: string }): PlacedItemDraft {
  const placedItemId = generateId.itemPlaced();

  return {
    id: placedItemId,
    itemId: input.itemId,
    label: input.label ?? "",
    shape: null,
    initialState: defaultInitialState(),
    rules: createDefaultPlacedItemRules(placedItemId),
  };
}

export function buildDraftFromPlacedItem(placedItem: PlacedItem): PlacedItemDraft {
  return {
    id: placedItem.id,
    itemId: placedItem.itemId,
    label: placedItem.label,
    shape: placedItem.shape,
    initialState: placedItem.initialState,
    rules: placedItem.rules ?? {},
  };
}

export function buildPlacedItemCandidateFromDraft(draft: PlacedItemDraft & { shape: RegionShape }): PlacedItem {
  return {
    id: draft.id,
    itemId: draft.itemId,
    label: draft.label.trim(),
    shape: draft.shape,
    initialState: draft.initialState,
    rules: draft.rules ?? {},
  };
}

export function validatePlacedItemDraftCandidate(draft: PlacedItemDraft | null, placedItems: PlacedItem[]) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedItem." };

  if (!draft.shape) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el item." };

  if (!isLabelUnique(draft.label, placedItems, (item) => item.id, (item) => item.label, draft.id)) {
    return { ok: false as const, error: "El label del placedItem debe ser único en la capa activa." };
  }

  const candidate = buildPlacedItemCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validatePlacedItem(candidate);

  if (!result.ok) {
    const message =
      result.errors.rules ??
      result.errors.label ??
      result.errors.itemId ??
      result.errors.shape ??
      result.errors.initialState ??
      "El item colocado no es válido.";

    return { ok: false as const, error: message };
  }

  return { ok: true as const, candidate };
}

/* ------------------------------ Placed NPCs --------------------------------- */
export const initialPlacedNpcEditorState: PlacedNpcEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { npcId: null, selectedChannel: null, selectedRuleId: null },
  draft: null,
  drawing: null,
};

export function buildEmptyPlacedNpcDraft(input: { npcId: ID }): PlacedNpcDraft {
  return {
    npcId: input.npcId,
    shape: null,
    initialState: defaultInitialState(),
    rules: defaultRules(),
  };
}

export function buildDraftFromPlacedNpc(placedNpc: PlacedNpc): PlacedNpcDraft {
  return {
    npcId: placedNpc.npcId,
    shape: placedNpc.shape,
    initialState: placedNpc.initialState,
    rules: placedNpc.rules ?? {},
  };
}

export function buildPlacedNpcCandidateFromDraft(draft: PlacedNpcDraft & { shape: RegionShape }): PlacedNpc {
  return {
    npcId: draft.npcId,
    shape: draft.shape,
    initialState: draft.initialState,
    rules: draft.rules ?? {},
  };
}

export function validatePlacedNpcDraftCandidate(draft: PlacedNpcDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedNpc." };

  if (!draft.shape) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el NPC." };

  const candidate = buildPlacedNpcCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validatePlacedNpc(candidate);

  if (!result.ok) {
    const message =
      result.errors.rules ??
      result.errors.npcId ??
      result.errors.shape ??
      result.errors.initialState ??
      "El NPC colocado no es válido.";

    return { ok: false as const, error: message };
  }

  return { ok: true as const, candidate };
}

/* ----------------------------- Placed Players -------------------------------- */
export const initialPlacedPlayerEditorState: PlacedPlayerEditorState = {
  context: null,
  mode: { type: "idle" },
  selection: { playerId: null },
  draft: null,
  drawing: null,
};

export function buildEmptyPlacedPlayerDraft(input: { playerId: ID; initialImageId: ID }): PlacedPlayerDraft {
  return {
    playerId: input.playerId,
    initialImageId: input.initialImageId,
    shape: null,
    initialState: defaultPlayerInitialState(),
  };
}

export function buildDraftFromPlacedPlayer(placedPlayer: PlacedPlayer): PlacedPlayerDraft {
  return {
    playerId: placedPlayer.playerId,
    initialImageId: placedPlayer.initialImageId,
    shape: placedPlayer.shape,
    initialState: placedPlayer.initialState,
  };
}

export function buildPlacedPlayerCandidateFromDraft(draft: PlacedPlayerDraft & { shape: RegionShape }): PlacedPlayer {
  return {
    playerId: draft.playerId,
    initialImageId: draft.initialImageId,
    shape: draft.shape,
    initialState: draft.initialState,
  };
}

export function validatePlacedPlayerDraftCandidate(draft: PlacedPlayerDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedPlayer." };

  if (!draft.shape) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el player." };

  const candidate = buildPlacedPlayerCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validatePlacedPlayer(candidate);

  if (!result.ok) {
    const message =
      result.errors.initialImageId ??
      result.errors.playerId ??
      result.errors.shape ??
      result.errors.initialState ??
      "El player colocado no es válido.";

    return { ok: false as const, error: message };
  }

  return { ok: true as const, candidate };
}

/* --------------------------- Alias tipados útiles ---------------------------- */
export function defaultHotspotChannel(): HotspotRuleChannel {
  return defaultChannel();
}

export function defaultPlacedItemChannel(): PlacedItemRuleChannel {
  return defaultChannel();
}

export function defaultPlacedNpcChannel(): PlacedNpcRuleChannel {
  return defaultChannel();
}