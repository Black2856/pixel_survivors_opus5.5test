// bosses/trichroma.js — ボス: 三原の光精(天光の聖堂 1体目): 白い水晶の核のまわりを赤・緑・青の灯が回る。距離 110 を保って漂う
'use strict';

// ---------- 三原の光精(天光の聖堂 1体目): 白い水晶の核のまわりを赤・緑・青の灯が回る。距離 110 を保って漂う ----------
//   光が重なった所は色が混ざり(光の層で足し合わせて描くので、本当に黄・紫・水色・白に見える)、効果も混ざった色のものになる
//   ★三原の灯 / 白の収束 / 三原の柱 / 分光(弾)/ 激昂: ミラーボール
const TRI = { col: ['#ff3a4a', '#3aff6a', '#3a6aff'] }; // 灯の色(赤・緑・青。ビット 1・2・4)
// 色(ビット: 赤 1・緑 2・青 4)の状態異常: 赤 = 出血 +1 / 緑 = 毒 +1 / 青 = 疲労 / 赤+緑(黄)= 痺れ +2 / 赤+青(紫)= 炎上 / 緑+青(水色)= 凍傷 +2 / 白(3色)= 乱光 +2。src: ボスのダメージ(炎上の量)
function triStatus(mask, src) {
  if (mask === 1) bleedPlayer(1); else if (mask === 2) poisonPlayer(1); else if (mask === 4) fatiguePlayer();
  else if (mask === 3) numbPlayer(2); else if (mask === 5) burnPlayer(src * 0.1); else if (mask === 6) frostPlayer(2); else if (mask === 7) randomLight(2, src);
}
const TRI_N = [0, 1, 1, 2, 1, 2, 2, 3]; // ビットの数(色の数)
function trichromaAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  e.jz = 8 + Math.sin(e.t * 2.2) * 3; // 浮かぶ
  ai.orb = (ai.orb || 0) + dt * 1.6; // 灯が回る
  if (ai.lamp) updTriLamps(e, ai, dt);
  if (ai.ball) updTriBall(e, ai, dt);
  if (ai.cv) updTriConv(e, ai, dt);
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -(ai.side || 1); } // ときどき回り込む向きを変える
  const dir = dist > 110 ? a : a + Math.PI, k = Math.abs(dist - 110) > 15 ? 1 : 0.25; // 距離 110 を保ち、横へ漂う
  e.x += (Math.cos(dir) * k + Math.cos(a + Math.PI / 2) * 0.6 * (ai.side || 1)) * e.spd * slow * dt;
  e.y += (Math.sin(dir) * k + Math.sin(a + Math.PI / 2) * 0.6 * (ai.side || 1)) * e.spd * slow * dt;
  if (Math.random() < dt * 8) part(e.x + rand(-10, 10), e.y - e.jz + rand(-12, 12), rand(-6, 6), -rand(6, 16), 0.7, pick([...TRI.col, '#ffffff']), { glow: true, drag: 1 }); // 七色にきらめく光の粒
  ai.lampCd -= dt * R; ai.conv -= dt * R; ai.pill -= dt * R; ai.split -= dt * R; ai.busy -= dt * R; if (ai.enraged) ai.ballCd -= dt * R;
  if (ai.busy > 0) return; // 技のあとは少しあける
  if (ai.enraged && ai.ballCd <= 0) { ai.ballCd = 99; ai.busy = 1; triBall(e, ai); } // 次までの間は終わってから(updTriBall)。出ている間も動いて、ほかの技(三原の灯も)を使う
  else if (ai.lampCd <= 0 && !ai.lamp) { ai.lampCd = ai.enraged ? 11 : 14; ai.busy = 1.2; triLamps(e, ai); }
  else if (ai.conv <= 0) { ai.conv = ai.enraged ? 8 : 10; ai.busy = TRI_CONV.end + 0.4; triConverge(e, ai); }
  else if (ai.pill <= 0) { ai.pill = ai.enraged ? 5.5 : 7; ai.busy = TRI_PILL.gap * 2 + TRI_PILL.warn + 0.2; triPillars(e, ai); } // 最後の柱が落ちて 0.2秒まで
  else if (ai.split <= 0) { ai.split = ai.enraged ? 4 : 5; ai.busy = 1.8; triSplit(e, ai); }
}
// ★三原の灯: 赤・緑・青の光の円(半径 50)が光精から飛び出し、それぞれ違う速さ(赤 50・緑 38・青 28)でプレイヤーを追う(6秒。激昂 8秒)。
//   灯はプレイヤーのまわり 3方向(120° おき・110 離れた所)へ飛んで円を灯し(0.6秒。この間は当たらない)、そこから追う。
//   円の中にいると 0.5秒ごとに、その場所の色の効果(1色 ×0.1・2色 ×0.3・白 ×0.6 と、色の状態異常)。止まっていると 3つが重なって白になる
function triLamps(e, ai) {
  const sp = [50, 38, 28], a0 = rand(0, TAU);
  ai.lamp = { t: 0, dur: ai.enraged ? 8 : 6, tick: 0.6, cs: [0, 1, 2].map(i => ({ x: P.x + Math.cos(a0 + TAU / 3 * i) * 110, y: P.y + Math.sin(a0 + TAU / 3 * i) * 110, sp: sp[i], i })) };
  e.sq = 1.25; AudioMan.chime(); AudioMan.charge(0.6);
  hint('tri_lamps', _t('三原の灯'), _t('赤・緑・青の光が追ってくる。重なった所は色が混ざって効果が変わり、3色が重なった白は乱光'));
}
function updTriLamps(e, ai, dt) {
  const L = ai.lamp;
  L.t += dt;
  if (L.t >= 0.6) for (const c of L.cs) { // 灯ってから追う
    const d = Math.hypot(P.x - c.x, P.y - c.y), k = Math.min(d, c.sp * dt);
    if (d > 0.5) { c.x += (P.x - c.x) / d * k; c.y += (P.y - c.y) / d * k; }
  }
  if (L.t >= 0.6 && L.t < L.dur && (L.tick -= dt) <= 0) {
    L.tick = 0.5;
    const mask = triLampMask(ai);
    if (mask && hurtPlayer(e.dmg * [0, 0.1, 0.3, 0.6][TRI_N[mask]])) triStatus(mask | triBallMask(e, ai), e.dmg); // ミラーボールの光と重なった所は色が混ざる
  }
  if (L.t >= L.dur + 0.5) ai.lamp = null; // 終わりの 0.5秒で光が消えて灯が戻る
}
// プレイヤーのいる所の三原の灯の色(赤 1・緑 2・青 4。円が灯っている間だけ)
function triLampMask(ai) {
  const L = ai.lamp, R0 = 50 * CHAOS.area; let m = 0;
  if (L && L.t >= 0.6 && L.t < L.dur) for (const c of L.cs) if (d2(c.x, c.y, P.x, P.y) < (R0 + 3) * (R0 + 3)) m |= 1 << c.i;
  return m;
}
// 白の収束: 3つの灯がプレイヤーのまわり 3方向(120° おき・100 離れた所)に降り(0.4秒)、1.6秒かけて真ん中へ集まる(動く円の予告 半径 40)。
//   真ん中はプレイヤーを追う(速さ 30。真ん中の円が出たら止まる)。集まった所で白の爆発(半径 50。最後の 0.6秒は真ん中の円も出る)×1.4・乱光 +2。早めに離れる
const TRI_CONV = { D: 100, land: 0.4, lock: 1.4, end: 2.0, sp: 30 }; // 灯の離れ具合・降りる時間・真ん中が止まる時・爆発の時・真ん中の追う速さ(プレイヤーの半分くらい)
function triConverge(e, ai) {
  const Q = TRI_CONV, a0 = rand(0, TAU), pts = [0, 1, 2].map(i => ({ dx: Math.cos(a0 + TAU / 3 * i) * Q.D, dy: Math.sin(a0 + TAU / 3 * i) * Q.D, i }));
  const cv = ai.cv = { t0: S.time, cx: P.x, cy: P.y, pts, lock: false }; // t0: 始まった時刻(render.js が灯の位置を同じ式で描く)。cx, cy: 真ん中(updTriConv が動かす)
  cv.pos = (p, t) => { const u = clamp((t - Q.land) / (Q.end - Q.land), 0, 1), k = 1 - u * u; return [cv.cx + p.dx * k, cv.cy + p.dy * k]; }; // ease-in(最後に一気に集まる)
  for (const p of pts) pushWarn({ kind: 'circle', x: cv.cx + p.dx, y: cv.cy + p.dy, r: 40, t: 0, life: Q.end, owner: e, noSnap: true, track: w => { [w.x, w.y] = cv.pos(p, w.t); } }); // 灯が集まる道すじ(当たるのは真ん中の円)
  later(ai, Q.lock, () => { cv.lock = true; pushWarn({ kind: 'circle', x: cv.cx, y: cv.cy, r: 50, t: 0, life: Q.end - Q.lock, owner: e }); });
  later(ai, Q.end, () => {
    const cx = cv.cx, cy = cv.cy;
    if (hitCircle(cx, cy, 50, e.dmg * 1.4)) randomLight(2, e.dmg);
    const R0 = 50 * CHAOS.area;
    bossBlast(cx, cy, R0, { col: '#8a8ab8', core: '#d8dcff', decal: false, n: 22, light: 0.6 });
    fxRays(cx, cy, R0 * 1.4, '#c8d0ff', { foe: true, n: 18, core: '#ffffff', life: 0.45, light: 0.5 });
    for (let k = 0; k < 3; k++) addRing(cx, cy, R0 * (0.7 + k * 0.25), TRI.col[k], { r0: 6, w: 2, life: 0.4 + k * 0.08 });
    burst(cx, cy, 40, [...TRI.col, '#ffffff', '#ffffff'], { sp: 150, glow: true, life: 0.6 });
    shockAt(cx, cy, 1.2, 0.8); shake(6); AudioMan.boom(); AudioMan.chime();
    ai.cv = null;
  });
  e.sq = 0.85; AudioMan.charge(Q.end);
  hint('tri_conv', _t('白の収束'), _t('3つの灯が囲んで付いてきながら集まり、白い光が弾ける。真ん中の円が出たら止まるので、早めに離れる'));
}
function updTriConv(e, ai, dt) { // 白の収束の真ん中がプレイヤーを追う(真ん中の円が出たら止まる)
  const cv = ai.cv; if (cv.lock) return;
  const d = Math.hypot(P.x - cv.cx, P.y - cv.cy), k = Math.min(d, TRI_CONV.sp * dt);
  if (d > 0.5) { cv.cx += (P.x - cv.cx) / d * k; cv.cy += (P.y - cv.cy) / d * k; }
}
// 三原の柱: 赤 → 緑 → 青の順に 0.5秒おき、プレイヤーが 0.6秒後にいる所(今の歩きのまま進んだ所。先読み)に光の柱(円 半径 30・予告 1秒)。各 ×0.6 とその色の状態異常。
//   まっすぐ歩き続けると当たる(円が出るたびに同じ向きへ曲がるとよける。予告が柱の間より長いので、引き返す・左右に振ると前の円に戻る)。3本の円の中に居続けた(止まっていた)と、重なった白の光で乱光 +2(当たったかではなく居場所で決める)
const TRI_PILL = { gap: 0.5, warn: 1, lead: 0.6 }; // 柱の間 / 予告 / 先読み(何秒先の居場所に落とすか)
function triPillars(e, ai) {
  const pts = [];
  for (let i = 0; i < 3; i++) later(ai, i * TRI_PILL.gap, () => {
    const [x, y] = serClamp(P.x + (P.ivx || 0) * TRI_PILL.lead, P.y + (P.ivy || 0) * TRI_PILL.lead); pts.push([x, y]); // 歩きの速さ(押し流し・ダッシュは入れない)で lead 秒先へ
    pushWarn({ kind: 'circle', x, y, r: 30, t: 0, life: TRI_PILL.warn, owner: e });
    later(ai, TRI_PILL.warn, () => {
      if (hitCircle(x, y, 30, e.dmg * 0.6)) triStatus(1 << i, e.dmg);
      const R0 = 30 * CHAOS.area + 3;
      if (i === 2 && P.invT <= 0 && !P.dead && pts.every(([qx, qy]) => d2(qx, qy, P.x, P.y) < R0 * R0)) { randomLight(2, e.dmg); addFlash(x, y, 70, '#c8c8d8', 0.4); fxRays(x, y, 50, '#e8e8ff', { foe: true, n: 14, core: '#ffffff', life: 0.35, light: 0.4 }); } // 3色が重なった白
      fxBeam(x, y, { foe: true, w: 9 * CHAOS.area, H: 180, col: TRI.col[i], mid: TRI.col[i], core: '#ffffff', life: 0.5, drop: 0.07 });
      burst(x, y, 18, [TRI.col[i], '#ffffff'], { sp: 90, glow: true, life: 0.4 }); addRing(x, y, 30 * CHAOS.area, TRI.col[i], { r0: 4, w: 2, life: 0.3 });
      shake(3); AudioMan.chime(); AudioMan.thud();
    });
  });
  AudioMan.charge(1.2);
  hint('tri_pill', _t('三原の柱'), _t('光の柱は歩いていく先に落ちる。赤い円が出るたびに同じ向きへ曲がる(回るように歩く)'));
}
// 分光(弾): 白い光の玉 3発(扇 ±0.3rad・速さ 75)。0.6秒後に、それぞれ赤・緑・青の 3つに割れて扇に広がる(±0.3rad・速さ 90、×0.5・その色の状態異常)。
//   割れる前の白い玉に当たると乱光 +2。3回(0.7秒おき)
function triSplit(e, ai) {
  for (let v = 0; v < 3; v++) later(ai, v * 0.7, () => {
    if (e.dead) return;
    const x = e.x, y = e.y - e.jz - 2, aa = Math.atan2(P.y - y, P.x - x), orbs = [];
    for (const da of [-0.3, 0, 0.3]) { const p = eball(x, y, aa + da, 75, e.dmg * 0.5, 'tchroma'); Object.assign(p, { tri: 7, src: e.dmg, ci: 3, r: 3.5 * CHAOS.area }); orbs.push(p); }
    burst(x, y, 12, TRI.col, { sp: 60, glow: true, life: 0.3 }); e.sq = 0.85; AudioMan.shoot(); AudioMan.sparkle();
    later(ai, 0.6, () => {
      for (const p of orbs) {
        const j = eprojs.indexOf(p); if (j < 0) continue;
        eprojs.splice(j, 1);
        const pa = Math.atan2(p.vy, p.vx);
        for (let k = 0; k < 3; k++) Object.assign(eball(p.x, p.y, pa + (k - 1) * 0.3, 90, e.dmg * 0.5, 'tchroma'), { tri: 1 << k, src: e.dmg, ci: k, r: 3 * CHAOS.area });
        burst(p.x, p.y, 10, [...TRI.col, '#ffffff'], { sp: 70, glow: true, life: 0.3 }); addRing(p.x, p.y, 8, '#ffffff', { life: 0.2 });
      }
      AudioMan.chime();
    });
  });
  hint('tri_split', _t('分光'), _t('白い光の玉は、少しすると赤・緑・青の 3つに割れて広がる'));
}
// ミラーボール(激昂): 光精の頭上 150 の高さにミラーボールが現れて浮かぶ(壊せない)。赤・緑・青の光が 120° おきに出て、回りながら(毎秒 20°)、
//   傾きが sin のように上下する(5秒で 1往復。真下 → 楕円の遠い縁が 325 の所まで)。3つの光は同じ傾き: 真下では 3色が重なって白になり、上がると赤・緑・青に分かれて広がる。
//   光は円錐(ヘヴンズリフトと同じ計算 coneSpot。真下の円は半径 66、上がると最大 277×191 の楕円)。光が重なった所は色が混ざる(黄・紫・水色・白)。玉はふだん画面の上の端の外にあり、光が上から差し込む。
//   現れて 0.6秒で光が地面に届き、1秒は弱い光(真下の白。当たらない)。そのあと楕円に入っていると 0.5秒ごとに、重なっている数で ×0.2・×0.4・×0.5 と、その場所の色の効果(triStatus)。
//   15秒で消える。その間も光精は動き、ほかの技(三原の灯も)を使う(玉と光は光精に付いてくる。三原の灯の円と重なった所も色が混ざる)。間隔は終わってから数える
//   H: 玉の高さ / R: 真下の円の半径(開きの半分は atan(R / H) = 23.7°。R に攻撃範囲の倍率を掛ける)/ reach: 傾きの上の端(楕円の遠い縁がここまで)
//   spin: 回る速さ(度/秒。光精から 110 の所で 110 × 0.35 = 38 < 歩き 55)/ per: 上下の 1往復(秒)/ show: 現れてから光が地面に届くまで / warm: 弱い光の間
//   dur: 光が消え始める時 / fade: 消える長さ / tick: 当たる間 / dmg: 重なっている光の数ごとの倍率 / cd: 次までの間
const TRI_BALL = { H: 150, R: 66, reach: 325, spin: 20, per: 5, show: 0.6, warm: 1.0, dur: 15, fade: 0.3, tick: 0.5, dmg: [0, 0.2, 0.4, 0.7], cd: 20 };
const triBallAl = () => Math.atan(TRI_BALL.R * CHAOS.area / TRI_BALL.H); // 開きの半分(rad)
const triBallMax = () => Math.max(0, Math.atan(TRI_BALL.reach / TRI_BALL.H) - triBallAl()); // 傾きの上の端(rad。遠い縁が reach。41.5°)
// 今の 3つの光: 光精の真下 (gx, gy) から、向き a(120° おきに回る)・傾き th(sin のように上下。3つ同じ)・地面の楕円 o・色 ci。弱い光の間は真下で止まっている
function triBallBeams(e, B) {
  const Q = TRI_BALL, u = Math.max(0, B.t - Q.show - Q.warm), th = triBallMax() * (1 - Math.cos(TAU * u / Q.per)) / 2, o = coneSpot(Q.H, triBallAl(), th), a0 = B.a0 + Q.spin * Math.PI / 180 * u;
  return [0, 1, 2].map(ci => ({ gx: e.x, gy: e.y, a: a0 + TAU / 3 * ci, o, ci, th }));
}
function triBall(e, ai) {
  e.sq = 1.2;
  ai.ball = { t: 0, tick: 0, a0: rand(0, TAU) };
  burst(e.x, e.y - TRI_BALL.H, 30, [...TRI.col, '#ffffff'], { sp: 120, glow: true, life: 0.6 }); // 玉が現れる(高い所)
  addRing(e.x, e.y, 28, '#ffffff', { r0: 4, w: 2, life: 0.5 }); for (let k = 0; k < 3; k++) addRing(e.x, e.y, 20 + k * 8, TRI.col[k], { r0: 4, w: 1, life: 0.4 + k * 0.1 }); // 光精の足もと(光が降りてくる所)
  AudioMan.summon(); AudioMan.chime();
  hint('tri_ball', _t('ミラーボール'), _t('光精の頭上のミラーボールから、赤・緑・青の光が回りながら上下する。光と光の間に入る。真下で重なった白は乱光'));
}
// プレイヤーのいる所のミラーボールの光の色(赤 1・緑 2・青 4。照らしている間だけ)
function triBallMask(e, ai) {
  const B = ai.ball, Q = TRI_BALL; let m = 0;
  if (B && B.t >= Q.show + Q.warm && B.t < Q.dur) for (const b of triBallBeams(e, B)) if (inConeSpot(b.gx, b.gy, b.a, b.o, P.x, P.y, 3)) m |= 1 << b.ci;
  return m;
}
function updTriBall(e, ai, dt) {
  const Q = TRI_BALL, B = ai.ball;
  B.t += dt;
  if (B.t >= Q.dur + Q.fade) { ai.ball = null; ai.ballCd = Q.cd; return; } // 光が消えたら玉も消える
  if (B.t < Q.show + Q.warm || B.t >= Q.dur) return; // 弱い光・消えていく間は当たらない
  const bs = triBallBeams(e, B);
  if ((B.tick -= dt) <= 0) {
    B.tick = Q.tick;
    const m = triBallMask(e, ai);
    if (m && !P.dead && hurtPlayer(e.dmg * Q.dmg[TRI_N[m]])) triStatus(m | triLampMask(ai), e.dmg); // 三原の灯の円と重なった所は色が混ざる
  }
  if (Math.random() < dt * 12) { // 照らされた地面から光の粒が昇る(その光の色)
    const b = pick(bs), c = Math.cos(b.a), sn = Math.sin(b.a), q = rand(0, TAU), r = Math.sqrt(Math.random()), lu = b.o.c + Math.cos(q) * b.o.a * r, lv = Math.sin(q) * b.o.b * r;
    part(b.gx + c * lu - sn * lv, b.gy + sn * lu + c * lv, rand(-8, 8), -rand(15, 40), 0.5, pick([TRI.col[b.ci], '#ffffff']), { glow: true, drag: 1.5 });
  }
}
