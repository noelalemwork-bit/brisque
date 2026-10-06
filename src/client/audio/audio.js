// Audio: master -> { music, sfx } buses on one AudioContext.
//
// Music plays per phase ('menu', 'early', 'late') and crossfades (equal-power, 2.5 s) when the phase
// changes. Sound effects play from files when public/audio/manifest.json names them, otherwise from a
// small procedural synth so the game is never silent. Browsers only allow audio after a user gesture:
// the context unlocks on the first click or key press. Master volume and mute persist per browser.
//
// public/audio/manifest.json:
//   { "credits": "Music and sound effects by Aya Emara",
//     "music": { "menu": "file.mp3", "early": "file.mp3", "late": "file.mp3" },
//     "sfx": { "click": "file.wav", "deploy": "...", ... } }   (any subset; missing ones fall back)

const FADE = 2.5;
const SFX_NAMES = ['click', 'hover', 'deploy', 'move', 'split', 'battle', 'bombFall', 'bombHit', 'collapse', 'resolve', 'turn', 'yourTurn', 'win', 'reject'];

const prefs = {
  get(k, d) { try { const v = localStorage.getItem(`brisque:audio:${k}`); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`brisque:audio:${k}`, JSON.stringify(v)); } catch { /* ignore */ } },
};

export function createAudio({ base = './audio/' } = {}) {
  let ctx = null;
  let master;
  let musicBus;
  let sfxBus;
  let volume = prefs.get('volume', 0.7);
  let muted = prefs.get('muted', false);
  let manifest = { music: {}, sfx: {} };
  const buffers = new Map(); // sfx name -> AudioBuffer
  const tracks = new Map(); // phase -> { el, gain }
  let phase = null;
  const listeners = new Set();

  const ready = fetch(`${base}manifest.json`).then((r) => (r.ok ? r.json() : null)).then((m) => { if (m) manifest = { music: {}, sfx: {}, ...m }; }).catch(() => {});

  function ensure() {
    if (ctx) return ctx;
    ctx = new AudioContext();
    master = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus.gain.value = 0.55;
    sfxBus.gain.value = 0.9;
    musicBus.connect(master);
    sfxBus.connect(master);
    master.connect(ctx.destination);
    applyVolume(0);
    ready.then(loadSfx);
    return ctx;
  }

  // unlock on the first gesture (autoplay policy)
  const unlock = () => {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    if (phase) startPhase(phase, true);
    removeEventListener('pointerdown', unlock);
    removeEventListener('keydown', unlock);
  };
  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);

  function applyVolume(seconds = 0.08) {
    if (!ctx) return;
    const target = muted ? 0 : volume * volume; // perceptual taper
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(target, ctx.currentTime, seconds / 3 || 0.001);
    listeners.forEach((fn) => fn({ volume, muted }));
  }

  async function loadSfx() {
    await Promise.all(Object.entries(manifest.sfx ?? {}).map(async ([name, file]) => {
      try {
        const data = await (await fetch(base + file)).arrayBuffer();
        buffers.set(name, await ctx.decodeAudioData(data));
      } catch { /* keep the synth fallback */ }
    }));
  }

  function track(p) {
    if (tracks.has(p)) return tracks.get(p);
    const file = manifest.music?.[p];
    if (!file || !ctx) return null;
    const el = new Audio(base + file);
    el.loop = true;
    el.crossOrigin = 'anonymous';
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(musicBus);
    const t = { el, gain };
    tracks.set(p, t);
    return t;
  }

  function startPhase(p, immediate = false) {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const [q, t] of tracks) {
      if (q === p) continue;
      t.gain.gain.cancelScheduledValues(now);
      t.gain.gain.setValueCurveAtTime(fadeCurve(t.gain.gain.value, 0), now, FADE);
      setTimeout(() => { if (phase !== q) t.el.pause(); }, FADE * 1000 + 100);
    }
    const t = track(p);
    if (!t) return;
    if (t.el.paused) t.el.play().catch(() => {});
    t.gain.gain.cancelScheduledValues(now);
    t.gain.gain.setValueCurveAtTime(fadeCurve(t.gain.gain.value, 1), now, immediate ? 0.6 : FADE);
  }

  // --- procedural fallback SFX: short, soft, in-key (A minor pentatonic) --------------------------------
  function synth(name) {
    const c = ctx;
    const t = c.currentTime;
    const out = c.createGain();
    out.connect(sfxBus);
    const tone = (freq, start, dur, type = 'sine', gain = 0.2, glideTo = null) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + start);
      if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + start + dur);
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(gain, t + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(out);
      o.start(t + start);
      o.stop(t + start + dur + 0.05);
    };
    const noise = (start, dur, gain = 0.3, freq = 800, q = 0.8) => {
      const len = Math.ceil(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      f.Q.value = q;
      const g = c.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(out);
      src.start(t + start);
    };
    switch (name) {
      case 'click': tone(880, 0, 0.06, 'triangle', 0.08); break;
      case 'hover': tone(1320, 0, 0.03, 'sine', 0.025); break;
      case 'deploy': tone(440, 0, 0.12, 'triangle', 0.14); tone(660, 0.06, 0.16, 'triangle', 0.1); break;
      case 'move': noise(0, 0.18, 0.12, 500, 1.5); tone(330, 0, 0.14, 'sine', 0.07, 440); break;
      case 'split': tone(523, 0, 0.3, 'sine', 0.12, 784); tone(523, 0, 0.3, 'sine', 0.12, 392); break;
      case 'battle': noise(0, 0.25, 0.22, 1800, 3); tone(220, 0, 0.25, 'sawtooth', 0.05); break;
      case 'bombFall': tone(1400, 0, 0.8, 'sine', 0.07, 500); break;
      case 'bombHit': noise(0, 0.9, 0.55, 140, 0.6); tone(70, 0, 0.6, 'sine', 0.35, 35); break;
      case 'collapse': tone(784, 0, 0.35, 'sine', 0.12, 392); tone(1175, 0.02, 0.3, 'triangle', 0.05); break;
      case 'resolve': tone(659, 0, 0.18, 'sine', 0.1); tone(880, 0.1, 0.25, 'sine', 0.08); break;
      case 'turn': tone(392, 0, 0.2, 'triangle', 0.07); break;
      case 'yourTurn': tone(523, 0, 0.16, 'triangle', 0.12); tone(659, 0.12, 0.16, 'triangle', 0.12); tone(784, 0.24, 0.3, 'triangle', 0.12); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.14, 0.5, 'triangle', 0.14)); break;
      case 'reject': tone(220, 0, 0.12, 'square', 0.05); tone(185, 0.08, 0.14, 'square', 0.05); break;
      default: break;
    }
  }

  return {
    ready,
    get credits() { return manifest.credits ?? ''; },
    get volume() { return volume; },
    get muted() { return muted; },
    // 'menu' | 'early' | 'late'
    setPhase(p) {
      if (p === phase) return;
      phase = p;
      if (ctx) ready.then(() => startPhase(p));
    },
    play(name, { gain = 1 } = {}) {
      if (!ctx || ctx.state !== 'running' || muted) return;
      const buf = buffers.get(name);
      if (buf) {
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        g.gain.value = gain;
        src.buffer = buf;
        src.connect(g).connect(sfxBus);
        src.start();
      } else synth(name);
    },
    setVolume(v) { volume = Math.max(0, Math.min(1, v)); prefs.set('volume', volume); applyVolume(); },
    setMuted(m) { muted = m; prefs.set('muted', muted); applyVolume(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    // for tests: which phase is set and which tracks are audibly playing
    status() { return { phase, context: ctx?.state ?? 'none', sfxLoaded: [...buffers.keys()], playing: [...tracks].filter(([, t]) => !t.el.paused && t.gain.gain.value > 0.05).map(([p]) => p) }; },
    SFX_NAMES,
  };
}

// equal-power fade curve from a -> b
function fadeCurve(a, b, n = 32) {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    out[i] = a * Math.cos((k * Math.PI) / 2) + b * Math.sin((k * Math.PI) / 2);
  }
  out[n - 1] = b;
  return out;
}
