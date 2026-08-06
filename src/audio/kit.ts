import type { Articulation, VoiceId } from '../model/types';

/**
 * The whole kit is synthesized — no audio files ship with the app.
 * One master gain into the destination, plus a single 1.2s white-noise buffer
 * reused by every noise voice. All envelopes are setValueAtTime →
 * exponentialRampToValueAtTime.
 */
export class Kit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  /** Lazily creates (and resumes) the context. Must be reached from a gesture. */
  ac(): AudioContext {
    if (!this.ctx) {
      const C: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      const n = Math.floor(this.ctx.sampleRate * 1.2);
      const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  /** Audio-clock read with no side effects — safe to poll from rAF. */
  get time(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  /** iOS suspends the context when the app is backgrounded. */
  resumeIfNeeded(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private noise(
    t: number,
    dur: number,
    hp: number | null,
    lp: number | null,
    g0: number,
    g1: number,
  ): void {
    const ac = this.ctx;
    if (!ac || !this.master || !this.noiseBuf) return;
    const s = ac.createBufferSource();
    s.buffer = this.noiseBuf;
    let node: AudioNode = s;
    if (hp) {
      const f = ac.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = hp;
      node.connect(f);
      node = f;
    }
    if (lp) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      node.connect(f);
      node = f;
    }
    const g = ac.createGain();
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(Math.max(g1, 0.0001), t + dur);
    node.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  private tone(
    t: number,
    f0: number,
    f1: number,
    dur: number,
    g0: number,
    type: OscillatorType = 'sine',
  ): void {
    const ac = this.ctx;
    if (!ac || !this.master) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    g.gain.setValueAtTime(g0, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Schedules one drum hit on the audio clock. */
  hit(v: VoiceId, t: number, a: Articulation): void {
    this.ac();
    const k = a === 'accent' ? 1.35 : a === 'ghost' ? 0.35 : 1;
    if (v === 'kick') {
      this.tone(t, 155, 45, 0.19, 0.95 * k);
      this.noise(t, 0.02, 60, 300, 0.35 * k, 0.001);
    } else if (v === 'snare') {
      this.noise(t, 0.15, 1400, 7000, 0.5 * k, 0.001);
      this.tone(t, 195, 150, 0.08, 0.35 * k, 'triangle');
    } else if (v === 'hihat') {
      this.noise(t, a === 'open' ? 0.32 : 0.05, 8000, null, 0.34 * k, 0.001);
    } else if (v === 'ride') {
      this.noise(t, a === 'open' ? 0.7 : 0.5, 6500, null, 0.16 * k, 0.001);
      this.tone(t, 760, 700, 0.4, 0.05 * k, 'square');
    } else if (v === 'crash') {
      this.noise(t, 1.15, 3200, null, 0.3 * k, 0.001);
    } else if (v === 'hitom') {
      this.tone(t, 270, 150, 0.24, 0.6 * k);
    } else if (v === 'midtom') {
      this.tone(t, 200, 115, 0.28, 0.6 * k);
    } else if (v === 'floor') {
      this.tone(t, 135, 78, 0.34, 0.65 * k);
    }
  }

  /**
   * Click / count-in tick. The 14ms noise transient layered over the square is
   * what makes it cut through a loud kit.
   */
  tick(t: number, strong: boolean, vol: number): void {
    if (vol <= 0) return;
    this.ac();
    this.tone(t, strong ? 2050 : 1500, strong ? 1950 : 1420, 0.042, (strong ? 1.15 : 0.75) * vol, 'square');
    this.noise(t, 0.014, 3500, null, (strong ? 0.55 : 0.34) * vol, 0.001);
  }

  /** Preview a voice immediately (note placement, selection, drag release). */
  audition(v: VoiceId, a: Articulation = 'normal'): void {
    this.hit(v, this.ac().currentTime + 0.01, a);
  }
}
