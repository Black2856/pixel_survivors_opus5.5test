// bosses/elder.js — ボス: 古樹の主: ゆっくり歩く。★芽吹き(若芽を壊さないと通れない茨の木に育つ)/ 根の波(衰弱)/ 枝の薙ぎ払い / 木の実落とし / 葉の嵐 / 激昂: 根の檻
'use strict';

// ---------- 古樹の主: ゆっくり歩く。★芽吹き(若芽を壊さないと通れない茨の木に育つ)/ 根の波(衰弱)/ 枝の薙ぎ払い / 木の実落とし / 葉の嵐 / 激昂: 根の檻 ----------
const LEAF = ['#5a9a48', '#8fd06a', '#c8e890', '#3a6a34'];
function elderAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'sweep') { // 枝の薙ぎ払い: 0.8秒の予告(止まって枝を振りかぶる)→ 同じ軌道を 0.4秒で薙ぐ。×1.0・60 押す
    const tl = ai.tl;
    tl.t += dt;
    if (tl.t < 0.8) { e.sq = 1.1; return; }
    const k = Math.min(1, (tl.t - 0.8) / 0.4), ang = tl.a0 + tl.dir * Math.PI * k, L = 110 * CHAOS.area;
    if (!tl.swung) {
      tl.swung = true; AudioMan.slash(); AudioMan.dash(); shake(3);
      slashes.push({ x: e.x, y: e.y, a: tl.a0 + tl.dir * Math.PI / 2, r: L, t: 0, life: 0.5, flip: tl.dir < 0 ? 1 : 0, span: Math.PI, pal: SWING_PAL.enemy, enemy: true });
    }
    if (!tl.hit && hitLine(e.x, e.y, ang, 110, 18, e.dmg)) { tl.hit = true; pushPlayer(ang + tl.dir * Math.PI / 2, 60, 0.25); }
    for (let i = 0; i < 2; i++) { const r = rand(0.5, 1) * L; part(e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r, rand(-20, 20), -rand(10, 40), 0.5, pick(LEAF), { g: 80, drag: 1 }); } // 散る葉
    if (k >= 1) { ai.act = null; shake(4); AudioMan.thud(); }
    return;
  }
  if (dist > 30) { e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt; }
  if (Math.random() < dt * 5) part(e.x + rand(-14, 14), e.y - rand(10, 26), rand(-8, 8), rand(6, 14), rand(0.8, 1.2), pick(LEAF), { g: 20, drag: 1 }); // 梢から葉が舞い落ちる
  if (ai.lvN > 0 && (ai.lvGap -= dt * R) <= 0) { // 葉の嵐: 2本の腕の螺旋(0.12秒ごと)
    ai.lvGap = 0.12; ai.lvN--; ai.lvA += 0.42;
    for (const o of [0, Math.PI]) Object.assign(eball(e.x, e.y - 6, ai.lvA + o, 60, e.dmg * 0.5, 'leaf'), { r: 3 * CHAOS.area });
    if (ai.lvN % 4 === 0) AudioMan.dash();
  }
  ai.sprout -= dt * R; ai.roots -= dt * R; ai.sweep -= dt * R; ai.fruit -= dt * R; ai.leaves -= dt * R; if (ai.enraged) ai.cage -= dt * R;
  if (ai.leaves <= 0) { ai.leaves = ai.enraged ? 7 : 9; ai.lvN = 21; ai.lvGap = 0; ai.lvA = rand(0, TAU); } // 弾はほかの技と並んで撃つ(2.5秒)
  if (ai.enraged && ai.cage <= 0) { ai.cage = 14; rootCage(e, ai); }
  else if (ai.sprout <= 0) { ai.sprout = ai.enraged ? 12 : 16; elderSprout(e, ai); }
  else if (ai.sweep <= 0 && dist < 80) { ai.sweep = ai.enraged ? 4 : 5; elderSweep(e, ai, a); }
  else if (ai.roots <= 0) { ai.roots = ai.enraged ? 4.5 : 6; rootWave(e, ai, a, dist); }
  else if (ai.fruit <= 0) { ai.fruit = ai.enraged ? 6 : 8; fruitDrop(e, ai); }
}
// 枝の薙ぎ払い: 枝の帯(長さ 110・幅 18)が 0.8秒かけて 180° 回りながら出る → 同じ軌道を 0.4秒で薙ぐ
function elderSweep(e, ai, a) {
  const dir = Math.random() < 0.5 ? 1 : -1, a0 = a - dir * Math.PI / 2;
  ai.act = 'sweep'; ai.tl = { t: 0, a0, dir };
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a: a0, r: 120, h: 0.001, t: 0, life: 1.2, noFill: true, track: w => { const k = Math.min(1, w.t / 0.8); w.h = Math.max(0.001, Math.PI * k / 2); w.a = a0 + dir * w.h; } });
  pushWarn({ kind: 'line', x: e.x, y: e.y, a: a0, len: 110, w: 18, t: 0, life: 0.8, track: w => { w.a = a0 + dir * Math.PI * Math.min(1, w.t / 0.8); } });
  AudioMan.charge(0.8);
}
// ★芽吹き: 種を 4つ(激昂 6つ)プレイヤーの周りへ飛ばす → 若芽(壊せる物、HP 5%)。8秒のうちに壊さないと茨の木に育ち、15秒 通れない(近づくと予告のあと枝で叩く ×0.8)
function elderSprout(e, ai) {
  const n = ai.enraged ? 6 : 4, a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    const pa = a0 + TAU / n * i + rand(-0.3, 0.3), pr = rand(50, 90), tx = P.x + Math.cos(pa) * pr, ty = P.y + Math.sin(pa) * pr;
    later(ai, i * 0.12, () => lob('seed', e.x, e.y - 22, tx, ty, 0.8, 50, p => {
      spawnObj(e, 'sprout', p.x, p.y, { pct: 0.05, r: 5, life: 8 });
      burst(p.x, p.y, 10, ['#5a3a1a', '#8a5a2a', '#8fd06a'], { sp: 50, up: 20, g: 200, life: 0.4 }); AudioMan.thud();
    }));
  }
  e.sq = 1.25; AudioMan.charge(0.5);
  hint('elder_sprout', _t('芽吹き'), _t('若芽を 8秒のうちに壊さないと、通れない茨の木に育つ'));
}
// 根の波: 地中を根が 3本、プレイヤーとその左右へ伸び(盛り上がる土の線)、1秒で突き上げる(円 半径 20、×1.2・衰弱 +2)
function rootWave(e, ai, a, dist) {
  const D = Math.max(40, dist), pts = [-0.35, 0, 0.35].map(da => ({ x: e.x + Math.cos(a + da) * D, y: e.y + Math.sin(a + da) * D }));
  for (const q of pts) {
    pushWarn({ kind: 'circle', x: q.x, y: q.y, r: 20, t: 0, life: 1 });
    bfx.push({ kind: 'rootline', x: e.x, y: e.y + e.r * 0.6, x1: q.x, y1: q.y, t: 0, life: 1 });
  }
  AudioMan.charge(1); e.sq = 1.15;
  later(ai, 1, () => {
    let hit = false;
    for (const q of pts) {
      if (!hit && hitCircle(q.x, q.y, 20, e.dmg * 1.2)) { hit = true; weakPlayer(2); }
      const RR = 20 * CHAOS.area;
      for (let k = 0; k < 5; k++) { const pa = TAU / 5 * k + rand(-0.3, 0.3), pr = RR * rand(0.2, 0.7); bfx.push({ kind: 'rootspike', x: q.x + Math.cos(pa) * pr, y: q.y + Math.sin(pa) * pr, t: 0, life: 0.8, h: rand(9, 15), a: pa }); }
      burst(q.x, q.y, 20, ['#5a3a1a', '#8a5a2a', '#3a6a34', '#c8a060'], { sp: 100, up: 50, g: 240, life: 0.5 });
      bossBlast(q.x, q.y, RR, Object.assign({ n: 10 }, BFX.elder));
    }
    shake(5); AudioMan.boom();
  });
}
// 木の実落とし: 枝をゆすって木の実 6個(プレイヤーの位置と周り 70 以内。着弾 円 半径 16、×0.8)
function fruitDrop(e, ai) {
  e.sq = 1.2; AudioMan.charge(0.4);
  for (let i = 0; i < 6; i++) {
    const pa = rand(0, TAU), pr = i ? rand(20, 70) : 0, tx = P.x + Math.cos(pa) * pr, ty = P.y + Math.sin(pa) * pr, T = 0.9 + i * 0.06;
    pushWarn({ kind: 'circle', x: tx, y: ty, r: 16, t: 0, life: T });
    lob('fruit', e.x + rand(-10, 10), e.y - 26, tx, ty, T, 60, p => {
      hitCircle(p.x, p.y, 16, e.dmg * 0.8);
      burst(p.x, p.y, 14, ['#ff6a4a', '#ffb070', '#c83a2a', '#8fd06a'], { sp: 80, up: 30, g: 220, life: 0.45 }); addRing(p.x, p.y, 16 * CHAOS.area, '#ffb070', { life: 0.25 }); AudioMan.thud();
    });
  }
}
// 根の檻(激昂): プレイヤーの周り(半径 70)に根の輪がせり上がる(抜け道 1か所。輪は歩いて越えられない。回避の無敵なら抜けられる)→ 2秒後に輪の中を締めつける ×1.3・衰弱 +5。輪は 2.5秒で消える
//   予告の赤い円は根の輪が自分の下に描く(tele 秒。ふつうの予告は最前面に描かれ、根が赤に埋もれる)。当たる瞬間の光(snap)はふつうの予告と同じ
function rootCage(e, ai) {
  const cx = P.x, cy = P.y, gap = rand(0, TAU);
  const h = addHazard('rootring', cx, cy, { r: 70, dur: 2.5, tele: 2, gap, gapH: 0.45, w: 8, owner2: e, dmg: e.dmg });
  AudioMan.charge(2); AudioMan.thud(); shake(4);
  hint('elder_cage', _t('根の檻'), _t('根の輪の抜け道から出るか、回避で根を飛び越える'));
  later(ai, 2, () => {
    if (h.done) return;
    h.done = true;
    warns.push({ kind: 'circle', x: cx, y: cy, r: h.r, snap: true, t: 0, life: 0.12 }); // 当たる瞬間: 円が一瞬光る(h.r は攻撃範囲の倍率が掛かっている)
    if (hitCircle(cx, cy, 70, e.dmg * 1.3)) weakPlayer(5);
    const RR = 70 * CHAOS.area;
    for (let k = 0; k < 14; k++) { const pa = TAU / 14 * k + rand(-0.2, 0.2), pr = RR * rand(0.15, 0.85); bfx.push({ kind: 'rootspike', x: cx + Math.cos(pa) * pr, y: cy + Math.sin(pa) * pr, t: 0, life: 0.9, h: rand(10, 18), a: pa }); }
    burst(cx, cy, 50, ['#5a3a1a', '#8a5a2a', '#3a6a34', '#c8a060'], { sp: 150, up: 60, g: 240, life: 0.6 });
    bossBlast(cx, cy, RR * 0.8, Object.assign({ n: 18 }, BFX.elder)); shockAt(cx, cy, 2, 0.75); shake(10); hitstop(0.05, true); AudioMan.boom(); AudioMan.crush();
  });
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// 茨の木(古樹の主の芽吹き): 地面からせり上がる、棘だらけの低い木。叩くときは枝が揺れる
HAZ_DRAW.thorn = (h, hx, hy, fade, hd) => {
  const { t } = hd;
  const sp = ART.S.thorn, k = Math.min(h.rise || 0, Math.max(0, (h.dur - h.t) * 2)), sw = h.swing > 0 ? Math.round(Math.sin(t * 60) * 2) : 0;
  shadow(h.x, h.y + 2, sp.w * 0.9);
  if (k > 0.02) drawSp(sp, h.x + sw, h.y + 3 - sp.h / 2, { sy: k }); // 根元(h.y + 3)を地面に固定して上へ伸びる
  return;
};
// 根の檻(古樹の主): 円に沿ってせり上がる根の柵(抜け道 1か所は根がない)
HAZ_DRAW.rootring = (h, hx, hy, fade, hd) => {
  const { warnBlink, sx, gx } = hd;
  // 予告の赤い円は根の下に描く(最前面の予告に重ねると根が赤に埋もれる)。光の縁は根に重なるので描かない。暗闇の間は見えない(ほかの予告と同じ)
  if (h.t < h.tele && !(P.darkT > 0)) drawWarnCircle(hx, hy, Math.round(h.r), h.t / h.tele, warnBlink ? '#ff3b5c' : '#ffd0d8', { glow: false }); // h.r は攻撃範囲の倍率が掛かっている(締めつけの hitCircle と同じ)
  const R = h.r, rise = Math.min(1, h.t / 0.3, Math.max(0, (h.dur - h.t) / 0.3)), n = Math.ceil(TAU * R / 3), posts = [];
  for (let i = 0; i < n; i++) { const a = TAU / n * i; if (Math.abs(angDiff(a, h.gap)) >= h.gapH) posts.push({ i, x: Math.round(hx + Math.cos(a) * R), y: Math.round(hy + Math.sin(a) * R) }); }
  posts.sort((p, q) => p.y - q.y); // 奥(上)の根から描く
  sx.fillStyle = '#0e0804'; for (const p of posts) sx.fillRect(p.x - 3, p.y - 1, 6, 3); // 根元の暗い土の帯(柵の足元を赤い塗りから浮かせる)
  for (const p of posts) {
    const H = Math.round((10 + 6 * hash2(p.i, h.seed | 0)) * rise);
    for (let j = 0; j < H; j++) { // 根元ほど太い。左が明るく右が暗い木肌(赤の上でも形が見える)
      const w = j < H * 0.3 ? 4 : j < H * 0.6 ? 3 : j < H * 0.85 ? 2 : 1, x0 = p.x - (w >> 1), y = p.y - j;
      sx.fillStyle = j % 3 ? '#6a4626' : '#4a2e14'; sx.fillRect(x0, y, w, 1);
      if (w > 1) { sx.fillStyle = '#b8884e'; sx.fillRect(x0, y, 1, 1); sx.fillStyle = '#1a0e06'; sx.fillRect(x0 + w - 1, y, 1, 1); }
    }
    if (H > 2) { sx.fillStyle = hash2(p.i + 7, h.seed | 0) < 0.5 ? '#8fd06a' : '#d8b070'; sx.fillRect(p.x, p.y - H + 1, 1, 1); } // 先端: 若葉か明るい木肌
  }
  for (const sd of [-1, 1]) { const a = h.gap + sd * h.gapH, x = Math.round(hx + Math.cos(a) * R), y = Math.round(hy + Math.sin(a) * R), H = Math.round(14 * rise); gx.fillStyle = '#4a8a2a'; gx.fillRect(x - 1, y - H, 2, H); } // 抜け道の両端の根は光る(出口の目印)
  return;
};
// 根の波: 地中を進む根(盛り上がった土の線が、古樹から予告の円へ伸びる)
BFX_DRAW.rootline = (f, fx, fy, u, bd) => {
  const { sx } = bd;
  const L = Math.hypot(f.x1 - f.x, f.y1 - f.y), k = Math.min(1, u * 1.1), n = Math.max(1, Math.floor(L * k / 3));
  for (let i = 0; i <= n; i++) {
    const v = i * 3 / L, x = Math.round(lerp(f.x, f.x1, v) - cam.x + Math.sin(i * 1.7 + f.x) * 1.2), y = Math.round(lerp(f.y, f.y1, v) - cam.y);
    sx.fillStyle = '#3a2410'; sx.fillRect(x - 1, y, 3, 1); sx.fillStyle = i === n ? '#c8a060' : '#6a4424'; sx.fillRect(x, y - 1, 1, 1);
  }
  if (k < 1 && Math.random() < 0.5) part(lerp(f.x, f.x1, k), lerp(f.y, f.y1, k), rand(-10, 10), -rand(10, 30), 0.35, pick(['#3a2410', '#6a4424', '#5a3a1a']), { g: 120 }); // 先端で土が跳ねる
  return;
};
