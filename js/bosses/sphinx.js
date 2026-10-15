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
    if (!P.dead && !safe.some(s => d2(P.x, P.y, s.x, s.y) < s.r * s.r)) hurtPlayer(e.dmg * 1.6);
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
    if (hitFan(e.x, e.y, a, 70, 1.05, e.dmg * 1.2)) pushPlayer(a, 80, 0.25);
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
