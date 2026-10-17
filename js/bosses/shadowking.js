// bosses/shadowking.js — ボス: 影の王: 影の剣士。影歩で間合いを詰めて斬り、今までのボスの影を呼び出す
'use strict';

// ---------- 影の王: 影の剣士。影歩で間合いを詰めて斬り、今までのボスの影を呼び出す ----------
//   ★影喚び: 残りHP 100%・75%・50%・25% で、tier 1〜4 のボスから1体の影(HP は元の 25%)。影がいる間は被ダメ ×0.3・技の間隔 ×2・HP は次の基準より下がらない
//   技は1つずつ: 影歩(影の剣・影刃の前置き。技のあと 20% でフェイント)/ 影の剣 / 影の三重輪 / 影刃・五月雨 / 追い影 / 断界(即死)/ 激昂: 冥鎖 / はじめから: 蝕む影(激昂で毒が 2倍)
const SKC = ['#0a0612', '#2a1240', '#7a3ab0', '#c79bff', '#e8c8ff'];
const skPool = t => [...new Set(DATA.stageRuns.filter(r => r.tier === t).flatMap(r => r.bosses))].filter(k => k !== 'shadowking' && k !== 'seraph'); // 熾天使の影は呼ばない
const skShade = ai => (ai.shade && !ai.shade.dead ? ai.shade : null);
function shadowKingAI(e, ai, dt, a, dist, slow) {
  if (ai.sumIdx === undefined) { ai.sumIdx = 0; if (S.phase) S.phase.hold = true; } // 闇の霧の時計は、4回目の影を倒すまで止まる
  if (ai.handGlow > 0) ai.handGlow -= dt;
  const shade = skShade(ai);
  if (!shade && ai.sumIdx < 4 && ai.act !== 'summon') { // 次の影喚びの HP より下がらない(呼ぶまで)。技の最中でも、その HP になったら先に呼ぶ
    e.hpFloor = e.maxhp * (1 - 0.25 * ai.sumIdx);
    if (e.hp <= e.hpFloor + 0.5) { if (ai.step) { e.invuln = false; e.air = false; e.hideA = 1; ai.step = null; } skSummon(e, ai); return; }
  }
  if (ai.act === 'summon') { ai.pt -= dt; if (ai.pt <= 0) { ai.act = null; ai.gap = 0.8; } return; }
  if (ai.step) { updSkStep(e, ai, dt); return; }
  if (ai.act === 'busy') { ai.pt -= dt; if (ai.pt <= 0) { ai.act = null; skAfter(e, ai); } return; }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  if (Math.random() < dt * 12) part(e.x - (e.face || 1) * 7 + rand(-3, 3), e.y + rand(-4, 8), -(e.face || 1) * rand(6, 16), -rand(4, 14), rand(0.5, 0.9), pick(SKC.slice(0, 3)), { drag: 1, sz: pick([1, 2]) }); // マントの裾から影がこぼれる
  const R = CHAOS.rate * (shade ? 0.5 : 1), en = ai.enraged; // 影がいる間は技の間隔 ×2
  ai.sword -= dt * R; ai.rings -= dt * R; ai.blades -= dt * R; ai.chase -= dt * R; ai.sever -= dt * R; if (en) ai.chainCd -= dt * R;
  if ((ai.gap -= dt) > 0) return;
  if (en && ai.chainCd <= 0 && !P.chain) { ai.chainCd = 35; skChain(e, ai); } // 断界・冥鎖は影がいる間も使う
  else if (ai.sever <= 0 && !P.chain) { ai.sever = en ? 14 : 18; skSever(e, ai); }
  else if (ai.sword <= 0) { ai.sword = en ? 7 : 8; skStep(e, ai, () => skSword(e, ai)); }
  else if (ai.blades <= 0) { ai.blades = en ? 7 : 9; skStep(e, ai, () => skBlades(e, ai)); }
  else if (ai.rings <= 0) { ai.rings = en ? 8 : 10; skRings(e, ai); }
  else if (ai.chase <= 0) { ai.chase = en ? 7 : 10; skChase(e, ai); }
}
// 技のあと: 少しあける。20% で影歩のフェイント(現れるだけで斬らない)
function skAfter(e, ai) {
  ai.gap = 0.6;
  if (Math.random() < 0.2) skStep(e, ai, null);
}
// ★影喚び: 剣を掲げ、床に影の門が開く → 1.2秒で tier の順にボスの影が立ち上がる
function skSummon(e, ai) {
  const key = pick(skPool(ai.sumIdx + 1));
  ai.sumIdx++;
  ai.act = 'summon'; ai.pt = 1.4;
  e.takeK = 0.3; e.hpFloor = ai.sumIdx < 4 ? e.maxhp * (1 - 0.25 * ai.sumIdx) : 1; // 影を呼んだら守る(呼んでいる間も)
  const ga = Math.atan2(P.y - e.y, P.x - e.x) + rand(-0.7, 0.7), x = e.x + Math.cos(ga) * 70, y = e.y + Math.sin(ga) * 50;
  bfx.push({ kind: 'portal', x, y, t: 0, life: 1.7, r: 36 });
  AudioMan.shade2(); AudioMan.charge(1.2); shake(4); screenFlash(0.12, '#2a1240');
  later(ai, 1.2, () => {
    if (e.dead) return;
    const s = makeBoss(key, x, y, 0.25);
    Object.assign(s, { shadow: true, owner: e, enrage: 0, morphed: key === 'reaper' }); // 影は激昂しない。死神の影は変身しない
    enemies.push(s); (S.shadows = S.shadows || []).push(s);
    ai.shade = s;
    fxBeam(x, y, { foe: true, w: 18, H: 190, col: '#3a1a5a', mid: '#7a3ab0', core: '#c79bff', life: 0.7, up: true, drop: 0.12 });
    fxRays(x, y - 10, 110, '#3a1a5a', { foe: true, n: 22, life: 0.55, core: '#a66bff', light: 0.7 });
    burst(x, y, 90, SKC, { sp: 170, up: 70, glow: true, life: 1 });
    addRing(x, y, 70, '#a66bff', { w: 3, life: 0.55 }); addRing(x, y, 40, '#e8c8ff', { w: 2, life: 0.35 }); addFlash(x, y, 200, '#7a3ab0', 0.8);
    shockAt(x, y, 2.6, 0.6); shake(11); hitstop(0.08, true); screenFlash(0.2, '#7a3ab0'); AudioMan.roar(); AudioMan.knell();
    hint('shadowcall', _t('影喚び'), _t('影を倒すまで、影の王へのダメージは ×0.3。HP も一定より下がらない'));
  });
}
// 影が倒れた: 黒紫の霧になって崩れ、影の王の守りが解ける。4回目の影なら闇の霧の時計が動き出す
function shadowDown(s) {
  s.dead = true;
  for (const o of enemies) if (o.owner === s && !o.dead) { o.dead = true; if (o.obj) objDown(o, false); }
  S.shadows = (S.shadows || []).filter(x => x !== s);
  burst(s.x, s.y, 110, [...SKC, '#ffffff'], { sp: 200, up: 40, glow: true, life: 1.1 });
  fxRays(s.x, s.y, 90, '#3a1a5a', { foe: true, n: 22, life: 0.55, core: '#a66bff', light: 0.7 });
  addRing(s.x, s.y, 90, '#a66bff', { w: 3, life: 0.6 }); addFlash(s.x, s.y, 180, '#7a3ab0', 0.7);
  shockAt(s.x, s.y, 2.4, 0.6); shake(10); hitstop(0.1, true); AudioMan.boom(); AudioMan.shade2();
  const k = s.owner;
  if (!k || k.dead || k.ai.shade !== s) return;
  k.ai.shade = null; k.takeK = 1; k.hpFloor = k.ai.sumIdx < 4 ? k.maxhp * (1 - 0.25 * k.ai.sumIdx) : 0; // 次の影喚びの HP より下がらない(同じフレームの大きな一撃でも飛ばさない)
  addRing(k.x, k.y, 46, '#e8c8ff', { r0: 12, w: 3, life: 0.5 }); burst(k.x, k.y, 40, ['#e8c8ff', '#a66bff', '#ffffff'], { sp: 140, glow: true, life: 0.5 }); // 守りの殻が割れる
  if (k.ai.sumIdx >= 4 && S.phase) S.phase.hold = false;
  UI.announce(_t('影を退けた!'), k.ai.sumIdx >= 4 ? _t('最後の影。闇の霧の時計が動き出す') : _t('影の王の守りが解けた'));
}
// 影歩: 足元の影に沈み(攻撃が当たらない)、0.4秒後にプレイヤーの横か後ろ(40)から現れる。then: 現れてから使う技(なければフェイント)
function skStep(e, ai, then) {
  const mv = P.moving && P.dir ? Math.atan2(P.dir[1], P.dir[0]) : (P.facing > 0 ? 0 : Math.PI), ta = mv + pick([Math.PI, Math.PI / 2, -Math.PI / 2]);
  const x = P.x + Math.cos(ta) * 40, y = P.y + Math.sin(ta) * 40;
  ai.step = { x, y, t: 0, dur: 0.4, then };
  e.invuln = true; e.air = true;
  pushWarn({ kind: 'circle', x, y, r: 12, t: 0, life: 0.4, fixed: true }); // 出る場所(範囲攻撃ではない)
  bfx.push({ kind: 'spool', x, y, t: 0, life: 0.55 }); bfx.push({ kind: 'spool', x: e.x, y: e.y, t: 0, life: 0.45, sink: true });
  burst(e.x, e.y, 18, SKC, { sp: 60, glow: true, life: 0.4 }); AudioMan.shade2();
}
function updSkStep(e, ai, dt) {
  const st = ai.step;
  st.t += dt; e.hideA = Math.max(0, 1 - st.t / 0.15);
  if (st.t < st.dur) return;
  bfx.push({ kind: 'ghost', x: st.x, y: st.y - 6, spr: 'shadowking', flip: P.x < st.x, col: '#c79bff', t: 0, life: 0.3 }); // 影から浮かび上がる
  e.x = st.x; e.y = st.y; e.invuln = false; e.air = false; e.hideA = 1; ai.step = null;
  e.face = P.x < e.x ? -1 : 1;
  burst(e.x, e.y, 34, SKC, { sp: 120, up: 40, glow: true, life: 0.5 });
  addRing(e.x, e.y, 16, '#a66bff', { r0: 34, w: 2, life: 0.3 }); shockAt(e.x, e.y, 1.1, 1); AudioMan.zap();
  if (st.then) st.then(); else ai.gap = 0.8;
}
// 影の剣: 0.5秒(前方の扇 半径 100・±60°)→ 扇の斬撃 ×0.9・100 押す。激昂時は 0.4秒後に影歩からもう一度(影歩 → 予告 → 斬撃 を 2回)
function skSword(e, ai, again) {
  const a = Math.atan2(P.y - e.y, P.x - e.x), twice = ai.enraged && !again;
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 100, h: 1.05, t: 0, life: 0.5 });
  ai.act = 'busy'; ai.pt = twice ? 1.2 : 0.75;
  later(ai, 0.5, () => {
    skSlash(e, a);
    if (twice) later(ai, 0.4, () => { if (!e.dead && ai.act === 'busy' && !ai.step) skStep(e, ai, () => skSword(e, ai, true)); }); // 影喚びで中断したら続けない
  });
}
function skSlash(e, a) {
  if (e.dead) return;
  slashes.push({ x: e.x, y: e.y, a, r: 100 * CHAOS.area, t: 0, life: 0.3, span: 2.1, pal: SWING_PAL.shadow, enemy: true });
  slashes.push({ x: e.x, y: e.y, a, r: 74 * CHAOS.area, t: 0, life: 0.24, span: 2.1, flip: 1, pal: SWING_PAL.shadow, enemy: true }); // 二重の刃筋
  hitFan(e.x, e.y, a, 100, 1.05, e.dmg * 0.9, () => pushPlayer(a, 100, 0.3));
  fxRays(e.x + Math.cos(a) * 42, e.y + Math.sin(a) * 42, 80, '#3a1a5a', { foe: true, n: 14, life: 0.3, core: '#a66bff', light: 0.6 });
  for (let i = 0; i < 22; i++) { const pa = a + rand(-1, 1), r = rand(24, 100) * CHAOS.area; part(e.x + Math.cos(pa) * r, e.y + Math.sin(pa) * r, Math.cos(pa) * 60, Math.sin(pa) * 60, 0.4, pick(SKC), { glow: Math.random() < 0.4, drag: 2 }); }
  shake(5); AudioMan.slash(); AudioMan.cutHit();
}
// 影の三重輪: 0.75秒(影の王を中心に A・B(激昂時は C も)の範囲)→ A: 半径 0〜80 → 0.5秒後に B: 80〜160 → 激昂時はさらに 0.5秒後に C: 160〜240。それぞれ ×1.0・外へ 40 押す
const SKR_W = 80; // 輪の幅
function skRings(e, ai) {
  const n = ai.enraged ? 3 : 2, x = e.x, y = e.y;
  for (let i = 0; i < n; i++) pushWarn({ kind: 'ring', x, y, r0: i * SKR_W, r: (i + 1) * SKR_W, t: 0, life: 0.75 + i * 0.5 });
  ai.act = 'busy'; ai.pt = 0.75 + (n - 1) * 0.5 + 0.3;
  bfx.push({ kind: 'skaura', x, y, t: 0, life: ai.pt, r: n * SKR_W * CHAOS.area });
  AudioMan.charge(0.75);
  for (let i = 0; i < n; i++) later(ai, 0.75 + i * 0.5, () => skRingHit(e, x, y, i * SKR_W, (i + 1) * SKR_W));
}
function skRingHit(e, x, y, r0, r1) {
  if (e.dead) return;
  const R0 = r0 * CHAOS.area, R1 = r1 * CHAOS.area;
  forHit(() => { const d = Math.sqrt(d2(x, y, P.x, P.y)); if (d >= R0 - 3 && d <= R1 + 3 && hurtPlayer(e.dmg)) pushPlayer(d > 1 ? Math.atan2(P.y - y, P.x - x) : rand(0, TAU), 40, 0.18); });
  bfx.push({ kind: 'skring', x, y, r0: R0, r1: R1, t: 0, life: 0.45 });
  const n = Math.round(12 + R1 * 0.5);
  for (let i = 0; i < n; i++) { const pa = TAU / n * i + rand(-0.1, 0.1), r = rand(R0, R1); part(x + Math.cos(pa) * r, y + Math.sin(pa) * r, Math.cos(pa) * 70, Math.sin(pa) * 50 - rand(10, 40), rand(0.4, 0.7), pick(SKC), { glow: Math.random() < 0.4, drag: 2, sz: pick([1, 2]) }); }
  shockAt(x, y, Math.min(3, 1.2 + R1 / 100), 0.8); shake(4 + R1 / 40); AudioMan.thud(); AudioMan.zap(); // 外の輪ほど強い(衝撃波は 3 まで)
}
// 影刃・五月雨: 0.4秒(3本の帯)→ 地面に垂直に立った斬撃を 3方向(プレイヤーへの向きと ±25°)に飛ばし、0.4秒後に間の 2方向(±12.5°)へ(速さ 300、射程 500、×1.0)
const SKB_SPD = 300, SKB_LEN = 500;
function skBlades(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  for (const da of [-0.436, 0, 0.436]) pushWarn({ kind: 'line', x: e.x, y: e.y, a: a + da, len: SKB_LEN, w: 10, t: 0, life: 0.4 });
  ai.act = 'busy'; ai.pt = 1.0;
  AudioMan.charge(0.4);
  later(ai, 0.4, () => {
    for (const da of [-0.436, 0, 0.436]) skVSlash(e, a + da);
    for (const da of [-0.218, 0.218]) pushWarn({ kind: 'line', x: e.x, y: e.y, a: a + da, len: SKB_LEN, w: 10, t: 0, life: 0.4 });
    later(ai, 0.4, () => { for (const da of [-0.218, 0.218]) skVSlash(e, a + da); });
  });
}
function skVSlash(e, a) {
  if (e.dead) return;
  eprojs.push({ kind: 'vslash', x: e.x, y: e.y, vx: Math.cos(a) * SKB_SPD, vy: Math.sin(a) * SKB_SPD, a, dmg: e.dmg * (S.eatk ?? 1), life: SKB_LEN / SKB_SPD * CHAOS.area, t: 0, r: 3 * CHAOS.area, len: 12 * CHAOS.area, taint: !e.shadow ? (e.ai.enraged ? 2 : 1) : 0 });
  burst(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 10, SKC, { sp: 80, glow: true, life: 0.3 });
  AudioMan.slash();
}
// 追い影: 0.5秒(手に闇が集まり、出る場所に影だまり)→ プレイヤーの周り(110 離れて 360°/n おき)から 3発(激昂 5発)。
//   加速しながら追う(速さ 20 から毎秒 +10、最大 180。速いほど曲がりにくい。10秒で消える。×0.8)
function skChase(e, ai) {
  ai.act = 'busy'; ai.pt = 0.7; ai.handGlow = 0.5;
  const n = ai.enraged ? 5 : 3, a0 = rand(0, TAU), spots = [];
  for (let i = 0; i < n; i++) spots.push({ x: P.x + Math.cos(a0 + TAU / n * i) * 110, y: P.y + Math.sin(a0 + TAU / n * i) * 110 });
  for (const s of spots) bfx.push({ kind: 'spool', x: s.x, y: s.y, t: 0, life: 0.6 });
  AudioMan.charge(0.5);
  later(ai, 0.5, () => {
    if (e.dead) return;
    for (const s of spots) {
      const sa = Math.atan2(P.y - s.y, P.x - s.x);
      eprojs.push({ kind: 'hshadow', x: s.x, y: s.y, vx: Math.cos(sa) * 20, vy: Math.sin(sa) * 20, sp: 20, dmg: e.dmg * 0.8 * (S.eatk ?? 1), life: 10, t: 0, r: 4 * CHAOS.area, taint: !e.shadow ? (ai.enraged ? 2 : 1) : 0 });
      burst(s.x, s.y, 16, SKC, { sp: 80, up: 30, glow: true, life: 0.45 }); addRing(s.x, s.y, 12, '#a66bff', { life: 0.3 }); // 影だまりから立ちのぼる
    }
    burst(e.x, e.y - 6, 22, SKC, { sp: 90, glow: true, life: 0.45 }); addRing(e.x, e.y - 6, 14, '#a66bff', { life: 0.3 }); AudioMan.shade2();
  });
}
// 追い影の向きを変える: 速くなるほど曲がりにくい
function homeShadow(p, dt) {
  p.sp = Math.min(180, p.sp + 10 * dt);
  const cur = Math.atan2(p.vy, p.vx), turn = 4.2 / (1 + p.sp / 40), na = cur + clamp(angDiff(Math.atan2(P.y - p.y, P.x - p.x), cur), -turn * dt, turn * dt);
  p.vx = Math.cos(na) * p.sp; p.vy = Math.sin(na) * p.sp;
}
// 断界: 1.2秒(影の王を通って、プレイヤーの方向と反対の方向へ、画面の端まで届く細い線が点滅)→ 一瞬で伸びる終わりのない細い斬撃(幅 10)。当たると即死
//   激昂時は 2本(2本目は 0.5秒後に、90° 回した向きへ)。斬った跡は裂け目として 15秒残り、プレイヤーだけ通れない
const SEVER_LEN = 1600;
const severWarn = (e, a, life) => { for (const aa of [a, a + Math.PI]) pushWarn({ kind: 'line', x: e.x, y: e.y, a: aa, len: SEVER_LEN, w: 10, t: 0, life, sever: true }); };
function skSever(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  ai.act = 'busy'; ai.pt = ai.enraged ? 2.2 : 1.6; ai.sevT = 1.2;
  severWarn(e, a, 1.2);
  AudioMan.charge(1.2); AudioMan.warning();
  later(ai, 1.2, () => skCut(e, a));
  if (ai.enraged) later(ai, 1.2, () => {
    if (e.dead) return;
    severWarn(e, a + Math.PI / 2, 0.5);
    later(ai, 0.5, () => skCut(e, a + Math.PI / 2));
  });
  hint('sever', _t('断界'), _t('当たると即死。斬った跡は 15秒 越えられない'));
}
function skCut(e, a) {
  if (e.dead) return;
  const L = SEVER_LEN * CHAOS.area, W = 10 * CHAOS.area;
  for (const aa of [a, a + Math.PI]) { // 影の王を通って両側へ
    addHazard('rift', e.x, e.y, { a: aa, len: L, w: W, dur: 15 });
    bfx.push({ kind: 'sever', x: e.x, y: e.y, a: aa, len: L, t: 0, life: 0.5 });
    for (let d = 0; d < 520; d += 6) part(e.x + Math.cos(aa) * d + rand(-3, 3), e.y + Math.sin(aa) * d + rand(-3, 3), rand(-30, 30), rand(-60, -10), rand(0.4, 0.8), pick([...SKC, '#ffffff']), { glow: Math.random() < 0.5, drag: 1.5, sz: pick([1, 2]) });
  }
  hitstop(0.12, true); shake(14); screenFlash(0.45, '#7a3ab0'); shockAt(e.x, e.y, 2.8, 0.55); AudioMan.sever();
  if (state === 'play' && !P.dead && (inLine(e.x, e.y, a, SEVER_LEN, 10) || inLine(e.x, e.y, a + Math.PI, SEVER_LEN, 10))) skKill();
}
// 即死(断界): 回避の無敵・ガード系の防御で防げる。不死鳥の(蘇生)は効く
function skKill() {
  if (P.invT > 0) return;
  if (clsOnHurt(Math.max(1, P.hp)) === null) { S.hudDirty = true; return; }
  P.hp = 0; breakCombo(); S.hudDirty = true;
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 1.6);
  burst(P.x, P.y, 60, ['#e8c8ff', '#a66bff', '#2a1240', '#ffffff'], { sp: 180, life: 0.7 }); AudioMan.hurt();
  playerDown();
}
// 冥鎖(激昂): 1.5秒 ゲーム全体が止まる(影の王が鎖の杭を落とす)→ プレイヤーの位置に杭(HP は影の王の最大HP の 30%)が刺さり、鎖でつながる
function skChain(e, ai) {
  ai.act = 'busy'; ai.pt = 0.4;
  S.cine = { kind: 'chain', t: 0, dur: 1.5, x: P.x, y: P.y, king: e, hit: false };
  AudioMan.knell(); AudioMan.hum(1.5); screenFlash(0.3, '#2a1240'); shake(6);
}
// 止まった時の演出(main.js の update から。この間はほかのすべてが止まる)
function updCine(rdt) {
  const c = S.cine;
  c.t += rdt;
  if (c.kind === 'chain') {
    if (!c.hit && c.t >= 0.55) { c.hit = true; shake(12); screenFlash(0.35, '#a66bff'); shockAt(c.x, c.y, 2.4, 0.6); AudioMan.crush(); AudioMan.boom(); }
    if (c.t >= 0.75 && Math.floor(c.t * 12) !== Math.floor((c.t - rdt) * 12)) AudioMan.chain();
  }
  if (c.t < c.dur) return;
  S.cine = null;
  if (c.kind === 'chain') chainStart(c);
}
function chainStart(c) {
  const e = c.king;
  if (e.dead || P.dead) return;
  const st = spawnObj(e, 'stake', c.x, c.y, { pct: 0.3, r: 8, life: Infinity }); st.rise = 1;
  P.chain = { stake: st, tick: 3 };
  bossBlast(c.x, c.y, 30, Object.assign({ n: 16 }, BFX.shadowking));
  burst(c.x, c.y, 50, [...SKC, '#5a5a6a'], { sp: 150, up: 40, g: 200, life: 0.7 });
  shake(8); AudioMan.chain(); AudioMan.thud();
  hint('mchain', _t('冥鎖'), _t('杭から離れるほど引き戻される。杭を壊すと切れ、闇の霧が 20秒 遅れる'));
}
// 鎖: 杭から 50 までは引かれない。その先は離れた距離 × 1 の速さで引き戻される。つながっている間は 3秒ごとに毒 +1
function updChain(dt) {
  const ch = P.chain;
  if (!ch) return;
  const st = ch.stake;
  if (st.dead || P.dead) { P.chain = null; return; }
  const d = Math.sqrt(d2(P.x, P.y, st.x, st.y));
  if (d > 50) {
    const k = Math.min(d - 50, (d - 50) * dt);
    P.x += (st.x - P.x) / d * k; P.y += (st.y - P.y) / d * k;
    if (Math.random() < dt * 6) AudioMan.chain();
  }
  if ((ch.tick -= dt) <= 0) { ch.tick = 3; poisonPlayer(1); }
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
// 影(影の王が呼んだボス): 黒い体に紫の縁取り。光る所(目など)は紫に光る
function drawShade(sp, x, y, o) {
  const sx = GFX.sctx, gx = GFX.gctx, img = o.flip ? ART.variant(sp, 'flip') : sp.c, sc = o.scale || 1;
  const w = Math.round(sp.w * sc * (o.sxk || 1)), h = Math.round(sp.h * sc * (o.sy || 1));
  const dx = Math.round(x - cam.x - w / 2), dy = Math.round(y - cam.y + sp.h * sc / 2 - h);
  const rim = ART.tint(img, o.white ? '#ffffff' : o.rim || '#a66bff');
  sx.globalAlpha = o.alpha ?? 1;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) sx.drawImage(rim, dx + ox, dy + oy, w, h);
  sx.drawImage(ART.tint(img, '#0c0614'), dx, dy, w, h);
  if (sp.e) { const em = o.flip ? ART.variant(sp, 'flipE') : sp.e; sx.drawImage(ART.tint(em, o.emit || '#e8c8ff'), dx, dy, w, h); gx.drawImage(ART.tint(em, o.emitG || '#7a3ab0'), dx, dy, w, h); }
  sx.globalAlpha = 1;
}
// 影の王: 影を呼んでいる間の守り(回る紫の殻と、影へつながる糸)/ 追い影の構え(手に闇)/ 断界の構え(掲げた剣が紫に光る)/ 冥鎖の鎖
function drawSkFx(e, sx, gx, ex, ey) {
  const ai = e.ai, t = GFX.fx.time, sh = ai.shade && !ai.shade.dead ? ai.shade : null;
  if (e.hideA !== undefined && e.hideA < 0.5) { if (P.chain) drawChain(); return; } // 影歩で沈んでいる
  if (sh || ai.act === 'summon') { // 守りの殻: 回る紫の破線の輪(2重)
    ellBoth(sx, gx, ex, ey + 2, 18, 16, '#a66bff', 0.55 + 0.2 * Math.sin(t * 6), dimCol('#a66bff', 0.35), 14, t * 2);
    ellBoth(sx, gx, ex, ey + 2, 23, 20, '#7a3ab0', 0.35, dimCol('#7a3ab0', 0.25), 10, -t * 1.4);
    addLight(e.x, e.y, 60, '#7a3ab0', 0.5);
  }
  if (sh) { // 影へつながる紫の糸(脈が影へ流れる)
    const x1 = sh.x - cam.x, y1 = sh.y - cam.y, L = Math.hypot(x1 - ex, y1 - ey) || 1, n = Math.max(2, Math.round(L / 3)), nx = -(y1 - ey) / L, ny = (x1 - ex) / L;
    for (let i = 0; i <= n; i++) {
      const u = i / n, wv = Math.sin(u * Math.PI) * Math.sin(t * 7 + u * 9) * 4, px = Math.round(ex + (x1 - ex) * u + nx * wv), py = Math.round(ey + (y1 - ey) * u + ny * wv), on = (i + Math.floor(t * 30)) % 8 < 2;
      sx.fillStyle = on ? '#e8c8ff' : '#5a2a8a'; sx.fillRect(px, py, 1, 1);
      if (on) { gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); }
    }
  }
  if (ai.act === 'summon') { // 影喚び: 掲げた剣の先に闇が集まる
    const hx = ex + (e.face || 1) * 9, hy = ey - 20, k = 0.5 + 0.5 * Math.sin(t * 20);
    pDisc(sx, hx, hy, 3, '#1a0a2a'); pCircle(sx, hx, hy, 4 + Math.round(k), '#c79bff'); pCircle(gx, hx, hy, 5, dimCol('#a66bff', 0.7));
    addLight(e.x + (e.face || 1) * 9, e.y - 20, 50, '#a66bff', 0.9);
  }
  if (ai.handGlow > 0) { // 追い影の構え: 手に闇の玉が膨らむ
    const k = 1 - ai.handGlow / 0.5, hx = ex + (e.face || 1) * 8, hy = ey - 4;
    pDisc(sx, hx, hy, Math.round(2 + 4 * k), '#1a0a2a'); pCircle(sx, hx, hy, Math.round(3 + 4 * k), '#a66bff'); pCircle(gx, hx, hy, Math.round(3 + 4 * k), dimCol('#a66bff', 0.6));
    addLight(e.x + (e.face || 1) * 8, e.y - 4, 30 + 40 * k, '#a66bff', 0.8);
  }
  if (warns.some(w => w.sever && !w.snap)) { // 断界の構え: 剣が紫に光り、刃から闇がこぼれる
    const fl = Math.floor(t * 16) % 2, bx = ex + (e.face || 1) * 7;
    pLine(sx, bx, ey - 26, bx, ey + 10, fl ? '#e8c8ff' : '#a66bff', 2); pLine(gx, bx, ey - 26, bx, ey + 10, dimCol('#a66bff', 0.7), 2);
    addLight(e.x + (e.face || 1) * 7, e.y - 8, 70, '#a66bff', 0.9);
  }
  if (P.chain) drawChain();
}
// 冥鎖の鎖: 杭の輪からプレイヤーへ。張るほどまっすぐになり、紫の光が走る。足元に鎖の輪
function drawChain() {
  const st = P.chain && P.chain.stake;
  if (!st || st.dead) return;
  const sx = GFX.sctx, gx = GFX.gctx, x0 = st.x - cam.x, y0 = st.y - 14 - cam.y, x1 = P.x - cam.x, y1 = P.y - 2 - cam.y, d = Math.hypot(x1 - x0, y1 - y0), taut = clamp((d - 50) / 30, 0, 1), t = GFX.fx.time;
  const n = Math.max(2, Math.round(d / 3));
  for (let i = 0; i <= n; i++) {
    const u = i / n, sag = (1 - taut) * Math.sin(u * Math.PI) * Math.min(12, d * 0.25), px = Math.round(x0 + (x1 - x0) * u), py = Math.round(y0 + (y1 - y0) * u + sag);
    sx.fillStyle = '#0c0913'; sx.fillRect(px - 1, py - 1, 3, 3);
    sx.fillStyle = i % 2 ? '#5a5a6a' : '#9a9aaa'; sx.fillRect(px, py, i % 2 ? 1 : 2, 1);
    if (taut > 0.3 && (i + Math.floor(t * 24)) % 6 === 0) { sx.fillStyle = '#e8c8ff'; sx.fillRect(px, py, 1, 1); gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); }
  }
  ellBoth(sx, gx, x1, y1 + 8, 6, 3, '#9a9aaa', 0.9, dimCol('#7a3ab0', 0.3 + 0.4 * taut));
  addLight(P.x, P.y, 30 + 30 * taut, '#7a3ab0', 0.3 + 0.4 * taut);
}
// 冥鎖の止まった時: 画面が暗く沈み、空から黒い杭が落ちて刺さり、鎖がプレイヤーへ巻きつく
function drawCine() {
  const c = S.cine;
  if (!c || c.kind !== 'chain') return;
  const sx = GFX.sctx, gx = GFX.gctx, t = c.t, x = c.x - cam.x, y = c.y - cam.y;
  sx.globalAlpha = Math.min(0.55, t * 2); sx.fillStyle = '#06030c'; sx.fillRect(0, 0, GFX.VW, GFX.VH); sx.globalAlpha = 1;
  const k = Math.min(1, t / 0.55), sp = ART.S.obj_stake;
  if (t < 0.55) { const u = 1 - k * k; pLine(sx, x, y - 240, x, y - u * 200 - 10, '#2a1240', 1); } // 落ちてくる跡
  drawSp(sp, c.x, c.y - (1 - k * k) * 200 - 10, { scale: 1.5 });
  addLight(c.x, c.y - (1 - k * k) * 200 - 10, 50, '#a66bff', 0.9);
  if (t >= 0.55) {
    const u = Math.min(1, (t - 0.55) / 0.35);
    pCircle(sx, x, y, Math.round(8 + 40 * u), u < 1 ? '#e8c8ff' : '#a66bff'); pCircle(gx, x, y, Math.round(8 + 40 * u), dimCol('#a66bff', 0.7 * (1 - u)), 2);
    for (let i = 0; i < 6; i++) { const a = TAU / 6 * i + 0.3, L = 10 + 26 * u; pLine(sx, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L * 0.5, '#7a3ab0'); } // 床に走るひび
    const ch = clamp((t - 0.7) / 0.6, 0, 1); // 鎖がプレイヤーへ巻きつく(輪が下から順に締まる)
    for (let r = 0; r < 3; r++) { const v = clamp(ch * 3 - r, 0, 1); if (v <= 0) continue; const ry = y + 4 - r * 6; ellBoth(sx, gx, x, ry, 9 - v * 3, (9 - v * 3) * 0.4, r % 2 ? '#5a5a6a' : '#9a9aaa', 0.95, dimCol('#a66bff', 0.5 * v)); }
    addLight(c.x, c.y, 90, '#a66bff', 0.8 * (1 - u * 0.5));
  }
}
// 断界の裂け目(影の王): 黒い裂け目の縁が紫に光り、ときどき白く走る(この線は越えられない)
HAZ_DRAW.rift = (h, hx, hy, fade, hd) => {
  const { t, sx, warnBlink, gx } = hd;
  const c = Math.cos(h.a), s = Math.sin(h.a), x1 = hx + c * h.len, y1 = hy + s * h.len, fl = Math.floor(t * 10 + h.seed) % 7 === 0;
  pLine(sx, hx, hy, x1, y1, '#06030c', 4);
  pLine(sx, hx - s * 2, hy + c * 2, x1 - s * 2, y1 + c * 2, warnBlink ? '#a66bff' : '#7a3ab0'); pLine(sx, hx + s * 2, hy - c * 2, x1 + s * 2, y1 - c * 2, warnBlink ? '#a66bff' : '#7a3ab0');
  if (fl) pLine(sx, hx, hy, x1, y1, '#e8c8ff');
  pLine(gx, hx, hy, x1, y1, dimCol('#a66bff', 0.45 * fade), 2);
  for (let d = 0; d < h.len; d += 70) { const lx = h.x + c * d, ly = h.y + s * d; if (onScreen(lx, ly, 40)) addLight(lx, ly, 60, '#7a3ab0', 0.4 * fade); }
};
// 影喚び: 床に影の門が開く(黒い楕円が広がり、紫のルーンが回る)→ 影が出ると閉じる
BFX_DRAW.portal = (f, fx, fy, u, bd) => {
  const { sx, gx, t } = bd;
  const k = Math.min(1, f.t / 0.5), close = f.t > 1.25 ? Math.max(0, 1 - (f.t - 1.25) / 0.45) : 1, R = f.r * easeOutCubic(k) * close;
  if (R >= 1) {
    sx.globalAlpha = 0.85; sx.fillStyle = '#06030c'; sx.beginPath(); sx.ellipse(fx, fy, R, R * 0.45, 0, 0, TAU); sx.fill(); sx.globalAlpha = 1;
    ellBoth(sx, gx, fx, fy, R, R * 0.45, '#a66bff', 0.9, dimCol('#a66bff', 0.6));
    ellBoth(sx, gx, fx, fy, R * 0.7, R * 0.32, '#7a3ab0', 0.8, dimCol('#7a3ab0', 0.4), 12, t * 2);
    for (let i = 0; i < 8; i++) { const a = t * 1.5 + TAU / 8 * i, px = Math.round(fx + Math.cos(a) * R * 0.85), py = Math.round(fy + Math.sin(a) * R * 0.38); sx.fillStyle = '#e8c8ff'; sx.fillRect(px, py - 1, 1, 3); sx.fillRect(px - 1, py, 3, 1); gx.fillStyle = '#4a1a7a'; gx.fillRect(px, py, 1, 1); } // ルーン
    for (let k2 = 0; k2 < 3; k2++) part(f.x + rand(-R, R) * 0.8, f.y + rand(-R, R) * 0.3, rand(-6, 6), -rand(20, 60), rand(0.4, 0.8), pick(['#0a0612', '#2a1240', '#7a3ab0']), { drag: 1, sz: pick([1, 2]) }); // 門から闇が立ちのぼる
    addLight(f.x, f.y, R * 3, '#7a3ab0', 0.7 * close);
  }
  return;
};
// 影歩: 影だまり(沈む = 縮んで消える / 出る = 広がって脈打つ)
BFX_DRAW.spool = (f, fx, fy, u, bd) => {
  const { sx, gx } = bd;
  const k = f.sink ? 1 - u : Math.min(1, u * 2), R = 4 + 9 * k;
  sx.globalAlpha = 0.85 * (f.sink ? 1 : Math.min(1, (1 - u) * 3)); sx.fillStyle = '#06030c'; sx.beginPath(); sx.ellipse(fx, fy + 4, R, R * 0.45, 0, 0, TAU); sx.fill(); sx.globalAlpha = 1;
  ellBoth(sx, gx, fx, fy + 4, R, R * 0.45, '#a66bff', 0.8, dimCol('#a66bff', 0.5));
  return;
};
// 影の三重輪の構え: 足元から闇が渦を巻いて広がる
BFX_DRAW.skaura = (f, fx, fy, u, bd) => {
  const { sx, gx, t } = bd;
  const R = f.r * Math.min(1, u * 1.6);
  for (let i = 0; i < 3; i++) ellBoth(sx, gx, fx, fy + 2, R * (0.4 + 0.3 * i), R * (0.4 + 0.3 * i) * 0.9, i % 2 ? '#7a3ab0' : '#a66bff', 0.5, dimCol('#7a3ab0', 0.3), 10 + i * 4, t * (2 + i) * (i % 2 ? -1 : 1));
  if (Math.random() < 0.6) { const a = rand(0, TAU), r = rand(0.3, 1) * R; part(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, -Math.sin(a) * 40, Math.cos(a) * 40 - 10, 0.5, pick(SKC.slice(0, 4)), { glow: Math.random() < 0.3, drag: 1 }); }
  addLight(f.x, f.y, R * 1.6, '#7a3ab0', 0.5);
  return;
};
// 影の三重輪の炸裂: 輪の形に闇が噴き上がり、縁が光る
BFX_DRAW.skring = (f, fx, fy, u, bd) => {
  const { sx, gx } = bd;
  const fade = 1 - u, R0 = f.r0, R1 = f.r1;
  sx.globalAlpha = 0.5 * fade; sx.fillStyle = '#2a1240'; sx.beginPath(); sx.arc(fx, fy, R1, 0, TAU); if (R0 > 0) sx.arc(fx, fy, R0, 0, TAU, true); sx.fill('evenodd'); sx.globalAlpha = 1;
  sx.globalAlpha = fade; pCircle(sx, fx, fy, Math.round(R1), '#e8c8ff'); if (R0 > 0) pCircle(sx, fx, fy, Math.round(R0), '#a66bff'); sx.globalAlpha = 1;
  pCircle(gx, fx, fy, Math.round(R1), dimCol('#a66bff', 0.7 * fade), 2);
  if (R0 > 0) { const Rm = (R0 + R1) / 2; for (let k = 0; k < 8; k++) addLight(f.x + Math.cos(TAU / 8 * k) * Rm, f.y + Math.sin(TAU / 8 * k) * Rm, (R1 - R0) * 0.9, '#a66bff', 0.55 * fade); } // 外の輪: 輪のところだけ照らす(中の安全な所は暗いまま)
  else addLight(f.x, f.y, R1 * 1.3, '#a66bff', 0.7 * fade);
  return;
};
// 断界: 一瞬で伸びる終わりのない斬撃(白い芯・紫の光・黒い縁)
BFX_DRAW.sever = (f, fx, fy, u, bd) => {
  const { sx, gx } = bd;
  const c = Math.cos(f.a), s = Math.sin(f.a), x1 = fx + c * f.len, y1 = fy + s * f.len, fade = 1 - u, w = Math.max(1, Math.round(6 * fade));
  pLine(sx, fx, fy, x1, y1, '#06030c', w + 4); pLine(sx, fx, fy, x1, y1, '#a66bff', w + 2); pLine(sx, fx, fy, x1, y1, '#ffffff', w);
  pLine(gx, fx, fy, x1, y1, dimCol('#a66bff', 0.8 * fade), w + 2);
  for (let d = 0; d < Math.min(f.len, 600); d += 50) addLight(f.x + c * d, f.y + s * d, 80, '#a66bff', 0.9 * fade);
  return;
};
