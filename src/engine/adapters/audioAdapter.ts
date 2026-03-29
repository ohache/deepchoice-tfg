import type { ID, Project } from "@/domain/types";
import type { GameState } from "@/engine/state/runtimeState";

type ResolveAssetUrl = (assetId: ID, project: Project) => string | null;

export interface AudioAdapter {
  playSfx(state: GameState, sfxId: ID): void;
  playSfxUrl(url: string): void;
  dispose(): void;
}

export interface CreateAudioAdapterOptions {
  audioEl: HTMLAudioElement;
  resolveAssetUrl: ResolveAssetUrl;
  pumpMinIntervalMs?: number;
}

export function createAudioAdapter(opts: CreateAudioAdapterOptions): AudioAdapter {
  const { audioEl, resolveAssetUrl } = opts;

  const activeSfx = new Set<HTMLAudioElement>();

  function registerSfx(el: HTMLAudioElement) {
    activeSfx.add(el);

    const cleanup = () => {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load();
      activeSfx.delete(el);
    };

    el.addEventListener("ended", cleanup, { once: true });
    el.addEventListener("error", cleanup, { once: true });

    return cleanup;
  }

  function playSfx(state: GameState, sfxId: ID) {
    const def = (state.project.soundEffects ?? []).find((s) => s.id === sfxId) ?? null;
    if (!def) return;

    const url = resolveAssetUrl(def.id, state.project);
    if (!url) return;

    const el = new Audio(url);
    el.preload = "auto";
    registerSfx(el);

    void el.play().catch(() => {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load();
      activeSfx.delete(el);
    });
  }

  function playSfxUrl(url: string) {
    const el = new Audio(url);
    el.preload = "auto";
    registerSfx(el);

    void el.play().catch(() => {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load();
      activeSfx.delete(el);
    });
  }

  function dispose() {
    for (const el of activeSfx) {
      el.pause();
      el.currentTime = 0;
      el.removeAttribute("src");
      el.load();
    }
    activeSfx.clear();

    audioEl.pause();
    audioEl.currentTime = 0;
    audioEl.removeAttribute("src");
    audioEl.load();
  }

  return { playSfx, playSfxUrl, dispose };
}