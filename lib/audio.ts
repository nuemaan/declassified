/**
 * DECLASSIFIED audio engine — synthesized via WebAudio so we don't ship
 * any audio files. All sounds are silent until `enable()` is called from
 * a user gesture (per browser autoplay policy).
 *
 * Effects:
 *  - ping()     short descending sine — emitted on marker hover (debounced)
 *  - clack()    brief band-pass-filtered noise — emitted on dossier open
 *  - setBed()   faint filtered noise bed — ambient background
 *  - setDrone() low sustained sine pair — runs while timeline is playing
 *
 * All factory functions are idempotent and safe to call when disabled.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private bedGain: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private enabled = false;
  private lastPingAt = 0;

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Called from a user gesture (the audio toggle click). Creates the
   * AudioContext, master gain, ambient bed, and drone scaffolding. Safe
   * to call multiple times — second call is a no-op.
   */
  enable(): void {
    if (this.enabled) return;
    try {
      const Ctor =
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
        AudioContext;
      this.ctx = new Ctor();
      const master = this.ctx.createGain();
      master.gain.value = 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.005;
      comp.release.value = 0.15;
      master.connect(comp).connect(this.ctx.destination);
      this.master = master;
      this.initBed();
      this.initDrone();
      this.enabled = true;
    } catch (err) {
      console.warn("[audio] enable failed:", err);
      this.enabled = false;
    }
  }

  /**
   * Mute everything and tear down looping sources. Reversible via enable().
   */
  disable(): void {
    if (!this.enabled || !this.ctx) return;
    try {
      this.bedGain?.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bedGain?.gain.setValueAtTime(0, this.ctx.currentTime);
      this.droneGain?.gain.cancelScheduledValues(this.ctx.currentTime);
      this.droneGain?.gain.setValueAtTime(0, this.ctx.currentTime);
      this.bedSource?.stop();
      this.bedSource = null;
    } catch {
      /* noop */
    }
    this.enabled = false;
  }

  private now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  ping(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = performance.now();
    if (now - this.lastPingAt < 70) return; // throttle rapid hovers
    this.lastPingAt = now;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(280, t + 0.16);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  clack(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const t = this.now();
    const dur = 0.06;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = Math.pow(1 - i / data.length, 2);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2400;
    bp.Q.value = 2.5;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.09;
    src.connect(bp).connect(gain).connect(this.master);
    src.start(t);
  }

  private initBed(): void {
    if (!this.ctx || !this.master) return;
    const seconds = 2;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1200;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 240;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(hp).connect(gain).connect(this.master);
    src.start();
    gain.gain.linearRampToValueAtTime(0.008, this.now() + 1.2);
    this.bedSource = src;
    this.bedGain = gain;
  }

  private initDrone(): void {
    if (!this.ctx || !this.master) return;
    const root = 55; // low A
    const fifth = 82.4; // perfect fifth
    const o1 = this.ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = root;
    const o2 = this.ctx.createOscillator();
    o2.type = "sine";
    o2.frequency.value = fifth;
    // Slow LFO on amplitude — keeps the drone breathing.
    const lfo = this.ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.13;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.018;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    lfo.connect(lfoGain).connect(gain.gain);
    o1.connect(gain);
    o2.connect(gain);
    gain.connect(this.master);
    o1.start();
    o2.start();
    lfo.start();
    this.droneGain = gain;
  }

  setDrone(playing: boolean): void {
    if (!this.enabled || !this.ctx || !this.droneGain) return;
    const target = playing ? 0.06 : 0;
    const t = this.now();
    this.droneGain.gain.cancelScheduledValues(t);
    this.droneGain.gain.setValueAtTime(this.droneGain.gain.value, t);
    this.droneGain.gain.linearRampToValueAtTime(target, t + (playing ? 0.6 : 0.4));
  }
}

// Module singleton — the engine is global to the page session.
let _engine: AudioEngine | null = null;
export function audio(): AudioEngine {
  if (typeof window === "undefined") {
    // SSR safe stub — calls into a disabled engine that ignores everything.
    return new AudioEngine();
  }
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}
