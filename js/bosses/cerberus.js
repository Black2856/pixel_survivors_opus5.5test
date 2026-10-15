// bosses/cerberus.js — ボス: 冥犬ケルベロス: 王の墓を守る三つ首の番犬。左から 毒・牙・闇 の首。合体形態と分裂形態をくり返す
'use strict';

// ---------- 冥犬ケルベロス: 王の墓を守る三つ首の番犬。左から 毒・牙・闇 の首。合体形態と分裂形態をくり返す ----------
//   合体形態: 首は壊せない(ダメージは体だけ)。技は1つずつ(終わってから 0.6秒あける): 闇の遠吠え(→ 影の猟犬)/ 影の突進 / 三獄の息吹 / 三獄の魔弾 / 激昂: 三獄の雨
//   ★分裂: 合体形態で 15秒(激昂 11秒)たつと、体が影にほどけて 毒・牙・闇 の犬 3匹になる(本体は消える)。12秒で、生き残った犬がプレイヤーのいた所へ跳び込んで合体
//   犬の HP は最大HP の 30%(犬へのダメージは本体にも ×0.2)。倒した犬の首は合体しても戻らず、次の分裂で生え直す。3匹とも倒すと 5秒 倒れ込む(被ダメ ×1.5)
const CERB = { poison: ['#7dff6a', '#2e8a2e', '#c8ffb0'], fang: ['#ff5a5a', '#8a1a2a', '#ffd0d0'], dark: ['#a66bff', '#3a1a5a', '#e8c8ff'] }; // 首の色(光・暗・芯)
const CHEAD = [{ hk: 'poison', dx: 10, dy: -1, hz: 15 }, { hk: 'fang', dx: 17, dy: 1, hz: 9 }, { hk: 'dark', dx: 11, dy: 3, hz: 2 }]; // 合体形態の首: 体の中心からの位置(右向き)と高さ
const CFORM = { merge: 15, mergeE: 11, split: 12, down: 5, pct: 0.3, spill: 0.2 };
const CDOG = { poison: { spd: 40, da: -2.094 }, fang: { spd: 36, da: 0 }, dark: { spd: 26, da: 2.094 } }; // 犬の速さ(本体の速さ 21 に対して。毒の犬は 90〜120 を保てるように速め)・分裂で跳び出す向き(プレイヤーへの向きから。牙はプレイヤーの方、毒・闇は ±120°)
const BREATH = ['#7dff6a', '#3aff5a', '#2e8a2e', '#c8ffb0', '#9a7dff'];
const BREATH_COL = { poison: ['#7dff6a', '#3aff5a', '#2e8a2e', '#c8ffb0'], fang: ['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0'], dark: ['#9ff7ff', '#bff4ff', '#7ad7ff', '#ffffff'] }; // 三獄の息吹: 毒の首 = 毒・牙の首 = 炎・闇の首 = 氷
const cerbHas = (ai, hk) => ai.hs.some(h => !h.dead && h.hk === hk);
const cerbLive = ai => ai.hs.filter(h => !h.dead);
const dogSpd = (o, hk) => CDOG[hk].spd * o.spd / DATA.bosses.cerberus.spd; // 敵Lv・激昂で速くなるのは本体と同じ
const cerbMouth = (e, hk) => { const H = CHEAD.find(c => c.hk === hk), f = e.face || 1; return { x: e.x + (H.dx + 5) * f, y: e.y + H.dy - H.hz + 1 }; }; // 合体形態の首の口
function cerberusAI(e, ai, dt, a, dist, slow) {
  if (!ai.hs) { // 首(= 分裂したときの犬)の HP。合体形態では壊せない
    ai.hs = CHEAD.map(H => ({ hk: H.hk, max: e.maxhp * CFORM.pct, hp: e.maxhp * CFORM.pct, dead: false, pulse: 0, raise: 0, rise: 1 }));
    ai.form = 'merge'; ai.mergeAt = S.time; ai.dogs = [];
    hint('chead', _t('三つ首'), _t('合体と分裂をくり返す。分裂した犬を倒すと、合体したあとその首の技が止まる。3匹とも倒すと倒れ込む'));
  }
  for (const h of ai.hs) { h.pulse = Math.max(0, h.pulse - dt * 2); h.rise = Math.min(1, h.rise + dt * 1.5); }
  if (ai.form === 'down') return updCerbDown(e, ai, dt);
  if (ai.form === 'tosplit') return updCerbToSplit(e, ai, dt);
  if (ai.form === 'split') return updCerbSplit(e, ai, dt);
  if (ai.form === 'tomerge') return updCerbToMerge(e, ai, dt);
  cerbHeadFx(e, ai, dt);
  if (ai.br) { updCerbBreath(e, ai, dt, a); return; } // 三獄の息吹(吐いている間は止まる)
  if (ai.act === 'rush') { updCerbRush(e, ai, dt); return; } // 影の突進の最後(本体が走る)
  if (ai.act === 'busy') { if ((ai.pt -= dt) <= 0) { ai.act = null; ai.gap = 0.6; } return; }
  if (S.time - ai.mergeAt >= (ai.enraged ? CFORM.mergeE : CFORM.merge) && !ai.q.length) { cerbSplit(e, ai); return; } // 技の最中なら終わってから
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  if (Math.random() < dt * 8) part(e.x - (e.face || 1) * 14 + rand(-2, 2), e.y - 6 + rand(-3, 3), rand(-6, 6), -rand(10, 24), 0.5, pick(['#a66bff', '#7a3ab0', '#c79bff']), { glow: true, drag: 1 }); // 尾の紫の炎
  const R = CHAOS.rate, en = ai.enraged;
  ai.howl -= dt * R; ai.rush -= dt * R; ai.breath -= dt * R; ai.orb -= dt * R; if (en) ai.rain -= dt * R;
  if ((ai.gap -= dt) > 0) return;
  const live = cerbLive(ai).length;
  if (en && ai.rain <= 0 && live) { ai.rain = 12; cerbRain(e, ai); }
  else if (ai.howl <= 0 && cerbHas(ai, 'dark')) { ai.howl = en ? 9 : 12; cerbHowl(e, ai); }
  else if (ai.rush <= 0 && cerbHas(ai, 'fang')) { ai.rush = en ? 7 : 9; cerbSRush(e, ai); }
  else if (ai.breath <= 0 && live) { ai.breath = 15; cerbBreath(e, ai, a); }
  else if (ai.orb <= 0 && live) { ai.orb = en ? 8 : 10; cerbOrbs(e, ai); }
}
// 首ごとの気配(毒のよだれ・牙の光・闇のもや)
function cerbHeadFx(e, ai, dt) {
  const f = e.face || 1;
  for (const h of ai.hs) {
    if (h.dead) continue;
    const m = cerbMouth(e, h.hk);
    if (h.hk === 'poison' && Math.random() < dt * 6) part(m.x + rand(-2, 2), m.y + 2, rand(-3, 3), rand(10, 25), 0.6, pick(['#7dff6a', '#3aa83a']), { glow: true, g: 160 });
    else if (h.hk === 'dark' && Math.random() < dt * 10) part(m.x - 4 * f + rand(-5, 5), m.y - rand(0, 6), rand(-6, 6), -rand(8, 18), 0.7, pick(['#1a0a2a', '#3a1a5a', '#7a3ab0']), { drag: 1 });
    else if (h.hk === 'fang' && Math.random() < dt * 3) part(m.x, m.y + 1, 0, 0, 0.25, '#ffd0d0', { glow: true });
  }
}
// 闇の遠吠え(闇の首): 1秒(闇の首が天を仰ぎ、足元から黒い霧)→ 半径 130 まで闇の波が 0.6秒で広がる(×0.6・暗闇)→ 0.5秒後から影の猟犬 3匹(激昂 5匹)が 0.4秒おきに
function cerbHowl(e, ai) {
  const hd = ai.hs.find(h => h.hk === 'dark');
  hd.raise = 1;
  pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 130, t: 0, life: 1, track: w => { w.x = e.x; w.y = e.y; } });
  AudioMan.charge(1);
  ai.mist = 1;
  windup(e, 1, () => {
    ai.mist = 0; hd.raise = 0;
    addHazard('darkwave', e.x, e.y, { r: 1, max: 130, spread: 0.6, dur: 0.9, dmg: e.dmg * 0.6 });
    AudioMan.howl(); shake(9); screenFlash(0.18, '#2a1240'); shockAt(e.x, e.y, 2.2, 0.7);
    fxRays(e.x, e.y - 14, 90, '#3a1a5a', { foe: true, n: 18, life: 0.5, core: '#a66bff', light: 0.6 });
    addFlash(e.x, e.y, 160, '#7a3ab0', 0.5);
    const n = ai.enraged ? 5 : 3, a0 = rand(0, TAU);
    ai.act = 'busy'; ai.pt = 0.5 + (n - 1) * 0.4 + 0.3; // 猟犬を放ち終えるまで
    for (let i = 0; i < n; i++) later(ai, 0.5 + i * 0.4, () => { if (!e.dead) houndCall(e, a0 + TAU / n * i + rand(-0.3, 0.3)); }); // 別々の向きから
    hint('howl', _t('闇の遠吠え'), _t('闇の波に飲まれると暗闇になる。闇の中で赤い目が光ったら、影の猟犬が駆け抜けてくる'));
  });
}
// 影の猟犬: 画面の外の闇(プレイヤーから見て ha の向き)に赤い目が光る(0.8秒。帯はプレイヤーの位置を通って画面を横切る)→ 速さ 420 で駆け抜ける(×0.8)
//   目は予告ではなく演出なので、暗闇の間も見える(帯は見えない)
function houndCall(e, ha) {
  const c = Math.cos(ha), s = Math.sin(ha), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 24, x0 = P.x + c * R, y0 = P.y + s * R, a = ha + Math.PI, L = R * 2;
  pushWarn({ kind: 'line', x: x0, y: y0, a, len: L, w: 16, t: 0, life: 0.8, fixed: true });
  const kx = c > 0.01 ? (cam.x + GFX.VW - 14 - P.x) / c : c < -0.01 ? (cam.x + 14 - P.x) / c : R, ky = s > 0.01 ? (cam.y + GFX.VH - 14 - P.y) / s : s < -0.01 ? (cam.y + 14 - P.y) / s : R, k = clamp(Math.min(kx, ky), 0, R);
  bfx.push({ kind: 'heyes', x: P.x + c * k, y: P.y + s * k, a, t: 0, life: 0.95 }); // 画面の端の闇に赤い目
  AudioMan.shade2();
  later(e.ai, 0.8, () => {
    if (e.dead) return;
    eprojs.push({ kind: 'shound', x: x0, y: y0, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, dmg: e.dmg * 0.8 * (S.eatk ?? 1), life: L / 420, t: 0, r: 7, keep: true });
    AudioMan.dash();
  });
}
// 影の突進(牙の首): 0.6秒(帯 長さ 170・幅 25)→ 0.5秒ごとに合計 3回(激昂 5回)。毎回そのときのプレイヤーへ向け直した帯を、影が速さ 400 で駆け抜けて噛みつく(×1.3・60 押す・暗闇)
//   最後の1回は本体が走り、着いた所で半径 60 を切り裂く(無敵無視)
const SRUSH = { len: 170, w: 25, spd: 400, wind: 0.6, gap: 0.5, slash: 60 };
function cerbSRush(e, ai) {
  const n = ai.enraged ? 5 : 3;
  ai.act = 'busy'; ai.pt = 99; // 本体が走り終えるまで(updCerbRush で戻す)
  ai.hs.find(h => h.hk === 'fang').pulse = 1;
  e.sq = 1.1; AudioMan.charge(SRUSH.wind);
  for (let k = 0; k < n; k++) {
    const tw = k ? SRUSH.wind + (k - 1) * SRUSH.gap : 0, life = k ? SRUSH.gap : SRUSH.wind, last = k === n - 1;
    later(ai, tw, () => {
      if (e.dead) return;
      const a = Math.atan2(P.y - e.y, P.x - e.x);
      pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: SRUSH.len, w: SRUSH.w, t: 0, life, fixed: true }); // 突進の経路(体当たりなので広げない)
      if (last) pushWarn({ kind: 'circle', x: e.x + Math.cos(a) * SRUSH.len, y: e.y + Math.sin(a) * SRUSH.len, r: SRUSH.slash, t: 0, life: life + SRUSH.len / SRUSH.spd }); // 着いた所の切り裂き
      later(ai, life, () => {
        if (e.dead) return;
        if (!last) return cerbShadeRush(e, ai, a);
        ai.act = 'rush'; ai.ra = a; ai.rleft = SRUSH.len; ai.rhit = false;
        AudioMan.dash(); AudioMan.roar(); shake(5);
      });
    });
  }
  hint('srush', _t('影の突進'), _t('影が次々に突っ込んでくる。最後は本体が走り、着いた所のまわりを切り裂く'));
}
function cerbShadeRush(e, ai, a) { // 影(ケルベロスの影絵)が駆け抜ける
  eprojs.push({ kind: 'cshade', x: e.x, y: e.y, vx: Math.cos(a) * SRUSH.spd, vy: Math.sin(a) * SRUSH.spd, dmg: e.dmg * 1.3 * (S.eatk ?? 1), dark: DATA.debuffTomb.darkDur, pushK: 60, life: SRUSH.len / SRUSH.spd, t: 0, r: SRUSH.w / 2 - 2, keep: true, heads: cerbLive(ai).map(h => h.hk) });
  burst(e.x, e.y, 20, SKC, { sp: 100, glow: true, life: 0.35 }); addRing(e.x, e.y, 14, '#a66bff', { life: 0.25 });
  AudioMan.dash(); AudioMan.shade2(); shake(3);
}
function updCerbRush(e, ai, dt) {
  const step = Math.min(ai.rleft, SRUSH.spd * dt);
  e.x += Math.cos(ai.ra) * step; e.y += Math.sin(ai.ra) * step; ai.rleft -= step;
  e.face = Math.cos(ai.ra) < 0 ? -1 : 1;
  if ((ai.ghostT = (ai.ghostT || 0) - dt) <= 0) { ai.ghostT = 0.03; bfx.push({ kind: 'ghost', x: e.x, y: e.y, spr: 'cerberus', flip: e.face < 0, col: '#ff5a5a', t: 0, life: 0.25 }); } // 残像
  if (Math.random() < dt * 60) part(e.x + rand(-10, 10), e.y + 8, -Math.cos(ai.ra) * 60 + rand(-20, 20), -rand(10, 40), 0.4, pick(['#3a2a40', '#5a4a60', '#ff5a5a']), { g: 120, drag: 2 }); // 土煙
  if (!ai.rhit && d2(e.x, e.y, P.x, P.y) < Math.pow(SRUSH.w / 2 + 3, 2) && hurtPlayer(e.dmg * 1.3)) { // 噛みついた
    ai.rhit = true; pushPlayer(ai.ra, 60, 0.2); darkPlayer(DATA.debuffTomb.darkDur);
    bfx.push({ kind: 'cbite', x: P.x, y: P.y, a: ai.ra, col: CERB.fang[0], t: 0, life: 0.3 }); AudioMan.bite(); shake(6); hitstop(0.05);
  }
  if (ai.rleft > 0) return;
  // 着いた所で半径 60 を切り裂く(無敵無視)
  const R = SRUSH.slash * CHAOS.area;
  if (d2(e.x, e.y, P.x, P.y) < (R + 3) * (R + 3)) hurtPlayer(e.dmg, { pierce: true });
  slashes.push({ x: e.x, y: e.y, a: ai.ra, r: R, t: 0, life: 0.34, full: true, pal: SWING_PAL.cerb, enemy: true });
  slashes.push({ x: e.x, y: e.y, a: ai.ra + Math.PI, r: R * 0.72, t: 0, life: 0.28, full: true, flip: 1, pal: SWING_PAL.cerb, enemy: true }); // 二重の刃筋
  fxRays(e.x, e.y, R * 1.2, '#5a1020', { foe: true, n: 18, life: 0.35, core: '#ff5a5a', light: 0.7 });
  for (let i = 0; i < 26; i++) { const pa = rand(0, TAU), r = rand(10, R); part(e.x + Math.cos(pa) * r, e.y + Math.sin(pa) * r, Math.cos(pa) * 70, Math.sin(pa) * 70, 0.4, pick(['#1a0a14', '#5a1020', '#ff5a5a', '#a66bff']), { glow: Math.random() < 0.4, drag: 2 }); }
  shockAt(e.x, e.y, 2, 0.7); shake(9); hitstop(0.06); AudioMan.slash(); AudioMan.cutHit();
  ai.act = null; ai.gap = 0.6; e.sq = 0.85;
}
// 三獄の息吹(名前は仮): 0.5秒(前方の扇 半径 110・±35°)→ 2秒 吐き続ける(扇は毎秒 0.6rad でプレイヤーを追う)。中にいる間 0.5秒ごとに ×0.3 × 残った首の数
//   残った首ごとに: 毒の首 = 毒 +1、牙の首 = 炎上(ボスのダメージ ×0.1)、闇の首 = 凍傷 +1
function cerbBreath(e, ai, a) {
  const els = cerbLive(ai).map(h => h.hk);
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 110, h: 0.61, t: 0, life: 0.5, track: w => { w.x = e.x; w.y = e.y; } });
  for (const h of cerbLive(ai)) h.pulse = 1;
  ai.brCharge = els; // 構えの間、口から属性の煙がこぼれる(描画)
  AudioMan.charge(0.5);
  windup(e, 0.5, () => { ai.brCharge = null; ai.br = { a, els, r: 110, h: 0.61, t: 0, dur: 2, tick: 0, track: 0.6 }; AudioMan.fire(); AudioMan.roar(); shake(5); shockAt(e.x, e.y, 1.2, 0.8); });
}
function updCerbBreath(e, ai, dt, a) {
  const b = ai.br;
  b.t += dt; b.tick -= dt;
  b.a += clamp(angDiff(a, b.a), -b.track * dt, b.track * dt);
  if (b.tick <= 0) {
    b.tick = 0.5;
    if (inFan(e.x, e.y, b.a, b.r, b.h) && hurtPlayer(e.dmg * 0.3 * b.els.length, { pierce: true })) {
      if (b.els.includes('poison')) poisonPlayer(1);
      if (b.els.includes('fang')) burnPlayer(e.dmg * 0.1);
      if (b.els.includes('dark')) frostPlayer(1);
    }
  }
  const R0 = b.r * CHAOS.area;
  for (const hk of b.els) { // 首ごとの口から、毒・炎・氷が扇いっぱいに噴き出す
    const m = cerbMouth(e, hk);
    for (let k = 0; k < 2; k++) {
      const pa = b.a + rand(-b.h, b.h) * 0.9, sp = rand(90, 170);
      part(m.x, m.y, Math.cos(pa) * sp, Math.sin(pa) * sp, R0 / sp * rand(0.7, 1), pick(BREATH_COL[hk]), { glow: Math.random() < 0.45, drag: 0.4, sz: pick([1, 2, 2, 3]) });
    }
  }
  if (b.t >= b.dur) { ai.br = null; ai.gap = 0.6; }
}
// 三獄の雨(名前は仮・激昂): 0.6秒(首がふくらむ)→ 残った首ごとに、その首の属性の霧の弾を空へ吐く。ケルベロスから 150 の所(プレイヤーの方向を中心に 毒の首 -75°・牙の首 0°・闇の首 +75°)に 1.3秒で落ちる
//   落ちた所にその属性の霧(半径 100・10秒。中にいると 0.5秒ごとに: 毒の霧 = 毒 +1、炎の霧 = 炎上(ボスのダメージ ×0.1)、氷の霧 = 凍傷 +1。ダメージはない)
const SHELL = { poison: 'vshell', fang: 'fshell', dark: 'ishell' };
const RAIN_DA = { poison: -1.309, fang: 0, dark: 1.309 };
function cerbRain(e, ai) {
  const hs = cerbLive(ai);
  for (const h of hs) h.pulse = 1.4;
  AudioMan.charge(0.6);
  windup(e, 0.6, () => {
    const a = Math.atan2(P.y - e.y, P.x - e.x);
    for (const h of hs) {
      if (h.dead) continue;
      const ta = a + RAIN_DA[h.hk], m = cerbMouth(e, h.hk);
      let tx = e.x + Math.cos(ta) * 150, ty = e.y + Math.sin(ta) * 150;
      if (S.mode === 'arena') { const d = Math.hypot(tx, ty), mx = DATA.arena.r - 20; if (d > mx) { tx *= mx / d; ty *= mx / d; } }
      const C = BREATH_COL[h.hk], burn = e.dmg * 0.1;
      pushWarn({ kind: 'circle', x: tx, y: ty, r: 100, t: 0, life: 1.3 });
      lob(SHELL[h.hk], m.x, m.y, tx, ty, 1.3, 120, p => {
        addHazard('miasma', p.tx, p.ty, { r: 100, dur: 10, tick: 0.25, iv: 0.5, el: h.hk, burn });
        burst(p.tx, p.ty, 50, [...C, '#3a1a4a'], { sp: 160, up: 40, glow: true, life: 0.8 });
        addRing(p.tx, p.ty, 100 * CHAOS.area, C[0], { r0: 20, w: 3, life: 0.5 }); addFlash(p.tx, p.ty, 140, C[0], 0.5);
        shockAt(p.tx, p.ty, 1.8, 0.7); shake(6); AudioMan.splat(); AudioMan.boom();
      });
      burst(m.x, m.y, 14, C, { sp: 80, up: 40, glow: true, life: 0.4 });
    }
    AudioMan.shoot(); AudioMan.poison(); ai.gap = 0.6;
  });
  hint('rain', _t('三獄の雨'), _t('空から落ちた弾が、毒・炎・氷の大きな霧になる。霧の中にいると、その状態異常がたまる'));
}
// 三獄の魔弾(名前は仮): 0.5秒(首がふくらむ)→ 残った首ごとに、その首の属性の玉を1つずつ、同時にプレイヤーへの向きを中心に 20° おきに撃つ(速さ 100・×0.6)
//   闇の玉(影の眼)と同じく、プレイヤーに 50 まで近づくか撃って 4秒で、プレイヤーの方向へ 3つ(激昂 6つ)に割れる(速さ 130・2.5秒)
//   当たると 毒の玉 = 毒 +1、炎の玉 = 炎上(ボスのダメージ ×0.1)、氷の玉 = 凍傷 +1
const CORB_ST = { poison: e => ({ poison: 1 }), fang: e => ({ burn: e.dmg * 0.1 * (S.eatk ?? 1) }), dark: e => ({ frost: 1 }) };
function cerbOrbs(e, ai) {
  const hs = cerbLive(ai);
  for (const h of hs) h.pulse = 1.2;
  ai.brCharge = hs.map(h => h.hk); // 構えの間、口から属性の煙がこぼれる(描画)
  AudioMan.charge(0.5);
  windup(e, 0.5, () => {
    ai.brCharge = null;
    const live = hs.filter(h => !h.dead), a0 = Math.atan2(P.y - e.y, P.x - e.x), f = e.face || 1;
    for (const [i, h] of live.entries()) {
      const m = cerbMouth(e, h.hk), a = a0 + (i - (live.length - 1) / 2) * 0.349 * f; // 20° おき。上の首(毒)ほど上側へ
      eprojs.push(Object.assign({ kind: 'corb', el: h.hk, x: m.x, y: m.y, vx: Math.cos(a) * 100, vy: Math.sin(a) * 100, dmg: e.dmg * 0.6 * (S.eatk ?? 1), life: 4, t: 0, r: 3.5 * CHAOS.area, n: ai.enraged ? 6 : 3 }, CORB_ST[h.hk](e)));
      burst(m.x, m.y, 14, BREATH_COL[h.hk], { sp: 70, glow: true, life: 0.35 }); addRing(m.x, m.y, 9, BREATH_COL[h.hk][0], { life: 0.25 });
    }
    AudioMan.shoot(); AudioMan.shade2(); ai.gap = 0.6;
  });
}
function splitCorb(p) { // プレイヤーの方向へ n個に割れる(0.2rad おき)
  const a = Math.atan2(P.y - p.y, P.x - p.x), C = BREATH_COL[p.el];
  for (let i = 0; i < p.n; i++) eprojs.push({ kind: 'corb', el: p.el, frag: true, x: p.x, y: p.y, vx: Math.cos(a + (i - (p.n - 1) / 2) * 0.2) * 130, vy: Math.sin(a + (i - (p.n - 1) / 2) * 0.2) * 130, dmg: p.dmg, poison: p.poison, burn: p.burn, frost: p.frost, life: 2.5, t: 0, r: 2.5 * CHAOS.area });
  burst(p.x, p.y, 18, [...C, '#ffffff'], { sp: 80, glow: true, life: 0.35 });
  addRing(p.x, p.y, 12, C[0], { r0: 3, life: 0.25 }); addFlash(p.x, p.y, 40, C[0], 0.4); AudioMan.shade2();
}
// ★分裂: 1秒(体が震え、黒い炎に包まれて影にほどける)→ 毒・牙・闇の犬が 3方向へ跳び出す(本体の位置から 70)。壊れていた首は生え直す(その犬は HP 満タン)
function cerbSplit(e, ai) {
  ai.form = 'tosplit'; ai.pt = 1; ai.act = null; ai.br = null; ai.dissolve = 0;
  for (const h of ai.hs) if (h.dead) { h.dead = false; h.hp = h.max; h.rise = 0; }
  AudioMan.charge(1); AudioMan.shade2(); shake(4);
}
function updCerbToSplit(e, ai, dt) {
  ai.pt -= dt;
  ai.dissolve = clamp(1 - ai.pt, 0, 1); // 描画: 体が黒く染まっていく
  e.sq = 1 + Math.sin(ai.dissolve * 36) * 0.08; // 震える(白くは光らせない。暗いステージでは白い塊に見えるため)
  for (let i = 0; i < 4; i++) part(e.x + rand(-16, 16), e.y + rand(-14, 8), rand(-8, 8), -rand(20, 60), rand(0.4, 0.8), pick(['#0a0612', '#1a0a2a', '#3a1a5a', '#7a3ab0']), { drag: 1, sz: pick([1, 2, 3]) }); // 黒い炎に包まれる
  if (ai.pt > 0) return;
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  ai.dogs = ai.hs.map(h => {
    const da = a + CDOG[h.hk].da, tx = e.x + Math.cos(da) * 70, ty = e.y + Math.sin(da) * 70;
    bfx.push({ kind: 'cstreak', x: e.x, y: e.y - 6, tx, ty: ty - 6, col: CERB[h.hk][0], t: 0, life: 0.5 }); // 首の色の光の筋
    return cerbDog(e, h, tx, ty);
  });
  e.flying = e.hidden = e.air = true; ai.dissolve = 0; e.flash = 0;
  ai.form = 'split'; ai.splitT = 0; ai.hunted = false;
  burst(e.x, e.y, 80, ['#0a0612', '#2a1240', '#7a3ab0', '#7dff6a', '#ff5a5a', '#a66bff'], { sp: 190, up: 40, glow: true, life: 0.9 });
  fxBeam(e.x, e.y, { foe: true, w: 22, H: 160, col: '#2a1240', mid: '#7a3ab0', core: '#e8c8ff', life: 0.5, up: true, drop: 0.1 });
  addRing(e.x, e.y, 60, '#a66bff', { r0: 10, w: 3, life: 0.45 }); addFlash(e.x, e.y, 150, '#7a3ab0', 0.6);
  shockAt(e.x, e.y, 2.4, 0.7); shake(10); hitstop(0.06); screenFlash(0.15, '#2a1240'); AudioMan.howl(); AudioMan.boom();
}
function updCerbSplit(e, ai, dt) {
  ai.splitT += dt;
  const live = ai.dogs.filter(d => !d.dead);
  if (live.length) { e.x = live.reduce((s, d) => s + d.x, 0) / live.length; e.y = live.reduce((s, d) => s + d.y, 0) / live.length; } // 消えた本体は犬たちの真ん中に(影の王の糸など)
  if (ai.enraged && !ai.hunted && ai.splitT >= 5 && live.length && !live.some(d => d.jump)) { ai.hunted = true; cerbHunt(e, ai, live); }
  if (ai.splitT >= CFORM.split && live.length && !live.some(d => d.hunt || d.jump)) cerbMerge(e, ai, live);
}
// 合体: 1秒。生き残った犬が、そのときのプレイヤーの位置(動かない)へ跳び込む(円 半径 50)→ ×1.2・外へ 60 押す。そこにケルベロスが戻る(犬の HP は首に持ち越す)
function cerbMerge(e, ai, live) {
  const x = P.x, y = P.y;
  pushWarn({ kind: 'circle', x, y, r: 50, t: 0, life: 1, cm: true });
  for (const d of live) { cerbDogSurface(d); d.st = 'run'; d.stT = 2.5; d.jump = { x0: d.x, y0: d.y, tx: x, ty: y, t: 0, T: 1, H: 50, merge: true }; }
  ai.form = 'tomerge'; ai.pt = 1; ai.mx = x; ai.my = y;
  AudioMan.charge(1); AudioMan.howl();
}
function updCerbToMerge(e, ai, dt) {
  if ((ai.pt -= dt) > 0) { // 跳び込む先で闇が渦を巻く
    if (Math.random() < 0.7) { const pa = rand(0, TAU), pr = rand(20, 60); part(ai.mx + Math.cos(pa) * pr, ai.my + Math.sin(pa) * pr * 0.6, -Math.cos(pa) * pr * 2, -Math.sin(pa) * pr * 1.2, 0.4, pick(SKC.slice(0, 4)), { glow: Math.random() < 0.3, drag: 0 }); }
    return;
  }
  for (const d of ai.dogs) if (!d.dead) { ai.hs[d.slot].hp = d.hp; d.dead = true; } // 犬の HP は首へ(次の分裂に持ち越す)
  ai.dogs = [];
  e.x = ai.mx; e.y = ai.my; e.flying = e.hidden = e.air = false;
  ai.form = 'merge'; ai.mergeAt = S.time; ai.gap = 0.8; e.sq = 0.6;
  for (const h of ai.hs) if (!h.dead) h.rise = 0.4;
  if (hitCircle(e.x, e.y, 50, e.dmg * 1.2)) pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 60, 0.25);
  const R = 50 * CHAOS.area;
  fxBeam(e.x, e.y, { foe: true, w: 22, H: 190, col: '#2a1240', mid: '#5a2a8a', core: '#a66bff', life: 0.55, up: true, drop: 0.12 }); // 影の柱(白く飛ばないように芯は紫)
  bossBlast(e.x, e.y, R, Object.assign({ n: 20 }, BFX.cerberus));
  burst(e.x, e.y, 90, ['#0a0612', '#2a1240', '#7dff6a', '#ff5a5a', '#a66bff', '#ffffff'], { sp: 200, up: 50, glow: true, life: 0.9 });
  addRing(e.x, e.y, R, '#e8c8ff', { r0: 8, w: 3, life: 0.4 }); addFlash(e.x, e.y, 160, '#7a3ab0', 0.5);
  shockAt(e.x, e.y, 2.8, 0.6); shake(13); hitstop(0.1); screenFlash(0.12, '#7a3ab0'); AudioMan.boom(); AudioMan.roar();
}
// 3匹とも倒した: 合体できずに最後の犬の場所で倒れ込む(5秒。動かず技も使わない。被ダメ ×1.5)
function cerbDownStart(e, ai, x, y) {
  ai.form = 'down'; ai.pt = CFORM.down; ai.q = []; ai.dogs = []; ai.br = null; ai.act = null; ai.wind = 0;
  warns = warns.filter(w => !w.cm); // 合体の跳び込みの予告を消す
  e.x = x; e.y = y; e.flying = e.hidden = e.air = false; e.takeK = 1.5; e.sq = 0.8; e.stunVis = true;
  burst(e.x, e.y, 70, ['#1a0a14', '#5a1020', '#7dff6a', '#a66bff', '#ff5a5a'], { sp: 170, g: 200, glow: true, life: 0.9 });
  fxBeam(e.x, e.y, { foe: true, w: 20, H: 120, col: '#2a1240', mid: '#5a1020', core: '#e8c8ff', life: 0.45, drop: 0.1 });
  shockAt(e.x, e.y, 2, 0.7); shake(12); hitstop(0.1); slowmo(0.35, 0.8); screenFlash(0.3, '#ffffff'); AudioMan.boom(); AudioMan.roar();
  UI.announce(_t('ケルベロスが倒れ込んだ!'), _t`${CFORM.down}秒 大きなダメージを与えられる`);
}
function updCerbDown(e, ai, dt) { // 倒れ込み: 頭の上を星が回る。起き上がると首が全部生え直す
  ai.pt -= dt; e.sq = lerp(e.sq, 0.8, Math.min(1, dt * 8)); e.stunVis = true;
  if (Math.random() < dt * 10) part(e.x + rand(-12, 12), e.y + rand(-4, 6), rand(-10, 10), -rand(10, 30), 0.6, pick(['#1a0a14', '#5a1020']), { drag: 1 });
  if (ai.pt > 0) return;
  ai.form = 'merge'; ai.mergeAt = S.time; ai.gap = 0.8; e.takeK = 1; e.stunVis = false;
  for (const h of ai.hs) { h.dead = false; h.hp = h.max; h.rise = 0; }
  AudioMan.howl(); shake(9); shockAt(e.x, e.y, 1.6, 0.8);
  bossBlast(e.x, e.y + 6, 50, Object.assign({ n: 18 }, BFX.cerberus));
  for (const H of CHEAD) { const m = cerbMouth(e, H.hk); burst(m.x, m.y, 20, ['#1a0a14', '#5a1020', CERB[H.hk][0], CERB[H.hk][1]], { sp: 80, up: 30, g: 160, glow: true, life: 0.5 }); } // 黒い肉が盛り上がって生え直す
}
// 犬へのダメージの ×0.2 は本体へ(倍率・クリティカルは犬への一撃で掛かっているので、そのまま ×0.2)
function cerbSpill(d, dmg) {
  const o = d.owner;
  if (!o || o.dead) return;
  o.hp -= dmg * CFORM.spill; o.flash = 0.06; S.hudDirty = true;
  if (o.hp <= 0) { o.x = d.x; o.y = d.y; o.flying = o.hidden = o.air = false; killEnemy(o); } // 分裂中に本体の HP が尽きたら、その犬の場所で倒れる
}

// ---------- 分裂形態の犬(ボスが出した物 'cdog'。HP は首と同じで、壊すとその首が落ちる) ----------
//   毒の犬: プレイヤーから 90〜120 を保って回り込む。走った跡に 1秒ごとに毒だまり(半径 14・4秒)。4秒(激昂 3秒)ごとに 0.5秒ふくらんで瘴気弾 3発(激昂 5発、±25°)
//   牙の犬: 追う。距離 110 以内で 0.45秒構え(帯 長さ 130・幅 16)→ 速さ 340 で飛びかかる(×1.0・40 押す)。そのあと 1.2秒(激昂 0.8秒)止まって息をつく
//   闇の犬: 地上で 2.5秒 追う → 影潜り(影に沈んで攻撃が当たらない。1.5秒 迫る → 0.5秒 円 半径 24 → 飛び出して噛む ×1.0・暗闇 3秒)
//   群れの狩り(激昂): 分裂して 5秒後に1回。プレイヤーを囲む位置(120 離れて等間隔)へ 0.6秒で走り、帯(長さ 240・幅 18)0.8秒 → 一斉に駆け抜ける(速さ 380・×1.0)
function cerbDog(e, h, tx, ty) {
  const d = spawnObj(e, 'cdog', e.x, e.y, { pct: 0, r: 9, life: Infinity });
  Object.assign(d, {
    type: 'cdog_' + h.hk, hk: h.hk, slot: CHEAD.findIndex(c => c.hk === h.hk), hp: Math.max(1, h.hp), maxhp: h.max, dmg: e.dmg * 0.6, rise: 1, face: tx < e.x ? -1 : 1,
    st: 'run', stT: 2.5, shotT: 2, trailT: 0.5, orbit: Math.random() < 0.5 ? 1 : -1, jz: 0, jump: { x0: e.x, y0: e.y, tx, ty, t: 0, T: 0.45, H: 26 },
  });
  return d;
}
function cerbDogSurface(d) { // 闇の犬が影から出る
  if (!d.sunk) return;
  d.sunk = false; d.invuln = d.hidden = false; d.air = false; d.hideA = 1;
}
function updCerbDog(d, dt) {
  const o = d.owner, ai = o.ai, C = CERB[d.hk];
  d.pulse = Math.max(0, (d.pulse || 0) - dt * 2);
  if (d.jump) { // 跳ぶ(分裂で跳び出す・合体で跳び込む)
    const j = d.jump; j.t += dt;
    const k = Math.min(1, j.t / j.T);
    d.x = lerp(j.x0, j.tx, k); d.y = lerp(j.y0, j.ty, k); d.jz = Math.sin(k * Math.PI) * j.H; d.air = true;
    d.face = j.tx < j.x0 ? -1 : 1; d.run = true;
    if (Math.random() < dt * 40) part(d.x + rand(-4, 4), d.y - d.jz - 4 + rand(-3, 3), 0, 0, 0.3, pick([C[0], C[2], '#3a1a5a']), { glow: true, drag: 2 }); // 首の色の残光
    if (k < 1) return;
    d.jump = null; d.jz = 0; d.air = false;
    if (!j.merge) { burst(d.x, d.y + 4, 16, ['#3a2a40', '#5a4a60', C[0]], { sp: 80, up: 20, g: 200, life: 0.4 }); addRing(d.x, d.y + 4, 12, C[0], { life: 0.3 }); AudioMan.thud(); }
    return;
  }
  if (ai.form !== 'split') return;
  if (d.stun > 0) { d.stun -= dt; d.run = false; return; }
  const slow = (1 - 0.03 * (d.frost || 0)) * clsEnemySlow(d), spd = dogSpd(o, d.hk) * slow, a = Math.atan2(P.y - d.y, P.x - d.x), dist = Math.hypot(P.x - d.x, P.y - d.y);
  if (d.hunt) dogHunt(d, o, dt);
  else if (d.hk === 'poison') dogPoison(d, o, dt, a, dist, spd);
  else if (d.hk === 'fang') dogFang(d, o, dt, a, dist, spd);
  else dogDark(d, o, dt, a, dist, spd);
  if (!d.sunk && !d.air && d2(d.x, d.y, P.x, P.y) < Math.pow(d.r + 4, 2)) hurtPlayer(d.dmg); // 触れると ×0.6
  for (const q of ai.dogs) { // 犬どうしは重ならない
    if (q === d || q.dead || q.sunk || q.jump) continue;
    const dx = d.x - q.x, dy = d.y - q.y, dd = Math.hypot(dx, dy) || 0.1, ov = d.r + q.r - dd;
    if (ov > 0) { d.x += dx / dd * ov * 0.5; d.y += dy / dd * ov * 0.5; }
  }
}
function dogRun(d, a, spd, dt) { d.x += Math.cos(a) * spd * dt; d.y += Math.sin(a) * spd * dt; d.run = true; d.face = P.x < d.x ? -1 : 1; }
function dogPoison(d, o, dt, a, dist, spd) {
  if (d.spitT > 0) { // 瘴気弾の構え: 止まってふくらむ
    d.spitT -= dt; d.run = false; d.face = P.x < d.x ? -1 : 1;
    if (d.spitT > 0) return;
    const n = o.ai.enraged ? 5 : 3, x = d.x + 10 * d.face, y = d.y - 8, ba = Math.atan2(P.y - y, P.x - x);
    for (let i = 0; i < n; i++) Object.assign(eball(x, y, ba + (i / (n - 1) - 0.5) * 0.873, 80, o.dmg * 0.6, 'vball'), { poison: 1, r: 4 * CHAOS.area });
    burst(x, y, 16, BREATH, { sp: 70, glow: true, life: 0.4 }); addRing(x, y, 10, '#7dff6a', { life: 0.25 }); AudioMan.splat(); AudioMan.shoot();
    d.shotT = o.ai.enraged ? 3 : 4;
    return;
  }
  dogRun(d, dist > 120 ? a : dist < 90 ? a + Math.PI : a + Math.PI / 2 * d.orbit, spd, dt); // 90〜120 を保って回り込む
  if ((d.trailT -= dt) <= 0) { d.trailT = 1; addHazard('miasma', d.x, d.y + 4, { r: 14, dur: 4, tick: 0.5, iv: 1 }); } // 走った跡に毒だまり
  if ((d.shotT -= dt * CHAOS.rate) <= 0) { d.spitT = 0.5; d.pulse = 1.4; AudioMan.charge(0.5); }
}
function dogFang(d, o, dt, a, dist, spd) {
  if (d.st === 'wind') { d.run = false; if ((d.stT -= dt) <= 0) { d.st = 'lunge'; d.lLeft = 130; d.lHit = false; AudioMan.dash(); } return; }
  if (d.st === 'lunge') {
    const step = Math.min(d.lLeft, 340 * dt);
    d.x += Math.cos(d.lA) * step; d.y += Math.sin(d.lA) * step; d.lLeft -= step; d.run = true; d.face = Math.cos(d.lA) < 0 ? -1 : 1;
    if ((d.ghostT = (d.ghostT || 0) - dt) <= 0) { d.ghostT = 0.035; bfx.push({ kind: 'ghost', x: d.x, y: d.y, spr: 'cdog_fang', flip: d.face < 0, col: '#ff5a5a', t: 0, life: 0.22 }); } // 赤い残像
    if (!d.lHit && d2(d.x, d.y, P.x, P.y) < Math.pow(11, 2) && hurtPlayer(o.dmg)) { d.lHit = true; pushPlayer(d.lA, 40, 0.18); bfx.push({ kind: 'cbite', x: P.x, y: P.y, a: d.lA, col: CERB.fang[0], t: 0, life: 0.28 }); AudioMan.bite(); shake(4); }
    if (d.lLeft <= 0) { d.st = 'rest'; d.stT = o.ai.enraged ? 0.8 : 1.2; }
    return;
  }
  if (d.st === 'rest') { // 止まって息をつく(攻撃のすき)
    d.run = false;
    if (Math.random() < dt * 6) part(d.x + 12 * d.face, d.y - 6, d.face * rand(5, 15), -rand(5, 12), 0.4, '#5a4a60', { drag: 2 });
    if ((d.stT -= dt) <= 0) d.st = 'run';
    return;
  }
  dogRun(d, a, spd, dt);
  if (dist < 110) { d.st = 'wind'; d.stT = 0.45; d.lA = a; d.pulse = 1; pushWarn({ kind: 'line', x: d.x, y: d.y, a, len: 130, w: 16, t: 0, life: 0.45, fixed: true }); AudioMan.charge(0.45); }
}
function dogDark(d, o, dt, a, dist, spd) {
  d.stT -= dt;
  if (d.st === 'run') { dogRun(d, a, spd, dt); if (d.stT <= 0) { d.st = 'sink'; d.stT = 0.3; AudioMan.shade2(); } return; }
  if (d.st === 'sink') { // 影に沈む
    d.run = false; d.hideA = Math.max(0, d.stT / 0.3);
    if (d.stT > 0) return;
    d.st = 'creep'; d.stT = 1.5; d.sunk = true; d.invuln = d.hidden = true; d.air = true; d.hideA = 0;
    burst(d.x, d.y + 4, 16, SKC, { sp: 60, glow: true, life: 0.4 });
    return;
  }
  if (d.st === 'creep') { // 影だまりがプレイヤーへ迫る(速さ 110)
    const sp2 = 110 * (1 - 0.03 * (d.frost || 0)) * clsEnemySlow(d), k = Math.min(dist, sp2 * dt);
    if (dist > 1) { d.x += Math.cos(a) * k; d.y += Math.sin(a) * k; }
    d.face = P.x < d.x ? -1 : 1;
    if (Math.random() < dt * 14) part(d.x + rand(-8, 8), d.y + 3 + rand(-2, 2), rand(-5, 5), -rand(4, 12), rand(0.4, 0.7), pick(SKC.slice(0, 3)), { drag: 1 });
    if (d.stT <= 0 || dist < 4) { d.st = 'mark'; d.stT = 0.5; pushWarn({ kind: 'circle', x: d.x, y: d.y, r: 24, t: 0, life: 0.5 }); AudioMan.charge(0.5); }
    return;
  }
  if (d.st === 'mark' && d.stT <= 0) { // 飛び出して噛む
    cerbDogSurface(d); d.st = 'run'; d.stT = 2.5;
    if (hitCircle(d.x, d.y, 24, o.dmg)) darkPlayer(3);
    bfx.push({ kind: 'cbite', x: d.x, y: d.y - 4, a: -Math.PI / 2, col: CERB.dark[0], t: 0, life: 0.3 });
    burst(d.x, d.y, 30, [...SKC, '#ffffff'], { sp: 130, up: 40, glow: true, life: 0.5 }); addRing(d.x, d.y, 24 * CHAOS.area, '#a66bff', { r0: 6, w: 2, life: 0.3 });
    shockAt(d.x, d.y, 1.2, 0.9); shake(5); AudioMan.bite(); AudioMan.shade2();
  }
}
// 群れの狩り(激昂): 生き残った犬がプレイヤーを囲む位置へ 0.6秒で走り、帯 0.8秒 → 一斉に駆け抜ける(速さ 380・×1.0。毒の犬は毒 +1、闇の犬は暗闇 3秒)
function cerbHunt(e, ai, live) {
  const a0 = Math.atan2(live[0].y - P.y, live[0].x - P.x);
  live.forEach((d, i) => {
    const ga = a0 + TAU / live.length * i;
    cerbDogSurface(d); d.st = 'run'; d.stT = 2.5; d.spitT = 0;
    d.hunt = { ph: 'gather', t: 0, x0: d.x, y0: d.y, tx: P.x + Math.cos(ga) * 120, ty: P.y + Math.sin(ga) * 120 };
  });
  AudioMan.howl(); shake(4);
  hint('hunt', _t('群れの狩り'), _t('犬たちがまわりを囲んで、一斉に駆け抜けてくる。帯の外へ'));
}
function dogHunt(d, o, dt) {
  const h = d.hunt;
  h.t += dt;
  if (h.ph === 'gather') {
    const k = Math.min(1, h.t / 0.6);
    d.x = lerp(h.x0, h.tx, easeOutCubic(k)); d.y = lerp(h.y0, h.ty, easeOutCubic(k)); d.run = true; d.face = P.x < d.x ? -1 : 1;
    if (k < 1) return;
    h.ph = 'warn'; h.t = 0; h.a = Math.atan2(P.y - d.y, P.x - d.x); d.pulse = 1;
    pushWarn({ kind: 'line', x: d.x, y: d.y, a: h.a, len: 240, w: 18, t: 0, life: 0.8, fixed: true });
    AudioMan.charge(0.8);
    return;
  }
  if (h.ph === 'warn') { d.run = false; if (h.t >= 0.8) { h.ph = 'run'; h.t = 0; h.left = 240; h.hit = false; AudioMan.dash(); } return; }
  const step = Math.min(h.left, 380 * dt);
  d.x += Math.cos(h.a) * step; d.y += Math.sin(h.a) * step; h.left -= step; d.run = true; d.face = Math.cos(h.a) < 0 ? -1 : 1;
  if ((d.ghostT = (d.ghostT || 0) - dt) <= 0) { d.ghostT = 0.035; bfx.push({ kind: 'ghost', x: d.x, y: d.y, spr: d.type, flip: d.face < 0, col: CERB[d.hk][0], t: 0, life: 0.22 }); }
  if (!h.hit && d2(d.x, d.y, P.x, P.y) < Math.pow(12, 2) && hurtPlayer(o.dmg)) {
    h.hit = true;
    if (d.hk === 'poison') poisonPlayer(1); else if (d.hk === 'dark') darkPlayer(3);
    bfx.push({ kind: 'cbite', x: P.x, y: P.y, a: h.a, col: CERB[d.hk][0], t: 0, life: 0.28 }); AudioMan.bite(); shake(4);
  }
  if (h.left <= 0) { d.hunt = null; d.st = d.hk === 'fang' ? 'rest' : 'run'; d.stT = d.hk === 'fang' ? 1 : 2.5; }
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// ケルベロスの首(合体形態): 体の胸から3本の首が伸び、その先に頭(黒紫の毛、上側に照り)。壊れた首は短い付け根から黒い血がしたたる
//   分裂の構え(ai.dissolve)では、体と首が黒い影に染まっていく
function drawCerbHeads(e, sp, yo, o) {
  const ai = e.ai, f = e.face || 1, dz = ai.dissolve || 0;
  if (!ai.hs) return;
  if (dz > 0) drawShade(sp, e.x, e.y + yo, Object.assign({}, o, { alpha: dz })); // 体が黒く染まる
  drawCerbNecks(e, yo, dz);
  for (let i = 0; i < 3; i++) {
    const h = ai.hs[i], H = CHEAD[i];
    if (h.dead) continue;
    const hs = ART.S['obj_chead_' + h.hk], x = e.x + H.dx * f, y = e.y + H.dy + yo - H.hz - (h.raise ? 4 : 0) + Math.sin(e.t * 3 + i * 2) * 0.8;
    const ho = { flip: f < 0, sy: Math.max(0.3, h.rise) * (1 + h.pulse * 0.25), sxk: 1 + h.pulse * 0.2 }; // 遠吠えで天を仰ぐ・ふくらみは控えめに。首は白く光らせない(構えの点滅が体と首 3本で白い塊に見えるため)
    if (e.shadow) drawShade(hs, x, y, ho); else drawSp(hs, x, y, ho);
    if (dz > 0) drawShade(hs, x, y, Object.assign({}, ho, { alpha: dz }));
    addLight(x + 3 * f, y - 1, 26 + h.pulse * 30, e.shadow ? '#7a3ab0' : CERB[h.hk][0], 0.4 + h.pulse * 0.4); // 目と首の色の光
  }
}
function drawCerbNecks(e, yo, dz) {
  const sx = GFX.sctx, f = e.face || 1, ai = e.ai, ax = e.x + 7 * f - cam.x, ay = e.y + yo - 5 - cam.y, dark = e.shadow || dz > 0.5;
  for (let i = 0; i < 3; i++) {
    const h = ai.hs[i], H = CHEAD[i], live = !h.dead;
    const hx = e.x + H.dx * f - 3 * f - cam.x, hy = e.y + H.dy - H.hz - (live && h.raise ? 4 : 0) + 2 + yo - cam.y;
    const k = live ? Math.max(0.3, h.rise) : 0.4, x1 = ax + (hx - ax) * k, y1 = ay + (hy - ay) * k;
    pLine(sx, ax, ay, x1, y1, '#0e0a14', 6); pLine(sx, ax, ay, x1, y1, dark ? '#0c0614' : '#281c36', 4); pLine(sx, ax, ay - 1, x1, y1 - 1, dark ? '#3a1a5a' : '#4a3462', 2);
    if (!live) { pDisc(sx, x1, y1, 2, '#5a1020'); sx.fillStyle = '#1a0a14'; sx.fillRect(Math.round(x1), Math.round(y1) + 1, 1, 2 + Math.floor((GFX.fx.time * 3 + i) % 3)); } // 付け根の黒い血
  }
}
// 闇の犬の影潜り: 地面の黒い影だまり(紫の縁)と、光る目 2つが滑るように迫る。飛び出す前(円の予告の間)は広がって紫に光る
function drawDogPool(e) {
  const sx = GFX.sctx, gx = GFX.gctx, t = GFX.fx.time, x = e.x - cam.x, y = e.y + 4 - cam.y, mk = e.st === 'mark' ? 1 - Math.max(0, e.stT) / 0.5 : 0, blink = Math.floor(t * 8) % 2;
  const R = 9 + 7 * mk + Math.sin(t * 8 + e.seed * 9) * 0.6;
  sx.globalAlpha = 0.85; sx.fillStyle = '#06030c'; sx.beginPath(); sx.ellipse(x, y, R, R * 0.45, 0, 0, TAU); sx.fill(); sx.globalAlpha = 1;
  ellBoth(sx, gx, x, y, R, R * 0.45, mk > 0 && blink ? '#e8c8ff' : '#a66bff', 0.8, dimCol('#a66bff', 0.4 + 0.4 * mk));
  if (Math.floor(t * 6 + e.seed * 7) % 9) for (const s of [-1, 1]) { // 光る目(ときどき瞬く)
    const ex = Math.round(x + (e.face || 1) * 2 + s * 2), ey = Math.round(y - 1);
    sx.fillStyle = '#e8c8ff'; sx.fillRect(ex, ey, 1, 1); gx.fillStyle = '#7a3ab0'; gx.fillRect(ex, ey, 1, 1);
  }
  addLight(e.x, e.y + 4, 30 + 30 * mk, '#7a3ab0', 0.4 + 0.4 * mk);
}
// ケルベロスの技の見た目: 三獄の息吹(首の数に分けた扇を 毒・炎・氷 の色で)/ その構え(口から属性の煙)/ 闇の遠吠えの構え(足元から黒い霧)/ 合体の跳び込み先(闇の渦)
function drawCerbFx(e, sx, gx, ex, ey, A) {
  const ai = e.ai, t = GFX.fx.time;
  if (ai.br) {
    const b = ai.br, R = b.r * A, fl = 0.75 + 0.25 * Math.sin(t * 30), n = b.els.length;
    for (let k = 0; k < n; k++) { // 首の数だけ扇を分けて、それぞれの属性の色で塗る(境目は揺らぐ)
      const C = BREATH_COL[b.els[k]], a0 = b.a - b.h + 2 * b.h * k / n + (k ? Math.sin(t * 6 + k) * 0.06 : 0), a1 = b.a - b.h + 2 * b.h * (k + 1) / n + (k < n - 1 ? Math.sin(t * 6 + k + 1) * 0.06 : 0);
      for (const [rr, al, col] of [[R, 0.14, C[2]], [R * 0.7, 0.17, C[0]], [R * 0.36, 0.2, C[3]]]) { sx.globalAlpha = al * fl; sx.fillStyle = col; sx.beginPath(); sx.moveTo(ex, ey); sx.arc(ex, ey, rr, a0, a1); sx.closePath(); sx.fill(); }
      for (let r = 16; r < R; r += 22) addLight(e.x + Math.cos((a0 + a1) / 2) * r, e.y + Math.sin((a0 + a1) / 2) * r, r * 0.8, C[0], 0.45);
    }
    sx.globalAlpha = 1;
    const m = Math.ceil(R * b.h * 2);
    for (let i = 0; i <= m; i += 2) { // 縁(危険の赤が混じって明滅)
      const aa = b.a - b.h + 2 * b.h * i / m, px = Math.round(ex + Math.cos(aa) * R), py = Math.round(ey + Math.sin(aa) * R), C = BREATH_COL[b.els[Math.min(n - 1, Math.floor(i / (m + 1) * n))]];
      sx.fillStyle = (i + Math.floor(t * 20)) % 4 ? C[0] : '#ff3b5c'; sx.fillRect(px, py, 1, 1); gx.fillStyle = dimCol(C[0], 0.3); gx.fillRect(px, py, 1, 1);
    }
  }
  if (ai.brCharge && ai.wind > 0) for (const hk of ai.brCharge) { // 息吹の構え: 口から属性の煙がこぼれる
    const mo = cerbMouth(e, hk);
    if (Math.random() < 0.5) part(mo.x + rand(-2, 2), mo.y + rand(-1, 2), rand(-8, 8), rand(-6, 10), rand(0.3, 0.6), pick(BREATH_COL[hk]), { glow: Math.random() < 0.5, drag: 1.5 });
    addLight(mo.x, mo.y, 22, BREATH_COL[hk][0], 0.5);
  }
  if (ai.mist && ai.wind > 0) { // 闇の遠吠えの構え: 足元から黒い霧が渦を巻いて立ちのぼり、闇の首が光る
    const u = 1 - ai.wind / ai.windT;
    for (let k = 0; k < 3; k++) { const pa = rand(0, TAU), pr = rand(10, 30 + 40 * u); part(e.x + Math.cos(pa) * pr, e.y + 8 + Math.sin(pa) * pr * 0.4, -Math.sin(pa) * 20, -rand(10, 40), rand(0.5, 0.9), pick(['#0a0612', '#1a0a2a', '#3a1a5a', '#7a3ab0']), { drag: 1, sz: pick([1, 2, 3]) }); }
    gx.globalAlpha = 1; pCircle(gx, ex, ey + 8, Math.round(14 + 50 * u), dimCol('#7a3ab0', 0.25 + 0.4 * u), 2);
    addLight(e.x, e.y, 60 + 80 * u, '#7a3ab0', 0.4 + 0.4 * u);
  }
  if (ai.form === 'tomerge') { // 合体: 跳び込む先で闇が渦を巻き、縮んでいく
    const u = clamp(1 - ai.pt, 0, 1), mx = ai.mx - cam.x, my = ai.my - cam.y, R = 50 * A * (1 - 0.6 * u);
    ellBoth(sx, gx, mx, my, R, R * 0.45, '#a66bff', 0.6 + 0.3 * u, dimCol('#a66bff', 0.3 + 0.4 * u), 12, t * 4);
    ellBoth(sx, gx, mx, my, R * 0.6, R * 0.27, '#e8c8ff', 0.5 * u, dimCol('#7a3ab0', 0.4 * u), 8, -t * 6);
    addLight(ai.mx, ai.my, 60 + 60 * u, '#7a3ab0', 0.4 + 0.5 * u);
  }
}
