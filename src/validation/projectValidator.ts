import type { z, ZodError } from "zod";
import type { AssetDef, Project } from "@/domain/types";
import { issuesToFieldErrors } from "@/shared/zodIssues";
import { ProjectSchema } from "@/validation/projectSchemas";

/* Errores por “campo top-level” del Project */
export type ProjectFieldErrors = {
  id?: string;
  title?: string;
  assets?: string;
  items?: string;
  npcs?: string;
  players?: string;
  musicTracks?: string;
  soundEffects?: string;
  maps?: string;
  nodes?: string;
};

type ProjectInput = z.input<typeof ProjectSchema>;

function createProjectFieldErrors(): ProjectFieldErrors {
  return {
    id: undefined,
    title: undefined,
    assets: undefined,
    items: undefined,
    npcs: undefined,
    players: undefined,
    musicTracks: undefined,
    soundEffects: undefined,
    maps: undefined,
    nodes: undefined,
  };
}

function hasDuplicateIds(list: Array<{ id: string }>): boolean {
  const seen = new Set<string>();

  for (const item of list) {
    if (seen.has(item.id)) return true;
    seen.add(item.id);
  }

  return false;
}

function buildAssetIndex(assets: AssetDef[]) {
  const byKind = new Map<AssetDef["kind"], Map<string, AssetDef>>();

  for (const asset of assets) {
    const kindMap = byKind.get(asset.kind) ?? new Map<string, AssetDef>();
    kindMap.set(asset.id, asset);
    byKind.set(asset.kind, kindMap);
  }

  return {
    byKind,
    has(kind: AssetDef["kind"], id: string) {
      return byKind.get(kind)?.has(id) ?? false;
    },
    ids(kind: AssetDef["kind"]) {
      return Array.from(byKind.get(kind)?.keys() ?? []);
    },
  };
}

/* Reglas de negocio */
function applyBusinessRules(project: Project, errors: ProjectFieldErrors): void {
  const { assets, items, npcs, players, nodes, maps, musicTracks, soundEffects } = project;

  if (hasDuplicateIds(assets)) errors.assets ??= "Hay assets con id repetido.";
  if (hasDuplicateIds(items)) errors.items ??= "Hay items con id repetido.";
  if (hasDuplicateIds(npcs)) errors.npcs ??= "Hay PNJs con id repetido.";
  if (hasDuplicateIds(players)) errors.players ??= "Hay players con id repetido.";
  if (hasDuplicateIds(nodes)) errors.nodes ??= "Hay escenas (nodes) con id repetido.";
  if (hasDuplicateIds(maps)) errors.maps ??= "Hay mapas con id repetido.";
  if (hasDuplicateIds(musicTracks)) errors.musicTracks ??= "Hay pistas de música con id repetido.";
  if (hasDuplicateIds(soundEffects)) errors.soundEffects ??= "Hay efectos de sonido con id repetido.";

  const startCount = nodes.reduce((acc, node) => acc + (node.isStart ? 1 : 0), 0);
  if (startCount !== 1) {
    errors.nodes ??= startCount === 0
        ? "Debe existir exactamente una escena inicial (isStart). Ahora mismo: ninguna."
        : `Debe existir exactamente una escena inicial (isStart). Ahora mismo: ${startCount}.`;
  }

  const assetIndex = buildAssetIndex(assets);
  const musicIdSet = new Set(musicTracks.map((track) => track.id));
  const sfxIdSet = new Set(soundEffects.map((sfx) => sfx.id));
  const mapById = new Map(maps.map((map) => [map.id, map] as const));
  const nodeIdSet = new Set(nodes.map((node) => node.id));

  /* Integridad asset-backed */
  for (const track of musicTracks) {
    if (!assetIndex.has("music", track.id)) {
      errors.musicTracks ??= "Hay pistas de música sin asset asociado (assets.kind === 'music' con el mismo id).";
      break;
    }
  }

  for (const sfx of soundEffects) {
    if (!assetIndex.has("sfx", sfx.id)) {
      errors.soundEffects ??= "Hay efectos de sonido sin asset asociado (assets.kind === 'sfx' con el mismo id).";
      break;
    }
  }

  if (assetIndex.ids("music").some((id) => !musicIdSet.has(id))) {
    errors.assets ??= "Hay assets de tipo 'music' que no corresponden a ninguna pista en musicTracks.";
  }

  if (assetIndex.ids("sfx").some((id) => !sfxIdSet.has(id))) {
    errors.assets ??= "Hay assets de tipo 'sfx' que no corresponden a ningún efecto en soundEffects.";
  }

  /* Integridad players */
  for (const player of players) {
    if (!assetIndex.has("players", player.id)) {
      errors.players ??= "Hay players sin asset asociado (assets.kind === 'players' con el mismo id del player).";
      break;
    }

    const imageIds = new Set(player.images.map((img) => img.id));

    if (player.defaultImageId && !imageIds.has(player.defaultImageId)) {
      errors.players ??= "Hay players cuyo defaultImageId no existe dentro de sus images.";
      break;
    }

    if (hasDuplicateIds(player.images)) {
      errors.players ??= "Hay players con imágenes repetidas por id.";
      break;
    }

    for (const image of player.images) {
      if (!assetIndex.has("players", image.id)) {
        errors.players ??= "Hay imágenes de player sin asset asociado (assets.kind === 'players' con el mismo id de la imagen).";
        break;
      }
    }

    if (errors.players) break;
  }

  /* Integridad items / npcs */
  for (const item of items) {
    if (!assetIndex.has("items", item.id)) {
      errors.items ??= "Hay items sin asset asociado (assets.kind === 'items' con el mismo id).";
      break;
    }
  }

  for (const npc of npcs) {
    if (!assetIndex.has("npcs", npc.id)) {
      errors.npcs ??= "Hay PNJs sin asset asociado (assets.kind === 'npcs' con el mismo id).";
      break;
    }
  }

  /* Integridad mapas */
  for (const map of maps) {
    if (map.visual.type === "singleImage") {
      if (!assetIndex.has("maps", map.visual.imageAssetId)) {
        errors.maps ??= "Hay mapas con visual.singleImage cuyo imageAssetId no existe en assets (kind 'maps').";
        break;
      }
    } else {
      if (!assetIndex.has("maps", map.visual.backgroundAssetId)) {
        errors.maps ??= "Hay mapas con visual.composed cuyo backgroundAssetId no existe en assets (kind 'maps').";
        break;
      }
    }

    const regionIds = new Set<string>();

    for (const region of map.regions) {
      if (regionIds.has(region.id)) {
        errors.maps ??= "Hay regiones de mapa con id repetido dentro del mismo mapa.";
        break;
      }
      regionIds.add(region.id);

      if (region.imageAssetId && !assetIndex.has("maps", region.imageAssetId)) {
        errors.maps ??= "Hay regiones de mapa con imageAssetId inexistente en assets (kind 'maps').";
        break;
      }

      if (region.musicTrackId && !musicIdSet.has(region.musicTrackId)) {
        errors.maps ??= "Hay regiones de mapa que referencian musicTrackId inexistente.";
        break;
      }

      if (region.subMapId === map.id) {
        errors.maps ??= "Hay regiones de mapa que referencian como submapa al propio mapa.";
        break;
      }

      if (region.subMapId && !mapById.has(region.subMapId)) {
        errors.maps ??= "Hay regiones de mapa que referencian subMapId inexistente.";
        break;
      }

      if (region.entrySceneId && !region.sceneIds.includes(region.entrySceneId)) {
        errors.maps ??= "Hay regiones de mapa cuya entrySceneId no pertenece a sceneIds.";
        break;
      }

      for (const sceneId of region.sceneIds) {
        if (!nodeIdSet.has(sceneId)) {
          errors.maps ??= "Hay regiones de mapa que referencian sceneIds inexistentes.";
          break;
        }
      }

      if (errors.maps) break;
    }

    if (errors.maps) break;
  }

  /* Referencias dentro de nodes */
  for (const node of nodes) {
    if (node.musicTrackId && !musicIdSet.has(node.musicTrackId)) {
      errors.nodes ??= "Hay escenas que referencian musicTrackId inexistente (no está en musicTracks).";
      break;
    }

    if (node.mapLocation) {
      const map = mapById.get(node.mapLocation.mapId);
      if (!map) {
        errors.nodes ??= "Hay escenas que referencian mapId inexistente (no está en maps).";
        break;
      }

      if (!map.regions.some((region) => region.id === node.mapLocation!.regionId)) {
        errors.nodes ??= "Hay escenas que referencian regionId inexistente dentro del mapa indicado.";
        break;
      }
    }

    for (const layer of node.layers) {
      if (layer.musicTrackId && !musicIdSet.has(layer.musicTrackId)) {
        errors.nodes ??= "Hay capas que referencian musicTrackId inexistente (no está en musicTracks).";
        break;
      }

      if (!assetIndex.has("backgrounds", layer.assetId)) {
        errors.nodes ??= "Hay capas que referencian assetId inexistente en assets (kind 'backgrounds').";
        break;
      }

      for (const placedItem of layer.placedItems ?? []) {
        if (!items.some((item) => item.id === placedItem.itemId)) {
          errors.nodes ??= "Hay placedItems que referencian itemId inexistente.";
          break;
        }
      }

      if (errors.nodes) break;

      for (const placedNpc of layer.placedNpcs ?? []) {
        if (!npcs.some((npc) => npc.id === placedNpc.npcId)) {
          errors.nodes ??= "Hay placedNpcs que referencian npcId inexistente.";
          break;
        }
      }

      if (errors.nodes) break;

      for (const placedPlayer of layer.placedPlayers ?? []) {
        const player = players.find((p) => p.id === placedPlayer.playerId);
        if (!player) {
          errors.nodes ??= "Hay placedPlayers que referencian playerId inexistente.";
          break;
        }

        if (!player.images.some((img) => img.id === placedPlayer.initialImageId)) {
          errors.nodes ??= "Hay placedPlayers cuyo initialImageId no existe dentro de las imágenes del player.";
          break;
        }
      }

      if (errors.nodes) break;
    }

    if (errors.nodes) break;
  }
}

export function validateProject(input: ProjectInput): { ok: boolean; errors: ProjectFieldErrors; zodError?: ZodError } {
  const result = ProjectSchema.safeParse(input);
  const zodError = result.success ? undefined : result.error;

  const errors = issuesToFieldErrors(zodError, createProjectFieldErrors());

  if (result.success) applyBusinessRules(result.data, errors);

  return { ok: Object.values(errors).every((value) => value == null), errors, zodError };
}

/* API pública */
export const ProjectValidator = ProjectSchema;
export const parseProject = (input: unknown) => ProjectValidator.parse(input);
export const safeParseProject = (input: unknown) => ProjectValidator.safeParse(input);