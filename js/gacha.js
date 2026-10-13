// gacha.js — ガチャの画面と演出(ラン外。2026-10-13 にショップから変えた)
//   画面: 一般・高級・最高級の3台(値段・カオス強化の何 pt 相当か・その上限)と、レアリティの確率
//   演出(派手に): 玉が落ちる → 溜め(レアリティが高いほど、玉の色が 白 → 青 → 紫 → 金 と段を上がる)→ 割れる(光の筋・衝撃の輪・紙吹雪・コイン)
//     → レアリティの文字 → 装備のカード。ミシックはレジェンダリーの演出のあと、昇格(鼓動・赤い稲妻・ひび)→ 赤い大爆発 → ミシック
//   クリック / SPACE / Enter / ESC で最後まで飛ばす。引いた装備は演出の前にインベントリへ入れて保存してある(途中で閉じても失われない)
'use strict';

const Gacha = (() => {
  const $ = id => document.getElementById(id);
  const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  // レアリティごとの演出: up = 玉の色が何段上がるか / label = 割れたときの文字 / cols = 光の筋・粒の色 / n = 粒の数
  const FX = {
    common:    { up: 0, label: 'COMMON',        cols: ['#c8c8d0', '#ffffff'], n: 50 },
    uncommon:  { up: 0, label: 'UNCOMMON!',     cols: ['#5dff8a', '#c8ffd8', '#ffffff'], n: 80 },
    rare:      { up: 1, label: 'RARE!!',        cols: ['#5ab8ff', '#9ff7ff', '#ffffff'], n: 130 },
    epic:      { up: 2, label: 'EPIC!!!',       cols: ['#c78bff', '#ff6ec7', '#9ff7ff', '#ffffff'], n: 210 },
    legendary: { up: 3, label: 'LEGENDARY!!!!', cols: ['#ffb347', '#ffd23f', '#ff6a2a', '#ff6ec7', '#ffffff'], n: 320 },
    mythic:    { up: 3, label: 'MYTHIC!!!!!',   cols: ['#ff3b5c', '#ff8a9a', '#ffd23f', '#a0122a', '#ffffff'], n: 420 },
  };
  const ORB_COLS = ['#e8e4f8', '#5ab8ff', '#c78bff', '#ffb347']; // 玉の色の段: 白 → 青 → 紫 → 金
  const RAR_CLS = { common: 'common', uncommon: 'new', rare: 'rare', epic: 'epic', legendary: 'legend', mythic: 'mythic' }; // カードの見た目(選択カードと同じ)

  // ---------- 玉の絵(ドットの球。光は左上から。縁は暗く、左上に白い照り)----------
  const orbCache = {};
  function orbSprite(col) {
    if (orbCache[col]) return orbCache[col];
    const N = 24, R = 11.5, c = ART.canvas(N, N), x = c.getContext('2d'), rgb = hexRgb(col), L = [-0.45, -0.6, 0.66], ln = Math.hypot(...L);
    const tone = k => `rgb(${rgb.map(v => Math.round(255 * (k <= 1 ? v * k : v + (1 - v) * (k - 1)))).join(',')})`;
    for (let py = 0; py < N; py++) for (let px = 0; px < N; px++) {
      const dx = (px + 0.5 - N / 2) / R, dy = (py + 0.5 - N / 2) / R, d2 = dx * dx + dy * dy;
      if (d2 > 1) continue;
      const l = (dx * L[0] + dy * L[1] + Math.sqrt(1 - d2) * L[2]) / ln;
      x.fillStyle = tone(d2 > 0.86 ? 0.3 : l > 0.95 ? 2 : l > 0.78 ? 1.45 : l > 0.45 ? 1 : l > 0.15 ? 0.72 : 0.5);
      x.fillRect(px, py, 1, 1);
    }
    x.fillStyle = '#ffffff'; x.fillRect(6, 7, 3, 1); x.fillRect(7, 6, 1, 3);
    return (orbCache[col] = c);
  }

  // ---------- 画面 ----------
  function open() { state = 'gacha'; UI.only('gacha-screen'); render(); }
  function render() {
    $('gc-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    $('gc-list').innerHTML = DATA.gacha.tiers.map((T, i) => {
      const st = gachaStats(i), b = gachaBlock(i);
      return `<div class="gc-m" style="--gc:${T.col}">
        <div class="gc-nm">${T.name}</div>
        <img class="gc-orb" src="${orbSprite(T.col).toDataURL()}" alt="">
        <div class="gc-pt">${_t`カオス強化 ${T.pt} pt 相当`}</div>
        <div class="gc-cap">${_t`装備ロール上限 +${Math.round(st.eqMaxVal * 100)}%`}<br>${_t`装備Lv上限 +${st.eqMaxLv}`}</div>
        <button class="btn gc-pull" data-t="${i}" ${b ? 'disabled' : ''}>${b === 'full' ? _t('インベントリが一杯') : _t`1回 ● ${T.price}`}</button>
      </div>`;
    }).join('');
    const R = DATA.gacha.rates;
    $('gc-rates').innerHTML = Object.keys(R).map(k => `<span style="color:${DATA.equip.rarity[k].col}">${DATA.equip.rarity[k].name} <b>${R[k]}%</b></span>`).join('')
      + `<span class="note">${_t('どのガチャもレアリティの確率は同じ。高いガチャほどロール値・最大Lv の上限が高い。ミシックはレジェンダリーの全オプションがその上限(最高ロール値・最高Lv)')}</span>`;
    Help.glossify($('gc-list'), { per: '.gc-cap' });
  }
  function pull(t) {
    const it = gachaPull(t);
    if (!it) { AudioMan.hurt(); return; }
    render(); // 払ったゴールド
    play(t, it);
  }
  $('gc-list').onclick = e => { const b = e.target.closest('.gc-pull'); if (b && !b.disabled) { AudioMan.coin(); pull(+b.dataset.t); } };
  $('gc-back').onclick = () => { AudioMan.click(); state = 'title'; UI.title(); };
  $('btn-gacha').onclick = () => { AudioMan.click(); open(); };

  // ---------- 演出 ----------
  const cv0 = $('gc-cv0'), cv1 = $('gc-cv1'), c0 = cv0.getContext('2d'), c1 = cv1.getContext('2d');
  const coinImgs = ART.S.coin.map(sp => sp.c);
  let show = null, raf = 0, last = 0;
  const now = () => performance.now() / 1000;
  const center = () => { const r = $('gc-slot').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const easeOutBounce = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; };
  // 時間差で呼ぶ(飛ばしたら全部取り消す)
  const at = (ms, fn) => { const S = show; S.timers.push(setTimeout(() => { if (show === S && !S.done) fn(); }, ms)); };
  const restart = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  function flash(col = '#ffffff', a = 0.95) { const f = $('gc-flash'); f.style.background = col; f.style.setProperty('--fa', a); restart(f, 'go'); }
  const quake = big => { const b = $('gc-show'); b.classList.remove('quake', 'quake-big'); void b.offsetWidth; b.classList.add(big ? 'quake-big' : 'quake'); };

  // 粒: spark(光る四角)/ conf(紙吹雪)/ coin / star(十字のきらめき)/ ember(昇る火の粉)/ suck(玉へ吸い込まれる)
  function burst(x, y, n, k, cols, o = {}) {
    for (let i = 0; i < n; i++) {
      const an = o.up ? -Math.PI / 2 + (Math.random() - 0.5) * (o.spread || 1.6) : Math.random() * TAU, sp = (o.sp || 600) * (0.35 + Math.random() * 0.65);
      show.parts.push({ k, x, y, vx: Math.cos(an) * sp, vy: Math.sin(an) * sp, g: o.g ?? 900, drag: o.drag ?? 0.6, t: 0, life: (o.life || 2.4) * (0.6 + Math.random() * 0.4),
        col: pick(cols), s: o.s || (k === 'coin' ? 4 : k === 'conf' ? 5 + Math.random() * 5 : k === 'star' ? 6 + Math.random() * 10 : 5 + Math.random() * 8), rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 16, seed: Math.random() * 10 });
    }
  }
  const ring = (col, k = 1, d = 0) => show.rings.push({ col, t: -d, life: 0.7 + 0.3 * k, r0: 30, v: 900 * k, w: 10 * k });
  // 稲妻: 画面の端からカードへ。折れ線の点をずらして作る
  function bolt(col) {
    const C = center(), an = Math.random() * TAU, R = Math.max(innerWidth, innerHeight) * 0.7, pts = [], n = 14;
    const x0 = C.x + Math.cos(an) * R, y0 = C.y + Math.sin(an) * R;
    for (let i = 0; i <= n; i++) { const k = i / n, j = i && i < n ? 38 * (1 - k * 0.6) : 0; pts.push([lerp(x0, C.x, k) + (Math.random() - 0.5) * j * 2, lerp(y0, C.y, k) + (Math.random() - 0.5) * j * 2]); }
    show.bolts.push({ pts, col, t: 0, life: 0.32 });
  }

  function loop(ts) {
    const S = show;
    if (!S) { raf = 0; return; }
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016), T = now(); last = ts;
    for (const cv of [cv0, cv1]) if (cv.width !== innerWidth || cv.height !== innerHeight) { cv.width = innerWidth; cv.height = innerHeight; }
    const W = cv0.width, H = cv0.height, C = center();
    c0.clearRect(0, 0, W, H); c1.clearRect(0, 0, W, H);
    c0.imageSmoothingEnabled = c1.imageSmoothingEnabled = false;
    // 光の筋(回る扇)と中心の光
    S.raysA += (S.rays - S.raysA) * Math.min(1, dt * 4);
    if (S.raysA > 0.01) {
      const n = 20, RR = Math.hypot(W, H), a0 = T * S.rayK;
      c0.save(); c0.globalCompositeOperation = 'lighter';
      for (let i = 0; i < n; i++) {
        const a = a0 + i * TAU / n;
        c0.globalAlpha = Math.min(1, S.raysA) * 0.2; c0.fillStyle = S.rayCols[i % S.rayCols.length];
        c0.beginPath(); c0.moveTo(C.x, C.y); c0.arc(C.x, C.y, RR, a, a + TAU / n * 0.42); c0.closePath(); c0.fill();
      }
      for (let i = 0; i < 12; i++) { // 逆に回る細い白い筋
        const a = -a0 * 1.6 + i * TAU / 12;
        c0.globalAlpha = Math.min(1, S.raysA) * 0.07; c0.fillStyle = '#ffffff';
        c0.beginPath(); c0.moveTo(C.x, C.y); c0.arc(C.x, C.y, RR, a, a + TAU / 12 * 0.12); c0.closePath(); c0.fill();
      }
      const g = c0.createRadialGradient(C.x, C.y, 0, C.x, C.y, 420);
      g.addColorStop(0, S.rayCols[0]); g.addColorStop(1, 'rgba(0,0,0,0)');
      c0.globalAlpha = Math.min(1, S.raysA) * 0.5; c0.fillStyle = g; c0.fillRect(C.x - 420, C.y - 420, 840, 840);
      c0.restore();
    }
    // 玉: 落ちて弾み、溜めの間は震えながら膨らむ
    const o = S.orb;
    if (o.vis) {
      if (S.phase === 'charge') { const p = clamp((T - S.chargeT0) / S.chargeDur, 0, 1); o.shake = 2 + 12 * p * p; o.swell = 0.3 * p; o.glow = p; }
      const k = clamp((T - o.t0) / 0.55, 0, 1), y = C.y - (1 - easeOutBounce(k)) * (C.y + 160);
      const ox = C.x + o.shake * (Math.random() * 2 - 1), oy = y + o.shake * 0.5 * (Math.random() * 2 - 1);
      const sp = orbSprite(o.col), w = Math.round(sp.width * 6 * (1 + o.swell));
      c0.save(); c0.globalCompositeOperation = 'lighter';
      const R = 110 * (1 + o.swell) * (1 + o.glow * 0.8), g = c0.createRadialGradient(ox, oy, 0, ox, oy, R);
      g.addColorStop(0, o.col); g.addColorStop(1, 'rgba(0,0,0,0)');
      c0.globalAlpha = 0.35 + o.glow * 0.45; c0.fillStyle = g; c0.fillRect(ox - R, oy - R, R * 2, R * 2);
      c0.restore();
      c0.drawImage(sp, Math.round(ox - w / 2), Math.round(oy - w / 2), w, w);
      if (o.flash > 0) { c0.save(); c0.globalCompositeOperation = 'lighter'; c0.globalAlpha = Math.min(1, o.flash); c0.drawImage(sp, Math.round(ox - w / 2), Math.round(oy - w / 2), w, w); c0.drawImage(sp, Math.round(ox - w / 2), Math.round(oy - w / 2), w, w); c0.restore(); o.flash -= dt * 3; }
      if (S.phase === 'charge') for (let i = 0; i < 3; i++) { // 光の粒が玉へ吸い込まれる
        const an = Math.random() * TAU, r = 240 + Math.random() * 220;
        S.parts.push({ k: 'suck', x: ox + Math.cos(an) * r, y: oy + Math.sin(an) * r, tx: ox, ty: oy, t: 0, life: 0.55, col: Math.random() < 0.5 ? o.col : '#ffffff', s: 3 + Math.random() * 4 });
      }
    }
    // 衝撃の輪
    c0.save(); c0.globalCompositeOperation = 'lighter';
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const R = S.rings[i]; R.t += dt;
      if (R.t >= R.life) { S.rings.splice(i, 1); continue; }
      if (R.t < 0) continue;
      const f = R.t / R.life, r = R.r0 + R.v * easeOutCubic(f) * R.life;
      c0.globalAlpha = 1 - f; c0.strokeStyle = R.col; c0.lineWidth = Math.max(1, R.w * (1 - f));
      c0.beginPath(); c0.arc(C.x, C.y, r, 0, TAU); c0.stroke();
    }
    c0.restore();
    // ミシック: 下から火の粉が昇り続ける
    if (S.embers) for (let i = 0; i < 2; i++) S.parts.push({ k: 'ember', x: Math.random() * W, y: H + 10, vx: (Math.random() - 0.5) * 40, vy: -120 - Math.random() * 200, g: 0, drag: 0, t: 0, life: 3 + Math.random() * 2, col: pick(['#ff3b5c', '#ff8a9a', '#ffd23f']), s: 3 + Math.random() * 4, rot: 0, vr: 0, seed: Math.random() * 10 });
    // 粒(カードの前)
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i]; p.t += dt;
      if (p.t >= p.life) { S.parts.splice(i, 1); continue; }
      const f = 1 - p.t / p.life;
      if (p.k === 'suck') {
        const e = easeOutCubic(p.t / p.life);
        c1.globalCompositeOperation = 'lighter'; c1.globalAlpha = f; c1.fillStyle = p.col;
        c1.fillRect(lerp(p.x, p.tx, e) - p.s / 2, lerp(p.y, p.ty, e) - p.s / 2, p.s, p.s);
        continue;
      }
      p.vy += p.g * dt; p.vx *= Math.exp(-p.drag * dt); p.vy *= Math.exp(-p.drag * dt);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      c1.globalAlpha = Math.min(1, f * 2.5);
      if (p.k === 'coin') {
        c1.globalCompositeOperation = 'source-over';
        const img = coinImgs[Math.floor(p.t * 10 + p.seed) % coinImgs.length];
        c1.drawImage(img, p.x - img.width * p.s / 2, p.y - img.height * p.s / 2, img.width * p.s, img.height * p.s);
      } else if (p.k === 'conf') {
        c1.globalCompositeOperation = 'source-over';
        c1.save(); c1.translate(p.x, p.y); c1.rotate(p.rot); c1.scale(1, Math.cos(p.t * 9 + p.seed));
        c1.fillStyle = p.col; c1.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); c1.restore();
      } else if (p.k === 'star') {
        c1.globalCompositeOperation = 'lighter'; c1.fillStyle = p.col;
        const s = p.s * (0.6 + 0.4 * Math.sin(p.t * 18 + p.seed)) * f, w = Math.max(1, s / 5);
        c1.fillRect(p.x - s, p.y - w / 2, s * 2, w); c1.fillRect(p.x - w / 2, p.y - s, w, s * 2);
      } else {
        c1.globalCompositeOperation = 'lighter'; c1.fillStyle = p.col;
        const s = p.s * (p.k === 'ember' ? 0.5 + 0.5 * Math.sin(p.t * 12 + p.seed) : f);
        c1.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
    }
    // 稲妻(外側の光 + 白い芯。またたく)
    for (let i = S.bolts.length - 1; i >= 0; i--) {
      const B = S.bolts[i]; B.t += dt;
      if (B.t >= B.life) { S.bolts.splice(i, 1); continue; }
      if (Math.floor(B.t * 40) % 3 === 2) continue;
      c1.globalCompositeOperation = 'lighter';
      for (const [w, col, a] of [[12, B.col, 0.35], [5, B.col, 0.8], [2, '#ffffff', 1]]) {
        c1.globalAlpha = a * (1 - B.t / B.life); c1.strokeStyle = col; c1.lineWidth = w;
        c1.beginPath(); B.pts.forEach(([x, y], j) => (j ? c1.lineTo(x, y) : c1.moveTo(x, y))); c1.stroke();
      }
    }
    c1.globalAlpha = 1; c1.globalCompositeOperation = 'source-over';
    // ミシックの数字が上がっていく
    if (S.count) {
      const e = easeOutCubic((T - S.count.t0) / S.count.dur);
      setOpts(S.it.opts.map((o, i) => tween(S.fake[i], o, e)));
      if (e >= 1) S.count = null;
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------- カード ----------
  function cardHTML(it, rar, opts) {
    const R = DATA.equip.rarity[rar];
    return `<div class="card-head"><span style="color:${R.col}">${R.name}</span> ${DATA.equip.slots[itemSlot(it)]}</div>
      <div class="card-icon"><img class="big" src="${ART.S.eqIcons[it.type].c.toDataURL()}" alt=""></div>
      <div class="card-name">${itemName(it)}</div>
      <div class="card-body"></div>`;
  }
  function setOpts(opts) {
    const it = show.it, body = $('gc-card').querySelector('.card-body');
    if (!body) return;
    body.innerHTML = opts.map(o => `<div class="opt">${optHTML(o)} <em>${_t`〜Lv${o.max}`}</em></div>`).join('') + (it.uq ? `<p class="uq">${DATA.uniques[it.uq].desc}</p>` : '');
  }
  function showCard(rar, opts, cls = 'gc-in') {
    const c = $('gc-card');
    c.className = 'card ' + RAR_CLS[rar] + ' ' + cls;
    c.innerHTML = cardHTML(show.it, rar, opts);
    setOpts(opts);
    Help.glossify(c.querySelector('.card-body'));
  }
  // ミシックの昇格前に見せるレジェンダリーの値(ロール値・最大Lv は本当の値より低く)
  function fakeOpt(it, o, st) {
    const f = rollOpt(it.type, o.k, st), unit = DATA.stats[o.k].kind === 'flat' ? 10 : 1000;
    return { k: o.k, v: Math.min(f.v, Math.floor(o.v * 0.8 * unit) / unit), max: Math.min(f.max, o.max - 1) };
  }
  function tween(a, b, e) { const unit = DATA.stats[b.k].kind === 'flat' ? 10 : 1000; return { k: b.k, v: Math.round(lerp(a.v, b.v, e) * unit) / unit, max: Math.round(lerp(a.max, b.max, e)) }; }
  function label(rar) {
    const L = $('gc-label');
    L.textContent = FX[rar].label; L.dataset.r = rar;
    L.className = ''; void L.offsetWidth; L.className = 'in';
  }

  // ---------- 流れ ----------
  function play(t, it) {
    stop();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Enter で後ろのボタンが押されないように
    const rar = it.rarity, F = FX[rar], st = gachaStats(t);
    show = { t, it, rar, timers: [], parts: [], rings: [], bolts: [], rays: 0, raysA: 0, rayCols: [ORB_COLS[0]], rayK: 0.3, embers: false, done: false, phase: 'drop', count: null, sound: false,
      orb: { t0: now(), col: ORB_COLS[0], vis: true, shake: 0, swell: 0, glow: 0, flash: 0 },
      fake: rar === 'mythic' ? it.opts.map(o => fakeOpt(it, o, st)) : null };
    const box = $('gc-show');
    box.className = '';
    $('gc-label').className = ''; $('gc-label').textContent = '';
    $('gc-card').className = ''; $('gc-card').innerHTML = '';
    $('gc-btns').classList.add('off');
    $('gc-hint').textContent = _t('クリック / SPACE で飛ばす');
    AudioMan.setDuck(0.3);
    last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
    const B = 1500 + F.up * 500; // 割れる時刻(ms)。色が上がる段の数だけ溜めが長い
    at(430, () => { AudioMan.gachaDrop(); show.orb.flash = 0.7; ring('#ffffff', 0.4); const C = center(); burst(C.x, C.y + 60, 18, 'spark', ['#ffffff', ORB_COLS[0]], { sp: 380, g: 300, life: 0.7, up: true, spread: 3 }); });
    at(650, () => { show.phase = 'charge'; show.chargeT0 = now(); show.chargeDur = (B - 650) / 1000; AudioMan.drumroll(show.chargeDur); });
    for (let k = 1; k <= F.up; k++) at(1050 + (k - 1) * 500, () => orbUp(k));
    at(B, () => openOrb(rar === 'mythic' ? 'legendary' : rar));
    if (rar === 'mythic') at(B + 2000, promote);
    else at(B + 1300, finish);
  }
  // 玉の色が1段上がる
  function orbUp(k) {
    const o = show.orb, col = ORB_COLS[k], C = center();
    o.col = col; o.flash = 1.2;
    ring(col, 0.6 + k * 0.15);
    burst(C.x, C.y, 30 + k * 20, 'spark', [col, '#ffffff'], { sp: 500 + k * 120, g: 0, drag: 2.5, life: 0.8 });
    burst(C.x, C.y, 6 + k * 4, 'star', [col, '#ffffff'], { sp: 300, g: 0, drag: 2, life: 0.9 });
    flash(col, 0.25 + k * 0.08); quake(false);
    show.rays = 0.2 * k; show.rayCols = [col, '#ffffff'];
    AudioMan.gachaUp(k - 1);
  }
  // 玉が割れる(rar: 見せるレアリティ。ミシックはまずレジェンダリー)
  function openOrb(rar) {
    const S = show, F = FX[rar], rank = RANK[rar], C = center();
    S.phase = 'open'; S.orb.vis = false;
    flash('#ffffff', 0.95); quake(rank >= 3);
    for (let i = 0; i < 2 + Math.min(3, rank); i++) ring(F.cols[i % F.cols.length], 1 + rank * 0.15, i * 0.09);
    S.rays = 0.5 + rank * 0.15; S.rayCols = F.cols; S.rayK = 0.25 + rank * 0.07;
    burst(C.x, C.y, F.n * 0.5, 'spark', F.cols, { sp: 800 + rank * 120, g: 0, drag: 2.4, life: 1.1 });
    burst(C.x, C.y, F.n * 0.6, 'conf', F.cols, { sp: 1200, g: 500, drag: 1.4, life: 3.2 });
    burst(C.x, C.y, 10 + rank * 6, 'star', F.cols, { sp: 600, g: 0, drag: 1.6, life: 1.4 });
    if (rank >= 2) burst(C.x, C.y, rank * 30, 'coin', ['#ffd23f'], { sp: 1100, up: true, spread: 2.2, g: 1500, life: 2.6 });
    if (rank >= 3) [320, 680].forEach(d => at(d, () => { // 大当たりは時間差で紙吹雪とコインの噴水
      burst(C.x, C.y, rank * 18, 'coin', ['#ffd23f'], { sp: 1000, up: true, spread: 1.8, g: 1500 });
      burst(Math.random() * innerWidth, innerHeight + 10, 50 + rank * 10, 'conf', F.cols, { sp: 1400, up: true, spread: 0.6, g: 700, drag: 1 });
      ring(pick(F.cols), 0.8);
    }));
    AudioMan.gachaBurst(rank);
    at(140, () => { AudioMan.gachaFanfare(rank); if (S.rar === rar) S.sound = true; }); // ミシックはまだ(飛ばしたらミシックの音を鳴らす)
    label(rar);
    at(260, () => showCard(rar, S.fake || S.it.opts));
  }
  // ミシックへの昇格: 色あせ・鼓動・赤い稲妻・文字が乱れる → ひび → 赤い大爆発
  function promote() {
    const S = show;
    S.phase = 'promo';
    $('gc-show').classList.add('promo');
    $('gc-label').classList.add('glitch');
    $('gc-card').classList.add('throb');
    S.rays = 0.35; S.rayCols = ['#ff3b5c', '#a0122a']; S.rayK = 0.1;
    AudioMan.gachaPromote();
    [260, 680, 1100].forEach((d, i) => at(d, () => { for (let j = 0; j < 2 + i; j++) bolt('#ff3b5c'); flash('#ff3b5c', 0.18 + i * 0.1); quake(i === 2); AudioMan.zap(); }));
    at(1300, () => { $('gc-card').classList.add('crack'); $('gc-label').classList.add('break'); AudioMan.frost(); });
    at(1750, mythic);
  }
  function mythic() {
    const S = show, F = FX.mythic, C = center();
    S.phase = 'open';
    $('gc-show').classList.remove('promo');
    flash('#ff3b5c', 1); at(120, () => flash('#ffffff', 0.9)); quake(true);
    for (let i = 0; i < 5; i++) ring(F.cols[i % F.cols.length], 1.6, i * 0.08);
    S.rays = 1.3; S.rayCols = F.cols; S.rayK = 0.55; S.embers = true;
    burst(C.x, C.y, F.n * 0.6, 'spark', F.cols, { sp: 1400, g: 0, drag: 2.2, life: 1.3 });
    burst(C.x, C.y, F.n * 0.7, 'conf', F.cols, { sp: 1500, g: 500, drag: 1.3, life: 3.6 });
    burst(C.x, C.y, 40, 'star', F.cols, { sp: 900, g: 0, drag: 1.4, life: 1.6 });
    burst(C.x, C.y, 160, 'coin', ['#ffd23f'], { sp: 1300, up: true, spread: 2.6, g: 1500, life: 3 });
    [400, 800, 1200].forEach(d => at(d, () => { burst(Math.random() * innerWidth, innerHeight + 10, 90, 'conf', F.cols, { sp: 1500, up: true, spread: 0.6, g: 700, drag: 1 }); ring(pick(F.cols), 1); }));
    AudioMan.gachaMythic(); S.sound = true;
    label('mythic');
    showCard('mythic', S.fake, 'gc-promo');
    S.count = { t0: now() + 0.25, dur: 0.9 }; // 値が本当の上限まで上がる
    at(1700, finish);
  }
  function finish() {
    const S = show;
    if (!S || S.done) return;
    S.done = true; S.phase = 'done';
    for (const id of S.timers) clearTimeout(id);
    $('gc-hint').textContent = '';
    const T = DATA.gacha.tiers[S.t], b = gachaBlock(S.t), ag = $('gc-again');
    ag.innerHTML = b === 'full' ? _t('インベントリが一杯') : _t`もう1回 ● ${T.price}`; ag.disabled = !!b;
    $('gc-btns').classList.remove('off');
  }
  // 飛ばす: 最後の形にする(音がまだなら当たりの音だけ鳴らす)
  function skip() {
    const S = show;
    if (!S || S.done) return;
    for (const id of S.timers) clearTimeout(id);
    S.timers = []; S.orb.vis = false; S.count = null; S.bolts = [];
    const F = FX[S.rar], C = center();
    $('gc-show').classList.remove('promo');
    S.rays = S.rar === 'mythic' ? 1.3 : 0.5 + RANK[S.rar] * 0.15; S.rayCols = F.cols; S.rayK = 0.25 + RANK[S.rar] * 0.07; S.embers = S.rar === 'mythic';
    flash('#ffffff', 0.6);
    burst(C.x, C.y, F.n * 0.4, 'spark', F.cols, { sp: 900, g: 0, drag: 2.4, life: 1 });
    burst(C.x, C.y, F.n * 0.4, 'conf', F.cols, { sp: 1100, g: 500, drag: 1.4, life: 2.6 });
    if (!S.sound) { if (S.rar === 'mythic') AudioMan.gachaMythic(); else AudioMan.gachaFanfare(RANK[S.rar]); S.sound = true; }
    label(S.rar);
    showCard(S.rar, S.it.opts, 'gc-in');
    finish();
  }
  function stop() {
    if (show) for (const id of show.timers) clearTimeout(id);
    show = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    c0.clearRect(0, 0, cv0.width, cv0.height); c1.clearRect(0, 0, cv1.width, cv1.height);
  }
  function close() {
    stop();
    $('gc-show').className = 'hidden';
    AudioMan.setDuck(1);
    render();
  }
  function again() { if (!show || !show.done || $('gc-again').disabled) return; AudioMan.coin(); pull(show.t); }
  $('gc-show').onclick = e => { if (e.target.closest('#gc-btns')) return; if (show && !show.done) skip(); };
  $('gc-again').onclick = again;
  $('gc-ok').onclick = () => { AudioMan.click(); close(); };

  function onKey(e) {
    if (state !== 'gacha' || e.repeat) return;
    const go = e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape';
    if (show) {
      if (go && e.preventDefault) e.preventDefault();
      if (!show.done) { if (go) skip(); }
      else if (go) close();
      else if (e.code === 'KeyR') again();
      return;
    }
    if (e.code === 'Escape') { state = 'title'; UI.title(); }
  }

  return { open, onKey };
})();
