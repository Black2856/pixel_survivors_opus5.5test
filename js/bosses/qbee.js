// bosses/qbee.js — ボス: 女王蜂: 距離 110 を保って飛び回る。★蜂の陣(倒せる働き蜂の輪が縮む)/ 針の連射 / 急降下突き(衰弱)/ 呼び寄せ(森蜂の群れ)/ 激昂: 蜂球
'use strict';

// ---------- 女王蜂: 距離 110 を保って飛び回る。★蜂の陣(倒せる働き蜂の輪が縮む)/ 針の連射 / 急降下突き(衰弱)/ 呼び寄せ(森蜂の群れ)/ 激昂: 蜂球 ----------
const HONEY = ['#ffd23f', '#ffb13a', '#fff0a0', '#8a6a10'];
function qbeeAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  e.spr = Math.floor(e.t * 18) % 2 ? 'qbee' : 'qbee2'; // 羽ばたき
  if (ai.ph === 'tele') { // 急降下突きの予告: 経路の帯。体を後ろへ引いて構える
    ai.pt -= dt; e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0; e.sq = 0.85;
    if (ai.pt <= 0) { ai.ph = 'dive'; ai.pt = ai.diveLen / 360; ai.hit = false; AudioMan.dash(); }
    return;
  }
  if (ai.ph === 'dive') { // 急降下突き: 速さ 360 で突く(×1.2・衰弱 +3)
    ai.pt -= dt;
    e.x += Math.cos(ai.dir) * 360 * dt; e.y += Math.sin(ai.dir) * 360 * dt;
    if (Math.random() < dt * 40) part(e.x + rand(-4, 4), e.y + rand(-4, 4), -Math.cos(ai.dir) * 60, -Math.sin(ai.dir) * 60, 0.3, pick(HONEY), { glow: true, drag: 3 });
    if (!ai.hit && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 5, 2) && hurtPlayer(e.dmg * 1.2)) { ai.hit = true; weakPlayer(3); }
    if (ai.pt <= 0) { ai.ph = 'fly'; }
    return;
  }
  // 距離 110 を保ち、横へ回り込む(ときどき向きを変える)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(2.5, 4.5); ai.side = -(ai.side || 1); }
  const dir = dist > 110 ? a : a + Math.PI, k = Math.abs(dist - 110) > 15 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * e.spd * 0.8 * (ai.side || 1)) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * e.spd * 0.8 * (ai.side || 1)) * slow * dt;
  if (Math.random() < dt * 10) part(e.x + rand(-8, 8), e.y + rand(-4, 6), rand(-6, 6), rand(4, 12), 0.5, pick(['#fff0a0', '#ffd23f']), { glow: true, drag: 1 }); // 金の花粉がこぼれる
  if (ai.stN > 0 && (ai.stGap -= dt * R) <= 0) { // 針の連射: 3発(激昂 5発)の扇(±0.25rad)を 0.3秒おきに 3回。激昂は扇の広さが同じまま、すき間が狭くなる
    ai.stGap = 0.3; ai.stN--;
    for (const o of ai.enraged ? [-0.25, -0.125, 0, 0.125, 0.25] : [-0.25, 0, 0.25]) Object.assign(eball(e.x, e.y + 2, a + o, 90, e.dmg * 0.5, 'stinger'), { r: 2.5 * CHAOS.area });
    AudioMan.shoot();
  }
  ai.sting -= dt * R; ai.ring -= dt * R; ai.dive -= dt * R; ai.call -= dt * R; if (ai.enraged) ai.ball -= dt * R;
  if (ai.sting <= 0) { ai.sting = ai.enraged ? 3 : 4; ai.stN = 3; ai.stGap = 0; } // 弾はほかの技と並んで撃つ
  if (ai.ring <= 0) { ai.ring = ai.enraged ? 11 : 14; beeRing(e, ai); }
  else if (ai.dive <= 0) { ai.dive = ai.enraged ? 4.5 : 6; beeDive(e, ai, a); }
  else if (ai.call <= 0) { ai.call = ai.enraged ? 9 : 12; beeCall(e, ai); }
  else if (ai.enraged && ai.ball <= 0) { ai.ball = 10; beeBall(e, ai); }
}
// 急降下突き: 1秒 経路の帯(長さ 220・幅 = 体の直径)がプレイヤーを追い、最後の 0.25秒は向きが止まる → 速さ 360 で突く。×1.2・衰弱 +3
function beeDive(e, ai, a) {
  ai.ph = 'tele'; ai.pt = 1; ai.dir = a; ai.diveLen = 220;
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 220, w: e.r * 2, t: 0, life: 1, fixed: true, owner: e, track: q => { q.x = e.x; q.y = e.y; if (q.t < 0.75) ai.dir = q.a = Math.atan2(P.y - e.y, P.x - e.x); } }); // 突進の経路(体当たりなので広げない)
  AudioMan.charge(1);
}
// ★蜂の陣: 働き蜂 36匹が女王から飛び出し、使ったときのプレイヤーの位置を囲む輪(半径 110)になる(1秒)→ 2.5秒かけて輪が中心へ縮む
//   働き蜂はボスが出した物(1撃で落ちる・経験値なし)。触れると ×0.6。蜂を落とすと輪に穴が開く。縮みきると散る
function beeRing(e, ai) {
  const ring = { cx: P.x, cy: P.y, n: 36, R: 110 };
  for (let i = 0; i < ring.n; i++) {
    const o = spawnObj(e, 'wbee', e.x + rand(-6, 6), e.y + rand(-6, 6), { pct: 0.00001, r: 3, life: 4 });
    Object.assign(o, { ring, ang: TAU / ring.n * i, sx: o.x, sy: o.y, tiny: true });
  }
  pushWarn({ kind: 'circle', x: ring.cx, y: ring.cy, r: ring.R, t: 0, life: 1, fixed: true, noFill: true });
  burst(e.x, e.y, 24, HONEY, { sp: 90, glow: true, life: 0.4 }); AudioMan.hum(3.5); AudioMan.warning();
  hint('qbee_ring', _t('蜂の陣'), _t('働き蜂の輪が縮んでくる。蜂を落とせば輪に穴が開く'));
}
// 呼び寄せ: 森蜂の群れ(5匹)を、画面の外の 2方向から
function beeCall(e, ai) {
  const a0 = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16;
  for (const da of [0, Math.PI + rand(-0.6, 0.6)]) {
    const pa = a0 + da;
    for (let i = 0; i < 5; i++) { const b = spawnEnemy('bee', { x: P.x + Math.cos(pa) * R + rand(-10, 10), y: P.y + Math.sin(pa) * R + rand(-10, 10) }); b.noChest = true; }
  }
  e.sq = 1.2; burst(e.x, e.y, 16, HONEY, { sp: 60, glow: true, life: 0.4 }); AudioMan.summon();
}
// 蜂球(激昂): 働き蜂が固まった球(HP 10%・12秒)がプレイヤーを追う(速さ 30)。触れると 0.5秒ごとに ×0.8。壊すと蜂が散る
function beeBall(e, ai) {
  const o = spawnObj(e, 'beeball', e.x, e.y + 6, { pct: 0.1, r: 9, life: 12 });
  o.tick = 0;
  burst(e.x, e.y, 30, HONEY, { sp: 80, glow: true, life: 0.5 }); AudioMan.summon(); AudioMan.hum(1.2);
  hint('qbee_ball', _t('蜂球'), _t('働き蜂の塊が追ってくる。壊すと散る'));
}
