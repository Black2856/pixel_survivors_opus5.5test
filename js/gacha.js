// gacha.js — ガチャの画面と演出(ラン外。2026-10-13 にショップから変えた)
//   画面: 一般・高級・最高級の3台(値段・カオス強化の何 pt 相当か・その上限)。1回と 10連(値段は 1回の 10倍)。レアリティの確率
//   演出(派手に): 玉が落ちる → 溜め(一番良いレアリティが高いほど、玉の色が 白 → 青 → 紫 → 金 と段を上がる)→ 割れる(光の筋・衝撃の輪・紙吹雪・コイン)
//     1回: レアリティの文字 → 装備のカード
//     10連: 玉からカード 10枚が裏向きに飛び出し(裏の色でレアリティを匂わせる)、1枚ずつめくる → 一番良いレアリティの文字
//     ミシックはレジェンダリーとして出たあと、昇格(色あせ・鼓動・赤い稲妻・文字の乱れ・カードのひび)→ 赤い大爆発 → ミシック(値が上限まで上がる)
//   ボタン(もう1回・OK)はレアリティの文字が出たときに出す。ミシックはレジェンダリーの文字のときも出し(先にばれないように)、昇格の間は隠す。昇格の前に押すと最後まで飛ばす
//   クリック / SPACE / Enter / ESC で最後まで飛ばす。引いた装備は演出の前にインベントリへ入れて保存してある(途中で閉じても失われない)
'use strict';

const Gacha = (() => {
  const $ = id => document.getElementById(id);
  const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
  // レアリティごとの演出: up = 玉の色が何段上がるか / label = 文字 / cols = 光の筋・粒の色 / n = 粒の数
  const FX = {
    common:    { up: 0, label: 'COMMON',        cols: ['#c8c8d0', '#ffffff'], n: 50 },
    uncommon:  { up: 0, label: 'UNCOMMON!',     cols: ['#5dff8a', '#c8ffd8', '#ffffff'], n: 80 },
    rare:      { up: 1, label: 'RARE!!',        cols: ['#5ab8ff', '#9ff7ff', '#ffffff'], n: 130 },
    epic:      { up: 2, label: 'EPIC!!!',       cols: ['#c78bff', '#ff6ec7', '#9ff7ff', '#ffffff'], n: 210 },
    legendary: { up: 3, label: 'LEGENDARY!!!!', cols: ['#ffb347', '#ffd23f', '#ff6a2a', '#ff6ec7', '#ffffff'], n: 320 },
    mythic:    { up: 3, label: 'MYTHIC!!!!!',   cols: ['#ff3b5c', '#ff8a9a', '#ffd23f', '#a0122a', '#ffffff'], n: 420 },
  };
  const ORB_COLS = ['#e8e4f8', '#5ab8ff', '#c78bff', '#ffb347']; // 玉の色の段(10連のカードの裏の色も): 白 → 青 → 紫 → 金
  const RAR_CLS = { common: 'common', uncommon: 'new', rare: 'rare', epic: 'epic', legendary: 'legend', mythic: 'mythic' }; // カードの見た目(選択カードと同じ)
  const MULTI = DATA.gacha.multi;
  const asShown = r => (r === 'mythic' ? 'legendary' : r); // 昇格の前の見え方
  const bestOf = its => its.reduce((a, it) => (RANK[it.rarity] > RANK[a] ? it.rarity : a), 'common');

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
  const iconCache = {};
  const iconURL = type => iconCache[type] || (iconCache[type] = ART.S.eqIcons[type].c.toDataURL());

  // ---------- 画面 ----------
  function open() { state = 'gacha'; UI.only('gacha-screen'); render(); }
  function render() {
    $('gc-gold').textContent = '● ' + META.gold.toLocaleString() + ' G';
    const btn = (i, n) => {
      const b = gachaBlock(i, n), p = (DATA.gacha.tiers[i].price * n).toLocaleString();
      return `<button class="btn gc-pull${n > 1 ? ' ten' : ''}" data-t="${i}" data-n="${n}" ${b ? 'disabled' : ''}>${b === 'full' ? _t('インベントリが一杯') : n > 1 ? _t`${n}連 ● ${p}` : _t`1回 ● ${p}`}</button>`;
    };
    $('gc-list').innerHTML = DATA.gacha.tiers.map((T, i) => {
      const st = gachaStats(i);
      return `<div class="gc-m" style="--gc:${T.col}">
        <div class="gc-nm">${T.name}</div>
        <img class="gc-orb" src="${orbSprite(T.col).toDataURL()}" alt="">
        <div class="gc-pt">${_t`カオス強化 ${T.pt} pt 相当`}</div>
        <div class="gc-cap">${_t`装備ロール上限 +${Math.round(st.eqMaxVal * 100)}%`}<br>${_t`装備Lv上限 +${st.eqMaxLv}`}</div>
        ${btn(i, 1)}${btn(i, MULTI)}
      </div>`;
    }).join('');
    const R = DATA.gacha.rates;
    $('gc-rates').innerHTML = Object.keys(R).map(k => `<span style="color:${DATA.equip.rarity[k].col}">${DATA.equip.rarity[k].name} <b>${R[k]}%</b></span>`).join('')
      + `<span class="note">${_t('どのガチャもレアリティの確率は同じ。高いガチャほどロール値・最大Lv の上限が高い。ミシックはレジェンダリーの全オプションがその上限')}</span>`;
    Help.glossify($('gc-list'), { per: '.gc-cap' });
  }
  function pull(t, n) {
    const its = gachaPull(t, n);
    if (!its) { AudioMan.hurt(); return; }
    render(); // 払ったゴールド
    play(t, its);
  }
  $('gc-list').onclick = e => { const b = e.target.closest('.gc-pull'); if (b && !b.disabled) { AudioMan.coin(); pull(+b.dataset.t, +b.dataset.n); } };
  $('gc-back').onclick = () => { AudioMan.click(); state = 'title'; UI.title(); };
  $('btn-gacha').onclick = () => { AudioMan.click(); open(); };

  // ---------- 演出 ----------
  const cv0 = $('gc-cv0'), cv1 = $('gc-cv1'), c0 = cv0.getContext('2d'), c1 = cv1.getContext('2d');
  const coinImgs = ART.S.coin.map(sp => sp.c);
  let show = null, raf = 0, last = 0;
  const now = () => performance.now() / 1000;
  const centerOf = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
  const center = () => centerOf($(show && show.multi ? 'gc-grid' : 'gc-slot')); // 玉と光の中心(1回はカードの場所、10連はカードの並びの真ん中)
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
  // 衝撃の輪(p: 中心。無ければ玉の位置)
  const ring = (col, k = 1, d = 0, p = null) => show.rings.push({ col, p, t: -d, life: 0.7 + 0.3 * k, r0: 30 * Math.min(1, k + 0.3), v: 900 * k, w: 10 * Math.min(1, k + 0.3) });
  // 稲妻: 画面の端から p へ。折れ線の点をずらして作る
  function bolt(col, p) {
    const C = p || center(), an = Math.random() * TAU, R = Math.max(innerWidth, innerHeight) * 0.7, pts = [], n = 14;
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
      const f = R.t / R.life, r = R.r0 + R.v * easeOutCubic(f) * R.life, P = R.p || C;
      c0.globalAlpha = 1 - f; c0.strokeStyle = R.col; c0.lineWidth = Math.max(1, R.w * (1 - f));
      c0.beginPath(); c0.arc(P.x, P.y, r, 0, TAU); c0.stroke();
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
    for (let i = S.counts.length - 1; i >= 0; i--) {
      const q = S.counts[i], e = easeOutCubic((T - q.t0) / q.dur);
      setOpts(q.el, q.it, q.it.opts.map((op, j) => tween(q.fake[j], op, e)), q.mini);
      if (e >= 1) S.counts.splice(i, 1);
    }
    raf = requestAnimationFrame(loop);
  }

  // ---------- カード(mini: 10連の小さいカード)----------
  function setOpts(el, it, opts, mini) {
    const body = el.querySelector('.card-body');
    if (!body) return;
    body.innerHTML = mini
      ? opts.map(o => `<div class="opt">${DATA.stats[o.k].label} <span class="ov">${optVal(o)}</span> <em>Lv${o.max}</em></div>`).join('') + (it.uq ? `<p class="uq">★ ${DATA.uniques[it.uq].desc}</p>` : '')
      : opts.map(o => `<div class="opt">${optHTML(o)} <em>${_t`〜Lv${o.max}`}</em></div>`).join('') + (it.uq ? `<p class="uq">${DATA.uniques[it.uq].desc}</p>` : '');
  }
  // カードを表にする(rar: 見せるレアリティ / opts: 見せる値 / cls: 出る動き)
  function face(el, it, rar, opts, mini, cls = '') {
    const R = DATA.equip.rarity[rar];
    el.className = (mini ? 'gc-mini ' : '') + 'card ' + RAR_CLS[rar] + (cls ? ' ' + cls : '');
    el.innerHTML = `<div class="card-head"><span style="color:${R.col}">${R.name}</span>${mini ? '' : ' ' + DATA.equip.slots[itemSlot(it)]}</div>
      <div class="card-icon"><img class="big" src="${iconURL(it.type)}" alt=""></div>
      <div class="card-name">${itemName(it)}</div>
      <div class="card-body"></div>`;
    setOpts(el, it, opts, mini);
    if (!mini) Help.glossify(el.querySelector('.card-body'));
  }
  // ミシックの昇格前に見せるレジェンダリーの値(ロール値・最大Lv は本当の値より低く)
  function fakeOpt(it, o, st) {
    const f = rollOpt(it.type, o.k, st), unit = DATA.stats[o.k].kind === 'flat' ? 10 : 1000;
    return { k: o.k, v: Math.min(f.v, Math.floor(o.v * 0.8 * unit) / unit), max: Math.min(f.max, o.max - 1) };
  }
  function tween(a, b, e) { const unit = DATA.stats[b.k].kind === 'flat' ? 10 : 1000; return { k: b.k, v: Math.round(lerp(a.v, b.v, e) * unit) / unit, max: Math.round(lerp(a.max, b.max, e)) }; }
  const optsShown = it => show.fake.get(it) || it.opts;
  function label(rar) {
    const L = $('gc-label');
    L.textContent = FX[rar].label; L.dataset.r = rar;
    L.className = ''; void L.offsetWidth; L.className = 'in';
  }
  // ボタン(もう1回・OK)。出ている間は ready
  function showBtns(on) {
    const S = show, bx = $('gc-btns');
    if (!on) { bx.classList.add('off'); if (S) S.ready = false; return; }
    const n = S.its.length, b = gachaBlock(S.t, n), p = (DATA.gacha.tiers[S.t].price * n).toLocaleString(), ag = $('gc-again');
    ag.innerHTML = b === 'full' ? _t('インベントリが一杯') : n > 1 ? _t`もう${n}連 ● ${p}` : _t`もう1回 ● ${p}`;
    ag.disabled = !!b;
    bx.classList.remove('off'); S.ready = true;
    $('gc-hint').textContent = '';
  }

  // ---------- 流れ ----------
  function play(t, its) {
    stop();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Enter で後ろのボタンが押されないように
    const multi = its.length > 1, best = bestOf(its), F = FX[asShown(best)], st = gachaStats(t);
    show = { t, its, multi, best, timers: [], parts: [], rings: [], bolts: [], counts: [], rays: 0, raysA: 0, rayCols: [ORB_COLS[0]], rayK: 0.3, embers: false,
      done: false, ready: false, pending: best === 'mythic', phase: 'drop', sound: false, dealt: false,
      orb: { t0: now(), col: ORB_COLS[0], vis: true, shake: 0, swell: 0, glow: 0, flash: 0 },
      fake: new Map(its.filter(it => it.rarity === 'mythic').map(it => [it, it.opts.map(o => fakeOpt(it, o, st))])) };
    $('gc-show').className = multi ? 'multi' : '';
    $('gc-label').className = ''; $('gc-label').textContent = '';
    $('gc-card').className = ''; $('gc-card').innerHTML = ''; $('gc-grid').innerHTML = '';
    showBtns(false);
    $('gc-hint').textContent = TOUCH_UI ? _t('タップで飛ばす') : _t('クリック / SPACE で飛ばす');
    AudioMan.setDuck(0.3);
    last = performance.now(); if (!raf) raf = requestAnimationFrame(loop);
    const B = 1500 + F.up * 500; // 割れる時刻(ms)。色が上がる段の数だけ溜めが長い
    at(430, () => { AudioMan.gachaDrop(); show.orb.flash = 0.7; ring('#ffffff', 0.4); const C = center(); burst(C.x, C.y + 60, 18, 'spark', ['#ffffff', ORB_COLS[0]], { sp: 380, g: 300, life: 0.7, up: true, spread: 3 }); });
    at(650, () => { show.phase = 'charge'; show.chargeT0 = now(); show.chargeDur = (B - 650) / 1000; AudioMan.drumroll(show.chargeDur); });
    for (let k = 1; k <= F.up; k++) at(1050 + (k - 1) * 500, () => orbUp(k));
    at(B, multi ? openMulti : openOne);
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
  // 1回: 玉が割れる → 文字とボタン → カード(ミシックはまずレジェンダリー)
  function openOne() {
    const S = show, it = S.its[0], rar = asShown(it.rarity), F = FX[rar], rank = RANK[rar], C = center();
    S.phase = 'open'; S.orb.vis = false;
    flash('#ffffff', 0.95); quake(rank >= 3);
    for (let i = 0; i < 2 + Math.min(3, rank); i++) ring(F.cols[i % F.cols.length], 1 + rank * 0.15, i * 0.09);
    S.rays = 0.5 + rank * 0.15; S.rayCols = F.cols; S.rayK = 0.25 + rank * 0.07;
    burst(C.x, C.y, F.n * 0.5, 'spark', F.cols, { sp: 800 + rank * 120, g: 0, drag: 2.4, life: 1.1 });
    burst(C.x, C.y, F.n * 0.6, 'conf', F.cols, { sp: 1200, g: 500, drag: 1.4, life: 3.2 });
    burst(C.x, C.y, 10 + rank * 6, 'star', F.cols, { sp: 600, g: 0, drag: 1.6, life: 1.4 });
    if (rank >= 2) burst(C.x, C.y, rank * 30, 'coin', ['#ffd23f'], { sp: 1100, up: true, spread: 2.2, g: 1500, life: 2.6 });
    if (rank >= 3) fountains(F, rank);
    AudioMan.gachaBurst(rank);
    at(140, () => { AudioMan.gachaFanfare(rank); if (it.rarity === rar) S.sound = true; }); // ミシックはまだ(飛ばしたらミシックの音を鳴らす)
    label(rar); showBtns(true);
    at(260, () => face($('gc-card'), it, rar, optsShown(it), false, 'gc-in'));
    if (it.rarity === 'mythic') at(2000, promote);
    else at(1300, finish);
  }
  // 大当たりは時間差で紙吹雪とコインの噴水
  function fountains(F, rank) {
    const C = center();
    [320, 680].forEach(d => at(d, () => {
      burst(C.x, C.y, rank * 18, 'coin', ['#ffd23f'], { sp: 1000, up: true, spread: 1.8, g: 1500 });
      burst(Math.random() * innerWidth, innerHeight + 10, 50 + rank * 10, 'conf', F.cols, { sp: 1400, up: true, spread: 0.6, g: 700, drag: 1 });
      ring(pick(F.cols), 0.8);
    }));
  }
  // 10連: 玉が割れて、カードが裏向きに飛び出す → 1枚ずつめくる(良いカードの前は少し間をあける)→ 一番良いレアリティの文字とボタン
  function openMulti() {
    const S = show, rar = asShown(S.best), F = FX[rar], rank = RANK[rar], C = center();
    S.phase = 'open'; S.orb.vis = false;
    flash('#ffffff', 0.9); quake(rank >= 3);
    for (let i = 0; i < 2 + Math.min(2, rank); i++) ring(F.cols[i % F.cols.length], 1 + rank * 0.1, i * 0.09);
    S.rays = 0.35 + rank * 0.08; S.rayCols = F.cols; S.rayK = 0.2 + rank * 0.05;
    burst(C.x, C.y, F.n * 0.35, 'spark', F.cols, { sp: 900, g: 0, drag: 2.4, life: 1 });
    burst(C.x, C.y, F.n * 0.3, 'conf', F.cols, { sp: 1100, g: 500, drag: 1.4, life: 2.8 });
    AudioMan.gachaBurst(Math.min(3, rank));
    deal(true);
    let d = 650;
    S.its.forEach((it, i) => { const r = RANK[it.rarity]; if (r >= 4) d += 380; at(d, () => flip(i)); d += r >= 4 ? 450 : r >= 3 ? 260 : 170; });
    at(d + 200, endMulti);
  }
  // 10枚を裏向きに並べる。裏の色 = 玉の色の段(青 = レア・紫 = エピック・金 = レジェンダリー以上。レア以上は脈打つ)/ anim: 玉の位置から飛び出す
  function deal(anim) {
    const S = show, g = $('gc-grid');
    g.innerHTML = S.its.map((it, i) => `<div class="gc-mini back${RANK[it.rarity] >= 2 ? ' hot' : ''}" style="--tc:${ORB_COLS[FX[asShown(it.rarity)].up]};--i:${i}"></div>`).join('');
    S.dealt = true;
    if (!anim) return;
    const C = center(), z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--uc')) || 1; // 引いた画面の拡大率(core.js の applyUiScale)
    for (const el of g.children) { const c = centerOf(el); el.style.setProperty('--dx', (C.x - c.x) / z + 'px'); el.style.setProperty('--dy', (C.y - c.y) / z + 'px'); el.classList.add('deal'); }
  }
  function flip(i) {
    const S = show, it = S.its[i], el = $('gc-grid').children[i], rar = asShown(it.rarity), F = FX[rar], rank = RANK[rar], c = centerOf(el);
    face(el, it, rar, optsShown(it), true, 'flip');
    burst(c.x, c.y, 12 + rank * 14, 'spark', F.cols, { sp: 260 + rank * 110, g: 0, drag: 2.6, life: 0.7 });
    if (rank >= 2) ring(F.cols[0], 0.3 + rank * 0.08, 0, c);
    if (rank >= 3) burst(c.x, c.y, 4 + rank * 3, 'star', F.cols, { sp: 260, g: 0, drag: 2, life: 0.9 });
    if (rank >= 4) { flash('#ffb347', 0.4); quake(false); burst(c.x, c.y, 40, 'coin', ['#ffd23f'], { sp: 900, up: true, spread: 2, g: 1500, life: 2.2 }); AudioMan.gachaUp(2); }
    else if (rank === 3) AudioMan.gachaUp(1);
    else AudioMan.land(Math.min(3, rank));
  }
  function endMulti() {
    const S = show, rar = asShown(S.best), F = FX[rar], rank = RANK[rar];
    label(rar); showBtns(true);
    S.rays = 0.5 + rank * 0.15; S.rayK = 0.25 + rank * 0.07;
    AudioMan.gachaFanfare(rank); if (S.best === rar) S.sound = true;
    if (rank >= 3) fountains(F, rank);
    if (S.best === 'mythic') at(1800, promote);
    else at(900, finish);
  }
  // ミシックのカード(1回は大きいカード、10連はミシックの小さいカード)
  const mythicCards = () => (show.multi ? show.its.map((it, i) => (it.rarity === 'mythic' ? [$('gc-grid').children[i], it] : null)).filter(Boolean) : [[$('gc-card'), show.its[0]]]);
  // ミシックへの昇格: ボタンを隠す・色あせ・鼓動・赤い稲妻・文字が乱れる → ひび → 赤い大爆発
  function promote() {
    const S = show, cards = mythicCards();
    S.phase = 'promo'; showBtns(false);
    $('gc-show').classList.add('promo');
    $('gc-label').classList.add('glitch');
    cards.forEach(([el]) => el.classList.add('throb'));
    S.rays = 0.35; S.rayCols = ['#ff3b5c', '#a0122a']; S.rayK = 0.1;
    AudioMan.gachaPromote();
    [260, 680, 1100].forEach((d, i) => at(d, () => { for (let j = 0; j < 2 + i; j++) bolt('#ff3b5c', centerOf(pick(cards)[0])); flash('#ff3b5c', 0.18 + i * 0.1); quake(i === 2); AudioMan.zap(); }));
    at(1300, () => { cards.forEach(([el]) => el.classList.add('crack')); $('gc-label').classList.add('break'); AudioMan.frost(); });
    at(1750, mythic);
  }
  function mythic() {
    const S = show, F = FX.mythic, cards = mythicCards(), C = center();
    S.phase = 'open'; S.pending = false;
    $('gc-show').classList.remove('promo');
    flash('#ff3b5c', 1); at(120, () => flash('#ffffff', 0.9)); quake(true);
    S.rays = 1.3; S.rayCols = F.cols; S.rayK = 0.55; S.embers = true;
    for (const [el, it] of cards) {
      const p = S.multi ? centerOf(el) : C;
      for (let i = 0; i < (S.multi ? 3 : 5); i++) ring(F.cols[i % F.cols.length], S.multi ? 1 : 1.6, i * 0.08, p);
      burst(p.x, p.y, F.n * (S.multi ? 0.3 : 0.6), 'spark', F.cols, { sp: 1400, g: 0, drag: 2.2, life: 1.3 });
      burst(p.x, p.y, 40, 'star', F.cols, { sp: 900, g: 0, drag: 1.4, life: 1.6 });
      face(el, it, 'mythic', S.fake.get(it), S.multi, 'gc-promo');
      S.counts.push({ el, it, fake: S.fake.get(it), t0: now() + 0.25, dur: 0.9, mini: S.multi }); // 値が本当の上限まで上がる
    }
    burst(C.x, C.y, F.n * 0.7, 'conf', F.cols, { sp: 1500, g: 500, drag: 1.3, life: 3.6 });
    burst(C.x, C.y, 160, 'coin', ['#ffd23f'], { sp: 1300, up: true, spread: 2.6, g: 1500, life: 3 });
    [400, 800, 1200].forEach(d => at(d, () => { burst(Math.random() * innerWidth, innerHeight + 10, 90, 'conf', F.cols, { sp: 1500, up: true, spread: 0.6, g: 700, drag: 1 }); ring(pick(F.cols), 1); }));
    AudioMan.gachaMythic(); S.sound = true;
    label('mythic'); showBtns(true);
    at(1700, finish);
  }
  function finish() {
    const S = show;
    if (!S || S.done) return;
    S.done = true; S.phase = 'done'; S.pending = false;
    for (const id of S.timers) clearTimeout(id);
    showBtns(true);
  }
  // 飛ばす: 最後の形にする(音がまだなら当たりの音だけ鳴らす)
  function skip() {
    const S = show;
    if (!S || S.done) return;
    for (const id of S.timers) clearTimeout(id);
    S.timers = []; S.orb.vis = false; S.counts = []; S.bolts = []; S.pending = false;
    const F = FX[S.best], rank = RANK[S.best], C = center();
    $('gc-show').classList.remove('promo');
    S.rays = S.best === 'mythic' ? 1.3 : 0.5 + rank * 0.15; S.rayCols = F.cols; S.rayK = 0.25 + Math.min(4, rank) * 0.07; S.embers = S.best === 'mythic';
    flash('#ffffff', 0.6);
    burst(C.x, C.y, F.n * 0.4, 'spark', F.cols, { sp: 900, g: 0, drag: 2.4, life: 1 });
    burst(C.x, C.y, F.n * 0.4, 'conf', F.cols, { sp: 1100, g: 500, drag: 1.4, life: 2.6 });
    if (!S.sound) { if (S.best === 'mythic') AudioMan.gachaMythic(); else AudioMan.gachaFanfare(rank); S.sound = true; }
    label(S.best);
    if (S.multi) { if (!S.dealt) deal(false); [...$('gc-grid').children].forEach((el, i) => face(el, S.its[i], S.its[i].rarity, S.its[i].opts, true)); }
    else face($('gc-card'), S.its[0], S.its[0].rarity, S.its[0].opts, false, 'gc-in');
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
  // ボタン・キー: レアリティがまだ出ていない・ミシックの昇格がまだなら、まず最後まで飛ばす
  const settled = () => show && show.ready && !show.pending;
  function again() {
    if (!show) return;
    if (!settled()) { skip(); return; }
    if ($('gc-again').disabled) return;
    AudioMan.coin(); pull(show.t, show.its.length);
  }
  $('gc-show').onclick = e => { if (e.target.closest('#gc-btns')) return; if (show && !settled()) skip(); };
  $('gc-again').onclick = again;
  $('gc-ok').onclick = () => { if (!show) return; if (!settled()) { skip(); return; } AudioMan.click(); close(); };

  function onKey(e) {
    if (state !== 'gacha' || e.repeat) return;
    const go = e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape';
    if (show) {
      if (go && e.preventDefault) e.preventDefault();
      if (!settled()) { if (go) skip(); }
      else if (go) close();
      else if (e.code === 'KeyR') again();
      return;
    }
    if (e.code === 'Escape') { state = 'title'; UI.title(); }
  }

  return { open, onKey };
})();
