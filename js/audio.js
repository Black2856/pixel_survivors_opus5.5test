// audio.js — BGM(HTMLAudio, クロスフェード) + 効果音(WebAudio シンセ, コンプレッサー経由・同時発音制限付き)
'use strict';

const AudioMan = (() => {
  const MUSIC = {
    title: 'music/title-menu.mp3', field1: 'music/field1.mp3', field2: 'music/field2.mp3', field3: 'music/field3.mp3',
    boss1: 'music/boss1.mp3', boss2: 'music/boss2.mp3', boss3: 'music/boss3.mp3',
  };
  let ctx = null, bus = null, noiseBuf = null;
  const last = {};
  let vol = { music: 0.7, sfx: 0.8 }, muted = false;
  try { Object.assign(vol, JSON.parse(localStorage.getItem('ps55_vol') || '{}')); } catch (e) { /* 既定値で続行 */ }

  const A = {
    music: null, musicName: null, duck: 1,

    unlock() {
      if (!ctx) {
        try {
          ctx = new (window.AudioContext || window.webkitAudioContext)();
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -16; comp.ratio.value = 6;
          bus = ctx.createGain(); bus.connect(comp); comp.connect(ctx.destination);
          noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { ctx = null; }
      }
      if (ctx && ctx.state === 'suspended') ctx.resume();
      if (this.music && this.music.paused && !this._paused) this.music.play().catch(() => {});
    },

    get vol() { return vol; },
    setVol(kind, v) {
      vol[kind] = Math.max(0, Math.min(1, v));
      try { localStorage.setItem('ps55_vol', JSON.stringify(vol)); } catch (e) { /* 保存不可でも続行 */ }
      this._apply();
    },
    toggleMute() { muted = !muted; this._apply(); return muted; },
    _target() { return muted ? 0 : vol.music * 0.6 * this.duck; },
    _apply() { if (this.music && !this.music._iv) this.music.volume = this._target(); },

    _ramp(el, to, dur, done) {
      clearInterval(el._iv);
      const from = el.volume, t0 = performance.now();
      el._iv = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / (dur * 1000));
        el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k >= 1) { clearInterval(el._iv); el._iv = null; if (done) done(); }
      }, 30);
    },

    playMusic(name, fade = 1) {
      if (this.musicName === name) return;
      this.musicName = name;
      const old = this.music;
      if (old) this._ramp(old, 0, fade, () => { old.pause(); old.src = ''; });
      const el = new Audio(MUSIC[name]);
      el.loop = true; el.volume = 0;
      this.music = el;
      el.play().catch(() => {});
      this._ramp(el, this._target(), fade);
    },
    stopMusic(fade = 1) {
      const old = this.music;
      if (!old) return;
      this._ramp(old, 0, fade, () => { old.pause(); old.src = ''; });
      this.music = null; this.musicName = null;
    },
    pauseMusic() { this._paused = true; if (this.music) this.music.pause(); },
    resumeMusic() { this._paused = false; if (this.music) this.music.play().catch(() => {}); },
    setDuck(k) { this.duck = k; this._apply(); },

    // ---------- シンセ ----------
    _ok(key, gap) {
      if (!ctx || muted || vol.sfx <= 0) return false;
      const t = ctx.currentTime;
      if (key && last[key] && t - last[key] < gap) return false;
      if (key) last[key] = t;
      return true;
    },
    tone(f0, f1, dur, o = {}) {
      const t = ctx.currentTime + (o.delay || 0);
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'square';
      osc.frequency.setValueAtTime(Math.max(20, f0), t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((o.vol || 0.12) * vol.sfx, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g); g.connect(bus);
      osc.start(t); osc.stop(t + dur + 0.02);
    },
    noise(dur, o = {}) {
      const t = ctx.currentTime + (o.delay || 0);
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; src.playbackRate.value = o.rate || 1;
      f.type = o.ftype || 'lowpass';
      f.frequency.setValueAtTime(o.f0 || 3000, t);
      f.frequency.exponentialRampToValueAtTime(o.f1 || 200, t + dur);
      g.gain.setValueAtTime((o.vol || 0.2) * vol.sfx, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(bus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
    },

    // ---------- 効果音 ----------
    shoot()   { if (this._ok('shoot', 0.05)) this.tone(900, 420, 0.07, { vol: 0.05 }); },
    hit()     { if (this._ok('hit', 0.035)) { this.noise(0.05, { vol: 0.09, f0: 5000, f1: 800 }); this.tone(260, 90, 0.05, { vol: 0.05 }); } },
    crit()    { if (this._ok('crit', 0.06)) { this.tone(1400, 700, 0.08, { vol: 0.06, type: 'triangle' }); this.noise(0.06, { vol: 0.08, f0: 8000, f1: 2000, ftype: 'highpass' }); } },
    kill()    { if (this._ok('kill', 0.03)) this.tone(520, 70, 0.1, { vol: 0.06, type: 'triangle' }); },
    gem(n)    { if (this._ok('gem', 0.028)) this.tone(880 * Math.pow(2, Math.min(n, 24) / 24), 1760 * Math.pow(2, Math.min(n, 24) / 24), 0.06, { vol: 0.05, type: 'sine' }); },
    coin()    { if (this._ok('coin', 0.04)) { this.tone(1320, 1320, 0.05, { vol: 0.05, type: 'square' }); this.tone(1980, 1980, 0.12, { vol: 0.05, delay: 0.05 }); } },
    levelup() { if (!this._ok()) return; [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, f * 1.01, 0.16, { vol: 0.09, delay: i * 0.06, type: 'square' })); },
    chest()   { if (!this._ok()) return; [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, f, 0.2, { vol: 0.08, delay: i * 0.07, type: 'triangle' })); },
    evolve()  { if (!this._ok()) return; [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => this.tone(f, f * 1.02, 0.3, { vol: 0.08, delay: i * 0.05, type: i % 2 ? 'square' : 'sawtooth' })); this.noise(1.2, { vol: 0.12, f0: 9000, f1: 400, delay: 0.5 }); },
    hurt()    { if (this._ok('hurt', 0.1)) { this.tone(220, 55, 0.22, { vol: 0.14, type: 'sawtooth' }); this.noise(0.15, { vol: 0.12, f0: 2000, f1: 200 }); } },
    boom()    { if (this._ok('boom', 0.06)) { this.noise(0.6, { vol: 0.3, f0: 2500, f1: 60 }); this.tone(120, 30, 0.5, { vol: 0.16, type: 'sine' }); } },
    zap()     { if (this._ok('zap', 0.05)) { this.noise(0.25, { vol: 0.16, f0: 9000, f1: 1500, ftype: 'highpass' }); this.tone(1800, 200, 0.15, { vol: 0.05, type: 'sawtooth' }); } },
    slash()   { if (this._ok('slash', 0.05)) this.noise(0.12, { vol: 0.16, f0: 7000, f1: 900, ftype: 'bandpass', rate: 1.6 }); },
    fire()    { if (this._ok('fire', 0.08)) this.noise(0.25, { vol: 0.1, f0: 1800, f1: 300 }); },
    blizz()   { if (this._ok('blizz', 0.2)) this.noise(0.8, { vol: 0.1, f0: 6000, f1: 2000, ftype: 'highpass' }); },
    hole()    { if (this._ok('hole', 0.2)) this.tone(90, 40, 0.8, { vol: 0.16, type: 'sine' }); },
    splat()   { if (this._ok('splat', 0.08)) { this.noise(0.3, { vol: 0.16, f0: 900, f1: 120 }); this.tone(220, 60, 0.2, { vol: 0.08, type: 'sine' }); } },
    charge(dur) { if (this._ok('charge', 0.3)) { this.tone(120, 900, dur, { vol: 0.07, type: 'sawtooth' }); this.noise(dur, { vol: 0.08, f0: 400, f1: 6000, ftype: 'bandpass' }); } },
    dash()    { if (this._ok('dash', 0.05)) this.noise(0.18, { vol: 0.14, f0: 1200, f1: 5000, ftype: 'bandpass' }); },
    roar()    { if (!this._ok('roar', 0.3)) return; this.tone(110, 50, 0.9, { vol: 0.16, type: 'sawtooth' }); this.noise(0.9, { vol: 0.18, f0: 900, f1: 90 }); },
    warning() { if (!this._ok('warn', 0.5)) return; for (let i = 0; i < 3; i++) this.tone(880, 880, 0.14, { vol: 0.08, delay: i * 0.22, type: 'square' }); },
    click()   { if (this._ok('click', 0.03)) this.tone(1200, 900, 0.03, { vol: 0.05 }); },
    select()  { if (!this._ok()) return; this.tone(660, 1320, 0.1, { vol: 0.08 }); this.tone(990, 1980, 0.14, { vol: 0.06, delay: 0.06 }); },
    heal()    { if (!this._ok('heal', 0.1)) return; [523, 784, 1047].forEach((f, i) => this.tone(f, f, 0.12, { vol: 0.06, delay: i * 0.05, type: 'sine' })); },
    artifact(){ if (!this._ok()) return; [330, 415, 494, 659, 831, 988].forEach((f, i) => this.tone(f, f, 0.35, { vol: 0.07, delay: i * 0.08, type: 'triangle' })); },
    // 宝箱演出用
    drumroll(dur) { if (!this._ok()) return; const n = Math.floor(dur / 0.045); for (let i = 0; i < n; i++) this.noise(0.04, { vol: 0.05 + 0.12 * i / n, f0: 900 + 3000 * i / n, f1: 300, delay: i * 0.045 }); this.tone(120, 900, dur, { vol: 0.07, type: 'sawtooth' }); },
    tick(i)   { if (this._ok('tick', 0.02)) this.tone(600 + i * 60, 600 + i * 60, 0.03, { vol: 0.05, type: 'square' }); },
    land(r)   { if (!this._ok()) return; const b = [523, 659, 784, 1047][r] || 523; [1, 1.25, 1.5, 2].forEach((m, i) => this.tone(b * m, b * m, 0.18, { vol: 0.08, delay: i * 0.04, type: 'triangle' })); this.noise(0.25, { vol: 0.1, f0: 9000, f1: 3000, ftype: 'highpass' }); },
    burstOpen(){ if (!this._ok()) return; this.noise(0.9, { vol: 0.35, f0: 6000, f1: 80 }); this.tone(80, 30, 0.7, { vol: 0.2, type: 'sine' }); [784, 988, 1175, 1568, 1976, 2349].forEach((f, i) => this.tone(f, f, 0.5, { vol: 0.06, delay: 0.1 + i * 0.05, type: 'triangle' })); },
    coinRain(n) { if (!this._ok()) return; for (let i = 0; i < n; i++) this.tone(1800 + Math.random() * 900, 2400 + Math.random() * 900, 0.05, { vol: 0.03, delay: i * 0.05 + Math.random() * 0.03, type: 'square' }); },
    death()   { if (!this._ok()) return; [440, 349, 262, 196, 131].forEach((f, i) => this.tone(f, f * 0.97, 0.3, { vol: 0.1, delay: i * 0.16, type: 'square' })); },
  };
  return A;
})();
