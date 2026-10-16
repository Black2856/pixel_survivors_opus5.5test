// bosses/sphinx.js — ボス: スフィンクス: 距離 120 を保って回り込む。★謎かけ(頭上の印と同じ石板の上だけ安全)/ 陽光の眼(光線がプレイヤーを追う)/ 石の羽根 / 前足の一撃 / 陽炎渡り(現れた所から陽光が 3方向へ走る)/ 激昂: 砂嵐・逆さの問い
'use strict';

// ---------- スフィンクス: 距離 120 を保って回り込む。★謎かけ(頭上の印と同じ石板の上だけ安全)/ 陽光の眼(光線がプレイヤーを追う)/ 石の羽根 / 前足の一撃 / 陽炎渡り(現れた所から陽光が 3方向へ走る)/ 激昂: 砂嵐・逆さの問い ----------
const SUNC = ['#ffd27a', '#fff0c0', '#ffb040', '#ffffff'];
function sphinxAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'eyes') { // 陽光の眼: 0.8秒 目が光る → 光線(長さ 240・幅 16)が 2.5秒 プレイヤーを追う。回る速さは角度の差 × 3(毎秒。最大 2.1rad/秒): 離れているほど速く、近づくと遅くなる。当たると ×0.8(光線の中にいる間は、受けたあとの無敵が切れるたびに当たる。カオスドラゴンの光線と同じ)
    const tl = ai.tl; tl.t += dt;
    if (tl.t < 0.8) { e.sq = 1.04; return; }
    const ox = e.x + tl.ox, oy = e.y + tl.oy;
    tl.ang += clamp(angDiff(Math.atan2(P.y - oy, P.x - ox), tl.ang) * 3, -2.1, 2.1) * dt;
    ai.beamA = tl.ang; ai.beamO = { x: ox, y: oy };
    hitLine(ox, oy, tl.ang, 240, 16, e.dmg * 0.8);
    if (!tl.snd) { tl.snd = true; AudioMan.cast(); shake(3); }
    if (tl.t >= 3.3) { ai.act = null; ai.beamA = null; } // 溜め 0.8秒 + 光線 2.5秒
    return;
  }
  if (ai.act === 'haze') { // 陽炎渡り: 0.5秒で陽炎に溶ける(溶けかけから攻撃が当たらない)→ プレイヤーから 120〜150 の所に 0.3秒で現れる
    ai.pt -= dt; e.hideA = Math.max(0, ai.pt / 0.5); e.hidden = e.air = ai.pt < 0.3;
    if (Math.random() < dt * 40) part(e.x + rand(-14, 14), e.y + rand(-14, 8), rand(-6, 6), -rand(10, 30), 0.5, pick(SUNC), { glow: true, drag: 1 });
    if (ai.pt <= 0) {
      const pa = rand(0, TAU), pr = rand(120, 150);
      e.x = P.x + Math.cos(pa) * pr; e.y = P.y + Math.sin(pa) * pr; ai.act = 'hazeIn'; ai.pt = 0.3; e.hideA = 0;
      burst(e.x, e.y, 20, SUNC, { sp: 50, glow: true, life: 0.5 }); AudioMan.dash();
      sphinxHazeBurst(e, ai); // 現れた所から陽光が 3方向へ走る
    }
    return;
  }
  if (ai.act === 'hazeIn') { ai.pt -= dt; e.hideA = 1 - Math.max(0, ai.pt) / 0.3; e.hidden = e.air = ai.pt > 0.15; if (ai.pt <= 0) { ai.act = null; e.hideA = undefined; e.hidden = e.air = false; } return; }
  // 距離 120 を保ち、横へ回り込む(ときどき向きを変える)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -(ai.side || 1); }
  const dir = dist > 120 ? a : a + Math.PI, k = Math.abs(dist - 120) > 15 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * e.spd * 0.7 * (ai.side || 1)) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * e.spd * 0.7 * (ai.side || 1)) * slow * dt;
  if (ai.rq) return; // 謎かけの間はほかの技を使わない(答えを探す時間)
  ai.rid -= dt * R; ai.eyes -= dt * R; ai.fea -= dt * R; ai.paw -= dt * R; ai.haze -= dt * R; if (ai.enraged) ai.storm -= dt * R;
  if (ai.enraged && ai.storm <= 0) { ai.storm = 14; sphinxStorm(e, ai); }
  else if (ai.rid <= 0) { ai.rid = ai.enraged ? 13 : 16; sphinxRiddle(e, ai); }
  else if (ai.paw <= 0 && dist < 50) { ai.paw = 4; sphinxPaw(e, ai, a); }
  else if (ai.eyes <= 0) { ai.eyes = ai.enraged ? 5.5 : 7; sphinxEyes(e, ai, a); }
  else if (ai.haze <= 0) { ai.haze = ai.enraged ? 8 : 10; sphinxHaze(e, ai); }
  else if (ai.fea <= 0) { ai.fea = ai.enraged ? 4 : 5; sphinxFeathers(e, ai, a); }
}
// ★謎かけ: 床に印の石板 3枚(太陽・月・星。プレイヤーから 80 の 3方向)、頭上に印が 1つ。4秒後、同じ印の石板の上(半径 30)だけを残して陽光が落ちる ×1.6
//   赤い予告は最後の 0.6秒だけ(答えを見て選ぶ技)。安全な円は攻撃範囲の倍率で狭めない。激昂すると半分の確率で逆さの問い(印が赤 = その印以外の 2枚が安全)
function sphinxRiddle(e, ai) {
  const a0 = rand(0, TAU), syms = shuffle(['sun', 'moon', 'star']), ans = pick(syms), inv = ai.enraged && Math.random() < 0.5;
  const tabs = syms.map((k, i) => ({ k, x: P.x + Math.cos(a0 + TAU / 3 * i) * 80, y: P.y + Math.sin(a0 + TAU / 3 * i) * 80 }));
  const safe = tabs.filter(t => inv ? t.k !== ans : t.k === ans).map(t => ({ x: t.x, y: t.y, r: 30 }));
  ai.rq = { ans, inv };
  for (const t of tabs) addHazard('tablet', t.x, t.y, { r: 1, dur: 4.6, k: t.k, ok: safe.some(s => s.x === t.x && s.y === t.y), owner2: e });
  burst(e.x, e.y - 20, 24, SUNC, { sp: 60, glow: true, life: 0.5 }); e.sq = 1.15; AudioMan.chime(); AudioMan.charge(4);
  later(ai, 3.4, () => { pushWarn({ kind: 'sun', x: P.x, y: P.y, safe, t: 0, life: 0.6, owner: e }); AudioMan.warning(); });
  later(ai, 4, () => {
    ai.rq = null;
    forHit(() => { if (!P.dead && !safe.some(s => d2(P.x, P.y, s.x, s.y) < s.r * s.r)) hurtPlayer(e.dmg * 1.6); });
    for (let i = 0; i < 7; i++) { const pa = rand(0, TAU), pr = rand(10, 170), x = P.x + Math.cos(pa) * pr, y = P.y + Math.sin(pa) * pr; if (safe.some(s => d2(x, y, s.x, s.y) < Math.pow(s.r + 8, 2))) continue; fxBeam(x, y, { foe: true, w: 6, H: 170, col: '#5a4018', mid: '#c88a30', core: '#e8b860', life: 0.45, drop: 0.1 }); } // 陽光の柱(明るい砂の上で白く飛ばないように暗めの金)
    for (const s of safe) addRing(s.x, s.y, s.r, '#ffd27a', { w: 2, life: 0.4 });
    screenFlash(0.08, '#ffb040'); shake(8); AudioMan.boom();
  });
  hint('sphinx_riddle', _t('謎かけ'), inv ? _t('印が赤いときは逆さの問い。その印以外の石板の上が安全') : _t('頭上の印と同じ印の石板の上だけが安全'));
}
// 陽光の眼: 0.8秒の予告(光線の帯。プレイヤーから 30° ずれた向き)→ 両目の光線がプレイヤーを追う(つづきは sphinxAI)
function sphinxEyes(e, ai, a) {
  const f = e.face || 1, ox = 8 * f, oy = -7, ang = Math.atan2(P.y - (e.y + oy), P.x - (e.x + ox)) + (Math.random() < 0.5 ? 0.52 : -0.52);
  ai.act = 'eyes'; ai.tl = { t: 0, ang, ox, oy };
  pushWarn({ kind: 'line', x: e.x + ox, y: e.y + oy, a: ang, len: 240, w: 16, t: 0, life: 0.8, owner: e });
  AudioMan.charge(0.8);
}
// 石の羽根: 翼から石の羽根 7発の扇(±0.6rad・速さ 120、×0.6)。激昂: 0.5秒後に、同じ向きから 0.3rad ずらした 7発をもう一度(1回目の羽根のすき間に入る。ずらす側はランダム)
function sphinxFeathers(e, ai, a) {
  const fan = da => {
    for (let i = -3; i <= 3; i++) Object.assign(eball(e.x, e.y - 10, a + da + i * 0.2, 120, e.dmg * 0.6, 'feather'), { r: 3 * CHAOS.area });
    burst(e.x - 6 * (e.face || 1), e.y - 14, 14, ['#e8dcc0', '#fff4dc', '#a89070'], { sp: 60, life: 0.35 }); e.sq = 0.85; AudioMan.shoot();
  };
  fan(0);
  if (ai.enraged) { const s = Math.random() < 0.5 ? 0.3 : -0.3; later(ai, 0.5, () => { if (!e.dead) fan(s); }); }
}
// 前足の一撃: 距離 50 以内で 0.5秒 前方の扇(半径 70・±60°)→ ×1.2・80 押す
function sphinxPaw(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 70, h: 1.05, t: 0, life: 0.5, owner: e });
  windup(e, 0.5, () => {
    hitFan(e.x, e.y, a, 70, 1.05, e.dmg * 1.2, () => pushPlayer(a, 80, 0.25));
    slashes.push({ x: e.x, y: e.y, a, r: 70 * CHAOS.area, t: 0, life: 0.22, flip: Math.random() < 0.5, span: 2.1, pal: SWING_PAL.enemy, enemy: true });
    burst(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 14, SAND, { sp: 80, g: 160 }); e.sq = 0.75; shake(3); AudioMan.slash(); AudioMan.thud();
  });
}
// 陽炎渡り: 陽炎に溶けて、プレイヤーから 120〜150 の所に現れる(つづきは sphinxAI。現れたときに sphinxHazeBurst)
function sphinxHaze(e, ai) {
  ai.act = 'haze'; ai.pt = 0.5; e.hideA = 1; AudioMan.dash();
}
// 陽炎渡りの陽光: 現れた所から、プレイヤーの方向とその左右(±0.35rad)の 3方向へ、円(半径 16)が 26 おきに 8つずつ並ぶ(予告は現れたときに全部出る)
//   スフィンクスに近い方から 0.1秒おきに順に陽光が噴き上がる ×0.8(最初は現れて 0.5秒後)。列と列の間へよける
function sphinxHazeBurst(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  for (const da of [-0.35, 0, 0.35]) for (let i = 0; i < 8; i++) {
    const r = 24 + i * 26, x = e.x + Math.cos(a + da) * r, y = e.y + Math.sin(a + da) * r, T = 0.5 + i * 0.1;
    pushWarn({ kind: 'circle', x, y, r: 16, t: 0, life: T, owner: e });
    later(ai, T, () => {
      if (e.dead) return;
      hitCircle(x, y, 16, e.dmg * 0.8);
      fxBeam(x, y, { foe: true, up: true, w: 4, H: 44, col: '#5a4018', mid: '#c88a30', core: '#e8b860', life: 0.35, drop: 0.06 }); // 地面から噴き上がる陽光(白く飛ばないように暗めの金・低く)
      burst(x, y, 8, SUNC, { sp: 50, up: 20, g: 120, life: 0.35 }); addRing(x, y, 16 * CHAOS.area, '#ffb040', { life: 0.2 });
      if (da === 0) AudioMan.thud();
    });
  }
  hint('sphinx_haze', _t('陽炎渡り'), _t('現れた所から 3方向へ陽光が走る。列と列の間へよける'));
}
// 砂嵐(激昂): 画面を横切る砂の流れ 3本(幅 100。流れと流れのすき間 50)。1秒で濃くなり、6秒 ゆっくり横へ動く(毎秒 12)
//   中にいると 0.5秒ごとに砂塵 +1、流れの向きへ毎秒 60 で運ばれる(回避の無敵中は運ばれない)
function sphinxStorm(e, ai) {
  const a = rand(0, TAU), c = Math.cos(a + Math.PI / 2), s = Math.sin(a + Math.PI / 2), sg = Math.random() < 0.5 ? 1 : -1, j = rand(-30, 30);
  for (const o of [-150, 0, 150]) addHazard('sandstream', P.x + c * (o + j), P.y + s * (o + j), { a, len: 640, bw: 100 * CHAOS.area, dur: 7, tele: 1, drift: 12 * sg, carry: 60, tick: 0.5, owner2: e });
  burst(e.x, e.y - 10, 30, SAND, { sp: 90, life: 0.5, drag: 1.5 }); AudioMan.sand(); AudioMan.dash(); shake(4);
  hint('sphinx_storm', _t('砂嵐'), _t('砂の流れの中にいると砂塵がたまる。流れのすき間へ'));
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// スフィンクス: 謎かけの頭上の印(逆さの問いは赤)/ 陽光の眼の溜めと光線
function drawSphinxFx(e, ai, sx, gx, ex, ey, sp, yo, A) {
  if (ai.rq) { const s2 = ART.S['sym_' + ai.rq.ans + (ai.rq.inv ? '_r' : '')], bob = Math.round(Math.sin(GFX.fx.time * 4) * 1.5); drawSp(s2, e.x, e.y + yo - sp.h / 2 - 9 + bob, { scale: 1 }); addLight(e.x, e.y - sp.h / 2 - 9, 34, ai.rq.inv ? '#ff3b5c' : '#ffd27a', 0.7); }
  if (ai.act === 'eyes' && ai.tl && ai.tl.t < 0.8) { const k = ai.tl.t / 0.8, gx2 = Math.round(ex + ai.tl.ox), gy2 = Math.round(ey + ai.tl.oy); gx.fillStyle = '#7ad7ff'; gx.fillRect(gx2 - 2, gy2, 5, 1); addLight(e.x + ai.tl.ox, e.y + ai.tl.oy, 20 + 40 * k, '#7ad7ff', 0.5 + 0.5 * k); }
  if (ai.beamA != null && ai.beamO) { // 両目の光線(2本の細い線が並ぶ。光の太さは当たり判定の幅 16 に合わせる)
    const BL = 240 * A, ca = Math.cos(ai.beamA), sa = Math.sin(ai.beamA), ox2 = ai.beamO.x - cam.x, oy2 = ai.beamO.y - cam.y, fl = Math.floor(GFX.fx.time * 30) % 2;
    pLine(gx, ox2, oy2, ox2 + ca * BL, oy2 + sa * BL, '#8a6a20', Math.round((12 + fl * 2) * A));
    for (const s of [-3, 3]) { const nx = -sa * s, ny = ca * s; pLine(sx, ox2 + nx, oy2 + ny, ox2 + ca * BL + nx, oy2 + sa * BL + ny, '#fff0c0', 2); }
    pLine(sx, ox2, oy2, ox2 + ca * BL, oy2 + sa * BL, '#7ad7ff', 1);
    for (let r = 0; r < BL; r += 48) addLight(ai.beamO.x + ca * r, ai.beamO.y + sa * r, 50, '#ffd27a', 0.6);
  }
}
// 謎かけの石板(スフィンクス): 砂から浮き上がる平たい石。印が金に光る。答えの出る最後の 0.6秒は、安全な石板が明るく光る
HAZ_DRAW.tablet = (h, hx, hy, fade, hd) => {
  const sp = ART.S['tab_' + h.k], k = Math.min(1, h.t / 0.3, Math.max(0, (h.dur - h.t) / 0.3));
  if (k > 0.05) drawSp(sp, h.x, h.y + 3 - sp.h / 2, { sy: k });
  addLight(h.x, h.y, 30, '#ffd27a', 0.5 * k);
  if (h.ok && h.t > 3.4 && h.t < 4.1) addLight(h.x, h.y, 70, '#fff0c0', 0.9);
};
// 砂嵐(スフィンクス): 画面を横切る砂の帯。砂の筋が流れる。縁は危険を示す赤(濃くなるまでは薄い)
HAZ_DRAW.sandstream = (h, hx, hy, fade, hd) => {
  const { sx, t, warnBlink } = hd;
  const c = Math.cos(h.a), s = Math.sin(h.a), L = h.len / 2, W = h.bw / 2, on = h.t >= h.tele, k0 = on ? 1 : h.t / h.tele;
  const quad = (al, col) => { sx.globalAlpha = al; sx.fillStyle = col; sx.beginPath(); sx.moveTo(hx - c * L - s * W, hy - s * L + c * W); sx.lineTo(hx + c * L - s * W, hy + s * L + c * W); sx.lineTo(hx + c * L + s * W, hy + s * L - c * W); sx.lineTo(hx - c * L + s * W, hy - s * L - c * W); sx.fill(); };
  quad(0.34 * k0 * fade, '#c8a060'); sx.globalAlpha = fade * k0;
  for (let i = 0, ns = Math.max(26, Math.round(h.bw * 0.9)); i < ns; i++) { const u = ((hash2(i, h.seed) * 2 - 1) * L + t * 140) % (2 * L) - L, v = (hash2(i + 9, h.seed) * 2 - 1) * W * 0.85, x = hx + c * u - s * v, y = hy + s * u + c * v; pLine(sx, x, y, x - c * 8, y - s * 8, '#f0d8a0'); } // 砂の筋
  const ec = on ? (warnBlink ? '#ff3b1a' : '#ff8a3d') : '#c8a060';
  for (const sd of [-1, 1]) pLine(sx, hx - c * L - s * W * sd, hy - s * L + c * W * sd, hx + c * L - s * W * sd, hy + s * L + c * W * sd, ec);
  sx.globalAlpha = 1;
};
