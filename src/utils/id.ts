import type { ID } from "@/domain/types";

const PREFIX = {
  project: "project",
  node: "node",
  layer: "layer",
  background: "background",
  hotspot: "hs",
  hotspotAction: "hs-act",
  hotspotInteraction: "hs-int",
  rule: "rule",
  player: "player",
  playerImage: "player-img",
  playerVariable: "player-var",
  playerPlaced: "player-placed",
  item: "item",
  itemPlaced: "item-placed",
  itemAction: "item-act",
  itemInteraction: "item-int",
  npc: "npc",
  npcPlaced: "npc-placed",
  npcAction: "npc-act",
  npcInteraction: "npc-int",
  var: "var",
  music: "music",
  sfx: "sfx",
  map: "map",
  mapRegion: "map-region",
  asset: "asset",
  text: "text",
  base: "base",
  variant: "variant",
  condition: "condition",
  conditionGroup: "condgroup",
  effect: "effect",
  interactionLayer: "int-layer",
  dialogue: "dialogue",
  dialogueRoot: "dialogue-root",
  dialogueLine: "dialogue-line",
} as const;

type PrefixKey = keyof typeof PREFIX;

function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  throw new Error("crypto.randomUUID() no está disponible en este entorno.");
}

function generateIdGeneral(key: PrefixKey): ID {
  return `${PREFIX[key]}-${uuid()}`;
}

export const generateId = Object.freeze(
  Object.fromEntries(Object.keys(PREFIX).map((k) => [k, () => generateIdGeneral(k as PrefixKey)])) as {
    [K in PrefixKey]: () => ID;
  }
);