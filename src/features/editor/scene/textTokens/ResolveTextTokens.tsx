import type { ID, Project } from "@/domain/types";
import { findTextTokens, parseTextToken } from "@/features/editor/scene/textTokens/tokenFormat";

export type ResolvedTokenPart =
  | { type: "text"; value: string }
  | { type: "token"; raw: string; resolvedText: string | null };

function getEntityName(project: Project, kind: "players" | "npcs" | "items" | "maps" | "music", id: ID): string | null {
  switch (kind) {
    case "players":
      return project.players?.find((x) => x.id === id)?.name ?? null;

    case "npcs":
      return project.npcs?.find((x) => x.id === id)?.name ?? null;

    case "items":
      return project.items?.find((x) => x.id === id)?.name ?? null;

    case "maps":
      return project.maps?.find((x) => x.id === id)?.name ?? null;

    case "music":
      return project.musicTracks?.find((x) => x.id === id)?.name ?? null;

    default:
      return null;
  }
}

function getVarValueText(project: Project,  kind: "players" | "npcs", entityId: ID, varId: ID): string | null {
  const entity = kind === "players"
      ? project.players?.find((p) => p.id === entityId)
      : project.npcs?.find((n) => n.id === entityId);

  if (!entity) return null;

  const v = entity.vars?.find((vv) => vv.id === varId);
  return v?.name ?? null;
}

function resolveSingleToken(raw: string, project: Project | null): string | null {
  if (!project) return null;

  const parsed = parseTextToken(raw);
  if (!parsed) return null;

  if (parsed.prop === "name") return getEntityName(project, parsed.kind, parsed.entityId);

  return getVarValueText(project, parsed.kind, parsed.entityId, parsed.varId);
}

export function resolveTextTokensToParts(input: string, project: Project | null): ResolvedTokenPart[] {
  if (!input) return [{ type: "text", value: "" }];

  const tokens = findTextTokens(input);
  if (!tokens.length) return [{ type: "text", value: input }];

  const out: ResolvedTokenPart[] = [];
  let cursor = 0;

  for (const token of tokens) {
    if (token.start > cursor)  out.push({ type: "text", value: input.slice(cursor, token.start)});

    out.push({ type: "token", raw: token.raw, resolvedText: resolveSingleToken(token.raw, project)});

    cursor = token.end;
  }

  if (cursor < input.length) out.push({ type: "text", value: input.slice(cursor)});
  
  return out;
}

export function countBrokenTokens(parts: ResolvedTokenPart[]): number {
  return parts.reduce((acc, part) => (part.type === "token" && !part.resolvedText ? acc + 1 : acc), 0);
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

export function ResolvedTextRenderer({ parts, emptyText = "No hay texto.", wrapperClassName = "text-slate-100 text-sm whitespace-pre-wrap wrap-break-word",
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
      {parts.map((part, idx) => {
        if (part.type === "text") {
          return <span key={idx} className={textClassName}>{part.value}</span>;
        }

        if (!part.resolvedText) {
          return (
            <span
              key={idx}
              className={brokenTokenClassName}
              title={brokenTokenTitle}
            >
              ⟦{part.raw}⟧
            </span>
          );
        }

        return (
          <span
            key={idx}
            className={resolvedTokenClassName}
            title={part.raw}
          >
            {part.resolvedText}
          </span>
        );
      })}
    </p>
  );
}