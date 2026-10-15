// bosses/cdragon.js — ボス: カオスドラゴン: 持続ファイアブレス / 一周ビーム / グランドクロス / 切り裂き / 渦(吸引)
'use strict';

// ---------- カオスドラゴン: 持続ファイアブレス / 一周ビーム / グランドクロス / 切り裂き / 渦(吸引) ----------
const BEAM_LEN = 260, LUNGE_RANGE = 150, LUNGE_SPD = 420;
function dragonAI(e, ai, dt, a, dist, slow) {
  const endAct = () => { ai.act = null; ai.cd = ai.enraged ? 1.6 : 2.4; };
  if (ai.act === 'breath') { // ゆっくりプレイヤーを追う扇状の炎。当たると炎上
    ai.pt -= dt;
    ai.ba += clamp(angDiff(a, ai.ba), -0.9 * dt, 0.9 * dt);
    const L = 125 * CHAOS.area, H = 0.32, mx = e.x + Math.cos(ai.ba) * 10, my = e.y + Math.sin(ai.ba) * 10;
    for (let i = 0; i < 4; i++) {
      const aa = ai.ba + rand(-H, H), sp = rand(120, 170) * CHAOS.area; // 炎の届く距離 = 当たり判定の長さ L
      part(mx, my, Math.cos(aa) * sp, Math.sin(aa) * sp, rand(0.55, 0.8), pick(['#ff6a2a', '#ffc34a', '#ff4a8a', '#fff6c8']), { glow: true, drag: 0.6, sz: pick([1, 2, 2]) });
    }
    if (dist < L && Math.abs(angDiff(a, ai.ba)) < H + 4 / Math.max(dist, 1)) { hurtPlayer(e.dmg * 0.3); burnPlayer(e.dmg * 0.03); }
    AudioMan.fire();
    if (ai.pt <= 0) endAct();
    return;
  }
  if (ai.act === 'beam') { // 全周を薙ぎ払うビーム(ダッシュの無敵ですり抜ける前提)
    ai.pt += dt;
    const k = ai.pt / ai.T;
    ai.bA = ai.b0 + ai.dir * TAU * Math.min(1, k);
    if (hitLine(e.x, e.y, ai.bA, BEAM_LEN, 10, e.dmg * 1.2)) burnPlayer(e.dmg * 0.03); // 当たると炎上
    const r = rand(20, BEAM_LEN * CHAOS.area);
    part(e.x + Math.cos(ai.bA) * r, e.y + Math.sin(ai.bA) * r, rand(-30, 30), rand(-30, 30), 0.4, pick(['#ff4a8a', '#ffd0f0', '#ffffff']), { glow: true });
    shake(1.5);
    if (k >= 1) { ai.bA = null; endAct(); }
    return;
  }
  if (ai.act === 'lunge') { // 切り裂き: 踏み込んで二連の爪撃(距離に応じて踏み込み時間が伸びる)
    ai.pt -= dt;
    e.x += Math.cos(ai.la) * LUNGE_SPD * dt; e.y += Math.sin(ai.la) * LUNGE_SPD * dt;
    if (ai.pt > 0) return;
    endAct();
    for (let c = 0; c < 2; c++) later(ai, c * 0.14, () => {
      const ca = Math.atan2(P.y - e.y, P.x - e.x), R = 47 * CHAOS.area;
      slashes.push({ x: e.x, y: e.y, a: ai.la, r: R, t: 0, life: 0.22, flip: c % 2, span: 2.2, pal: SWING_PAL.enemy, enemy: true }); // 見た目 = 当たり判定(半径 R・角度 ±1.1)
      if (d2(e.x, e.y, P.x, P.y) < R * R && Math.abs(angDiff(ca, ai.la)) < 1.1) hurtPlayer(e.dmg * 0.6, { pierce: true }); // 2回とも当たる(被弾後の無敵を無視。回避では防げる)
      AudioMan.slash();
    });
    return;
  }
  if (ai.act === 'raid') { updRaid(e, ai, dt); return; }
  if (ai.act === 'gust') { // 翼の暴風: 0.5秒、前方の扇の中にいると竜から 110 押し出される(ダメージなし)
    ai.pt -= dt;
    const H = 1.047, R0 = 140 * CHAOS.area;
    for (let i = 0; i < 5; i++) { const aa = ai.ga + rand(-H, H), r = rand(10, R0), sp = rand(160, 260); part(e.x + Math.cos(aa) * r * 0.3, e.y + Math.sin(aa) * r * 0.3, Math.cos(aa) * sp, Math.sin(aa) * sp, rand(0.25, 0.45), pick(['#ffffff', '#ffd0f0', '#c8b8c0']), { drag: 1, sz: 1 }); } // 吹き抜ける風
    if (!ai.gpushed && inFan(e.x, e.y, ai.ga, 140, H)) ai.gpushed = pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 110, 0.5);
    e.sq = 1 + Math.sin(ai.pt * 40) * 0.08; shake(1.2);
    if (ai.pt <= 0) endAct();
    return;
  }
  // 距離を保って旋回
  const want = 95, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 18) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 18) * slow * dt;
  ai.cd -= dt * CHAOS.rate; ai.beamCd -= dt * CHAOS.rate; ai.raidCd -= dt * CHAOS.rate; ai.gustCd -= dt * CHAOS.rate;
  if (ai.cd > 0) return;
  ai.cd = 99; // 行動終了時に再設定
  if (ai.beamCd <= 0) {
    ai.beamCd = ai.enraged ? 11 : 15;
    ai.b0 = a + Math.PI; ai.dir = Math.random() < 0.5 ? 1 : -1; ai.chg = true;
    pushWarn({ kind: 'line', x: e.x, y: e.y, a: ai.b0, len: BEAM_LEN, w: 10, t: 0, life: 1.3 });
    AudioMan.warning(); AudioMan.charge(1.3);
    hint('beam', _t('全周ビーム!!'), _t('ダッシュの無敵ですり抜けろ'));
    windup(e, 1.3, () => { ai.act = 'beam'; ai.pt = 0; ai.T = ai.enraged ? 2 : 2.4; AudioMan.zap(); shockAt(e.x, e.y, 1, 1); fxRays(e.x, e.y - 4, 70, '#a01a4a', { foe: true, n: 16, life: 0.4, core: '#ff4a8a' }); });
  } else if (ai.raidCd <= 0) { // 空襲: 飛び上がり、画面を横切る影が燃える床を残していく
    ai.raidCd = ai.enraged ? 12 : 16;
    startRaid(e, ai);
  } else if (ai.gustCd <= 0) { // 翼の暴風: 前方の扇を押し出す
    ai.gustCd = ai.enraged ? 7 : 10;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 140, h: 1.047, t: 0, life: 0.7 });
    e.sq = 1.25; AudioMan.charge(0.7);
    hint('gust', _t('翼の暴風'), _t('押し出される(ダメージはない)。燃える床に注意'));
    windup(e, 0.7, () => { ai.act = 'gust'; ai.pt = 0.5; ai.ga = a; ai.gpushed = false; AudioMan.roar(); AudioMan.dash(); shockAt(e.x, e.y, 1, 0.9); });
  } else if (dist < LUNGE_RANGE && (dist < 60 || Math.random() < 0.35)) { // 近距離は必ず、中距離は確率で飛びつき
    pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: LUNGE_RANGE + 20, w: 34, t: 0, life: 0.4, fixed: true }); // 踏み込みの経路(爪撃は自分で範囲を描く)
    windup(e, 0.4, () => {
      ai.act = 'lunge'; ai.la = Math.atan2(P.y - e.y, P.x - e.x);
      ai.pt = clamp((Math.sqrt(d2(e.x, e.y, P.x, P.y)) - 14) / LUNGE_SPD, 0.08, (LUNGE_RANGE + 20) / LUNGE_SPD); // プレイヤーの手前まで踏み込む
    });
  } else if (dist < 130 && Math.random() < 0.55) { // 予兆はボスからプレイヤーへ向きを追随
    pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 125, w: 30, t: 0, life: 0.6, track: w => { w.x = e.x; w.y = e.y; w.a = Math.atan2(P.y - e.y, P.x - e.x); } });
    windup(e, 0.6, () => { ai.act = 'breath'; ai.pt = 2.6; ai.ba = Math.atan2(P.y - e.y, P.x - e.x); AudioMan.roar(); });
  } else { // グランドクロス: プレイヤーの位置に十字の光柱(激昂時は続けてX字)
    // 腕の始点は倍率を掛けた長さ LA で決める(十字の中心をプレイヤーの位置に保つ)。予告と判定の len・w は自分で倍率を掛けるので掛ける前の値を渡す
    const tx = P.x, ty = P.y, L = 120, W = 16, T = 1.2, LA = L * CHAOS.area;
    const arms = off => [off, off + Math.PI / 2].map(aa => ({ x: tx - Math.cos(aa) * LA, y: ty - Math.sin(aa) * LA, a: aa }));
    const mark = off => arms(off).forEach(r => pushWarn({ kind: 'line', x: r.x, y: r.y, a: r.a, len: L * 2, w: W, t: 0, life: T }));
    const blast = off => {
      for (const r of arms(off)) {
        if (hitLine(r.x, r.y, r.a, L * 2, W, e.dmg * 1.3)) burnPlayer(e.dmg * 0.03); // 当たると炎上
        slashes.push({ line: true, x: r.x, y: r.y, x1: r.x + Math.cos(r.a) * LA * 2, y1: r.y + Math.sin(r.a) * LA * 2, t: 0, life: 0.45, w: 10 * CHAOS.area, enemy: true });
      }
      addFlash(tx, ty, 160 * CHAOS.area, '#ff4a8a', 0.5); shockAt(tx, ty, 1.6, 0.9); shake(7); AudioMan.boom(); AudioMan.zap();
      bossBlast(tx, ty, 34 * CHAOS.area, BFX.cdragon); // 十字の交わる所の地面が裂ける
      burst(tx, ty, 30, ['#ff4a8a', '#ffd0f0', '#ffffff'], { sp: 140, glow: true });
    };
    mark(0); later(ai, T, () => blast(0));
    if (ai.enraged) { later(ai, 0.5, () => mark(Math.PI / 4)); later(ai, 0.5 + T, () => blast(Math.PI / 4)); }
    AudioMan.charge(T);
    endAct();
  }
}

// 空襲: 0.8秒で飛び上がる(この間に画面を横切る帯 = 影の通り道が出る)→ 空の上(攻撃が当たらない)を影が速さ 280 で走り、通った跡に燃える床(帯と同じ幅 60。通ってから 8秒)
//   影(帯と同じ幅 60)に触れると ×1.0・炎上 → 影が抜けたら、プレイヤーのそばへ舞い降りる(0.4秒)。激昂は降りてすぐもう1回
function startRaid(e, ai) {
  const th = rand(0, TAU), L = Math.min(440, Math.hypot(GFX.VW, GFX.VH) + 40), W = 60 * CHAOS.area; // 影が横切るのは約1.6秒(速さ 280)
  const rd = ai.rd = { ph: 'up', t: 0, th, L, sx: P.x - Math.cos(th) * L / 2, sy: P.y - Math.sin(th) * L / 2, fire: 0 };
  ai.act = 'raid';
  pushWarn({ kind: 'line', x: rd.sx, y: rd.sy, a: th, len: L, w: W, t: 0, life: 0.8 + L / 280, fixed: true }); // 影の通り道(帯の幅は攻撃範囲の倍率で広がる)
  AudioMan.roar(); shake(5); e.sq = 0.7;
  hint('raid', _t('空襲'), _t('空を横切る影に触れると炎上。影の跡は燃える床になる'));
}
function updRaid(e, ai, dt) {
  const rd = ai.rd;
  rd.t += dt;
  if (rd.ph === 'up') { // 羽ばたいて飛び上がる(足元に土煙)
    const k = Math.min(1, rd.t / 0.8);
    e.jz = 140 * k * k; e.air = true;
    if (Math.random() < dt * 50) { const pa = rand(0, TAU); part(e.x + Math.cos(pa) * 14, e.y + 8 + Math.sin(pa) * 6, Math.cos(pa) * 90, Math.sin(pa) * 30, 0.5, pick(['#8a6a5a', '#c8a090', '#5a3a30']), { drag: 2 }); }
    if (rd.t >= 0.8 && !rd.flap) { rd.flap = true; AudioMan.dash(); }
    if (k < 1) return;
    rd.ph = 'sky'; rd.t = 0; e.flying = true; e.hidden = true; e.jz = 0; // 空の上: 攻撃が当たらない・狙われない
    return;
  }
  if (rd.ph === 'sky') { // 影が帯を走る。跡に燃える床
    const run = Math.min(rd.L, rd.t * 280), c = Math.cos(rd.th), s = Math.sin(rd.th);
    e.x = rd.sx + c * run; e.y = rd.sy + s * run; // 竜は影の真上を飛ぶ
    if (!rd.band) { rd.band = true; addHazard('fband', rd.sx, rd.sy, { a: rd.th, L: rd.L, spd: 280, stay: 8, w: 60 * CHAOS.area, dur: 8 + rd.L / 280, dmg: e.dmg }); } // 燃える床: 影と同じ速さで伸び、通ってから 8秒で消える
    const R0 = 30 * CHAOS.area; // 影の当たり判定 = 帯の幅の半分
    if (d2(e.x, e.y, P.x, P.y) < (R0 + 3) * (R0 + 3) && hurtPlayer(e.dmg)) burnPlayer(e.dmg * 0.03);
    if (Math.random() < dt * 30) part(e.x + rand(-12, 12), e.y + rand(-6, 6), c * 60 + rand(-20, 20), s * 60 - rand(10, 30), 0.5, pick(['#ff6a2a', '#ffc34a', '#ff4a8a']), { glow: true, drag: 1 }); // 炎の粉が降る
    rd.wind = (rd.wind || 0) - dt;
    if (rd.wind <= 0) { rd.wind = 0.3; AudioMan.fire(); }
    if (run < rd.L) return;
    // 舞い降りる位置: プレイヤーから影が抜けた側へ 100
    rd.ph = 'down'; rd.t = 0; rd.lx = P.x + c * 100; rd.ly = P.y + s * 100;
    e.x = rd.lx; e.y = rd.ly;
    return;
  }
  const k = Math.min(1, rd.t / 0.4); // 舞い降りる
  e.x = rd.lx; e.y = rd.ly; e.jz = 140 * (1 - k) * (1 - k);
  if (k > 0.3) { e.flying = false; e.hidden = false; }
  if (k < 1) return;
  e.jz = 0; e.air = false; e.sq = 0.6; ai.act = null; ai.cd = ai.enraged ? 1.6 : 2.4;
  shockAt(e.x, e.y, 1.6, 0.8); shake(9); AudioMan.boom();
  burst(e.x, e.y, 36, ['#8a6a5a', '#c8a090', '#ff6a2a', '#ffc34a'], { sp: 130, g: 200 });
  addRing(e.x, e.y, 40, '#ff4a8a', { w: 2, life: 0.4 });
  if (ai.enraged && !rd.again) { startRaid(e, ai); ai.rd.again = true; } // 激昂: 降りてすぐもう1回(2回まで)
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawCdragonFx(e, ai, A) {
  for (let r = 20; r < 125 * A; r += 26 * A) addLight(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, r * 0.9, '#ff6a2a', 0.7);
}
function drawCdragonFx2(e, ai, sx, ex, ey, A, t) {
  const R = 15 * A, x = ex, y = ey, c = Math.cos(ai.rd.th), s = Math.sin(ai.rd.th);
  sx.globalAlpha = 0.55; sx.fillStyle = '#12060e';
  sx.beginPath(); sx.ellipse(x, y, R, R * 0.7, ai.rd.th, 0, TAU); sx.fill();
  for (const w of [-1, 1]) { // 翼の影
    const wx = x - s * w * R * 1.1, wy = y + c * w * R * 1.1;
    sx.beginPath(); sx.ellipse(wx, wy, R * 0.9, R * 0.35, ai.rd.th + w * 0.4, 0, TAU); sx.fill();
  }
  sx.globalAlpha = 1;
  pCircle(sx, x, y, Math.round(R), Math.floor(t * 10) % 2 ? '#ff3b5c' : '#ffd0d8');
  addLight(e.x, e.y, 60, '#ff6a2a', 0.5);
}
// 空襲の燃える床: 影の通り道と同じ幅の赤熱した帯に炎の舌がちらつく(縁は危険の赤)
HAZ_DRAW.fband = (h, hx, hy, fade, hd) => {
  const { sx, gx, warnBlink, t } = hd;
  const c = Math.cos(h.a), s = Math.sin(h.a), nx = -s * h.w / 2, ny = c * h.w / 2;
  const head = Math.min(h.L, h.t * h.spd), tail = Math.max(0, (h.t - h.stay) * h.spd);
  if (head > tail) {
    const x0 = hx + c * tail, y0 = hy + s * tail, x1 = hx + c * head, y1 = hy + s * head;
    const band = (ctx, k, col, al) => { ctx.globalAlpha = al; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x0 + nx * k, y0 + ny * k); ctx.lineTo(x1 + nx * k, y1 + ny * k); ctx.lineTo(x1 - nx * k, y1 - ny * k); ctx.lineTo(x0 - nx * k, y0 - ny * k); ctx.fill(); ctx.globalAlpha = 1; };
    band(sx, 1, '#4a1208', 0.55 * fade); band(sx, 0.85, '#a8321a', 0.45 * fade);
    band(gx, 0.85, '#120401', fade); // 赤熱(光の層は色で明るさが決まるので、広い帯はとても暗い色で)
    for (const k of [-1, 1]) { sx.globalAlpha = fade; pLine(sx, x0 + nx * k, y0 + ny * k, x1 + nx * k, y1 + ny * k, warnBlink ? '#ff3b1a' : '#ff8a3d'); sx.globalAlpha = 1; }
    for (let i = Math.floor(tail / 2); i < Math.ceil(head / 2); i++) { // 炎の舌: 位置は帯ごとに決まっていて、高さが揺らめく
      const d = (i + hash2(i, h.seed)) * 2; if (d < tail || d > head) continue;
      const off = (hash2(i + 7, h.seed) - 0.5) * 0.9, fx = Math.round(hx + c * d + nx * off * 2), fy = Math.round(hy + s * d + ny * off * 2);
      const fh = Math.max(1, Math.round((1 + 3 * Math.abs(Math.sin(t * 9 + i * 1.7))) * fade * Math.min(1, (d - tail) / 16 + 0.3)));
      for (let k = 0; k < fh; k++) { const col = k === fh - 1 ? '#ffe9a0' : k > fh / 2 ? '#ffc34a' : '#ff6a2a'; sx.fillStyle = gx.fillStyle = col; sx.fillRect(fx, fy - k, 1, 1); gx.fillRect(fx, fy - k, 1, 1); }
    }
    for (let d = tail; d < head; d += 50) addLight(h.x + c * d, h.y + s * d, 55, '#ff6a2a', 0.3 * fade);
  }
};
