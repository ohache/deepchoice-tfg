import type { ID, Project, WorldMap } from "@/domain/types";
import { findTextTokens, parseTextToken, type TextTokenKind } from "@/features/editor/scene/textTokens/tokenFormat";

export type ResolvedTokenPart =
  | { type: "text"; value: string }
  | { type: "token"; raw: string; resolvedText: string | null };


/* Busca el nombre visible de una entidad del proyecto */
function getEntityName(project: Project, kind: TextTokenKind, id: ID): string | null {
  switch (kind) {
    case "players": return project.players.find((player) => player.id === id)?.name ?? null;

    case "npcs": return project.npcs.find((npc) => npc.id === id)?.name ?? null;

    case "items": return project.items.find((item) => item.id === id)?.name ?? null;

    case "maps": return project.maps.find((map) => map.id === id)?.name ?? null;

    case "music": return project.musicTracks.find((track) => track.id === id)?.name ?? null;
  }
}

/* Devuelve el nombre de una variable de player o npc */
function getVarName(project: Project, kind: "players" | "npcs", entityId: ID, varId: ID): string | null {
  const entity = kind === "players"
      ? project.players.find((player) => player.id === entityId)
      : project.npcs.find((npc) => npc.id === entityId);

  if (!entity) return null;

  return entity.vars?.find((variable) => variable.id === varId)?.name ?? null;
}

function getMap(project: Project, mapId: ID): WorldMap | null {
  return project.maps.find((map) => map.id === mapId) ?? null;
}

function getMapRegionName(project: Project, mapId: ID, regionId: ID): string | null {
  const map = getMap(project, mapId);
  if (!map) return null;

  return map.regions.find((region) => region.id === regionId)?.label ?? null;
}

/* Resuelve un token concreto a su texto visible */
function resolveSingleToken(raw: string, project: Project | null): string | null {
  if (!project) return null;

  const parsed = parseTextToken(raw);
  if (!parsed) return null;

  switch (parsed.prop) {
    case "name": return getEntityName(project, parsed.kind, parsed.entityId);

    case "vars": return getVarName(project, parsed.kind, parsed.entityId, parsed.varId);

    case "regions": return getMapRegionName(project, parsed.entityId, parsed.regionId);
  }
}

/* Convierte un texto con tokens en una lista de partes renderizables */
export function resolveTextTokensToParts(input: string, project: Project | null): ResolvedTokenPart[] {
  if (!input) return [{ type: "text", value: "" }];

  const tokens = findTextTokens(input);
  if (!tokens.length) return [{ type: "text", value: input }];

  const parts: ResolvedTokenPart[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor) parts.push({ type: "text", value: input.slice(cursor, token.start) });

    parts.push({ type: "token", raw: token.raw, resolvedText: resolveSingleToken(token.raw, project) });

    cursor = token.end;
  }

  if (cursor < input.length) parts.push({ type: "text", value: input.slice(cursor) });

  return parts;
}

export function countBrokenTokens(parts: ResolvedTokenPart[]): number {
  return parts.reduce((count, part) => {
    if (part.type === "token" && !part.resolvedText) return count + 1;
    return count;
  }, 0);
}

type ResolvedTextRendererProps = {
  parts: ResolvedTokenPart[];
  emptyText?: string;
  wrapperClassName?: string;
  textClassName?: string;
  resolvedTokenClassName?: string;
  brokenTokenClassName?: string;
  brokenTokenTitle?: string;
};

export function ResolvedTextRenderer({ parts, emptyText = "No hay texto.", wrapperClassName = "text-slate-100 text-sm whitespace-pre-wrap break-words",
  textClassName, resolvedTokenClassName = "px-1 py-0.5 rounded bg-slate-900/70 border border-slate-700 text-fuchsia-100 font-mono text-[12px]",
  brokenTokenClassName = "px-1 py-0.5 rounded bg-rose-950/30 text-rose-200 border border-rose-500/30 font-mono text-[12px]",
  brokenTokenTitle = "Referencia rota" }: ResolvedTextRendererProps) {
  const hasVisibleContent = parts.some((part) => {
    if (part.type === "text") return part.value.length > 0;
    return true;
  });

  if (!hasVisibleContent) return <p className="text-slate-500 text-xs text-center">{emptyText}</p>;

  return (
    <p className={wrapperClassName}>
      {parts.map((part, index) => {
        if (part.type === "text") {
          return (<span key={index} className={textClassName}>{part.value}</span>);
        }

        if (!part.resolvedText) {
          return (<span key={index} className={brokenTokenClassName} title={brokenTokenTitle}>⟦{part.raw}⟧</span>);
        }

        return (<span key={index} className={resolvedTokenClassName} title={part.raw}>{part.resolvedText}</span>);
      })}
    </p>
  );
}