import { z } from "zod";
import { IdSchema } from "@/validation/genericSchemas";
import { conditionSchema, effectSchema } from "@/validation/rulesSchemas";

/* Speaker */
export const DialogueSpeakerSchema = z.enum(["player", "npc"]);

/* Root node */
export const DialogueRootNodeSchema = z.object({
  id: IdSchema,
  type: z.literal("root"),
  childrenIds: z.array(IdSchema).default([]),
});

/* Line Node */
export const DialogueLineNodeSchema = z.object({
  id: IdSchema,
  type: z.literal("line"),
  speaker: DialogueSpeakerSchema,
  text: z.string().trim(),
  when: conditionSchema.optional(),
  effects: z.array(effectSchema).optional(),
  childrenIds: z.array(IdSchema).default([]),
});

/* Dialogue node */
export const DialogueNodeSchema = z.discriminatedUnion("type", [DialogueRootNodeSchema, DialogueLineNodeSchema]);

/* Dialogue */
export const DialogueSchema = z.object({
  id: IdSchema,
  playerId: IdSchema,
  npcId: IdSchema,
  title: z.string().trim().min(1, "El título es obligatorio"),
  description: z.string().trim().optional(),
  when: conditionSchema.optional(),
  rootId: IdSchema,
  nodes: z.array(DialogueNodeSchema).default([]),
});

/* Types inferidos */
export type Dialogue = z.infer<typeof DialogueSchema>;
export type DialogueRootNode = z.infer<typeof DialogueRootNodeSchema>;
export type DialogueLineNode = z.infer<typeof DialogueLineNodeSchema>;
export type DialogueNode = z.infer<typeof DialogueNodeSchema>;
export type DialogueSpeaker = z.infer<typeof DialogueSpeakerSchema>;