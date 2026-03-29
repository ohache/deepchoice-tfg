import type { z, ZodError } from "zod";
import type { AssetDef, Project } from "@/domain/types";
import { ProjectSchema } from "@/validation/projectSchemas";
import { issuesToFieldErrors } from "@/shared/zodIssues";

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
  const set = new Set<string>();
  for (const it of list) {
    if (set.has(it.id)) return true;
    set.add(it.id);
  }
  return false;
}

function buildAssetIndex(assets: AssetDef[]) {
  const byKind = new Map<AssetDef["kind"], Map<string, AssetDef>>();

  for (const a of assets) {
    const m = byKind.get(a.kind) ?? new Map<string, AssetDef>();
    m.set(a.id, a);
    byKind.set(a.kind, m);
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

/* Reglas de negocio (integridad/coherencia del proyecto) */
function applyBusinessRules(project: Project, errors: ProjectFieldErrors): void {
  const assets = project.assets ?? [];
  const items = project.items ?? [];
  const npcs = project.npcs ?? [];
  const players = project.players ?? [];
  const nodes = project.nodes ?? [];
  const maps = project.maps ?? [];
  const musicTracks = project.musicTracks ?? [];
  const sfx = project.soundEffects ?? [];

  if (hasDuplicateIds(assets)) errors.assets ??= "Hay assets con id repetido.";
  if (hasDuplicateIds(items)) errors.items ??= "Hay items con id repetido.";
  if (hasDuplicateIds(npcs)) errors.npcs ??= "Hay PNJs con id repetido.";
  if (hasDuplicateIds(players)) errors.players ??= "Hay players con id repetido.";
  if (hasDuplicateIds(nodes)) errors.nodes ??= "Hay escenas (nodes) con id repetido.";
  if (hasDuplicateIds(maps)) errors.maps ??= "Hay mapas con id repetido.";
  if (hasDuplicateIds(musicTracks)) errors.musicTracks ??= "Hay pistas de música con id repetido.";
  if (hasDuplicateIds(sfx)) errors.soundEffects ??= "Hay efectos de sonido con id repetido.";

  const startCount = nodes.reduce((acc, n) => acc + (n.isStart ? 1 : 0), 0);
  if (startCount !== 1) {
    errors.nodes ??= startCount === 0
      ? "Debe existir exactamente una escena inicial (isStart). Ahora mismo: ninguna."
      : `Debe existir exactamente una escena inicial (isStart). Ahora mismo: ${startCount}.`;
  }

  const assetIndex = buildAssetIndex(assets);
  const musicIdSet = new Set(musicTracks.map((t) => t.id));
  const sfxIdSet = new Set(sfx.map((x) => x.id));
  const mapById = new Map(maps.map((m) => [m.id, m] as const));
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  /* Integridad asset-backed */
  for (const t of musicTracks) {
    if (!assetIndex.has("music", t.id)) {
      errors.musicTracks ??= "Hay pistas de música sin asset asociado (assets.kind === 'music' con el mismo id).";
      break;
    }
  }

  for (const e of sfx) {
    if (!assetIndex.has("sfx", e.id)) {
      errors.soundEffects ??= "Hay efectos de sonido sin asset asociado (assets.kind === 'sfx' con el mismo id).";
      break;
    }
  }

  const orphanMusicAssets = assetIndex.ids("music").some((id) => !musicIdSet.has(id));
  if (orphanMusicAssets) {
    errors.assets ??= "Hay assets de tipo 'music' que no corresponden a ninguna pista en musicTracks.";
  }

  const orphanSfxAssets = assetIndex.ids("sfx").some((id) => !sfxIdSet.has(id));
  if (orphanSfxAssets) {
    errors.assets ??= "Hay assets de tipo 'sfx' que no corresponden a ningún efecto en soundEffects.";
  }

  /* Integridad mapas */
  for (const map of maps) {
    if (map.visual.type === "singleImage") {
      if (!assetIndex.has("maps", map.visual.imageAssetId)) {
        errors.maps ??= "Hay mapas con visual.singleImage cuyo imageAssetId no existe en assets (kind 'maps').";
        break;
      }
    }

    if (map.visual.type === "composed") {
      if (!assetIndex.has("maps", map.visual.backgroundAssetId)) {
        errors.maps ??= "Hay mapas con visual.composed cuyo backgroundAssetId no existe en assets (kind 'maps').";
        break;
      }
    }

    const regionIds = new Set<string>();

    for (const region of map.regions ?? []) {
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

      if (region.subMapId) {
        if (region.subMapId === map.id) {
          errors.maps ??= "Hay regiones de mapa que referencian como submapa al propio mapa.";
          break;
        }

        if (!mapById.has(region.subMapId)) {
          errors.maps ??= "Hay regiones de mapa que referencian subMapId inexistente.";
          break;
        }
      }

      if (region.entrySceneId && !region.sceneIds.includes(region.entrySceneId)) {
        errors.maps ??= "Hay regiones de mapa cuya entrySceneId no pertenece a sceneIds.";
        break;
      }

      for (const sceneId of region.sceneIds ?? []) {
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
  for (const n of nodes) {
    if (n.musicTrackId && !musicIdSet.has(n.musicTrackId)) {
      errors.nodes ??= "Hay escenas que referencian musicTrackId inexistente (no está en musicTracks).";
      break;
    }

    if (n.mapLocation) {
      const m = mapById.get(n.mapLocation.mapId);
      if (!m) {
        errors.nodes ??= "Hay escenas que referencian mapId inexistente (no está en maps).";
        break;
      }

      const regionExists = m.regions.some((r) => r.id === n.mapLocation?.regionId);
      if (!regionExists) {
        errors.nodes ??= "Hay escenas que referencian regionId inexistente dentro del mapa indicado.";
        break;
      }
    }

    for (const layer of n.layers ?? []) {
      if (layer.musicTrackId && !musicIdSet.has(layer.musicTrackId)) {
        errors.nodes ??= "Hay capas que referencian musicTrackId inexistente (no está en musicTracks).";
        break;
      }

      if (!assetIndex.has("backgrounds", layer.assetId)) {
        errors.nodes ??= "Hay capas que referencian assetId inexistente en assets (kind 'backgrounds').";
        break;
      }
    }

    for (const layer of n.layers ?? []) {
      if (!assetIndex.has("backgrounds", layer.assetId)) {
        errors.nodes ??= "Hay capas que referencian assetId inexistente en assets (kind 'backgrounds').";
        break;
      }
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