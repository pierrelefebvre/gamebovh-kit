import type { SoundName, ToneOptions } from '../contract.ts';

type Step = ToneOptions & { delayMs?: number };

/** Banque de sons synthétisés : aucun fichier audio à charger. */
const SOUNDS: Record<SoundName, Step[]> = {
  blip: [{ frequency: 880, durationMs: 40, wave: 'square', volume: 0.25 }],
  select: [{ frequency: 660, durationMs: 50, wave: 'square', volume: 0.25 }],
  confirm: [
    { frequency: 660, durationMs: 60, wave: 'square', volume: 0.3 },
    { frequency: 990, durationMs: 90, wave: 'square', volume: 0.3, delayMs: 60 },
  ],
  back: [{ frequency: 440, durationMs: 80, wave: 'square', volume: 0.25, slideTo: 300 }],
  jump: [{ frequency: 300, durationMs: 140, wave: 'square', volume: 0.3, slideTo: 800 }],
  hit: [{ frequency: 160, durationMs: 160, wave: 'sawtooth', volume: 0.35, slideTo: 60 }],
  coin: [
    { frequency: 988, durationMs: 60, wave: 'square', volume: 0.3 },
    { frequency: 1319, durationMs: 160, wave: 'square', volume: 0.3, delayMs: 60 },
  ],
  whoosh: [{ frequency: 1200, durationMs: 180, wave: 'triangle', volume: 0.25, slideTo: 200 }],
  throw: [{ frequency: 500, durationMs: 120, wave: 'triangle', volume: 0.3, slideTo: 900 }],
  splat: [{ frequency: 220, durationMs: 120, wave: 'sawtooth', volume: 0.35, slideTo: 80 }],
  countdown: [{ frequency: 523, durationMs: 120, wave: 'square', volume: 0.3 }],
  go: [{ frequency: 1047, durationMs: 300, wave: 'square', volume: 0.3 }],
  win: [
    { frequency: 523, durationMs: 100, wave: 'square', volume: 0.3 },
    { frequency: 659, durationMs: 100, wave: 'square', volume: 0.3, delayMs: 110 },
    { frequency: 784, durationMs: 100, wave: 'square', volume: 0.3, delayMs: 220 },
    { frequency: 1047, durationMs: 300, wave: 'square', volume: 0.3, delayMs: 330 },
  ],
  lose: [
    { frequency: 392, durationMs: 150, wave: 'triangle', volume: 0.35 },
    { frequency: 330, durationMs: 150, wave: 'triangle', volume: 0.35, delayMs: 160 },
    { frequency: 262, durationMs: 400, wave: 'triangle', volume: 0.35, delayMs: 320 },
  ],
};

/** Moteur audio et vibration de la console. Son coupé par défaut. */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = true;
  vibrationEnabled = true;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!muted) this.unlock();
  }

  /** À appeler dans un geste utilisateur (navigateurs mobiles). */
  unlock(): void {
    if (this.muted) return;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(sound: SoundName): void {
    const steps = SOUNDS[sound];
    if (!steps) return;
    for (const step of steps) this.tone(step, step.delayMs ?? 0);
  }

  tone(options: ToneOptions, delayMs = 0): void {
    if (this.muted) return;
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + delayMs / 1000;
    const end = start + Math.max(10, options.durationMs) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.wave ?? 'square';
    osc.frequency.setValueAtTime(options.frequency, start);
    if (options.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, options.slideTo), end);
    const volume = Math.min(1, Math.max(0, options.volume ?? 0.3));
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(end + 0.02);
  }

  vibrate(pattern: number | number[]): void {
    if (!this.vibrationEnabled) return;
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* non supporté (iOS) */
    }
  }
}
