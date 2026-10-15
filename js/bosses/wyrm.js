// bosses/wyrm.js — ボス: 白骨竜: 肋骨の魔弾(撃ち続ける骨柱 → 螺旋)/ 狙い撃ち(頭が光る)/ 尾の薙ぎ払い(回る帯)/ 骨槍(追う帯)/ 弓兵召喚
'use strict';

// ---------- 白骨竜: 肋骨の魔弾(撃ち続ける骨柱 → 螺旋)/ 狙い撃ち(頭が光る)/ 尾の薙ぎ払い(回る帯)/ 骨槍(追う帯)/ 弓兵召喚 ----------
function wyrmAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'tail') { // 尾の薙ぎ払い: 0.8秒の予告(止まって身構える)→ 同じ軌道を 0.4秒で薙ぐ
    const tl = ai.tl;
    tl.t += dt;
    if (tl.t < 0.8) { e.sq = 1.1; return; }
    const k = Math.min(1, (tl.t - 0.8) / 0.4), ang = tl.a0 + tl.dir * Math.PI * k, L = 130 * CHAOS.area;
    if (!tl.swung) {
      tl.swung = true; AudioMan.slash(); AudioMan.dash(); shake(3);
      slashes.push({ x: e.x, y: e.y, a: tl.a0 + tl.dir * Math.PI / 2, r: L, t: 0, life: 0.5, flip: tl.dir < 0 ? 1 : 0, span: Math.PI, pal: SWING_PAL.enemy, enemy: true });
    }
    hitLine(e.x, e.y, ang, 130, 20, e.dmg * 1.1);
    for (let i = 0; i < 2; i++) { const r = rand(0.5, 1) * L; part(e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r, rand(-20, 20), -rand(10, 40), 0.4, pick(['#c8b8a0', '#8a8676', '#efe9d4']), { g: 120 }); } // 尾が地面を擦る土煙
    if (k >= 1) { ai.act = null; shake(4); AudioMan.thud(); }
    return;
  }
  // 距離 110 を保ちながら横へ回り込む
  const want = 110, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 22) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 22) * slow * dt;
  if (ai.spN > 0 && (ai.spGap -= dt * R) <= 0) { // 螺旋(肋骨の魔弾の直後だけ): 反対向きに 2発ずつ回しながら
    ai.spGap = ai.enraged ? 0.09 : 0.12; ai.spN--; ai.spA += 0.5;
    for (const o of [0, Math.PI]) eball(e.x, e.y - 4, ai.spA + o, 60, e.dmg * 0.5);
    if (ai.spN % 4 === 0) AudioMan.shoot();
  }
  if (ai.aiming > 0 && (ai.aiming -= dt) <= 0) { // 狙い撃ち: 頭が光ったあと 3発の扇
    for (let i = -1; i <= 1; i++) eball(e.x, e.y - 8, a + i * 0.22, 78, e.dmg * 0.6);
    AudioMan.shoot(); burst(e.x + Math.cos(a) * 8, e.y - 8 + Math.sin(a) * 8, 8, ['#6ee7ff', '#efe9d4', '#ffffff'], { sp: 60, glow: true, life: 0.25 });
  }
  ai.shield -= dt * R; ai.aim -= dt * R; ai.tail -= dt * R; ai.spear -= dt * R; ai.sum -= dt * R;
  if (ai.shield <= 0) { ai.shield = ai.enraged ? 12 : 16; ribShield(e, ai); }
  if (ai.aim <= 0 && !(ai.aiming > 0)) { ai.aim = ai.enraged ? 1.8 : 2.2; ai.aiming = 0.3; }
  if (ai.tail <= 0 && dist < 150) { ai.tail = ai.enraged ? 4.5 : 6; startTail(e, ai, a); return; }
  if (ai.spear <= 0) { ai.spear = ai.enraged ? 4 : 5; boneSpear(e, ai); }
  if (ai.sum <= 0) { // 弓兵召喚: 骨の砂ぼこりから弓兵 3体
    ai.sum = 11;
    for (let i = 0; i < 3; i++) { const sa = TAU / 3 * i + rand(-0.4, 0.4), s = spawnEnemy('archer', { x: e.x + Math.cos(sa) * 24, y: e.y + Math.sin(sa) * 24 }); burst(s.x, s.y, 12, ['#efe9d4', '#8a8676', '#5a4030'], { sp: 60, g: 150 }); }
    AudioMan.summon();
  }
}
// 肋骨の魔弾: プレイヤーの周り 半径 80 に骨柱 4本(HP 各 5%・10秒)。骨柱はプレイヤーへ弾を撃ち続ける(最初の1発は 1 / 1.5 / 2 / 2.5秒後とずらす)。立った直後に螺旋
function ribShield(e, ai) {
  const a0 = rand(0, TAU), pts = [0, 1, 2, 3].map(i => ({ x: P.x + Math.cos(a0 + i * Math.PI / 2) * 80, y: P.y + Math.sin(a0 + i * Math.PI / 2) * 80 }));
  for (const p of pts) pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 6, t: 0, life: 0.8, fixed: true }); // 骨柱が立つ場所(攻撃ではないので広げない)
  AudioMan.charge(0.8);
  later(ai, 0.8, () => {
    pts.forEach((p, i) => {
      spawnObj(e, 'pillar', p.x, p.y, { pct: 0.05, r: 6, life: 10, spawnT: 1 + i * 0.5 });
      burst(p.x, p.y, 18, ['#efe9d4', '#8a8676', '#5a4030', '#6ee7ff'], { sp: 90, g: 220 }); shockAt(p.x, p.y, 0.6, 0.9);
      bossBlast(p.x, p.y, 16, Object.assign({ n: 9, cracks: 5 }, BFX.wyrm)); // 骨柱が突き破った地面
    });
    shake(6); AudioMan.thud(); AudioMan.boom();
    ai.spN = Math.round((ai.enraged ? 4 : 3) / (ai.enraged ? 0.09 : 0.12)); ai.spGap = 0.25; ai.spA = rand(0, TAU);
    hint('ribs', _t('肋骨の魔弾'), _t('骨柱は弾を撃ち続ける。壊して止めよう'));
  });
}
// 尾の薙ぎ払い: 尾の帯(長さ 130・幅 20)が 0.8秒かけて 180° 回りながら薙ぐ範囲を示す
function startTail(e, ai, a) {
  const dir = Math.random() < 0.5 ? 1 : -1, a0 = a - dir * Math.PI / 2;
  ai.act = 'tail'; ai.tl = { t: 0, a0, dir };
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a: a0, r: 140, h: 0.001, t: 0, life: 1.2, noFill: true, track: w => { const k = Math.min(1, w.t / 0.8); w.h = Math.max(0.001, Math.PI * k / 2); w.a = a0 + dir * w.h; } });
  pushWarn({ kind: 'line', x: e.x, y: e.y, a: a0, len: 130, w: 20, t: 0, life: 0.8, track: w => { w.a = a0 + dir * Math.PI * Math.min(1, w.t / 0.8); } });
  AudioMan.charge(0.8);
}
// 骨槍: 竜からプレイヤーへの帯が 1.0秒追い、0.3秒止まってから、帯の長さだけ飛ぶ骨槍(貫通)。3本(±0.2rad)、激昂は 5本(±0.2rad の中に 0.1rad おき)
function boneSpear(e, ai) {
  const offs = ai.enraged ? [-0.2, -0.1, 0, 0.1, 0.2] : [-0.2, 0, 0.2];
  const ws = offs.map(o => {
    const w = { kind: 'line', x: e.x, y: e.y, a: Math.atan2(P.y - e.y, P.x - e.x) + o, len: 260, w: 8, t: 0, life: 1.3, track: q => { q.x = e.x; q.y = e.y; if (q.t < 1) q.a = Math.atan2(P.y - e.y, P.x - e.x) + o; } };
    pushWarn(w);
    return w;
  });
  AudioMan.charge(1.3);
  later(ai, 1.3, () => {
    const len = 260 * CHAOS.area, spd = 280;
    for (const w of ws) eprojs.push({ kind: 'bspear', x: e.x, y: e.y, vx: Math.cos(w.a) * spd, vy: Math.sin(w.a) * spd, dmg: e.dmg * 1.2 * (S.eatk ?? 1), life: len / spd, t: 0, r: 4 * CHAOS.area, keep: true });
    AudioMan.spearThrow(); shake(3);
    burst(e.x, e.y, 14, ['#efe9d4', '#6ee7ff', '#ffffff'], { sp: 90, glow: true, life: 0.3 });
    fxRays(e.x, e.y - 4, 40, '#2a5a7a', { foe: true, n: 10, life: 0.24, core: '#6ee7ff' }); // 骨槍を放つ瞬間の光
  });
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawWyrmFx(e, ai, sx, gx, ex, ey, sp, yo) {
  const k = 1 - ai.aiming / 0.3, hx = ex, hy = ey + yo - sp.h / 2 + 7;
  for (const s of [-1, 1]) { sx.fillStyle = gx.fillStyle = '#ffffff'; sx.fillRect(Math.round(hx + s * 4) - 1, Math.round(hy), 3, 2); gx.fillRect(Math.round(hx + s * 4) - 1, Math.round(hy), 3, 2); }
  addLight(e.x, e.y + yo - sp.h / 2 + 7, 30 + 50 * k, '#6ee7ff', 1);
}
