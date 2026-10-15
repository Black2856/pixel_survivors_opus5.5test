// bosses/pqueen.js — ボス: 七彩の女王: 3秒ごとに瞬間移動 / ★反射光線(鏡で折れる)/ 乱反射(女王の弾を渡り歩く光)/ 光の屈折弾 / 鏡の分身(本物を探す)/ 瞬き(移る前の位置に鏡)/ 激昂: 虹の螺旋
'use strict';

// ---------- 七彩の女王: 3秒ごとに瞬間移動 / ★反射光線(鏡で折れる)/ 乱反射(女王の弾を渡り歩く光)/ 光の屈折弾 / 鏡の分身(本物を探す)/ 瞬き(移る前の位置に鏡)/ 激昂: 虹の螺旋 ----------
//   女王の弾(qb: 屈折弾とその欠片・分身の弾・虹の螺旋)と女王の鏡は、乱反射の光が跳ねる先になる
function pqueenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  updClones(e, ai, dt); updReflect(e, ai, dt);
  if (ai.spT > 0) { // 虹の螺旋(激昂): 3本の腕
    ai.spT -= dt; ai.spGap -= dt;
    if (ai.spGap <= 0) { ai.spGap = 0.12; ai.spA += 0.32; for (let i = 0; i < 3; i++) { const p = eball(e.x, e.y - 6, ai.spA + TAU / 3 * i, 70, e.dmg * 0.7, 'pshard'); p.ci = (i * 2 + Math.floor(ai.spA * 3)) % 7; p.qb = true; } if (Math.floor(ai.spT * 8) % 2) AudioMan.shoot(); }
  }
  // ゆっくり漂う(距離はおよそ 120)
  const want = 120, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 25 ? 0.6 : 0;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 8) * slow * dt; e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 8) * slow * dt;
  ai.tp -= dt; ai.beam -= dt * R; ai.mirror -= dt * R; ai.scatter -= dt * R; ai.orb -= dt * R; ai.blink -= dt * R; if (ai.enraged) ai.spiral -= dt * R;
  if (ai.orb <= 0) { ai.orb = ai.enraged ? 4 : 5; refractOrb(e); } // 光の屈折弾はほかの技と並んで撃つ
  if (ai.tp <= 0 && !ai.clones) { ai.tp = 3; const ta = rand(0, TAU), tr = rand(100, 140); queenWarp(e, P.x + Math.cos(ta) * tr, P.y + Math.sin(ta) * tr); return; }
  if (ai.enraged && ai.spiral <= 0) { ai.spiral = 5; ai.spT = 2.5; ai.spGap = 0; ai.spA = rand(0, TAU); }
  if (ai.mirror <= 0) { ai.mirror = ai.enraged ? 10 : 14; startClones(e, ai); }
  else if (ai.beam <= 0) { ai.beam = ai.enraged ? 4.5 : 6; reflectBeam(e, ai); }
  else if (ai.scatter <= 0 && rayTargets(e, ai)) { ai.scatter = ai.enraged ? 5 : 7; prismScatter(e, ai); } // 跳ねる先(女王の弾・鏡)があるときだけ
  else if (ai.blink <= 0 && !ai.clones) { ai.blink = ai.enraged ? 6 : 8; queenBlink(e, ai); }
}
// 瞬間移動: 七色の光の粒になって消え、別の場所に現れる
function queenWarp(e, x, y) {
  burst(e.x, e.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 });
  e.x = x; e.y = y;
  burst(e.x, e.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 }); addRing(e.x, e.y, 16, '#ffd0f0', { life: 0.3 });
  AudioMan.chime();
}
// 女王の鏡(瞬きで置く): HP 20%・20秒、最大 2枚(3枚目を置くと古い鏡が消える)。反射光線が折れ、乱反射の光が跳ねる
function placeMirror(e, ai, x, y) {
  const m = spawnObj(e, 'qmirror', x, y, { pct: 0.2, r: 8, life: 20 });
  burst(x, y - 10, 24, [...PRISM, '#ffffff'], { sp: 80, up: 30, glow: true, life: 0.5 }); AudioMan.chime();
  ai.mirrors = (ai.mirrors || []).filter(o => !o.dead); ai.mirrors.push(m);
  if (ai.mirrors.length > 2) { const old = ai.mirrors.shift(); old.dead = true; objDown(old, false); }
  hint('qmirror', _t('女王の鏡'), _t('反射光線は鏡で折れてプレイヤーへ飛ぶ。乱反射の光も鏡で跳ねる'));
  return m;
}
// ★反射光線: 0.8秒、女王 → 鏡(古い順に最大 2枚)→ プレイヤーへの折れ線の帯(プレイヤー側の 1本は 0.6秒追って止まる)
//   → 0.45秒の光線 ×1.0。鏡がなければ女王から直接プレイヤーへ。撃つまでに鏡が壊れたら、光線はその鏡の位置で止まる
const RBEAM_LEN = 390; // 最後の 1本(プレイヤー側)の長さ
function reflectBeam(e, ai) {
  const ms = (ai.mirrors || []).filter(m => !m.dead);
  const pts = [{ x: e.x, y: e.y - 6 }, ...ms.map(m => ({ x: m.x, y: m.y - 10, m }))], W = 10 * CHAOS.area;
  for (let i = 0; i + 1 < pts.length; i++) { const A = pts[i], B = pts[i + 1]; pushWarn({ kind: 'line', x: A.x, y: A.y, a: Math.atan2(B.y - A.y, B.x - A.x), len: Math.hypot(B.x - A.x, B.y - A.y), w: W, t: 0, life: 0.8, fixed: true }); }
  const last = pts[pts.length - 1];
  const lw = { kind: 'line', x: last.x, y: last.y, a: Math.atan2(P.y - last.y, P.x - last.x), len: RBEAM_LEN * CHAOS.area, w: W, t: 0, life: 0.8, fixed: true };
  lw.track = q => { if (q.t < 0.6) q.a = Math.atan2(P.y - last.y, P.x - last.x); };
  pushWarn(lw);
  AudioMan.charge(0.8);
  hint('reflect', _t('反射光線'), ms.length ? _t('光線は鏡で折れてプレイヤーへ飛ぶ。撃つ前に鏡を壊すと、そこで止まる') : _t('鏡がないときは、女王からまっすぐ飛ぶ'));
  windup(e, 0.8, () => {
    const path = [pts[0]];
    let cutAt = false;
    for (const p of pts.slice(1)) { path.push(p); if (p.m.dead) { cutAt = true; break; } } // 壊れた鏡で止まる
    if (!cutAt) path.push({ x: last.x + Math.cos(lw.a) * RBEAM_LEN * CHAOS.area, y: last.y + Math.sin(lw.a) * RBEAM_LEN * CHAOS.area });
    ai.rbeam = { pts: path, t: 0.45, W };
    bfx.push({ kind: 'rbeam', pts: path, x: path[0].x, y: path[0].y, w: W, t: 0, life: 0.45 });
    for (const p of path.slice(1, -1)) { burst(p.x, p.y, 16, [...PRISM, '#ffffff'], { sp: 90, glow: true, life: 0.35 }); if (p.m) p.m.flash = 0.1; fxRays(p.x, p.y, 34, '#a04a8a', { foe: true, n: 10, life: 0.3, core: '#ff8ad8' }); } // 鏡で折れる所
    fxRays(path[0].x, path[0].y, 40, '#a04a8a', { foe: true, n: 12, life: 0.3, core: '#ff8ad8' }); // 撃ち出す光
    AudioMan.zap(); shake(3);
  });
}
function updReflect(e, ai, dt) {
  const b = ai.rbeam;
  if (!b) return;
  for (let i = 0; i + 1 < b.pts.length; i++) { const A = b.pts[i], B = b.pts[i + 1]; if (segD2(P.x, P.y, A.x, A.y, B.x, B.y) < Math.pow(b.W / 2 + 3, 2)) { hurtPlayer(e.dmg); break; } }
  if ((b.t -= dt) <= 0) ai.rbeam = null;
}
// 乱反射: 0.4秒(女王が白く光る)→ 速い光の弾(速さ 320)を 2発(激昂 3発。0.12秒おき)女王の弾へ撃つ。当たるたびに 0.06秒きらめいて、次の一番近い女王の弾(または鏡)へ跳ねる
//   2発目以降は、前の光が最初に向かった弾には向かわない(同じ道をなぞらないように)
//   8回(激昂 10回)跳ねたら最後はプレイヤーへ(跳ね先がなくなったらその時点で)。×0.9
const rayTargets = (e, ai) => eprojs.some(q => q.qb) || (ai.mirrors || []).some(m => !m.dead);
function prismScatter(e, ai) {
  AudioMan.charge(0.4);
  windup(e, 0.4, () => {
    const taken = new Set(); // 前の光が最初に向かった弾
    for (let k = 0; k < (ai.enraged ? 3 : 2); k++) later(ai, k * 0.12, () => {
      const p = { kind: 'ray', x: e.x, y: e.y - 6, vx: 0, vy: 0, dmg: e.dmg * 0.9 * (S.eatk ?? 1), life: 12, t: 0, r: 3 * CHAOS.area, spd: 320, bounces: ai.enraged ? 10 : 8, used: new Set(taken), trail: [], owner: e, pause: 0 };
      eprojs.push(p); rayNext(p); if (p.tgt) taken.add(p.tgt);
      burst(e.x, e.y - 6, 14, ['#ffffff', '#fff6c8'], { sp: 80, glow: true, life: 0.3 }); AudioMan.zap();
    });
    hint('scatter', _t('乱反射'), _t('光の弾が女王の弾を渡り歩き、最後にこちらへ飛んでくる'));
  });
}
function rayNext(p) {
  if (p.bounces <= 0) return rayFinal(p);
  let best = null, bd = 260 * 260;
  for (const q of eprojs) if (q.qb && !p.used.has(q)) { const d = d2(q.x, q.y, p.x, p.y); if (d < bd) { bd = d; best = q; } }
  for (const m of p.owner.ai.mirrors || []) if (!m.dead && !p.used.has(m)) { const d = d2(m.x, m.y - 10, p.x, p.y); if (d < bd) { bd = d; best = m; } }
  if (!best) return rayFinal(p);
  p.tgt = best;
}
function rayFinal(p) { // 最後はプレイヤーへまっすぐ(2秒で消える)
  p.final = true; p.tgt = null;
  const a = Math.atan2(P.y - p.y, P.x - p.x); p.vx = Math.cos(a) * p.spd; p.vy = Math.sin(a) * p.spd; p.life = p.t + 2;
}
function updRay(p, dt) {
  p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 12) p.trail.shift();
  if (p.pause > 0) { p.pause -= dt; p.vx = p.vy = 0; if (p.pause <= 0 && p.final) rayFinal(p); return; }
  if (p.final) return;
  const T = p.tgt;
  if (!T || T.dead || (T.kind && !eprojs.includes(T))) { rayNext(p); if (p.final) return; return updRay(p, 0); } // 跳ね先が消えた: 次へ
  const tx = T.x, ty = T.y - (T.obj ? 10 : 0), d = Math.hypot(tx - p.x, ty - p.y);
  if (d <= p.spd * dt + 3) { // 当たった: きらめいて次へ
    p.x = tx; p.y = ty; p.vx = p.vy = 0; p.bounces--; p.pause = 0.06; p.used.add(T);
    if (T.obj) T.flash = 0.08;
    burst(tx, ty, 8, ['#ffffff', ...PRISM], { sp: 70, glow: true, life: 0.25 }); addFlash(tx, ty, 30, '#ffffff', 0.5); AudioMan.tick(10 - p.bounces);
    rayNext(p);
    return;
  }
  p.vx = (tx - p.x) / d * p.spd; p.vy = (ty - p.y) / d * p.spd;
}
// 光の屈折弾: 遅い大きな光の玉(速さ 50、×1.0)をプレイヤーへ。1.5秒たつか、プレイヤーの 60 以内で 7つの欠片に割れてプレイヤーへ扇状に(±0.6rad、速さ 120、×0.7)
function refractOrb(e) {
  const a = Math.atan2(P.y - (e.y - 6), P.x - e.x);
  eprojs.push({ kind: 'prismorb', x: e.x, y: e.y - 6, vx: Math.cos(a) * 50, vy: Math.sin(a) * 50, dmg: e.dmg * (S.eatk ?? 1), sdmg: e.dmg * 0.7, life: 6, t: 0, r: 6 * CHAOS.area, qb: true });
  burst(e.x, e.y - 6, 10, [...PRISM, '#ffffff'], { sp: 50, glow: true, life: 0.3 }); AudioMan.chime();
}
function splitOrb(p) {
  const a = Math.atan2(P.y - p.y, P.x - p.x);
  for (let i = 0; i < 7; i++) { const s = eball(p.x, p.y, a + (i - 3) * 0.2, 120, p.sdmg, 'pshard'); s.ci = i; s.qb = true; }
  burst(p.x, p.y, 20, [...PRISM, '#ffffff'], { sp: 90, glow: true, life: 0.35 }); addFlash(p.x, p.y, 40, '#ffffff', 0.5); AudioMan.chime();
}
// 鏡の分身: 女王と同じ姿の分身 3体(激昂 4体)が 6秒。全員が 1.5秒ごとに光の弾。分身は 1撃で消え、本物だけ HP が減る(本物は 0.5秒ごとに弱く光る)
function startClones(e, ai) {
  const n = ai.enraged ? 4 : 3, total = n + 1, a0 = rand(0, TAU), R0 = rand(110, 130), real = (Math.random() * total) | 0;
  const spots = [...Array(total)].map((_, i) => ({ x: P.x + Math.cos(a0 + TAU / total * i) * R0, y: P.y + Math.sin(a0 + TAU / total * i) * R0 }));
  queenWarp(e, spots[real].x, spots[real].y);
  const list = spots.filter((_, i) => i !== real).map(p => {
    const c = spawnObj(e, 'clone', p.x, p.y, { pct: 0, r: e.r, life: 6 });
    c.hp = c.maxhp = 1; c.disguise = true;
    burst(p.x, p.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 });
    return c;
  });
  ai.clones = { t: 0, list, shot: 1.5 };
  screenFlash(0.25, '#ffd0f0'); AudioMan.chime(); AudioMan.zap();
  hint('mirror', _t('鏡の分身'), _t('分身は1撃で消える。弱く光るのが本物'));
}
function updClones(e, ai, dt) {
  const c = ai.clones;
  if (!c) return;
  c.t += dt; c.shot -= dt * CHAOS.rate;
  if (c.shot <= 0) {
    c.shot = 1.5;
    for (const s of [e, ...c.list.filter(x => !x.dead)]) { const p = eball(s.x, s.y - 6, Math.atan2(P.y - s.y, P.x - s.x), 80, e.dmg * 0.7, 'pshard'); p.ci = (Math.random() * 7) | 0; p.qb = true; }
    AudioMan.shoot();
  }
  for (const s of c.list) if (!s.dead) s.face = P.x < s.x ? -1 : 1;
  if (c.t >= 6) { for (const s of c.list) if (!s.dead) { s.dead = true; objDown(s, false); } ai.clones = null; }
}
// 瞬き: プレイヤーの隣に 円 半径 40(0.6秒)→ そこに現れて光の爆発 ×1.2。移る前にいた位置に女王の鏡を残す
function queenBlink(e, ai) {
  const ba = rand(0, TAU), tx = P.x + Math.cos(ba) * 20, ty = P.y + Math.sin(ba) * 20;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 40, t: 0, life: 0.6 });
  AudioMan.charge(0.6);
  windup(e, 0.6, () => {
    const ox = e.x, oy = e.y;
    queenWarp(e, tx, ty);
    placeMirror(e, ai, ox, oy);
    hitCircle(tx, ty, 40, e.dmg * 1.2);
    const R0 = 40 * CHAOS.area;
    burst(tx, ty, 40, [...PRISM, '#ffffff'], { sp: 150, glow: true, life: 0.5 });
    addRing(tx, ty, R0, '#ffffff', { w: 3, life: 0.35 }); addFlash(tx, ty, R0 * 3, '#ffd0f0', 0.9);
    shockAt(tx, ty, 1.4, 0.8); shake(7); AudioMan.boom();
    bossBlast(tx, ty, R0, Object.assign({ n: 16, decal: false }, BFX.pqueen)); // 光の爆発
  });
}
