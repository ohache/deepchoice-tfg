import type { ID, Project, VarDef } from "@/domain/types";
import type { TextTokenKind } from "@/features/editor/scene/textTokens/tokenFormat";

type TokenCatalogVar = { id: ID; name: string };
type TokenCatalogRegion = { id: ID; name: string };
type TokenCatalogEntity = { id: ID; name: string; vars?: TokenCatalogVar[]; regions?: TokenCatalogRegion[] };

export type TokenCatalog = Record<TextTokenKind, TokenCatalogEntity[]>;

const EMPTY_TOKEN_CATALOG: TokenCatalog = { players: [], npcs: [], items: [], maps: [], music: [] };

/*Convierte variables del dominio a una versión mínima para el catálogo */
function mapVars(vars?: VarDef[]): TokenCatalogVar[] {
  if (!vars?.length) return [];

  return vars.map((variable) => ({ id: variable.id, name: variable.name }));
}

/* Construye el catálogo de tokens a partir del proyecto actual */
export function buildTokenCatalog(project: Project | null): TokenCatalog {
  if (!project) return EMPTY_TOKEN_CATALOG;

  return {
    players: (project.players ?? []).map((player) => ({ id: player.id, name: player.name, vars: mapVars(player.vars) })),

    npcs: (project.npcs ?? []).map((npc) => ({ id: npc.id, name: npc.name, vars: mapVars(npc.vars) })),

    items: (project.items ?? []).map((item) => ({ id: item.id, name: item.name })),

    maps: (project.maps ?? []).map((map) => ({ id: map.id, name: map.name,
      regions: (map.regions ?? []).map((region) => ({ id: region.id, name: region.label })),
    })),

    music: (project.musicTracks ?? []).map((track) => ({ id: track.id, name: track.name })),
  };
}