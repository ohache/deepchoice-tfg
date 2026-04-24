import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

type TagColumnProps = {
  title: string;
  items: { id: ID; label: string }[];
  emptyMessage: string;
  onActivate: (id: ID) => void;
  headerClassName?: string;
};

function TagColumn({ title, items, emptyMessage, onActivate, headerClassName }: TagColumnProps) {
  return (
    <div className="flex flex-col border-2 border-black rounded-lg bg-slate-950 overflow-hidden">
  <div className={"px-3 py-2 border-b-2 border-slate-700 " + (headerClassName ?? "bg-slate-950")}>
    <h3 className="text-[15px] font-semibold text-white text-center tracking-wide">
      {title}
    </h3>
  </div>

  {items.length === 0 ? (
    <p className="p-3 text-[12px] text-slate-100 text-center">{emptyMessage}</p>
  ) : (
    <div className="text-[14px] border-l-2 border-r-2 border-b-2 border-slate-700 rounded-b-lg max-h-[500px] overflow-y-auto">
      <ul>
        {items.map((item) => (
          <li key={item.id} className="border-b-2 border-slate-700 last:border-b-0">
            <button
              type="button"
              onClick={() => onActivate(item.id)}
              className="w-full text-left px-4 py-2.5  text-white font-bold hover:bg-cyan-900/70"
              title={item.label}
            >
              <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )}
</div>
  );
}

function toTagItems<T extends { id: ID; name: string }>(list?: T[]) {
  return list?.map((item) => ({ id: item.id, label: item.name })) ?? [];
}

export function HistoryTagsPanel() {
  const project = useEditorStore((s) => s.project);

  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const setSelectedPlayerId = useEditorStore((s) => s.setSelectedPlayerId);
  const setSelectedNpcId = useEditorStore((s) => s.setSelectedNpcId);
  const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);
  const setSelectedMusicTrackId = useEditorStore((s) => s.setSelectedMusicTrackId);
  const setSelectedSfxId = useEditorStore((s) => s.setSelectedSfxId);
  const setSelectedMapId = useEditorStore((s) => s.setSelectedMapId);

const openHistoryResource = useCallback(( secondaryMode: "jugador" | "pnjs" | "items" | "musica" | "sfx" | "mapa",
    selectResource: () => void) => {
    setPrimaryMode("historia");
    setSecondaryMode(secondaryMode);

    requestAnimationFrame(() => selectResource());
  }, [setPrimaryMode, setSecondaryMode],
);

  const handlePlayerActivate = useCallback((id: ID) => {
    openHistoryResource("jugador", () => {setSelectedPlayerId(id)});
  }, [openHistoryResource, setSelectedPlayerId],
);

const handleNpcActivate = useCallback((id: ID) => {
    openHistoryResource("pnjs", () => {setSelectedNpcId(id)});
  }, [openHistoryResource, setSelectedNpcId],
);

const handleItemActivate = useCallback((id: ID) => {
    openHistoryResource("items", () => {setSelectedItemId(id)});
  }, [openHistoryResource, setSelectedItemId],
);

const handleMusicActivate = useCallback((id: ID) => {
    openHistoryResource("musica", () => {setSelectedMusicTrackId(id)});
  }, [openHistoryResource, setSelectedMusicTrackId],
);

const handleSfxActivate = useCallback((id: ID) => {
    openHistoryResource("sfx", () => {setSelectedSfxId(id)});
  }, [openHistoryResource, setSelectedSfxId],
);

const handleMapActivate = useCallback((id: ID) => {
    openHistoryResource("mapa", () => {setSelectedMapId(id)});
  }, [openHistoryResource, setSelectedMapId],
);

  const playerItems = useMemo(() => toTagItems(project?.players), [project?.players]);
  const npcItems = useMemo(() => toTagItems(project?.npcs), [project?.npcs]);
  const itemItems = useMemo(() => toTagItems(project?.items), [project?.items]);
  const musicItems = useMemo(() => toTagItems(project?.musicTracks), [project?.musicTracks]);
  const sfxItems = useMemo(() => toTagItems(project?.soundEffects), [project?.soundEffects]);
  const mapItems = useMemo(() => toTagItems(project?.maps), [project?.maps]);

  if (!project) {
    return (
      <div className="max-w-[900px] mx-auto rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p className="text-sm text-slate-300 text-center">
          Abre o crea un proyecto para ver sus etiquetas.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[1500px] mx-auto rounded-xl border-3 border-slate-700 bg-slate-900 p-4 space-y-3 h-[560px] overflow-hidden">
      <header className="mb-1">
        <p className="text-[16px] text-white text-center mb-3">
          Haz clic sobre un recurso para abrirlo en su editor correspondiente
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-start">
        <TagColumn
          title="Jugador"
          headerClassName="bg-emerald-800"
          items={playerItems}
          emptyMessage="No hay personajes creados"
          onActivate={handlePlayerActivate}
        />

        <TagColumn
          title="PNJ"
          headerClassName="bg-lime-800"
          items={npcItems}
          emptyMessage="No hay personajes creados"
          onActivate={handleNpcActivate}
        />

        <TagColumn
          title="Ítems"
          headerClassName="bg-red-800"
          items={itemItems}
          emptyMessage="No hay ítems creados"
          onActivate={handleItemActivate}
        />

        <TagColumn
          title="Música"
          headerClassName="bg-cyan-800"
          items={musicItems}
          emptyMessage="No hay pistas de música creadas"
          onActivate={handleMusicActivate}
        />

        <TagColumn
          title="Sfx"
          headerClassName="bg-indigo-800"
          items={sfxItems}
          emptyMessage="No hay efectos de sonido creados"
          onActivate={handleSfxActivate}
        />

        <TagColumn
          title="Mapas"
          headerClassName="bg-amber-800"
          items={mapItems}
          emptyMessage="No hay mapas creados"
          onActivate={handleMapActivate}
        />
      </div>
    </div>
  );
}