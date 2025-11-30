import type { Project } from "@/domain/types";

const STORAGE_PREFIX = "deepchoice:project:";

export function saveProjectToLocalStorage(project: Project): void {
  try {
    const key = STORAGE_PREFIX + project.id;
    const data = JSON.stringify(project);
    localStorage.setItem(key, data);
  } catch (error) {
    console.error("Error al guardar el proyecto en localStorage:", error);
    throw new Error("No se ha podido guardar la aventura en este navegador.");
  }
}

export function loadProjectFromLocalStorage(id: string): Project | null {
  try {
    const key = STORAGE_PREFIX + id;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch (error) {
    console.error("Error al cargar el proyecto desde localStorage:", error);
    return null;
  }
}

export function exportProjectAsFile(project: Project): void {
  try {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.id || "aventura"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al exportar el proyecto a archivo:", error);
    throw new Error("No se ha podido exportar la aventura a JSON.");
  }
}
