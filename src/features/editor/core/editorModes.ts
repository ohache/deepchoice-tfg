export type EditorPrimaryMode = "historia" | "escena" | "test";

export type HistoriaSecondaryMode =
    | "vista"
    | "jugador"
    | "mapa"
    | "pnjs"
    | "items"
    | "musica"
    | "dialogos"
    | "etiquetas";

export type EscenaSecondaryMode = "crear" | "buscar" | "listar";

export type TestSecondaryMode = "historia" | "nodo";

export type EditorSecondaryMode =
    | HistoriaSecondaryMode
    | EscenaSecondaryMode
    | TestSecondaryMode;

export function getDefaultSecondaryMode(
    primary: EditorPrimaryMode
): EditorSecondaryMode {
    switch (primary) {
        case "historia":
            return "vista";
        case "escena":
            return "crear";
        case "test":
            return "historia";
    }
}
