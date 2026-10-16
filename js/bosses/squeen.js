// bosses/squeen.js — ボス: 雪華の女王: 距離 110 を保って滑るように回り込む。雪華弾 / 縮む氷輪 / 氷柱の墓標 / 吹雪の帳 / 雪華の輪舞 / 激昂: 氷の槍
'use strict';

// ---------- 雪華の女王: 距離 110 を保って滑るように回り込む。雪華弾 / 縮む氷輪 / 氷柱の墓標 / 吹雪の帳 / 雪華の輪舞 / 激昂: 氷の槍 ----------
function squeenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if ((ai.flip = (ai.flip ?? 4) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -ai.side; }
  const dir = dist > 110 ? a : a + Math.PI, k = Math.abs(dist - 110) > 15 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * e.spd * 0.9 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * e.spd * 0.9 * ai.side) * slow * dt;
  if (Math.random() < dt * 14) part(e.x + rand(-6, 6), e.y + 10, rand(-8, 8), -rand(2, 8), 0.6, pick(SNOW), { glow: true, drag: 1 }); // 裾から雪の結晶がこぼれる
  ai.flake -= dt * R; ai.ring -= dt * R; ai.tomb -= dt * R; ai.veil -= dt * R; ai.dance -= dt * R; if (ai.enraged) ai.lance -= dt * R;
  if (ai.flake <= 0) { ai.flake = ai.enraged ? 2.5 : 3.5; snowFlakes(e); } // 弾はほかの技と並んで撃つ
  if (ai.tomb <= 0) { ai.tomb = ai.enraged ? 20 : 25; iceTomb(e, ai); }
  else if (ai.veil <= 0) { ai.veil = ai.enraged ? 13 : 18; frostVeil(e, ai); }
  else if (ai.ring <= 0) { ai.ring = ai.enraged ? 7 : 10; iceRing(e, ai); }
  else if (ai.dance <= 0) { ai.dance = ai.enraged ? 6 : 9; snowDance(e, ai); }
  else if (ai.enraged && ai.lance <= 0) { ai.lance = 6; iceLance(e, ai); }
}
// 雪華弾: 6方向に雪の結晶(速さ 55)。1秒後にそれぞれ 3つに割れる。×0.6・凍傷 +1
function snowFlakes(e) {
  const a0 = rand(0, TAU);
  for (let i = 0; i < 6; i++) Object.assign(eball(e.x, e.y - 4, a0 + TAU / 6 * i, 55, e.dmg * 0.6, 'flake'), { frost: 1, splitT: 1 });
  burst(e.x, e.y - 4, 12, SNOW, { sp: 50, glow: true, life: 0.35 }); AudioMan.chime();
}
// 縮む氷輪: 0.8秒 プレイヤーを中心に円 半径 90 → 氷の輪が 2秒かけて半径 90 → 0 へ縮む。輪に触れると ×1.0・凍傷 +2
function iceRing(e, ai) {
  const tx = P.x, ty = P.y;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 90, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { addHazard('icering', tx, ty, { r: 90, r0: 90 * CHAOS.area, dur: 2, dmg: e.dmg }); AudioMan.frost(); });
}
// 氷柱の墓標: 女王の頭上に大きな氷柱ができて空へ飛ぶ(0.6秒)→ 円 半径 44 の予告がプレイヤーを 1.5秒追い(速さ 70)、0.4秒止まる
//   → 氷柱が落ちて 半径 44 に ×1.3・凍傷 +3。氷柱は地面に刺さったまま残り(HP 8%・15秒)、まわり 半径 110 が滑る床(霜の巨人と同じ慣性)になる
//   氷柱を壊すと滑る床も消える。女王は動き続ける
function iceTomb(e, ai) {
  bfx.push({ kind: 'skyspear', x: e.x, y: e.y - 14, t: 0, life: 0.6, up: true });
  burst(e.x, e.y - 14, 20, SNOW, { sp: 70, glow: true, life: 0.4 }); AudioMan.charge(0.6); AudioMan.chime();
  later(ai, 0.6, () => {
    const w = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: 44, t: 0, life: 1.9 }, 1.5, 70);
    pushWarn(w); AudioMan.charge(1.9);
    hint('tomb', _t('氷柱の墓標'), _t('落ちてくる氷柱の円から離れる。刺さった氷柱のまわりは滑る。氷柱を壊すと床も消える'));
    later(ai, 1.65, () => bfx.push({ kind: 'skyspear', x: w.x, y: w.y, t: 0, life: 0.25, up: false })); // 空から落ちてくる
    later(ai, 1.9, () => {
      const x = w.x, y = w.y, R0 = 44 * CHAOS.area;
      if (hitCircle(x, y, 44, e.dmg * 1.3)) frostPlayer(3);
      burst(x, y, 50, [...SNOW, '#ffffff'], { sp: 150, up: 40, glow: true, life: 0.6 }); addRing(x, y, R0, '#bff4ff', { w: 3, life: 0.4 });
      for (let k = 0; k < 8; k++) { const pa = TAU / 8 * k; bfx.push({ kind: 'icespike', x: x + Math.cos(pa) * R0 * 0.6, y: y + Math.sin(pa) * R0 * 0.6, t: 0, life: 0.7, h: rand(8, 13) }); }
      shockAt(x, y, 2, 0.75); shake(10); hitstop(0.05, true); AudioMan.boom(); AudioMan.frost();
      bossBlast(x, y, R0, Object.assign({ n: 18 }, BFX.ice)); // 氷柱が突き刺さった地面
      const o = spawnObj(e, 'tomb', x, y, { pct: 0.08, r: 9, life: 15 });
      addHazard('ice', x, y, { r: 110, dur: 15 }).spire = o; // 滑る床: 氷柱が砕けたら一緒に消える
    });
  });
}
// 吹雪の帳: 1.0秒 画面の縁が白く凍る → 6秒かけて凍った範囲が縁から毎秒 25(激昂 30)で迫る(最後はプレイヤーの周り 半径 110 が残る)。中にいると 0.5秒ごとに凍傷 +2・×0.2
function frostVeil(e, ai) {
  const cx = P.x, cy = P.y, R0 = Math.hypot(GFX.VW, GFX.VH) / 2;
  bfx.push({ kind: 'veilwarn', x: cx, y: cy, R: R0, t: 0, life: 1 });
  AudioMan.charge(1); AudioMan.blizz();
  hint('veil', _t('吹雪の帳'), _t('画面の縁から凍りつく。真ん中に残れ'));
  later(ai, 1, () => hazards.push({ kind: 'veil', x: cx, y: cy, R: R0, Rmin: 110, spd: ai.enraged ? 30 : 25, t: 0, dur: 6, tick: 0.5, dmg: e.dmg * 0.2, seed: (Math.random() * 1e6) | 0 }));
}
// 雪華の輪舞: 円 3個(半径 30)が、使ったときのプレイヤーの位置から 75 の距離を回る(毎秒 1.5rad で 2秒、最後の 1秒でイージングで止まる)→ 止まって 0.3秒後に ×1.0・凍傷 +2
//   回る中心は使ったときの位置に固定(プレイヤーについて回ると、円が重ならず当たらないため)
const DANCE_R = 75, danceAng = t => (t < 2 ? 1.5 * t : 3 + 1.5 * (Math.min(1, t - 2) - Math.pow(Math.min(1, t - 2), 2) / 2)); // 回った角度(最後の 1秒は速さが 1.5 → 0 へ)
function snowDance(e, ai) {
  const a0 = rand(0, TAU), ws = [], cx = P.x, cy = P.y;
  bfx.push({ kind: 'dance', x: cx, y: cy, t: 0, life: 3.3 });
  for (let i = 0; i < 3; i++) {
    const w = { kind: 'circle', x: cx, y: cy, r: 30, t: 0, life: 3.3, dance: true };
    w.track = q => { const aa = a0 + TAU / 3 * i + danceAng(Math.min(3, q.t)); q.x = cx + Math.cos(aa) * DANCE_R; q.y = cy + Math.sin(aa) * DANCE_R; };
    w.track(w); pushWarn(w); ws.push(w);
  }
  AudioMan.chime();
  later(ai, 3.3, () => {
    let hit = false;
    for (const w of ws) {
      if (!hit && hitCircle(w.x, w.y, 30, e.dmg)) { hit = true; frostPlayer(2); }
      burst(w.x, w.y, 28, SNOW, { sp: 110, glow: true, life: 0.45 }); addRing(w.x, w.y, 30 * CHAOS.area, '#bff4ff', { w: 2, life: 0.3 });
      for (let k = 0; k < 6; k++) { const pa = TAU / 6 * k; bfx.push({ kind: 'icespike', x: w.x + Math.cos(pa) * 15 * CHAOS.area, y: w.y + Math.sin(pa) * 15 * CHAOS.area, t: 0, life: 0.6, h: rand(7, 11) }); }
    }
    shake(4); AudioMan.frost(); AudioMan.thud();
  });
}
// 氷の槍(激昂): 女王からプレイヤーへの帯(長さ 240・幅 10)が 0.9秒追い、0.3秒止まる → 氷の槍(速さ 300)。×1.2・凍傷を上限まで(pFrostMax。当たるとそのまま凍結する)
function iceLance(e, ai) {
  const w = { kind: 'line', x: e.x, y: e.y, a: Math.atan2(P.y - e.y, P.x - e.x), len: 240, w: 10, t: 0, life: 1.2 };
  w.track = q => { if (q.t < 0.9) { q.x = e.x; q.y = e.y; q.a = Math.atan2(P.y - e.y, P.x - e.x); } };
  pushWarn(w);
  AudioMan.charge(1.2);
  later(ai, 1.2, () => {
    eprojs.push({ kind: 'ispear', x: w.x, y: w.y, vx: Math.cos(w.a) * 300, vy: Math.sin(w.a) * 300, dmg: e.dmg * 1.2 * (S.eatk ?? 1), frost: DATA.debuff.pFrostMax, life: w.len / 300, t: 0, r: 5 * CHAOS.area });
    burst(w.x, w.y, 14, SNOW, { sp: 90, glow: true, life: 0.35 }); AudioMan.spearThrow(); AudioMan.frost();
    hint('lance', _t('氷の槍'), _t('当たると凍傷が上限までたまり、そのまま凍結する'));
  });
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// 縮む氷輪: 氷の棘の輪(外側に危険の赤)
HAZ_DRAW.icering = (h, hx, hy, fade, hd) => {
  const { sx, gx, t, warnBlink } = hd;
  const R = Math.round(h.rr ?? h.r0);
  if (R > 1) {
    pCircle(sx, hx, hy, R + 1, '#5ab8e8'); pCircle(sx, hx, hy, R, '#ffffff'); pCircle(sx, hx, hy, Math.max(1, R - 1), '#bff4ff');
    pCircle(gx, hx, hy, R, '#2a5a6a');
    const n = Math.max(6, Math.round(R / 3));
    for (let i = 0; i < n; i++) { const a = TAU / n * i + t * 0.5, x = Math.round(hx + Math.cos(a) * R), y = Math.round(hy + Math.sin(a) * R); sx.fillStyle = '#ffffff'; sx.fillRect(x, y - 3, 1, 3); sx.fillStyle = '#9ff7ff'; sx.fillRect(x - 1, y - 1, 3, 1); } // 氷の棘
    sx.globalAlpha = 0.7; pCircle(sx, hx, hy, R + 4, warnBlink ? '#ff3b5c' : '#ffd0d8', 2); sx.globalAlpha = 1;
    addLight(h.x, h.y, R * 2 + 20, '#9ff7ff', 0.35);
  }
};
// 吹雪の帳: 画面の縁から白い霜が凍りつく(内側の縁は危険の赤)
HAZ_DRAW.veil = (h, hx, hy, fade, hd) => {
  const { sx, VW, VH, warnBlink, gx } = hd;
  const R = Math.round(h.cur ?? h.R), f2 = Math.min(1, (h.dur - h.t) * 2, h.t * 4);
  sx.globalAlpha = 0.58 * f2; sx.fillStyle = '#d4ecff';
  sx.beginPath(); sx.rect(0, 0, VW, VH); sx.arc(Math.round(hx), Math.round(hy), R, 0, TAU); sx.fill('evenodd');
  sx.globalAlpha = 0.5 * f2; // 凍った面のひび
  for (let i = 0; i < 40; i++) {
    const a = hash2(i, h.seed + 1) * TAU, r = R + 8 + hash2(i, h.seed + 2) * 140, x = hx + Math.cos(a) * r, y = hy + Math.sin(a) * r;
    if (x < -10 || y < -10 || x > VW + 10 || y > VH + 10) continue;
    const ca = a + (hash2(i, h.seed + 3) - 0.5) * 2;
    pLine(sx, x, y, x + Math.cos(ca) * 8, y + Math.sin(ca) * 8, '#8ab8e0');
  }
  const n = Math.round(R / 2.5);
  for (let i = 0; i < n; i++) { const a = TAU / n * i, j = hash2(i, h.seed) * 7; sx.globalAlpha = 0.9 * f2; sx.fillStyle = i % 3 ? '#ffffff' : '#9ff7ff'; sx.fillRect(Math.round(hx + Math.cos(a) * (R + j)), Math.round(hy + Math.sin(a) * (R + j)), 2, 1); } // 霜の結晶
  sx.globalAlpha = f2; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
  pCircle(gx, hx, hy, R, '#5a1020');
};
// 雪華の輪舞: 円が回る軌道(点線の輪)と、中心の雪の結晶
BFX_DRAW.dance = (f, fx, fy, u, bd) => {
  const { t, sx } = bd;
  const R = DANCE_R, fade = Math.min(1, (f.life - f.t) * 3, f.t * 4), n = 40;
  for (let i = 0; i < n; i++) { if ((i + Math.floor(t * 8)) % 2) continue; const a = TAU / n * i; sx.globalAlpha = 0.6 * fade; sx.fillStyle = '#d8f0ff'; sx.fillRect(Math.round(fx + Math.cos(a) * R), Math.round(fy + Math.sin(a) * R), 1, 1); }
  sx.globalAlpha = fade; drawSp(ART.S.flake, f.x, f.y, { alpha: fade }); sx.globalAlpha = 1;
};
// 氷柱の墓標の氷柱: 女王の頭上から空へ飛ぶ(up)/ 空から落ちてくる(down)
BFX_DRAW.skyspear = (f, fx, fy, u, bd) => {
  const H = 200, y = f.up ? f.y - 10 - H * u * u : f.y - 18 - H * (1 - u) * (1 - u);
  drawSp(f.up ? ART.S.icespireUp : ART.S.obj_tomb, f.x, y, { alpha: f.up ? Math.max(0, 1 - u * 0.6) : 1 });
  addLight(f.x, y, 50, '#bff4ff', 0.8);
  if (Math.random() < 0.6) part(f.x + rand(-3, 3), y + (f.up ? 12 : -12), 0, f.up ? 30 : -30, 0.3, pick(['#ffffff', '#bff4ff']), { glow: true, drag: 2 }); // 尾を引く冷気
};
// 吹雪の帳の予告: 画面の縁が白く凍りはじめる
BFX_DRAW.veilwarn = (f, fx, fy, u, bd) => {
  const { t, sx } = bd;
  const VW = GFX.VW, VH = GFX.VH, bw = Math.round(6 + 10 * u), on = Math.floor(t * 8) % 2;
  sx.globalAlpha = (on ? 0.55 : 0.35); sx.fillStyle = '#e8f4ff';
  sx.fillRect(0, 0, VW, bw); sx.fillRect(0, VH - bw, VW, bw); sx.fillRect(0, bw, bw, VH - bw * 2); sx.fillRect(VW - bw, bw, bw, VH - bw * 2);
  sx.globalAlpha = 1; sx.fillStyle = on ? '#ff3b5c' : '#ffd0d8';
  sx.fillRect(bw, bw, VW - bw * 2, 1); sx.fillRect(bw, VH - bw - 1, VW - bw * 2, 1); sx.fillRect(bw, bw, 1, VH - bw * 2); sx.fillRect(VW - bw - 1, bw, 1, VH - bw * 2);
};
