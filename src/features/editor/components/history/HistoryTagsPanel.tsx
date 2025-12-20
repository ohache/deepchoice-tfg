import { useCallback } from "react";
import { useEditorStore } from "@/store/editorStore";
import type { ID } from "@/domain/types";

type TagColumnProps = {
    title: string;
    items: { id: ID; label: string }[];
    emptyMessage: string;
    onDoubleClick: (id: ID) => void;
    headerClassName?: string;
};

function TagColumn({ title, items, emptyMessage, onDoubleClick, headerClassName }: TagColumnProps) {
    return (
        <div className="flex flex-col border-2 border-black rounded-lg bg-slate-900/70 overflow-hidden">
            <div className={"px-3 py-2 border-b-2 border-black " + (headerClassName ?? "bg-slate-900/90")}>
                <h3 className="text-[15px] font-semibold text-slate-100 text-center tracking-wide">
                    {title}
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto text-[13px]">
                {items.length === 0 ? (
                    <p className="p-3 text-[12px] text-slate-300 text-center">{emptyMessage}</p>
                ) : (
                    <ul className="border-t border-black">
                        {items.map((item) => (
                            <li
                                key={item.id}
                                className="border-b-2 border-black last:border-b-0"
                            >
                                <button
                                    type="button"
                                    onDoubleClick={() => onDoubleClick(item.id)}
                                    className="w-full text-left px-5 py-2.5 text-slate-100 hover:bg-cyan-900/30"
                                    title={item.label}
                                >
                                    <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                                        {item.label}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>

                )}
            </div>
        </div>
    );
}

export function HistoryTagsPanel() {
    const project = useEditorStore((s) => s.project);
    const setPrimaryMode = useEditorStore((s) => s.setPrimaryMode);
    const setSecondaryMode = useEditorStore((s) => s.setSecondaryMode);

    const setSelectedMusicTrackId = useEditorStore((s) => s.setSelectedMusicTrackId);

    const handleMusicDoubleClick = useCallback(
        (id: ID) => {
            setSelectedMusicTrackId(id);
            setPrimaryMode("historia");
            setSecondaryMode("musica");
        },
        [setPrimaryMode, setSecondaryMode, setSelectedMusicTrackId]
    );

    const handleMapDoubleClick = useCallback(
        (id: ID) => {
            setPrimaryMode("historia");
            setSecondaryMode("mapas" as any);
            console.log("Ir a editar mapa con id:", id);
        },
        [setPrimaryMode, setSecondaryMode]
    );

    const handleNpcDoubleClick = useCallback(
        (id: ID) => {
            setPrimaryMode("historia");
            setSecondaryMode("pnjs" as any);
            console.log("Ir a editar PNJ con id:", id);
        },
        [setPrimaryMode, setSecondaryMode]
    );

    const handleItemDoubleClick = useCallback(
        (id: ID) => {
            setPrimaryMode("historia");
            setSecondaryMode("items" as any);
            console.log("Ir a editar ítem con id:", id);
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

    const mapItems = project.maps?.map((m) => ({ id: m.id, label: m.name })) ?? [];
    const npcItems = project.npcs?.map((n) => ({ id: n.id, label: n.name })) ?? [];
    const itemItems = project.items?.map((it) => ({ id: it.id, label: it.name })) ?? [];
    const musicItems = project.musicTracks?.map((mt) => ({ id: mt.id, label: mt.name })) ?? [];

    return (
        <div className="max-w-[1200px] mx-auto rounded-xl border border-slate-800 bg-slate-800 p-4 space-y-3">
            <header className="mb-1">
                <p className="text-[14px] text-white text-center mb-3">
                    Haz doble clic sobre un recurso para ir a su editor correspondiente
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <TagColumn
                    title="Mapas"
                    headerClassName="bg-emerald-900/80"
                    items={mapItems}
                    emptyMessage="No hay mapas creados"
                    onDoubleClick={handleMapDoubleClick}
                />

                <TagColumn
                    title="PNJ"
                    headerClassName="bg-purple-900/80"
                    items={npcItems}
                    emptyMessage="No hay personajes creados"
                    onDoubleClick={handleNpcDoubleClick}
                />

                <TagColumn
                    title="Ítems"
                    headerClassName="bg-orange-950"
                    items={itemItems}
                    emptyMessage="No hay ítems creados"
                    onDoubleClick={handleItemDoubleClick}
                />

                <TagColumn
                    title="Música"
                    headerClassName="bg-cyan-900"
                    items={musicItems}
                    emptyMessage="No hay pistas de música creadas"
                    onDoubleClick={handleMusicDoubleClick}
                />
            </div>
        </div>
    );
}
