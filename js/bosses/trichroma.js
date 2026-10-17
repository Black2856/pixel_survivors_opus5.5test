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
    forHit(() => { const mask = triLampMask(ai); if (mask && hurtPlayer(e.dmg * [0, 0.1, 0.3, 0.6][TRI_N[mask]])) triStatus(mask | triBallMask(e, ai), e.dmg); }); // ミラーボールの光と重なった所は色が混ざる
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
    hitCircle(cx, cy, 50, e.dmg * 1.4, () => randomLight(2, e.dmg));
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
      hitCircle(x, y, 30, e.dmg * 0.6, () => triStatus(1 << i, e.dmg));
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
    forHit(() => { const m = triBallMask(e, ai); if (m && !P.dead && hurtPlayer(e.dmg * Q.dmg[TRI_N[m]])) triStatus(m | triLampMask(ai), e.dmg); }); // 三原の灯の円と重なった所は色が混ざる
  }
  if (Math.random() < dt * 12) { // 照らされた地面から光の粒が昇る(その光の色)
    const b = pick(bs), c = Math.cos(b.a), sn = Math.sin(b.a), q = rand(0, TAU), r = Math.sqrt(Math.random()), lu = b.o.c + Math.cos(q) * b.o.a * r, lv = Math.sin(q) * b.o.b * r;
    part(b.gx + c * lu - sn * lv, b.gy + sn * lu + c * lv, rand(-8, 8), -rand(15, 40), 0.5, pick([TRI.col[b.ci], '#ffffff']), { glow: true, drag: 1.5 });
  }
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// 灯の番人の光の扇: ランタンから地面を照らす淡い金の扇(縁は少し明るい)。プレイヤーが中にいる間は赤く染まり、見つかるまでの時間ぶん根元から赤が満ちる
//   扇そのものは光なので暗闇でも見えるが、赤(攻撃の予告)は暗闇では出さない
//   ふだんの光は番人が重なっても明るさを足さない(聖堂の明るい床で 4体の扇が重なると白く飛んだ): 淡い金の塗りは扇を合わせた形で 1回だけ塗り、
//   照らされた地面の光は、その点に重なっているほかの扇の数で分ける。ランタンの灯も近くの番人の数で分ける(e.lanS。敵の描画で使う)。
//   見つけかけ(赤)・見つけた時の光(spotflash)は攻撃の合図なので、重なっても分けない
function spotCover(c, x, y) { // 点 (x, y) が扇 c の中か(1 = 中。縁の外側 8px ほどでなめらかに 0 へ。c.k を掛ける)
  const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy);
  if (d >= c.R) return 0;
  return Math.min(1, (c.R - d) / 8) * clamp((c.h - Math.abs(angDiff(Math.atan2(dy, dx), c.a))) * Math.max(d, 1) / 8 + 0.5, 0, 1) * c.k;
}
function drawSpotCones(t) {
  const sx = GFX.sctx, so = DATA.enemies.lampkeeper.spot, blink = Math.floor(t * 8) % 2;
  const ks = enemies.filter(e => !e.dead && e.type === 'lampkeeper');
  for (const e of ks) { let s = 1; for (const o of ks) if (o !== e) s += clamp(1 - Math.hypot(o.x - e.x, o.y - e.y) / 24, 0, 1); e.lanS = s; }
  const cs = ks.filter(e => e.spotK > 0 && e.spotA !== undefined).map(e => ({ e, x: e.x, y: e.y - 3, a: e.spotA, h: so.h, R: so.r * e.areaK * CHAOS.area * easeOutCubic(e.spotK), k: e.spotK }));
  if (!cs.length) return;
  const fan = new Path2D(); // 扇の塗り(淡い金。合わせた形で 1回)
  for (const c of cs) { const cx = c.x - cam.x, cy = c.y - cam.y; fan.moveTo(cx, cy); fan.arc(cx, cy, c.R, c.a - c.h, c.a + c.h); fan.closePath(); }
  sx.globalAlpha = (0.1 + 0.04 * Math.sin(t * 3 + cs[0].e.seed * 9)) * Math.max(...cs.map(c => c.k)); sx.fillStyle = '#fff2b8'; sx.fill(fan);
  for (const c of cs) {
    const e = c.e, R = c.R, h = c.h, a = c.a, cx = c.x - cam.x, cy = c.y - cam.y;
    const caught = e.spotC > 0 && !(P.darkT > 0), k = caught ? Math.min(1, e.spotC / so.catch) : 0;
    if (caught) { sx.globalAlpha = 0.22 + 0.25 * k; sx.fillStyle = '#ff3b5c'; sx.beginPath(); sx.moveTo(cx, cy); sx.arc(cx, cy, Math.max(2, R * k), a - h, a + h); sx.closePath(); sx.fill(); }
    const ec = caught ? (blink ? '#ff3b5c' : '#ffd0d8') : '#ffe8a0'; // 縁: 両端の線と弧
    sx.globalAlpha = (caught ? 0.9 : 0.4) * e.spotK;
    pLine(sx, cx, cy, cx + Math.cos(a - h) * R, cy + Math.sin(a - h) * R, ec); pLine(sx, cx, cy, cx + Math.cos(a + h) * R, cy + Math.sin(a + h) * R, ec);
    sx.fillStyle = ec; for (let u = -h; u <= h; u += 0.015) sx.fillRect(Math.round(cx + Math.cos(a + u) * R), Math.round(cy + Math.sin(a + u) * R), 1, 1);
    sx.globalAlpha = 1;
    for (let d = 10; d < R; d += 16) { // 照らされた地面(ふだんの扇は、重なっているほかの扇の数で分ける。見つけかけの赤はそのまま)
      const lx = c.x + Math.cos(a) * d, ly = c.y + Math.sin(a) * d; let s = 1;
      if (!caught) for (const o of cs) if (o !== c) s += spotCover(o, lx, ly);
      addLight(lx, ly, 12 + d * 0.16, caught ? '#ff8a8a' : '#fff2b8', 0.22 * e.spotK / s);
    }
  }
}
// 三原の光精の色の光の塗り: 1点ごとに、どの光に入っているか(赤 1・緑 2・青 4 のビット)で色を決める(重なった所は 黄・紫・水色・白)。
//   明るい床に足し合わせると白に寄って色が見えないので、混ざった色をそのまま淡く重ねる。白は少しまたたく
//   zs: [{ i: 色(0 赤・1 緑・2 青), x0, y0, x1, y1: 囲む四角(場面の座標), hit(x, y): その点が光の中か, k: 濃さ(0〜1。なければ 1。重なった所は濃い方) }](三原の灯の円・ミラーボールの楕円)
const TRI_RGB = [null, [255, 58, 74], [58, 255, 106], [255, 225, 74], [58, 106, 255], [255, 74, 216], [74, 220, 255], [255, 255, 255]];
let triCan = null, triCtx = null, triImg = null;
function drawTriZones(sx, zs, al, t) {
  const x0 = Math.max(Math.floor(Math.min(...zs.map(z => z.x0))), Math.floor(cam.x) - 1), y0 = Math.max(Math.floor(Math.min(...zs.map(z => z.y0))), Math.floor(cam.y) - 1); // 画面の外は塗らない(広い楕円)
  const W = Math.min(Math.ceil(Math.max(...zs.map(z => z.x1))), Math.ceil(cam.x + GFX.VW) + 1) - x0, H = Math.min(Math.ceil(Math.max(...zs.map(z => z.y1))), Math.ceil(cam.y + GFX.VH) + 1) - y0;
  if (W <= 0 || H <= 0 || W > 2000 || H > 2000) return;
  if (!triCan || triCan.width < W || triCan.height < H) { triCan = ART.canvas(Math.max(W, triCan ? triCan.width : 0, 64), Math.max(H, triCan ? triCan.height : 0, 64)); triCtx = triCan.getContext('2d'); triImg = null; }
  if (!triImg || triImg.width !== W || triImg.height !== H) triImg = triCtx.createImageData(W, H);
  const d = triImg.data, sh = Math.floor(t * 10) % 2;
  d.fill(0);
  for (let y = 0; y < H; y++) {
    const wy = y0 + y + 0.5;
    for (let x = 0; x < W; x++) {
      const wx = x0 + x + 0.5; let m = 0, kk = 0;
      for (const z of zs) if (wx >= z.x0 && wx <= z.x1 && wy >= z.y0 && wy <= z.y1 && z.hit(wx, wy)) { m |= 1 << z.i; kk = Math.max(kk, z.k ?? 1); }
      if (!m) continue;
      const col = TRI_RGB[m], o = (y * W + x) * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = (m === 7 ? (((x + y) & 1) === sh ? 255 : 200) : 255) * kk;
    }
  }
  triCtx.clearRect(0, 0, triCan.width, triCan.height); triCtx.putImageData(triImg, 0, 0);
  sx.globalAlpha = al; sx.drawImage(triCan, 0, 0, W, H, Math.round(x0 - cam.x), Math.round(y0 - cam.y), W, H); sx.globalAlpha = 1;
}
// ミラーボールの光の強さ: 玉が現れてすぐは 0、光の先が地面へ降りて 1秒は弱い光(当たらない)、照らしている間は 1、終わりは消えていく
const triBallLit = B => { const Q = TRI_BALL; return B.t < 0.15 ? 0 : (B.t < Q.show + Q.warm ? 0.4 : 1) * (1 - clamp((B.t - Q.dur) / Q.fade, 0, 1)); };
// ミラーボール: 鏡のかけらを貼った玉(回るにつれてかけらが横へ流れ、ときどき赤・緑・青・白にきらめく)と、まわりを回る金の輪と赤・緑・青の灯(三原の光精の灯と同じ)
//   cx, cy: 玉の中心(画面)/ ka: 現れる・消える(0〜1。大きさ)/ t: 時間。画面の外なら描かない
function drawTriBall(sx, gx, cx, cy, ka, t) {
  const R = Math.max(1, Math.round(8 * ka));
  if (ka <= 0 || cy + R + 6 < 0 || cy - R - 6 > GFX.VH || cx + R + 8 < 0 || cx - R - 8 > GFX.VW) return;
  const rx = R + 5, ry = Math.max(1, Math.round(R * 0.3)), at = q => [cx + Math.round(Math.cos(q) * rx), cy + Math.round(Math.sin(q) * ry)];
  const ring = front => { // 金の輪と 3つの灯(奥の半分 → 玉 → 手前の半分の順に描く)
    for (let j = 0; j < 48; j++) { const q = TAU * j / 48; if ((Math.sin(q) > 0) !== front) continue; const [x, y] = at(q); sx.fillStyle = j % 6 === 0 ? '#ffe08a' : '#b8903a'; sx.fillRect(x, y, 1, 1); }
    for (let i = 0; i < 3; i++) { const q = t * 1.6 + TAU / 3 * i; if ((Math.sin(q) > 0) !== front) continue; const [x, y] = at(q); pDisc(sx, x, y, 1, TRI.col[i]); sx.fillStyle = '#ffffff'; sx.fillRect(x, y, 1, 1); pDisc(gx, x, y, 1, dimCol(TRI.col[i], 0.6)); }
  };
  ring(false);
  const sp = t * 1.4, tick = Math.floor(t * 6), PAL = ['#20223a', '#383c5c', '#5c6286', '#8a90b0', '#b8bcd4', '#dcdff0']; // 鏡のかけら(暗い → 明るい。聖堂の明るい床で白く飛ばないように一番明るい所もくすませる)
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    const nx = x / R, ny = y / R, q = 1 - nx * nx - ny * ny; if (q < -0.05) continue;
    const nz = Math.sqrt(Math.max(0, q)), u = (Math.atan2(nx, nz) + sp) / (Math.PI / 6), v = Math.asin(clamp(ny, -1, 1)) / (Math.PI / 8) + 4, fi = Math.floor(u), fj = Math.floor(v), edge = u - fi < 0.22 || v - fj < 0.22; // 経度・緯度でかけらに分ける(目地は暗く)
    const h = ((fi * 7 + fj * 13) % 4 + 4) % 4, sh = -0.45 * nx - 0.6 * ny + 0.66 * nz; // かけらごとの向きのばらつき・左上からの光
    sx.fillStyle = !edge && nz > 0.3 && ((fi * 5 + fj * 3 + tick) % 11 + 11) % 11 === 0 ? (((fi + fj) % 4 + 4) % 4 === 3 ? '#ffffff' : TRI.col[((fi + fj) % 3 + 3) % 3]) : PAL[clamp(Math.round(sh * 3.2 + h * 0.5 + 0.6) - (edge ? 2 : 0), 0, 5)]; // ときどき光の色にきらめく
    sx.fillRect(cx + x, cy + y, 1, 1);
  }
  sx.fillStyle = '#ffffff'; sx.fillRect(cx - Math.round(R * 0.45), cy - Math.round(R * 0.5), 2, 1); // 照り
  ring(true);
  pDisc(gx, cx, cy, R + 1, dimCol('#c8d0ff', 0.1 * ka)); // 玉のまわりの淡い光
}
// 三原の光精: 水晶の中の光の核(拍動し、中で赤 → 緑 → 青と色が巡る)と、赤・緑・青の灯(ふだんは核のまわりを回る)
//   三原の灯の間は、灯がそれぞれの円の上に浮かんで、円を照らす光の筋を落とす / 白の収束では予告の円と同じ式で集まる
//   ミラーボール: 頭上 150 の玉(drawTriBall。ふだんは画面の上の端の外)と、3つの光の空中の円錐(ヘヴンズリフトと同じ drawConeShaft。地面の光は drawBossGround)
function drawTriFx(e, sx, gx, ex, ey, yo) {
  const ai = e.ai, t = GFX.fx.time, cx = Math.round(ex), cy = Math.round(ey + yo), pul = 0.5 + 0.5 * Math.sin(t * 6), ci = Math.floor(t * 3) % 3;
  // 核
  pDisc(sx, cx, cy, 2, '#ffffff'); sx.fillStyle = TRI.col[ci]; sx.fillRect(cx - 1, cy + 1, 3, 1); sx.fillRect(cx - 1, cy - 2, 3, 1);
  pDisc(gx, cx, cy, Math.round(2 + pul), dimCol('#c8d0ff', 0.55));
  addLight(e.x, e.y + yo, 60 * (0.9 + 0.1 * pul), '#e0e4ff', 0.45);
  // 灯の位置(場面の座標)
  const lampAt = i => {
    if (ai.lamp) { const c = ai.lamp.cs[i], k = easeOutCubic(Math.min(1, ai.lamp.t / 0.5)); return [lerp(e.x + Math.cos(ai.orb + TAU / 3 * i) * 18, c.x, k), lerp(e.y + yo + Math.sin(ai.orb + TAU / 3 * i) * 8, c.y - 26, k)]; } // 灯は円の上へ飛んでいく
    if (ai.cv) { const p = ai.cv.pts[i], [x, y] = ai.cv.pos(p, S.time - ai.cv.t0); return [x, y - 18]; }
    const a = ai.orb + TAU / 3 * i;
    return [e.x + Math.cos(a) * 18, e.y + yo + Math.sin(a) * 18 * 0.45];
  };
  for (let i = 0; i < 3; i++) {
    const [lx, ly] = lampAt(i), x = Math.round(lx - cam.x), y = Math.round(ly - cam.y), col = TRI.col[i];
    if (ai.lamp && ai.lamp.t < ai.lamp.dur) { // 円を照らす光の筋(灯から円の両端へ)
      const c = ai.lamp.cs[i], R = 50 * CHAOS.area, k = Math.min(1, ai.lamp.t / 0.6);
      sx.globalAlpha = 0.35 * k; pLine(sx, x, y, c.x - cam.x - R * 0.8, c.y - cam.y, col); pLine(sx, x, y, c.x - cam.x + R * 0.8, c.y - cam.y, col); sx.globalAlpha = 1;
    }
    pDisc(sx, x, y, 3, col); sx.fillStyle = '#ffffff'; sx.fillRect(x - 1, y - 1, 2, 2);
    pDisc(gx, x, y, 2, dimCol(col, 0.6));
    addLight(lx, ly, 34, col, 0.55);
  }
  if (ai.ball) { // ミラーボール: 3つの光の空中の円錐(現れてすぐ光の先が玉から地面へ降りる。縁はその光の色で、弱い光の間は 3色が交互の点線、照らしている間は線)と玉
    const B = ai.ball, Q = TRI_BALL, k = triBallLit(B), lit = B.t >= Q.show + Q.warm && B.t < Q.dur, f = 1 - clamp((B.t - Q.dur) / Q.fade, 0, 1), dr = clamp((B.t - 0.15) / (Q.show - 0.15), 0, 1);
    for (const b of triBallBeams(e, B)) { const col = TRI.col[b.ci]; drawConeShaft(sx, gx, t, { x: b.gx, y: b.gy, H: Q.H, a: b.a, ap: 2, col, glow: col, rim: col, dot: col, dph: b.ci }, b.o, k, f, lit, dr, Q.H * Math.tan(triBallAl())); }
    const ka = clamp(B.t / 0.3, 0, 1) * clamp((Q.dur + Q.fade - B.t) / 0.3, 0, 1); // 現れる・消える
    drawTriBall(sx, gx, Math.round(e.x - cam.x), Math.round(e.y - Q.H - cam.y + Math.sin(t * 2) * 2), ka, t); // 浮かんで少し上下する
    sx.globalAlpha = 1;
  }
}
