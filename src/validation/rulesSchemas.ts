import { z } from "zod";
import { BOOL_OPS, NUMBER_OPS } from "@/domain/conditions";
import type { Effect } from "@/domain/effects";
import { IdSchema } from "@/validation/genericSchemas";

const varCondMismatch = "Operador y valor no son compatibles (boolean vs number).";

/* Conditions */
export const numberOpSchema = z.enum(NUMBER_OPS);
export const boolOpSchema = z.enum(BOOL_OPS);
export const opSchema = z.union([numberOpSchema, boolOpSchema]);

/* Schema base para condiciones de comparación con op/value */
const varCompareSchemaBase = z.object({
  varId: IdSchema,
  op: opSchema,
  value: z.union([z.number(), z.boolean()]),
});

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

const playerVarConditionSchema = z.object({
    type: z.literal("playerVar"),
    playerId: IdSchema,
    ...varCompareSchemaBase.shape,
  }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value));

const npcVarConditionSchema = z.object({
    type: z.literal("npcVar"),
    npcId: IdSchema,
    ...varCompareSchemaBase.shape,
  }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value));

const hotspotVarConditionSchema = z.object({
    type: z.literal("hotspotVar"),
    hotspotId: IdSchema,
    ...varCompareSchemaBase.shape,
  }).superRefine((value, ctx) => superRefineOpValue(ctx, value.op, value.value));

export const conditionSchema: z.ZodType<any> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("and"), all: z.array(conditionSchema) }),
    z.object({ type: z.literal("or"), any: z.array(conditionSchema) }),
    z.object({ type: z.literal("not"), cond: conditionSchema }),

    // Progreso
    z.object({ type: z.literal("nodeVisited"), nodeId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Inventario
    z.object({ type: z.literal("hasItem"), placedItemId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Variables
    playerVarConditionSchema,
    npcVarConditionSchema,
    hotspotVarConditionSchema,

    // Hotspots
    z.object({ type: z.literal("hotspotVisible"), hotspotId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("hotspotReachable"), hotspotId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Items
    z.object({ type: z.literal("placedItemVisible"), placedItemId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("placedItemReachable"), placedItemId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Npc
    z.object({ type: z.literal("placedNpcVisible"), npcId: IdSchema, op: boolOpSchema, value: z.boolean() }),
    z.object({ type: z.literal("placedNpcReachable"), npcId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Player
    z.object({ type: z.literal("placedPlayerVisible"), playerId: IdSchema, op: boolOpSchema, value: z.boolean() }),

    // Map
    z.object({ type: z.literal("mapRegionVisited"), mapId: IdSchema, regionId: IdSchema, op: boolOpSchema, value: z.boolean() }),
  ]),
);

export type ConditionDTO = z.infer<typeof conditionSchema>;

/* Effects */
export const effectSchema: z.ZodType<Effect> = z.discriminatedUnion("type", [
  // Navegación
  z.object({ type: z.literal("goToNode"), targetNodeId: IdSchema }),

  // Inventario
  z.object({ type: z.literal("addItem"), placedItemId: IdSchema }),
  z.object({ type: z.literal("removeItem"), placedItemId: IdSchema }),

  // Diálogo / PNJ
  z.object({ type: z.literal("startDialogue"), nodeDialogueId: IdSchema }),
  z.object({ type: z.literal("endDialogue") }),
  z.object({ type: z.literal("giveItemToNpc"), npcId: IdSchema, placedItemId: IdSchema }),
  z.object({ type: z.literal("receiveItemFromNpc"), npcId: IdSchema, placedItemId: IdSchema }),

  // Feedback
  z.object({ type: z.literal("showMessage"), text: z.string().trim().min(1, "El texto no puede estar vacío") }),

  // Estado de placed items
  z.object({ type: z.literal("setPlacedItemVisible"), nodeId: IdSchema, placedItemId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedItemReachable"), nodeId: IdSchema, placedItemId: IdSchema, value: z.boolean() }),

  // Estado del hotspot
  z.object({ type: z.literal("setHotspotVisible"), hotspotId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setHotspotReachable"), hotspotId: IdSchema, value: z.boolean() }),

  // Variables del hotspot
  z.object({ type: z.literal("setHotspotVar"), hotspotId: IdSchema, varId: IdSchema, value: z.union([z.boolean(), z.number()]) }),
  z.object({ type: z.literal("toggleHotspotVar"), hotspotId: IdSchema, varId: IdSchema }),
  z.object({ type: z.literal("incHotspotVar"), hotspotId: IdSchema, varId: IdSchema, amount: z.number().optional() }),
  z.object({ type: z.literal("decHotspotVar"), hotspotId: IdSchema, varId: IdSchema, amount: z.number().optional() }),

  // Estado del player colocado
  z.object({ type: z.literal("setPlacedPlayerVisible"), nodeId: IdSchema, playerId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedPlayerImage"), nodeId: IdSchema, playerId: IdSchema, imageId: IdSchema }),

  // Estado del npc colocado
  z.object({ type: z.literal("setPlacedNpcVisible"), nodeId: IdSchema, npcId: IdSchema, value: z.boolean() }),
  z.object({ type: z.literal("setPlacedNpcReachable"), nodeId: IdSchema, npcId: IdSchema, value: z.boolean() }),

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
  z.object({ type: z.literal("pauseMusic") }),
  z.object({ type: z.literal("stopMusic") }),

  // Mapa
  z.object({ type: z.literal("setMapRegionAvailable"), mapId: IdSchema, regionId: IdSchema, value: z.boolean() }),

  // Finalizar juego
  z.object({ type: z.literal("endGame"), message: z.string().trim().optional() }),
]);

export type EffectInput = z.input<typeof effectSchema>;
export type EffectOutput = z.output<typeof effectSchema>;

/* Interaction Rules */
export const baseInteractionRuleSchema = z.object({
  id: IdSchema,
  when: conditionSchema.optional(),
  phrase: z.string().trim().max(200).optional(),
  effects: z.array(effectSchema).default([]),
});

export const clickRuleSchema = baseInteractionRuleSchema;

export const useItemRuleSchema = baseInteractionRuleSchema.extend({ placedItemId: IdSchema });

export const interactionRulesSchema = z.object({
  onClick: z.array(clickRuleSchema).optional(),
  onUseItem: z.array(useItemRuleSchema).optional(),
});

export type InteractionRulesDTO = z.infer<typeof interactionRulesSchema>;