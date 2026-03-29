import { useCallback } from "react";
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
    <div className="flex flex-col border-2 border-black rounded-lg bg-slate-900/70 overflow-hidden">
      <div className={"px-3 py-2 border-b-2 border-black " + (headerClassName ?? "bg-slate-900/90")}>
        <h3 className="text-[15px] font-semibold text-slate-100 text-center tracking-wide">
          {title}
        </h3>
      </div>

      {items.length === 0 ? (
        <p className="p-3 text-[12px] text-slate-300 text-center">{emptyMessage}</p>
      ) : (
        <div className="text-[13px] max-h-[500px] overflow-y-auto">
          <ul>
            {items.map((item) => (
              <li key={item.id} className="border-b border-black last:border-b-0">
                <button
                  type="button"
                  onClick={() => onActivate(item.id)}
                  className="w-full text-left px-5 py-2.5 text-white font-bold hover:bg-cyan-900/70"
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

export function HistoryTagsPanel() {
  const project = useEditorStore((s) => s.project);

  const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
  const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

  const setSelectedMusicTrackId = useEditorStore((s) => s.setSelectedMusicTrackId);
  const setSelectedSfxId = useEditorStore((s) => s.setSelectedSfxId);
  const setSelectedItemId = useEditorStore((s) => s.setSelectedItemId);

  const handlePlayerActivate = useCallback(
    (id: ID) => {
      setPrimaryMode("historia");
      setSecondaryMode("jugador");
      void id;
    },
    [setPrimaryMode, setSecondaryMode]
  );


  const handleNpcActivate = useCallback(
    (id: ID) => {
      setPrimaryMode("historia");
      setSecondaryMode("pnjs");
      void id;
    },
    [setPrimaryMode, setSecondaryMode]
  );

  const handleItemActivate = useCallback(
    (id: ID) => {
      setSelectedItemId(id);
      setPrimaryMode("historia");
      setSecondaryMode("items");
    },
    [setPrimaryMode, setSecondaryMode, setSelectedItemId]
  );

  const handleMusicActivate = useCallback(
    (id: ID) => {
      setSelectedMusicTrackId(id);
      setPrimaryMode("historia");
      setSecondaryMode("musica");
    },
    [setPrimaryMode, setSecondaryMode, setSelectedMusicTrackId]
  );

  const handleSfxActivate = useCallback(
    (id: ID) => {
      setSelectedSfxId(id);
      setPrimaryMode("historia");
      setSecondaryMode("sfx");
    },
    [setPrimaryMode, setSecondaryMode, setSelectedSfxId]
  );

    const handleMapActivate = useCallback(
    (id: ID) => {
      setPrimaryMode("historia");
      setSecondaryMode("mapa");
      void id;
    },
    [setPrimaryMode, setSecondaryMode]
  );

  if (!project) {
    return (
      <div className="max-w-[900px] mx-auto rounded-xl border border-slate-800 bg-slate-800 p-4">
        <p className="text-sm text-slate-300 text-center">
          Abre o crea un proyecto para ver sus etiquetas.
        </p>
      </div>
    );
  }

  const playerItems = project.players?.map((p) => ({ id: p.id, label: p.name })) ?? [];
  const npcItems = project.npcs?.map((n) => ({ id: n.id, label: n.name })) ?? [];
  const itemItems = project.items?.map((it) => ({ id: it.id, label: it.name })) ?? [];
  const musicItems = project.musicTracks?.map((mt) => ({ id: mt.id, label: mt.name })) ?? [];
  const sfxItems = project.soundEffects?.map((se) => ({ id: se.id, label: se.name})) ?? [];
  const mapItems = project.maps?.map((m) => ({ id: m.id, label: m.name })) ?? [];

  return (
    <div className="max-w-[1500px] mx-auto rounded-xl border-2 border-slate-700 bg-slate-800 p-4 space-y-3 h-[560px] overflow-hidden">
      <header className="mb-1">
        <p className="text-[15px] text-white text-center mb-3">
          Haz clic sobre un recurso para ir a su editor correspondiente
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
