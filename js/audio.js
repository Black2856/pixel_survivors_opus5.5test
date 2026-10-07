// audio.js — BGM(HTMLAudio, クロスフェード) + 効果音(WebAudio シンセ, コンプレッサー経由・同時発音制限付き)
'use strict';

const AudioMan = (() => {
  // 曲: タイトル / ステージごとのフィールド曲(f_)・ボス曲(b_)。music/ のファイル名(拡張子なし)
  const MUSIC = {
    title: 'title-menu',
    f_grass: 'はじまりの草原-フィールド', b_grass: 'はじまりの草原-ボス',
    f_crystal: '七彩の晶窟-フィールド', b_crystal: '七彩の晶窟-ボス',
    f_wild: '黄昏の荒野-フィールド', b_wild: '黄昏の荒野-ボス',
    f_hell: '灼熱の奈落-フィールド', b_hell: '灼熱の奈落-ボス',
    f_sea: '沈黙の海淵-フィールド', b_sea: '沈黙の海淵-ボス',
    f_peak: '霜天の霊峰-フィールド', b_peak: '霜天の霊峰-ボス',
    f_clock: '終刻の時計塔-フィールド', b_clock1: '終刻の時計塔-ボス1', b_clock2: '終刻の時計塔-ボス2',
  };
  const musicSrc = name => encodeURI('music/' + (MUSIC[name] || (name && name[0] === 'b' ? MUSIC.b_grass : MUSIC.f_grass)) + '.mp3');
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
      const el = new Audio(musicSrc(name));
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
    // アローレイン: 空へ一斉に放つ弦の音と風切り / 降り注ぐ矢が地面に刺さる音(小さく、続けて)
    volley()  { if (!this._ok('volley', 0.2)) return; for (let i = 0; i < 4; i++) this.tone(760 + i * 70, 360, 0.06, { vol: 0.035, delay: i * 0.03, type: 'triangle' }); this.noise(0.32, { vol: 0.1, f0: 900, f1: 5200, ftype: 'bandpass' }); },
    rainTick() { if (!this._ok('rainTick', 0.1)) return; this.noise(0.05, { vol: 0.05, f0: 2600, f1: 700 }); this.noise(0.05, { vol: 0.04, f0: 2000, f1: 500, delay: 0.05 }); this.tone(320, 120, 0.04, { vol: 0.02, type: 'triangle', delay: 0.02 }); },
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
    // 鬼神・村正の一閃: 抜刀の「チャキ」→ 一閃の「シャッ」→ 遅れて「ザンッ」
    cutDraw() { if (!this._ok('cutDraw', 0.15)) return; this.tone(3200, 2900, 0.05, { vol: 0.035, type: 'triangle' }); this.tone(4300, 4100, 0.08, { vol: 0.025, type: 'sine', delay: 0.04 }); },
    cut()     { if (!this._ok('cut', 0.1)) return; this.noise(0.18, { vol: 0.22, f0: 10000, f1: 1800, ftype: 'bandpass', rate: 2 }); this.tone(6000, 2200, 0.14, { vol: 0.03, type: 'sine' }); },
    cutHit()  { if (!this._ok('cutHit', 0.1)) return; this.noise(0.4, { vol: 0.28, f0: 3200, f1: 120 }); this.tone(170, 40, 0.32, { vol: 0.15, type: 'sine' }); this.noise(0.08, { vol: 0.12, f0: 9000, f1: 3000, ftype: 'highpass' }); },
    fire()    { if (this._ok('fire', 0.08)) this.noise(0.25, { vol: 0.1, f0: 1800, f1: 300 }); },
    blizz()   { if (this._ok('blizz', 0.2)) this.noise(0.8, { vol: 0.1, f0: 6000, f1: 2000, ftype: 'highpass' }); },
    hole()    { if (this._ok('hole', 0.2)) this.tone(90, 40, 0.8, { vol: 0.16, type: 'sine' }); },
    // 葬送の最後の着弾: 鐘のような低い音(低い音 + 少しずれた倍音が長く残る)
    knell()   { if (!this._ok('knell', 0.4)) return; this.noise(0.5, { vol: 0.22, f0: 2000, f1: 80 }); this.tone(196, 190, 1.6, { vol: 0.14, type: 'sine' }); this.tone(392, 385, 1.2, { vol: 0.06, type: 'triangle' }); this.tone(587, 580, 0.9, { vol: 0.035, type: 'sine' }); },
    // ディメンション・リフト: 空間が裂ける「ビリッ」と低いうねり / 異次元の脈動(0.5秒ごと)
    rift()    { if (!this._ok('rift', 0.3)) return; this.noise(0.5, { vol: 0.2, f0: 9000, f1: 300, ftype: 'bandpass', rate: 1.4 }); this.tone(70, 32, 1.4, { vol: 0.16, type: 'sine' }); this.tone(140, 55, 0.9, { vol: 0.04, type: 'sawtooth' }); },
    riftPulse() { if (this._ok('riftPulse', 0.3)) this.tone(58, 40, 0.3, { vol: 0.09, type: 'sine' }); },
    // 重力崩壊: 特異点の低い唸り(引き寄せている間)/ 崩壊の「ドゥン」
    hum(dur)  { if (this._ok('hum', 0.5)) { this.tone(48, 62, dur, { vol: 0.07, type: 'sawtooth' }); this.tone(96, 120, dur, { vol: 0.03, type: 'sine' }); } },
    crush()   { if (!this._ok('crush', 0.2)) return; this.noise(0.8, { vol: 0.3, f0: 3000, f1: 50 }); this.tone(100, 24, 0.9, { vol: 0.2, type: 'sine' }); this.tone(1600, 300, 0.12, { vol: 0.03, type: 'triangle' }); },
    // バーサーカー: 狂乱の雄叫び(低いうなり + 喉の荒い息)/ ワイルドトマホークが当たる鈍い音 / 不屈で踏ん張る音
    warcry()  { if (!this._ok('warcry', 0.5)) return; this.tone(150, 70, 0.9, { vol: 0.15, type: 'sawtooth' }); this.tone(225, 105, 0.8, { vol: 0.06, type: 'sawtooth', delay: 0.02 }); this.noise(0.9, { vol: 0.2, f0: 1400, f1: 140 }); },
    thud()    { if (this._ok('thud', 0.05)) { this.tone(150, 48, 0.16, { vol: 0.15, type: 'sine' }); this.noise(0.1, { vol: 0.14, f0: 1200, f1: 120 }); this.tone(900, 500, 0.04, { vol: 0.03, type: 'triangle' }); } },
    firm()    { if (this._ok('firm', 0.2)) { this.tone(95, 55, 0.28, { vol: 0.1, type: 'sawtooth' }); this.noise(0.18, { vol: 0.12, f0: 700, f1: 100 }); } },
    // ウェポンマスター: 影が現れる「シュッ」/ 分身が抜け出す(金属の響き + 煙)
    shade()   { if (this._ok('shade', 0.1)) { this.noise(0.12, { vol: 0.1, f0: 3000, f1: 800, ftype: 'bandpass' }); this.tone(660, 990, 0.06, { vol: 0.03, type: 'triangle' }); } },
    summon()  { if (!this._ok('summon', 0.3)) return; this.tone(330, 660, 0.25, { vol: 0.06, type: 'triangle' }); this.tone(495, 990, 0.3, { vol: 0.04, type: 'triangle', delay: 0.05 }); this.noise(0.45, { vol: 0.12, f0: 2400, f1: 300, ftype: 'bandpass' }); },
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
    // ステージの流れ: 自分が凍みる「パキッ」/ エリート群の襲来(低い角笛と太鼓)/ フェーズクリアのファンファーレ
    //   闇の霧が立ちこめる低いうねり / 霧の中の鼓動(k: 強さ)
    frost()   { if (!this._ok('pfrost', 0.12)) return; this.noise(0.18, { vol: 0.12, f0: 9000, f1: 3000, ftype: 'highpass' }); this.tone(2600, 1700, 0.1, { vol: 0.04, type: 'triangle' }); this.tone(3400, 2900, 0.12, { vol: 0.025, type: 'sine', delay: 0.04 }); },
    eliteHorn() {
      if (!this._ok('eliteHorn', 1)) return;
      this.tone(98, 92, 1.3, { vol: 0.13, type: 'sawtooth' }); this.tone(147, 139, 1.2, { vol: 0.06, type: 'sawtooth', delay: 0.06 });
      this.tone(196, 185, 0.9, { vol: 0.04, type: 'square', delay: 0.5 });
      for (let i = 0; i < 3; i++) { this.noise(0.35, { vol: 0.24, f0: 900, f1: 50, delay: 0.25 + i * 0.32 }); this.tone(90, 34, 0.3, { vol: 0.14, type: 'sine', delay: 0.25 + i * 0.32 }); }
    },
    phaseClear() {
      if (!this._ok('phaseClear', 1)) return;
      [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, f * 1.005, 0.32, { vol: 0.08, delay: i * 0.06, type: i % 2 ? 'square' : 'triangle' }));
      [1047, 1319, 1568].forEach(f => this.tone(f, f, 1.1, { vol: 0.035, type: 'triangle', delay: 0.42 }));
      this.noise(1.1, { vol: 0.1, f0: 9000, f1: 2500, ftype: 'highpass', delay: 0.35 });
    },
    fogRise() { if (!this._ok('fogRise', 2)) return; this.noise(2.6, { vol: 0.14, f0: 160, f1: 1400, ftype: 'bandpass' }); this.tone(55, 41, 2.6, { vol: 0.09, type: 'sawtooth' }); this.tone(82, 61, 2.2, { vol: 0.04, type: 'sine', delay: 0.3 }); },
    heartbeat(k = 1) { if (!this._ok('heartbeat', 0.3)) return; this.tone(64, 40, 0.18, { vol: 0.14 * k, type: 'sine' }); this.tone(58, 36, 0.16, { vol: 0.11 * k, type: 'sine', delay: 0.21 }); },
    // 荒野・奈落の敵: 砂術師の詠唱(砂が巻く音)/ 投槍兵の構え(金属の擦れ)と投擲(風切り)/ 鬼火の導火(しゅうしゅう)
    sand()    { if (this._ok('sand', 0.15)) { this.noise(0.45, { vol: 0.07, f0: 600, f1: 3200, ftype: 'bandpass', rate: 0.7 }); this.tone(330, 440, 0.3, { vol: 0.02, type: 'triangle' }); } },
    spearReady() { if (this._ok('spearReady', 0.15)) { this.tone(2200, 1900, 0.06, { vol: 0.025, type: 'triangle' }); this.noise(0.08, { vol: 0.05, f0: 5000, f1: 2500, ftype: 'highpass' }); } },
    spearThrow() { if (this._ok('spearThrow', 0.08)) { this.noise(0.22, { vol: 0.12, f0: 900, f1: 4200, ftype: 'bandpass', rate: 1.3 }); this.tone(500, 260, 0.1, { vol: 0.03, type: 'sawtooth' }); } },
    // 晶窟: 結晶が鳴る音(澄んだ高い和音)
    chime()   { if (!this._ok('chime', 0.08)) return; const b = 1320 + Math.random() * 400; this.tone(b, b, 0.25, { vol: 0.035, type: 'sine' }); this.tone(b * 1.5, b * 1.5, 0.3, { vol: 0.025, type: 'sine', delay: 0.03 }); this.tone(b * 2, b * 2, 0.2, { vol: 0.015, type: 'triangle', delay: 0.06 }); },
    // 海淵: スタミナを奪われる(泡がはじける)/ フグの針 / 水しぶき
    drain()   { if (!this._ok('drain', 0.15)) return; this.tone(700, 260, 0.18, { vol: 0.05, type: 'sine' }); this.tone(520, 200, 0.16, { vol: 0.03, type: 'sine', delay: 0.06 }); this.noise(0.12, { vol: 0.05, f0: 1800, f1: 600, ftype: 'bandpass' }); },
    puff()    { if (!this._ok('puff', 0.12)) return; this.noise(0.2, { vol: 0.1, f0: 600, f1: 2400, ftype: 'bandpass', rate: 1.2 }); this.tone(300, 900, 0.08, { vol: 0.03, type: 'triangle' }); },
    splash()  { if (!this._ok('splash', 0.1)) return; this.noise(0.55, { vol: 0.18, f0: 3500, f1: 400, ftype: 'bandpass', rate: 0.8 }); this.tone(180, 70, 0.3, { vol: 0.07, type: 'sine' }); this.noise(0.3, { vol: 0.06, f0: 7000, f1: 3000, ftype: 'highpass', delay: 0.08 }); },
    fuse()    { if (this._ok('fuse', 0.12)) { this.noise(0.55, { vol: 0.08, f0: 7000, f1: 9000, ftype: 'highpass', rate: 1.8 }); this.tone(900, 1700, 0.55, { vol: 0.02, type: 'sine' }); } },
    // E / Q スキル: 構え(Q は低いうねりがせり上がり、光の音が重なる。E は短い光の音)/ 放つ瞬間の低い衝撃 / 大技の炸裂に重ねる低音 / きらめき
    cast(q)   { if (!this._ok('cast', 0.1)) return; if (q) { this.tone(65, 150, 0.5, { vol: 0.09, type: 'sine' }); this.noise(0.45, { vol: 0.06, f0: 300, f1: 3600, ftype: 'bandpass' }); this.tone(1320, 2640, 0.22, { vol: 0.022, type: 'triangle', delay: 0.1 }); } else { this.tone(990, 1980, 0.12, { vol: 0.028, type: 'triangle' }); this.noise(0.14, { vol: 0.04, f0: 1200, f1: 4800, ftype: 'bandpass' }); } },
    thump(q)  { if (!this._ok('thump', 0.08)) return; this.tone(q ? 115 : 140, 34, q ? 0.28 : 0.16, { vol: q ? 0.16 : 0.1, type: 'sine' }); this.noise(q ? 0.18 : 0.1, { vol: q ? 0.1 : 0.06, f0: 900, f1: 80 }); },
    impact()  { if (!this._ok('impact', 0.15)) return; this.tone(62, 22, 0.8, { vol: 0.2, type: 'sine' }); this.noise(0.6, { vol: 0.15, f0: 1400, f1: 40 }); this.tone(230, 55, 0.25, { vol: 0.05, type: 'triangle' }); },
    // ボス: 技の直前の合図(小さく高い音)
    cue()     { if (this._ok('cue', 0.25)) this.tone(1900, 2500, 0.07, { vol: 0.022, type: 'triangle' }); },
    sparkle() { if (!this._ok('sparkle', 0.08)) return; this.tone(2400, 3600, 0.1, { vol: 0.022, type: 'sine' }); this.tone(3600, 4800, 0.12, { vol: 0.016, type: 'sine', delay: 0.05 }); },
  };
  return A;
})();
