import { useMemo } from "react";
import type { ID, MusicTrackDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";

type SceneMusicFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId?: ID;
};

export function SceneMusicField({ label = "Música", active, onToggle, layerId }: SceneMusicFieldProps) {
  const project = useEditorStore((s) => s.project ?? null);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);
  const setLayerMusicTrackId = useEditorStore((s) => s.setLayerMusicTrackId);
  const setNodeMusicTrackId = useEditorStore((s) => s.setNodeMusicTrackId);

  const musicTracks = useMemo<MusicTrackDef[]>(
    () => project?.musicTracks ?? [],
    [project?.musicTracks]
  );

    const editingLayer = useMemo(
    () => (layerId ? (nodeDraft?.layers ?? []).find((layer) => layer.id === layerId) ?? null : null),
    [nodeDraft?.layers, layerId]
  );

  const selectedTrackId = layerId
    ? (editingLayer?.musicTrackId ?? "")
    : (nodeDraft?.musicTrackId ?? "");

    const handleChange = (nextTrackId: string) => {
    const nextMusicTrackId = nextTrackId || undefined;

    if (layerId) {
      setLayerMusicTrackId(nextMusicTrackId);
      return;
    }

    setNodeMusicTrackId(nextMusicTrackId);
  };

  return (
    <ToggleFieldBlock label={label} active={active} onToggle={onToggle}>
      <div className="space-y-3">
        <div className="bg-slate-950/30 px-2 py-2">
          <div className="text-xs text-slate-300 text-center mb-2">
            Pista asociada
          </div>

          <select
            value={selectedTrackId}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-md bg-slate-900 border-2 border-slate-700 px-2 py-2 text-xs text-slate-100 focus:outline-none focus:border-transparent focus:ring-2 focus:ring-fuchsia-500"
          >
            <option value="">— Sin música —</option>
            {musicTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>

          {!musicTracks.length ? (
            <div className="mt-2 text-[11px] text-slate-400 text-center">
              No hay pistas de música creadas en el proyecto.
            </div>
          ) : null}

          {selectedTrackId ? (
            <div className="mt-3 rounded-md border border-emerald-500/40 bg-emerald-950/20 px-2 py-2 text-[11px] text-emerald-100 text-center">
              {layerId
                ? "Esta música sonará en lugar de la asociada a la región y a la escena, si las hubiera."
                : "Esta música sobreescribirá a la música asociada a la región, si la hubiera."}
            </div>
          ) : null}
        </div>
      </div>
    </ToggleFieldBlock>
  );
}