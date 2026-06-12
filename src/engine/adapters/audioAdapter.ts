import type { ID, Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";

type ResolveAssetUrl = (assetId: ID, project: Project) => string | null;

export interface AudioAdapter {
  playSfx(state: GameState, sfxId: ID): void;
  playSfxUrl(url: string): void;
  setSfxVolume(volume: number): void;
  dispose(): void;
}

export interface CreateAudioAdapterOptions {
  audioEl: HTMLAudioElement;
  resolveAssetUrl: ResolveAssetUrl;
}

function cleanupAudioElement(audio: HTMLAudioElement) {
  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute("src");
  audio.load();
}

function clampVolume(volume: number): number {
  return Math.max(0, Math.min(1, volume));
}

export function createAudioAdapter(opts: CreateAudioAdapterOptions): AudioAdapter {
  const { audioEl, resolveAssetUrl } = opts;
  const activeSfx = new Set<HTMLAudioElement>();

  let sfxVolume = 1;

  function registerSfx(audio: HTMLAudioElement) {
    activeSfx.add(audio);

    const cleanup = () => {
      cleanupAudioElement(audio);
      activeSfx.delete(audio);
    };

    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });

    return cleanup;
  }

  function setSfxVolume(volume: number) {
    sfxVolume = clampVolume(volume);

    for (const audio of activeSfx) {
      audio.volume = sfxVolume;
    }
  }

  function playSfxUrl(url: string) {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = sfxVolume;

    const cleanup = registerSfx(audio);

    void audio.play().catch(() => {
      cleanup();
    });
  }

  function playSfx(state: GameState, sfxId: ID) {
    const soundEffect = (state.project.soundEffects ?? []).find((sfx) => sfx.id === sfxId);
    if (!soundEffect) return;

    const url = resolveAssetUrl(soundEffect.id, state.project);
    if (!url) return;

    playSfxUrl(url);
  }

  function dispose() {
    for (const audio of activeSfx) {
      cleanupAudioElement(audio);
    }

    activeSfx.clear();
    cleanupAudioElement(audioEl);
  }

  return { playSfx, playSfxUrl, setSfxVolume, dispose };
}