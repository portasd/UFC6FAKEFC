import { TargetZone } from './strikes';

/**
 * Broadcast-grade UFC-style procedural Web Audio synthesizer.
 * Zero external MP3 dependencies (never fails or 404s) while producing layered
 * Octagon canvas thuds, leather-on-chin cracks, stinging shin-on-thigh calf kicks,
 * hollow body liver crunches, arena reverb tails, 10-second wooden clapper, and round horns.
 */
export class ArenaAudioSynth {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private impactCurve: Float32Array<ArrayBuffer> | null = null;
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
      const len = this.ctx.sampleRate * 1.4;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    if (!this.impactCurve) {
      const samples = 256;
      const curve = new Float32Array(new ArrayBuffer(samples * 4));
      for (let i = 0; i < samples; i++) {
        const x = (i * 2) / samples - 1;
        curve[i] = Math.tanh(x * 2.6);
      }
      this.impactCurve = curve;
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
    const startFreq = isKick ? 460 : 880;
    const endFreq = isKick ? 135 : 290;
    const dur = isKick ? 0.22 : 0.125;

    filter.frequency.setValueAtTime(
      startFreq * (0.92 + Math.random() * 0.16),
      now,
    );
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + dur);
    filter.Q.value = isKick ? 1.15 : 2.1;

    const gain = ctx.createGain();
    const peak = isKick ? (isHeavy ? 0.22 : 0.16) : isHeavy ? 0.15 : 0.1;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.022);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.03);
  }

  public playFeint() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.07);
    filter.Q.value = 2.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.09);
  }

  public playLunge() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    // Canvas sneaker/barefoot push-off scuff
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(160, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.014);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.12);
  }

  public playImpact(
    weight: number,
    isBlocked: boolean,
    isCounter: boolean,
    isKick = false,
    zone: TargetZone = 'head',
    isLowKick = false,
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const jitter = 0.91 + Math.random() * 0.18;

    // 1. Sub-bass punch/kick concussion + waveshaped meaty thud
    const osc = ctx.createOscillator();
    osc.type = isBlocked ? 'triangle' : 'sine';
    const startFreq = isBlocked
      ? isKick
        ? 88
        : 108
      : zone === 'body'
        ? 96 + weight * 22
        : isLowKick
          ? 124 + weight * 20
          : (isKick ? 114 : 158) + weight * 30;
    const thudDur = isBlocked
      ? 0.11
      : zone === 'body'
        ? 0.24
        : isKick
          ? 0.22
          : 0.16;

    osc.frequency.setValueAtTime(startFreq * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + thudDur);

    const shaper = ctx.createWaveShaper();
    shaper.curve = this.impactCurve;

    const oscGain = ctx.createGain();
    const peakAmp = isBlocked
      ? 0.28
      : Math.min(0.72, (isKick ? 0.42 : 0.34) + weight * 0.22);
    oscGain.gain.setValueAtTime(peakAmp, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + thudDur + 0.025);

    osc.connect(shaper).connect(oscGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + thudDur + 0.04);

    // 2. UFC Leather-on-skin crack / Hollow body liver crunch / Shin-on-calf whip smack
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const crackFreq = isBlocked
      ? 420
      : isLowKick
        ? 2580
        : zone === 'body'
          ? 640
          : isKick
            ? 2150
            : isCounter
              ? 1920
              : 1480;
    bp.frequency.setValueAtTime(crackFreq * jitter, now);
    bp.frequency.exponentialRampToValueAtTime(crackFreq * 0.52, now + 0.09);
    bp.Q.value = isBlocked ? 0.85 : isLowKick ? 1.5 : zone === 'body' ? 1.3 : 1.05;

    const nGain = ctx.createGain();
    const slapAmp = isBlocked
      ? 0.12
      : Math.min(0.62, (isLowKick ? 0.44 : isKick ? 0.36 : 0.28) + weight * 0.2);
    const slapDur = isLowKick ? 0.12 : zone === 'body' ? 0.14 : 0.095;
    nGain.gain.setValueAtTime(slapAmp, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + slapDur);

    noise.connect(bp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + slapDur + 0.02);

    // 3. Crisp jaw/glove transient snap on clean heavy/counter head strikes or calf whips
    if (!isBlocked && (weight >= 0.7 || isCounter || isLowKick)) {
      const snap = ctx.createBufferSource();
      snap.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.setValueAtTime(isLowKick ? 3100 : 2400, now);

      const sGain = ctx.createGain();
      sGain.gain.setValueAtTime(Math.min(0.32, 0.16 + weight * 0.12), now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

      snap.connect(hp).connect(sGain).connect(ctx.destination);
      snap.start(now);
      snap.stop(now + 0.06);
    }

    // 4. Subtle UFC arena mic tail echo on clean heavy shots
    if (!isBlocked && weight >= 0.8) {
      const tail = ctx.createBufferSource();
      tail.buffer = this.noiseBuffer;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(680, now + 0.04);
      lp.frequency.exponentialRampToValueAtTime(220, now + 0.34);

      const tGain = ctx.createGain();
      tGain.gain.setValueAtTime(0.001, now);
      tGain.gain.linearRampToValueAtTime(0.08 * Math.min(1.4, weight), now + 0.06);
      tGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      tail.connect(lp).connect(tGain).connect(ctx.destination);
      tail.start(now + 0.03);
      tail.stop(now + 0.38);
    }
  }

  public playRocked() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;

    // Deep stun concussion boom
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(125, now);
    sub.frequency.exponentialRampToValueAtTime(26, now + 0.48);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.62, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sub.connect(subGain).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.52);

    // Dual-beat adrenaline heartbeat ("lub-dub")
    for (const [offset, freq] of [
      [0.18, 62],
      [0.36, 54],
    ] as const) {
      const hb = ctx.createOscillator();
      hb.type = 'sine';
      hb.frequency.setValueAtTime(freq, now + offset);
      hb.frequency.exponentialRampToValueAtTime(28, now + offset + 0.14);
      const hbGain = ctx.createGain();
      hbGain.gain.setValueAtTime(0.28, now + offset);
      hbGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);
      hb.connect(hbGain).connect(ctx.destination);
      hb.start(now + offset);
      hb.stop(now + offset + 0.17);
    }

    // Concussion ear-ringing tone
    const ring = ctx.createOscillator();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(2350, now);
    ring.frequency.exponentialRampToValueAtTime(1720, now + 0.72);
    const ringGain = ctx.createGain();
    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.linearRampToValueAtTime(0.085, now + 0.035);
    ringGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.74);
    ring.connect(ringGain).connect(ctx.destination);
    ring.start(now);
    ring.stop(now + 0.76);

    // Dramatic low-pass whoosh swell
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1500, now);
    lp.frequency.exponentialRampToValueAtTime(200, now + 0.45);
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.28, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.46);
    noise.connect(lp).connect(nGain).connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.48);
  }

  /** Authentic UFC Octagon wooden 10-second clapper ("clack-clack!") */
  public playClapper() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    for (const offset of [0, 0.115]) {
      const start = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1180, start);
      osc.frequency.exponentialRampToValueAtTime(420, start + 0.035);
      const oGain = ctx.createGain();
      oGain.gain.setValueAtTime(0.28, start);
      oGain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
      osc.connect(oGain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.06);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1850, start);
      bp.Q.value = 3.2;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.32, start);
      nGain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
      src.connect(bp).connect(nGain).connect(ctx.destination);
      src.start(start);
      src.stop(start + 0.055);
    }
  }

  /** UFC Octagon round horn / buzzer + championship ring bell resonance */
  public playRoundBell(rings = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    for (let r = 0; r < rings; r++) {
      const start = ctx.currentTime + r * 0.25;
      // Crisp Octagon arena air-horn / klaxon harmonic base + metallic shimmer
      const partials = [
        { freq: 392, type: 'sawtooth' as OscillatorType, amp: 0.08, dur: 0.55 },
        { freq: 784, type: 'sine' as OscillatorType, amp: 0.16, dur: 1.25 },
        { freq: 1568, type: 'sine' as OscillatorType, amp: 0.09, dur: 1.1 },
        { freq: 2380, type: 'sine' as OscillatorType, amp: 0.05, dur: 0.9 },
      ];
      partials.forEach(({ freq, type, amp, dur }) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(amp, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0008, start + dur);

        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + dur + 0.04);
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
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.linearRampToValueAtTime(920, now + 0.35);
    filter.frequency.linearRampToValueAtTime(410, now + 1.75);
    filter.Q.value = 0.65;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.22);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 1.85);
  }
}
