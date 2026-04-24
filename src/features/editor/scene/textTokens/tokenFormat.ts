import type { ID } from "@/domain/types";

export type TextTokenKind = "players" | "npcs" | "items" | "maps" | "music";

type ParsedTextToken =
  | { kind: TextTokenKind; entityId: ID; prop: "name"; varId?: never; regionId?: never }
  | { kind: "players" | "npcs"; entityId: ID; prop: "vars"; varId: ID }
  | { kind: "maps"; entityId: ID; prop: "regions"; regionId: ID; varId?: never };

const TEXT_TOKEN_REGEX = /\{\{([^}]+)\}\}/g;
const NAME_TOKEN_REGEX = /^(players|npcs|items|maps|music):([^.\s]+)\.name$/;
const VAR_TOKEN_REGEX = /^(players|npcs):([^.\s]+)\.vars:([^\s]+)$/;
const MAP_REGION_TOKEN_REGEX = /^maps:([^.\s]+)\.regions:([^\s]+)$/;

export function buildNameToken(kind: TextTokenKind, entityId: ID): string {
  return `{{${kind}:${entityId}.name}}`;
}

export function buildVarToken(kind: "players" | "npcs", entityId: ID, varId: ID): string {
  return `{{${kind}:${entityId}.vars:${varId}}}`;
}

export function buildMapRegionToken(mapId: ID, regionId: ID): string {
  return `{{maps:${mapId}.regions:${regionId}}}`;
}

/* Encuentra todos los fragmentos del texto que tienen forma de token {{...}} */
export function findTextTokens(input: string): Array<{ raw: string; start: number; end: number }> {
  if (!input) return [];

  const matches: Array<{ raw: string; start: number; end: number }> = [];
  const regex = new RegExp(TEXT_TOKEN_REGEX);

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const raw = match[0];

    matches.push({ raw, start: match.index, end: match.index + raw.length });
  }

  return matches;
}

/* Convierte un token raw en una estructura tipada utilizable por la UI o el resolver */
export function parseTextToken(raw: string): ParsedTextToken | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;

  const inside = raw.slice(2, -2).trim();

  const nameMatch = inside.match(NAME_TOKEN_REGEX);
  if (nameMatch) {
    const [, kind, entityId] = nameMatch;

    return { kind: kind as TextTokenKind, entityId, prop: "name" };
  }

  const varMatch = inside.match(VAR_TOKEN_REGEX);
  if (varMatch) {
    const [, kind, entityId, varId] = varMatch;

    return { kind: kind as "players" | "npcs", entityId, prop: "vars", varId };
  }

  const mapRegionMatch = inside.match(MAP_REGION_TOKEN_REGEX);
  if (mapRegionMatch) {
    const [, entityId, regionId] = mapRegionMatch;
    return { kind: "maps", entityId, prop: "regions", regionId };
  }

  return null;
}