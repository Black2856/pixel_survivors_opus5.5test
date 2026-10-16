// bosses/seraph.js — ボス: 熾天使(天光の聖堂 2体目・ラスボス): 光輪と 6枚の翼。距離 120 を保って浮かぶ
'use strict';

// ---------- 熾天使(天光の聖堂 2体目・ラスボス): 光輪と 6枚の翼。距離 120 を保って浮かぶ ----------
//   全部の攻撃が被弾後の無敵を無視する(1.7 の無敵無視。回避・防御スキルの無敵とガードでは防げる)。そのかわり 1発は低め。当たると乱光 +1(激昂 +2)
//   光の衣: いつも纏い、受けるダメージ −80%。熾天使に付いている状態異常 1種につき効果が 20% 減る(5種で 0%)。技を使っている間(atkT)は衣が消える
//   ホーリー / ルミナスロンド / クリスタルサテライト / ヘヴンズリフト / ホーリーヴォルテックス / プリズムシフト / セラフィムレイ / プリズムバラージ
//   激昂: トリニティサンクチュアリ → 12秒後にホワイトアウト(壊したクリスタルの影だけが安全)。残り HP 1% でラストラディアンス
//   技は ai.act と later で進める(windup は使わない: 構えの間も衣・続く技・ホワイトアウトを毎フレーム動かすため)
const SER_GOLD = ['#ffe8a0', '#fff6dc', '#ffd23f', '#ffffff'];
const serLight = e => (e.ai.enraged ? 2 : 1); // 当たったときの乱光(激昂で 2回)
function serCircle(e, x, y, r, n) { return hitCircle(x, y, r, e.dmg * n, PIERCE, () => randomLight(serLight(e), e.dmg)); }
function serLine(e, x, y, a, len, w, n) { return hitLine(x, y, a, len, w, e.dmg * n, PIERCE, () => randomLight(serLight(e), e.dmg)); }
function serHurt(e, n) { if (hurtPlayer(e.dmg * n, PIERCE)) { randomLight(serLight(e), e.dmg); return true; } return false; }
function serBall(e, x, y, a, spd, n, kind) { const p = eball(x, y, a, spd, e.dmg * n, kind); p.pierce = true; p.light = serLight(e); p.src = e.dmg; return p; }
// 光の衣が数える状態異常: 炎上・凍傷(凍結)・出血・印・聖痕・呪い・スタン・弱点露出・攻撃力低下・取り憑き・減速(時の歪み)。感電は一瞬の連鎖なので数えない
function serStatusN(e) {
  return (e.burnT > 0 ? 1 : 0) + (e.frost > 0 || e.freeze ? 1 : 0) + (e.bleed > 0 && e.bleedT > 0 ? 1 : 0) + (e.mark > 0 && S.time < (e.markT || 0) ? 1 : 0)
    + (S.time < (e.stigmaT || 0) ? 1 : 0) + (S.time < (e.curseT || 0) ? 1 : 0) + (e.stun > 0 ? 1 : 0) + (S.time < (e.weakT || 0) ? 1 : 0)
    + (e.atkDownT > S.time ? 1 : 0) + (e.possN > 0 ? 1 : 0) + (e.slowT > 0 || clsEnemySlow(e) < 1 ? 1 : 0);
}
// 技の直前の合図: 頭上に赤いきらめきと音(ほかのボスの構えと同じ)
const serGlint = (e, ai, t) => later(ai, t, () => { if (!e.dead) { fxGlint(e.x, e.y - e.jz - 34, 11, '#ff3b5c', { foe: true, life: 0.22 }); AudioMan.cue(); } });
// 闘技場では壁の中に収める
// 見せ場(ホワイトアウト・ラストラディアンス)で熾天使を画面に収める: プレイヤーの横 110(今いる側)。画面の外にいるときは光の瞬間移動で現れる
function serSideSpot(e) { const sd = e.x < P.x ? -1 : 1; return serClamp(P.x + sd * 110, P.y + 4, 40); }
const serOffScreen = e => Math.abs(e.x - P.x) > 210 || e.y - P.y < -60 || e.y - P.y > 100; // 高く昇るので、上は狭く見る
function serBlink(e, x, y) { // 七色の帯を残して瞬間移動(プリズムシフトと同じ見た目。残像は残さない)
  const x0 = e.x, y0 = e.y;
  e.x = x; e.y = y;
  bfx.push({ kind: 'prismtrail', x: x0, y: y0 - e.jz, x1: x, y1: y - e.jz, t: 0, life: 0.45 });
  burst(x0, y0 - e.jz, 24, PRISM, { sp: 110, glow: true, life: 0.45 }); burst(x, y - e.jz, 30, [...PRISM, '#ffffff'], { sp: 100, glow: true, life: 0.5 });
  addRing(x, y, 50, '#ffffff', { r0: 8, w: 2, life: 0.3 }); AudioMan.dash();
}
function serClamp(x, y, m = 24) { if (S.mode !== 'arena') return [x, y]; const d = Math.hypot(x, y), R = DATA.arena.r - m; return d > R ? [x / d * R, y / d * R] : [x, y]; }
function seraphAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate, enr = ai.enraged;
  // 光の衣(技を使っている間・立ち尽くしている間は消える)
  ai.atkT = Math.max(0, (ai.atkT || 0) - dt);
  ai.statN = serStatusN(e);
  const off = ai.atkT > 0 || (ai.lr && ai.lr.still);
  e.robeK = off ? 1 : 1 - 0.8 * Math.max(0, 1 - 0.2 * ai.statN); // 衣は −80%。状態異常 1種につき衣の効果が 20% 減る(5種で 0%)
  ai.robeA = lerp(ai.robeA ?? 1, off ? 0 : 1, Math.min(1, dt * 10)); // 衣の見た目の濃さ(消えるときはほどける)
  if (e.flash > 0 && e.robeK < 1 && !e.shadow) hint('ser_robe', _t('光の衣'), _t('衣がダメージを防ぐ。状態異常を付けるほど薄くなり、技を使う間は消える'));
  ai.spread = lerp(ai.spread || 0, ai.act || ai.atkT > 0 ? 1 : 0, Math.min(1, dt * 6)); // 翼を広げる(技の間)
  ai.jzT = ai.lr ? (ai.lr.still ? 4 : 38) : ai.wo && ai.wo.t < 8 ? 30 : 12; // 浮かぶ高さ(ホワイトアウト・ラストラディアンスでは高く昇る)
  ai.jzB = lerp(ai.jzB ?? 12, ai.jzT, Math.min(1, dt * 1.5)); e.jz = ai.jzB + (ai.lr && ai.lr.still ? 0 : Math.sin(e.t * 1.8) * 2); // ゆっくり浮き沈みする
  if ((ai.wo || ai.lr) && !(ai.lr && ai.lr.still)) e.spr = 'seraphCast'; // ホワイトアウト・ラストラディアンスの間は技の姿のまま(先に出した技の later が戻しても)
  // 続く技
  if (ai.ronde) updSerRonde(e, ai, dt);
  if (ai.rift) updSerRift(e, ai, dt);
  if (ai.vortex) updSerVortex(e, ai, dt);
  if (ai.after) updSerAfter(e, ai, dt);
  if (ai.trin) updSerTrinity(e, ai, dt);
  if (ai.wo) updSerWhiteout(e, ai, dt);
  if (ai.lr) { updSerLR(e, ai, dt); return; }
  if (!e.shadow && e.hpFloor > 0 && e.hp <= e.hpFloor + 0.5 && !ai.wo) { startSerLR(e, ai); return; } // 残り HP 1%(ホワイトアウトの最中なら、終わってから。1% より下がらないまま待つ。重なると壊れたクリスタルが消えて影がなくなるため)
  if (Math.random() < dt * 10) part(e.x + rand(-14, 14), e.y - e.jz + rand(-16, 12), rand(-6, 6), -rand(8, 20), 0.8, pick(SER_GOLD), { glow: Math.random() < 0.6, drag: 1 }); // 光の粒が昇る
  if (ai.act || ai.wo) return; // 構え・ホワイトアウトの間は動かない(ホワイトアウトの前に出した技の later が act を戻しても)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(2.5, 4.5); ai.side = -(ai.side || 1); }
  const dir = dist > 120 ? a : a + Math.PI, k = Math.abs(dist - 120) > 15 ? 1 : 0.25; // 距離 120 を保ち、横へ回り込む
  e.x += (Math.cos(dir) * k + Math.cos(a + Math.PI / 2) * 0.7 * (ai.side || 1)) * e.spd * slow * dt;
  e.y += (Math.sin(dir) * k + Math.sin(a + Math.PI / 2) * 0.7 * (ai.side || 1)) * e.spd * slow * dt;
  for (const t of ['cHoly', 'cRonde', 'cSat', 'cRift', 'cVort', 'cShift', 'cRay', 'cBar', 'busy']) ai[t] -= dt * R;
  if (enr) ai.cTrin -= dt * R;
  if (ai.busy > 0) return; // 技のあとは少しあける(2026-10-13 に全部 +0.5秒。技はほぼ詰まって出るので、全体の速さはこの間で決まる)
  const sats = enemies.filter(o => !o.dead && o.obj === 'scrystal' && o.owner === e).length;
  if (enr && ai.cTrin <= 0 && !ai.wo) { ai.cTrin = 45; ai.busy = 1.5; serTrinity(e, ai); }
  else if (ai.cRay <= 0) { ai.cRay = enr ? 7 : 9; ai.busy = 1.5; serRay(e, ai, a); }
  else if (ai.cHoly <= 0) { ai.cHoly = enr ? 9 : 12; ai.busy = 1.6; serHoly(e, ai); }
  else if (ai.cVort <= 0) { ai.cVort = enr ? 8 : 10; ai.busy = 1.3; serVortex(e, ai); }
  else if (ai.cBar <= 0) { ai.cBar = enr ? 12 : 14; ai.busy = 1.4; serBarrage(e, ai); }
  else if (ai.cRift <= 0 && !ai.rift) { ai.cRift = enr ? 13 : 16; ai.busy = 1.3; serRift(e, ai); }
  else if (ai.cRonde <= 0 && !ai.ronde) { ai.cRonde = enr ? 16 : 18; ai.busy = 1.3; serRonde(e, ai); }
  else if (ai.cSat <= 0 && sats < 3) { ai.cSat = enr ? 18 : 21; ai.busy = 1.1; serSatellite(e, ai, sats); }
  else if (ai.cShift <= 0) { ai.cShift = enr ? 10 : 13; ai.busy = 1.3; serShift(e, ai); }
}
// ホーリー: 0.8秒 プレイヤーの位置に大きい円(半径 90)と光の陣 → 天から光の柱が降りて爆発 ×0.8。
//   そのあと 2(3)秒、0.5秒ごとにプレイヤーのまわり(150 以内)へ小さいホーリー(円 半径 24・予告 0.5秒 → 細い光の柱 ×0.4)
function serHoly(e, ai) {
  const x = P.x, y = P.y, n = ai.enraged ? 6 : 4, A = CHAOS.area;
  ai.act = 'holy'; ai.atkT = Math.max(ai.atkT, 1.0 + n * 0.5); e.spr = 'seraphCast';
  pushWarn({ kind: 'circle', x, y, r: 90, t: 0, life: 0.8, owner: e });
  fxSigil(x, y, 92 * A, '#ffe8a0', { foe: true, style: 'rune', n: 8, step: 3, wu: 0.8, life: 1.15, sq: 0.5, spin: 0.9, glow: 0.35, hi: '#fff6dc' });
  serGlint(e, ai, 0.65);
  AudioMan.charge(0.8); AudioMan.chime();
  later(ai, 0.8, () => {
    serCircle(e, x, y, 90, 0.8);
    fxBeam(x, y, { foe: true, w: 34 * A, H: 280, col: '#ffe8a0', mid: '#fff6dc', core: '#ffffff', life: 0.65, drop: 0.06 });
    fxRays(x, y, 120 * A, '#ffe8a0', { foe: true, n: 22, core: '#ffffff', life: 0.5, light: 0.45 });
    for (let k = 0; k < 3; k++) addRing(x, y, 90 * A * (0.6 + k * 0.3), k === 1 ? '#ffffff' : '#ffe8a0', { r0: 10, w: 2, life: 0.4 + k * 0.1 });
    burst(x, y, 50, SER_GOLD, { sp: 160, up: 40, glow: true, life: 0.7 });
    shockAt(x, y, 1.6, 0.8); shake(8); screenFlash(0.1, '#fff6dc'); AudioMan.boom(); AudioMan.chime();
    ai.act = null; e.spr = 'seraph';
  });
  for (let i = 0; i < n; i++) later(ai, 1.0 + i * 0.5, () => {
    if (e.dead) return;
    const pa = rand(0, TAU), pr = rand(0, 150), [hx, hy] = serClamp(P.x + Math.cos(pa) * pr, P.y + Math.sin(pa) * pr);
    pushWarn({ kind: 'circle', x: hx, y: hy, r: 24, t: 0, life: 0.5, owner: e });
    later(ai, 0.5, () => {
      serCircle(e, hx, hy, 24, 0.4);
      fxBeam(hx, hy, { foe: true, w: 8 * A, H: 200, col: '#ffe8a0', core: '#ffffff', life: 0.4, drop: 0.06 });
      burst(hx, hy, 14, SER_GOLD, { sp: 80, glow: true, life: 0.4 }); addRing(hx, hy, 24 * A, '#ffe8a0', { r0: 4, life: 0.25 }); AudioMan.chime();
    });
  });
  hint('ser_holy', _t('ホーリー'), _t('大きな光の円のあと、まわりに小さな光の柱が続けて落ちる'));
}
// ルミナスロンド: 0.6秒 光線の向きに細い帯 → 熾天使の足もとを中心に、光線(長さ 300・幅 8)3(4)本が 360°/n おきに 10秒 ゆっくり回る(毎秒 0.6rad。向きはランダム)。
//   触れると 0.5秒ごとに ×0.3。ほかの技と同時に続く(衣は消えない)
function serRonde(e, ai) {
  const n = ai.enraged ? 4 : 3, a0 = rand(0, TAU), dir = Math.random() < 0.5 ? 1 : -1;
  ai.ronde = { t: 0, n, a0, dir, tick: 0 };
  ai.atkT = Math.max(ai.atkT, 0.6);
  for (let k = 0; k < n; k++) pushWarn({ kind: 'line', x: e.x, y: e.y, a: a0 + TAU / n * k, len: 300, w: 8, t: 0, life: 0.6, owner: e, noSnap: true, track: w => { w.x = e.x; w.y = e.y; } });
  AudioMan.charge(0.6); AudioMan.sparkle();
  hint('ser_ronde', _t('ルミナスロンド'), _t('熾天使のまわりを光線がゆっくり回る。光線の間を抜ける'));
}
const rondeA = (r, k) => r.a0 + r.dir * 0.6 * Math.max(0, r.t - 0.6) + TAU / r.n * k;
function updSerRonde(e, ai, dt) {
  const r = ai.ronde; r.t += dt;
  if (r.t < 0.6) return;
  if ((r.tick -= dt) <= 0) {
    r.tick = 0.5;
    for (let k = 0; k < r.n; k++) if (!P.dead && P.invT <= 0 && inLine(e.x, e.y, rondeA(r, k), 300, 8)) { serHurt(e, 0.3); break; }
  }
  if (r.t >= 10.6) ai.ronde = null;
}
// クリスタルサテライト: 熾天使のまわり(半径 100)を回るクリスタル 2(3)個(壊せる物・HP 各 15%)。1.5秒ごとにプレイヤーへ光弾 ×0.4(速さ 110)。壊すまで残る(同時に 3個まで)
function serSatellite(e, ai, have) {
  const n = Math.min(ai.enraged ? 3 : 2, 3 - have), a0 = rand(0, TAU);
  ai.atkT = Math.max(ai.atkT, 0.4);
  for (let k = 0; k < n; k++) {
    const c = spawnObj(e, 'scrystal', e.x, e.y, { pct: 0.15, r: 6, life: 9999, spawnT: 1.5 + k * 0.5 });
    c.orbA = a0 + TAU / n * k; c.x = e.x + Math.cos(c.orbA) * 100; c.y = e.y + Math.sin(c.orbA) * 100;
    fxBeam(c.x, c.y, { foe: true, w: 6, H: 160, col: '#bff4ff', core: '#ffffff', life: 0.4, drop: 0.06 }); burst(c.x, c.y, 14, ['#bff4ff', '#ffffff', '#ffe8a0'], { sp: 70, glow: true, life: 0.4 });
  }
  AudioMan.chime(); AudioMan.summon();
  hint('ser_sat', _t('クリスタルサテライト'), _t('熾天使のまわりを回るクリスタルが光弾を撃つ。壊せる'));
}
// ヘヴンズリフト: 熾天使の頭上(開いた所に残る)に光の裂け目。3秒(激昂 5秒)の間 1秒ごとに、裂け目から地面へ光を差す:
//   真下に円い光(予告 0.5秒。光の通り道を赤く)→ プレイヤーの方向(差した時に決まる)へ一定の速さで傾く。地面の光は円錐を床で切った楕円で、
//   傾くほど遠くへ長く伸び、加速しながら進む(遠い縁が reach に届くと消える)。当たると ×0.6(1つにつき 1回)。最後の光が消えてから裂け目が閉じる
//   h: 裂け目の高さ / tan: 光の開き(半分)の tan(真下を照らすと 円 半径 h·tan)/ w: 傾く速さ(rad/秒)/ aim: 予告 / fade: 光が消える長さ
const SER_RIFT = { h: 56, tan: 0.125, reach: 480, w: 1.1, aim: 0.5, fade: 0.2 }; // 真下で 円 半径 7。遠い縁が 480 に届くまで(約 1.2秒)
const RIFT_AL = Math.atan(SER_RIFT.tan), RIFT_TH = Math.atan(SER_RIFT.reach / SER_RIFT.h) - RIFT_AL, RIFT_SWEEP = RIFT_TH / SER_RIFT.w; // 開き(半分)・光が消える傾き(+開き < 90°)・傾く秒数
// 高さ H の光源から開きの半分 al の円錐の光を、傾き th(真下が 0)で地面へ差したときの地面の光(円錐を床で切った楕円。th + al < 90°):
//   光源の真下から楕円の中心までの距離 c・向きの方の半径 a・横の半径 b・光の芯(円錐の軸)が地面に当たる所 x
//   近い縁 c − a = H·tan(th − al)、遠い縁 c + a = H·tan(th + al)。th = 0 で円(半径 H·tan al)。ヘヴンズリフトとスポットライトで使う
function coneSpot(H, al, th) {
  const s = Math.sin(al), co = Math.cos(al), sn = Math.sin(th), k = co * co - sn * sn;
  return { c: H * sn * Math.cos(th) / k, a: H * s * co / k, b: H * s / Math.sqrt(k), x: H * Math.tan(th) };
}
// 地面の光の中か: 光源の真下 (gx, gy)・向き a の楕円 o に、点 (px, py) の体(半径 m)が触れているか
function inConeSpot(gx, gy, a, o, px, py, m) {
  const c = Math.cos(a), s = Math.sin(a), dx = px - gx, dy = py - gy, u = dx * c + dy * s - o.c, v = dy * c - dx * s;
  return Math.pow(u / (o.a + m), 2) + Math.pow(v / (o.b + m), 2) < 1;
}
// ヘヴンズリフトの傾き th の地面の光(攻撃範囲の倍率 A は高さに掛ける)
function riftSpot(th, A) { return coneSpot(SER_RIFT.h * A, RIFT_AL, th); }
const riftTh = b => clamp((b.t - SER_RIFT.aim) * SER_RIFT.w, 0, RIFT_TH); // 光の傾き
// 光の通り道(傾き 0 から終わりまでの楕円を全部重ねた形): 向きの方の距離 us ごとの片側の幅 vs。予告の形(攻撃範囲の倍率ごとに 1回だけ作る)
//   us は根元ほど細かく取る(根元の円は小さく、遠くの楕円は大きいので)
let riftEnvC = null;
function riftEnv(A) {
  if (riftEnvC && riftEnvC.A === A) return riftEnvC;
  const r0 = SER_RIFT.h * A * SER_RIFT.tan, u1 = SER_RIFT.reach * A, sp = [], us = [], vs = [];
  for (let j = 0; j <= 200; j++) sp.push(riftSpot(RIFT_TH * j / 200, A));
  for (let i = 0; i <= 80; i++) {
    const u = -r0 + (u1 + r0) * Math.pow(i / 80, 2); let v = 0;
    for (const o of sp) { const q = (u - o.c) / o.a; if (q * q < 1) v = Math.max(v, o.b * Math.sqrt(1 - q * q)); }
    us.push(u); vs.push(v);
  }
  return (riftEnvC = { A, us, vs });
}
function serRift(e, ai) {
  const cr = [];
  for (let i = 0; i <= 16; i++) { const th = i % 2; cr.push({ dy: (i % 4 < 2 ? 1 : -1) * rand(0.3, 1.2), up: th ? rand(1, 1.25) : rand(0.35, 0.6), dn: th ? rand(0.35, 0.6) : rand(1, 1.25) }); } // 裂け目の縁の歯(上と下は噛み合う形: 破れた紙のように)
  const tips = [0, 1].map(() => ({ m: [rand(-2, 2), rand(-3, 3), rand(-4, 4)], br: Math.random() < 0.5 ? -1 : 1, bl: rand(4, 7) })); // 両端から伸びるひび(枝 1本)
  ai.rift = { t: 0, dur: ai.enraged ? 5 : 3, x: e.x, y: e.y, beams: [], next: 0.5, cr, tips, tilt: rand(-0.12, 0.12), split: false, close: 0 };
  ai.atkT = Math.max(ai.atkT, 0.5);
  AudioMan.charge(0.5); AudioMan.sparkle();
  hint('ser_rift', _t('ヘヴンズリフト'), _t('空の裂け目から差す光が、傾きながら加速して向かってくる。赤い通り道から横へ出る'));
}
function updSerRift(e, ai, dt) {
  const R = ai.rift, A = CHAOS.area, Q = SER_RIFT, H = Q.h * A;
  R.t += dt;
  if (!R.split && R.t >= 0.15) { // 走ったひびが割れて開く
    R.split = true;
    burst(R.x, R.y - H, 22, [...SER_GOLD, '#ffffff'], { sp: 90, glow: true, life: 0.45 });
    addRing(R.x, R.y - H, 34, '#ffe8a0', { r0: 6, w: 2, life: 0.3 }); addFlash(R.x, R.y - H, 50, '#fff6dc', 0.25);
    AudioMan.zap();
  }
  if (R.t < R.dur && (R.next -= dt) <= 0) {
    R.next = 1;
    const a = Math.atan2(P.y - R.y, P.x - R.x), env = riftEnv(A);
    R.beams.push({ a, t: 0, hit: false, lit: false });
    pushWarn({ kind: 'sweep', x: R.x, y: R.y, a, us: env.us, vs: env.vs, t: 0, life: Q.aim + RIFT_SWEEP, aim: Q.aim, owner: e, noSnap: true }); // 光の通り道(傾き始めるまで赤く満ち、傾いている間は縁だけ残る)
    AudioMan.cue();
  }
  for (const b of R.beams) {
    b.t += dt;
    if (b.t < Q.aim) continue;
    if (!b.lit) { b.lit = true; burst(R.x, R.y, 12, SER_GOLD, { sp: 70, glow: true, life: 0.35 }); addRing(R.x, R.y, 22 * A, '#fff6dc', { r0: 6, life: 0.25 }); AudioMan.cast(); } // 光が強まって傾き始める
    if (b.t >= Q.aim + RIFT_SWEEP) continue; // 消えていく間は当たらない
    const o = riftSpot(riftTh(b), A), c = Math.cos(b.a), s = Math.sin(b.a);
    if (!b.hit && !P.dead && P.invT <= 0 && inConeSpot(R.x, R.y, b.a, o, P.x, P.y, 3)) { b.hit = true; serHurt(e, 0.6); }
    if (Math.random() < dt * 30) { // 照らされた地面から光の粒が昇る
      const q = rand(0, TAU), r = Math.sqrt(Math.random()), lu = o.c + Math.cos(q) * o.a * r, lv = Math.sin(q) * o.b * r;
      part(R.x + c * lu - s * lv, R.y + s * lu + c * lv, rand(-8, 8), -rand(15, 40), 0.5, pick(SER_GOLD), { glow: true, drag: 1.5 });
    }
  }
  R.beams = R.beams.filter(b => b.t < Q.aim + RIFT_SWEEP + Q.fade);
  if (R.t >= R.dur && !R.beams.length && (R.close += dt) >= 0.3) ai.rift = null; // 最後の光が消えてから裂け目が閉じる(0.3秒)
}
// ホーリーヴォルテックス: プレイヤーの位置に小さな光が差す(0.3秒)。そこへ、まわり(110)から小さいホーリー(弾。半径 24)3(4)つが渦を巻きながら 1.5秒で集まる
//   (ふれると ×0.5。1つにつき 1回。通る道すじは淡い点で見える)。集まった所で光が弾ける(円 半径 30・×0.5)
function serVortex(e, ai) {
  const n = ai.enraged ? 4 : 3;
  ai.vortex = { t: 0, cx: P.x, cy: P.y, n, a0: rand(0, TAU), dir: Math.random() < 0.5 ? 1 : -1, hit: new Array(n).fill(false), boom: false };
  ai.atkT = Math.max(ai.atkT, 1.8);
  fxBeam(P.x, P.y, { foe: true, w: 3, H: 220, col: '#ffe8a0', core: '#ffffff', life: 0.5, drop: 0.1 });
  later(ai, 1.3, () => { if (ai.vortex) pushWarn({ kind: 'circle', x: ai.vortex.cx, y: ai.vortex.cy, r: 30, t: 0, life: 0.5, owner: e }); });
  AudioMan.charge(1.8); AudioMan.sparkle();
  hint('ser_vortex', _t('ホーリーヴォルテックス'), _t('小さな光が渦を巻いて集まってくる。光の玉と真ん中をよける'));
}
// 小さいホーリーの位置: 半径 110 から ease-in で縮みながら 3.2rad 回る(render.js も同じ式で描く)
function vortPos(v, k, t) { const u = clamp((t - 0.3) / 1.5, 0, 1), R = 110 * CHAOS.area * (1 - u * u), a = v.a0 + TAU / v.n * k + v.dir * u * 3.2; return [v.cx + Math.cos(a) * R, v.cy + Math.sin(a) * R]; }
function updSerVortex(e, ai, dt) {
  const v = ai.vortex; v.t += dt;
  if (v.t >= 0.3 && v.t < 1.8 && !P.dead && P.invT <= 0) for (let k = 0; k < v.n; k++) {
    if (v.hit[k]) continue;
    const [x, y] = vortPos(v, k, v.t);
    if (d2(x, y, P.x, P.y) < Math.pow(24 * CHAOS.area + 3, 2)) { v.hit[k] = true; serHurt(e, 0.5); }
  }
  if (!v.boom && v.t >= 1.8) {
    v.boom = true; serCircle(e, v.cx, v.cy, 30, 0.5);
    fxRays(v.cx, v.cy, 50 * CHAOS.area, '#ffe8a0', { foe: true, n: 14, core: '#ffffff', life: 0.35, light: 0.4 }); burst(v.cx, v.cy, 26, SER_GOLD, { sp: 110, glow: true, life: 0.45 });
    addRing(v.cx, v.cy, 30 * CHAOS.area, '#ffffff', { r0: 4, w: 2, life: 0.3 }); shake(4); AudioMan.boom(); AudioMan.chime();
  }
  if (v.t >= 2.1) ai.vortex = null;
}
// プリズムシフト: 0.3秒 体が七色に光り、プレイヤーから 160〜200 離れた所へ瞬間移動。着地点に光の残像(半径 70・5秒。中にいると 0.5秒ごとに乱光 +1(激昂 +2)。ダメージはない)
function serShift(e, ai) {
  ai.act = 'shift'; ai.atkT = Math.max(ai.atkT, 0.6); ai.shiftT = S.time;
  AudioMan.charge(0.3);
  later(ai, 0.3, () => {
    if (e.dead) return;
    const x0 = e.x, y0 = e.y, pa = rand(0, TAU), d = rand(160, 200), [nx, ny] = serClamp(P.x + Math.cos(pa) * d, P.y + Math.sin(pa) * d, 40);
    e.x = nx; e.y = ny;
    ai.after = { t: 0, x: nx, y: ny, tick: 0.5 };
    bfx.push({ kind: 'prismtrail', x: x0, y: y0 - e.jz, x1: nx, y1: ny - e.jz, t: 0, life: 0.45 });
    burst(x0, y0 - e.jz, 30, PRISM, { sp: 120, glow: true, life: 0.5 }); burst(nx, ny - e.jz, 30, [...PRISM, '#ffffff'], { sp: 100, glow: true, life: 0.5 });
    addRing(nx, ny, 70 * CHAOS.area, '#ffffff', { r0: 10, w: 2, life: 0.35 }); shockAt(nx, ny, 1, 0.8); AudioMan.chime(); AudioMan.dash();
    ai.act = null;
  });
  hint('ser_shift', _t('プリズムシフト'), _t('離れた所へ瞬間移動して、七色の残像を残す。残像の中にいると乱光'));
}
function updSerAfter(e, ai, dt) {
  const A = ai.after; A.t += dt;
  if (A.t >= 0.3 && (A.tick -= dt) <= 0) { A.tick = 0.5; if (!P.dead && d2(A.x, A.y, P.x, P.y) < Math.pow(70 * CHAOS.area + 3, 2)) randomLight(serLight(e), e.dmg); }
  if (A.t >= 5) ai.after = null;
}
// セラフィムレイ: 0.6秒 帯(長さ 260・幅 14)→ プレイヤーの方向へ光線 ×0.8。撃ったあと、光線の上 8か所から左右へ光の羽根の弾(速さ 0 から 1秒で 200 へ easeInQuart で加速・×0.4)
function serRay(e, ai, a) {
  const x = e.x, y = e.y, A = CHAOS.area;
  ai.act = 'ray'; ai.atkT = Math.max(ai.atkT, 1.0); e.spr = 'seraphCast';
  pushWarn({ kind: 'line', x, y, a, len: 260, w: 14, t: 0, life: 0.6, owner: e });
  serGlint(e, ai, 0.45);
  AudioMan.charge(0.6);
  later(ai, 0.6, () => {
    if (e.dead) return;
    serLine(e, x, y, a, 260, 14, 0.8);
    bfx.push({ kind: 'sray', x, y, a, len: 260 * A, w: 14 * A, t: 0, life: 0.5 });
    for (let k = 1; k <= 8; k++) {
      const d = 260 * A * k / 8.5, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      for (const sd of [-1, 1]) Object.assign(serBall(e, px, py, a + sd * Math.PI / 2, 0, 0.4, 'sfeather'), { easeT: 1, vmax: 200, life: 3, r: 3 * A, dir: a + sd * Math.PI / 2 }); // 止まった所から動き出す(向きは dir)。光線の上にしばらく残り、一気に飛ぶ
    }
    burst(x, y - e.jz, 30, SER_GOLD, { sp: 120, glow: true, life: 0.5 }); shockAt(x, y, 1.2, 0.9); shake(6); screenFlash(0.08, '#fff6dc'); AudioMan.boom(); AudioMan.sparkle();
    ai.act = null; e.spr = 'seraph';
  });
  hint('ser_ray', _t('セラフィムレイ'), _t('光線のあと、光線の上から左右へ羽根の弾が加速しながら飛ぶ'));
}
// プリズムバラージ: プレイヤーから 130 離れた所に光のクリスタル 1個(激昂 2個。2.4秒)。現れて 0.4秒後から 0.5秒ごとに 4回、撃つ前に細い帯(0.25秒)→
//   高速弾を 3方向(±0.25rad・速さ 200・×0.3)
function serBarrage(e, ai) {
  const n = ai.enraged ? 2 : 1, a0 = rand(0, TAU);
  ai.atkT = Math.max(ai.atkT, 0.6);
  for (let k = 0; k < n; k++) {
    const pa = a0 + TAU / n * k, [cx, cy] = serClamp(P.x + Math.cos(pa) * 130, P.y + Math.sin(pa) * 130), c = { aim: 0 };
    bfx.push({ kind: 'bcrystal', x: cx, y: cy, t: 0, life: 2.4 });
    fxBeam(cx, cy, { foe: true, w: 5, H: 150, col: '#bff4ff', core: '#ffffff', life: 0.35, drop: 0.06 });
    for (let v = 0; v < 4; v++) {
      later(ai, 0.15 + v * 0.5, () => { c.aim = Math.atan2(P.y - cy, P.x - cx); pushWarn({ kind: 'line', x: cx, y: cy, a: c.aim, len: 140, w: 4, t: 0, life: 0.25, owner: e }); });
      later(ai, 0.4 + v * 0.5, () => {
        if (e.dead) return;
        for (const da of [-0.25, 0, 0.25]) Object.assign(serBall(e, cx, cy - 4, c.aim + da, 200, 0.3, 'sprism'), { life: 1.2 });
        burst(cx, cy - 4, 8, ['#bff4ff', '#ffffff', ...PRISM.slice(3, 6)], { sp: 70, glow: true, life: 0.25 }); AudioMan.shoot();
      });
    }
  }
  AudioMan.chime();
  hint('ser_barrage', _t('プリズムバラージ'), _t('まわりのクリスタルから速い弾が 3方向に飛ぶ。細い赤い線が撃つ合図'));
}
// トリニティサンクチュアリ(激昂): 巨大クリスタル 3個(壊せる物・HP 各 10%)がプレイヤーのまわり(110〜140)に天から降りる。
//   10秒後、残っている 1個につき熾天使の HP を 8% 回復(光の筋が熾天使へ流れこむ)。壊したクリスタルは壊れた姿でその場に残る(ホワイトアウトの影)。12秒後にホワイトアウト
function serTrinity(e, ai) {
  const a0 = rand(0, TAU);
  ai.atkT = Math.max(ai.atkT, 1.0);
  ai.trin = { t: 0, cs: [], healed: false };
  ai.husks = ai.husks || [];
  for (let k = 0; k < 3; k++) {
    const pa = a0 + TAU / 3 * k, d = rand(110, 140), [x, y] = serClamp(P.x + Math.cos(pa) * d, P.y + Math.sin(pa) * d, 30);
    fxSigil(x, y, 20, '#bff4ff', { foe: true, style: 'rune', n: 6, step: 3, wu: 0.45, life: 0.8, sq: 0.45, spin: 1.4, glow: 0.35, hi: '#ffffff' }); // 床に光の印(降りてくる所)
    const c = spawnObj(e, 'tcrystal', x, y, { pct: 0.1, r: 11, life: 10.4 }); c.dropT = 0.45;
    ai.trin.cs.push(c);
    fxBeam(x, y, { foe: true, w: 16, H: 260, col: '#bff4ff', mid: '#e8fbff', core: '#ffffff', life: 0.7, drop: 0.1 });
    later(ai, 0.45, () => { shockAt(x, y, 1.1, 0.8); shake(5); burst(x, y, 30, ['#bff4ff', '#ffffff', '#ffe8a0'], { sp: 120, up: 30, glow: true, life: 0.5 }); AudioMan.thud(); AudioMan.chime(); });
  }
  later(ai, 12, () => { if (!e.dead && !ai.lr) serWhiteout(e, ai); });
  AudioMan.summon(); AudioMan.warning();
  hint('ser_trinity', _t('トリニティサンクチュアリ'), _t('巨大クリスタルを 10秒で壊さないと熾天使が回復する。壊したクリスタルは、次のホワイトアウトの影になる'));
}
function updSerTrinity(e, ai, dt) {
  const T = ai.trin; T.t += dt;
  if (!T.healed && T.t >= 10) {
    T.healed = true;
    const alive = T.cs.filter(c => !c.dead);
    for (const c of alive) {
      const add = e.maxhp * 0.08; e.hp = Math.min(e.maxhp, e.hp + add); S.hudDirty = true;
      bfx.push({ kind: 'healray', x: c.x, y: c.y - 14, x1: e.x, y1: e.y - e.jz, t: 0, life: 0.6 });
      addFloat(e.x, e.y - e.jz - 30, '+' + Math.round(add), '#5dff8a', 1.2);
      c.dead = true; objDown(c, false);
    }
    if (alive.length) { addRing(e.x, e.y - e.jz, 40, '#5dff8a', { r0: 6, w: 2, life: 0.5 }); AudioMan.heal(); }
  }
  if (T.t >= 10.6) ai.trin = null;
}
// 影の中か(ホワイトアウト): 壊したクリスタル(影の半径 r)ごとに、爆発の中心(熾天使)から見てクリスタルの向きの ±asin(r/d) の中で、クリスタルより遠い所
function serShadowed(ox, oy, husks, x, y) {
  const pa = Math.atan2(y - oy, x - ox), pd = Math.hypot(x - ox, y - oy);
  for (const h of husks) {
    const hd = Math.hypot(h.x - ox, h.y - oy);
    if (hd < 1 || pd < hd - 4) continue;
    if (Math.abs(angDiff(pa, Math.atan2(h.y - oy, h.x - ox))) < Math.asin(Math.min(1, h.r / hd))) return true;
  }
  return false;
}
// ホワイトアウト(激昂・ラストラディアンス): 5秒 溜める → 画面全体を覆う光の爆発を 3秒。0.5秒ごとに ×2.0・乱光 +10。壊したクリスタルの影の中は安全。終わると壊れたクリスタルは消える
//   溜め: 熾天使が高く昇り、翼を大きく広げる。光の輪がいくつも外から熾天使へ集まり(ease-in で最後に一気に)、光輪が大きくなる。1秒ごとに鐘、画面の縁から集中線。
//   影は溜めのうちから少しずつ濃く伸びる(どこへ逃げればいいか見える)。爆発の瞬間は白い閃光・衝撃波・光芒、3秒のあいだ画面が白く染まる(影だけが暗く残る)
function serWhiteout(e, ai) {
  if (serOffScreen(e)) { const [x, y] = serSideSpot(e); serBlink(e, x, y); } // 溜めは熾天使の側で見せるので、画面の外なら横へ現れる
  ai.wo = { t: 0, x: e.x, y: e.y, tick: 0.01, bell: 0, boomed: false };
  ai.act = 'wo'; ai.atkT = Math.max(ai.atkT, 8.2); e.spr = 'seraphCast';
  fxFocus(e.x, e.y - 30, 5, '#fff6dc', { foe: true, n: 40 });
  AudioMan.hum(5); AudioMan.warning();
  hint('ser_whiteout', _t('ホワイトアウト'), _t('画面全体が光に包まれる。壊したクリスタルの影(熾天使の反対側)に隠れる'));
}
function updSerWhiteout(e, ai, dt) {
  const W = ai.wo; W.t += dt;
  if (W.t < 5) { // 溜め
    W.x = e.x; W.y = e.y;
    if (W.t >= W.bell) { W.bell += 1; AudioMan.knell(); shake(1 + W.bell); addRing(e.x, e.y - e.jz, 60 + W.bell * 10, '#ffe8a0', { r0: 200, w: 2, life: 0.6 }); } // 鐘ごとに光の輪が外から集まる
    if (Math.random() < dt * 60) { const pa = rand(0, TAU), pr = rand(60, 160); part(e.x + Math.cos(pa) * pr, e.y - e.jz + Math.sin(pa) * pr * 0.7, -Math.cos(pa) * pr * 1.6, -Math.sin(pa) * pr * 1.2, 0.6, pick(SER_GOLD), { glow: true, drag: 0 }); }
    if (W.t >= 4.85 && !W.glint) { W.glint = true; fxGlint(e.x, e.y - e.jz - 36, 14, '#ff3b5c', { foe: true, life: 0.25 }); AudioMan.cue(); }
    return;
  }
  if (!W.boomed) { // 爆発
    W.boomed = true;
    screenFlash(1, '#ffffff'); hitstop(0.08, true); shake(18);
    shockAt(W.x, W.y, 3.2, 0.5); later(ai, 0.25, () => shockAt(W.x, W.y, 2.4, 0.7)); later(ai, 0.5, () => shockAt(W.x, W.y, 1.6, 0.9));
    fxRays(W.x, W.y - e.jz, 320, '#ffe8a0', { foe: true, n: 36, core: '#ffffff', life: 1.2, light: 0.6 });
    for (let k = 0; k < 4; k++) addRing(W.x, W.y, 120 + k * 90, k % 2 ? '#ffffff' : '#ffe8a0', { r0: 20, w: 3, life: 0.6 + k * 0.15 });
    GFX.fx.aberr = Math.max(GFX.fx.aberr, 1.2);
    AudioMan.boom(); AudioMan.impact(); AudioMan.rumble(); AudioMan.crush();
    eprojs.length = 0; warns.length = 0; ai.ronde = ai.rift = ai.vortex = ai.after = null; // 光がほかの攻撃を呑みこむ(画面が白く覆われる間に見えない攻撃を残さない)
  }
  if (W.t < 8) {
    GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.5);
    if (Math.random() < dt * 80) { const pa = rand(0, TAU); part(W.x + Math.cos(pa) * 20, W.y - e.jz + Math.sin(pa) * 20, Math.cos(pa) * rand(200, 420), Math.sin(pa) * rand(200, 420), 0.7, pick(SER_GOLD), { glow: true, drag: 0.3, sz: pick([1, 2]) }); } // 外へ吹き出す光の嵐
    if ((W.tick -= dt) <= 0) {
      W.tick = 0.5; shake(4); // 光の脈(0.5秒ごと)
      if (!P.dead && P.invT <= 0 && !serShadowed(W.x, W.y, ai.husks || [], P.x, P.y) && hurtPlayer(e.dmg * 2, PIERCE)) randomLight(10, e.dmg);
    }
    return;
  }
  // 終わり: 壊れたクリスタルは光に溶けて消える
  for (const h of ai.husks || []) { burst(h.x, h.y - 6, 24, ['#bff4ff', '#ffffff', '#ffe8a0'], { sp: 90, up: 30, glow: true, life: 0.6 }); addRing(h.x, h.y, 16, '#ffffff', { life: 0.3 }); }
  ai.husks = [];
  ai.wo = null; if (!ai.lr) { ai.act = null; e.spr = 'seraph'; }
  AudioMan.chime();
}
// ラストラディアンス: 残り HP 1% で(1% より下がらない)最後の技。プレイヤーに攻撃不能を 20秒。熾天使は天高く昇り、今までの技を次々に出す。
//   はじめに壊れたクリスタルが 1個降ってくる(ホワイトアウトの影。プレイヤーの近く)。10秒で ホワイトアウトの溜め(5秒)、15秒で爆発(3秒)。
//   爆発が終わると曲がフェードアウトし、熾天使は衣と光を失って、倒れるまでその場に立ち尽くす
//   始まりに、ほかの敵は光に呑まれて消え(倒した扱いにしない)、熾天使が倒れるまで敵は出ない(updSpawner の serLROn)
function startSerLR(e, ai) {
  { const [x, y] = serSideSpot(e); serBlink(e, x, y); } // プレイヤーの横へ現れる(最後の技を画面の中で見せる)
  ai.lr = { t: 0, next: 0.6, still: false, wo: false }; // 技は 2秒から(始まりの光と封印を見せてから)
  ai.act = 'lr'; e.spr = 'seraphCast';
  ai.ronde = ai.rift = ai.vortex = ai.after = ai.trin = null; eprojs.length = 0; warns.length = 0;
  for (const o of enemies) if (!o.dead && o.owner === e && o.obj) { o.dead = true; objDown(o, false); }
  // ほかの敵(雑魚・エリート・ゴブリン・砂山)は光に呑まれて消える: 経験値・撃破数・宝箱なし。ボス(双王の相方)と、生きているボスが出した物・篝火は残す
  for (const o of enemies) if (!o.dead && !o.boss && !o.prop && !(o.owner && !o.owner.dead)) {
    o.dead = true;
    if (onScreen(o.x, o.y)) burst(o.x, o.y - 4, 6, ['#fff6dc', '#ffe8a0', '#ffffff'], { sp: 50, up: 30, glow: true, life: 0.5 });
  }
  ai.husks = [];
  lockPlayer(20);
  hitstop(0.25, true); slowmo(0.25, 1.4, true); screenFlash(0.7, '#ffffff'); shake(14);
  shockAt(e.x, e.y, 3.4, 0.45); later(ai, 0.3, () => shockAt(e.x, e.y, 2.6, 0.7));
  fxBeam(e.x, e.y, { foe: true, w: 46, H: 320, col: '#ffe8a0', mid: '#fff6dc', core: '#ffffff', life: 1.4, drop: 0.12 });
  fxSigil(e.x, e.y, 110, '#ffe8a0', { foe: true, style: 'rune', n: 12, step: 5, wu: 1.2, life: 2.2, sq: 0.45, spin: 0.6, glow: 0.4, hi: '#ffffff' });
  burst(e.x, e.y - e.jz, 120, [...SER_GOLD, ...PRISM], { sp: 260, up: 40, glow: true, life: 1.4 });
  for (let k = 0; k < 5; k++) addRing(e.x, e.y, 60 + k * 70, k % 2 ? '#ffffff' : '#ffe8a0', { r0: 10, w: 3, life: 0.7 + k * 0.15 });
  AudioMan.evolve(); AudioMan.knell(); AudioMan.warning();
  later(ai, 0.9, () => { // 壊れたクリスタルが 1個降ってくる: プレイヤーから 80 の所、熾天使と反対の側へ寄せて(影はクリスタルの向こうへ伸びる)
    if (e.dead) return;
    const away = Math.atan2(P.y - e.y, P.x - e.x) + (Math.random() < 0.5 ? 0.9 : -0.9), [hx, hy] = serClamp(P.x + Math.cos(away) * 80, P.y + Math.sin(away) * 80, 30);
    ai.husks.push({ x: hx, y: hy, r: 15 });
    fxBeam(hx, hy, { foe: true, w: 14, H: 260, col: '#bff4ff', core: '#ffffff', life: 0.6, drop: 0.1 });
    burst(hx, hy, 40, ['#bff4ff', '#ffffff', '#ffe8a0'], { sp: 140, up: 40, glow: true, life: 0.6 }); shockAt(hx, hy, 1.2, 0.8); shake(6); AudioMan.crush(); AudioMan.chime();
  });
  hint('ser_lr', _t('ラストラディアンス'), _t('最後の光。攻撃できない。技をよけきり、ホワイトアウトはクリスタルの影でしのぐ'));
}
function updSerLR(e, ai, dt) {
  const L = ai.lr; L.t += dt;
  if (L.still) { // 立ち尽くす: 光の粒が静かに昇って消えていく
    if (Math.random() < dt * 5) part(e.x + rand(-10, 10), e.y - e.jz + rand(-14, 10), rand(-3, 3), -rand(6, 14), 1.2, pick(['#fff6dc', '#c8c0a8', '#ffffff']), { glow: Math.random() < 0.3, drag: 0.5 });
    return;
  }
  if (Math.random() < dt * 30) { const pa = rand(0, TAU), pr = rand(20, 40); part(e.x + Math.cos(pa) * pr, e.y - e.jz + Math.sin(pa) * pr, rand(-10, 10), -rand(30, 60), 0.7, pick([...SER_GOLD, ...PRISM]), { glow: true, drag: 1 }); } // 光をまとう
  if (L.t < 10) { // 技を出す間は、プレイヤーの横へゆっくり寄る(離れすぎたら瞬間移動)。ホワイトアウトの溜めからは動かない(影の向きが変わらないように)
    const [tx, ty] = serSideSpot(e), d = Math.hypot(tx - e.x, ty - e.y);
    if (d > 220) serBlink(e, tx, ty); else if (d > 3) { const k = Math.min(1, e.spd * 2 * dt / d); e.x += (tx - e.x) * k; e.y += (ty - e.y) * k; }
  }
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  if (L.t >= 1.4 && L.t < 10 && (L.next -= dt) <= 0) { // 今までの技を次々に(ホワイトアウトの溜めが始まるまで)
    L.next = rand(1.2, 1.6);
    const k = Math.floor(rand(0, 5));
    if (k === 0) serRay(e, ai, a); else if (k === 1) serHoly(e, ai); else if (k === 2) serVortex(e, ai); else if (k === 3) serBarrage(e, ai); else if (!ai.rift) serRift(e, ai); else serRay(e, ai, a);
    ai.act = 'lr'; // 技の later が戻しても、ラストラディアンスの間は動かない
  }
  if (L.t >= 10 && !L.wo) { L.wo = true; serWhiteout(e, ai); }
  if (L.t >= 18.2) { // 爆発が終わった: 曲がフェードアウトし、衣と光を失って立ち尽くす
    L.still = true; e.hpFloor = 0; e.spr = 'seraphStill'; ai.ronde = ai.rift = ai.vortex = ai.after = null;
    AudioMan.stopMusic(2.5);
    burst(e.x, e.y - e.jz, 60, ['#fff6dc', '#ffe8a0', '#ffffff', '#c8c0a8'], { sp: 120, up: 20, glow: true, life: 1.2 }); // 光の衣が砕けて散る
    for (let i = 0; i < 18; i++) { const pa = TAU / 18 * i; part(e.x + Math.cos(pa) * 14, e.y - e.jz + Math.sin(pa) * 16, Math.cos(pa) * 60, Math.sin(pa) * 60 - 20, 1.0, '#e8f4ff', { glow: true, drag: 1.2, sz: 2 }); }
    addRing(e.x, e.y - e.jz, 50, '#e8f4ff', { r0: 14, w: 2, life: 0.8 }); AudioMan.crush(); AudioMan.chime();
  }
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// ---------- 熾天使(天光の聖堂 2体目)の見た目 ----------
// 翼・光輪の広がりと光の強さ: 0 = ふだん / 1 = 技 / 1〜2 = ホワイトアウトの溜め(だんだん)/ 2 = 爆発 / 1.6 = ラストラディアンス / -1 = 立ち尽くす
function serPow(e) {
  const ai = e.ai, W = ai.wo, L = ai.lr;
  if (L && L.still) return -1;
  let p = ai.spread || 0;
  if (L) p = Math.max(p, 1.6);
  if (W) p = Math.max(p, W.t < 5 ? 1 + Math.pow(W.t / 5, 2) : W.t < 8 ? 2 : 1);
  return p;
}
// 熾天使のうしろ側(体より先に描く): 天へ昇る光の柱(ホワイトアウトの溜め・ラストラディアンス)・回る光芒・6枚の翼
//   翼は上・中・下の 3対。羽根 1枚 = 付け根から先への線(暗い縁 → 白い羽根 → 金の先)。ふだんはゆるく羽ばたき、技の間は広げる。
//   ホワイトアウト・ラストラディアンスでは大きく広げて光り、ラストラディアンスの間は羽根の先が七色に移ろう。立ち尽くすと垂れて、色と光を失う
const SER_WINGS = [ // 付け根の高さ(体の中心から)/ 角度の範囲(右の翼。0 = 右・負 = 上)/ 長さ / 羽根の数。奥から順に(中の翼がいちばん手前で大きい)
  { dy: -7, a0: -1.85, a1: -1.05, L: 20, n: 6 },
  { dy: 2, a0: 0.25, a1: 0.8, L: 16, n: 5 },
  { dy: -3, a0: -0.8, a1: -0.1, L: 28, n: 7 },
];
// 羽根 1枚の形(画面の座標): 付け根 [rx, ry] → 先 [tx, ty]。open: 広げ方 / flap: 羽ばたき / fold: 垂れ方(立ち尽くす)
function serFeather(Wg, i, sd, cx, cy, open, flap, fold) {
  const v = Wg.n > 1 ? i / (Wg.n - 1) : 0.5, lenK = (1 + 0.18 * open) * (1 - 0.12 * fold);
  const a = lerp(Wg.a0 - 0.18 * open, Wg.a1 + 0.1 * open, v) - 0.12 * open + flap + 0.6 * fold; // 広げる: 扇が開いて持ち上がる / 立ち尽くす: 垂れる
  const len = Wg.L * lenK * (0.72 + 0.28 * Math.sin(Math.PI * (0.25 + 0.75 * v)));
  const rx = cx + sd * 3, ry = cy + Wg.dy, ca = Math.cos(a) * sd, sa = Math.sin(a);
  return [rx, ry, rx + ca * len, ry + sa * len, ca, sa, len];
}
function drawSerBack(e, sp, yo) {
  const sx = GFX.sctx, gx = GFX.gctx, t = GFX.fx.time, ai = e.ai, L = ai.lr, W = ai.wo, still = !!(L && L.still), shade = !!e.shadow;
  const cx = e.x - cam.x, cy = e.y + yo - cam.y, p = serPow(e);
  // 天へ昇る光の柱: ホワイトアウトの溜め(細い → 太い。最後は一気に)/ ラストラディアンス(七色の縁で揺らぐ)
  const wc = W && W.t < 5 ? W.t / 5 : 0, lr = L && !still && !(W && W.t >= 5 && W.t < 8);
  if (!shade && (wc > 0 || lr)) {
    const ez = wc * wc * wc, PW = Math.round(lr ? 5 + Math.sin(t * 7) * 1.5 + 8 * ez : 2 + 12 * ez), top = Math.round(cy - 4), bx = Math.round(cx);
    sx.globalAlpha = 0.22 + 0.3 * Math.max(wc, lr ? 0.5 : 0); sx.fillStyle = '#fff6dc'; sx.fillRect(bx - PW, 0, PW * 2 + 1, top);
    sx.globalAlpha = 0.7; sx.fillStyle = '#ffffff'; sx.fillRect(bx - Math.round(PW * 0.3), 0, Math.max(1, Math.round(PW * 0.6)), top);
    if (lr) for (let y = 0; y < top; y += 2) { sx.globalAlpha = 0.8; sx.fillStyle = PRISM[(Math.floor(y / 6 + t * 10)) % 7]; sx.fillRect(bx - PW - 1, y, 1, 2); sx.fillStyle = PRISM[(Math.floor(y / 6 + t * 10) + 3) % 7]; sx.fillRect(bx + PW + 1, y, 1, 2); }
    sx.globalAlpha = 1; gx.fillStyle = dimCol('#fff2b0', 0.22 + 0.3 * Math.max(wc, lr ? 0.4 : 0)); gx.fillRect(bx - Math.round(PW * 0.4), 0, Math.max(1, Math.round(PW * 0.8)), top);
    for (let y = top - 30; y > -10; y -= 60) addLight(e.x, y + cam.y, 50 + 40 * wc, '#fff2b0', 0.35 + 0.3 * wc);
    // 回る光芒: 熾天使から画面の外へ伸びる長い光の筋
    const NR = 16, rot = t * 0.35 + ez * 2.5, wv = 0.018 + 0.025 * wc, oy = cy - 2;
    sx.fillStyle = '#fff2c8';
    for (let i = 0; i < NR; i++) {
      const a = rot + TAU / NR * i;
      sx.globalAlpha = (0.04 + 0.13 * Math.max(wc, lr ? 0.4 : 0)) * (i % 2 ? 0.55 : 1);
      sx.beginPath(); sx.moveTo(cx, oy); sx.lineTo(cx + Math.cos(a - wv) * 520, oy + Math.sin(a - wv) * 520); sx.lineTo(cx + Math.cos(a + wv) * 520, oy + Math.sin(a + wv) * 520); sx.closePath(); sx.fill();
    }
    sx.globalAlpha = 1;
  }
  // 6枚の翼
  const fold = still ? Math.min(1, (L.t - 18.2) / 1.5) : 0, open = Math.max(0, p);
  const flap = still ? Math.sin(t * 0.8) * 0.02 : Math.sin(t * (2.2 + open * 1.2) + e.seed * 6) * (0.05 + 0.03 * open);
  const OUT = shade ? '#06030c' : still ? '#3a342c' : '#5a4626', F1 = shade ? '#2a1240' : still ? '#c8c4bc' : '#ece8ee', F2 = shade ? '#1a0a2a' : still ? '#b0aca4' : '#d4d0e2'; // 白い羽根は明るい床で白く飛ぶので、少しくすませる
  const glowK = shade || still ? 0 : 0.05 + 0.08 * open, rainbow = !shade && L && !still;
  for (const Wg of SER_WINGS) for (let pass = 0; pass < 3; pass++) for (const sd of [-1, 1]) for (let i = 0; i < Wg.n; i++) {
    const [rx, ry, tx, ty, ca, sa, len] = serFeather(Wg, i, sd, cx, cy, open, flap, fold);
    if (pass === 0) pLine(sx, rx, ry, tx, ty, OUT, 4);
    else if (pass === 1) { pLine(sx, rx, ry, tx, ty, i % 2 ? F1 : F2, 2); pLine(sx, rx, ry, rx + ca * len * 0.5, ry + sa * len * 0.5, F1, 3); }
    else {
      const tip = shade ? '#a66bff' : still ? '#9a9080' : rainbow ? PRISM[(i + Math.floor(t * 8)) % 7] : '#f4dc94';
      pLine(sx, rx + ca * len * 0.88, ry + sa * len * 0.88, tx, ty, tip, 2); // 羽根の先(淡い金)
      if (!still) { sx.fillStyle = shade ? '#e8c8ff' : '#ffffff'; sx.fillRect(Math.round(tx), Math.round(ty), 1, 1); }
      if (glowK > 0) pLine(gx, rx + ca * len * 0.45, ry + sa * len * 0.45, tx, ty, dimCol(rainbow ? '#e8d8ff' : '#ffe8a0', glowK), 1);
      if (i === Wg.n - 1 && Math.random() < (still ? 0.004 : 0.02 + 0.05 * open)) // 翼の先からこぼれる光(立ち尽くすと羽根が抜け落ちる)
        part(tx + cam.x, ty + cam.y, rand(-6, 6), still ? rand(6, 14) : rand(-10, 4), still ? 1.6 : 0.7, still ? pick(['#e8e4dc', '#c8c4bc']) : rainbow ? pick(PRISM) : pick(SER_GOLD), { glow: !still, drag: 1.2 });
    }
  }
  if (!shade && !still && open > 0.5) for (const sd of [-1, 1]) addLight(e.x + sd * 20, e.y + yo - 6, 24 + 16 * open, '#ffe8a0', 0.1 + 0.1 * open);
}
// 熾天使の手前側: 光の衣(体を包む白金の膜・回る光沢。状態異常 1種ごとにひび)・衣の強さの印(頭上の 5つの結晶)・プリズムシフトの構え・光輪
//   続く技: ルミナスロンドの光線 / ヘヴンズリフトの裂け目と差す光 / ホーリーヴォルテックスの光の玉 / ホワイトアウトの溜め
function drawSerFx(e, sx, gx, ex, ey, yo) {
  const ai = e.ai, t = GFX.fx.time, A = CHAOS.area, L = ai.lr, still = !!(L && L.still), W = ai.wo, shade = !!e.shadow, p = serPow(e);
  const cx = Math.round(ex), cy = Math.round(ey + yo), top = cy - 19, g = Math.max(0, Math.min(1, p - 1));
  // ---- 光の衣: 体を包む白金の光の膜(回る光沢)。状態異常 1種ごとに膜にひびが入り(5種で砕けて消える)、技の間はほどける。防いだ瞬間は白く波打つ ----
  const ra0 = still ? 0 : ai.robeA ?? 1, n = Math.min(5, ai.statN || 0), ra = n >= 5 ? 0 : ra0 * (1 - 0.12 * n), hit = e.flash > 0 && (e.robeK ?? 1) < 1 ? 1 : 0;
  if (ra > 0.03) {
    const RX = 19, RY = 24, oy = cy + 1, m = 120, sheen = (t * 0.35) % 1, cracks = [];
    for (let k = 0; k < n; k++) cracks.push(-1.25 + k * 1.37); // ひびの向き(1種ごとに 1本)
    sx.globalAlpha = (0.05 + 0.12 * hit) * ra; sx.fillStyle = shade ? '#3a1a5a' : '#fff8ec'; sx.beginPath(); sx.ellipse(cx, oy, RX, RY, 0, 0, TAU); sx.fill();
    for (let i = 0; i < m; i++) {
      const a = TAU * i / m;
      if (cracks.some(c => Math.abs(angDiff(a, c)) < 0.07)) continue; // ひびの所は膜が切れる
      const wob = 1 + 0.025 * Math.sin(a * 5 + t * 3), x = Math.round(cx + Math.cos(a) * RX * wob), y = Math.round(oy + Math.sin(a) * RY * wob);
      const u = ((a / TAU - sheen) % 1 + 1) % 1, sh = u < 0.12 ? 1 - u / 0.12 : 0; // 回る光沢
      sx.globalAlpha = Math.min(1, ra * (0.35 + 0.6 * sh + 0.6 * hit)); sx.fillStyle = shade ? '#a66bff' : sh > 0.5 || hit ? '#ffffff' : i % 3 ? '#fff2c8' : '#ffd77a';
      sx.fillRect(x, y, 1, 1);
      if (sh > 0.3 && !shade) { gx.fillStyle = dimCol('#fff2c8', 0.35 * ra * sh); gx.fillRect(x, y, 1, 1); }
    }
    for (const c of cracks) { // ひび: 膜を横切るぎざぎざの線(暗い紫と、縁の白い光)
      let px0 = cx + Math.cos(c) * RX * 0.78, py0 = oy + Math.sin(c) * RY * 0.78;
      for (let j = 1; j <= 4; j++) {
        const rr = 0.78 + j * 0.1, aj = c + (j % 2 ? 0.09 : -0.07), x = cx + Math.cos(aj) * RX * rr, y = oy + Math.sin(aj) * RY * rr;
        sx.globalAlpha = Math.min(1, ra0 * 0.95); pLine(sx, px0, py0, x, y, shade ? '#1a0a2a' : '#6a4a7a');
        sx.globalAlpha = Math.min(1, ra0 * 0.6); sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(x) + 1, Math.round(y), 1, 1);
        px0 = x; py0 = y;
      }
    }
    if (hit) { sx.globalAlpha = 0.6 * ra0; ellBoth(sx, gx, cx, oy, RX + 3, RY + 3, '#ffffff', 0.6 * ra0, dimCol('#fff6dc', 0.4)); } // 防いだ: 膜が白く波打つ
    sx.globalAlpha = 1;
  }
  if (ai.act === 'shift' && !shade) { // プリズムシフトの構え(0.3秒): 体が七色に光る
    const k = clamp((S.time - (ai.shiftT || S.time)) / 0.3, 0, 1), sp = ART.S[e.spr || 'seraph'];
    sx.globalAlpha = 0.3 + 0.35 * k; sx.drawImage(ART.tint(sp.c, PRISM[Math.floor(t * 24) % 7]), Math.round(cx - sp.w / 2), Math.round(cy - sp.h / 2)); sx.globalAlpha = 1; // 体に七色が移ろう(光の層は弱く。強いと白く飛んで色が見えない)
    gx.globalAlpha = 1; gx.drawImage(ART.tint(sp.c, dimCol(PRISM[Math.floor(t * 24) % 7], 0.08 + 0.12 * k)), Math.round(cx - sp.w / 2), Math.round(cy - sp.h / 2));
    if (Math.random() < 0.6) part(e.x + rand(-12, 12), e.y - e.jz + rand(-16, 14), rand(-30, 30), rand(-30, 30), 0.35, pick(PRISM), { glow: true, drag: 2 });
    addLight(e.x, e.y - e.jz, 50 + 40 * k, PRISM[Math.floor(t * 12) % 7], 0.3 + 0.2 * k);
  }
  if (ra0 > 0.1) for (let i = 0; i < 5; i++) { // 衣の強さ: 5つの結晶(状態異常 1種につき右から 1つ割れる)
    const x = cx + (i - 2) * 5, y = top - 13 - Math.round(g * 2) + Math.abs(i - 2), broken = i >= 5 - n;
    sx.globalAlpha = ra0; sx.fillStyle = broken ? '#3a2a48' : shade ? '#7a3ab0' : '#7ad7ff';
    sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3);
    sx.fillStyle = broken ? '#ff5d73' : '#ffffff'; sx.fillRect(x, y, 1, 1);
    if (!broken && !shade) { gx.fillStyle = dimCol('#bff4ff', 0.5 * ra0); gx.fillRect(x, y, 1, 1); }
  }
  sx.globalAlpha = 1;
  // ---- 光輪 ----
  const hy = top - 6 - Math.round(g * 2); // 光輪は頭から離して浮かべる(髪の金と重ならないように)
  if (still) ellBoth(sx, gx, cx, hy + 1, 7, 2, '#8a8070', 0.75, null, 5, 0.4); // 光を失った光輪: 欠けて暗い
  else {
    const hr = 7 + 4 * g + (W && W.t < 5 ? 5 * Math.pow(W.t / 5, 2) : 0), hry = 2 + g, HC = shade ? '#a66bff' : '#ffe8a0';
    ellBoth(sx, gx, cx, hy, hr, hry, HC, 1, shade ? '#3a1a5a' : dimCol('#ffd23f', 0.45 + 0.35 * g));
    ellBoth(sx, null, cx, hy, Math.max(1, hr - 1), hry, shade ? '#e8c8ff' : '#fff6dc', 0.55, null);
    for (let k = 0; k < 3; k++) { const a = t * (2 + 3 * g) + TAU / 3 * k; sx.fillStyle = '#ffffff'; sx.fillRect(Math.round(cx + Math.cos(a) * hr), Math.round(hy + Math.sin(a) * hry), 1, 1); }
    if (g > 0.3 && !shade) ellBoth(sx, gx, cx, hy - 1, hr + 5 + 2 * Math.sin(t * 3), hry + 1.5, '#ffd23f', 0.55 * g, dimCol('#ffd23f', 0.3 * g), 10, -t * 1.5); // 2つ目の光輪(破線が逆に回る)
    sx.globalAlpha = 1;
    if (!shade) addLight(e.x, e.y + yo - 21, 22 + 22 * g, '#fff2b0', 0.25 + 0.25 * g);
  }
  // ---- ルミナスロンド: 足もとから伸びる光線(金の縁・白い芯)。光の粒が先へ流れる ----
  if (ai.ronde) {
    const r = ai.ronde, k = clamp((r.t - 0.6) / 0.15, 0, 1) * clamp((10.6 - r.t) / 0.3, 0, 1);
    if (k > 0) {
      const BL = 300 * A, BW = 8 * A, x0 = e.x - cam.x, y0 = e.y - cam.y, fl = Math.floor(t * 30) % 2;
      for (let j = 0; j < r.n; j++) {
        const a = rondeA(r, j), c = Math.cos(a), s = Math.sin(a), x1 = x0 + c * BL, y1 = y0 + s * BL;
        pLine(gx, x0, y0, x1, y1, dimCol('#c8a050', 0.5 * k), Math.round(BW + fl));
        sx.globalAlpha = 0.55 * k; pLine(sx, x0, y0, x1, y1, '#ffd23f', Math.round(BW));
        sx.globalAlpha = 0.9 * k; pLine(sx, x0, y0, x1, y1, '#fff6c8', Math.max(1, Math.round(BW - 3)));
        sx.globalAlpha = k; pLine(sx, x0, y0, x1, y1, '#ffffff', Math.max(1, Math.round(BW - 6)));
        sx.fillStyle = '#ffffff';
        for (let d = (t * 90 + j * 13) % 18; d < BL; d += 18) sx.fillRect(Math.round(x0 + c * d) - 1, Math.round(y0 + s * d) - 1, 2, 2); // 先へ流れる光の粒
        pDisc(sx, x1, y1, 2 + fl, '#ffffff'); pDisc(gx, x1, y1, 3, dimCol('#ffe8a0', 0.6 * k)); // 先の光
        for (let d = 20; d < BL; d += 40) addLight(e.x + c * d, e.y + s * d, 34, '#fff2b8', 0.3 * k);
      }
      sx.globalAlpha = 1;
    }
  }
  // ---- ヘヴンズリフト: 裂け目から差す光(空中の円錐)と地面の光の縁。光は裂け目から出るので、裂け目は光の上に描く(地面の光は drawSerGround) ----
  if (ai.rift) {
    for (const b of ai.rift.beams) drawRiftShaft(ai.rift, b, sx, gx, t);
    drawSerRift(ai.rift, sx, gx, t);
  }
  // ---- ホーリーヴォルテックス: 渦を巻いて集まる光の玉(赤い縁は敵の攻撃の印)。通る道すじは淡い点。集まる所は光が強まる ----
  if (ai.vortex && ai.vortex.t < 1.8) {
    const v = ai.vortex, ccx = v.cx - cam.x, ccy = v.cy - cam.y, u = clamp((v.t - 0.3) / 1.5, 0, 1), cu = u * u, app = clamp(v.t / 0.3, 0, 1);
    sx.fillStyle = '#ffe8a0';
    for (let k = 0; k < v.n; k++) {
      if (v.hit[k]) continue;
      for (let tt = Math.max(v.t, 0.3) + 0.05; tt < 1.8; tt += 0.05) { const [x, y] = vortPos(v, k, tt); sx.globalAlpha = 0.4; sx.fillRect(Math.round(x - cam.x), Math.round(y - cam.y), 1, 1); }
    }
    for (let k = 0; k < v.n; k++) {
      if (v.hit[k]) continue;
      const [x, y] = vortPos(v, k, Math.max(v.t, 0.3)), X = x - cam.x, Y = y - cam.y, Rr = Math.max(2, Math.round(24 * A * app));
      for (let j = 1; j <= 4; j++) { const [qx, qy] = vortPos(v, k, Math.max(0.3, v.t - j * 0.04)); sx.globalAlpha = 0.25 * (1 - j / 5); pDisc(sx, qx - cam.x, qy - cam.y, Math.max(1, Rr - j * 2), '#ffe8a0'); } // 尾
      sx.globalAlpha = 0.9; pCircle(sx, X, Y, Rr + 1, '#ff3b5c');
      sx.globalAlpha = 0.35; pDisc(sx, X, Y, Rr, '#ffe8a0');
      sx.globalAlpha = 0.85; pDisc(sx, X, Y, Math.round(Rr * 0.55), '#fff6dc');
      sx.globalAlpha = 1; pDisc(sx, X, Y, Math.max(1, Math.round(Rr * 0.25)), '#ffffff');
      const cr = Math.round(Rr * 0.9 + Math.sin(t * 20 + k) * 2); pLine(sx, X - cr, Y, X + cr, Y, '#ffffff'); pLine(sx, X, Y - cr, X, Y + cr, '#ffffff'); // 十字の光
      pDisc(gx, X, Y, Math.round(Rr * 0.6), dimCol('#ffe8a0', 0.4)); pCircle(gx, X, Y, Rr + 1, '#5a1020');
      addLight(x, y, Rr * 3, '#fff2b8', 0.55);
    }
    sx.globalAlpha = 1;
    pDisc(sx, ccx, ccy, Math.round(1 + 4 * cu), '#ffffff'); pDisc(gx, ccx, ccy, Math.round(2 + 5 * cu), dimCol('#ffe8a0', 0.3 + 0.5 * cu));
    ellBoth(sx, gx, ccx, ccy, 30 * A * (1 - cu * 0.6), 12 * A * (1 - cu * 0.6), '#ffe8a0', 0.55, dimCol('#ffe8a0', 0.3), 12, t * 3 * v.dir);
    sx.globalAlpha = 1;
    addLight(v.cx, v.cy, 30 + 50 * cu, '#fff2b8', 0.4 + 0.4 * cu);
  }
  // ---- ホワイトアウトの溜め: 外から集まる光の輪(だんだん速く)・大きくなる胸の光・十字の閃き。影の外の全部が危ないことを赤く(影の扇は穴) ----
  if (W && W.t < 5 && !shade) {
    const u = W.t / 5, ez = u * u * u, scx = e.x - cam.x, scy = cy - 2;
    for (let k = 0; k < 4; k++) {
      const ph = (W.t * (0.5 + 1.6 * u) + k / 4) % 1, rr = 230 * (1 - ph) * (1 - ph) + 6;
      ellBoth(sx, gx, scx, scy, rr, rr * 0.72, '#ffe8a0', 0.2 + 0.55 * ph, dimCol('#ffe8a0', 0.1 + 0.3 * ph), 0, 0);
    }
    sx.globalAlpha = 1;
    const orb = 2 + 6 * ez + Math.sin(t * 25) * (0.5 + u), fl = Math.round(6 + 34 * ez);
    pDisc(sx, scx, scy, Math.round(orb), '#ffffff'); pDisc(gx, scx, scy, Math.round(orb + 2), dimCol('#fff6dc', 0.5 + 0.5 * u));
    pLine(sx, scx - fl, scy, scx + fl, scy, '#ffffff'); pLine(sx, scx, scy - Math.round(fl * 0.7), scx, scy + Math.round(fl * 0.7), '#ffffff');
    pLine(gx, scx - fl, scy, scx + fl, scy, dimCol('#fff6dc', 0.6)); pLine(gx, scx, scy - Math.round(fl * 0.7), scx, scy + Math.round(fl * 0.7), dimCol('#fff6dc', 0.6));
    addLight(e.x, e.y - e.jz, 80 + 170 * ez, '#fff2b0', 0.5 + 0.5 * u);
    const c = serCanvas(), VW = GFX.VW, VH = GFX.VH, O = { x: W.x, y: W.y }, hs = ai.husks || [];
    if (!(P.darkT > 0)) { // 暗闇(乱光)の間は予告が見えない(王墓と同じ)
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, VW, VH); c.fillStyle = '#ff3b5c'; c.fillRect(0, 0, VW, VH);
    c.globalCompositeOperation = 'destination-out'; for (const h of hs) if (serWedge(c, O, h)) c.fill(); c.globalCompositeOperation = 'source-over';
    sx.globalAlpha = 0.05 + 0.15 * u + (u > 0.8 && Math.floor(t * 8) % 2 ? 0.07 : 0); sx.drawImage(serCan, 0, 0); sx.globalAlpha = 1;
    for (const h of hs) serWedgeEdge(sx, gx, O, h, t, 0.5 + 0.5 * u);
    }
  }
}
// 影の扇(ホワイトアウト): 爆発の中心 O(熾天使の足もと)から見た壊れたクリスタル h の向こう側。当たり判定(serShadowed)と同じ形
//   grow: 角度を広げる(縁のにじみ用)。画面の座標で c(2D の文脈)に道を作る
function serWedge(c, O, h, grow = 0) {
  const dx = h.x - O.x, dy = h.y - O.y, hd = Math.hypot(dx, dy);
  if (hd < 1) return false;
  const ah = Math.atan2(dy, dx), hw = Math.asin(Math.min(1, h.r / hd)) + grow, r0 = Math.max(0, hd - 4), ox = O.x - cam.x, oy = O.y - cam.y;
  c.beginPath(); c.arc(ox, oy, r0, ah - hw, ah + hw); c.arc(ox, oy, 1500, ah + hw, ah - hw, true); c.closePath();
  return true;
}
// 影の扇の縁: 外へ流れる白い点(安全な所の境目。光の層は暗い金)
function serWedgeEdge(sx, gx, O, h, t, al) {
  const dx = h.x - O.x, dy = h.y - O.y, hd = Math.hypot(dx, dy);
  if (hd < 1) return;
  const ah = Math.atan2(dy, dx), hw = Math.asin(Math.min(1, h.r / hd)), r0 = Math.max(0, hd - 4), ox = O.x - cam.x, oy = O.y - cam.y;
  sx.globalAlpha = al; sx.fillStyle = '#ffffff'; gx.fillStyle = '#5a4a14';
  for (const sd of [-1, 1]) {
    const a = ah + sd * hw, c = Math.cos(a), s = Math.sin(a);
    for (let d = r0 + (t * 40) % 6; d < r0 + 700; d += 6) { const x = Math.round(ox + c * d), y = Math.round(oy + s * d); if (x < -2 || y < -2 || x > GFX.VW + 2 || y > GFX.VH + 2) break; sx.fillRect(x, y, 1, 1); gx.fillRect(x, y, 1, 1); }
  }
  sx.globalAlpha = 1;
}
let serCan = null, serCtx = null;
function serCanvas() { const VW = GFX.VW, VH = GFX.VH; if (!serCan || serCan.width !== VW || serCan.height !== VH) { serCan = ART.canvas(VW, VH); serCtx = serCan.getContext('2d'); } return serCtx; }
// 熾天使の地面: 足もとの光の陣(ホワイトアウトの溜め・ラストラディアンス)/ ルミナスロンドの中心の陣 / プリズムシフトの残像 / 壊れたクリスタルと影の扇
function drawSerGround(b, t) {
  const sx = GFX.sctx, gx = GFX.gctx, ai = b.ai, A = CHAOS.area, W = ai.wo, L = ai.lr, bx = b.x - cam.x, by = b.y - cam.y;
  const wc = W && W.t < 5 ? W.t / 5 : 0, lr = L && !L.still;
  if (wc > 0 || lr) { // 光の陣: 大きな楕円が 3重に回り、間を光の文字が流れる。中に六芒星
    const R = (lr ? 120 : 40 + 110 * easeOutCubic(wc)) * A, k = lr ? 1 : Math.min(1, wc * 3), rot = t * (0.4 + wc);
    ellBoth(sx, gx, bx, by, R, R * 0.42, '#ffe8a0', 0.75 * k, dimCol('#ffd23f', 0.35 * k), 0, 0);
    ellBoth(sx, gx, bx, by, R * 0.86, R * 0.36, '#ffd23f', 0.6 * k, dimCol('#ffd23f', 0.25 * k), 24, rot);
    ellBoth(sx, gx, bx, by, R * 0.58, R * 0.24, '#ffffff', 0.5 * k, dimCol('#fff6dc', 0.2 * k), 0, 0);
    sx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { const a = -rot * 0.8 + TAU / 14 * i, x = Math.round(bx + Math.cos(a) * R * 0.93), y = Math.round(by + Math.sin(a) * R * 0.39); sx.globalAlpha = 0.85 * k; sx.fillRect(x - 1, y, 3, 1); sx.fillRect(x, y - 1, 1, 3); }
    for (const off of [0, Math.PI]) {
      const q = [0, 1, 2].map(j => { const a = off + rot * 0.6 + TAU / 3 * j; return [bx + Math.cos(a) * R * 0.58, by + Math.sin(a) * R * 0.24]; });
      sx.globalAlpha = 0.5 * k; for (let j = 0; j < 3; j++) { pLine(sx, q[j][0], q[j][1], q[(j + 1) % 3][0], q[(j + 1) % 3][1], '#ffe8a0'); pLine(gx, q[j][0], q[j][1], q[(j + 1) % 3][0], q[(j + 1) % 3][1], dimCol('#ffd23f', 0.2 * k)); }
    }
    sx.globalAlpha = 1;
    addLight(b.x, b.y, R * 1.2, '#fff2b0', 0.2 * k);
  }
  if (ai.ronde && ai.ronde.t >= 0.6) { // ルミナスロンドの中心: 回る小さな陣
    const r = ai.ronde, k = clamp((r.t - 0.6) / 0.15, 0, 1) * clamp((10.6 - r.t) / 0.3, 0, 1);
    ellBoth(sx, gx, bx, by, 16 * A, 6 * A, '#ffe8a0', 0.7 * k, dimCol('#ffd23f', 0.35 * k), 8, t * r.dir * 2);
    ellBoth(sx, gx, bx, by, 10 * A, 4 * A, '#ffffff', 0.6 * k, null, 0, 0);
    sx.globalAlpha = 1;
  }
  if (ai.rift) for (const bm of ai.rift.beams) drawRiftSpot(ai.rift, bm, sx); // ヘヴンズリフトの地面の光
  if (ai.after) { // プリズムシフトの残像: 七色の縁が回る円(中は乱光。赤い破線は敵の攻撃の印)と、残った熾天使の幻
    const Af = ai.after, k = clamp(Af.t / 0.3, 0, 1) * clamp((5 - Af.t) / 0.5, 0, 1), R = 70 * A, ax = Af.x - cam.x, ay = Af.y - cam.y;
    sx.globalAlpha = 0.08 * k; sx.fillStyle = '#e8d8ff'; sx.beginPath(); sx.arc(ax, ay, R, 0, TAU); sx.fill();
    const m = Math.round(TAU * R / 2);
    for (let i = 0; i < m; i++) { const a = TAU * i / m + t * 0.8, x = Math.round(ax + Math.cos(a) * R), y = Math.round(ay + Math.sin(a) * R); sx.globalAlpha = 0.85 * k; sx.fillStyle = PRISM[Math.floor(i / m * 21 + t * 4) % 7]; sx.fillRect(x, y, 1, 1); }
    sx.globalAlpha = (Math.floor(t * 8) % 2 ? 0.55 : 0.3) * k; pCircle(sx, ax, ay, Math.round(R - 3), '#ff3b5c', 3);
    sx.globalAlpha = 1; pCircle(gx, ax, ay, Math.round(R), dimCol('#a888ff', 0.3 * k));
    const sp = ART.S.seraph; sx.globalAlpha = 0.3 * k * (0.8 + 0.2 * Math.sin(t * 9)); sx.drawImage(ART.tint(sp.c, PRISM[Math.floor(t * 8) % 7]), Math.round(ax - sp.w / 2), Math.round(ay - 12 - sp.h / 2)); sx.globalAlpha = 1;
    if (Math.random() < 0.5 * k) { const pa = rand(0, TAU), pr = rand(0, R); part(Af.x + Math.cos(pa) * pr, Af.y + Math.sin(pa) * pr, 0, -rand(10, 30), 0.6, pick(PRISM), { glow: true, drag: 1 }); }
    addLight(Af.x, Af.y, R * 1.3, '#d8c8ff', 0.25 * k);
  }
  const hs = ai.husks || [];
  if (hs.length && W && W.t < 8) { // ホワイトアウトの影: 溜めの間にだんだん濃く伸びる(どこへ隠れればいいか見える)
    const u = W.t < 5 ? W.t / 5 : 1, O = { x: W.x, y: W.y };
    sx.globalAlpha = 0.12 + 0.3 * u; sx.fillStyle = '#0a1430';
    for (const h of hs) if (serWedge(sx, O, h)) sx.fill();
    sx.globalAlpha = 1;
    if (W.t >= 5) for (const h of hs) serWedgeEdge(sx, gx, O, h, t, 0.9);
  }
  for (const h of hs) { // 壊れたクリスタル: 溜めの間は足もとが青く脈打つ(ここが影になる)
    drawSp(ART.S.husk, h.x, h.y + 2);
    if (W && W.t < 5) { const pl = 0.5 + 0.5 * Math.sin(t * 6); sx.globalAlpha = 0.5 + 0.4 * pl; pCircle(sx, h.x - cam.x, h.y - cam.y + 7, Math.round(h.r + 2 * pl), '#bff4ff', 2); sx.globalAlpha = 1; pCircle(gx, h.x - cam.x, h.y - cam.y + 7, Math.round(h.r), dimCol('#7ad7ff', 0.3 + 0.3 * pl), 2); }
    addLight(h.x, h.y, 26, '#9fd8ff', 0.3);
  }
}
const riftFade = b => 1 - clamp((b.t - SER_RIFT.aim - RIFT_SWEEP) / SER_RIFT.fade, 0, 1); // 傾き終わると消えていく
// 光の強さ: 予告の間は弱い。傾いてからは強く、傾き終わると消えていく
const riftLit = b => (b.t < SER_RIFT.aim ? 0.4 : 1) * riftFade(b);
// 円錐の光の地面の楕円(敵より奥): 地面に当たっている光 = 当たる所(楕円そのもの)を濃い光で隅まで塗る。光源に近い側が少し明るい。
//   ls: [{ x, y: 光源の真下・a: 向き・o: 楕円(coneSpot)}]・k: 光の強さ。ヘヴンズリフトで使う
//   いくつもの光は合わせた形を 1回で塗る(重なった所が濃くならない。当たりも重なりで増えない。広い光が重なると白く飛ぶので)
//   光の層(発光)と照らす光(addLight)は使わない: 明るい床ではどちらもブルームでにじみ、当たる所より大きく見える。白にしないのも同じ理由
function drawConeGround(sx, ls, k) {
  const ell = (sh, ka, col, al) => {
    const p = new Path2D();
    for (const { x, y, a, o } of ls) {
      const c = Math.cos(a), s = Math.sin(a), d = o.c - clamp(o.c / o.a, 0, 1) * sh * o.a, q = new Path2D();
      q.ellipse(x + c * d - cam.x, y + s * d - cam.y, o.a * ka, o.b * ka, a, 0, TAU); p.addPath(q); // 楕円ごとに別の部分(前の楕円と線でつながない)
    }
    sx.globalAlpha = al; sx.fillStyle = col; sx.fill(p);
  };
  ell(0, 1, '#ffe2a0', 0.72 * k); // 地面に当たっている光(当たる所)
  ell(0.25, 0.75, '#fff0c0', 0.45 * k); // 光源に近い側ほど明るい(縁は内側で接する)
  sx.globalAlpha = 1;
}
// ヘヴンズリフトの地面の光: 光が地面に届いてから(0.12秒)
function drawRiftSpot(R, b, sx) {
  if (b.t < 0.12) return;
  const k = riftLit(b) * clamp((b.t - 0.12) / 0.08, 0, 1);
  if (k <= 0) return;
  drawConeGround(sx, [{ x: R.x, y: R.y, a: b.a, o: riftSpot(riftTh(b), CHAOS.area) }], k);
}
// ヘヴンズリフトの空中の円錐: 差したばかり(0.12秒)は光の先が裂け目から地面へ降りる。傾いている間は縁が赤い線、予告の間は淡い金の点線
function drawRiftShaft(R, b, sx, gx, t) {
  const A = CHAOS.area, Q = SER_RIFT, H = Q.h * A;
  drawConeShaft(sx, gx, t, { x: R.x, y: R.y, H, a: b.a, ap: 2 }, riftSpot(riftTh(b), A), riftLit(b), riftFade(b), b.t >= Q.aim, clamp(b.t / 0.12, 0, 1), H * Q.tan);
}
// 空の裂け目(最前面): 細いひびが中から両端へ走り(0.15秒)、割れて開く(縁は上下で別々のぎざぎざ。外は暗い紫・縁は金・中は白)。
//   両端にひびが伸び、縁から光と欠片がこぼれる。最後の光が消えると閉じて(0.2秒)、ひびの名残が薄れて消える
function drawSerRift(R, sx, gx, t) {
  const A = CHAOS.area, H = SER_RIFT.h * A, cx = Math.round(R.x - cam.x), cy = Math.round(R.y - H - cam.y), W = Math.round(34 * A), G = 6 * A, cr = R.cr, n = cr.length - 1, tn = Math.tan(R.tilt);
  const run = clamp(R.t / 0.15, 0, 1), open = R.t < 0.15 ? 0 : easeOutBack(clamp((R.t - 0.15) / 0.3, 0, 1)), shut = 1 - clamp(R.close / 0.2, 0, 1), fade = 1 - clamp((R.close - 0.15) / 0.15, 0, 1), g = open * shut;
  const vt = cr.map((p, i) => { const u = i / n * 2 - 1, pr = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 1.7)), 0.75); return { y: p.dy * (1 - Math.abs(u)), up: pr * p.up, dn: pr * p.dn }; }); // 縁の頂点(間は直線でつなぐ: ぎざぎざ)
  const at = x => { const f = (x / W + 1) / 2 * n, i = clamp(Math.floor(f), 0, n - 1), u = f - i, p = vt[i], q = vt[i + 1]; return { y: lerp(p.y, q.y, u) + x * tn, up: G * g * lerp(p.up, q.up, u), dn: G * g * lerp(p.dn, q.dn, u) }; };
  if (g < 0.2) { // ひび(1本の線): 中から両端へ走る / 閉じたあとの名残
    const L = Math.round(W * run), al = R.close > 0 ? fade : 1;
    sx.globalAlpha = al; sx.fillStyle = '#ffffff'; gx.fillStyle = dimCol('#ffe8a0', 0.5 * al);
    for (let x = -L; x <= L; x++) { const y = Math.round(cy + at(x).y); sx.fillRect(cx + x, y, 1, 1); gx.fillRect(cx + x, y, 1, 1); }
    if (run < 1) for (const sd of [-1, 1]) if (Math.random() < 0.7) part(R.x + sd * L, R.y - H + at(sd * L).y, sd * rand(20, 60), rand(-30, 10), 0.25, pick(['#ffffff', '#ffe8a0']), { glow: true, drag: 3 }); // 走るひびの先の火花
  }
  if (g > 0.02) {
    const pulse = 0.85 + 0.15 * Math.sin(t * 9), cols = [];
    for (let x = -W - 1; x <= W + 1; x++) { const p = at(clamp(x, -W, W)), y0 = Math.round(cy + p.y); cols.push({ y0, top: y0 - Math.round(p.up), bot: y0 + Math.round(p.dn) }); }
    for (let pass = 0; pass < 2; pass++) for (let i = 1; i < cols.length - 1; i++) { // 1回目: 外の暗い縁(空が裂けた所。2px)/ 2回目: 金の縁と中の光
      const c0 = cols[i], X = cx + i - 1 - W, top = Math.min(c0.top, cols[i - 1].top, cols[i + 1].top), bot = Math.max(c0.bot, cols[i - 1].bot, cols[i + 1].bot); // 急な所も縁がとぎれないように、となりの列まで縦につなぐ
      const gap = c0.bot - c0.top, th = gap >= 3 ? 2 : 1;
      if (pass === 0) { sx.globalAlpha = 0.9 * shut; sx.fillStyle = '#2a1e40'; sx.fillRect(X, top - th, 1, bot - top + 2 * th + 1); continue; }
      sx.globalAlpha = 1; sx.fillStyle = gap < 1 ? '#ffe8a0' : '#ffd23f'; sx.fillRect(X, top, 1, c0.top - top + 1); sx.fillRect(X, c0.bot, 1, bot - c0.bot + 1);
      if (gap > 1) {
        sx.fillStyle = '#fff2c8'; sx.fillRect(X, c0.top + 1, 1, gap - 1); // 中の光
        if (gap > 3) { sx.fillStyle = '#ffffff'; sx.fillRect(X, c0.top + 2, 1, gap - 3); } // 芯は白
        if (gap > 4 && ((i + Math.floor(t * 24)) % 9 + 9) % 9 === 0) { sx.fillStyle = '#ffe8a0'; sx.fillRect(X, c0.y0, 2, 1); } // 中を流れる光
        gx.fillStyle = dimCol('#fff2b0', 0.3 * g * pulse); gx.fillRect(X, c0.top + 1, 1, gap - 1); // 光の層は中だけ(縁まで光らせると、にじんで雲のように見える)
      }
    }
    for (let k = 0; k < 2; k++) { // 両端から伸びるひび(枝 1本。下に暗い影)
      const sd = k ? 1 : -1, T = R.tips[k], L = clamp(open, 0, 1) * shut, ex = cx + sd * W, ey = cy + at(sd * W).y;
      if (L < 0.05) continue;
      const pt = (px, py) => [ex + sd * px * L, ey + py * L], m = [pt(0, 0), pt(4, T.m[0]), pt(8, T.m[1]), pt(13, T.m[2])], br = [m[1], pt(7, T.m[0] + T.br * 3), pt(10, T.m[0] + T.br * T.bl)];
      const al = 0.75 + 0.25 * Math.sin(t * 17 + k * 2);
      for (const ln of [m, br]) for (let j = 0; j < ln.length - 1; j++) {
        sx.globalAlpha = 0.6 * shut; pLine(sx, ln[j][0], ln[j][1] + 1, ln[j + 1][0], ln[j + 1][1] + 1, '#2a1e40');
        sx.globalAlpha = al; pLine(sx, ln[j][0], ln[j][1], ln[j + 1][0], ln[j + 1][1], '#ffe8a0'); pLine(gx, ln[j][0], ln[j][1], ln[j + 1][0], ln[j + 1][1], dimCol('#ffd23f', 0.3 * al));
      }
    }
    sx.globalAlpha = 1;
    if (Math.random() < 0.35 * g) { const x = rand(-W, W) * 0.85, p = at(x); part(R.x + x, R.y - H + p.y + p.dn, rand(-4, 4), rand(20, 60), 0.6, pick(SER_GOLD), { glow: true, drag: 0.5 }); } // 裂け目からこぼれる光
    if (Math.random() < 0.08 * g) { const x = rand(-W, W) * 0.9, p = at(x), hi = Math.random() < 0.5; part(R.x + x, R.y - H + p.y + (hi ? -p.up - 1 : p.dn + 1), rand(-15, 15), hi ? -rand(10, 30) : rand(5, 20), 0.5, pick(['#3a2a58', '#6a5a8a', '#ffd23f']), { drag: 1 }); } // 縁から剥がれる欠片
  }
  sx.globalAlpha = 1;
  const lk = Math.max(g, run < 1 ? 0.4 * run : 0);
  if (lk > 0) addLight(R.x, R.y - H, 50 + 20 * g, '#fff2b0', 0.5 * lk);
}
// ホワイトアウトの爆発(3秒): 前景(歪まない層)を白で覆う。影の扇だけは穴にして元の景色が見える(縁は少し光がにじむ・中は青黒く)。
//   白の中は回る光芒と外へ広がる光の輪。光の中にいるプレイヤー・敵と壊れたクリスタルは黒い影絵、熾天使は金の影と光の星で示す
function drawSerWhiteout(t) {
  for (const b of S.bosses || []) {
    const W = !b.dead && b.boss === 'seraph' && b.ai && b.ai.wo;
    if (!W || W.t < 5 || W.t >= 8) continue;
    const e0 = W.t - 5, I = e0 < 0.2 ? 1 : e0 < 2.4 ? 0.8 + 0.06 * Math.sin(e0 * 10) : 0.8 * Math.max(0, (3 - e0) / 0.6);
    const c = serCanvas(), VW = GFX.VW, VH = GFX.VH, O = { x: W.x, y: W.y }, ox = W.x - cam.x, sy = W.y - (b.jz || 0) - cam.y - 2, hs = b.ai.husks || [];
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, VW, VH);
    c.fillStyle = '#fffaf0'; c.fillRect(0, 0, VW, VH);
    c.fillStyle = '#f4dca4';
    for (let i = 0; i < 18; i++) { const a = e0 * 0.5 + TAU / 18 * i, w = 0.05; c.globalAlpha = 0.6; c.beginPath(); c.moveTo(ox, sy); c.lineTo(ox + Math.cos(a - w) * 900, sy + Math.sin(a - w) * 900); c.lineTo(ox + Math.cos(a + w) * 900, sy + Math.sin(a + w) * 900); c.closePath(); c.fill(); } // 回る光芒
    c.globalAlpha = 0.55; c.strokeStyle = '#ecc880'; c.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const rr = (e0 * 260 + k * 110) % 440; c.beginPath(); c.ellipse(ox, sy, rr + 1, (rr + 1) * 0.8, 0, 0, TAU); c.stroke(); } // 外へ広がる光の輪
    const pu = (e0 % 0.5) / 0.5, PR = 40 + 520 * easeOutCubic(pu); // ダメージの脈(0.5秒ごと): 太い金の輪が外へ広がって薄れる
    c.globalAlpha = 0.7 * (1 - pu); c.strokeStyle = '#e8b050'; c.lineWidth = 6 * (1 - pu) + 1; c.beginPath(); c.ellipse(ox, sy, PR, PR * 0.8, 0, 0, TAU); c.stroke();
    c.fillStyle = '#e8b850';
    for (let i = 0; i < 60; i++) { const h1 = hash2(i, 31), h2 = hash2(i, 57), d = ((e0 * (120 + 200 * h1) + h2 * 500) % 500), a = h1 * TAU + e0 * 0.2; c.globalAlpha = 0.8 * (1 - d / 500); c.fillRect(Math.round(ox + Math.cos(a) * d), Math.round(sy + Math.sin(a) * d * 0.8), 2, 2); } // 外へ流れる光の粒
    c.globalCompositeOperation = 'destination-out';
    for (const h of hs) { c.globalAlpha = 0.45; if (serWedge(c, O, h, 0.035)) c.fill(); c.globalAlpha = 1; if (serWedge(c, O, h)) c.fill(); }
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 0.25; c.fillStyle = '#0a1030'; for (const h of hs) if (serWedge(c, O, h)) c.fill();
    c.globalAlpha = 1;
    const ox2 = GFX.octx;
    ox2.globalAlpha = I; ox2.drawImage(serCan, 0, 0);
    const sil = (sp, x, y, o = {}) => { const sc = o.scale || 1, img = ART.tint(o.flip ? ART.variant(sp, 'flip') : sp.c, o.col || '#1a1408'); ox2.drawImage(img, Math.round(x - cam.x - sp.w * sc / 2), Math.round(y - cam.y - sp.h * sc / 2), Math.round(sp.w * sc), Math.round(sp.h * sc)); };
    const lit = (x, y) => !serShadowed(W.x, W.y, hs, x, y);
    ox2.globalAlpha = Math.min(1, I * 1.15);
    for (const h of hs) sil(ART.S.husk, h.x, h.y + 2, { col: '#18243a' });
    for (const e of enemies) {
      if (e.dead || e.boss || e.under || e.sunk || e.flying || e.prop || !onScreen(e.x, e.y, 30) || !lit(e.x, e.y)) continue;
      ox2.globalAlpha = 0.6 * I; sil(spriteOf(e), e.x, e.y, { flip: (e.face || 1) < 0, scale: e.scale });
    }
    const bcx = b.x - cam.x, bcy = b.y - (b.jz || 0) - cam.y; // 熾天使: 6枚の翼を大きく広げた金の影絵
    ox2.globalAlpha = 0.55 * I;
    for (const Wg of SER_WINGS) for (const sd of [-1, 1]) for (let i = 0; i < Wg.n; i++) { const [rx, ry, tx, ty] = serFeather(Wg, i, sd, bcx, bcy, 2.2, Math.sin(t * 5) * 0.05, 0); pLine(ox2, rx, ry, tx, ty, i % 2 ? '#d8a040' : '#e8b850', 2); }
    ox2.globalAlpha = 0.65 * I; sil(ART.S[b.spr || 'seraph'], b.x, b.y - (b.jz || 0), { col: '#d8a848' });
    ox2.globalAlpha = I; pDisc(ox2, ox, sy, 6, '#ffd23f'); pDisc(ox2, ox, sy, 4, '#fff6dc'); pDisc(ox2, ox, sy, 2, '#ffffff');
    for (let i = 0; i < 8; i++) { const a = TAU / 8 * i + e0 * 0.8, len = (i % 2 ? 18 : 34) + Math.sin(t * 30 + i) * 4; pLine(ox2, ox + Math.cos(a) * 7, sy + Math.sin(a) * 7, ox + Math.cos(a) * len, sy + Math.sin(a) * len, '#e8a830'); } // 光の星
    if (!P.dead && lit(P.x, P.y)) { // 光の中のプレイヤー: 黒い影絵と、足もとの輪
      const rig = ART.S[DATA.classes[P.cls].rig], psp = rig ? ART.rigFrame(rig, P.moving ? 'walk' : 'idle', t) : ART.S.player;
      ox2.globalAlpha = 0.95; sil(psp, P.x, P.y - (psp.h - ART.S.player.h) / 2, { flip: P.facing < 0, col: '#140c04' });
      ox2.globalAlpha = 0.5 + 0.3 * Math.sin(t * 12); pCircle(ox2, P.x - cam.x, P.y - cam.y + 7, 9, '#140c04', 2);
    }
    ox2.globalAlpha = 1;
    GFX.overOn = true;
  }
}
// セラフィムレイ: 太い光線(縁は七色、金の外側・白い芯)。撃った瞬間は予告より太く、細くなって消える。根元に光の十字
BFX_DRAW.sray = (f, fx, fy, u, bd) => {
  const { gx, sx, t } = bd;
  const k = 1 - u, c = Math.cos(f.a), s = Math.sin(f.a), x1 = fx + c * f.len, y1 = fy + s * f.len, Wd = Math.max(1, Math.round(f.w * (0.5 + k))), nx = -s, ny = c;
  pLine(gx, fx, fy, x1, y1, dimCol('#c8a050', 0.8 * k), Wd + 2);
  for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) { const off = (Wd / 2 + 1.5 + i) * sd; sx.globalAlpha = 0.75 * k; pLine(sx, fx + nx * off, fy + ny * off, x1 + nx * off, y1 + ny * off, PRISM[(i * 2 + (sd > 0 ? 0 : 1) + Math.floor(t * 20)) % 7]); }
  sx.globalAlpha = 0.6 * k; pLine(sx, fx, fy, x1, y1, '#ffd23f', Wd + 2);
  sx.globalAlpha = k; pLine(sx, fx, fy, x1, y1, '#fff6c8', Wd); pLine(sx, fx, fy, x1, y1, '#ffffff', Math.max(1, Wd - 4));
  const st = Math.round(8 + 16 * k); sx.globalAlpha = k; pLine(sx, fx - st, fy, fx + st, fy, '#ffffff'); pLine(sx, fx, fy - st, fx, fy + st, '#ffffff'); pDisc(sx, x1, y1, Math.round(2 + 3 * k), '#ffffff');
  sx.globalAlpha = 1; pDisc(gx, fx, fy, Math.round(3 + 4 * k), dimCol('#fff6dc', 0.7 * k));
  for (let d = 0; d < f.len; d += 30) addLight(f.x + c * d, f.y + s * d, 36, '#fff2b8', 0.6 * k);
  return;
};
// プリズムシフト: 消えた所から現れた所へ、七色の光の帯が走って消える
BFX_DRAW.prismtrail = (f, fx, fy, u, bd) => {
  const { sx, gx } = bd;
  const k = 1 - u, x1 = f.x1 - cam.x, y1 = f.y1 - cam.y, L = Math.hypot(x1 - fx, y1 - fy) || 1, nx = -(y1 - fy) / L, ny = (x1 - fx) / L, hw = 3 * k + 1;
  for (let i = 0; i < 7; i++) { const off = (i - 3) * hw / 3; sx.globalAlpha = 0.85 * k; pLine(sx, fx + nx * off, fy + ny * off, x1 + nx * off, y1 + ny * off, PRISM[i]); }
  sx.globalAlpha = k; pLine(sx, fx, fy, x1, y1, '#ffffff');
  sx.globalAlpha = 1; pLine(gx, fx, fy, x1, y1, dimCol('#c8b8ff', 0.6 * k), 3);
  addLight((f.x + f.x1) / 2, (f.y + f.y1) / 2, Math.min(120, L * 0.6), '#d8c8ff', 0.5 * k);
  return;
};
// プリズムバラージのクリスタル: 宙に浮かんで回る光の結晶。撃つ瞬間に白く光る。消えるときは砕ける
BFX_DRAW.bcrystal = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const app = easeOutBack(Math.min(1, f.t / 0.25)), out = clamp((f.life - f.t) / 0.15, 0, 1), bob = Math.sin(t * 4 + f.x * 0.1) * 1.5, ph = (f.t - 0.4) % 0.5, fire = f.t >= 0.4 && f.t < 2.4 && ph < 0.08;
  ellBoth(sx, gx, fx, fy + 4, 10, 4, '#bff4ff', 0.5 * out, dimCol('#7ad7ff', 0.3 * out), 6, t * 2);
  sx.globalAlpha = 1;
  drawSp(ART.S.obj_scrystal, f.x, f.y - 8 + bob, { scale: Math.max(0.1, app * 1.4), alpha: out, white: fire });
  for (let k = 0; k < 3; k++) { const a = t * 3 + TAU / 3 * k + f.x, x = Math.round(fx + Math.cos(a) * 10), y = Math.round(fy - 8 + bob + Math.sin(a) * 4); sx.globalAlpha = out; sx.fillStyle = PRISM[(k * 2 + Math.floor(t * 6)) % 7]; sx.fillRect(x, y, 1, 1); }
  sx.globalAlpha = 1;
  if (fire) { pLine(sx, fx - 9, fy - 8 + bob, fx + 9, fy - 8 + bob, '#ffffff'); pLine(sx, fx, fy - 17 + bob, fx, fy + 1 + bob, '#ffffff'); }
  if (out < 1 && Math.random() < 0.6) part(f.x + rand(-4, 4), f.y - 8 + rand(-6, 6), rand(-60, 60), rand(-60, 20), 0.4, pick(['#bff4ff', '#ffffff', ...PRISM]), { glow: true, g: 120 }); // 砕ける
  addLight(f.x, f.y - 8, fire ? 50 : 30, fire ? '#ffffff' : '#9fd8ff', fire ? 0.8 : 0.45);
  return;
};
// トリニティサンクチュアリの回復: 残った巨大クリスタルから熾天使へ、緑と金の光が波打って流れこむ
BFX_DRAW.healray = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const k = 1 - u, x1 = f.x1 - cam.x, y1 = f.y1 - cam.y, L = Math.hypot(x1 - fx, y1 - fy) || 1, nx = -(y1 - fy) / L, ny = (x1 - fx) / L;
  for (let j = 0; j < 3; j++) {
    let px0 = fx, py0 = fy;
    for (let i = 1; i <= 16; i++) { const v = i / 16, w = Math.sin(v * Math.PI) * Math.sin(v * 9 - t * 20 + j * 2.1) * 6, x = lerp(fx, x1, v) + nx * w, y = lerp(fy, y1, v) + ny * w; sx.globalAlpha = 0.85 * k; pLine(sx, px0, py0, x, y, j === 1 ? '#ffe8a0' : '#5dff8a'); pLine(gx, px0, py0, x, y, dimCol('#5dff8a', 0.5 * k), 2); px0 = x; py0 = y; }
  }
  for (let i = 0; i < 4; i++) { const v = (f.t * 2.5 + i / 4) % 1; sx.globalAlpha = k; pDisc(sx, lerp(fx, x1, v), lerp(fy, y1, v), 2, '#ffffff'); } // 流れこむ光の粒
  sx.globalAlpha = 1;
  addLight((f.x + f.x1) / 2, (f.y + f.y1) / 2, Math.min(120, L * 0.5), '#5dff8a', 0.5 * k);
  return;
};
