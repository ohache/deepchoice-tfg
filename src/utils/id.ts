import type { ID } from "@/domain/types";

/* Prefijos utilizados para generar ids semánticos por tipo de entidad */
const PREFIX = {
  project: "project",
  node: "node",
  layer: "layer",
  background: "background",
  hotspot: "hs",
  rule: "rule",
  player: "player",
  playerImage: "player-img",
  item: "item",
  itemInstance: "item-instance",
  npc: "npc",
  var: "var",
  music: "music",
  sfx: "sfx",
  map: "map",
  mapRegion: "map-region",
  text: "text",
  condition: "condition",
  conditionGroup: "condition-group",
  effect: "effect",
  dialogue: "dialogue",
  dialogueRoot: "dialogue-root",
  dialogueLine: "dialogue-line",
} as const;

type PrefixKey = keyof typeof PREFIX;

/* Genera la parte única del id */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();

  throw new Error("crypto.randomUUID() no está disponible en este entorno.");
}

/* Genera un id completo usando el prefijo semántico correspondiente */
function generatePrefixedId(key: PrefixKey): ID {
  return `${PREFIX[key]}-${uuid()}`;
}

export const generateId = Object.freeze(
  Object.fromEntries(Object.keys(PREFIX).map((k) => [k, () => generatePrefixedId(k as PrefixKey)])) as {
    [K in PrefixKey]: () => ID;
  }
);