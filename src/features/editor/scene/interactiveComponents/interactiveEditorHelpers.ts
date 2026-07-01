import type { Hotspot, ID, InteractionRules, PlaceableState, ItemInstance, PlacedNpc, PlacedPlayer, RegionShape } from "@/domain/types";
import type { HotspotDraft, HotspotEditorState, HotspotRuleChannel } from "@/features/editor/scene/hotspots/hotspotEditorTypes";
import type { PlacedItemDraft, PlacedItemEditorState, PlacedItemRuleChannel } from "@/features/editor/scene/placedItems/placedItemEditorTypes";
import type { PlacedNpcDraft, PlacedNpcEditorState, PlacedNpcRuleChannel } from "@/features/editor/scene/placedNpcs/placedNpcEditorTypes";
import type { PlacedPlayerDraft, PlacedPlayerEditorState } from "@/features/editor/scene/placedPlayers/placedPlayerEditorTypes";
import { validateHotspot } from "@/features/editor/scene/hotspots/hotspotValidator";
import { validatePlacedItem } from "@/features/editor/scene/placedItems/placedItemValidator";
import { validatePlacedNpc } from "@/features/editor/scene/placedNpcs/placedNpcValidator";
import { validatePlacedPlayer } from "@/features/editor/scene/placedPlayers/placedPlayerValidator";
import { isValidRect01 } from "@/features/editor/hooks/regionShape";
import { generateId } from "@/utils/id";

function defaultInitialState(): PlaceableState {
  return { visible: true, reachable: true };
}

function defaultRules(): InteractionRules {
  return {};
}

function defaultChannel(): { type: "onClick" } {
  return { type: "onClick" };
}

export function buildContext(activeLayerId: ID | null): { layerId: ID } | null {
  if (!activeLayerId) return null;
  return { layerId: activeLayerId };
}

function isLabelUnique<T>(label: string, items: T[], getId: (item: T) => ID, getLabel: (item: T) => string, selfId?: ID): boolean {
  const nextLabel = label.trim().toLowerCase();

  return !items.some((item) => {
    if (selfId && getId(item) === selfId) return false;
    return getLabel(item).trim().toLowerCase() === nextLabel;
  });
}

function hasValidShape(shape: RegionShape | null | undefined): shape is RegionShape {
  return isValidRect01(shape);
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
    rules: hotspot.rules ?? defaultRules(),
  };
}

function buildHotspotCandidateFromDraft(draft: HotspotDraft & { shape: RegionShape }): Hotspot {
  return {
    id: draft.id,
    label: draft.label.trim(),
    shape: draft.shape,
    initialState: draft.initialState,
    vars: draft.vars ?? [],
    rules: draft.rules ?? defaultRules(),
  };
}

export function validateHotspotDraftCandidate(draft: HotspotDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de hotspot." };

  if (!hasValidShape(draft.shape)) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el hotspot." };

  const candidate = buildHotspotCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validateHotspot(candidate);

  if (!result.ok) {
    const message = result.errors.rules ?? result.errors.label ?? result.errors.shape ?? result.errors.initialState ?? "El hotspot no es válido.";

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

function buildDefaultPlacedItemRules(itemInstanceId: ID): InteractionRules {
  return {
    onClick: [
      {
        id: generateId.rule(),
        effects: [
          {
            type: "addItem",
            itemInstanceId,
          },
        ],
      },
    ],
  };
}

export function buildEmptyPlacedItemDraft(input: { itemId: ID; label?: string }): PlacedItemDraft {
  const itemInstanceId = generateId.itemInstance();

  return {
    itemInstanceId,
    itemId: input.itemId,
    label: input.label?.trim() ?? "",
    rules: buildDefaultPlacedItemRules(itemInstanceId),
    placement: { shape: null, initialState: defaultInitialState() },
  };
}

export function buildDraftFromPlacedItem(placedItem: ItemInstance): PlacedItemDraft {
  return {
    itemInstanceId: placedItem.itemInstanceId,
    itemId: placedItem.itemId,
    label: placedItem.label,
    rules: placedItem.rules ?? defaultRules(),
    placement: { shape: placedItem.placement?.shape ?? null, initialState: placedItem.placement?.initialState ?? defaultInitialState() },
  };
}

type PlacedItemCandidate = Omit<ItemInstance, "placement"> & {
  placement: { shape: RegionShape; initialState: PlaceableState };
};

function buildPlacedItemCandidateFromDraft(draft: PlacedItemDraft & { placement: { shape: RegionShape; initialState: PlaceableState }}): PlacedItemCandidate {
  return {
    itemInstanceId: draft.itemInstanceId,
    itemId: draft.itemId,
    label: draft.label.trim(),
    rules: draft.rules ?? defaultRules(),
    placement: { shape: draft.placement.shape, initialState: draft.placement.initialState },
  };
}

export function validatePlacedItemDraftCandidate(draft: PlacedItemDraft | null, placedItems: ItemInstance[]) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedItem." };

  const shape = draft.placement.shape;

  if (!hasValidShape(shape)) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el objeto." };

  if (!isLabelUnique(draft.label, placedItems, (item) => item.itemInstanceId, (item) => item.label, draft.itemInstanceId)) {
    return { ok: false as const, error: "El nombre del objeto colocado debe ser único en la capa activa." };
  }

  const candidate = buildPlacedItemCandidateFromDraft({ ...draft, placement: { ...draft.placement, shape }});

  const result = validatePlacedItem(candidate);

  if (!result.ok) {
    const message = result.errors.rules ?? result.errors.label ?? result.errors.itemId ?? result.errors.itemInstanceId ?? result.errors.placement ?? "El objeto colocado no es válido.";

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
    rules: placedNpc.rules ?? defaultRules(),
  };
}

function buildPlacedNpcCandidateFromDraft(draft: PlacedNpcDraft & { shape: RegionShape }): PlacedNpc {
  return {
    npcId: draft.npcId,
    shape: draft.shape,
    initialState: draft.initialState,
    rules: draft.rules ?? defaultRules(),
  };
}

export function validatePlacedNpcDraftCandidate(draft: PlacedNpcDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedNpc." };

  if (!hasValidShape(draft.shape)) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el PNJ." };

  const candidate = buildPlacedNpcCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validatePlacedNpc(candidate);

  if (!result.ok) {
    const message = result.errors.rules ?? result.errors.npcId ?? result.errors.shape ?? result.errors.initialState ?? "El PNJ colocado no es válido.";

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
    initialState: { visible: true },
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

function buildPlacedPlayerCandidateFromDraft(draft: PlacedPlayerDraft & { shape: RegionShape }): PlacedPlayer {
  return {
    playerId: draft.playerId,
    initialImageId: draft.initialImageId,
    shape: draft.shape,
    initialState: draft.initialState,
  };
}

export function validatePlacedPlayerDraftCandidate(draft: PlacedPlayerDraft | null) {
  if (!draft) return { ok: false as const, error: "No hay borrador de placedPlayer." };

  if (!hasValidShape(draft.shape)) return { ok: false as const, error: "Debes dibujar un área válida antes de guardar el jugador." };

  const candidate = buildPlacedPlayerCandidateFromDraft({ ...draft, shape: draft.shape });

  const result = validatePlacedPlayer(candidate);

  if (!result.ok) {
    const message = result.errors.initialImageId ?? result.errors.playerId ?? result.errors.shape ?? result.errors.initialState ?? "El jugador colocado no es válido.";

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