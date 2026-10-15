// bosses/fgiant.js — ボス: 霜の巨人: ゆっくり追う。凍傷を積んでから重い一撃。氷槌(凍て割り)/ 吹雪の風(氷塊の風下に隠れる)/ 雪崩 / 大雪玉 / 激昂: 地吹雪
'use strict';

// ---------- 霜の巨人: ゆっくり追う。凍傷を積んでから重い一撃。氷槌(凍て割り)/ 吹雪の風(氷塊の風下に隠れる)/ 雪崩 / 大雪玉 / 激昂: 地吹雪 ----------
const SNOW = ['#ffffff', '#e8f4ff', '#bff4ff', '#9fd8ff'];
function fgiantAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (dist > 28) { e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt; }
  if (Math.random() < dt * 6) part(e.x + rand(-10, 10), e.y + 12, rand(-6, 6), -rand(4, 10), 0.6, pick(SNOW), { drag: 1 }); // 足元の雪煙
  if (ai.glowT > 0) ai.glowT -= dt;
  ai.hammer -= dt * R; ai.blizz -= dt * R; ai.aval -= dt * R; ai.ball -= dt * R; if (ai.enraged) ai.drift -= dt * R;
  if (ai.hammer <= 0 && dist < 80) { ai.hammer = ai.enraged ? 3.5 : 4.5; giantHammer(e, ai, a); }
  else if (ai.blizz <= 0) { ai.blizz = ai.enraged ? 11 : 15; giantBlizzard(e, ai, a); }
  else if (ai.aval <= 0) { ai.aval = ai.enraged ? 9 : 12; avalanche(e, ai); }
  else if (ai.ball <= 0) { ai.ball = ai.enraged ? 7 : 9; bigSnowball(e, ai, a); }
  else if (ai.enraged && ai.drift <= 0) { ai.drift = 12; groundBlizzard(e, ai); }
}
// 氷槌: 0.9秒 前方に円 半径 45 → ×1.3・凍傷 +3。跡に氷塊(半径 14・HP 2%・10秒)と滑る床(半径 45・6秒)
// 凍て割り(プレイヤーの凍傷が 6 以上のとき、氷槌の代わりに): 1.1秒 前方に円 半径 60 → ×1.6・凍傷 +3
function giantHammer(e, ai, a) {
  const big = P.frost >= 6, R0 = big ? 60 : 45, off = big ? 34 : 28, T = big ? 1.1 : 0.9;
  const cx = e.x + Math.cos(a) * off, cy = e.y + Math.sin(a) * off;
  pushWarn({ kind: 'circle', x: cx, y: cy, r: R0, t: 0, life: T });
  e.sq = 1.3; ai.raise = T; AudioMan.charge(T);
  if (big) { hint('shatter', _t('凍て割り'), _t('凍傷が 6 以上だと、氷槌がもっと重く広くなる')); AudioMan.frost(); }
  windup(e, T, () => {
    if (hitCircle(cx, cy, R0, e.dmg * (big ? 1.6 : 1.3))) frostPlayer(3);
    const RR = R0 * CHAOS.area;
    burst(cx, cy, big ? 70 : 45, [...SNOW, '#7ad7ff'], { sp: big ? 190 : 140, up: 60, g: 220, life: 0.7 });
    for (let i = 0; i < 10; i++) { const pa = TAU / 10 * i; bfx.push({ kind: 'icespike', x: cx + Math.cos(pa) * RR * 0.75, y: cy + Math.sin(pa) * RR * 0.75, t: 0, life: 0.8, h: rand(8, 14) }); } // 氷の棘が突き出る
    addRing(cx, cy, RR, '#bff4ff', { w: 3, life: 0.4 }); shockAt(cx, cy, big ? 2.2 : 1.6, 0.75); shake(big ? 12 : 8); hitstop(big ? 0.06 : 0.03);
    bossBlast(cx, cy, RR, Object.assign({ n: big ? 20 : 14 }, BFX.ice)); // 凍りついた地面
    AudioMan.boom(); AudioMan.frost(); e.sq = 0.7; ai.raise = 0;
    addHazard('ice', cx, cy, { r: R0, dur: 6 });
    spawnObj(e, 'iceblock', cx, cy, { pct: 0.02, r: 14, life: 10 });
  });
}
// 吹雪の風: 1.0秒(画面に風の線)→ 5秒、巨人の向き(巨人 → プレイヤー)へ毎秒 45 押し、1秒ごとに凍傷 +1。氷塊の風下(幅 30・長さ 70)では受けない
function giantBlizzard(e, ai, a) {
  bfx.push({ kind: 'windwarn', x: 0, y: 0, th: a, t: 0, life: 1 });
  AudioMan.charge(1); AudioMan.blizz();
  hint('blizzard', _t('吹雪の風'), _t('氷塊の風下に入れば、風も凍傷も受けない'));
  later(ai, 1, () => { hazards.push({ kind: 'blizzard', x: e.x, y: e.y, th: a, t: 0, dur: 5, tick: 1, seed: (Math.random() * 1e6) | 0 }); AudioMan.blizz(); e.sq = 1.2; });
}
// 吹雪の風の風下: 氷塊の後ろ(幅 30・長さ 70)にいるか
function inLee(th) {
  const c = Math.cos(th), s = Math.sin(th), L = 70 * CHAOS.area, W = 15 * CHAOS.area;
  return enemies.some(o => o.obj === 'iceblock' && !o.dead && (() => { const al = (P.x - o.x) * c + (P.y - o.y) * s, sd = -(P.x - o.x) * s + (P.y - o.y) * c; return al > -o.r * 0.5 && al < L && Math.abs(sd) < W; })());
}
// 雪崩: 画面の片側から帯 5本(幅 28・すき間 26)が 0.3秒おきに順に光る(1.2秒)→ 各帯を雪の塊が速さ 130 で転がる。×1.0・凍傷 +3
function avalanche(e, ai) {
  const th = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), c = Math.cos(th), s = Math.sin(th), A = CHAOS.area;
  const cx = cam.x + GFX.VW / 2, cy = cam.y + GFX.VH / 2, half = (Math.abs(c) * GFX.VW + Math.abs(s) * GFX.VH) / 2 + 24;
  const W = 28 * A, G = 26 * A, span = 5 * W + 4 * G, off = -span / 2 + W / 2 + rand(-(W + G) / 2, (W + G) / 2); // 帯の並びの位置は、プレイヤーを中心に少しずらす
  const pside = -(P.x - cx) * s + (P.y - cy) * c;
  const order = Math.random() < 0.5 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  order.forEach((li, k) => {
    const side = pside + off + li * (W + G), x0 = cx - c * half - s * side, y0 = cy - s * half + c * side;
    later(ai, 0.3 * k, () => { pushWarn({ kind: 'line', x: x0, y: y0, a: th, len: 2 * half, w: W, t: 0, life: 1.2, fixed: true }); AudioMan.thud(); });
    later(ai, 0.3 * k + 1.2, () => { hazards.push({ kind: 'aval', x: x0, y: y0, th, len: 2 * half, w: W, d: 0, t: 0, dur: 2 * half / 130, dmg: e.dmg, seed: (Math.random() * 1e6) | 0 }); shake(3); AudioMan.boom(); });
  });
  AudioMan.warning();
  hint('avalanche', _t('雪崩'), _t('光った帯を雪の塊が転がる。すき間に立て'));
}
// 大雪玉: 0.6秒(経路の帯)→ 雪玉(半径 14)がプレイヤーへ転がる(速さ 120)。×1.0・凍傷 +2。激昂は 2個
function bigSnowball(e, ai, a) {
  const angs = ai.enraged ? [a - 0.3, a + 0.3] : [a];
  for (const aa of angs) pushWarn({ kind: 'line', x: e.x, y: e.y, a: aa, len: 300, w: 28, t: 0, life: 0.6 });
  e.sq = 1.25; AudioMan.charge(0.6);
  windup(e, 0.6, () => {
    for (const aa of angs) eprojs.push({ kind: 'bigsnow', x: e.x + Math.cos(aa) * 14, y: e.y + Math.sin(aa) * 14, vx: Math.cos(aa) * 120, vy: Math.sin(aa) * 120, dmg: e.dmg * (S.eatk ?? 1), frost: 2, life: 300 * CHAOS.area / 120, t: 0, r: 14 * CHAOS.area });
    e.sq = 0.75; shake(4); AudioMan.thud(); AudioMan.dash();
  });
}
// 地吹雪(激昂): 0.5秒 巨人の周りが白く光る → 巨人の周り 半径 70 に 4秒。中にいると 1秒ごとに凍傷 +1
function groundBlizzard(e, ai) {
  ai.glowT = 0.5; AudioMan.charge(0.5);
  later(ai, 0.5, () => { addHazard('drift', e.x, e.y, { r: 70, dur: 4, owner: e, tick: 1 }); AudioMan.blizz(); shockAt(e.x, e.y, 1.2, 0.9); });
}
