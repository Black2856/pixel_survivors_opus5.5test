// bosses/stag.js — ボス: 晶角の大鹿: 連続突進(終点に結晶の柱)→ 残像の突進 / 晶棘の列 / 七色の欠片 / 角の薙ぎ払い(押し出し → 突進)/ 激昂: 群れの疾走
'use strict';

// ---------- 晶角の大鹿: 連続突進(終点に結晶の柱)→ 残像の突進 / 晶棘の列 / 七色の欠片 / 角の薙ぎ払い(押し出し → 突進)/ 激昂: 群れの疾走 ----------
//   結晶の柱は大鹿の欠片と残像を遮る。大鹿が突進で柱にぶつかると柱が砕け、1.5秒ひるむ(受けるダメージ ×1.5)
const PRISM = ['#ff5d73', '#ff9a3d', '#ffd23f', '#7dff9a', '#7ad7ff', '#8a7aff', '#d88aff']; // 七色(弾・棘・光線の色)
function stagAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'stun') { e.flash = Math.sin(ai.pt * 30) > 0.6 ? 0.04 : 0; if ((ai.pt -= dt) <= 0) { ai.act = null; e.takeK = 1; } return; }
  if (ai.act === 'rush') { updStagRush(e, ai, dt); return; }
  // 距離 120 を保って速く回り込む(ときどき回る向きを変える)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(2.5, 4.5); ai.side = -ai.side; }
  const want = 120, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 30 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 30 * ai.side) * slow * dt;
  ai.rush -= dt * R; ai.spike -= dt * R; ai.shard -= dt * R; ai.sweep -= dt * R; if (ai.enraged) ai.herd -= dt * R;
  if (ai.shard <= 0) { ai.shard = ai.enraged ? 3 : 4; prismShards(e, 0); if (ai.enraged) later(ai, 0.3, () => prismShards(e, Math.PI / 7)); } // 七色の欠片(ほかの技と並んで撃つ)
  if (dist < 50 && ai.sweep <= 0) { // 角の薙ぎ払い: 押し飛ばして、続けて突進 1回(どちらも無敵無視)
    ai.sweep = 3;
    const ba = a;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a: ba, r: 55, h: 1.22, t: 0, life: 0.4 });
    windup(e, 0.4, () => {
      slashes.push({ x: e.x, y: e.y, a: ba, r: 55 * CHAOS.area, t: 0, life: 0.24, span: 2.44, pal: SWING_PAL.enemy, enemy: true });
      if (inFan(e.x, e.y, ba, 55, 1.22)) { hurtPlayer(e.dmg * 1.1, { pierce: true }); pushPlayer(ba, 100, 0.3); }
      AudioMan.slash(); shake(4);
      startStagRush(e, ai, 1, { pierce: true, k: 0.9 });
    });
  } else if (ai.rush <= 0) { ai.rush = ai.enraged ? 4.5 : 6; startStagRush(e, ai, ai.enraged ? 4 : 3, {}); }
  else if (ai.enraged && ai.herd <= 0) { ai.herd = 7; stagHerd(e, ai); }
  else if (ai.spike <= 0) { ai.spike = ai.enraged ? 4 : 5; crystalSpikes(e, ai, a); }
}
// 連続突進: 各 0.45秒の予告(最初の 0.3秒はプレイヤーを追い、残りは止まる)→ 速さ 380 で 220。終点に結晶の柱
//   o.pierce: 角の薙ぎ払いのあとの突進(×0.9・無敵無視・柱は立てない・残像なし)
function startStagRush(e, ai, n, o) {
  ai.act = 'rush'; ai.rs = { n, i: 0, segs: [], pierce: !!o.pierce, k: o.k || 1, mine: new Set() }; // mine: この連続突進で立てた柱(ぶつからない。次の突進から当たる)
  stagTele(e, ai);
}
function stagTele(e, ai) {
  const rs = ai.rs;
  rs.ph = 'tele'; rs.t = 0; rs.dir = Math.atan2(P.y - e.y, P.x - e.x); rs.hit = false;
  pushWarn({ kind: 'line', x: e.x, y: e.y, a: rs.dir, len: 220, w: e.r * 2, t: 0, life: 0.45, fixed: true, track: q => { q.x = e.x; q.y = e.y; if (q.t < 0.3) rs.dir = q.a = Math.atan2(P.y - e.y, P.x - e.x); } }); // 突進の経路(体当たりなので広げない)
}
function updStagRush(e, ai, dt) {
  const rs = ai.rs;
  rs.t += dt;
  if (rs.ph === 'tele') { // 角が光り、前脚で地面をかく
    e.flash = Math.sin(rs.t * 40) > 0 ? 0.04 : 0; e.face = Math.cos(rs.dir) < 0 ? -1 : 1;
    if (Math.random() < dt * 30) part(e.x + rand(-6, 6), e.y + 10, -Math.cos(rs.dir) * 30 + rand(-10, 10), -rand(10, 25), 0.4, pick(['#5a4a8a', '#3a2c5a', '#9ff7ff']), { drag: 2 });
    if (rs.t < 0.45) return;
    rs.ph = 'dash'; rs.t = 0; rs.x0 = e.x; rs.y0 = e.y; e.air = rs.pierce; // 無敵無視の突進は自分で当たりを判定する
    rs.ignore = new Set([...rs.mine, ...enemies.filter(o => o.obj === 'crystal' && !o.dead && d2(o.x, o.y, e.x, e.y) < Math.pow(o.r + e.r + 2, 2))]); // 走り出す場所の柱と、この連続突進で立てた柱は無視
    AudioMan.dash(); AudioMan.roar();
    return;
  }
  const step = 380 * dt;
  e.x += Math.cos(rs.dir) * step; e.y += Math.sin(rs.dir) * step; e.face = Math.cos(rs.dir) < 0 ? -1 : 1;
  for (let i = 0; i < 2; i++) part(e.x + rand(-8, 8), e.y + rand(-6, 6), -Math.cos(rs.dir) * 60, -Math.sin(rs.dir) * 60, 0.35, pick(PRISM), { glow: true, drag: 3 }); // 七色の光の尾
  if (rs.pierce && !rs.hit && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2)) { rs.hit = true; hurtPlayer(e.dmg * rs.k, { pierce: true }); }
  for (const o of enemies) { // 結晶の柱にぶつかった: 柱が砕けて、大鹿は 1.5秒ひるむ
    if (o.obj !== 'crystal' || o.dead || rs.ignore.has(o) || d2(o.x, o.y, e.x, e.y) > Math.pow(o.r + e.r, 2)) continue;
    o.dead = true; objDown(o, true); e.air = false;
    ai.act = 'stun'; ai.pt = 1.5; e.takeK = 1.5;
    hitstop(0.08); shake(10); shockAt(e.x, e.y, 1.6, 0.8); AudioMan.crush();
    burst(e.x, e.y, 50, [...PRISM, '#ffffff'], { sp: 160, glow: true, life: 0.7 });
    bossBlast(e.x, e.y, 40, Object.assign({ n: 18, decal: false }, BFX.stag)); // 砕けた結晶の光
    UI.announce(_t('柱にぶつかった!'), _t('ひるんでいる間は 1.5倍のダメージ'));
    return;
  }
  if (rs.t * 380 < 220) return;
  rs.segs.push({ x0: rs.x0, y0: rs.y0, x1: e.x, y1: e.y });
  e.air = false;
  if (!rs.pierce) rs.mine.add(crystalPillar(e, e.x, e.y));
  if (++rs.i < rs.n) { stagTele(e, ai); return; }
  ai.act = null;
  if (!rs.pierce) stagAfterimage(e, ai, rs.segs, rs.mine);
}
// 結晶の柱(HP 2%・半径 10・12秒・最大 5本。多いときは古いものから崩れる)
function crystalPillar(e, x, y) {
  const mine = enemies.filter(o => o.owner === e && o.obj === 'crystal' && !o.dead);
  if (mine.length >= 5) { mine[0].dead = true; objDown(mine[0], false); }
  const o = spawnObj(e, 'crystal', x, y, { pct: 0.02, r: 10, life: 12 });
  burst(x, y, 24, [...PRISM, '#ffffff'], { sp: 90, up: 40, glow: true, life: 0.5 }); shockAt(x, y, 0.7, 0.85); AudioMan.chime();
  bossBlast(x, y, 18, Object.assign({ n: 8, cracks: 5 }, BFX.stag)); // 結晶が突き出た地面
  hint('crystal', _t('結晶の柱'), _t('次の突進を柱へ誘うと、大鹿がぶつかってひるむ。柱は欠片と残像も遮る'));
  return o;
}
// 残像の突進: 突進の経路が光の線で残り、1秒後に同じ経路を結晶の残像が同じ速さで走る(×0.6。柱で消える)
function stagAfterimage(e, ai, segs, mine) { // mine: この連続突進で立てた柱(残像はすり抜ける)
  let delay = 1, total = 0;
  for (const g of segs) total += Math.hypot(g.x1 - g.x0, g.y1 - g.y0) / 380;
  bfx.push({ kind: 'trail', x: 0, y: 0, segs, t: 0, life: 1 + total + 0.2 });
  for (const g of segs) {
    const L = Math.hypot(g.x1 - g.x0, g.y1 - g.y0), ang = Math.atan2(g.y1 - g.y0, g.x1 - g.x0);
    later(ai, delay, () => { eprojs.push({ kind: 'phantom', x: g.x0, y: g.y0, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380, dmg: e.dmg * 0.6 * (S.eatk ?? 1), life: L / 380, t: 0, r: e.r, keep: true, blk: 'crystal', ignore: mine, face: Math.cos(ang) < 0 ? -1 : 1 }); AudioMan.dash(); });
    delay += L / 380;
  }
}
// 七色の欠片: 全周へ 7発(速さ 95・×0.45)
function prismShards(e, off) {
  for (let i = 0; i < 7; i++) { const p = eball(e.x, e.y - 6, TAU / 7 * i + off, 95, e.dmg * 0.45, 'pshard'); p.ci = i; p.blk = 'crystal'; }
  burst(e.x, e.y - 6, 14, PRISM, { sp: 70, glow: true, life: 0.3 }); AudioMan.chime();
}
// 晶棘の列: 大鹿からプレイヤーへ 円 半径 12 を 6個(0.6秒の予告)→ 根元から順に 0.08秒おきに結晶の棘 ×0.8
function crystalSpikes(e, ai, a) {
  const pts = [1, 2, 3, 4, 5, 6].map(i => ({ x: e.x + Math.cos(a) * 22 * i, y: e.y + Math.sin(a) * 22 * i }));
  pts.forEach((p, i) => pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 12, t: 0, life: 0.6 + 0.08 * i }));
  e.sq = 1.2; AudioMan.charge(0.6);
  pts.forEach((p, i) => later(ai, 0.6 + 0.08 * i, () => {
    hitCircle(p.x, p.y, 12, e.dmg * 0.8);
    bfx.push({ kind: 'spike', x: p.x, y: p.y, r: 12 * CHAOS.area, t: 0, life: 0.7, ci: i % 7, seed: (Math.random() * 1e6) | 0 });
    burst(p.x, p.y, 8, [PRISM[i % 7], '#ffffff'], { sp: 60, up: 30, glow: true, life: 0.35 });
    if (i % 2 === 0) { AudioMan.chime(); shake(2); }
  }));
}
// 群れの疾走(激昂): 画面を横切る帯 5本(幅 20・50 おき)が 0.4秒おきに順に光り、各帯の 0.6秒後に幻の鹿が走る(速さ 400・×0.8)
function stagHerd(e, ai) {
  const th = rand(0, TAU), L = Math.min(480, Math.hypot(GFX.VW, GFX.VH) + 60), c = Math.cos(th), s = Math.sin(th), nx = -s, ny = c;
  hint('herd', _t('群れの疾走'), _t('光った帯を幻の鹿が駆け抜ける。帯のすき間へ'));
  AudioMan.roar();
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 50, x0 = P.x + nx * off - c * L / 2, y0 = P.y + ny * off - s * L / 2;
    later(ai, 0.4 * i, () => {
      pushWarn({ kind: 'line', x: x0, y: y0, a: th, len: L, w: 20 * CHAOS.area, t: 0, life: 0.6, fixed: true });
      later(ai, 0.6, () => { eprojs.push({ kind: 'phantom', x: x0, y: y0, vx: c * 400, vy: s * 400, dmg: e.dmg * 0.8 * (S.eatk ?? 1), life: L / 400, t: 0, r: 10 * CHAOS.area, keep: true, face: c < 0 ? -1 : 1 }); AudioMan.dash(); });
    });
  }
}
