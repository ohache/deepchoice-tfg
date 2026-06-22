import { z } from "zod";
import { BOOL_OPS, NUMBER_OPS } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { IdSchema } from "@/validation/genericSchemas";

const varCondMismatch = "Operador y valor no son compatibles (boolean vs number).";

/* Conditions */
const numberOpSchema = z.enum(NUMBER_OPS);
const boolOpSchema = z.enum(BOOL_OPS);
const opSchema = z.union([numberOpSchema, boolOpSchema]);

/* Schema base para condiciones de comparación con op/value */
const varCompareSchemaBase = z.object({ varId: IdSchema, op: opSchema, value: z.union([z.number(), z.boolean()]) });

function superRefineOpValue(ctx: z.RefinementCtx, op: unknown, value: unknown) {
  const isBoolValue = typeof value === "boolean";
  const isNumValue = typeof value === "number";

  if (!isBoolValue && !isNumValue) {
    ctx.addIssue({ code: "custom", message: varCondMismatch });
    return;
  }

  if (isBoolValue) {
    if (op !== "==" && op !== "!=") ctx.addIssue({ code: "custom", message: varCondMismatch });
    return;
  }

  if (isNumValue) {
    const ok = op === "==" || op === "!=" || op === ">" || op === ">=" || op === "<" || op === "<=";

    if (!ok) ctx.addIssue({ code: "custom", message: varCondMismatch });
  }
}

export const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("and"), all: z.array(conditionSchema) }),
    z.object({ type: z.literal("or"), any: z.array(conditionSchema) }),
    z.object({ type: z.literal("not"), cond: conditionSchema }),

    // Progreso
    z.object({ type: z.literal("nodeVisited"), nodeId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Inventario
    z.object({ type: z.literal("hasItem"), playerId: IdSchema, itemInstanceId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("npcHasItem"), npcId: IdSchema, itemInstanceId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Variables
    z.object({ type: z.literal("playerVar"), playerId: IdSchema, ...varCompareSchemaBase.shape,
      }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value)),
    z.object({ type: z.literal("npcVar"), npcId: IdSchema, ...varCompareSchemaBase.shape,
      }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value)),
    z.object({ type: z.literal("hotspotVar"), hotspotId: IdSchema, ...varCompareSchemaBase.shape,
      }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value)),

    // Hotspots
    z.object({ type: z.literal("hotspotVisible"), hotspotId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("hotspotReachable"), hotspotId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Items
    z.object({ type: z.literal("placedItemVisible"), itemInstanceId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("placedItemReachable"), itemInstanceId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Npc
    z.object({ type: z.literal("placedNpcVisible"), nodeId: IdSchema, layerId: IdSchema, npcId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("placedNpcReachable"), nodeId: IdSchema, layerId: IdSchema, npcId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Player
    z.object({ type: z.literal("placedPlayerVisible"), nodeId: IdSchema, layerId: IdSchema, playerId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("placedPlayerImage"), nodeId: IdSchema, layerId: IdSchema, playerId: IdSchema, imageId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Music
    z.object({ type: z.literal("musicPlaying"), trackId: IdSchema, op: boolOpSchema, value: z.boolean()}),

    // Map
    z.object({ type: z.literal("mapRegionVisited"), mapId: IdSchema, regionId: IdSchema, op: boolOpSchema, value: z.boolean() }),
  ]),
);

/* Phrase */
const rulePhraseSpeakerSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("narrator") }),
  z.object({ kind: z.literal("player"), playerId: IdSchema }),
  z.object({ kind: z.literal("npc"), npcId: IdSchema }),
]);

export const rulePhraseSchema = z.object({
  text: z.string().trim().min(1).max(200),
  speaker: rulePhraseSpeakerSchema.optional(),
});

/* Effects */
export const effectSchema: z.ZodType<Effect> = z.discriminatedUnion("type", [
  // Navegación
  z.object({ type: z.literal("goToNode"), targetNodeId: IdSchema }),

// Inventario
z.object({ type: z.literal("addItem"), playerId: IdSchema, itemInstanceId: IdSchema }),
z.object({ type: z.literal("removeItem"), playerId: IdSchema, itemInstanceId: IdSchema }),
z.object({ type: z.literal("transformItem"), itemInstanceId: IdSchema, resultItemId: IdSchema, resultItemInstanceId: IdSchema,
  resultItemLabel: z.string().trim().min(1, "El nombre del nuevo item no puede estar vacío").max(60, "El nombre del nuevo item no puede superar los 60 caracteres") }),
z.object({ type: z.literal("combineItems"), itemAInstanceId: IdSchema, itemBInstanceId: IdSchema, resultItemId: IdSchema, resultItemInstanceId: IdSchema,
  resultItemLabel: z.string().trim().min(1, "El nombre del nuevo item no puede estar vacío").max(60, "El nombre del nuevo item no puede superar los 60 caracteres") }),

  // Diálogo / PNJ
  z.object({ type: z.literal("startDialogue"), nodeDialogueId: IdSchema }),
  z.object({ type: z.literal("endDialogue") }),
  z.object({ type: z.literal("giveItemToNpc"), npcId: IdSchema, itemInstanceId: IdSchema }),
  z.object({ type: z.literal("receiveItemFromNpc"), npcId: IdSchema, itemInstanceId: IdSchema }),

  // Feedback
  z.object({ type: z.literal("showMessage"), text: z.string().trim().min(1, "El texto no puede estar vacío"), speaker: rulePhraseSpeakerSchema.optional() }),

  // Estado de placed items
  z.object({ type: z.literal("setPlacedItemVisible"), itemInstanceId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedItemReachable"), itemInstanceId: IdSchema, value: z.boolean() }),

  // Estado del hotspot
  z.object({ type: z.literal("setHotspotVisible"), hotspotId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setHotspotReachable"), hotspotId: IdSchema, value: z.boolean() }),

  // Variables del hotspot
  z.object({ type: z.literal("setHotspotVar"), hotspotId: IdSchema, varId: IdSchema, value: z.union([z.boolean(), z.number()]) }),
  z.object({ type: z.literal("toggleHotspotVar"), hotspotId: IdSchema, varId: IdSchema }),
  z.object({ type: z.literal("incHotspotVar"), hotspotId: IdSchema, varId: IdSchema, amount: z.number().optional() }),
  z.object({ type: z.literal("decHotspotVar"), hotspotId: IdSchema, varId: IdSchema, amount: z.number().optional() }),

  // Estado del player colocado
  z.object({ type: z.literal("setPlacedPlayerVisible"), nodeId: IdSchema, layerId: IdSchema, playerId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedPlayerImage"), nodeId: IdSchema, layerId: IdSchema, playerId: IdSchema, imageId: IdSchema }),

  // Estado del npc colocado
  z.object({ type: z.literal("setPlacedNpcVisible"), nodeId: IdSchema, layerId: IdSchema, npcId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedNpcReachable"), nodeId: IdSchema, layerId: IdSchema, npcId: IdSchema, value: z.boolean() }),

  // Variables del player
  z.object({ type: z.literal("setPlayerVar"), playerId: IdSchema, varId: IdSchema, value: z.union([z.boolean(), z.number()]) }),
  z.object({ type: z.literal("togglePlayerVar"), playerId: IdSchema, varId: IdSchema }),
  z.object({ type: z.literal("incPlayerVar"), playerId: IdSchema, varId: IdSchema, amount: z.number().optional() }),
  z.object({ type: z.literal("decPlayerVar"), playerId: IdSchema, varId: IdSchema, amount: z.number().optional() }),

  // Variables del NPC
  z.object({ type: z.literal("setNpcVar"), npcId: IdSchema, varId: IdSchema, value: z.union([z.boolean(), z.number()]) }),
  z.object({ type: z.literal("toggleNpcVar"), npcId: IdSchema, varId: IdSchema }),
  z.object({ type: z.literal("incNpcVar"), npcId: IdSchema, varId: IdSchema, amount: z.number().optional() }),
  z.object({ type: z.literal("decNpcVar"), npcId: IdSchema, varId: IdSchema, amount: z.number().optional() }),

  // Audio
  z.object({ type: z.literal("playSfx"), sfxId: IdSchema }),
  z.object({ type: z.literal("playMusic"), trackId: IdSchema, startAt: z.enum(["resume", "restart"]).optional() }),
  z.object({ type: z.literal("stopMusic"), trackId: IdSchema }),

  // Mapa
  z.object({ type: z.literal("setMapRegionAvailable"), mapId: IdSchema, regionId: IdSchema, value: z.boolean() }),

  // Finalizar juego
  z.object({ type: z.literal("endGame"), ending: z.object({
    message: z.string().trim().optional(), dockText: z.string().trim().optional(), musicTrackId: IdSchema.optional().or(z.literal("")), lines: z.array(
      z.object({ id: IdSchema, text: z.string().trim().min(1, "El texto de la línea no puede estar vacío"), speaker: rulePhraseSpeakerSchema.optional()})
    ).optional(),
  }).optional()})]);

/* Interaction Rules */
export const baseInteractionRuleSchema = z.object({ id: IdSchema, when: conditionSchema.optional(), phrase: rulePhraseSchema.optional(), effects: z.array(effectSchema).default([]) });

export const clickRuleSchema = baseInteractionRuleSchema;

export const useItemRuleSchema = baseInteractionRuleSchema.extend({ itemInstanceId: IdSchema });

export const interactionRulesSchema = z.object({ onClick: z.array(clickRuleSchema).optional(), onUseItem: z.array(useItemRuleSchema).optional() });