import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Hotspot, ID, Effect, PlacedItem, HotspotShape, ItemDef } from "@/domain/types";
import { useGameStore } from "@/store/gameStore";

function resolveAssetSrc(path?: string, assetUrls?: Record<string, string>) {
  if (!path) return undefined;
  return assetUrls?.[path] ?? path;
}

/** Convención temporal: primer effect del primer interaction */
function getPrimaryEffect(hs: Hotspot): Effect | undefined {
  return hs.interactions?.[0]?.effects?.[0];
}

function getGoToNodeTargetId(hs: Hotspot): ID | null {
  const eff = getPrimaryEffect(hs);
  return eff && eff.type === "goToNode" ? (eff.targetNodeId as ID) : null;
}

function isRectShape(shape: HotspotShape | undefined): shape is Extract<HotspotShape, { type: "rect" }> {
  return !!shape && shape.type === "rect";
}

function getItemDef(projectItems: ItemDef[] | undefined, itemId: ID): ItemDef | undefined {
  return projectItems?.find((i) => i.id === itemId);
}

export function PlayerShell() {
  const navigate = useNavigate();

  /* Estado global del juego */
  const gameState = useGameStore((state) => state.gameState);
  const applyHotspot = useGameStore((state) => state.applyHotspot);
  const resetGame = useGameStore((state) => state.reset);
  const assetUrls = useGameStore((state) => state.assetUrls);

  const [hoveredId, setHoveredId] = useState<ID | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Toast MVP
  const [toastText, setToastText] = useState<string | null>(null);
  useEffect(() => {
    if (!toastText) return;
    const t = window.setTimeout(() => setToastText(null), 1800);
    return () => window.clearTimeout(t);
  }, [toastText]);

  /* Música */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackIdRef = useRef<ID | null>(null);

  /* Refs layout */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  /* Returns seguros */
  if (!gameState) {
    return (
      <div className="page-fullscreen-center">
        <p className="text-center text-slate-300">
          No hay ninguna partida en curso.
          <br />
          Carga una aventura desde la pantalla de inicio.
        </p>
        <button type="button" onClick={() => navigate("/")} className="btn-primary">
          Volver al inicio
        </button>
      </div>
    );
  }

  /* Nodo actual */
  const currentNode =
    gameState.project.nodes.find((node) => node.id === gameState.currentNodeId) ?? null;

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

  /* Derivados visuales */
  const imageSrc = resolveAssetSrc(currentNode.image, assetUrls);
  const isFinal = currentNode.isFinal === true;
  const hotspots = currentNode.hotspots ?? [];
  const placedItems = (currentNode.placedItems ?? []) as PlacedItem[];

  /* Música de la escena */
  const musicTrack =
    currentNode.musicId != null
      ? gameState.project.musicTracks?.find((t) => t.id === currentNode.musicId)
      : undefined;

  const musicSrc = musicTrack ? resolveAssetSrc(musicTrack.file, assetUrls) : undefined;
  const musicTrackId: ID | null = (musicTrack?.id as ID) ?? null;
  const musicLoop = musicTrack?.loop ?? true;

  function getImageContentRect() {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return null;

    const c = container.getBoundingClientRect();
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    if (!nw || !nh) return null;

    const containerRatio = c.width / c.height;
    const imgRatio = nw / nh;

    let w = c.width;
    let h = c.height;
    let x = c.left;
    let y = c.top;

    if (imgRatio > containerRatio) {
      h = w / imgRatio;
      y = c.top + (c.height - h) / 2;
    } else {
      w = h * imgRatio;
      x = c.left + (c.width - w) / 2;
    }

    return { x, y, w, h };
  }

  /* Helpers UI */
  const openInventory = () => console.log("TODO: abrir panel de inventario");
  const openMap = () => console.log("TODO: abrir panel de mapa");
  const openSettings = () => console.log("TODO: abrir panel de configuración");

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

  /* Atajos de teclado */
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
        void toggleFullscreen();
      } else if (key === "escape") {
        if (document.fullscreenElement) {
          event.preventDefault();
          void toggleFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* Mantener isFullscreen sincronizado si el usuario sale con ESC del navegador */
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* Control de música al cambiar de escena */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!musicTrackId || !musicSrc) {
      if (audio.src) {
        audio.pause();
        audio.currentTime = 0;
        audio.removeAttribute("src");
        audio.load();
      }
      lastTrackIdRef.current = null;
      return;
    }

    if (lastTrackIdRef.current === musicTrackId) {
      audio.loop = musicLoop;
      return;
    }

    audio.src = musicSrc;
    audio.loop = musicLoop;

    const play = async () => {
      try {
        await audio.play();
        lastTrackIdRef.current = musicTrackId;
      } catch (err) {
        console.error("No se ha podido reproducir la música del Player", err);
        lastTrackIdRef.current = null;
      }
    };

    void play();
  }, [musicTrackId, musicSrc, musicLoop]);

  /* Handlers */
  const handleHotspotClick = (hotspot: Hotspot) => {
    if (isFinal) return;
    applyHotspot(hotspot);
  };

  const handleExit = () => {
    resetGame();
    navigate("/");
  };

  // Labels de hotspots (evita lógica dentro del map)
  const hotspotLabels = useMemo(() => {
    const out = new Map<ID, string>();

    hotspots.forEach((hs, index) => {
      let label = hs.label ?? `Opción ${index + 1}`;

      const targetId = getGoToNodeTargetId(hs);
      if (targetId) {
        const targetNode = gameState.project.nodes.find((n) => n.id === targetId);
        if (targetNode) label = hs.label ?? targetNode.title;
      }

      out.set(hs.id as ID, label);
    });

    return out;
  }, [hotspots, gameState.project.nodes]);

  return (
    <div className="game-root">
      <div className="game-frame">
        <button
          type="button"
          onClick={openMap}
          className="absolute top-6 left-6 z-20 game-hud-icon"
        >
          <img src="/ui/map.png" alt="Mapa" className="game-hud-icon-img" />
        </button>

        <button
          type="button"
          onClick={openSettings}
          className="absolute top-6 right-6 z-20 game-hud-icon"
        >
          <img src="/ui/settings.png" alt="Configuración" className="game-hud-icon-img" />
        </button>

        {/* Toast MVP */}
        {toastText && (
          <div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50
                       bg-slate-900/90 text-slate-100 text-xs px-3 py-2
                       rounded-md border border-slate-700 shadow pointer-events-none"
          >
            {toastText}
          </div>
        )}

        <main className="game-main">
          <div className="game-scene-panel">
            <div className="game-scene-image h-[85%]">
              {imageSrc ? (
                <>
                  <img
                    src={imageSrc}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-lg scale-110 opacity-60 z-0"
                  />

                  {/* Imagen principal centrada */}
                  <div
                    ref={containerRef}
                    className="relative z-10 w-full h-full flex items-center justify-center"
                  >
                    <img
                      ref={imgRef}
                      src={imageSrc}
                      alt={currentNode.title || "Escena"}
                      className="max-w-full max-h-full object-contain drop-shadow"
                      draggable={false}
                    />

                    {/* Capa interactiva (hotspots + items) */}
                    <div className="absolute inset-0 z-20 pointer-events-none">
                      {(() => {
                        const content = getImageContentRect();
                        const containerBox = containerRef.current?.getBoundingClientRect();
                        if (!content || !containerBox) return null;

                        const ox = content.x - containerBox.left;
                        const oy = content.y - containerBox.top;

                        return (
                          <>
                            {/* Hotspots FREE */}
                            {hotspots.map((hotspot) => {
                              const shape = hotspot.shape;
                              if (!shape || shape.type !== "rect") return null;

                              const left = ox + shape.x * content.w;
                              const top = oy + shape.y * content.h;
                              const width = shape.w * content.w;
                              const height = shape.h * content.h;

                              const id = hotspot.id as ID;
                              const isHovered = hoveredId === id;
                              const label = hotspotLabels.get(id) ?? "Opción";

                              return (
                                <div
                                  key={`hs-${id}`}
                                  className="absolute pointer-events-auto"
                                  style={{ left, top, width, height }}
                                  onMouseEnter={() => setHoveredId(id)}
                                  onMouseLeave={() => setHoveredId(null)}
                                  onClick={() => handleHotspotClick(hotspot)}
                                >
                                  <div
                                    className={[
                                      "absolute inset-0 rounded-sm transition",
                                      isHovered
                                        ? "bg-sky-400/15 ring-1 ring-sky-300"
                                        : "bg-transparent",
                                    ].join(" ")}
                                    style={{ cursor: "pointer" }}
                                  />

                                  {isHovered && (
                                    <div
                                      className="absolute left-1/2 -translate-x-1/2 -top-7 z-30
                                                 bg-slate-900 text-slate-100 text-[11px]
                                                 px-2 py-1 rounded border border-slate-700
                                                 whitespace-nowrap pointer-events-none"
                                    >
                                      {label}
                                    </div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Items colocados */}
                            {placedItems.map((pi) => {
                              if (pi.state?.visible === false) return null;
                              if (!isRectShape(pi.shape)) return null;

                              const left = ox + pi.shape.x * content.w;
                              const top = oy + pi.shape.y * content.h;
                              const width = pi.shape.w * content.w;
                              const height = pi.shape.h * content.h;

                              const itemDef = getItemDef(gameState.project.items, pi.itemId as ID);
                              const spriteSrc = resolveAssetSrc(itemDef?.image, assetUrls);

                              const id = pi.id as ID;
                              const isHovered = hoveredId === id;
                              const label = itemDef?.name ?? (pi.itemId as string);

                              const onClickItem = () => {
                                if (isFinal) return;

                                // MVP: click = LOOK
                                // - reachable=false: mirar sí
                                // - reachable=true: mirar también (por ahora)
                                const desc = itemDef?.description?.trim();
                                setToastText(desc?.length ? desc : "No ves nada especial.");
                              };

                              return (
                                <div
                                  key={`pi-${id}`}
                                  className="absolute pointer-events-auto"
                                  style={{ left, top, width, height }}
                                  onMouseEnter={() => setHoveredId(id)}
                                  onMouseLeave={() => setHoveredId(null)}
                                  onClick={onClickItem}
                                >
                                  {/* sprite */}
                                  {spriteSrc ? (
                                    <img
                                      src={spriteSrc}
                                      alt={label}
                                      className="absolute inset-0 w-full h-full object-contain select-none"
                                      draggable={false}
                                    />
                                  ) : null}

                                  {/* hover highlight */}
                                  <div
                                    className={[
                                      "absolute inset-0 rounded-sm transition",
                                      isHovered
                                        ? "bg-amber-400/15 ring-1 ring-amber-300"
                                        : "bg-transparent",
                                    ].join(" ")}
                                    style={{ cursor: "pointer" }}
                                  />

                                  {isHovered && (
                                    <div
                                      className="absolute left-1/2 -translate-x-1/2 -top-7 z-30
                                                 bg-slate-900 text-slate-100 text-[11px]
                                                 px-2 py-1 rounded border border-slate-700
                                                 whitespace-nowrap pointer-events-none"
                                    >
                                      {label}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              ) : (
                <div className="game-no-image">
                  <span className="game-no-image-text">Esta escena no tiene imagen definida.</span>
                </div>
              )}

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

              <div className="game-hotspot-layer">
                {isFinal && (
                  <div className="flex justify-center mb-2">
                    <div className="text-center space-y-2 bg-slate-900/70 backdrop-blur-sm px-4 py-2 rounded-lg border border-slate-700">
                      <p className="text-sm text-emerald-300">Has llegado al final de esta aventura.</p>
                      <button
                        type="button"
                        onClick={handleExit}
                        className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Volver al inicio
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between px-2 mt-1">
                  <button type="button" onClick={openInventory} className="game-hud-icon">
                    <img src="/ui/inventory.png" alt="Inventario" className="game-hud-icon-img" />
                  </button>

                  <button
                    type="button"
                    onClick={() => void toggleFullscreen()}
                    className="game-hud-icon"
                    title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
                  >
                    <img src="/ui/fullScene.png" alt="Pantalla Completa" className="game-hud-icon-img" />
                  </button>
                </div>
              </div>
            </div>

            <div className="game-scene-text">
              {currentNode.text ? (
                <p className="text-slate-100 text-sm whitespace-pre-line text-left leading-relaxed">
                  {currentNode.text}
                </p>
              ) : (
                <p className="text-slate-500 text-xs text-center">(Este nodo no tiene texto definido)</p>
              )}
            </div>
          </div>
        </main>
      </div>

      <audio ref={audioRef} className="hidden" />
    </div>
  );
}
