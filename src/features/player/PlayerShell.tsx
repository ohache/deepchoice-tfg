import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Hotspot } from "@/domain/types";
import { useGameStore } from "@/store/gameStore";
import { isGoToNodeAction } from "@/shared/actionGuards";

function resolveImageSrc(imagePath?: string, assetUrls?: Record<string, string>) {
  if (!imagePath) return undefined;

  return assetUrls?.[imagePath] ?? imagePath;
}

export function PlayerShell() {
  const navigate = useNavigate();
  const gameState = useGameStore((state) => state.gameState);
  const applyHotspot = useGameStore((state) => state.applyHotspot);
  const resetGame = useGameStore((state) => state.reset);
  const assetUrls = useGameStore((state) => state.assetUrls);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("No se ha podido cambiar a pantalla completa", err);
    }
  };

  const openInventory = () => {
    console.log("TODO: abrir panel de inventario");
  };

  const openMap = () => {
    console.log("TODO: abrir panel de mapa");
  };

  const openSettings = () => {
    console.log("TODO: abrir panel de configuración");
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;

      const key = event.key.toLowerCase();

      if (key === "i") {
        event.preventDefault();
        openInventory();
      } else if (key === "m") {
        event.preventDefault();
        openMap();
      } else if (key === "s") {
        event.preventDefault();
        openSettings();
      } else if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      } else if (key === "escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          toggleFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!gameState) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-slate-300">
          No hay ninguna partida en curso.
          <br />
          Carga una aventura desde la pantalla de inicio.
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="btn-primary"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const currentNode = gameState.project.nodes.find(
    (node) => node.id === gameState.currentNodeId
  );

  if (!currentNode) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-red-300">
          Error interno: no se ha encontrado el nodo actual con id{" "}
          <span className="font-mono">{gameState.currentNodeId}</span>.
        </p>
        <button
          type="button"
          onClick={() => {
            resetGame();
            navigate("/");
          }}
          className="btn-primary"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const imageSrc = resolveImageSrc(currentNode.image, assetUrls);
  const isFinal = currentNode.isFinal === true;
  const hotspots = currentNode.hotspots ?? [];

  const handleHotspotClick = (hotspot: Hotspot) => {
    if (isFinal) return;
    applyHotspot(hotspot);
  };

  const handleExit = () => {
    resetGame();
    navigate("/");
  };

  return (
    <div className="game-root">
      {/* Marco principal de juego */}
      <div className="game-frame">
        {/* Botón Mapa (arriba izquierda, dentro del marco) */}
        <button
          type="button"
          onClick={openMap}
          className="absolute top-6 left-6 z-20 game-hud-icon"
        >
          <img src="/ui/map.png" alt="Mapa" className="game-hud-icon-img" />
        </button>

        {/* Botón Configuración (arriba derecha, dentro del marco) */}
        <button
          type="button"
          onClick={openSettings}
          className="absolute top-6 right-6 z-20 game-hud-icon"
        >
          <img src="/ui/settings.png" alt="Configuración" className="game-hud-icon-img" />
        </button>

        {/* Contenido */}
        <main className="game-main">
          {/* Imagen + texto */}
          <div className="game-scene-panel">
            {/* Imagen (zona superior) */}
            <div className="game-scene-image h-[85%]">
              {imageSrc ? (
                <>
                  {/* Fondo desenfocado */}
                  <img
                    src={imageSrc}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60 z-0"
                  />

                  {/* Imagen principal centrada */}
                  <div className="relative z-10 w-full h-full flex items-center justify-center">
                    <img
                      src={imageSrc}
                      alt={currentNode.title || "Escena"}
                      className="max-w-full max-h-full object-contain drop-shadow"
                    />
                  </div>
                </>
              ) : (
                <div className="game-no-image">
                  <span className="game-no-image-text">
                    Esta escena no tiene imagen definida.
                  </span>
                </div>
              )}

              {/* Título sobre la imagen */}
              {currentNode.title && (
                <div className="game-title-overlay">
                  <div
                    className={[
                      "game-title-text",
                      currentNode.title.length > 80
                        ? "animate-[scene-title-marquee_16s_linear_infinite]"
                        : "",
                    ].join(" ")}
                  >
                    {currentNode.title}
                  </div>
                </div>
              )}

              {/* Hotspots + HUD inferior SOBRE la imagen */}
              <div className="game-hotspot-layer">
                {/* Hotspots centrados */}
                <div className="flex justify-center">
                  {isFinal ? (
                    <div className="text-center space-y-2 bg-slate-900/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700">
                      <p className="text-sm text-emerald-300">
                        Has llegado al final de esta aventura.
                      </p>
                      <button
                        type="button"
                        onClick={handleExit}
                        className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Volver al inicio
                      </button>
                    </div>
                  ) : hotspots.length === 0 ? (
                    <p className="text-xs text-slate-300 bg-slate-900/70 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-700">
                      No hay acciones disponibles en este nodo.
                    </p>
                  ) : (
                    <div className="game-hotspot-buttons">
                      {hotspots.map((hotspot, index) => {
                        const goAction = hotspot.actions?.find(isGoToNodeAction);

                        let label = hotspot.label ?? `Opción ${index + 1}`;

                        if (goAction) {
                          const targetNode = gameState.project.nodes.find(
                            (n) => n.id === goAction.targetNodeId
                          );
                          if (targetNode) {
                            label = hotspot.label ?? targetNode.title;
                          }
                        }

                        return (
                          <button
                            key={hotspot.id}
                            type="button"
                            onClick={() => handleHotspotClick(hotspot)}
                            className="game-hotspot-btn"
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* HUD inferior: Inventario + Pantalla completa dentro de la escena */}
                <div className="flex items-center justify-between px-2 mt-1">
                  <button
                    type="button"
                    onClick={openInventory}
                    className="game-hud-icon"
                  >
                    <img
                      src="/ui/inventory.png"
                      alt="Inventario"
                      className="game-hud-icon-img"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="game-hud-icon"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    <img
                      src="/ui/fullScene.png"
                      alt="Pantalla Completa"
                      className="game-hud-icon-img"
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Texto (zona inferior limpia, con scroll si hace falta) */}
            <div className="game-scene-text">
              {currentNode.text ? (
                <p className="text-slate-100 text-sm whitespace-pre-line text-left leading-relaxed">
                  {currentNode.text}
                </p>
              ) : (
                <p className="text-slate-500 text-xs text-center">
                  (Este nodo no tiene texto definido)
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );

}
