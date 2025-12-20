import type { Project, Node, Hotspot, ID, PlacedItem, PlacedNpc, HotspotShape, HotspotInteraction, ItemInteraction,
  NpcInteraction, PlacedItemState, FreeHotspotEffect } from "@/domain/types";
import { generateProjectId, generateNodeId, generateHotspotId, generateId } from "@/utils/id";

/* Helpers */
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asArray<T>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function normalizeHotspotShape(raw: unknown): HotspotShape | null {
  if (!isRecord(raw)) return null;
  if ((raw as any).type !== "rect") return null;

  const x = (raw as any).x;
  const y = (raw as any).y;
  const w = (raw as any).w;
  const h = (raw as any).h;

  if ([x, y, w, h].some((n) => typeof n !== "number")) return null;
  return { type: "rect", x, y, w, h };
}

const EMPTY_RECT: HotspotShape = { type: "rect", x: 0, y: 0, w: 0, h: 0 };

function isAllowedFreeHotspotEffect(e: any): e is FreeHotspotEffect {
  if (!e || typeof e !== "object") return false;
  switch (e.type) {
    case "goToNode":
      return typeof e.targetNodeId === "string";
    case "setFlag":
      return typeof e.flag === "string" && typeof e.value === "boolean";
    case "showText":
    case "showMessage":
      return typeof e.text === "string";
    default:
      return false;
  }
}

function normalizeHotspotInteractions(raw: unknown): HotspotInteraction[] {
  const arr = asArray<any>(raw, []);

  // Normalización “segura”:
  // - mantenemos verb/label/cursor/conditions si vienen
  // - filtramos effects a los permitidos para free-hotspot
  // - si una interacción se queda sin effects, se descarta
  const out: HotspotInteraction[] = [];

  for (const it of arr) {
    const r = isRecord(it) ? it : {};
    const effectsRaw = (r as any).effects;
    const effects = asArray<any>(effectsRaw, []).filter(isAllowedFreeHotspotEffect);

    if (effects.length === 0) continue;

    out.push({
      id: typeof (r as any).id === "string" ? ((r as any).id as ID) : generateId("hi"),
      verb: (typeof (r as any).verb === "string" ? (r as any).verb : "look") as any,
      label: typeof (r as any).label === "string" ? (r as any).label : undefined,
      cursor: typeof (r as any).cursor === "string" ? (r as any).cursor : undefined,
      conditions: Array.isArray((r as any).conditions) ? ((r as any).conditions as any) : [],
      effects,
    });
  }

  return out;
}

function normalizeItemInteractions(raw: unknown): ItemInteraction[] {
  return asArray<unknown>(raw, []) as ItemInteraction[];
}

function normalizeNpcInteractions(raw: unknown): NpcInteraction[] {
  return asArray<unknown>(raw, []) as NpcInteraction[];
}

/* Normaliza un hotspot “crudo” */
function normalizeHotspot(raw: unknown): Hotspot {
  const r = isRecord(raw) ? raw : {};
  const shape = normalizeHotspotShape((r as any).shape) ?? EMPTY_RECT;

  return {
    id: typeof (r as any).id === "string" && (r as any).id.trim().length > 0
      ? ((r as any).id as ID)
      : generateHotspotId(),
    shape,
    label: typeof (r as any).label === "string" ? ((r as any).label as string) : undefined,
    interactions: normalizeHotspotInteractions((r as any).interactions),
  };
}

function normalizePlacedItemState(raw: unknown): PlacedItemState {
  const r = isRecord(raw) ? raw : {};

  return {
    visible: asBool((r as any).visible, true),
    reachable: asBool((r as any).reachable, true),
    notReachableText: typeof (r as any).notReachableText === "string" ? ((r as any).notReachableText as string) : undefined,
  };
}

function normalizePlacedItem(raw: unknown): PlacedItem {
  const r = isRecord(raw) ? raw : {};
  const shape = normalizeHotspotShape((r as any).shape) ?? EMPTY_RECT;
  const state = normalizePlacedItemState((r as any).state);

  const interactionsRaw = (r as any).interactions;
  const interactions = Array.isArray(interactionsRaw) ? normalizeItemInteractions(interactionsRaw) : undefined;

  return {
    id: typeof (r as any).id === "string" && (r as any).id.trim().length > 0 ? ((r as any).id as ID) : generateId("pi"),
    itemId: typeof (r as any).itemId === "string" ? ((r as any).itemId as ID) : ("" as ID),
    shape,
    state,
    ...(interactions ? { interactions } : {}),
  };
}

function normalizePlacedNpc(raw: unknown): PlacedNpc {
  const r = isRecord(raw) ? raw : {};
  const shape = normalizeHotspotShape((r as any).shape) ?? EMPTY_RECT;

  const interactionsRaw = (r as any).interactions;
  const interactions = Array.isArray(interactionsRaw) ? normalizeNpcInteractions(interactionsRaw) : undefined;

  return {
    id: typeof (r as any).id === "string" && (r as any).id.trim().length > 0 ? ((r as any).id as ID) : generateId("pn"),
    npcId: typeof (r as any).npcId === "string" ? ((r as any).npcId as ID) : ("" as ID),
    shape,
    ...(interactions ? { interactions } : {}),
  };
}

/** Normaliza un node “crudo” */
function normalizeNode(raw: unknown): Node {
  const r = isRecord(raw) ? raw : {};

  return {
    id: typeof (r as any).id === "string" && (r as any).id.trim().length > 0 ? ((r as any).id as ID) : generateNodeId(),
    title: asString((r as any).title, ""),
    text: asString((r as any).text, ""),
    image: typeof (r as any).image === "string" ? ((r as any).image as string) : "",

    hotspots: asArray((r as any).hotspots).map(normalizeHotspot),

    musicId: typeof (r as any).musicId === "string" ? ((r as any).musicId as ID) : undefined,
    mapId: typeof (r as any).mapId === "string" ? ((r as any).mapId as ID) : undefined,

    placedItems: asArray((r as any).placedItems).map(normalizePlacedItem),
    placedNpcs: asArray((r as any).placedNpcs).map(normalizePlacedNpc),

    isStart: asBool((r as any).isStart, false),
    isFinal: asBool((r as any).isFinal, false),

    meta: isRecord((r as any).meta) ? ((r as any).meta as any) : {},
  };
}

/* Garantiza que el Project cargado cumple el shape mínimo actual del editor/player */
export function normalizeProject(raw: unknown): Project {
  const r = isRecord(raw) ? raw : {};
  const title = asString((r as any).title, "Proyecto");

  const project: Project = {
    id: typeof (r as any).id === "string" && (r as any).id.trim().length > 0 ? ((r as any).id as ID) : generateProjectId(title),
    title,

    nodes: asArray((r as any).nodes).map(normalizeNode),

    items: asArray((r as any).items),
    npcs: asArray((r as any).npcs),
    musicTracks: asArray((r as any).musicTracks),
    maps: asArray((r as any).maps),

    meta: isRecord((r as any).meta) ? ((r as any).meta as any) : {},
  };

  if (project.nodes.length > 0 && !project.nodes.some((n) => n.isStart)) {
    project.nodes[0] = { ...project.nodes[0], isStart: true };
  }

  return project;
}