import { z } from "zod";
import type { Project, AssetDef, ItemDef, NpcDef, PlayerDef, PlayerImage, MusicTrackDef, SoundEffectDef,
  WorldMap, MapVisualSource, MapRegion, NodeMapLocation } from "@/domain/types";
import { IdSchema, VarDefSchema, regionShapeSchema } from "@/validation/genericSchemas";
import { nodeSchema } from "@/features/editor/scene/node/nodeSchemas";

/* Assets */
export const AssetKindSchema = z.enum([ "backgrounds", "players", "npcs", "items", "music", "sfx", "maps" ]);

export const AssetSchema = z.object({
  id: IdSchema,
  kind: AssetKindSchema,
  name: z.string().trim().min(1).max(60),
  file: z.string().trim().min(1),
}) satisfies z.ZodType<AssetDef>;

/* SFX */
export const SoundEffectSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
}) satisfies z.ZodType<SoundEffectDef>;

/* Music */
export const MusicTrackSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
}) satisfies z.ZodType<MusicTrackDef>;

/* Items */
export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
}) satisfies z.ZodType<ItemDef>;

/* NPCs */
export const NpcSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(200).optional(),
  vars: z.array(VarDefSchema).optional(),
}) satisfies z.ZodType<NpcDef>;

/* Players */
export const PlayerImageSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
}) satisfies z.ZodType<PlayerImage>;

export const PlayerSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
  description: z.string().trim().max(400).optional(),
  images: z.array(PlayerImageSchema).min(1),
  defaultImageId: IdSchema.optional(),
  vars: z.array(VarDefSchema).optional(),
}) satisfies z.ZodType<PlayerDef>;

/* Maps */
export const MapVisualSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("singleImage"),
    imageAssetId: IdSchema,
  }),
  z.object({
    type: z.literal("composed"),
    backgroundAssetId: IdSchema,
  }),
]) satisfies z.ZodType<MapVisualSource>;

export const MapRegionSchema = z.object({
  id: IdSchema,
  label: z.string().trim().min(1).max(60),
  shape: regionShapeSchema,
  visible: z.boolean(),
  imageAssetId: IdSchema.optional(),
  musicTrackId: IdSchema.optional(),
  subMapId: IdSchema.optional(),
  entrySceneId: IdSchema.optional(),
  sceneIds: z.array(IdSchema),
}) satisfies z.ZodType<MapRegion>;

export const WorldMapSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(60),
  visual: MapVisualSourceSchema,
  regions: z.array(MapRegionSchema),
}) satisfies z.ZodType<WorldMap>;

export const NodeMapLocationSchema = z.object({
  mapId: IdSchema,
  regionId: IdSchema,
  isEntry: z.boolean().optional(),
}) satisfies z.ZodType<NodeMapLocation>;

/* Project */
export const ProjectSchema = z.object({
  id: IdSchema,
  title: z.string().trim().min(1),

  assets: z.array(AssetSchema),
  items: z.array(ItemSchema),
  npcs: z.array(NpcSchema),
  players: z.array(PlayerSchema),

  musicTracks: z.array(MusicTrackSchema),
  soundEffects: z.array(SoundEffectSchema),

  maps: z.array(WorldMapSchema),
  nodes: z.array(nodeSchema),
}) satisfies z.ZodType<Project>;

export type ProjectDTO = z.infer<typeof ProjectSchema>;