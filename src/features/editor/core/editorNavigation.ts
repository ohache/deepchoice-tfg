export const PRIMARY = {
  historia: {
    label: "Historia",
    secondary: [
      { id: "vista", label: "Vista" },
      { id: "jugador", label: "Jugador" },
      { id: "pnj", label: "PNJ" },
      { id: "objeto", label: "Objeto" },
      { id: "musica", label: "Música" },
      { id: "sfx", label: "Efectos de sonido" },
      { id: "mapa", label: "Mapa" },
      { id: "recursos", label: "Recursos" },
    ],
    defaultSecondary: "vista",
  },
  escena: {
    label: "Escena",
    secondary: [
      { id: "crear", label: "Crear" },
      { id: "buscar", label: "Buscar" },
      { id: "test", label: "Test" },
    ],
    defaultSecondary: "crear",
  },
} as const;

/* Types derivados automáticamente */
export type EditorPrimaryMode = keyof typeof PRIMARY;

type SecondaryByPrimary = {
  [K in EditorPrimaryMode]: (typeof PRIMARY)[K]["secondary"][number]["id"];
};

export type EditorSecondaryMode = SecondaryByPrimary[EditorPrimaryMode];

/* UI helpers */
export const PRIMARY_TABS = (Object.keys(PRIMARY) as EditorPrimaryMode[]).map((id) => ({ id, label: PRIMARY[id].label }));

export type SecondaryTab = {
  id: EditorSecondaryMode;
  label: string;
  title?: string;
  disabled?: boolean;
};

export type SecondaryTabCounts = {
  nodeCount: number;
  playersCount: number;
  npcsCount: number;
  itemsCount: number;
  musicCount: number;
  sfxCount: number;
  mapCount: number;
};

export function buildSecondaryTabs(primaryMode: EditorPrimaryMode, nodeMode: "creating" | "editing", counts: SecondaryTabCounts, canOpenSceneTest: boolean): SecondaryTab[] {
  switch (primaryMode) {
    case "historia":
      return PRIMARY.historia.secondary.map((tab) => {
        switch (tab.id) {
          case "vista":
            return { ...tab, title: `Nodos: ${counts.nodeCount}` };
          case "jugador":
            return { ...tab, title: `Jugadores: ${counts.playersCount}` };
          case "pnj":
            return { ...tab, title: `PNJs: ${counts.npcsCount}` };
          case "objeto":
            return { ...tab, title: `Objetos: ${counts.itemsCount}` };
          case "musica":
            return { ...tab, title: `Música: ${counts.musicCount}` };
          case "sfx":
            return { ...tab, title: `Sfx: ${counts.sfxCount}` };
          case "mapa":
            return { ...tab, title: `Mapas: ${counts.mapCount}` };
          case "recursos":
            return tab;
          default: {
            return tab;
          }
        }
      });

    case "escena":
      return PRIMARY.escena.secondary.map((tab) => {
        switch (tab.id) {
          case "crear":
            return { ...tab, label: nodeMode === "editing" ? "Editar" : tab.label };
          case "buscar":
            return tab;
          case "test":
            return {
              ...tab,
              disabled: !canOpenSceneTest,
              title: canOpenSceneTest ? "Probar la escena" : "Guarda la escena para poder abrir Test",
            };
          default: {
           return tab;
          }
        }
      });

    default: {
      const exhaustive: never = primaryMode;
      return exhaustive;
    }
  }
}

export function getDefaultSecondaryMode(primary: EditorPrimaryMode): SecondaryByPrimary[EditorPrimaryMode] {
  return PRIMARY[primary].defaultSecondary;
}