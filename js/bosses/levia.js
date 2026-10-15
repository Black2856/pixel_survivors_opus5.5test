// bosses/levia.js — ボス: 深淵の海竜: 動き回る。海流(流され続ける → 大津波)/ 大津波(岩礁の陰に隠れる)/ 潜航・浮上(影が追う)/ 水柱 / 尾撃 / 激昂: 水流ブレス
'use strict';

// ---------- 深淵の海竜: 動き回る。海流(流され続ける → 大津波)/ 大津波(岩礁の陰に隠れる)/ 潜航・浮上(影が追う)/ 水柱 / 尾撃 / 激昂: 水流ブレス ----------
function leviaAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'dive') { updLeviaDive(e, ai, dt); return; }
  if (ai.act === 'breath') { // 水流ブレス: 1.5秒かけて 90° 薙ぐ。当たると ×1.0・スタミナ −20(1回の薙ぎで 1回まで。回避の無敵・被弾後の無敵で防げる)
    ai.pt += dt;
    const k = Math.min(1, ai.pt / 1.5);
    ai.ba = ai.ba0 + ai.bdir * (Math.PI / 2) * k;
    if (!ai.bhit && hitLine(e.x, e.y, ai.ba, 220, 14, e.dmg)) { ai.bhit = true; drainSta(20); }
    for (let i = 0; i < 2; i++) { const r = rand(10, 220 * CHAOS.area); part(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, rand(-30, 30), rand(-30, 30), 0.35, pick(SPLASH), { drag: 2 }); }
    if (k >= 1) { ai.act = null; ai.ba = null; }
    return;
  }
  if ((ai.flip = (ai.flip ?? 4) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -ai.side; }
  const want = 130, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 26 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 26 * ai.side) * slow * dt;
  ai.current -= dt * R; ai.wave -= dt * R; ai.dive -= dt * R; ai.pillar -= dt * R; ai.tail -= dt * R; if (ai.enraged) ai.breath -= dt * R;
  if (ai.current <= 0) { ai.current = ai.enraged ? 12 : 16; seaCurrent(e, ai); }
  else if (ai.wave <= 0) { ai.wave = ai.enraged ? 9 : 12; tsunami(e, rand(0, TAU)); }
  else if (ai.tail <= 0 && dist < 60) { ai.tail = ai.enraged ? 4.5 : 6; leviaTail(e, ai, a); }
  else if (ai.dive <= 0) { ai.dive = ai.enraged ? 6 : 8; startLeviaDive(e, ai); }
  else if (ai.pillar <= 0) { ai.pillar = ai.enraged ? 9 : 12; waterPillars(e, ai); }
  else if (ai.enraged && ai.breath <= 0) { ai.breath = 5; leviaBreath(e, ai, a); }
}
// 海流: 1秒の予告(画面に流れの矢印)→ 6秒 一定の向きに毎秒 35 流される。始まって 2秒で、流れと同じ向きの大津波
function seaCurrent(e, ai) {
  const th = rand(0, TAU);
  bfx.push({ kind: 'flow', x: 0, y: 0, th, t: 0, life: 7 });
  AudioMan.charge(1);
  hint('current', _t('海流'), _t('6秒 流され続ける(ダッシュなら逆らえる)。途中で大津波が来る'));
  later(ai, 1, () => { P.current = { vx: Math.cos(th) * 35, vy: Math.sin(th) * 35, t: 6 }; AudioMan.splash(); });
  later(ai, 3, () => tsunami(e, th));
}
// 大津波: 1.2秒の予告(画面の端に帯と矢印)と同時に画面の中に岩礁 3個(半径 12・壊れない)→ 画面を横切る大波(速さ 150)
//   波に触れると ×1.0・スタミナ −30。岩礁の陰(幅 26・長さ 60)には当たらない。波が通ると岩礁は消える
function tsunami(e, th) {
  const c = Math.cos(th), s = Math.sin(th), cx = cam.x + GFX.VW / 2, cy = cam.y + GFX.VH / 2;
  const half = (Math.abs(c) * GFX.VW + Math.abs(s) * GFX.VH) / 2 + 20, span = (Math.abs(s) * GFX.VW + Math.abs(c) * GFX.VH) / 2 + 60;
  const x0 = cx - c * half, y0 = cy - s * half, dur = 2 * half / 150, reefs = [];
  for (let i = 0; i < 3; i++) { // 岩礁: 画面の中ほど(波の来る側から 30% 〜 80% の所)に。互いに少し離す
    let along = 0, side = 0;
    for (let k = 0; k < 8; k++) {
      along = rand(0.3, 0.8) * 2 * half; side = rand(-0.8, 0.8) * Math.min(span - 60, GFX.VW / 2);
      if (reefs.every(r => Math.abs(r.side - side) > 50 || Math.abs(r.along - along) > 70)) break;
    }
    const r = { kind: 'reef', x: x0 + c * along - s * side, y: y0 + s * along + c * side, along, side, th, r: 12, t: 0, dur: 1.2 + dur + 1, seed: (Math.random() * 1e6) | 0 };
    reefs.push(r); hazards.push(r);
    burst(r.x, r.y, 14, ['#3a4a50', '#5a6a6a', '#bff4ff'], { sp: 70, up: 40, g: 200 });
  }
  bfx.push({ kind: 'wavewarn', x: x0, y: y0, th, span, len: 2 * half, t: 0, life: 1.2 });
  AudioMan.charge(1.2); AudioMan.warning();
  hint('tsunami', _t('大津波'), _t('岩礁の陰に入るか、ダッシュの無敵ですり抜けろ'));
  later(e.ai, 1.2, () => { hazards.push({ kind: 'tsunami', x: x0, y: y0, th, span, reefs, d: 0, pd: 0, t: 0, dur, dmg: e.dmg, seed: (Math.random() * 1e6) | 0 }); AudioMan.splash(); AudioMan.roar(); shake(5); });
}
// 潜航・浮上: 潜っている 2.5秒(攻撃が当たらない)、円 半径 40 の影がプレイヤーを追い(速さ 60)、浮上の 0.5秒前に止まる → 浮上で ×1.3
function startLeviaDive(e, ai) {
  ai.act = 'dive'; ai.pt = 2.5; e.flying = e.hidden = true; e.air = true;
  ai.dw = chaseWarn({ kind: 'circle', x: e.x, y: e.y, r: 40, t: 0, life: 2.5 }, 2, 60);
  pushWarn(ai.dw);
  burst(e.x, e.y, 30, SPLASH, { sp: 110, up: 40, g: 200 }); AudioMan.splash();
  hint('dive', _t('潜航・浮上'), _t('影が追ってくる。歩けば離せる'));
}
function updLeviaDive(e, ai, dt) {
  ai.pt -= dt;
  const w = ai.dw;
  e.x = w.x; e.y = w.y; // 海竜は影の下を泳ぐ
  if (Math.random() < dt * 25) part(w.x + rand(-20, 20), w.y + rand(-14, 14), 0, -rand(10, 25), 0.5, pick(['#bff4ff', '#ffffff']), { drag: 1 }); // 泡
  if (ai.pt > 0) return;
  e.flying = e.hidden = false; e.air = false; ai.act = null; e.sq = 0.6;
  hitCircle(w.x, w.y, 40, e.dmg * 1.3);
  const R0 = 40 * CHAOS.area;
  burst(w.x, w.y, 60, SPLASH, { sp: 170, up: 80, g: 220, life: 0.8 }); addRing(w.x, w.y, R0, '#ffffff', { w: 3, life: 0.4 });
  shockAt(w.x, w.y, 1.8, 0.75); shake(10); AudioMan.splash(); AudioMan.boom();
  bossBlast(w.x, w.y, R0, Object.assign({ n: 18 }, BFX.sea)); // 浮上の水しぶきの光
}
// 水柱: プレイヤーの周り 120 の 3方向に 円 半径 16(0.8秒)→ 水柱 3本が 7秒、プレイヤーへゆっくり寄る(速さ 40)。触れると ×0.6・スタミナ −15(1本につき 1回)
function waterPillars(e, ai) {
  const a0 = rand(0, TAU), pts = [0, 1, 2].map(i => ({ x: P.x + Math.cos(a0 + TAU / 3 * i) * 120, y: P.y + Math.sin(a0 + TAU / 3 * i) * 120 }));
  for (const p of pts) pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 16, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { for (const p of pts) { addHazard('wpillar', p.x, p.y, { r: 16, dur: 7, dmg: e.dmg }); burst(p.x, p.y, 16, SPLASH, { sp: 80, up: 60, g: 160 }); } AudioMan.splash(); });
}
// 尾撃: 距離 60 以内で 0.5秒の扇(半径 70・±60°)→ ×0.9・スタミナ −20、海竜から 110 飛ばす
function leviaTail(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 70, h: 1.047, t: 0, life: 0.5 });
  windup(e, 0.5, () => {
    slashes.push({ x: e.x, y: e.y, a, r: 70 * CHAOS.area, t: 0, life: 0.26, span: 2.1, pal: SWING_PAL.enemy, enemy: true });
    if (inFan(e.x, e.y, a, 70, 1.047)) { if (hurtPlayer(e.dmg * 0.9)) drainSta(20); pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 110, 0.35); }
    burst(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 18, SPLASH, { sp: 110 }); AudioMan.splash(); shake(5);
  });
}
// 水流ブレス(激昂): 0.6秒の予告(プレイヤーへの帯)→ 1.5秒かけて 90° 薙ぐ
function leviaBreath(e, ai, a) {
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 220, w: 14, t: 0, life: 0.6, track: w => { w.x = e.x; w.y = e.y; } });
  AudioMan.charge(0.6);
  windup(e, 0.6, () => { ai.act = 'breath'; ai.pt = 0; ai.bdir = Math.random() < 0.5 ? 1 : -1; ai.ba0 = a - ai.bdir * Math.PI / 4; ai.bhit = false; AudioMan.roar(); });
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawLeviaFx(e, ai, sx, gx, ex, ey, A, t) {
  if (ai.act === 'dive') {
    sx.globalAlpha = 0.45; sx.fillStyle = '#04121a';
    sx.beginPath(); sx.ellipse(ex, ey, 26, 11, Math.sin(t * 2) * 0.35, 0, TAU); sx.fill();
    sx.beginPath(); sx.ellipse(ex - 22 * Math.cos(Math.sin(t * 2) * 0.35), ey - 22 * Math.sin(Math.sin(t * 2) * 0.35) + Math.sin(t * 5) * 3, 12, 4, Math.sin(t * 2) * 0.35 + Math.sin(t * 5) * 0.3, 0, TAU); sx.fill(); // 尾
    sx.globalAlpha = 1;
  }
  if (ai.act === 'breath' && ai.ba != null) {
    const BL = 220 * A, bx = ex + Math.cos(ai.ba) * BL, by = ey + Math.sin(ai.ba) * BL, fl = Math.floor(t * 30) % 2;
    pLine(gx, ex, ey, bx, by, '#1a5a7a', Math.round((10 + fl * 2) * A));
    pLine(sx, ex, ey, bx, by, '#2a8ac8', Math.round(9 * A));
    pLine(sx, ex, ey, bx, by, '#7ad7ff', Math.round(5 * A));
    pLine(sx, ex, ey, bx, by, '#ffffff', Math.max(1, Math.round(2 * A)));
    for (let r = 0; r < BL; r += 44) addLight(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, 60, '#7ad7ff', 0.7);
  }
}
// 岩礁: 苔むした黒い岩。波が来るまで、陰(波に当たらない所)を淡い緑で示す
HAZ_DRAW.reef = (h, hx, hy, fade, hd) => {
  const { sx, t, gx } = hd;
  const c = Math.cos(h.th), s = Math.sin(h.th), L = 60 * CHAOS.area, W = 13 * CHAOS.area, R = Math.round(h.r * Math.min(1, h.t * 5));
  if (!h.gone) {
    sx.globalAlpha = (0.16 + 0.06 * Math.sin(t * 6)) * fade; sx.fillStyle = '#7dffd0'; sx.beginPath();
    sx.moveTo(hx - s * W, hy + c * W); sx.lineTo(hx + c * L - s * W, hy + s * L + c * W); sx.lineTo(hx + c * L + s * W, hy + s * L - c * W); sx.lineTo(hx + s * W, hy - c * W); sx.fill();
    sx.globalAlpha = 0.7 * fade;
    for (const k of [-1, 1]) for (let d = 0; d < L; d += 4) { const qx = Math.round(hx + c * d - s * W * k), qy = Math.round(hy + s * d + c * W * k); sx.fillStyle = '#bff4ff'; sx.fillRect(qx, qy, 2, 1); gx.fillStyle = '#1a4a3a'; gx.fillRect(qx, qy, 1, 1); }
    sx.globalAlpha = 1;
  }
  pDisc(sx, hx, hy + 2, R, '#081418');
  pDisc(sx, hx, hy, Math.max(1, R - 1), '#2a3e46');
  pDisc(sx, hx - 2, hy - 3, Math.max(1, R - 5), '#4a6a70');
  for (let i = 0; i < 6; i++) { const a = hash2(i, h.seed) * TAU, r = R * 0.6 * hash2(i + 5, h.seed); sx.fillStyle = i % 2 ? '#2f7a5a' : '#e8d8c8'; sx.fillRect(Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r * 0.7), 2, 1); } // 苔とフジツボ
  gx.globalAlpha = 1; pCircle(gx, hx, hy + 1, R + 1, '#163a44'); // 波打ちぎわの白い泡
};
// 大津波: 画面を横切る大波(白い波頭)。岩礁の陰では波が割れる
HAZ_DRAW.tsunami = (h, hx, hy, fade, hd) => {
  const { sx, gx, t } = hd;
  const c = Math.cos(h.th), s = Math.sin(h.th), d = h.d, A = CHAOS.area;
  sx.save(); gx.save(); sx.translate(hx, hy); gx.translate(hx, hy); sx.rotate(h.th); gx.rotate(h.th);
  for (let sd = -h.span; sd < h.span; sd += 4) {
    const wob = Math.sin(t * 9 + sd * 0.15) * 2 + Math.sin(sd * 0.05 + t * 3) * 2;
    if (h.reefs.some(r => d > r.along && d - r.along < 60 * A && Math.abs(sd + 2 - r.side) < 13 * A)) { sx.globalAlpha = 0.3; sx.fillStyle = '#0e3a5a'; sx.fillRect(d - 90 + wob, sd, 30, 4); continue; } // 陰: 波が割れて跡だけ
    const fo = (Math.floor(sd / 4) + Math.floor(t * 12)) % 3;
    sx.globalAlpha = 0.45; sx.fillStyle = '#0e3a5a'; sx.fillRect(d - 90 + wob, sd, 66, 4); // 波の背(深い水)
    sx.globalAlpha = 0.7; sx.fillStyle = '#1a6a9a'; sx.fillRect(d - 24 + wob, sd, 14, 4);
    sx.globalAlpha = 0.9; sx.fillStyle = '#4ab8e8'; sx.fillRect(d - 10 + wob, sd, 6, 4); // 波の面
    sx.globalAlpha = 1; sx.fillStyle = fo ? '#ffffff' : '#bff4ff'; sx.fillRect(d - 4 + wob, sd, 4, 4); // 白い波頭
    if (fo === 0) { sx.globalAlpha = 0.7; sx.fillRect(d + 1 + wob + (sd % 3), sd + 1, 1, 1); } // 前に散るしぶき
    gx.fillStyle = '#163a4a'; gx.fillRect(d - 3 + wob, sd, 2, 4);
  }
  sx.restore(); gx.restore(); sx.globalAlpha = 1;
  for (let k = -2; k <= 2; k++) addLight(h.x + c * d - s * k * h.span / 2.5, h.y + s * d + c * k * h.span / 2.5, 90, '#7ad7ff', 0.35);
};
// 水柱: 足元の渦(縁は危険の赤)と、渦を巻いて立ちのぼる水の柱
HAZ_DRAW.wpillar = (h, hx, hy, fade, hd) => {
  const { sx, warnBlink, gx, t } = hd;
  const R = Math.round(h.r * Math.min(1, h.t * 6)), H = Math.round(36 * Math.min(1, h.t * 4) * fade);
  sx.globalAlpha = 0.35 * fade; pDisc(sx, hx, hy, R, '#2a8ac8');
  sx.globalAlpha = fade; pCircle(sx, hx, hy, R, warnBlink ? '#ff3b5c' : '#ffd0d8'); sx.globalAlpha = 1;
  pCircle(gx, hx, hy, R, '#5a1020');
  for (let j = 0; j < H; j++) {
    const w = Math.max(1, Math.round(R * 0.55 * (1 - j / Math.max(1, H) * 0.35))), y = Math.round(hy - j), sw = Math.round(Math.sin(t * 10 + j * 0.45) * w * 0.8);
    sx.globalAlpha = 0.5 * fade; sx.fillStyle = '#2a8ac8'; sx.fillRect(Math.round(hx - w), y, w * 2 + 1, 1);
    sx.globalAlpha = 0.9 * fade; sx.fillStyle = j % 4 < 2 ? '#bff4ff' : '#7ad7ff'; sx.fillRect(Math.round(hx + sw), y, 2, 1);
    gx.fillStyle = '#1a4a5a'; gx.fillRect(Math.round(hx + sw), y, 1, 1);
  }
  sx.globalAlpha = 1;
  for (let i = 0; i < 5; i++) { sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(hx + Math.sin(t * 7 + i * 1.3) * R * 0.5), Math.round(hy - H - (i % 2)), 1, 1); } // 柱の先の白いしぶき
  addLight(h.x, h.y - H / 2, 50, '#7ad7ff', 0.5 * fade);
};
// 海流: 始まる前は画面いっぱいに点滅する矢印、流れている間は流れの筋
BFX_DRAW.flow = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const c = Math.cos(f.th), s = Math.sin(f.th), VW = GFX.VW, VH = GFX.VH, on = f.t >= 1, fade = Math.min(1, (f.life - f.t) * 2), W = VW + 40, H = VH + 40;
  for (let i = 0; i < 22; i++) {
    const h1 = hash2(i, 41), h2 = hash2(i, 59), sp = (on ? 70 : 25) * (1 + h2);
    const x = ((h1 * W + c * f.t * sp) % W + W) % W - 20, y = ((h2 * H + s * f.t * sp) % H + H) % H - 20;
    if (!on || i % 4 === 0) { // 矢印
      if (!on && Math.floor(t * 6) % 2) continue;
      for (const k of [-1, 1]) { const bx = x - c * 4 + s * 4 * k, by = y - s * 4 - c * 4 * k; sx.globalAlpha = on ? 0.6 * fade : 0.9; pLine(sx, bx, by, x + c * 2, y + s * 2, '#bff4ff'); pLine(gx, bx, by, x + c * 2, y + s * 2, '#2a6a7a'); }
    } else { sx.globalAlpha = 0.45 * fade; pLine(sx, x, y, x - c * 14, y - s * 14, '#bff4ff'); pLine(gx, x, y, x - c * 6, y - s * 6, '#1a4a5a'); }
  }
  sx.globalAlpha = 1;
};
// 大津波の予告: 波の来る側の端に赤い帯、画面を横切って流れる矢印の列
BFX_DRAW.wavewarn = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const blink = Math.floor(t * 8) % 2;
  sx.save(); gx.save(); sx.translate(fx, fy); gx.translate(fx, fy); sx.rotate(f.th); gx.rotate(f.th);
  sx.globalAlpha = 0.22 + 0.12 * blink; sx.fillStyle = '#ff3b5c'; sx.fillRect(0, -f.span, 46, f.span * 2); // 端(画面の外 20)から画面の内側 26 まで
  sx.globalAlpha = 1; sx.fillStyle = blink ? '#ff3b5c' : '#ffd0d8'; sx.fillRect(46, -f.span, 1, f.span * 2);
  gx.fillStyle = '#7a1020'; gx.fillRect(46, -f.span, 1, f.span * 2);
  for (let row = -f.span + 40; row < f.span; row += 70) for (let k = 0; k < 4; k++) {
    const al = (t * 170 + k * f.len / 4 + row * 0.7) % f.len;
    for (let j = 0; j < 6; j++) { sx.fillStyle = '#ff3b5c'; sx.fillRect(al - j, row - j, 2, 1); sx.fillRect(al - j, row + j, 2, 1); gx.fillStyle = '#5a1020'; gx.fillRect(al - j, row - j, 1, 1); gx.fillRect(al - j, row + j, 1, 1); }
  }
  sx.restore(); gx.restore(); sx.globalAlpha = 1;
};
