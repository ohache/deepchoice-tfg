import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TopBar } from "@/features/editor/components/layout/TopBar";
import { BottomBar } from "@/features/editor/components/layout/BottomBar";
import { EditorLayout } from "@/features/editor/components/layout/EditorLayout";
import { useEditorStore } from "@/store/editorStore";

interface EditorLocationState {
    title?: string;
}

export function EditorShell() {
    const location = useLocation();
    const navigate = useNavigate();

    const project = useEditorStore((s) => s.project);
    const initNewProject = useEditorStore((s) => s.initNewProject);

    useEffect(() => {
        const state = location.state as EditorLocationState | null;
        const incomingTitle = state?.title?.trim();

        if (!project) {
            if (incomingTitle) {
                initNewProject(incomingTitle);
            } else {
                navigate("/");
            }
        }
    }, [project, location.state, initNewProject, navigate]);

    /*useEffect(() => {
        const stopAutosave = startProjectAutosave(() => {
                const { project, isDirty } = useEditorStore.getState();
                return { project, isDirty };
            },
            { intervalMs: 5000 }
        );

        return () => {stopAutosave();};
    }, []);*/

    const handlePlayRequested = () => {
        // Validar proyecto del editorStore - Exportar y pasar al gameStore - Navegar a /play
        // Si errores, mostrar modal
        alert("Acción Jugar pendiente de implementar 🙂");
    };

    if (!project) return null;

    return (
        <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
            <TopBar onPlayRequested={handlePlayRequested} />

            <BottomBar />

            <EditorLayout />
        </div>
    );
}