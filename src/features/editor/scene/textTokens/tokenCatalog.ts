import type { ID, Project, VarDef } from "@/domain/types";
import type { TextTokenKind } from "@/features/editor/scene/textTokens/tokenFormat";

type TokenCatalogVar = { id: ID; name: string };

type TokenCatalogEntity = { id: ID; name: string; vars?: TokenCatalogVar[] };

export type TokenCatalog = Record<TextTokenKind, TokenCatalogEntity[]>;

function mapVars(vars?: VarDef[]): TokenCatalogVar[] {
  if (!vars?.length) return [];
  return vars.map((v) => ({ id: v.id, name: v.name }));
}

export function buildTokenCatalog(project: Project | null): TokenCatalog {
  const empty: TokenCatalog = { players: [], npcs: [], items: [], maps: [], music: [] };

  if (!project) return empty;

  return {
    players: (project.players ?? []).map((p) => ({ id: p.id, name: p.name, vars: mapVars(p.vars) })),

    npcs: (project.npcs ?? []).map((n) => ({ id: n.id, name: n.name, vars: mapVars(n.vars) })),

    items: (project.items ?? []).map((it) => ({ id: it.id, name: it.name })),

    maps: (project.maps ?? []).map((m) => ({ id: m.id, name: m.name })),

    music: (project.musicTracks ?? []).map((m) => ({ id: m.id, name: m.name })),
  };
}