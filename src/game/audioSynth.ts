export class ArenaAudioSynth {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 1.0;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public playWhoosh(isKick: boolean, isHeavy = false) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const startFreq = isKick ? 390 : 760;
    const endFreq = isKick ? 120 : 250;
    const dur = isKick ? 0.2 : 0.13;

    filter.frequency.setValueAtTime(
      startFreq * (0.92 + Math.random() * 0.16),
      now,
    );
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    filter.Q.value = isKick ? 1.2 : 1.9;

    const gain = ctx.createGain();
    const peak = isKick ? (isHeavy ? 0.2 : 0.15) : isHeavy ? 0.14 : 0.1;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  public playFeint() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, now);
    filter.frequency.exponentialRampToValueAtTime(480, now + 0.065);
    filter.Q.value = 2.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.08);
  }

  public playLunge() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(420, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.11);
  }

  public playImpact(
    weight: number,
    isBlocked: boolean,
    isCounter: boolean,
    isKick = false,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const pitchJitter = 0.92 + Math.random() * 0.16;

    // 1. Sub-bass impact body thud (kicks carry heavier low-end boom)
    const osc = ctx.createOscillator();
    osc.type = isBlocked ? 'triangle' : 'sine';
    const startFreq = isBlocked
      ? isKick
        ? 92
        : 112
      : (isKick ? 118 : 162) + weight * 28;
    const dur = isBlocked ? 0.11 : isKick ? 0.21 : 0.15;

    osc.frequency.setValueAtTime(startFreq * pitchJitter, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + dur);

    const oscGain = ctx.createGain();
    const peakAmp = isBlocked
      ? 0.26
      : Math.min(0.65, (isKick ? 0.38 : 0.3) + weight * 0.2);
    oscGain.gain.setValueAtTime(peakAmp, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur + 0.02);

    osc.connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.03);

    // 2. Leather glove crack vs bare shin-on-flesh slap
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const crackFreq = isBlocked
      ? 520
      : isKick
        ? 2150
        : isCounter
          ? 1850
          : 1380;
    bp.frequency.setValueAtTime(crackFreq * pitchJitter, now);
    bp.Q.value = isBlocked ? 0.9 : isKick ? 1.4 : 1.1;

    const nGain = ctx.createGain();
    const slapAmp = isBlocked
      ? 0.11
      : Math.min(0.52, (isKick ? 0.34 : 0.22) + weight * 0.18);
    nGain.gain.setValueAtTime(slapAmp, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + (isKick ? 0.12 : 0.085));

    noise.connect(bp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.13);
  }

  public playRocked() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Deep stun concussion boom
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(115, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.42);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.55, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.46);

    // High adrenaline/concussion ear-ringing tone
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(2250, now);
    ring.frequency.exponentialRampToValueAtTime(1750, now + 0.65);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.linearRampToValueAtTime(0.09, now + 0.03);
    ringGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.68);
    ring.connect(ringGain).connect(ctx.destination);
    ring.start(now);
    ring.stop(now + 0.7);

    // Dramatic low-pass whoosh swell
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(220, now + 0.4);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    noise.connect(lp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.45);
  }

  public playRoundBell(rings = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let r = 0; r < rings; r++) {
      const start = ctx.currentTime + r * 0.24;
      const partials = [784, 1568, 2380, 3190];
      partials.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        const gain = ctx.createGain();
        const amp = 0.16 / (idx + 1);
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + 1.15);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.2);
      });
    }
  }

  public playCrowdRoar(intensity = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.linearRampToValueAtTime(840, now + 0.35);
    filter.frequency.linearRampToValueAtTime(420, now + 1.6);
    filter.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14 * intensity, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.65);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 1.7);
  }
}
