import type { Project } from "@/domain/types";

export async function loadProjectFromFile(file: File): Promise<Project> {
  const text = await file.text();

  try {
    const raw = JSON.parse(text);
    return raw as Project;
  } catch (error) {
    console.error("Error al parsear el JSON del proyecto", error);
    throw new Error("El archivo JSON no tiene un formato válido.");
  }
}