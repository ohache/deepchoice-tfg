import JSZip from "jszip";
import type { Project } from "@/domain/types";

function cleanFileName(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")           
    .replace(/[^a-z0-9_-]/g, "");   
}

/* Descarga sólo el project.json actualizado */
export function downloadProjectJson(project: Project): void {
  try {
    const cleanName = cleanFileName(project.title);
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al descargar project.json:", error);
    throw new Error("No se ha podido exportar project.json.");
  }
}

/* Exporta un proyecto como ZIP */
export async function exportProjectAsZip(project: Project, assetFiles: Record<string, File>): Promise<void> {
  try {
    const zip = new JSZip();
    const cleanName = cleanFileName(project.title);

    zip.file(`${cleanName}.json`, JSON.stringify(project, null, 2));

    for (const [relativePath, file] of Object.entries(assetFiles)) {
      zip.file(relativePath, file);
    }

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `${cleanName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error al exportar el proyecto a ZIP:", error);
    throw new Error("No se ha podido exportar el proyecto a ZIP.");
  }
}
