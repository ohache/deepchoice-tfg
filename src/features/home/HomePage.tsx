import { useState, useRef, type ChangeEvent } from "react";
import { useGameStore } from "@/store/gameStore";
import { useNavigate } from "react-router-dom";
import { PlusCircleIcon, PencilSquareIcon, PlayCircleIcon } from '@heroicons/react/24/outline';
import { loadProjectFromFile } from "@/services/projectLoader";


export function HomePage() {
    const navigate = useNavigate();
    const [isManualOpen, setIsManualOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const startGame = useGameStore((state) => state.startGame);

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.toLowerCase().endsWith(".json")) {
            alert("Por favor, selecciona un archivo .json");
            event.target.value = "";
            return;
        }

        try {
            const project = await loadProjectFromFile(file);
            startGame(project)
            navigate("/play", { state: { project } });
        } catch (error: any) {
            alert(error.message ?? "No se ha podido cargar el proyecto.");
        } finally {
            event.target.value = "";
        }
    };

    const handleCreate = () => navigate("/editor");

    const handleEdit = () => {
        navigate("/editor");
    };

    const handlePlay = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
            <div className="max-w-xl w-full px-6 py-10 rounded-2xl bg-slate-800 border-4 border-slate-700">
                <div className="flex items-center justify-center mb-6">
                    <img
                        src="/logo.png"
                        alt="Logo"
                        className="h-30 w-30 rounded-2xl border-4 border-black object-contain"
                    />
                </div>

                <h1 className="text-3xl md:text-4xl font-bold text-center mb-3">
                    Bienvenido a
                    <span className="block text-fuchsia-700">
                        Crea tu propia aventura
                    </span>
                </h1>

                <p className="text-center text-slate-300 mb-6">
                    Diseña, edita y juega historias interactivas
                </p>

                <div className="flex flex-col gap-3 mb-6">
                    <button
                        type="button"
                        onClick={handleCreate}
                        className="btn-home bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700"
                    >
                        <PlusCircleIcon className="btn-icon-left" />
                    Crear</button>

                    <button
                        type="button"
                        onClick={handleEdit}
                        className="btn-home bg-sky-600 hover:bg-sky-500 active:bg-sky-700"
                    >
                        <PencilSquareIcon className="btn-icon-left" />
                    Editar</button>

                    <button
                        type="button"
                        onClick={handlePlay}
                        className="btn-home bg-amber-600 hover:bg-amber-500 active:bg-amber-700"
                    >
                        <PlayCircleIcon className="btn-icon-left" />
                    Jugar</button>
                </div>

                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() => setIsManualOpen(true)}
                        className="inline-flex items-center gap-2 text-slate-200 hover:text-slate-100 underline underline-offset-4"
                    >
                        <span>Manual de usuario</span>
                    </button>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
            />

            {isManualOpen && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <div className="max-w-lg w-full mx-4 bg-slate-900 rounded-2xl shadow-xl border border-slate-700 p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold">
                                Manual de usuario (versión inicial)
                            </h2>
                            <button
                                type="button"
                                onClick={() => setIsManualOpen(false)}
                                className="text-slate-300 hover:text-slate-100 text-sm"
                            >✕</button>
                        </div>

                        <div className="space-y-3 text-sm text-slate-200">
                            <p>
                                Aquí irá una explicación breve de cómo usar la herramienta:
                            </p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>
                                    <strong>Crear aventura</strong>: inicia una nueva historia
                                    desde cero en el editor.
                                </li>
                                <li>
                                    <strong>Editar aventura</strong>: carga y modifica una
                                    historia existente.
                                </li>
                                <li>
                                    <strong>Jugar aventura</strong>: selecciona una aventura y
                                    juégala con el motor interactivo.
                                </li>
                            </ul>
                            <p>
                                Más adelante podrás ampliar este texto, añadir ejemplos y
                                capturas, o incluso enlazar a una versión más completa del
                                manual.
                            </p>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsManualOpen(false)}
                                className="px-4 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold"
                            >Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}