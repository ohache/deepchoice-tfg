import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import type { Hotspot } from "@/domain/types";
import { useGameStore } from "@/store/gameStore";

export function PlayerShell() {
    const navigate = useNavigate();

    const gameState = useGameStore((state) => state.gameState);
    const applyHotspot = useGameStore((state) => state.applyHotspot);
    const resetGame = useGameStore((state) => state.reset);

    if (!gameState) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 px-4">
                <p className="text-center text-slate-300">
                    No hay ninguna partida en curso.
                    <br />
                    Carga una aventura desde la pantalla de inicio.
                </p>
                <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const currentNode = useMemo(
        () => gameState.project.nodes.find((node) => node.id === gameState.currentNodeId),
        [gameState]
    );

    if (!currentNode) {
        return (
            <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 px-4">
                <p className="text-center text-red-300">
                    Error interno: no se ha encontrado el nodo actual con id{" "}
                    <span className="font-mono">{gameState.currentNodeId}</span>.
                </p>
                <button
                    type="button"
                    onClick={() => {
                        resetGame();
                        navigate("/");
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const isFinal = currentNode.isFinal === true;
    const hotspots: Hotspot[] = currentNode.hotspots ?? [];

    const handleHotspotClick = (hotspot: Hotspot) => {
        if (isFinal) return;
        applyHotspot(hotspot);
    };

    const handleExit = () => {
        resetGame();
        navigate("/");
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4">
                <div>
                    <h1 className="text-sm font-semibold text-slate-200">
                        {gameState.project.title}
                    </h1>
                    <p className="text-xs text-slate-500">
                        Nodo: <span className="font-mono">{currentNode.title}</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleExit}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                >
                    Salir
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
                <div className="max-w-2xl w-full space-y-6">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 text-base leading-relaxed whitespace-pre-line">
                        {currentNode.text || (
                            <span className="text-slate-500">
                                (Este nodo no tiene texto definido)
                            </span>
                        )}
                    </div>

                    <div className="space-y-3">
                        {isFinal ? (
                            <div className="text-center space-y-2">
                                <p className="text-sm text-emerald-300">
                                    Has llegado al final de esta aventura.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleExit}
                                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm font-semibold"
                                >
                                    Volver al inicio
                                </button>
                            </div>
                        ) : hotspots.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center">
                                No hay acciones disponibles en este nodo.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                        {hotspots.map((hotspot, index) => {
                                            const goAction = hotspot.actions.find(a => a.type === "goToNode");

                                            let label = `Opción ${index + 1}`;
                                            if (goAction) {
                                                const targetNode = gameState.project.nodes.find(
                                                    n => n.id === goAction.targetNodeId
                                                );
                                                if (targetNode) {
                                                    label = targetNode.title;
                                                }
                                            }
                                    return (
                                        <button
                                            key={hotspot.id}
                                            type="button"
                                            onClick={() => handleHotspotClick(hotspot)}
                                            className="w-full text-left px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm"
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
