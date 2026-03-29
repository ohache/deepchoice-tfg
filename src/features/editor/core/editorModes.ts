export const PRIMARY = {
    historia: { label: "Historia", defaultSecondary: "vista"},
    escena: { label: "Escena", defaultSecondary: "crear"},
    test: { label: "Test", defaultSecondary: "historia"},
} as const;

export type EditorPrimaryMode = keyof typeof PRIMARY;

export type HistoriaSecondaryMode = | "vista" | "jugador" | "pnjs" | "items" | "musica" | "sfx" | "mapa" | "recursos";
export type EscenaSecondaryMode = "crear" | "buscar";
export type TestSecondaryMode = "historia" | "escena";

export type EditorSecondaryMode = HistoriaSecondaryMode | EscenaSecondaryMode | TestSecondaryMode;

export const PRIMARY_TABS = (Object.keys(PRIMARY) as EditorPrimaryMode[]).map((id) => ({
  id, label: PRIMARY[id].label }));

export function getDefaultSecondaryMode(primary: EditorPrimaryMode) {
  return PRIMARY[primary].defaultSecondary;
}