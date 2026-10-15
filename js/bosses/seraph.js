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
function serCircle(e, x, y, r, n) { if (hitCircle(x, y, r, e.dmg * n, PIERCE)) { randomLight(serLight(e), e.dmg); return true; } return false; }
function serLine(e, x, y, a, len, w, n) { if (hitLine(x, y, a, len, w, e.dmg * n, PIERCE)) { randomLight(serLight(e), e.dmg); return true; } return false; }
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
    screenFlash(1, '#ffffff'); hitstop(0.08); shake(18);
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
  hitstop(0.25); slowmo(0.25, 1.4); screenFlash(0.7, '#ffffff'); shake(14);
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
