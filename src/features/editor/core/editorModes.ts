export const PRIMARY = {
  historia: {
    label: "Historia",
    secondary: {
      vista: "Vista",
      jugador: "Jugador",
      pnjs: "PNJs",
      items: "Items",
      musica: "Música",
      sfx: "SFX",
      mapa: "Mapa",
      recursos: "Recursos",
    },
    defaultSecondary: "vista",
  },
  escena: {
    label: "Escena",
    secondary: {
      crear: "Crear",
      buscar: "Buscar",
      test: "Test",
    },
    defaultSecondary: "crear",
  },
} as const;

/* Types derivados automáticamente */
export type EditorPrimaryMode = keyof typeof PRIMARY;

/* Secondary por primary */
type SecondaryByPrimary = {
  [K in EditorPrimaryMode]: keyof typeof PRIMARY[K]["secondary"];
};

/* Unión global */
export type EditorSecondaryMode = SecondaryByPrimary[EditorPrimaryMode];

/* UI helpers */
export const PRIMARY_TABS = (Object.keys(PRIMARY) as EditorPrimaryMode[]).map((id) => ({ id, label: PRIMARY[id].label }));

export function getSecondaryTabs(primary: EditorPrimaryMode) {
  const secondary = PRIMARY[primary].secondary;

  return (Object.keys(secondary) as Array<keyof typeof secondary>).map((id) => ({ id, label: secondary[id] }));
}

export function getDefaultSecondaryMode(primary: EditorPrimaryMode): SecondaryByPrimary[EditorPrimaryMode] {
  return PRIMARY[primary].defaultSecondary;
}