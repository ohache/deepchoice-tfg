import type { Project } from "@/domain/types";
import { ProjectSchema } from "@/validation/projectSchemas";

interface LoadedProjectFromDirectory {
  project: Project;
  files: File[];
}

type IssueLike = {
  path?: readonly PropertyKey[];
  message: string;
}

/* Formatea los errores de Zod de forma legible */
function formatZodIssues(issues: readonly IssueLike[]): string {
  const lines = issues.slice(0, 20).map((issue) => {
    const pathString = issue.path?.length ? issue.path
      .map((segment) => (typeof segment === "string" || typeof segment === "number" ? segment : String(segment)))
      .join(".")
      : "project";

    return `- ${pathString}: ${issue.message}`;
  });

  const more = issues.length > 20 ? `\n... (${issues.length - 20} más)` : "";
  return lines.join("\n") + more;
}

/* Carga un proyecto desde una carpeta seleccionada */
export async function loadProjectFromDirectory(fileList: FileList | File[]): Promise<LoadedProjectFromDirectory> {
  const directoryFiles = Array.from(fileList);

  const projectJsonFile = directoryFiles.find((file) => file.name.toLowerCase().endsWith(".json"));

  if (!projectJsonFile) throw new Error("No se ha encontrado ningún archivo .json en la carpeta seleccionada.");

  const jsonText = await projectJsonFile.text();

  let rawProject: unknown;

  try { rawProject = JSON.parse(jsonText); }
  catch { throw new Error("El archivo .json no tiene un formato JSON válido."); }

  const validationResult = ProjectSchema.safeParse(rawProject);

  if (!validationResult.success) throw new Error("El proyecto no cumple el esquema:\n" + formatZodIssues(validationResult.error.issues));

  return { project: validationResult.data, files: directoryFiles };
}