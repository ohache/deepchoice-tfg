import { z } from "zod";
import type { Dialogue, DialogueLineNode, DialogueNode, DialogueRootNode } from "@/domain/types";
import { IdSchema } from "@/validation/genericSchemas";
import { conditionSchema, effectSchema } from "@/validation/rulesSchemas";

export const DialogueSpeakerSchema = z.enum(["player", "npc"]);

export const DialogueRootNodeSchema = z.object({
  id: IdSchema,
  type: z.literal("root"),
  childrenIds: z.array(IdSchema).default([]),
}) satisfies z.ZodType<DialogueRootNode>;

export const DialogueLineNodeSchema = z.object({
  id: IdSchema,
  type: z.literal("line"),
  speaker: DialogueSpeakerSchema,
  text: z.string().trim().min(1, "El texto de la línea es obligatorio"),
  when: conditionSchema.optional(),
  effects: z.array(effectSchema).optional(),
  childrenIds: z.array(IdSchema).default([]),
}) satisfies z.ZodType<DialogueLineNode>;

export const DialogueNodeSchema = z.discriminatedUnion("type", [DialogueRootNodeSchema, DialogueLineNodeSchema]) satisfies z.ZodType<DialogueNode>;

export const DialogueSchema = z.object({
  id: IdSchema,
  playerId: IdSchema,
  npcId: IdSchema,
  title: z.string().trim().min(1, "El título es obligatorio").max(60, "Máximo 60 caracteres"),
  description: z.string().trim().max(200, "Máximo 200 caracteres").optional(),
  when: conditionSchema.optional(),
  rootId: IdSchema,
  nodes: z.array(DialogueNodeSchema).default([]),
}) satisfies z.ZodType<Dialogue>;