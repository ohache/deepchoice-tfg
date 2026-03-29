import type { ID } from "@/domain/types";

export type TextTokenKind = "players" | "npcs" | "items" | "maps" | "music";

type ParsedTextToken =
  | { kind: TextTokenKind; entityId: ID; prop: "name"; varId?: never }
  | { kind: "players" | "npcs"; entityId: ID; prop: "vars"; varId: ID };

export function buildNameToken(kind: TextTokenKind, entityId: ID): string {
  return `{{${kind}:${entityId}.name}}`;
}

export function buildVarToken(kind: "players" | "npcs", entityId: ID, varId: ID): string {
  return `{{${kind}:${entityId}.vars:${varId}}}`;
}

export function findTextTokens(input: string): Array<{ raw: string; start: number; end: number }> {
  const out: Array<{ raw: string; start: number; end: number }> = [];
  if (!input) return out;

  const re = /\{\{([^}]+)\}\}/g;
  let m: RegExpExecArray | null;

  while ((m = re.exec(input))) {
    const raw = m[0];
    out.push({ raw, start: m.index, end: m.index + raw.length });
  }

  return out;
}

export function parseTextToken(raw: string): ParsedTextToken | null {
  if (!raw.startsWith("{{") || !raw.endsWith("}}")) return null;

  const inside = raw.slice(2, -2).trim();

  const nameRe = /^(players|npcs|items|maps|music):([^.\s]+)\.name$/;
  const mName = inside.match(nameRe);

  if (mName) return { kind: mName[1] as TextTokenKind, entityId: mName[2], prop: "name" };

  const varRe = /^(players|npcs):([^.\s]+)\.vars:([^\s]+)$/;
  const mVar = inside.match(varRe);

  if (mVar) return { kind: mVar[1] as "players" | "npcs", entityId: mVar[2], prop: "vars", varId: mVar[3] };

  return null;
}