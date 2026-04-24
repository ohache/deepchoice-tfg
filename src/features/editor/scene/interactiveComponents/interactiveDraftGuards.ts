import { toast } from "@/shared/toast/toastStore";

type EditorMode =
  | { type: "idle" }
  | { type: "drawing" }
  | { type: "editing";[key: string]: unknown };

type CommitResult =
  | { ok: true;[key: string]: unknown }
  | { ok: false; code?: string; error?: string };

type InteractiveDraftGuardArgs = {
  hotspotEditorMode: EditorMode;
  placedItemEditorMode: EditorMode;
  placedNpcEditorMode: EditorMode;
  placedPlayerEditorMode: EditorMode;

  hasHotspotDraft: boolean;
  hasPlacedItemDraft: boolean;
  hasPlacedNpcDraft: boolean;
  hasPlacedPlayerDraft: boolean;

  commitHotspotDraft: () => CommitResult;
  commitPlacedItemDraft: () => CommitResult;
  commitPlacedNpcDraft: () => CommitResult;
  commitPlacedPlayerDraft: () => CommitResult;
};

type GuardEntry = {
  title: string;
  noun: string;
  mode: EditorMode;
  hasDraft: boolean;
  commit: () => CommitResult;
};

function shouldCommit(mode: EditorMode, hasDraft: boolean): boolean {
  return mode.type !== "idle" && hasDraft;
}

function handleCommitFailure(title: string, noun: string, result: CommitResult): boolean {
  if (result.ok) return true;

  if (result.code === "missing_draft") return true;

  toast.error(title, result.error ?? `Revisa el ${noun} antes de continuar.`);
  return false;
}

/* Intenta consolidar cualquier draft interactivo abierto */
export function commitActiveInteractiveDrafts(args: InteractiveDraftGuardArgs): boolean {
  const entries: GuardEntry[] = [
    {
      title: "Hotspot incompleto",
      noun: "hotspot",
      mode: args.hotspotEditorMode,
      hasDraft: args.hasHotspotDraft,
      commit: args.commitHotspotDraft,
    },
    {
      title: "Item incompleto",
      noun: "item",
      mode: args.placedItemEditorMode,
      hasDraft: args.hasPlacedItemDraft,
      commit: args.commitPlacedItemDraft,
    },
    {
      title: "NPC incompleto",
      noun: "NPC",
      mode: args.placedNpcEditorMode,
      hasDraft: args.hasPlacedNpcDraft,
      commit: args.commitPlacedNpcDraft,
    },
    {
      title: "Player incompleto",
      noun: "player",
      mode: args.placedPlayerEditorMode,
      hasDraft: args.hasPlacedPlayerDraft,
      commit: args.commitPlacedPlayerDraft,
    },
  ];

  for (const entry of entries) {
    if (!shouldCommit(entry.mode, entry.hasDraft)) continue;

    const result = entry.commit();
    if (!handleCommitFailure(entry.title, entry.noun, result)) return false;
  }

  return true;
}