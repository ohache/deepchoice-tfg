import { useMemo } from "react";
import type { ID, MusicTrackDef } from "@/domain/types";
import { useEditorStore } from "@/store/editorStore";
import { ToggleFieldBlock } from "@/features/editor/scene/SceneFieldBlocks";
import { Select, type Option } from "@/components/Select";

type SceneMusicFieldProps = {
  label?: string;
  active: boolean;
  onToggle: () => void;
  layerId?: ID;
};

export function SceneMusicField({ label = "Música", active, onToggle, layerId }: SceneMusicFieldProps) {
  const project = useEditorStore((s) => s.project);
  const nodeDraft = useEditorStore((s) => s.nodeDraft);
  const setLayerMusicTrackId = useEditorStore((s) => s.setLayerMusicTrackId);
  const setNodeMusicTrackId = useEditorStore((s) => s.setNodeMusicTrackId);

  const musicTracks = useMemo<MusicTrackDef[]>(() => project?.musicTracks ?? [], [project?.musicTracks]);

  const trackOptions = useMemo<Option<ID>[]>(() =>
    musicTracks.map((track) => ({ id: track.id, label: track.name?.trim() || track.id })), [musicTracks]
  );

  const editingLayer = useMemo(() =>
    layerId ? (nodeDraft?.layers ?? []).find((layer) => layer.id === layerId) ?? null : null,
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
          <div className="text-[13px] text-white text-center mb-2">
            Pista asociada
          </div>

          <Select<ID>
            value={selectedTrackId}
            onChange={(value) => handleChange(String(value ?? ""))}
            options={trackOptions}
            placeholder="— Sin música —"
            className="w-full"
          />

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