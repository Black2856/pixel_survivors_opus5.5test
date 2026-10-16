// bosses/golem.js — ボス: ゴーレム: 地割れ(伸びる帯)/ 岩投げ / 岩の散弾 / 両腕回転 / ストンプ(衝撃波で押し出す)/ 岩の鎧(DPSチェック)
'use strict';

// ---------- ゴーレム: 地割れ(伸びる帯)/ 岩投げ / 岩の散弾 / 両腕回転 / ストンプ(衝撃波で押し出す)/ 岩の鎧(DPSチェック) ----------
function golemAI(e, ai, dt, a, dist, slow) {
  if (ai.overT > 0) { // 全速(岩の鎧を削れなかった): 速さ ×1.4・技の間隔 ×0.7。赤い蒸気を噴く
    ai.overT -= dt;
    if (Math.random() < dt * 24) part(e.x + rand(-10, 10), e.y - rand(4, 16), rand(-10, 10), -rand(20, 50), rand(0.4, 0.7), pick(['#ff6a2a', '#ff3b1a', '#8a8676']), { glow: Math.random() < 0.5, drag: 1 });
    if (ai.overT <= 0) { e.spd /= 1.4; burst(e.x, e.y, 16, ['#8a8676', '#c8b8a0'], { sp: 60 }); }
  }
  if (!ai.act) for (const th of [0.6, 0.25]) if (!ai['arm' + th] && e.hp < e.maxhp * th) { ai['arm' + th] = true; startArmor(e, ai); return; } // 岩の鎧: 残りHP 60% と 25% で1回ずつ
  if (ai.act === 'armor' || ai.act === 'stagger') { updArmor(e, ai, dt); return; }
  if (ai.act === 'spin') {
    ai.pt -= dt; ai.spinA += (ai.enraged ? 9 : 7) * dt;
    e.x += Math.cos(a) * e.spd * 1.5 * slow * dt; e.y += Math.sin(a) * e.spd * 1.5 * slow * dt;
    const FR = 30 * CHAOS.area; // 腕の長さも攻撃範囲の倍率で伸ばす(拳の判定 7 と同じ倍率。予告の円との比は倍率 1 のときと同じ)
    e.fists = [0, 1].map(i => { const fa = ai.spinA + Math.PI * i; return { x: e.x + Math.cos(fa) * FR, y: e.y + Math.sin(fa) * FR }; });
    for (const f of e.fists) {
      hitCircle(f.x, f.y, 7, e.dmg);
      if (Math.random() < 0.5) part(f.x, f.y, rand(-20, 20), rand(-20, 20), 0.4, pick(['#a89e8c', '#6ee7ff']), { glow: true });
    }
    ai.snd = (ai.snd || 0) - dt;
    if (ai.snd <= 0) { ai.snd = 0.28; AudioMan.slash(); }
    if (ai.pt <= 0) { ai.act = null; e.fists = null; ai.cd = ai.enraged ? 1.4 : 2.2; }
    return;
  }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  const R = CHAOS.rate / (ai.overT > 0 ? 0.7 : 1);
  ai.cd -= dt * R; ai.spinCd -= dt * R;
  if (ai.cd > 0) return;
  ai.cd = ai.enraged ? 1.8 : 2.6;
  const r = Math.random();
  if (dist > 95) { if (r < 0.9) golemThrow(e, ai); else fissure(e, ai, a); } // 遠い: 岩投げ 90% / 地割れ 10%
  else if (ai.spinCd <= 0 && r < 0.35) { // 両腕を回し続けながら追ってくる
    ai.spinCd = 10;
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 34, t: 0, life: 0.6 });
    windup(e, 0.6, () => { ai.act = 'spin'; ai.pt = ai.enraged ? 4.5 : 3.5; ai.spinA = a; AudioMan.roar(); });
  } else if (r < 0.6) fissure(e, ai, a); // 地割れ 25%(両腕回転が使えないときはその分も)
  else if (r < 0.8) rockScatter(e, ai, a); // 岩の散弾 20%
  else { // ストンプ 20%: 周囲に範囲ダメージ + 外へ広がる衝撃波(触れると押し出す)
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 58, t: 0, life: 1 });
    windup(e, 1, () => {
      hitCircle(e.x, e.y, 58, e.dmg * 1.3);
      addHazard('quake', e.x, e.y, { r: 58, spd: 100, max: 170, dur: 9, dmg: e.dmg * 0.8, push: 40 });
      bossBlast(e.x, e.y, 58 * CHAOS.area, Object.assign({ n: 16, cracks: 10 }, BFX.golem)); // 踏み割った地面(赤熱して冷える)
      if (ai.enraged) later(ai, 0.45, () => addHazard('quake', e.x, e.y, { r: 20, spd: 100, max: 170, dur: 9, dmg: e.dmg * 0.8, push: 40 }));
      burst(e.x, e.y, 50, ['#a89e8c', '#6a6258', '#6ee7ff'], { sp: 160, g: 220 });
      shockAt(e.x, e.y, 2, 0.8); shake(11); AudioMan.boom();
    });
  }
}
function golemThrow(e, ai) {
  e.hold = true;
  windup(e, 0.7, () => {
    e.hold = false;
    const n = ai.enraged ? 3 : 1;
    for (let i = 0; i < n; i++) later(ai, i * 0.35, () => {
      const tx = P.x + (i ? rand(-45, 45) : 0), ty = P.y + (i ? rand(-40, 40) : 0), T = 1.1;
      pushWarn({ kind: 'circle', x: tx, y: ty, r: 24, t: 0, life: T });
      lob('rock', e.x, e.y - 16, tx, ty, T, 70, p => {
        hitCircle(p.x, p.y, 24, e.dmg * 1.1);
        burst(p.x, p.y, 30, ['#a89e8c', '#6a6258', '#3a3530'], { sp: 120, g: 220 });
        bossBlast(p.x, p.y, 24 * CHAOS.area, Object.assign({ n: 10, cracks: 6 }, BFX.golem)); // 岩が落ちた跡
        shockAt(p.x, p.y, 1, 0.9); shake(6); AudioMan.boom();
      });
      AudioMan.dash();
    });
  });
}
// 地割れ: ゴーレムからプレイヤーへ帯(幅 22)が毎秒 300 で 260 まで伸び、伸び切って 0.2秒後に帯の全体に ×1.3。激昂は 2本(±25°)
function fissure(e, ai, a) {
  const angs = ai.enraged ? [a - 0.436, a + 0.436] : [a], L = 260, T = L / 300, x0 = e.x, y0 = e.y + 4;
  for (const fa of angs) {
    pushWarn({ kind: 'line', x: x0, y: y0, a: fa, len: 1, w: 22, t: 0, life: T + 0.2, track: q => { q.len = Math.max(1, Math.min(L, 300 * q.t)) * CHAOS.area; } });
    bfx.push({ kind: 'crack', x: x0, y: y0, a: fa, len: L * CHAOS.area, w: 22 * CHAOS.area, T, t: 0, life: T + 0.9, seed: (Math.random() * 1e6) | 0 });
  }
  e.sq = 1.2; AudioMan.charge(T + 0.2); shake(3);
  hint('fissure', _t('地割れ'), _t('地面の裂け目は前へ伸びる。横へ逃げろ'));
  windup(e, T + 0.2, () => {
    for (const fa of angs) {
      hitLine(x0, y0, fa, L, 22, e.dmg * 1.3);
      for (let d = 10; d < L * CHAOS.area; d += 8) burst(x0 + Math.cos(fa) * d, y0 + Math.sin(fa) * d, 2, ['#a89e8c', '#6a6258', '#3a3530', '#ffb347'], { sp: 70, up: 70, g: 260, life: 0.6 }); // 帯に沿って岩が噴き上がる
      for (let d = 40; d < L * CHAOS.area; d += 70) fxRays(x0 + Math.cos(fa) * d, y0 + Math.sin(fa) * d, 26, '#6a6258', { foe: true, n: 7, life: 0.26, core: '#ffb347', t: -d / 900 }); // 裂け目に沿って順に噴き出す光
    }
    shake(10); AudioMan.boom(); AudioMan.crush(); shockAt(x0 + Math.cos(angs[0]) * 60, y0 + Math.sin(angs[0]) * 60, 1.4, 0.8);
    e.sq = 0.7;
  });
}
// 岩の散弾: 0.5秒構え(前方の扇)、プレイヤーへ扇状に岩の破片 7発
function rockScatter(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 150, h: 0.5, t: 0, life: 0.5 });
  e.sq = 1.25;
  windup(e, 0.5, () => {
    for (let i = 0; i < 7; i++) eball(e.x + Math.cos(a) * 8, e.y - 4 + Math.sin(a) * 8, a - 0.5 + i / 6, 90, e.dmg * 0.5, 'rbit');
    burst(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 20, ['#a89e8c', '#6a6258', '#3a3530'], { sp: 120, g: 160 });
    AudioMan.boom(); shake(5); e.sq = 0.75;
  });
}
// 岩の鎧: 4秒 動かず受けるダメージ ×0.5。4秒で最大HP の 5% を削ると砕けて 2秒ひるむ(受けるダメージ ×1.5)。削れなければ 10秒 全速
function startArmor(e, ai) {
  ai.act = 'armor'; ai.pt = 4; ai.armHp = e.hp; ai.armK = 0; e.takeK = 0.5; e.fists = null; e.hold = false;
  shake(7); AudioMan.thud(); AudioMan.charge(0.6);
  for (let i = 0; i < 30; i++) { const pa = rand(0, TAU), pr = rand(30, 50); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(['#544c44', '#7a6f60', '#241f1c']), { drag: 0, sz: 2 }); } // 岩が集まって体を覆う
  hint('armor', _t('岩の鎧'), _t('4秒で最大HP の 5% を削ると砕ける'));
}
function updArmor(e, ai, dt) {
  ai.pt -= dt;
  if (ai.act === 'armor') {
    const need = e.maxhp * 0.05;
    ai.armK = Math.min(1, (ai.armHp - e.hp) / need);
    if (ai.armK >= 1) { // 砕けた: 2秒ひるむ(受けるダメージ ×1.5)
      ai.act = 'stagger'; ai.pt = 2; e.takeK = 1.5;
      burst(e.x, e.y, 70, ['#544c44', '#7a6f60', '#241f1c', '#6ee7ff', '#ffffff'], { sp: 180, g: 260, life: 0.9 });
      hitstop(0.1, true); shake(14); screenFlash(0.35, '#6ee7ff'); shockAt(e.x, e.y, 2.2, 0.7); AudioMan.crush(); AudioMan.boom();
      addRing(e.x, e.y, 50, '#6ee7ff', { w: 3, life: 0.5 });
      bossBlast(e.x, e.y, 50, Object.assign({ n: 20, life: 0.45, decal: false }, BFX.golem)); // 砕けた鎧の光
      UI.announce(_t('岩の鎧が砕けた!'), _t('ひるんでいる 2秒は 1.5倍のダメージ'));
    } else if (ai.pt <= 0) { // 削れなかった: 10秒 全速(速さ ×1.4・技の間隔 ×0.7)
      ai.act = null; e.takeK = 1; ai.overT = 10; e.spd *= 1.4; ai.cd = 0.6;
      burst(e.x, e.y, 40, ['#ff6a2a', '#ff3b1a', '#8a8676'], { sp: 140, glow: true });
      shake(9); AudioMan.roar(); screenFlash(0.25, '#ff3b1a');
      UI.announce(_t('ゴーレムが全速になった!'), _t('10秒 速さ ×1.4・技の間隔 ×0.7'));
    }
    return;
  }
  e.flash = Math.sin(ai.pt * 30) > 0.6 ? 0.04 : 0; // ひるみ: 白く明滅して、頭の上を星が回る
  if (ai.pt <= 0) { ai.act = null; e.takeK = 1; ai.cd = 1; }
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawGolemFx(e, ai, sx, gx, ex, ey, sp, yo, t) {
  if (ai.act === 'armor') {
    const dx = Math.round(ex - sp.w / 2), dy = Math.round(ey + yo - sp.h / 2);
    sx.globalAlpha = 0.55; sx.drawImage(ART.tint(sp.c, '#3a3530'), dx, dy); sx.globalAlpha = 1;
    const n = Math.floor(ai.armK * 14);
    for (let i = 0; i < n; i++) { // 削るほど増えるひび(光る)
      const x0 = dx + 2 + hash2(i, 41) * (sp.w - 4), y0 = dy + 2 + hash2(i, 43) * (sp.h - 4), a = hash2(i, 47) * TAU;
      pLine(gx, x0, y0, x0 + Math.cos(a) * 4, y0 + Math.sin(a) * 4, '#6ee7ff', 1);
    }
    const R = 26, m = Math.ceil(TAU * R);
    for (let i = 0; i < m; i++) { // DPSチェックの輪: 削った割合だけ金色に満ちる。残り時間で点滅
      const u = i / m, a = -Math.PI / 2 + TAU * u, on = u <= ai.armK;
      if (!on && i % 2) continue;
      sx.fillStyle = on ? '#ffd23f' : ai.pt < 1.5 && Math.floor(t * 8) % 2 ? '#ff3b5c' : '#8a8676';
      sx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1);
      if (on) { gx.fillStyle = '#5a4a10'; gx.fillRect(Math.round(ex + Math.cos(a) * R), Math.round(ey + Math.sin(a) * R), 1, 1); }
    }
  } else if (ai.act === 'stagger') {
    for (let i = 0; i < 3; i++) { const a = t * 6 + TAU / 3 * i, x = Math.round(ex + Math.cos(a) * 9), y = Math.round(ey + yo - sp.h / 2 - 4 + Math.sin(a) * 3); sx.fillStyle = gx.fillStyle = '#ffe14a'; sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1); sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); }
  }
  if (ai.overT > 0) addLight(e.x, e.y, 80, '#ff3b1a', 0.8);
}
// 地割れ: 地面の裂け目が前へ走り(赤熱)、噴き出したあと冷えて消える
BFX_DRAW.crack = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const grow = Math.min(1, f.t / f.T), L = f.len * grow, c = Math.cos(f.a), s = Math.sin(f.a), nx = -s, ny = c;
  const erupt = f.t >= f.T + 0.2, fade = erupt ? Math.max(0, 1 - (f.t - f.T - 0.2) / 0.7) : 1;
  const gcol = !erupt ? (Math.floor(t * 12) % 2 ? '#7a3008' : '#4a1e06') : fade > 0.66 ? '#ffb347' : fade > 0.33 ? '#8a5a1a' : '#3a2008'; // 光の層は色で明るさが決まる
  let px = fx, py = fy;
  for (let d = 3; d <= L; d += 3) {
    const j = (hash2(Math.floor(d / 3), f.seed) - 0.5) * 4, qx = fx + c * d + nx * j, qy = fy + s * d + ny * j;
    sx.globalAlpha = fade; pLine(sx, px, py, qx, qy, '#1a1008', 2); sx.globalAlpha = 1;
    pLine(gx, px, py, qx, qy, gcol, 1);
    if (hash2(Math.floor(d / 3) + 77, f.seed) < 0.25) { const bj = (hash2(Math.floor(d / 3) + 5, f.seed) - 0.5) * 2; sx.globalAlpha = fade; pLine(sx, qx, qy, qx + nx * bj * 5 + c * 2, qy + ny * bj * 5 + s * 2, '#1a1008', 1); sx.globalAlpha = 1; } // 枝分かれ
    px = qx; py = qy;
  }
  if (!erupt) { sx.fillStyle = '#ffb347'; sx.fillRect(Math.round(px), Math.round(py), 2, 2); addLight(f.x + c * L, f.y + s * L, 40, '#ff8a3d', 0.8); } // 走る先端
  else if (fade > 0) addLight(f.x + c * f.len / 2, f.y + s * f.len / 2, f.len * 0.8, '#ffb347', fade);
};
