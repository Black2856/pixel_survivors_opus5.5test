// bosses/kraken.js — ボス: 大海魔クラーケン: 動かない固定砲台。触手の森(壊せる触手)/ 触手の叩きつけ / 墨 / 絡め取り / 潮の満ち引き / 水弾
'use strict';

// ---------- 大海魔クラーケン: 動かない固定砲台。触手の森(壊せる触手)/ 触手の叩きつけ / 墨 / 絡め取り / 潮の満ち引き / 水弾 ----------
//   触手が 2本以上あると本体の被ダメ ×0.5。プレイヤーが 280 より離れると触手ごと潜り、2秒後にプレイヤーから 140 の位置に出直す
const SPLASH = ['#bff4ff', '#7ad7ff', '#ffffff', '#2a8ac8'];
function krakenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate, tents = enemies.filter(o => o.owner === e && o.obj === 'tentacle' && !o.dead);
  e.takeK = tents.length >= 2 ? 0.5 : 1;
  if (ai.grabT > 0) { // 絡め取り中: 回避の無敵で抜けられる。1.5秒動けなかったら最後に ×0.8
    if (!(P.rootT > 0)) ai.grabT = 0;
    else if ((ai.grabT -= dt) <= 0) { P.rootT = 0; hurtPlayer(e.dmg * 0.8); shake(5); burst(P.x, P.y, 16, SPLASH, { sp: 90 }); AudioMan.splat(); }
  }
  if (ai.act === 'dive') { // 潜っている: 2秒後に出直す(出る位置の予告 1秒)
    ai.pt -= dt;
    if (ai.pt <= 1 && !ai.warned) { ai.warned = true; const ta = rand(0, TAU); ai.tx = P.x + Math.cos(ta) * 140; ai.ty = P.y + Math.sin(ta) * 140; pushWarn({ kind: 'circle', x: ai.tx, y: ai.ty, r: 20, t: 0, life: 1, fixed: true }); bfx.push({ kind: 'ripple', x: ai.tx, y: ai.ty, t: 0, life: 1 }); }
    if (ai.pt > 0) return;
    e.x = ai.tx; e.y = ai.ty; e.flying = e.hidden = false; e.air = false; ai.act = null; e.sq = 0.6;
    burst(e.x, e.y, 50, SPLASH, { sp: 150, up: 60, g: 200, life: 0.7 }); shockAt(e.x, e.y, 1.5, 0.8); shake(7); AudioMan.splash(); AudioMan.roar();
    return;
  }
  if (!ai.act && ai.wind <= 0 && dist > 280) { // 触手ごと潜って、プレイヤーのそばへ
    ai.act = 'dive'; ai.pt = 2; ai.warned = false; e.flying = e.hidden = true; e.air = true;
    ai.q = []; // 出かかっていた触手・叩きつけ・潮は取りやめ(潜った後に元の場所で出ないように)
    for (const o of tents) { o.dead = true; objDown(o, false); }
    P.rootT = 0; ai.grabT = 0;
    burst(e.x, e.y, 40, SPLASH, { sp: 120, up: 40, g: 200 }); AudioMan.splash();
    return;
  }
  if (ai.wbN > 0 && (ai.wbGap -= dt) <= 0) { ai.wbGap = 0.3; ai.wbN--; eball(e.x, e.y - 8, Math.atan2(P.y - e.y + 8, P.x - e.x), 120, e.dmg * 0.4, 'water'); AudioMan.shoot(); } // 水弾: 0.3秒おきに 3発
  ai.forest -= dt * R; ai.slam -= dt * R; ai.ink -= dt * R; ai.grab -= dt * R; ai.tide -= dt * R; ai.water -= dt * R;
  const inkOn = hazards.some(h => h.kind === 'ink');
  if (ai.forest <= 0) { ai.forest = ai.enraged ? 14 : 18; tentacleForest(e, ai); }
  else if (ai.tide <= 0) { ai.tide = ai.enraged ? 10 : 14; tideStart(e, ai); }
  else if (ai.ink <= 0) { ai.ink = ai.enraged ? 8 : 10; inkShot(e, ai); }
  else if (ai.grab <= 0 && !inkOn && !(P.rootT > 0)) { ai.grab = ai.enraged ? 7 : 9; krakenGrab(e, ai, a); }
  else if (ai.slam <= 0) { ai.slam = ai.enraged ? 3.5 : 4.5; tentacleSlam(e, ai); }
  else if (ai.water <= 0) { ai.water = ai.enraged ? 4.5 : 6; ai.wbN = 3; ai.wbGap = 0; }
}
// 触手の森: 本体の周り 100〜160 に触手 3本(激昂 5本。HP 各 4%・半径 8・15秒)。触手は 2.5秒ごとに帯を予告して薙ぐ
function tentacleForest(e, ai) {
  const n = ai.enraged ? 5 : 3, a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    const ta = a0 + TAU / n * i + rand(-0.3, 0.3), tr = rand(100, 160), x = e.x + Math.cos(ta) * tr, y = e.y + Math.sin(ta) * tr;
    bfx.push({ kind: 'ripple', x, y, t: 0, life: 0.8 }); // 地面(海底)が泡立つ
    later(ai, 0.8, () => { spawnObj(e, 'tentacle', x, y, { pct: 0.08, r: 8, life: 15, spawnT: rand(1, 2.5) }); burst(x, y, 20, SPLASH, { sp: 90, up: 50, g: 200 }); AudioMan.splash(); });
  }
  AudioMan.roar();
  hint('forest', _t('触手の森'), _t('触手が 2本以上あると本体のダメージが半分。触手を壊せ'));
}
// 触手の叩きつけ: プレイヤーの周りに帯(長さ 140・幅 18)を 3本(激昂 5本)→ ×1.0・スタミナ −20
function tentacleSlam(e, ai) {
  const n = ai.enraged ? 5 : 3, LA = 70 * CHAOS.area, bands = [];
  for (let i = 0; i < n; i++) {
    const ba = rand(0, Math.PI), oa = rand(0, TAU), off = rand(0, 25), cx = P.x + Math.cos(oa) * off, cy = P.y + Math.sin(oa) * off;
    const b = { x: cx - Math.cos(ba) * LA, y: cy - Math.sin(ba) * LA, a: ba };
    bands.push(b);
    pushWarn({ kind: 'line', x: b.x, y: b.y, a: ba, len: 140, w: 18, t: 0, life: 0.9, ink: true });
  }
  AudioMan.charge(0.9);
  later(ai, 0.9, () => {
    for (const b of bands) {
      if (hitLine(b.x, b.y, b.a, 140, 18, e.dmg)) drainSta(20);
      bfx.push({ kind: 'tslap', x: b.x, y: b.y, a: b.a, len: 140 * CHAOS.area, w: 18 * CHAOS.area, t: 0, life: 0.4 });
      burst(b.x + Math.cos(b.a) * LA, b.y + Math.sin(b.a) * LA, 14, SPLASH, { sp: 100, up: 40, g: 200 });
      fxRays(b.x + Math.cos(b.a) * LA, b.y + Math.sin(b.a) * LA, 34, '#1a4a7a', { foe: true, n: 9, life: 0.28, core: '#4ab8e8' }); // 叩きつけた水しぶきの光
    }
    shake(7); AudioMan.splash(); AudioMan.boom();
  });
}
// 墨: 墨の玉を放物線で(1秒)。墨だまり(半径 75)5秒: 中にいる間スタミナが回復しない・周りが暗くなり触手の予告が見えない
//   予告の円と墨の玉の落下点は、最初の 0.7秒 プレイヤーを追い、着弾までの 0.3秒は止まる
function inkShot(e, ai) {
  const R = 75, w = { kind: 'circle', x: P.x, y: P.y, r: R, t: 0, life: 1 };
  pushWarn(w);
  const ball = lob('inkball', e.x, e.y - 10, w.x, w.y, 1, 60, p => {
    addHazard('ink', p.x, p.y, { r: R, dur: 5 });
    burst(p.x, p.y, 30, ['#0a0a14', '#1a1a2a', '#2a2a4a'], { sp: 110, g: 160, life: 0.7 }); shockAt(p.x, p.y, 0.8, 0.9); AudioMan.splat();
    hint('ink', _t('墨'), _t('墨だまりの中ではスタミナが回復せず、触手の予告も見えない'));
  });
  ball.follow = b => { if (b.t < 0.7) { b.tx = P.x; b.ty = P.y; } w.x = b.tx; w.y = b.ty; };
  AudioMan.dash();
}
// 絡め取り: 0.7秒の予告(本体からプレイヤーへ帯)→ 当たると 1.5秒 動けない(回避の無敵で抜けられる)。つかんだ瞬間にスタミナ −20
function krakenGrab(e, ai, a) {
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 170, w: 14, t: 0, life: 0.7 });
  AudioMan.charge(0.7);
  windup(e, 0.7, () => {
    bfx.push({ kind: 'tslap', x: e.x, y: e.y, a, len: 170 * CHAOS.area, w: 10 * CHAOS.area, t: 0, life: 0.25 });
    AudioMan.dash();
    if (inLine(e.x, e.y, a, 170, 14) && P.invT <= 0 && !P.dead) {
      P.rootT = 1.6; ai.grabT = 1.5; drainSta(20); // 動けない時間は少し長めに持たせ、最後の ×0.8 を本体の側で判定する
      bfx.push({ kind: 'grab', x: e.x, y: e.y, t: 0, life: 1.5, track: f => { if (!(P.rootT > 0)) f.t = f.life; } });
      AudioMan.splat(); shake(4);
      hint('grab', _t('絡め取り'), _t('1.5秒動けない。回避の無敵で抜けられる'));
    }
  });
}
// 潮の満ち引き: プレイヤーの位置に 円 半径 120(0.8秒)→ 2秒 中心へ毎秒 40 引く → 1秒 外へ毎秒 90 押す → 縁(半径 120〜135)に触手の輪 ×0.8
function tideStart(e, ai) {
  const tx = P.x, ty = P.y;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 120, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { addHazard('tide', tx, ty, { r: 120, dur: 3.4, dmg: e.dmg }); AudioMan.splash(); hint('tide', _t('潮の満ち引き'), _t('引き寄せられたあと押し出される。最後に縁へ触手の輪')); });
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawKrakenFx(e, sx, gx, ex, ey, t) {
  for (const o of enemies) {
    if (o.owner !== e || o.obj !== 'tentacle' || o.dead) continue;
    const ox = o.x - cam.x, oy = o.y - cam.y - 8, n = Math.floor(Math.hypot(ex - ox, ey - oy) / 4);
    for (let i = 0; i <= n; i++) {
      if ((i + Math.floor(t * 14)) % 3) continue;
      const k = i / Math.max(1, n), x = Math.round(ox + (ex - ox) * k), y = Math.round(oy + (ey - oy) * k + Math.sin(k * Math.PI) * -6);
      sx.fillStyle = '#7ad7ff'; sx.fillRect(x, y, 1, 1); gx.fillStyle = '#1a4a5a'; gx.fillRect(x, y, 1, 1);
    }
  }
  const rr = Math.round(e.r + 8 + Math.sin(t * 4));
  sx.globalAlpha = 0.5; pCircle(sx, ex, ey, rr, '#7ad7ff'); sx.globalAlpha = 1;
  pCircle(gx, ex, ey, rr, '#1a4a5a', 2);
}
// 墨だまり: 黒い墨がゆらぎ、ふちに飛沫。中で暗い紫のうずが回る(ダメージはないので縁は赤くしない)
HAZ_DRAW.ink = (h, hx, hy, fade, hd) => {
  const { sx, t } = hd;
  const R = Math.round(h.r * Math.min(1, h.t * 6));
  sx.globalAlpha = 0.72 * fade; pDisc(sx, hx, hy, R, '#0a0a14');
  sx.globalAlpha = 0.5 * fade; pDisc(sx, hx, hy, Math.max(1, R - 4), '#04040a');
  for (let i = 0; i < 12; i++) {
    const a = hash2(i, h.seed) * TAU, r = R + Math.sin(t * 3 + i * 1.7) * 2;
    sx.globalAlpha = 0.6 * fade; pDisc(sx, hx + Math.cos(a) * r, hy + Math.sin(a) * r, 1 + (i % 3), '#0a0a14');
  }
  sx.globalAlpha = 0.85 * fade; pCircle(sx, hx, hy, R, '#3a2a5a');
  for (let i = 0; i < 3; i++) for (let k = 0; k < 7; k++) { const aa = t * 0.8 + TAU / 3 * i + k * 0.16, rr = R * (0.2 + 0.09 * k); sx.fillStyle = '#2a2a4a'; sx.fillRect(Math.round(hx + Math.cos(aa) * rr), Math.round(hy + Math.sin(aa) * rr), 1, 1); }
  sx.globalAlpha = 1;
};
// 潮の満ち引き: 引き(内へ縮む波紋)→ 押し(外へ広がる波紋)→ 縁に触手の輪(縁の予告は赤)
HAZ_DRAW.tide = (h, hx, hy, fade, hd) => {
  const { sx, t, gx, warnBlink } = hd;
  const R = Math.round(h.r), RR = Math.round(h.r * 1.06), pull = h.t < 2;
  sx.globalAlpha = 0.16 * fade; pDisc(sx, hx, hy, R, '#2a8ac8'); sx.globalAlpha = 1;
  if (h.t < 3) {
    for (let j = 0; j < 4; j++) { const k = (t * (pull ? 0.7 : 1.5) + j / 4) % 1, rr = Math.round(R * (pull ? 1 - k : k)); if (rr > 2) pCircle(gx, hx, hy, rr, '#1a4a5a'); }
    sx.globalAlpha = 0.8; pCircle(sx, hx, hy, R, '#7ad7ff'); sx.globalAlpha = 1;
    if (h.t > 1.2) { const bw = Math.max(2, Math.round(h.r * 0.12)); sx.globalAlpha = 0.18 + 0.1 * warnBlink; sx.strokeStyle = '#ff3b5c'; sx.lineWidth = bw; sx.beginPath(); sx.arc(Math.round(hx), Math.round(hy), RR, 0, TAU); sx.stroke(); sx.globalAlpha = 1; pCircle(sx, hx, hy, RR + Math.ceil(bw / 2), warnBlink ? '#ff3b5c' : '#ffd0d8'); pCircle(gx, hx, hy, RR + Math.ceil(bw / 2), '#7a1020'); }
  } else { // 触手の輪: せり上がって沈む
    const u = (h.t - 3) / Math.max(0.01, h.dur - 3), k = u < 0.2 ? u / 0.2 : Math.max(0, 1 - (u - 0.2) / 0.8), H = Math.round(20 * k);
    for (let i = 0; i < 28; i++) {
      const a = TAU / 28 * i + 0.11, x0 = Math.round(hx + Math.cos(a) * RR), y0 = Math.round(hy + Math.sin(a) * RR);
      sx.fillStyle = '#0a1a1e'; sx.fillRect(x0 - 3, y0 + 1, 7, 1);
      for (let j = 0; j < H; j++) {
        const sw = Math.round(Math.sin(j * 0.35 + i) * j / 5), w = j < H * 0.4 ? 3 : j < H - 3 ? 2 : 1;
        sx.fillStyle = '#3a0e24'; sx.fillRect(x0 + sw - 1, y0 - j, w + 2, 1);
        sx.fillStyle = j > H - 3 ? '#e89aaa' : j % 3 === 1 ? '#c2486a' : '#8a2a4a'; sx.fillRect(x0 + sw, y0 - j, w, 1);
        if (j % 3 === 0 && w > 1) { sx.fillStyle = '#e89aaa'; sx.fillRect(x0 + sw, y0 - j, 1, 1); } // 吸盤
      }
    }
  }
  addLight(h.x, h.y, R * 1.6, '#2a8ac8', 0.35 * fade);
};
// 海底が泡立つ(何かが出てくる場所): 広がる波紋と、湧き上がる泡
BFX_DRAW.ripple = (f, fx, fy, u, bd) => {
  const { gx, t, sx } = bd;
  for (let j = 0; j < 3; j++) { const k = (u * 2 + j / 3) % 1; pCircle(gx, fx, fy, Math.round(4 + k * 18), k < 0.5 ? '#2a6a7a' : '#163a44'); }
  for (let i = 0; i < 7; i++) { const a = hash2(i, 5) * TAU + t * 2, r = 12 * hash2(i, 9), y = Math.round(fy + Math.sin(a) * r * 0.6 - ((t * 20 + i * 3) % 6)); sx.fillStyle = '#bff4ff'; sx.fillRect(Math.round(fx + Math.cos(a) * r), y, 1, 1); }
};
// 絡め取り: クラーケンからプレイヤーへ伸びて巻きつく触手
BFX_DRAW.grab = (f, fx, fy, u, bd) => {
  const { t, sx } = bd;
  const px = P.x - cam.x, py = P.y - cam.y, L = Math.hypot(px - fx, py - fy) || 1, nx = -(py - fy) / L, ny = (px - fx) / L, n = Math.max(4, Math.floor(L / 6));
  let lx = fx, ly = fy;
  for (let i = 1; i <= n; i++) {
    const k = i / n, wv = Math.sin(k * 9 - t * 8) * 3 * Math.sin(k * Math.PI), x = fx + (px - fx) * k + nx * wv, y = fy + (py - fy) * k + ny * wv, w = Math.max(2, Math.round(5 - k * 3));
    pLine(sx, lx, ly, x, y, '#3a0e24', w + 2); pLine(sx, lx, ly, x, y, '#8a2a4a', w);
    if (i % 2) { sx.fillStyle = '#e89aaa'; sx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    lx = x; ly = y;
  }
  for (let i = 0; i < 3; i++) { const yy = Math.round(py - 3 + i * 3), sh = Math.round(Math.sin(t * 6 + i) * 1); sx.fillStyle = '#3a0e24'; sx.fillRect(Math.round(px - 6) + sh, yy - 1, 13, 4); sx.fillStyle = '#8a2a4a'; sx.fillRect(Math.round(px - 5) + sh, yy, 11, 2); sx.fillStyle = '#e89aaa'; sx.fillRect(Math.round(px - 3 + i * 2) + sh, yy, 1, 1); } // 巻きつき
};
