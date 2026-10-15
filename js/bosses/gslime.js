// bosses/gslime.js — ボス: 巨大スライム: 跳ねて接近し粘液床 / スライム召喚 → 吸収 / 大跳躍(落下点が追う)/ 弾み体当たり / 粘液弾 / 激昂: 分裂
'use strict';

// ---------- 巨大スライム: 跳ねて接近し粘液床 / スライム召喚 → 吸収 / 大跳躍(落下点が追う)/ 弾み体当たり / 粘液弾 / 激昂: 分裂 ----------
function gslimeAI(e, ai, dt, a, dist, slow) {
  if (!ai.split0 && !ai.act && e.hp < e.maxhp * 0.5) { ai.split0 = true; startSplit(e, ai); return; } // 分裂: 残りHP 50% で1回(血の夜明けでも HP で決める)
  if (ai.act === 'split0' || ai.act === 'split' || ai.act === 'reform') { updSplit(e, ai, dt); return; }
  if (ai.act === 'leap') { // 大跳躍: 高く跳び、プレイヤーを追う落下点(着地の 0.35秒前に止まる)へ落ちる
    const s = ai.st, w = s.w;
    s.t += dt;
    const k = Math.min(1, s.t / s.T);
    e.x = lerp(s.x0, w.x, k); e.y = lerp(s.y0, w.y, k);
    e.jz = Math.sin(k * Math.PI) * 80; e.air = k < 0.92;
    if (k > 0.75 && !s.fall) { s.fall = true; AudioMan.dash(); } // 落ちてくる風切り
    if (k < 1) return;
    ai.act = null; e.jz = 0; e.air = false; e.sq = 0.45; ai.cd = ai.enraged ? 2 : 3;
    hitCircle(e.x, e.y, 44, e.dmg * 1.3);
    addHazard('goo', e.x, e.y, { r: 30, dur: 8 });
    const R0 = 44 * CHAOS.area;
    shockAt(e.x, e.y, 2, 0.75); shake(11); AudioMan.boom(); AudioMan.splat(); hitstop(0.05);
    addRing(e.x, e.y, R0, '#d8fff2', { w: 3, life: 0.4 }); addRing(e.x, e.y, R0 * 1.4, '#4fd6a8', { w: 2, life: 0.55 });
    bossBlast(e.x, e.y, R0, Object.assign({ n: 16 }, BFX.gslime)); // 落ちた跡
    burst(e.x, e.y, 50, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 160, g: 220 });
    for (let i = 0; i < 24; i++) { const pa = TAU / 24 * i; part(e.x + Math.cos(pa) * 10, e.y + Math.sin(pa) * 6, Math.cos(pa) * R0 * 2.2, Math.sin(pa) * R0 * 1.6, 0.4, pick(['#4fd6a8', '#8affd8']), { drag: 5, sz: 2 }); } // 飛び散る粘液の輪
    return;
  }
  if (ai.act === 'bounce') { // 弾み体当たり: 線上の 3点を 0.25秒おきに順に跳ねて着地
    const b = ai.bn;
    b.t += dt;
    const k = Math.min(1, b.t / 0.25), p = b.pts[b.i];
    e.x = lerp(b.fx, p.x, k); e.y = lerp(b.fy, p.y, k); e.jz = Math.sin(k * Math.PI) * 22; e.air = k < 0.85;
    if (k < 1) return;
    e.jz = 0; e.air = false; e.sq = 0.6;
    hitCircle(p.x, p.y, 26, e.dmg * 0.8);
    addHazard('goo', p.x, p.y, { r: 17, dur: 7 });
    shockAt(p.x, p.y, 0.9, 0.85); shake(5); AudioMan.splat();
    burst(p.x, p.y, 18, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 100, g: 200 });
    addRing(p.x, p.y, 26 * CHAOS.area, '#d8fff2', { w: 2, life: 0.3 });
    if (++b.i >= b.pts.length) { ai.act = null; ai.cd = ai.enraged ? 2.2 : 3.2; return; }
    b.t = 0; b.fx = p.x; b.fy = p.y;
    return;
  }
  // 跳ねながら接近。着地点に粘液を残す
  ai.hop -= dt * CHAOS.rate;
  const air = ai.hop < 0.5;
  e.jz = air ? Math.sin(ai.hop / 0.5 * Math.PI) * 7 : 0;
  e.air = e.jz > 3;
  if (air) { e.x += Math.cos(a) * e.spd * 2.6 * slow * dt; e.y += Math.sin(a) * e.spd * 2.6 * slow * dt; }
  if (ai.hop <= 0) {
    ai.hop = ai.enraged ? 1.0 : 1.3; e.sq = 0.75;
    if (ai.enraged || Math.random() < 0.4) addHazard('goo', e.x, e.y + 4, { r: 14, dur: 6 });
  }
  ai.cd -= dt * CHAOS.rate; ai.sum -= dt * CHAOS.rate;
  if (ai.cd > 0 || air) return;
  ai.cd = ai.enraged ? 2.2 : 3.2;
  if (ai.sum <= 0) slimeSummon(e, ai); // スライム召喚(4秒後に 50% で吸収)
  else if (dist < 150 && Math.random() < 0.35) slimeLeap(e, ai); // 大跳躍: 落下点がプレイヤーを追う
  else if (dist < 150 && Math.random() < 0.25) slimeBounce(e, ai, a); // 弾み体当たり: プレイヤーへ向かう線上の 3点に跳ねて着地
  else { // 粘液弾: プレイヤー周辺へ放物線で撒き、着弾点に粘液床
    e.sq = 1.3;
    windup(e, 0.5, () => {
      const n = ai.enraged ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const tx = P.x + (i ? rand(-55, 55) : 0), ty = P.y + (i ? rand(-45, 45) : 0), T = 0.9 + i * 0.06;
        pushWarn({ kind: 'circle', x: tx, y: ty, r: 14, t: 0, life: T });
        lob('glob', e.x, e.y - 6, tx, ty, T, 40, p => {
          hitCircle(p.x, p.y, 14, e.dmg * 0.7);
          addHazard('goo', p.x, p.y, { r: 17, dur: 7 });
          burst(p.x, p.y, 10, ['#4fd6a8', '#d8fff2'], { sp: 60 }); AudioMan.splat();
        });
      }
      e.sq = 0.7; AudioMan.fire();
    });
  }
}

function slimeSummon(e, ai) {
  ai.sum = 12; e.sq = 1.3;
  const n = ai.enraged ? 6 : 4, list = [];
  for (let i = 0; i < n; i++) list.push(spawnEnemy('slime', { x: e.x + Math.cos(TAU / n * i) * 22, y: e.y + Math.sin(TAU / n * i) * 22 }));
  burst(e.x, e.y, 30, ['#4fd6a8', '#d8fff2'], { sp: 110 }); AudioMan.splat();
  later(ai, 4, () => { if (Math.random() < 0.5 && !ai.act) startAbsorb(e, list); });
}
function slimeLeap(e, ai) {
  const w = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: 44, t: 0, life: 1.65 }, 1.3, 50);
  pushWarn(w);
  ai.act = 'leap'; ai.st = { t: 0, T: 1.65, x0: e.x, y0: e.y, w };
  e.sq = 0.6; AudioMan.dash(); shake(3);
  burst(e.x, e.y + 6, 20, ['#4fd6a8', '#d8fff2'], { sp: 90, up: 40 });
  hint('leap', _t('大跳躍'), _t('落下点が追ってくる。最後に止まったら離れろ'));
}
function slimeBounce(e, ai, a) {
  const pts = [1, 2, 3].map(i => ({ x: e.x + Math.cos(a) * 70 * i, y: e.y + Math.sin(a) * 70 * i }));
  pts.forEach((p, i) => pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 26, t: 0, life: 0.6 + 0.25 * (i + 1) }));
  e.sq = 1.3;
  windup(e, 0.6, () => { ai.act = 'bounce'; ai.bn = { i: 0, t: 0, pts, fx: e.x, fy: e.y }; AudioMan.dash(); });
}
// 吸収: 召喚したスライムを光の線で結び、3秒かけて本体へ引き寄せる(速さ 60)。吸った1体につき 最大HP 3% 回復
function startAbsorb(e, list) {
  const alive = list.filter(s => !s.dead);
  if (!alive.length || e.dead) return;
  for (const s of alive) { s.pulled = e; s.pullT = S.time + 3; }
  e.sq = 1.25; AudioMan.charge(1);
  hint('absorb', _t('吸収'), _t('光の線につながったスライムを倒せ。吸われると回復される'));
}
function slimeAbsorbed(b, s) {
  s.dead = true; s.pulled = null; // 吸われた(倒した扱いにしない)
  const n = b.maxhp * 0.03;
  b.hp = Math.min(b.maxhp, b.hp + n); S.hudDirty = true;
  addFloat(b.x, b.y - 18, '+' + Math.round(n), '#5dff8a', 1);
  burst(s.x, s.y, 14, ['#4fd6a8', '#d8fff2', '#5dff8a'], { sp: 60, glow: true });
  addRing(b.x, b.y, b.r + 8, '#5dff8a', { w: 2, life: 0.35 }); b.sq = 1.2;
  AudioMan.splat(); AudioMan.heal();
}
// 分裂: 1秒縮み、中スライム 2体(HP 各 8%・半径 9・接触 ×0.6・跳ねて追う)に分かれて 12秒。本体は動かず受けるダメージ ×0.4
//   2体を倒すか 12秒で元に戻り、戻る位置に 円 半径 40 ×1.0(予告 0.8秒)
function startSplit(e, ai) {
  ai.act = 'split0'; ai.pt = 1; ai.r0 = e.r;
  AudioMan.charge(1); shake(4);
  hint('split', _t('分裂'), _t('中スライムを倒すと元に戻る。分かれている間、本体は硬い'));
}
function updSplit(e, ai, dt) {
  ai.pt -= dt;
  if (ai.act === 'split0') { // 縮んで震える
    const k = 1 - Math.max(0, ai.pt);
    e.scale = 1 - 0.45 * k; e.sq = 1 + Math.sin(k * 40) * 0.1 * (1 - k); e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0;
    if (Math.random() < dt * 30) part(e.x + rand(-10, 10), e.y + rand(-6, 6), rand(-20, 20), rand(-30, -5), 0.5, pick(['#4fd6a8', '#d8fff2']), { g: 120 });
    if (ai.pt > 0) return;
    ai.act = 'split'; ai.pt = 12; e.takeK = 0.4; e.air = true; e.r = Math.max(6, Math.round(ai.r0 * 0.55));
    ai.mids = [-1, 1].map(s => {
      const m = spawnEnemy('slime', { x: e.x + s * 16, y: e.y + 4 });
      Object.assign(m, { hp: e.maxhp * 0.08, maxhp: e.maxhp * 0.08, r: 9, scale: 1.8, dmg: e.dmg * 0.6, xp: 0, owner: e, noChest: true, kbRes: 0.9 });
      m.kx = s * 140; // 左右へ弾け飛ぶ
      return m;
    });
    burst(e.x, e.y, 46, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 150, g: 160 }); shockAt(e.x, e.y, 1.5, 0.8); shake(8); AudioMan.splat(); AudioMan.boom();
    addRing(e.x, e.y, 30, '#d8fff2', { w: 2, life: 0.4 });
    return;
  }
  if (ai.act === 'split') { // 分かれている間: 2体を倒すか、12秒たつと戻る(残った中スライムは本体へ溶けて戻る)
    if (ai.mids.every(m => m.dead) || ai.pt <= 0) {
      for (const m of ai.mids) if (!m.dead) { m.dead = true; burst(m.x, m.y, 16, ['#4fd6a8', '#d8fff2'], { sp: 70 }); }
      ai.act = 'reform'; ai.pt = 0.8;
      pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 40, t: 0, life: 0.8 });
      AudioMan.charge(0.8);
    }
    return;
  }
  e.scale = 0.55 + 0.45 * (1 - Math.max(0, ai.pt) / 0.8); // 戻る: 膨らんで、戻った瞬間に周りを潰す
  if (ai.pt > 0) return;
  ai.act = null; e.takeK = 1; e.air = false; e.r = ai.r0; e.scale = 1; e.sq = 0.5; ai.cd = ai.enraged ? 2.2 : 3.2;
  hitCircle(e.x, e.y, 40, e.dmg);
  const R0 = 40 * CHAOS.area;
  shockAt(e.x, e.y, 1.8, 0.75); shake(10); AudioMan.boom(); AudioMan.splat();
  addRing(e.x, e.y, R0, '#d8fff2', { w: 3, life: 0.4 });
  burst(e.x, e.y, 40, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 150, g: 200 });
  bossBlast(e.x, e.y, R0, Object.assign({ n: 14 }, BFX.gslime)); // 戻った瞬間に潰した跡
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawGslimeFx(e, ai, sx, gx, ex, ey, t) {
  for (const s of enemies) if (s.pulled === e && !s.dead) {
    const fl = 0.5 + 0.5 * Math.sin(t * 20 + s.id);
    pLine(gx, ex, ey, s.x - cam.x, s.y - cam.y, fl > 0.5 ? '#5dff8a' : '#2a7a4a', 1);
    sx.globalAlpha = 0.7; pLine(sx, ex, ey, s.x - cam.x, s.y - cam.y, '#d8fff2', 1); sx.globalAlpha = 1;
    addLight(s.x, s.y, 30, '#5dff8a', 0.6);
  }
  if (ai.act === 'split' && ai.mids) {
    const k = Math.max(0, ai.pt / 12), R = 22, n = Math.ceil(TAU * R * k);
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + TAU * k * i / Math.max(1, n); sx.fillStyle = gx.fillStyle = k < 0.25 && Math.floor(t * 8) % 2 ? '#ff3b5c' : '#d8fff2'; sx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); gx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); }
    for (const m of ai.mids) if (!m.dead) { sx.globalAlpha = 0.35; pLine(sx, ex, ey, m.x - cam.x, m.y - cam.y, '#4fd6a8', 1); sx.globalAlpha = 1; }
  }
}
