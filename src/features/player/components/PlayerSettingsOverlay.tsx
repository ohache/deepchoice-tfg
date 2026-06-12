import { useRef, useState } from "react";

type PlayerSettingsOverlayProps = {
  open: boolean;
  musicVolume: number;
  sfxVolume: number;
  dialogueDelayMs: number;
  onClose: () => void;
  onContinue: () => void;
  onSaveGame: (filename?: string) => void;
  onLoadGame: (file: File) => Promise<void>;
  onExit: () => void;
  onMusicVolumeChange: (volume: number) => void;
  onSfxVolumeChange: (volume: number) => void;
  onDialogueDelayChange: (delayMs: number) => void;
};

const MIN_DIALOGUE_DELAY_MS = 500;
const MAX_DIALOGUE_DELAY_MS = 4000;

export function PlayerSettingsOverlay({
  open,
  musicVolume,
  sfxVolume,
  dialogueDelayMs,
  onClose,
  onContinue,
  onSaveGame,
  onLoadGame,
  onExit,
  onMusicVolumeChange,
  onDialogueDelayChange,
  onSfxVolumeChange

}: PlayerSettingsOverlayProps) {
  const loadInputRef = useRef<HTMLInputElement | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showOptions, setShowOptions] = useState(false);

  if (!open) return null;

  const handleLoadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onLoadGame(file);
      onClose();
    } finally {
      event.target.value = "";
    }
  };

  const handleConfirmSave = () => {
    onSaveGame(saveName);
    setSaveName("");
    setSaving(false);
    onClose();
  };

  const handleClose = () => {
    setSaving(false);
    setSaveName("");
    setShowOptions(false);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuración de partida"
        className="w-full max-w-sm rounded-2xl border-2 border-slate-700 bg-slate-950/95 p-5 shadow-2xl"
        style={{ cursor: "auto" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-4 text-center text-lg font-semibold text-slate-100">
          Configuración
        </h2>

        <div className="flex flex-col gap-2">
          {saving ? (
            <>
              <input
                type="text"
                autoFocus
                placeholder="Nombre de la partida"
                value={saveName}
                onChange={(event) => setSaveName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleConfirmSave();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSaving(false);
                    setSaveName("");
                  }
                }}
                className="w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/70"
              />

              <button type="button" className="btn btn-select" onClick={handleConfirmSave}>
                Confirmar guardado
              </button>

              <button
                type="button"
                className="btn btn-cancel"
                onClick={() => {
                  setSaving(false);
                  setSaveName("");
                }}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-json text-[13px]" onClick={() => setSaving(true)}>
                Guardar partida
              </button>

              <button
                type="button"
                className="btn btn-add-variant text-[13px]"
                onClick={() => loadInputRef.current?.click()}
              >
                Cargar partida
              </button>

              <button
                type="button"
                className="btn btn-select text-[13px]"
                onClick={() => setShowOptions((prev) => !prev)}
              >
                Opciones
              </button>

              {showOptions ? (
                <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                      <span>Volumen música</span>
                      <span>{Math.round(musicVolume * 100)}%</span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={musicVolume}
                      onChange={(event) => onMusicVolumeChange(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                      <span>Volumen efectos</span>
                      <span>{Math.round(sfxVolume * 100)}%</span>
                    </div>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={sfxVolume}
                      onChange={(event) => onSfxVolumeChange(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>

                  <label className="block">
                    <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
                      <span>Velocidad diálogos</span>
                      <span>{dialogueDelayMs} ms</span>
                    </div>

                    <input
                      type="range"
                      min={MIN_DIALOGUE_DELAY_MS}
                      max={MAX_DIALOGUE_DELAY_MS}
                      step={100}
                      value={dialogueDelayMs}
                      onChange={(event) => onDialogueDelayChange(Number(event.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
              ) : null}

              <button type="button" className="btn btn-add-condition" onClick={onContinue}>
                Seguir jugando
              </button>

              <button type="button" className="btn btn-danger" onClick={onExit}>
                Salir
              </button>
            </>
          )}
        </div>



        <input
          ref={loadInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleLoadFile}
        />
      </div>
    </div>
  );
}