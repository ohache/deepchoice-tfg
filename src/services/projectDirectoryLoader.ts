import type { Project } from "@/domain/types";

export interface LoadedProjectFromDirectory {
  project: Project;
  files: File[];
}

/* Carga un proyecto desde una carpeta seleccionada */
export async function loadProjectFromDirectory(fileList: FileList | File[]): Promise<LoadedProjectFromDirectory> {
  const files = Array.from(fileList);

  const projectFile = files.find((file) => file.name.toLowerCase().endsWith(".json"));

  if (!projectFile) throw new Error("No se ha encontrado ningún archivo en la carpeta seleccionada.");

  const text = await projectFile.text();

  let project: Project;
  try {
    project = JSON.parse(text) as Project;
  } catch (error) {
    console.error("Error al parsear project.json", error);
    throw new Error("project.json no tiene un formato JSON válido.");
  }

  return { project, files };
}
