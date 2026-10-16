// enemies.js — 敵(出現・通常敵の動きと攻撃)
'use strict';

// ============================================================
// 敵
// ============================================================
function spawnEnemy(type, o = {}) {
  const d = DATA.enemies[type];
  let x = o.x, y = o.y;
  if (x === undefined) {
    const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16;
    x = P.x + Math.cos(a) * R; y = P.y + Math.sin(a) * R;
  }
  const EL = DATA.enemyLevel, base = enemyBase();
  const hpk = base * hpK() * (o.elite ? EL.elite : 1) * (S.tower ? S.tower.hpK : 1); // タワー: 人数の倍率
  const spk = base * Math.min(EL.spdMax, lvK('spd')) * (P.uq.clock ? 1.15 : 1) * (o.elite ? 1.1 : 1); // 狂時の: 速度 +15%
  const e = {
    id: nextId++, type, x, y, hp: d.hp * hpk, maxhp: d.hp * hpk, spd: d.spd * spk * rand(0.9, 1.1), dmg: d.dmg * enemyDmgK() * (o.elite ? EL.eliteDmg : 1),
    rateK: o.elite ? EL.eliteRate : 1, areaK: o.elite ? EL.eliteArea : 1, // エリート: 攻撃速度・攻撃範囲
    r: d.r * (o.elite ? 2 : 1), xp: d.xp * lvK('xp'), ai: d.ai, kbRes: o.elite ? 0.9 : d.kbRes || 0, ghost: d.ghost,
    t: rand(0, 5), seed: Math.random(), kx: 0, ky: 0, flash: 0, elite: !!o.elite, scale: o.elite ? 2 : 1,
    frost: 0, frostT: 0, burns: [], burnT: 0, burnTick: 0, stun: 0, slowT: 0, bleed: 0, bleedT: 0, shotT: (d.shot || d.throw || d.rush || d.puff || d.lantern || d.snowball || d.blink || d.warp || d.strike || d.swipe || d.swoop || d.pit) ? rand(1, (d.shot || d.throw || d.rush || d.puff || d.lantern || d.snowball || d.blink || d.warp || d.strike || d.swipe || d.swoop || d.pit).cd) : 0, wind: 0, hopT: rand(0, 1),
    life: type === 'goblin' ? 16 : 0,
    noChest: !!o.noChest, phaseElite: !!o.phaseElite, // 宝箱を落とさない / エリート群のエリート
  };
  if (d.burrow) Object.assign(e, { under: true, hidden: true, flying: true, air: true, rise: 0 }); // マグマワーム: 地中から始まる
  if (d.pit) Object.assign(e, { hidden: true, flying: true, air: true }); // アリジゴク: 砂の中から始まる(見えない・攻撃が当たらない)
  enemies.push(e);
  if (d.pair && !o.mate) { // 対の雷精: 相方も出す(2体で 1組。線の状態 pr を共有。1体目 twinIdx 0 が組の時計を進める)
    const m = spawnEnemy(type, { x: x + rand(-14, 14), y: y + rand(-14, 14), mate: e, noChest: o.noChest });
    e.mate = m; m.mate = e; e.twinIdx = 0; m.twinIdx = 1; e.pr = m.pr = { ph: 'chase', t: 0, ang: 0, tick: 0 };
  }
  return e;
}

function spawnProp() {
  const a = rand(0, TAU), R = rand(180, 260);
  const e = spawnEnemy('zombie', { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
  Object.assign(e, { type: 'brazier', prop: true, hidden: true, hp: 1, maxhp: 1, spd: 0, dmg: 0, r: 4, ai: 'none', xp: 0, kbRes: 1 });
}

// ---------- 通常敵の攻撃 ----------
// 射撃(弓兵・火の小鬼・砂術師): 弾のダメージ = その敵のダメージ × n。count 発を spread rad おきの扇に(count が [最小, 最大] なら1回ごとにランダム)
const SHOT_R = { arrow: 2, efire: 3, esand: 2.5, eice: 2.5, darkorb: 3, tspark: 2.5 }; // 弾の当たり判定の半径(見た目の大きさ。攻撃範囲の倍率で広がる)
function enemyShoot(e, s, a) {
  const n = Array.isArray(s.count) ? randi(s.count[0], s.count[1]) : s.count || 1;
  for (let i = 0; i < n; i++) {
    const aa = a + (i - (n - 1) / 2) * (s.spread || 0);
    eprojs.push({ kind: s.kind, x: e.x, y: e.y - 2, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, dmg: e.dmg * s.n * S.eatk, burn: s.burn ? e.dmg * s.burn * S.eatk : 0, frost: s.frost || 0, dark: s.dark || 0, numb: s.numb || 0, life: 4, t: 0, r: (SHOT_R[s.kind] || 3) * CHAOS.area * e.areaK, sk: e.areaK }); // sk: 弾の見た目の大きさ(エリートは範囲 ×1.5)
  }
  if (MAGE_COL[e.type]) { const M = MAGE_COL[e.type], tx = e.x + (e.face || 1) * 3.5, ty = e.y - 7; burst(tx, ty, 10, M, { sp: 50, glow: true, life: 0.3 }); addRing(tx, ty, 8, M[0], { life: 0.25 }); } // メイジ: 杖の珠から放つ
  if (s.kind === 'tspark') { for (let k = 0; k < 3; k++) { const ba = a + rand(-0.8, 0.8), r = rand(6, 11); bolts.push({ x0: e.x, y0: e.y - 2, x1: e.x + Math.cos(ba) * r, y1: e.y - 2 + Math.sin(ba) * r, t: 0, life: 0.12, w: 1, jit: 2, gcol: '#3a2478' }); } AudioMan.zap(); }
  if (s.kind === 'darkorb') { burst(e.x + Math.cos(a) * 4, e.y - 2 + Math.sin(a) * 4, 12, ['#c79bff', '#7a3ab0', '#2a1240', '#ffffff'], { sp: 55, glow: true, life: 0.35 }); addRing(e.x, e.y - 2, 9, '#a66bff', { life: 0.25 }); AudioMan.shade2(); }
  if (s.kind === 'eice') { burst(e.x + Math.cos(a) * 4, e.y - 2 + Math.sin(a) * 4, 7, ['#9ff7ff', '#ffffff', '#7ad7ff'], { sp: 45, glow: true, life: 0.3 }); AudioMan.frost(); }
  if (s.kind === 'efire') { burst(e.x + Math.cos(a) * 4, e.y - 2 + Math.sin(a) * 4, 7, ['#ff6a2a', '#ffc34a', '#fff6c8'], { sp: 45, glow: true, life: 0.3 }); AudioMan.fire(); }
  else if (s.kind === 'esand') { burst(e.x, e.y - 2, 12, ['#e8c88a', '#c8a060', '#fff0c0'], { sp: 60, life: 0.4, drag: 2 }); addRing(e.x, e.y + 3, 10, '#e8c88a', { life: 0.3 }); }
}
// 闇の玉(影の眼): プレイヤーに 50 まで近づくか、消える時(4秒)に、プレイヤーの方向へ 4つに割れる(±6°・±17°、速さ 100、2.5秒。割れた玉も当たると暗闇)
function splitDarkOrb(p) {
  const a = Math.atan2(P.y - p.y, P.x - p.x), sk = p.sk || 1;
  for (const da of [-0.3, -0.1, 0.1, 0.3]) eprojs.push({ kind: 'darkorb', frag: true, x: p.x, y: p.y, vx: Math.cos(a + da) * 100, vy: Math.sin(a + da) * 100, dmg: p.dmg, dark: p.dark, life: 2.5, t: 0, r: 2 * CHAOS.area * sk, sk });
  burst(p.x, p.y, 18, ['#c79bff', '#7a3ab0', '#2a1240', '#ffffff'], { sp: 80, glow: true, life: 0.35 });
  addRing(p.x, p.y, 12, '#a66bff', { r0: 3, life: 0.25 }); addFlash(p.x, p.y, 40, '#a66bff', 0.4); AudioMan.shade2();
}
// ホーリーメイジの光のビーム: 予告の帯の向きへ、白金の光線が一瞬で走る(当たると ×n・乱光 +light)
function holyBeam(e, bm) {
  const x = e.x, y = e.y - 4, a = e.ta, len = bm.len * e.areaK, w = bm.w * e.areaK;
  if (hitLine(x, y, a, len, w, e.dmg * bm.n)) randomLight(bm.light, e.dmg);
  bfx.push({ kind: 'hbeam', x, y, a, len: len * CHAOS.area, w: w * CHAOS.area, t: 0, life: 0.32 });
  const tx = e.x + (e.face || 1) * 3.5, ty = e.y - 7;
  burst(tx, ty, 12, MAGE_COL.holymage, { sp: 60, glow: true, life: 0.3 }); addRing(tx, ty, 9, '#fff6c8', { life: 0.25 });
  for (let i = 0; i < 10; i++) { const u = rand(0.1, 1); part(x + Math.cos(a) * len * u * CHAOS.area, y + Math.sin(a) * len * u * CHAOS.area, rand(-20, 20), rand(-30, -5), rand(0.3, 0.6), pick(['#fff6c8', '#ffe8a0', '#ffffff']), { glow: true, drag: 2 }); } // 光線の跡に残る光の粒
  AudioMan.sparkle(); AudioMan.shoot();
}
// 灯の番人が見つけた: 扇の光が一瞬強まり(白い光の扇)、扇の中にいると ×n・乱光 +light
function lampFlash(e, so) {
  const R0 = so.r * e.areaK;
  if (hitFan(e.x, e.y - 3, e.spotA, R0, so.h, e.dmg * so.n)) randomLight(so.light, e.dmg);
  bfx.push({ kind: 'spotflash', x: e.x, y: e.y - 3, a: e.spotA, r: R0 * CHAOS.area, h: so.h, t: 0, life: 0.35 });
  burst(e.x + (e.face || 1) * 8, e.y - 1, 14, ['#ffffff', '#fff6c8', '#ffd23f'], { sp: 70, glow: true, life: 0.35 });
  AudioMan.sparkle(); AudioMan.zap();
  hint('lampkeeper', _t('灯の番人'), _t('ランタンの光の扇に入り続けると見つかって撃たれる。扇は赤くなると止まるので、横へ出る'));
}
// 玻璃の天使が倒れた: ステンドグラスの体が割れ、ガラスの破片 n枚が全周に飛ぶ(×k・乱光 +light。エリートは遠くまで)
function glassShatter(e, sh) {
  const a0 = rand(0, TAU), sk = e.areaK, life = sh.range * sk / sh.spd;
  for (let i = 0; i < sh.n; i++) { const a = a0 + TAU / sh.n * i; eprojs.push({ kind: 'gshard', ci: i % 4, x: e.x, y: e.y - 4, vx: Math.cos(a) * sh.spd, vy: Math.sin(a) * sh.spd, dmg: e.dmg * sh.k, light: sh.light, src: e.dmg, life, t: 0, r: 2.5 * CHAOS.area * sk, sk, rot: rand(0, TAU) }); }
  burst(e.x, e.y - 6, 26, ['#e84860', '#58d878', '#4878e8', '#ffd23f', '#ffffff'], { sp: 110, glow: true, life: 0.45 }); addRing(e.x, e.y - 4, 16, '#fff6c8', { r0: 4, life: 0.3 });
  AudioMan.chime(); AudioMan.crush();
  hint('glassangel', _t('玻璃の天使'), _t('倒すと割れて、ガラスの破片が全方向に飛ぶ。離れて倒すか、破片のすき間へ'));
}
// メイジのバフ: まわり(半径 r。広がる輪で見せる)の敵に dur 秒(自分にも。ボス・ボスが出した物・篝火は除く)。同じバフはかけ直すと時間が戻る
const MAGE_HINT = {
  firemage: bf => [_t('ファイアーメイジ'), _t`まわりの敵の攻撃力 +${Math.round(bf.v * 100)}%(${bf.dur}秒。足元に橙の輪)`],
  frostmage: bf => [_t('フロストメイジ'), _t`まわりの敵の被ダメージ −${Math.round(bf.v * 100)}%(${bf.dur}秒。足元に水色の輪)`],
  thundermage: bf => [_t('サンダーメイジ'), _t`まわりの敵の移動速度 +${Math.round(bf.v * 100)}%(${bf.dur}秒。足元に黄色の輪)`],
  holymage: bf => [_t('ホーリーメイジ'), _t`まわりの敵の HP を回復する(ホーリーメイジの最大HP の ${Math.round(bf.v * 100)}% ぶん)`],
};
function mageBuff(e, bf) {
  const R = bf.r * e.areaK, C = BUFF_COL[bf.k], M = MAGE_COL[e.type], t1 = S.time + bf.dur;
  for (const o of enemies) {
    if (o.dead || o.boss || o.obj || o.prop || d2(o.x, o.y, e.x, e.y) > R * R) continue;
    if (bf.k === 'heal') { // ホーリーメイジ: HP を最大HP × v だけ回復(金の十字の光が昇る)
      const add = Math.min(o.maxhp - o.hp, e.maxhp * bf.v);
      if (add > 0) { o.hp += add; for (let i = 0; i < 6; i++) part(o.x + rand(-5, 5), o.y + rand(-4, 4), 0, -rand(18, 30), 0.6, pick(C.parts), { glow: true, drag: 1 }); }
      addRing(o.x, o.y + 3, 9, C.ring[0], { r0: 3, life: 0.35 });
      continue;
    }
    (o.buffs || (o.buffs = {}))[bf.k] = { t: t1, v: bf.v };
    if (o !== e) addRing(o.x, o.y + 3, 9, C.ring[0], { r0: 3, life: 0.35 });
  }
  e.castT = S.time + 0.6; // 杖を掲げる(render.js)
  const tx = e.x + (e.face || 1) * 3.5, ty = e.y - 7;
  addRing(e.x, e.y, R, C.ring[0], { r0: 8, life: 0.55, w: 2 }); addRing(tx, ty, 12, M[2], { life: 0.3 });
  burst(tx, ty, 16, M, { sp: 60, glow: true, life: 0.45 }); addFlash(tx, ty, 40, C.ring[1], 0.4);
  AudioMan.summon();
  const h = MAGE_HINT[e.type](bf); hint(e.type, h[0], h[1]);
}
// 投槍兵: 予告の帯の長さだけ飛ぶ槍(帯と同じく攻撃範囲の倍率で伸びる。槍の判定の幅 = 帯の幅)
function throwSpear(e, th) {
  const len = th.len * CHAOS.area * e.areaK;
  eprojs.push({ kind: th.kind || 'espear', x: e.x, y: e.y, vx: Math.cos(e.ta) * th.spd, vy: Math.sin(e.ta) * th.spd, dmg: e.dmg * th.n * S.eatk, sta: th.sta || 0, life: len / th.spd, t: 0, r: th.w / 2 * CHAOS.area * e.areaK, sk: e.areaK }); // サハギンの三叉槍はスタミナも減らす
  e.kx -= Math.cos(e.ta) * 30; e.ky -= Math.sin(e.ta) * 30; // 投げた反動で少しのけぞる
  burst(e.x + Math.cos(e.ta) * 6, e.y + Math.sin(e.ta) * 6, 8, ['#c8b89a', '#ffffff', '#7a6a5a'], { sp: 70, life: 0.25 });
  AudioMan.spearThrow();
}
// 鬼火の自爆: 半径 r に ×n と炎上。倒した扱いにはしない(経験値・コンボなし)
function onibiBlast(e, bl) {
  e.dead = true;
  if (hitCircle(e.x, e.y, bl.r * e.areaK, e.dmg * bl.n)) burnPlayer(e.dmg * bl.burn);
  const R = bl.r * CHAOS.area * e.areaK;
  burst(e.x, e.y, 30, ['#7ad7ff', '#ffffff', '#3a8ad0', '#ffc34a', '#ff6a2a'], { sp: 120, glow: true, life: 0.45 });
  for (let i = 0; i < 12; i++) { const pa = TAU / 12 * i; part(e.x, e.y, Math.cos(pa) * R * 3.2, Math.sin(pa) * R * 3.2, 0.3, '#bff4ff', { glow: true, drag: 6, sz: 2 }); } // 炎の輪が半径いっぱいまで走る
  addRing(e.x, e.y, R, '#9fe8ff', { w: 2, life: 0.3 }); addFlash(e.x, e.y, R * 3, '#7ad7ff', 0.8);
  shockAt(e.x, e.y, 0.9, 0.8); shake(3); AudioMan.boom();
}
// スタミナを減らす攻撃(海淵): 0 未満にはならない。青いしずくが散る。受けると 3秒 疲労(スタミナ回復 -50%)
function drainSta(n) {
  if (!(n > 0) || P.dead) return;
  P.sta = Math.max(0, P.sta - n); S.hudDirty = true;
  if (!resistDebuff('fatigue')) P.fatigueT = Math.max(P.fatigueT || 0, DATA.debuff.fatigueDur * CHAOS.debuff); // 疲労は状態異常(金剛で無効になる)
  for (let i = 0; i < 8; i++) part(P.x + rand(-4, 4), P.y - 4 + rand(-3, 3), rand(-40, 40), rand(-50, -10), 0.5, pick(['#7ad7ff', '#bff4ff', '#2a8ac8']), { g: 160, drag: 1 });
  AudioMan.drain();
}
// イエティの雪玉・リスのドングリ: 1秒の放物線。着弾 半径 r に ×n(凍傷 +frost)と、雪の床(floor 秒)。kind: 投げる物の見た目
function yetiThrow(e, sb) {
  const dmg = e.dmg * sb.n, kind = sb.kind || 'snowball', acorn = kind === 'acorn';
  lob(kind, e.x, e.y - (acorn ? 4 : 8), e.tx, e.ty, 1.0, acorn ? 38 : 45, p => {
    if (hitCircle(p.x, p.y, sb.r * e.areaK, dmg) && sb.frost) frostPlayer(sb.frost);
    if (sb.floor) addHazard('snow', p.x, p.y, { r: sb.r * e.areaK, dur: sb.floor, tick: 1 });
    if (acorn) { burst(p.x, p.y, 12, ['#8a5a2a', '#c8a060', '#5a3a1a', '#e8d890'], { sp: 70, up: 30, g: 220, life: 0.45 }); addRing(p.x, p.y, sb.r * CHAOS.area * e.areaK, '#c8a060', { life: 0.25 }); }
    else { burst(p.x, p.y, 22, ['#ffffff', '#e8f4ff', '#bff4ff'], { sp: 90, up: 40, g: 200, life: 0.6 }); addRing(p.x, p.y, sb.r * CHAOS.area * e.areaK, '#ffffff', { life: 0.3 }); }
    AudioMan.thud();
  });
  e.sq = 0.7; e.kx -= Math.cos(Math.atan2(e.ty - e.y, e.tx - e.x)) * 20;
  burst(e.x, e.y - 8, 8, acorn ? ['#c8a060', '#8a5a2a'] : ['#ffffff', '#e8f4ff'], { sp: 40, life: 0.3 }); AudioMan.dash();
}
// 若木が育つ: その場で樹人になる(倒した扱いにしない: 経験値・撃破数なし)。葉が舞い、土が盛り上がる
function growInto(e, into) {
  e.dead = true;
  const o = spawnEnemy(into, { x: e.x, y: e.y });
  o.noChest = e.noChest; o.face = e.face;
  burst(e.x, e.y - 4, 26, ['#8fd06a', '#5a9a48', '#c8e890', '#5a3a1a'], { sp: 80, up: 40, g: 120, life: 0.6 });
  for (let i = 0; i < 10; i++) part(e.x + rand(-8, 8), e.y + rand(-12, 2), rand(-20, 20), -rand(20, 50), rand(0.6, 1), pick(['#8fd06a', '#c8e890', '#5a9a48']), { g: 60, drag: 1.5, sz: pick([1, 2]) }); // 散る葉
  addRing(e.x, e.y + 4, 14, '#8fd06a', { life: 0.3 }); AudioMan.thud();
  hint('sapgrow', _t('若木が育った'), _t('若木は 20秒 生き残ると、根で攻撃する樹人に育つ'));
}
// 足元の一撃(樹人の根): 予告の円の中に ×n。衰弱 +weak・痺れ +numb・砂塵 +dust(当たったときだけ)
function groundStrike(e, st) {
  const R = st.r * e.areaK;
  if (hitCircle(e.tx, e.ty, R, e.dmg * st.n)) { if (st.weak) weakPlayer(st.weak); if (st.numb) numbPlayer(st.numb); if (st.dust) dustPlayer(st.dust); }
  const RR = R * CHAOS.area;
  if (st.kind === 'bolt') skyBolt(e.tx, e.ty, RR, { from: { x: e.x, y: e.y + 2 } }); // 雷雲: 雲の下から稲妻が落ちる
  if (st.kind === 'discharge') { // 雷の甲冑: 掲げた刀に雷が落ち、まわりへ放電する
    skyBolt(e.x, e.y - 16, 0);
    for (let k = 0; k < 7; k++) { const pa = TAU / 7 * k + rand(-0.3, 0.3); bfx.push({ kind: 'ebolt', x: e.x, y: e.y - 6, x1: e.x + Math.cos(pa) * RR, y1: e.y + Math.sin(pa) * RR, t: 0, life: 0.2, w: 1, jit: 4, col: '#c8b8ff' }); }
    addRing(e.x, e.y, RR, '#b8a0ff', { w: 2, life: 0.3 }); shake(3);
  }
  if (st.kind === 'tail') { // サソリの尾: 振り下ろした針が砂を突く
    burst(e.tx, e.ty, 14, SAND, { sp: 80, up: 30, g: 220, life: 0.4 }); addRing(e.tx, e.ty, RR, '#e8c88a', { life: 0.25 }); AudioMan.slash();
  }
  if (st.kind === 'root') { // 根が地面を割って突き上げる
    for (let k = 0; k < 5; k++) { const pa = TAU / 5 * k + rand(-0.3, 0.3), pr = RR * rand(0.2, 0.6); bfx.push({ kind: 'rootspike', x: e.tx + Math.cos(pa) * pr, y: e.ty + Math.sin(pa) * pr, t: 0, life: 0.7, h: rand(7, 12), a: pa }); }
    burst(e.tx, e.ty, 18, ['#5a3a1a', '#8a5a2a', '#3a6a34', '#c8a060'], { sp: 90, up: 40, g: 240, life: 0.5 });
    addRing(e.tx, e.ty, RR, '#8a6a3a', { w: 2, life: 0.3 }); shake(2); AudioMan.thud();
  }
  e.sq = 0.75;
}
// クマの爪: 立ち上がった向き(予告の扇)へ振り下ろす
function bearSwipe(e, sw) {
  const R = sw.r * e.areaK;
  hitFan(e.x, e.y, e.ta, R, sw.arc, e.dmg * sw.n);
  slashes.push({ x: e.x, y: e.y, a: e.ta, r: R * CHAOS.area, t: 0, life: 0.22, flip: Math.random() < 0.5, span: sw.arc * 2, pal: SWING_PAL.enemy, enemy: true });
  burst(e.x + Math.cos(e.ta) * R * 0.6, e.y + Math.sin(e.ta) * R * 0.6, 10, ['#7a4a2a', '#c8a060', '#e8e0c0'], { sp: 70, g: 160 });
  e.sq = 0.7; AudioMan.slash(); AudioMan.thud(); shake(2);
}
// 溶岩スライム: 着地・倒れた場所に燃える床
function lavaPool(e, f) {
  addHazard('fire', e.x, e.y + 2, { r: f.r * e.areaK, dur: f.dur, dmg: e.dmg });
  burst(e.x, e.y + 2, 9, ['#ff6a2a', '#ffc34a', '#5a1a14'], { sp: 55, g: 180, life: 0.45 });
}
// 腐毒のグール: 倒れた場所に瘴気の霧(中にいると 1秒ごとに毒 +1。ダメージはない)。体が崩れて緑と紫の霧が噴き出す
function miasmaCloud(e, m) {
  addHazard('miasma', e.x, e.y + 2, { r: m.r * e.areaK, dur: m.dur, tick: 0.5 });
  burst(e.x, e.y - 2, 22, ['#7dff6a', '#3a6a2a', '#9a7dff', '#2a1a3a'], { sp: 70, up: 30, g: 40, drag: 1.5, life: 0.7 });
  addFlash(e.x, e.y, 46, '#5aff6a', 0.35); AudioMan.splat();
}
// マグマワーム: 予告の円の中心へ飛び出す(半径 r に ×n・炎上)。出ている up 秒だけ攻撃が当たる
function wormErupt(e, bu) {
  Object.assign(e, { x: e.tx, y: e.ty, kx: 0, ky: 0, under: false, hidden: false, flying: false, air: false, rise: 0, upT: bu.up });
  if (hitCircle(e.x, e.y, bu.r * e.areaK, e.dmg * bu.n)) burnPlayer(e.dmg * bu.burn);
  const R = bu.r * CHAOS.area * e.areaK;
  burst(e.x, e.y, 24, ['#2a1410', '#5a2a1a', '#ff6a2a', '#ffc34a'], { sp: 100, up: 50, g: 240, life: 0.5 });
  for (let i = 0; i < 10; i++) part(e.x + rand(-R, R) * 0.4, e.y + rand(-R, R) * 0.3, rand(-20, 20), -rand(70, 140), rand(0.4, 0.7), pick(['#ff6a2a', '#ffc34a', '#fff0b0']), { glow: true, g: 260 }); // 吹き上がる溶岩
  addRing(e.x, e.y, R, '#ff8a3d', { w: 2, life: 0.3 }); addFlash(e.x, e.y, R * 2.5, '#ff6a2a', 0.6);
  shake(2); AudioMan.thud(); AudioMan.fire();
}
// 潜る: 地中へ(攻撃が当たらない・狙われない・触れても当たらない)。cd 秒たつまで次の予告を出さない
function wormDive(e, bu) {
  Object.assign(e, { under: true, hidden: true, flying: true, air: true, rise: 0, upT: 0 });
  e.shotT = bu.cd;
  burst(e.x, e.y + 2, 10, ['#3a1a10', '#5a2a1a', '#ff6a2a'], { sp: 50, up: 20, g: 160, life: 0.4 });
}
// ---------- 陽炎の砂海の敵 ----------
const SAND = ['#e8c88a', '#c8a060', '#fff0c8', '#a8803a'];
// ---------- 雷鳴の雲海の敵 ----------
// 敵の稲妻: 空(または o.from)から x, y へ落ちる紫白の稲妻と、着地の輪・光・音。r: 着地の輪の半径(攻撃範囲込み。0 なら輪なし)/ o.big: 大きな稲妻
//   当たり判定は呼ぶ側(hitCircle など)。見た目はここで揃える(自分の雷の黄色と見分ける紫白。光の層は暗い紫で、白く飛ばないように)
function skyBolt(x, y, r, o = {}) {
  const f = o.from || { x: x + rand(-24, 24), y: Math.min(y - 60, cam.y - 12) };
  bfx.push({ kind: 'ebolt', x: f.x, y: f.y, x1: x, y1: y, t: 0, life: o.big ? 0.4 : 0.22, w: o.big ? 3 : 2, jit: o.big ? 10 : 6, col: o.big ? '#d8c8ff' : undefined }); // 大きな稲妻は芯を淡い紫に(太い白い芯は白く飛ぶ)
  if (r > 0) addRing(x, y, r, '#6a4ac8', { w: o.big ? 3 : 2, life: 0.3 }); // 輪は光の層に描かれる(淡い紫だと大きな輪が白く飛ぶ)
  burst(x, y, o.big ? 40 : 14, ['#e8e0ff', '#b8a0ff', '#7a5ad8', '#ffffff'], { sp: o.big ? 160 : 90, glow: true, life: 0.4 });
  if (o.big) addFlash(x, y, r * 1.6, '#6a4ac8', 0.4); else addFlash(x, y, Math.max(20, r) * 2.2, '#9a7aff', 0.35); // 大きな落雷の光は狭く暗く(檻・神鳴りの円が白く飛ばないように)
  if (o.big) { shake(10); AudioMan.impact(); AudioMan.boom(); } else { shake(2); AudioMan.zap(); }
}
// 雲海の空: 9〜16秒ごとに空が光り(画面がほのかに 2回またたく)、0.6〜1.4秒おくれて遠雷が鳴る(見た目と音だけ)
function updSky(dt) {
  if (!DATA.stages[S.stage - 1].thunder) return;
  const k = S.sky || (S.sky = { t: rand(4, 8), flick: 0, rumble: 0 });
  if (k.flick > 0 && (k.flick -= dt) <= 0) screenFlash(0.1, '#c8b8ff'); // 2回目のまたたき
  if (k.rumble > 0 && (k.rumble -= dt) <= 0) AudioMan.rumble();
  if ((k.t -= dt) <= 0) { k.t = rand(9, 16); k.flick = 0.14; k.rumble = rand(0.6, 1.4); screenFlash(0.14, '#c8b8ff'); }
}
// 対の雷精の組の時計(1体目が進める): 遠い間は近づく → 回り込み(最長 move 秒)→ 細く点滅(tele 秒)→ 線(on 秒。触れると tick 秒ごとに ×n・痺れ +numb)→ 休み(rest 秒)→ 回り込み…
function twinPairUpdate(a, b, pr, lk, dt) {
  pr.t += dt;
  if (pr.ph === 'chase') {
    if (d2(a.x, a.y, P.x, P.y) < lk.near * lk.near || d2(b.x, b.y, P.x, P.y) < lk.near * lk.near) { pr.ph = 'move'; pr.t = 0; pr.ang = twinAxis(a); }
  } else if (pr.ph === 'move') {
    const near = (e, s) => d2(e.x, e.y, P.x + Math.cos(pr.ang) * lk.flank * s, P.y + Math.sin(pr.ang) * lk.flank * s) < 20 * 20;
    if ((near(a, 1) && near(b, -1)) || pr.t >= lk.move) { pr.ph = 'tele'; pr.t = 0; AudioMan.charge(lk.tele); hint('twinlink', _t('対の雷精'), _t('2体の間に雷の線を張る。片方を倒すと線が消える')); }
  } else if (pr.ph === 'tele') { if (pr.t >= lk.tele) { pr.ph = 'on'; pr.t = 0; pr.tick = 0; AudioMan.zap(); } }
  else if (pr.ph === 'on') {
    if (!P.dead && segD2(P.x, P.y, a.x, a.y, b.x, b.y) < Math.pow(3 * CHAOS.area + 3, 2)) { if ((pr.tick -= dt) <= 0) { pr.tick = lk.tick; if (hurtPlayer(a.dmg * lk.n)) numbPlayer(lk.numb); } } else pr.tick = 0;
    if (pr.t >= lk.on) { pr.ph = 'rest'; pr.t = 0; }
  } else if (pr.ph === 'rest' && pr.t >= lk.rest) { pr.ph = 'move'; pr.t = 0; pr.ang = twinAxis(a); }
}
// はさむ向き: 1体目のいる向きから 90° 回した向き(1体目はそちら、2体目は反対側へ。2体が左右に分かれて 90° ずつ回り込む)
const twinAxis = a => Math.atan2(a.y - P.y, a.x - P.x) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
// ハゲワシの急降下: 影の円に ×n・砂塵 +dust。砂が舞い上がる
function vultureLand(e, sw) {
  const R = sw.r * e.areaK;
  if (hitCircle(e.x, e.y, R, e.dmg * sw.n)) dustPlayer(sw.dust);
  burst(e.x, e.y, 18, [...SAND, '#4a3020'], { sp: 90, up: 30, g: 200, life: 0.45 });
  addRing(e.x, e.y, R * CHAOS.area, '#e8c88a', { w: 2, life: 0.3 }); shake(2); AudioMan.thud();
  e.sq = 0.7;
}
// アリジゴク: すり鉢を開く(半径 r・dur 秒)。底に現れて、すり鉢の間だけ攻撃が当たる
function antlionPit(e, pt) {
  Object.assign(e, { hidden: false, flying: false, air: false });
  e.pitH = addHazard('pit', e.tx, e.ty, { r: pt.r * e.areaK, dur: pt.dur, pull: pt.pull, owner2: e, dmg: e.dmg * pt.n, jaw: pt.jaw * e.areaK, jawT: 0, dustT: 1 });
  burst(e.tx, e.ty, 24, SAND, { sp: 80, up: 30, g: 200, life: 0.5 }); shake(2); AudioMan.thud();
  hint('antlion', _t('すり鉢'), _t('中にいると底へ引かれ、砂塵がたまる。底の大あごに噛まれる'));
}
// 砂人形が倒れた: その場に砂山(攻撃を当てると崩れる)。t 秒たつと HP ×hp で 1回だけ立ち上がる
function dollMound(e, rv) {
  const m = spawnEnemy('sandmound', { x: e.x, y: e.y });
  Object.assign(m, { hp: 1, maxhp: 1, mound: true, moundT: rv.t, hpK: rv.hp, maxhp0: e.maxhp, noChest: e.noChest, face: e.face });
  burst(e.x, e.y, 14, SAND, { sp: 60, up: 20, g: 180, life: 0.45 });
  hint('sandmound', _t('砂山'), _t('倒した砂人形は砂山になり、4秒で 1回だけ立ち上がる。砂山を攻撃すると崩れる'));
}
// 砂山が崩れた(攻撃が当たった): 倒した扱いにしない(経験値・撃破数・コンボなし)
function moundCrumble(e) {
  burst(e.x, e.y, 16, SAND, { sp: 70, up: 20, g: 200, life: 0.45 }); addRing(e.x, e.y, 8, '#e8c88a', { life: 0.2 }); AudioMan.sand();
}
// 砂山から砂人形が立ち上がる(HP は元の最大HP × hp・経験値なし・もう立ち上がらない)
function dollRise(m) {
  m.dead = true;
  const o = spawnEnemy('sanddoll', { x: m.x, y: m.y });
  Object.assign(o, { revived: true, xp: 0, hp: m.maxhp0 * m.hpK, maxhp: m.maxhp0, noChest: m.noChest, face: m.face, riseAt: S.time }); // riseAt: 砂から伸び上がる(render.js)
  burst(m.x, m.y - 4, 18, SAND, { sp: 70, up: 30, g: 160, life: 0.5 }); AudioMan.thud();
}

function updEnemies(dt) {
  const R2 = Math.pow(Math.hypot(GFX.VW, GFX.VH) * 0.75, 2);
  for (const e of enemies) {
    if (e.dead) continue;
    S.eatk = (e.atkDownT > S.time ? 1 - DATA.weapons.bhole.evo.atkDown : 1) * (1 + buffOn(e, 'atk')); // ビッグクランチ: ブラックホールの中の敵は攻撃力が下がる(体当たり・矢・ボスの攻撃)/ ファイアーメイジのバフ
    e.t += dt; e.flash -= dt;
    if (e.prop) { if (d2(e.x, e.y, P.x, P.y) > R2 * 2) e.dead = true; continue; }
    // 状態異常: 自分の攻撃で付いたものなので、火の粉・しずく・継続ダメージの火花などは「攻撃の濃さ」の対象(途中で倒れて continue しても、次の敵・ループの後で戻す)
    FX_MINE = true;
    if (e.burnT > 0) { // 炎上(スタック): 積んだ炎上の合計を 0.5秒ごとに、出どころごとにまとめて
      e.burnT -= dt; e.burnTick -= dt;
      const bs = e.burns || [];
      for (const b of bs) b.t -= dt;
      if (e.burnTick <= 0) {
        e.burnTick = DATA.debuff.burnTick;
        const by = {}, k = clsBurnMul(e); // クラスの補正(パイロマンサーの火勢など)
        for (const b of bs) if (b.t > -DATA.debuff.burnTick) by[b.src] = (by[b.src] || 0) + b.v * DATA.debuff.burnTick;
        for (const src in by) { hitEnemy(e, by[src] * k, { src, dot: true, col: '#ff8a3d', noNum: Math.random() < 0.5 }); if (e.dead) break; } // 攻撃力・クリティカルが乗る
        if (e.dead) continue;
      }
      e.burns = bs.filter(b => b.t > 0);
      if (Math.random() < dt * (8 + 2 * Math.min(10, e.burns.length))) part(e.x + rand(-3, 3), e.y + rand(-3, 3), 0, -20, 0.4, pick(['#ff6a2a', '#ffc34a']), { glow: true }); // 積むほど火の粉が増える
    }
    if (e.freeze) { // 凍結(クライオマンサー): 凍傷が iv 秒ごとに 1 減り、0 で解除。ボス以外は行動不能
      const f = e.freeze;
      f.acc += dt; e.frostT = 5;
      while (f.acc >= f.iv && e.frost > 0) { f.acc -= f.iv; e.frost--; }
      if (e.frost <= 0) { e.freeze = null; e.frost = 0; burst(e.x, e.y, 8, ['#bff4ff', '#ffffff'], { sp: 40, life: 0.3 }); }
      else if (!e.boss) e.stun = Math.max(e.stun || 0, dt + 0.01);
    }
    if (e.frostT > 0) { e.frostT -= dt; if (e.frostT <= 0) e.frost = 0; }
    if (e.bleedT > 0 && e.bleed > 0 && (e.bleedTick = (e.bleedTick || 1) - dt) <= 0) {
      // 出血: 最大HP の割合。攻撃力・クリティカルは乗らない(クラスの補正: 出血ダメージの倍率 / 鮮血で攻撃力・クリティカルが乗る)
      const B = DATA.bleed, k = (e.boss ? B.boss : e.elite ? B.elite : 1) * clsBleedMul(), full = clsBleedFull();
      e.bleedTick = 1;
      hitEnemy(e, e.maxhp * B.pct * e.bleed * k / (full ? 1 : dmgMul()), { src: 'bleed', noCrit: !full, dot: true, col: '#a0122a', noNum: Math.random() < 0.5 });
      if (e.dead) continue;
    }
    if (e.bleedT > 0) { e.bleedT -= dt; if (e.bleedT <= 0) e.bleed = 0; if (Math.random() < dt * Math.min(e.bleed, 10) * 0.6) part(e.x + rand(-2, 2), e.y, 0, 15, 0.4, '#a0122a', { g: 60 }); }
    FX_MINE = false;
    e.slowT -= dt;
    if (e.obj) { e.kx = e.ky = 0; updObj(e, dt); continue; } // ボスが出した物: 動かない(押されない。炎上・出血などのダメージは受ける)
    // ノックバック
    e.x += e.kx * dt; e.y += e.ky * dt;
    const damp = Math.exp(-9 * dt);
    e.kx *= damp; e.ky *= damp;
    if (e.pulled) { // 巨大スライムの吸収: 光の線に引かれて本体へ(届くと吸われる)
      const b = e.pulled;
      if (b.dead || S.time > e.pullT) e.pulled = null;
      else {
        const pa = Math.atan2(b.y - e.y, b.x - e.x);
        e.x += Math.cos(pa) * 60 * dt; e.y += Math.sin(pa) * 60 * dt; e.face = Math.cos(pa) < 0 ? -1 : 1;
        if (d2(e.x, e.y, b.x, b.y) < Math.pow(b.r * 0.8 + e.r, 2)) slimeAbsorbed(b, e);
        continue;
      }
    }
    if (e.stun > 0) { e.stun -= dt; continue; }
    if (e.boss) { const r0 = CHAOS.rate; CHAOS.rate *= clsBossRate(e); S.taint = e.boss === 'shadowking' && !e.shadow ? (e.ai.enraged ? 2 : 1) : 0; try { bossAI(e, dt); } finally { CHAOS.rate = r0; S.taint = 0; } } // 凍結中のボスは攻撃速度 -30% / 蝕む影
    else {
      const tw = clsEnemySlow(e); // 時の歪み(アストロマンサーの重力圏): 移動・攻撃が遅くなる
      const slow = Math.max(0.2, 1 - DATA.debuff.frostSlow * (e.frost || 0)) * (e.slowT > 0 ? 0.6 : 1) * tw; // 凍傷(時の歪みと掛け算)
      const sp = e.spd * slow * (1 + buffOn(e, 'spd')); // サンダーメイジのバフ
      const dc = S.decoy && d2(e.x, e.y, S.decoy.x, S.decoy.y) < 200 * 200 ? S.decoy : P; // 空蝉の分身
      const a = Math.atan2(dc.y - e.y, dc.x - e.x), d = DATA.enemies[e.type];
      let mx = Math.cos(a), my = Math.sin(a);
      if (e.ai === 'flutter') { const w = Math.sin(e.t * 5 + e.seed * 10) * (d.wobble || 0.8); mx -= Math.sin(a) * w; my += Math.cos(a) * w; if (d.dazzle && Math.random() < dt * 6) part(e.x + rand(-3, 3), e.y + rand(-1, 2), rand(-4, 4), rand(4, 10), 0.5, pick(['#fff6c8', '#ffe08a']), { glow: true, drag: 1 }); } // 光の蝶: 羽から光の粉がこぼれる
      if (d.dazzle) { // 光の蝶: プレイヤーの近く(r 以内)に来ると光って眩惑(蝶ごとに cd 秒に 1回)
        e.dazCd = (e.dazCd || 0) - dt * tw;
        if (e.dazCd <= 0 && d2(e.x, e.y, P.x, P.y) < Math.pow(d.dazzle.r * e.areaK, 2) && dazzlePlayer(e, d.dazzle)) e.dazCd = d.dazzle.cd;
      }
      else if (e.ai === 'hop') { // 跳ねる(宝石スライムは速い間隔で大きく跳ぶ)
        const hp = d.hop, every = e.hopEvery = hp ? hp.every : 1.1, air = e.hopAir = hp ? every * 0.45 : 0.35, k = hp ? hp.k : 2.4;
        e.hopT -= dt; const hop = e.hopT < air;
        if (e.hopT <= 0) { e.hopT = every; if (d.fireFloor && Math.random() < d.fireFloor.chance) lavaPool(e, d.fireFloor); } // 着地(溶岩スライム: 燃える床)
        mx *= hop ? k : 0.1; my *= hop ? k : 0.1;
      } else if (e.ai === 'skitter') { // 毒蜘蛛: 小刻みに走っては止まる(止まっている間も脚はうごめく)
        const sk = d.skitter, cyc = sk.run + sk.stop;
        e.skT = (e.skT ?? rand(0, cyc)) - dt * tw; if (e.skT <= 0) e.skT += cyc;
        e.run = e.skT > sk.stop;
        mx *= e.run ? sk.k : 0; my *= e.run ? sk.k : 0;
        if (e.run && Math.random() < dt * 8) part(e.x + rand(-3, 3), e.y + 4, rand(-6, 6), -rand(2, 8), 0.3, '#3a2a40', { drag: 3 });
      } else if (e.ai === 'keep') { // 距離を取って射撃(弓兵・火の小鬼・砂術師)
        const s = d.shot, dd = Math.sqrt(d2(e.x, e.y, P.x, P.y));
        const k = e.wind > 0 ? 0 : dd > d.keep[1] ? 1 : dd < d.keep[0] ? -1 : 0; // 構えている間は止まる
        mx *= k; my *= k;
        if (!s) { /* 射撃のない敵(砂時計の精)は距離を保つだけ */ }
        else if (e.wind > 0) { // 構え(砂術師): 足元で砂が渦を巻き、終わると撃つ
          e.wind -= dt * CHAOS.rate * tw;
          if (s.kind === 'darkorb') { if (Math.random() < dt * 40) { const pa = rand(0, TAU), pr = rand(10, 18); part(e.x + Math.cos(pa) * pr, e.y - 2 + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(['#c79bff', '#7a3ab0', '#2a1240']), { glow: Math.random() < 0.4, drag: 0 }); } } // 影の眼: 闇が瞳へ吸い込まれる
          else if (MAGE_COL[e.type]) { if (Math.random() < dt * 40) { const pa = rand(0, TAU), pr = rand(8, 14), tx = e.x + (e.face || 1) * 3.5, ty = e.y - 7; part(tx + Math.cos(pa) * pr, ty + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(MAGE_COL[e.type]), { glow: Math.random() < 0.5, drag: 0 }); } } // メイジ: 属性の光が掲げた杖の珠へ集まる
          else if (Math.random() < dt * 45) { const pa = rand(0, TAU), pr = rand(5, 10); part(e.x + Math.cos(pa) * pr, e.y + 4 + Math.sin(pa) * pr * 0.5, -Math.sin(pa) * 34, Math.cos(pa) * 16 - 10, 0.35, pick(['#e8c88a', '#c8a060', '#fff0c0']), { drag: 2 }); }
          if (e.wind <= 0) enemyShoot(e, s, Math.atan2(dc.y - e.y, dc.x - e.x));
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK; // カオス: 攻撃頻度 / 時の歪み
          if (e.shotT <= 0 && dd < s.range) {
            e.shotT = s.cd;
            if (s.wind) { e.wind = s.wind; if (s.kind === 'esand') AudioMan.sand(); else AudioMan.charge(s.wind); } else enemyShoot(e, s, a); // 影の眼・メイジは溜める音
          }
        }
        if (s) e.aim = s.wind ? e.wind > 0 : e.shotT < 0.4; // 撃つ前に構える(予兆)
      } else if (e.ai === 'roll') { // 歯車: 出たときのプレイヤーの位置へ一直線に転がり、通り過ぎると消える
        if (e.ta === undefined) { e.ta = Math.atan2(P.y - e.y, P.x - e.x); e.rollLeft = Math.sqrt(d2(e.x, e.y, P.x, P.y)) + Math.hypot(GFX.VW, GFX.VH) / 2 + 30; }
        mx = Math.cos(e.ta); my = Math.sin(e.ta);
        e.spin = (e.spin || 0) + sp * dt / e.r;
        if ((e.rollLeft -= sp * dt) <= 0) { e.dead = true; continue; } // 倒した扱いにしない(経験値なし)
        if (Math.random() < dt * 12) part(e.x - mx * 5 + rand(-2, 2), e.y + 5, -mx * 20, -rand(4, 12), 0.35, pick(['#8a7a60', '#c8a050', '#5a4a40']), { drag: 2 }); // 転がる土ぼこりと火花
        if (Math.random() < dt * 4) part(e.x, e.y + 5, rand(-30, 30), -rand(20, 40), 0.2, '#ffd27a', { glow: true, g: 200 });
      } else if (e.ai === 'flee') {
        mx = -mx; my = -my;
        e.life -= dt;
        if (Math.random() < dt * 20) part(e.x, e.y, rand(-10, 10), rand(-20, 0), 0.6, '#ffcc33', { glow: true });
        if (e.life <= 0) { e.dead = true; UI.announce(_t('逃げられた…'), ''); burst(e.x, e.y, 20, ['#ffffff', '#ffcc33'], { sp: 60 }); continue; }
      } else if (e.ai === 'zigzag') { // 雷獣の子: 稲妻のようにジグザグに走って近づく(every 秒ごとに、プレイヤーへの向きから ±ang へ交互に)
        const zz = d.zigzag;
        if ((e.zzT = (e.zzT ?? rand(0, zz.every)) - dt) <= 0) { e.zzT = zz.every; e.zzS = -(e.zzS || 1); }
        const za = a + (e.zzS || 1) * zz.ang; mx = Math.cos(za); my = Math.sin(za);
        if (Math.random() < dt * 10) part(e.x + rand(-3, 3), e.y + rand(-3, 2), -mx * 20, -my * 20, 0.25, pick(['#d8c8ff', '#9aa8ff', '#ffffff']), { glow: true, drag: 3 }); // 走った跡の火花
      } else if (e.ai === 'twin') { // 対の雷精: 2体でプレイヤーをはさむ位置へ回り込み、間に雷の線を張る(相方が倒れると追跡だけ)
        const lk = d.link, m = e.mate, pr = e.pr, wob = () => { const w = Math.sin(e.t * 5 + e.seed * 10) * 0.8; mx -= Math.sin(a) * w; my += Math.cos(a) * w; };
        if (!m || m.dead || !pr) wob();
        else {
          if (e.twinIdx === 0) twinPairUpdate(e, m, pr, lk, dt); // 組の時計は 1体目が進める
          if (pr.ph === 'move') { // 回り込み: プレイヤーのまわりを弧を描いて(真ん中を突っ切らない)、はさむ位置へ。速さ ×fast
            const ta = pr.ang + (e.twinIdx ? Math.PI : 0), ca = Math.atan2(e.y - P.y, e.x - P.x), wa = ca + clamp(angDiff(ta, ca), -0.6, 0.6);
            const tx = P.x + Math.cos(wa) * lk.flank, ty = P.y + Math.sin(wa) * lk.flank, dd = Math.hypot(tx - e.x, ty - e.y);
            if (dd > 3) { mx = (tx - e.x) / dd * lk.fast; my = (ty - e.y) / dd * lk.fast; } else mx = my = 0;
          }
          else if (pr.ph === 'tele' || pr.ph === 'on') mx = my = 0; // 線を張る間は止まる
          else wob(); // 遠い間・休み: 揺れて飛ぶ
        }
      } else if (e.ai === 'pit') { // アリジゴク: 砂の中(見えない)→ プレイヤーの近くに予告 → すり鉢を開き、底で大あごを鳴らす。すり鉢の間だけ攻撃が当たる
        const pt = d.pit; mx = my = 0;
        if (e.pitH) { // すり鉢: 底(中心)に止まる。終わる少し前に潜る
          const h = e.pitH; e.x = h.x; e.y = h.y;
          if (h.t >= h.dur - 0.3 || !hazards.includes(h)) { e.pitH = null; Object.assign(e, { hidden: true, flying: true, air: true }); e.shotT = pt.cd; burst(e.x, e.y, 14, SAND, { sp: 50, up: 20, g: 160, life: 0.4 }); }
        } else if (e.wind > 0) { // 予告: 砂が渦を巻きはじめる
          e.wind -= dt;
          if (Math.random() < dt * 40) { const pa = rand(0, TAU), pr = rand(0.3, 1) * pt.r * e.areaK * CHAOS.area; part(e.tx + Math.cos(pa) * pr, e.ty + Math.sin(pa) * pr * 0.8, -Math.sin(pa) * 30, Math.cos(pa) * 20, 0.4, pick(SAND), { drag: 2 }); }
          if (e.wind <= 0) antlionPit(e, pt);
        } else if ((e.shotT -= dt * CHAOS.rate * tw * e.rateK) <= 0) {
          const pa = rand(0, TAU), pr = rand(pt.near[0], pt.near[1]);
          e.x = e.tx = dc.x + Math.cos(pa) * pr; e.y = e.ty = dc.y + Math.sin(pa) * pr; e.wind = pt.wind; // 砂の中をすり鉢の場所へ
          pushWarn({ kind: 'circle', x: e.tx, y: e.ty, r: pt.r * e.areaK, t: 0, life: pt.wind, owner: e });
          AudioMan.sand();
        }
      } else if (e.ai === 'mound') { // 砂人形の砂山: t 秒たつと立ち上がる(最後の 1秒は震えて砂がこぼれる)
        mx = my = 0; e.moundT -= dt;
        if (e.moundT < 1 && Math.random() < dt * 20) part(e.x + rand(-5, 5), e.y + rand(-2, 2), rand(-10, 10), -rand(10, 30), 0.4, pick(SAND), { g: 120 });
        if (e.moundT <= 0) { dollRise(e); continue; }
      } else if (e.ai === 'burrow') { // マグマワーム: 地中を進み、プレイヤーの足元に予告の円 → 飛び出す。出ている間だけ攻撃が当たり、また潜る
        const bu = d.burrow;
        if (e.upT > 0) { // 出ている: その場で止まる(最後の sink 秒で沈む)
          mx = my = 0; e.upT -= dt;
          e.rise = Math.min(1, e.rise + dt / 0.12, Math.max(0, e.upT) / bu.sink);
          if (e.upT <= 0) wormDive(e, bu);
        } else if (e.wind > 0) { // 予告: 円の中心へ地中を急いで進み、着くと震えて火の粉を噴く
          mx = my = 0; e.wind -= dt;
          const k = Math.min(1, dt * 9); e.x += (e.tx - e.x) * k; e.y += (e.ty - e.y) * k;
          if (Math.random() < dt * 30) part(e.x + rand(-4, 4), e.y + rand(-2, 2), rand(-15, 15), -rand(20, 50), 0.4, pick(['#ff6a2a', '#ffc34a', '#5a2a1a', '#3a1a10']), { glow: Math.random() < 0.5, g: 140 });
          if (e.wind <= 0) wormErupt(e, bu);
        } else { // 地中を進む: 盛り上がった土と火の粉の跡
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, dc.x, dc.y) < bu.range * bu.range) {
            const pa = rand(0, TAU), pr = rand(0, bu.near);
            e.tx = dc.x + Math.cos(pa) * pr; e.ty = dc.y + Math.sin(pa) * pr; e.wind = bu.wind;
            pushWarn({ kind: 'circle', x: e.tx, y: e.ty, r: bu.r * e.areaK, t: 0, life: bu.wind, owner: e });
          }
          if (Math.random() < dt * 14) part(e.x + rand(-3, 3), e.y + rand(0, 2), rand(-8, 8), -rand(8, 20), 0.4, pick(['#3a1a10', '#5a2a1a', '#7a4a2a']), { g: 120 });
          if (Math.random() < dt * 4) part(e.x + rand(-2, 2), e.y, rand(-5, 5), -rand(15, 30), 0.5, pick(['#ff6a2a', '#ffc34a']), { glow: true, drag: 1 });
        }
      }
      if (d.throw) { // 投槍兵: 射程に入ると止まって構え、予告の帯の向きへ槍を投げる(帯は投槍兵について動く)
        const th = d.throw;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw;
          if (e.wind <= 0) throwSpear(e, th);
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < th.range * th.range) {
            e.shotT = th.cd; e.wind = th.wind; e.ta = a;
            pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: th.len * e.areaK, w: th.w * e.areaK, t: 0, life: th.wind, owner: e, track: w => { w.x = e.x; w.y = e.y; } });
            AudioMan.spearReady();
          }
        }
        e.aim = e.wind > 0;
      }
      if (d.rush) { // 晶甲虫: 射程に入ると止まって光り(帯の予告)、帯の向きへ突進する
        const ru = d.rush;
        if (e.dash > 0) {
          e.dash -= dt; mx = Math.cos(e.ta) * ru.spd / e.spd; my = Math.sin(e.ta) * ru.spd / e.spd;
          if (Math.random() < dt * 40) part(e.x + rand(-3, 3), e.y + rand(-3, 3), -Math.cos(e.ta) * 40, -Math.sin(e.ta) * 40, 0.3, pick(['#9ff7ff', '#ff8ad8', '#ffd23f']), { glow: true, drag: 3 });
        } else if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw; e.flash = Math.sin(e.wind * 40) > 0 ? 0.05 : 0;
          if (e.wind <= 0) { e.dash = ru.len / ru.spd; AudioMan.dash(); }
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < ru.range * ru.range) {
            e.shotT = ru.cd; e.wind = ru.wind; e.ta = a;
            pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: ru.len, w: e.r * 2 + 2, t: 0, life: ru.wind, fixed: true, owner: e, track: w => { w.x = e.x; w.y = e.y; } }); // 突進の経路(体当たりなので広げない)
          }
        }
      }
      if (d.lunge) { // 影法師: 遠い間は薄い影(攻撃は当たる)。range 以内で実体化し、構えて(帯の予告)飛びかかる。飛びかかったあと rest 秒は追跡だけ
        const lg = d.lunge, near = d2(e.x, e.y, P.x, P.y) < lg.range * lg.range;
        if (e.dash > 0) {
          e.dash -= dt; mx = Math.cos(e.ta) * lg.spd / e.spd; my = Math.sin(e.ta) * lg.spd / e.spd;
          if (Math.random() < dt * 50) part(e.x + rand(-3, 3), e.y + rand(-5, 3), -Math.cos(e.ta) * 30, -Math.sin(e.ta) * 30, 0.35, pick(['#1a0a2a', '#3a1a5a', '#c79bff']), { glow: Math.random() < 0.3, drag: 3 }); // 影の尾
        } else if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw; e.flash = Math.sin(e.wind * 50) > 0 ? 0.05 : 0;
          if (e.wind <= 0) { e.dash = lg.len / lg.spd; AudioMan.dash(); burst(e.x, e.y, 10, ['#2a1240', '#c79bff', '#ffffff'], { sp: 60, glow: true, life: 0.3 }); }
        } else if ((e.shotT -= dt * CHAOS.rate * tw * e.rateK) <= 0 && near) {
          e.shotT = lg.rest + lg.wind + lg.len / lg.spd; e.wind = lg.wind; e.ta = a;
          pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: lg.len, w: lg.w, t: 0, life: lg.wind, fixed: true, owner: e, track: w => { w.x = e.x; w.y = e.y; } }); // 飛びかかりの経路(体当たりなので広げない)
        }
        const veil = !near && !(e.wind > 0) && !(e.dash > 0);
        if (e.veil && !veil) { burst(e.x, e.y - 3, 14, ['#1a0a2a', '#3a1a5a', '#c79bff'], { sp: 50, glow: true, life: 0.4 }); addRing(e.x, e.y, 10, '#7a3ab0', { r0: 18, life: 0.25 }); } // 影から実体化する
        e.veil = veil;
      }
      if (d.puff) { // ハリセンボン: 近づくとふくらんで、針を全周に飛ばす
        const pf = d.puff;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw; e.swell = 1 - e.wind / pf.wind;
          if (e.wind <= 0) {
            e.swell = 0;
            for (let i = 0; i < pf.count; i++) { const na = TAU / pf.count * i + e.seed; eprojs.push({ kind: 'needle', x: e.x, y: e.y, vx: Math.cos(na) * pf.spd, vy: Math.sin(na) * pf.spd, dmg: e.dmg * pf.n * S.eatk, sta: pf.sta, life: 3, t: 0, r: 2 * CHAOS.area * e.areaK, sk: e.areaK }); }
            burst(e.x, e.y, 10, ['#e8c86a', '#fff0c0', '#bff4ff'], { sp: 60, life: 0.3 }); AudioMan.puff();
          }
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < pf.range * pf.range) { e.shotT = pf.cd; e.wind = pf.wind; AudioMan.charge(pf.wind); }
        }
      }
      if (d.lantern) { // チョウチンアンコウ: 提灯が光り(予告の円)、中にいるとスタミナを吸われる
        const ln = d.lantern;
        if (e.wind > 0) {
          e.wind -= dt * CHAOS.rate * tw; e.glowL = 1 - Math.max(0, e.wind) / ln.wind;
          if (e.wind <= 0) {
            e.glowL = 0;
            const R0 = ln.r * CHAOS.area * e.areaK;
            if (d2(e.x, e.y, P.x, P.y) < (R0 + 3) * (R0 + 3) && P.invT <= 0) drainSta(ln.sta);
            addRing(e.x, e.y, R0, '#fff6a0', { w: 2, life: 0.35 }); addFlash(e.x, e.y, R0 * 2.5, '#fff6a0', 0.9); AudioMan.chime();
          }
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < 160 * 160) { e.shotT = ln.cd; e.wind = ln.wind; pushWarn({ kind: 'circle', x: e.x, y: e.y, r: ln.r * e.areaK, t: 0, life: ln.wind, owner: e, track: w => { w.x = e.x; w.y = e.y; } }); }
        }
      }
      if (d.blink) { // 時計兵: 光って(wind 秒)、プレイヤーの方向へ dist 瞬間移動する(時を飛ばす)
        const bl = d.blink;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw; e.flash = Math.sin(e.wind * 50) > 0 ? 0.05 : 0;
          if (e.wind <= 0) {
            const ba = Math.atan2(dc.y - e.y, dc.x - e.x), x0 = e.x, y0 = e.y;
            e.x += Math.cos(ba) * bl.dist; e.y += Math.sin(ba) * bl.dist;
            for (let k = 0; k < 6; k++) { const u = k / 5; part(lerp(x0, e.x, u), lerp(y0, e.y, u) - 2, 0, -4, 0.35, pick(['#ffd27a', '#c8a050', '#fff0c8']), { glow: true, drag: 1 }); } // 飛ばした時の跡
            addRing(e.x, e.y, 8, '#ffd27a', { life: 0.25 }); AudioMan.tick(6);
          }
        } else if ((e.shotT -= dt * CHAOS.rate * tw * e.rateK) <= 0) { e.shotT = bl.cd; e.wind = bl.wind; }
      }
      if (d.warp) { // 砂時計の精: プレイヤーの位置に予告(wind 秒)→ 時の歪み(時計盤の床)
        const wp = d.warp;
        if ((e.shotT -= dt * CHAOS.rate * tw * e.rateK) <= 0 && d2(e.x, e.y, P.x, P.y) < wp.range * wp.range) {
          e.shotT = wp.cd;
          const tx = P.x, ty = P.y;
          pushWarn({ kind: 'circle', x: tx, y: ty, r: wp.r * e.areaK, t: 0, life: wp.wind });
          addHazard('clock', tx, ty, { r: wp.r * e.areaK, dur: wp.dur, slow: wp.slow, delay: wp.wind });
          burst(e.x, e.y - 4, 10, ['#e8c88a', '#fff0c8', '#9ff7ff'], { sp: 40, glow: true, life: 0.4 }); AudioMan.tick(10);
        }
        e.aim = e.shotT < 0.5;
      }
      if (d.snowball) { // イエティ: 止まって腕を振りかぶり(0.5秒)、雪玉を放物線で投げる(着弾点の円は投げる前から出る)
        const sb = d.snowball;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw;
          if (e.wind <= 0) yetiThrow(e, sb);
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < sb.range * sb.range) {
            e.shotT = sb.cd; e.wind = sb.wind ?? 0.5; e.tx = P.x; e.ty = P.y;
            pushWarn({ kind: 'circle', x: P.x, y: P.y, r: sb.r * e.areaK, t: 0, life: (sb.wind ?? 0.5) + 1.0, owner: e });
          }
        }
        e.aim = e.wind > 0;
      }
      if (d.grow && !e.elite) { // 若木: 出てから t 秒生き残ると樹人に育つ(エリートは育たない)。育つ前の 3秒は葉が光ってふくらむ
        e.growT = (e.growT || 0) + dt;
        if (e.growT >= d.grow.t) { growInto(e, d.grow.into); continue; }
        e.ripe = e.growT > d.grow.t - 3;
        if (e.ripe && Math.random() < dt * 10) part(e.x + rand(-4, 4), e.y - rand(2, 8), rand(-6, 6), -rand(8, 18), 0.5, pick(['#d8ff9a', '#8fd06a']), { glow: true, drag: 1 });
      }
      if (d.strike) { // 樹人: 止まって両腕の枝を上げ、プレイヤーの位置に予告の円 → 根が突き上げる(衰弱)
        const st = d.strike;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw;
          if (e.wind <= 0) groundStrike(e, st);
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < st.range * st.range) {
            e.shotT = st.cd; e.wind = st.wind;
            if (st.self) { e.tx = e.x; e.ty = e.y; } // 雷の甲冑: 自分のまわりに
            else if (st.front) { e.tx = e.x + Math.cos(a) * st.front * e.areaK; e.ty = e.y + Math.sin(a) * st.front * e.areaK; } else { e.tx = P.x; e.ty = P.y; } // サソリ: 自分の前に
            pushWarn({ kind: 'circle', x: e.tx, y: e.ty, r: st.r * e.areaK, t: 0, life: st.wind, owner: e });
          }
        }
        e.aim = e.wind > 0;
      }
      if (d.swipe) { // クマ: 近づくと立ち上がり(前方の扇の予告。クマについて動く)、爪を振り下ろす
        const sw = d.swipe;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw; e.stand = true;
          if (e.wind <= 0) { e.stand = false; bearSwipe(e, sw); }
        } else {
          e.stand = false;
          e.shotT -= dt * CHAOS.rate * tw * e.rateK;
          if (e.shotT <= 0 && d2(e.x, e.y, P.x, P.y) < sw.range * sw.range) {
            e.shotT = sw.cd; e.wind = sw.wind; e.ta = a;
            pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: sw.r * e.areaK, h: sw.arc, t: 0, life: sw.wind, owner: e, track: w => { w.x = e.x; w.y = e.y; } });
            AudioMan.charge(sw.wind);
          }
        }
      }
      if (d.swoop) { // ハゲワシ: 舞い上がり(攻撃が当たらない)、影の円がプレイヤーを追って止まる → 急降下(砂塵)。降りて少しの間は地上で止まる
        const sw = d.swoop, T1 = sw.rise, T2 = T1 + sw.follow + sw.lock, T3 = T2 + 0.15, H = 56;
        if (e.swT !== undefined) { // 空の上
          mx = my = 0; e.swT += dt;
          const w = e.swW;
          if (e.swT < T1) e.jz = H * e.swT / T1; // 舞い上がる
          else if (e.swT < T2) { e.jz = H; const k = Math.min(1, dt * 5); e.x += (w.x - e.x) * k; e.y += (w.y - e.y) * k; } // 影の上へ回る
          else if (e.swT < T3) { e.x = w.x; e.y = w.y; e.jz = H * (1 - (e.swT - T2) / 0.15); } // 急降下
          else { e.jz = 0; e.swT = undefined; e.hidden = e.air = false; e.restT = sw.rest; vultureLand(e, sw); }
        } else if (e.restT > 0) { mx = my = 0; e.restT -= dt; } // 降りたあと: 地上で翼をたたんで止まる
        else if ((e.shotT -= dt * CHAOS.rate * tw * e.rateK) <= 0 && d2(e.x, e.y, P.x, P.y) < sw.range * sw.range) {
          e.shotT = sw.cd; e.swT = 0; e.hidden = e.air = true;
          e.swW = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: sw.r * e.areaK, t: 0, life: T3, owner: e }, T1 + sw.follow, sw.spd);
          pushWarn(e.swW); AudioMan.dash();
        }
        e.landed = e.restT > 0;
      }
      if (d.blast) { // 鬼火: プレイヤーのそばで止まり、膨らみながら点滅して自爆する
        const bl = d.blast;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt;
          e.swell = 1 - e.wind / bl.wind; e.flash = Math.sin(e.wind * 45) > 0 ? 0.05 : 0;
          if (e.wind <= 0) { onibiBlast(e, bl); continue; }
        } else if (d2(e.x, e.y, P.x, P.y) < bl.range * bl.range) {
          e.wind = bl.wind;
          pushWarn({ kind: 'circle', x: e.x, y: e.y, r: bl.r * e.areaK, t: 0, life: bl.wind, owner: e });
          AudioMan.fuse();
        }
      }
      if (d.beam) { // ホーリーメイジ: cd 秒ごとに wind 秒 杖を掲げ(帯の予告。帯はメイジについて動き、はじめの aim 秒はプレイヤーの方を追う)、光のビーム ×n・乱光 +light
        const bm = d.beam;
        if (e.wind > 0) {
          mx = my = 0; e.wind -= dt * CHAOS.rate * tw;
          if (bm.wind - e.wind < bm.aim) e.ta = Math.atan2(P.y - (e.y - 4), P.x - e.x); // 予告はプレイヤーの方を追い、残りの間は止まる(止まってから横へ出ればよけられる)
          if (Math.random() < dt * 40) { const pa = rand(0, TAU), pr = rand(8, 14), tx = e.x + (e.face || 1) * 3.5, ty = e.y - 7; part(tx + Math.cos(pa) * pr, ty + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(MAGE_COL.holymage), { glow: Math.random() < 0.5, drag: 0 }); } // 光が杖の珠へ集まる
          if (e.wind <= 0) holyBeam(e, bm);
        } else {
          e.beamT = (e.beamT ?? rand(1, bm.cd)) - dt * CHAOS.rate * tw * e.rateK;
          if (e.beamT <= 0 && d2(e.x, e.y, P.x, P.y) < bm.range * bm.range) {
            e.beamT = bm.cd; e.wind = bm.wind; e.ta = a;
            pushWarn({ kind: 'line', x: e.x, y: e.y - 4, a, len: bm.len * e.areaK, w: bm.w * e.areaK, t: 0, life: bm.wind, owner: e, track: w => { w.x = e.x; w.y = e.y - 4; w.a = e.ta; } });
            AudioMan.charge(bm.wind);
          }
        }
        e.aim = e.wind > 0;
      }
      if (d.spot) { // 灯の番人: ランタンの光の扇でプレイヤーを探す(毎秒 turn rad で向け直す)。扇の中に catch 秒いると見つかり(扇が赤く光る)、扇の光が強まって ×n・乱光 +light。撃ったあと rest 秒は灯を消す
        const so = d.spot;
        if (e.spotRest > 0) { e.spotRest -= dt * CHAOS.rate * tw * e.rateK; e.spotK = Math.max(0, (e.spotK || 0) - dt * 3); e.spotC = 0; }
        else {
          if (e.spotA === undefined) e.spotA = a + rand(-1, 1);
          e.spotK = Math.min(1, (e.spotK || 0) + dt * 2); // 灯がともる
          if (!(e.spotC > 0)) e.spotA += clamp(angDiff(a, e.spotA), -so.turn * dt * tw, so.turn * dt * tw); // 見つけかけている間(扇が赤い間)は扇を止める: 横へ出れば逃げられる
          const inside = !P.dead && P.invT <= 0 && e.spotK >= 1 && inFan(e.x, e.y - 3, e.spotA, so.r * e.areaK, so.h);
          e.spotC = inside ? (e.spotC || 0) + dt * CHAOS.rate * tw : Math.max(0, (e.spotC || 0) - dt * 1.5);
          if (e.spotC >= so.catch) { lampFlash(e, so); e.spotC = 0; e.spotRest = so.rest; }
        }
        e.aim = e.spotC > 0;
      }
      if (d.buff) { // メイジ: プレイヤーが射程(shot.range)にいる間、cd 秒ごとに まわりの敵にバフ(最初は出て first 秒。遠くで時が来たら、射程に入ったときに)
        e.buffT = (e.buffT ?? d.buff.first) - dt * tw;
        const br = d.buff.range || d.shot.range; // ホーリーメイジは射撃がないので buff.range
        if (e.buffT <= 0 && d2(e.x, e.y, P.x, P.y) < br * br) { e.buffT = d.buff.cd; mageBuff(e, d.buff); }
      }
      if (e.buffs && Math.random() < dt * 3) for (const k in e.buffs) if (e.buffs[k].t > S.time) part(e.x + rand(-4, 4), e.y + rand(0, 4), rand(-3, 3), -rand(12, 22), 0.5, pick(BUFF_COL[k].parts), { glow: true, drag: 1 }); // バフの間: 属性の色の粒が昇る
      e.x += mx * sp * dt; e.y += my * sp * dt;
      e.face = (mx || dc.x - e.x) < 0 ? -1 : 1; // 止まっている間はプレイヤーの方を向く
      // 分離(重なり防止)
      if (!e.ghost && e.ai !== 'roll' && !e.under && !e.air) { // 地中のマグマワーム・空の上のハゲワシ・砂の中のアリジゴクはぶつからない
        let n = 0;
        forEachNear(e.x, e.y, e.r, o => {
          if (o === e || o.ghost || o.prop) return;
          const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy) || 0.1, ov = e.r + o.r - dd;
          if (ov > 0) { const push = ov * 0.35 * (o.boss ? 2 : 1); e.x += dx / dd * push; e.y += dy / dd * push; }
          if (++n > 6) return false;
        });
      }
      // 遠すぎる敵は進行方向の反対側へ再配置
      if (d2(e.x, e.y, P.x, P.y) > R2 && e.type !== 'goblin' && e.ai !== 'roll' && !e.pitH) { // すり鉢を開いているアリジゴクは動かさない
        const a2 = Math.atan2(P.y - e.y, P.x - e.x) + rand(-0.5, 0.5), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 12;
        e.x = P.x + Math.cos(a2) * R; e.y = P.y + Math.sin(a2) * R;
      }
    }
    const td = !e.boss && DATA.enemies[e.type]; // 触れたとき: 鬼火は当たらない / ヘルハウンドは噛みつくと炎上 / クラゲはスタミナを吸う / 毒蜘蛛は毒 / 影法師の飛びかかりは ×n
    const tk = e.dash > 0 && td && td.lunge ? td.lunge.n : 1;
    S.taint = e.boss === 'shadowking' && !e.shadow ? (e.ai.enraged ? 2 : 1) : 0; // 蝕む影: 体当たりでも
    if (e.dmg > 0 && !e.air && !(td && td.noTouch) && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2) && hurtPlayer(e.dmg * tk, TOUCH) && td) { if (td.touchBurn) burnPlayer(e.dmg * td.touchBurn); if (td.touchSta) drainSta(td.touchSta); if (td.touchFrost) frostPlayer(td.touchFrost); if (td.touchPoison) poisonPlayer(td.touchPoison); if (td.touchNumb) numbPlayer(td.touchNumb); if (td.touchDust) dustPlayer(td.touchDust); if (td.touchLight) randomLight(td.touchLight, e.dmg); if (td.rush && td.rush.weak && e.dash > 0) weakPlayer(td.rush.weak); } // 森蜂: 突っ込んだ針が当たると衰弱
    S.taint = 0;
  }
  S.eatk = 1; FX_MINE = false;
  if (enemies.length > 40) enemies = enemies.filter(e => !e.dead);
}
