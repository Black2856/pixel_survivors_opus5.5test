// bosses/warden.js — ボス: 時計仕掛けの番人: プレイヤーへまっすぐ。ゼンマイ巻き(DPSチェック)/ 時針と分針 / 歯車弾 / 鐘の衝撃 / 大歯車 / 歯車の床 / 激昂: リングギア
'use strict';

// ---------- 時計仕掛けの番人: プレイヤーへまっすぐ。ゼンマイ巻き(DPSチェック)/ 時針と分針 / 歯車弾 / 鐘の衝撃 / 大歯車 / 歯車の床 / 激昂: リングギア ----------
const BRASS = ['#c8a050', '#ffd27a', '#8a6a30', '#fff0c8'];
function wardenAI(e, ai, dt, a, dist, slow) {
  if (ai.fastT > 0) { // 全速(ゼンマイを止められなかった): 速さ ×1.6・技の間隔 ×0.6・針の回転 ×1.5。蒸気を噴く
    ai.fastT -= dt;
    if (Math.random() < dt * 26) part(e.x + rand(-10, 10), e.y - rand(6, 18), rand(-10, 10), -rand(20, 50), rand(0.4, 0.7), pick(['#fff0c8', '#c8b8a0', '#ff8a3d']), { drag: 1 });
    if (ai.fastT <= 0) { e.spd /= 1.6; burst(e.x, e.y, 16, BRASS, { sp: 60 }); }
  }
  if (ai.bellT > 0) ai.bellT -= dt;
  ai.keyA = (ai.keyA || 0) + dt * (ai.act === 'spring' ? 14 : ai.fastT > 0 ? 6 : 1.5); // 背中のゼンマイ(巻き上げ中は速く回る)
  if (ai.act === 'spring' || ai.act === 'stall') { updSpring(e, ai, dt); return; }
  const fast = ai.fastT > 0, R = CHAOS.rate / (fast ? 0.6 : 1);
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  if (ai.hands) { // 時針と分針: 1秒 薄く出る → 4秒回る(短針 毎秒 0.8rad・長針 2.4rad)。当たると ×0.8
    const hd = ai.hands, k = fast ? 1.5 : 1;
    hd.t += dt;
    if (hd.t > 1) {
      hd.a1 += 0.8 * k * dt; hd.a2 += 2.4 * k * dt;
      for (const ha of [hd.a1, hd.a2]) hitLine(e.x, e.y, ha, 180, 10, e.dmg * 0.8);
      if ((hd.snd = (hd.snd || 0) - dt) <= 0) { hd.snd = 0.5; AudioMan.tick(4); }
    }
    if (hd.t >= 5) ai.hands = null;
  }
  const ring = hazards.some(h => h.kind === 'ringgear' && h.owner === e); // リングギアが出ている(時針と分針・ゼンマイ巻きは消えるまで待つ)
  ai.spring -= dt * R; ai.handCd -= dt * R; ai.cog -= dt * R; ai.bell -= dt * R; ai.big -= dt * R; ai.floor -= dt * R; if (ai.enraged) ai.ringCd -= dt * R;
  if (ai.spring <= 0 && !ai.hands && !ring) { ai.spring = ai.enraged ? 16 : 22; startSpring(e, ai); return; }
  if (ai.cog <= 0) { ai.cog = ai.enraged ? 4 : 5; cogShot(e, ai); } // 弾はほかの技と並んで撃つ
  if (ai.handCd <= 0 && !ai.hands && !ring) { ai.handCd = ai.enraged ? 7 : 9; ai.hands = { t: 0, a1: a + Math.PI, a2: a + 0.9 }; for (const ha of [ai.hands.a1, ai.hands.a2]) pushWarn({ kind: 'line', x: e.x, y: e.y, a: ha, len: 180, w: 10, t: 0, life: 1, track: w => { w.x = e.x; w.y = e.y; } }); AudioMan.charge(1); hint('clockhands', _t('時針と分針'), _t('2本の針が番人のまわりを回る')); }
  else if (ai.big <= 0) { ai.big = ai.enraged ? 8 : 10; bigGear(e, ai, a); }
  else if (ai.floor <= 0) { ai.floor = ai.enraged ? 9 : 12; gearFloors(e, ai); }
  else if (ai.bell <= 0) { ai.bell = ai.enraged ? 8 : 10; bellShock(e, ai); }
  else if (ai.enraged && ai.ringCd <= 0 && !ai.hands && !ring) { ai.ringCd = 20; ringGear(e, ai); }
}
// ゼンマイ巻き: 背中のゼンマイが回り始める → 4秒 動かず巻き上げる(被ダメ ×1.3)。4秒で最大HP の 5% を削ると 2秒止まる。削れなければ 10秒 全速
function startSpring(e, ai) {
  ai.act = 'spring'; ai.pt = 4; ai.armHp = e.hp; ai.armK = 0; e.takeK = 1.3; ai.hands = null;
  AudioMan.charge(0.6); shake(4);
  hint('spring', _t('ゼンマイ巻き'), _t('4秒で最大HP の 5% を削ると止まる。削れないと全速になる'));
}
function updSpring(e, ai, dt) {
  ai.pt -= dt;
  if (ai.act === 'spring') {
    ai.armK = Math.min(1, (ai.armHp - e.hp) / (e.maxhp * 0.05));
    if ((ai.ksnd = (ai.ksnd || 0) - dt) <= 0) { ai.ksnd = 0.18; AudioMan.tick(Math.floor(ai.armK * 8)); } // ギリギリと巻く音
    if (ai.armK >= 1) { // 止めた: 2秒 止まる
      ai.act = 'stall'; ai.pt = 2; e.takeK = 1;
      burst(e.x, e.y - 8, 60, [...BRASS, '#5a5a6a'], { sp: 160, g: 240, life: 0.8 });
      hitstop(0.08); shake(12); screenFlash(0.3, '#ffd27a'); shockAt(e.x, e.y, 2, 0.7); AudioMan.crush(); AudioMan.boom();
      bossBlast(e.x, e.y - 8, 44, Object.assign({ n: 18, decal: false }, BFX.warden)); // 弾け飛ぶ真鍮の光
      UI.announce(_t('ゼンマイが止まった!'), _t('2秒 動けない'));
    } else if (ai.pt <= 0) { // 巻き切った: 10秒 全速
      ai.act = null; e.takeK = 1; ai.fastT = 10; e.spd *= 1.6;
      burst(e.x, e.y, 40, ['#ff8a3d', '#fff0c8', '#c8a050'], { sp: 140, glow: true });
      shake(9); AudioMan.roar(); screenFlash(0.25, '#ff8a3d');
      UI.announce(_t('番人が全速になった!'), _t('10秒 速さ ×1.6・技の間隔 ×0.6'));
    }
    return;
  }
  e.flash = Math.sin(ai.pt * 30) > 0.6 ? 0.04 : 0;
  if (Math.random() < dt * 10) part(e.x + rand(-8, 8), e.y - rand(4, 16), rand(-20, 20), -rand(10, 30), 0.5, pick(['#ffd27a', '#c8a050']), { glow: true, g: 200 }); // 火花
  if (ai.pt <= 0) { ai.act = null; e.takeK = 1; }
}
// 歯車弾: 大きな歯車 4個(激昂 6個)を全周へ(速さ 70、×0.6)。1回だけプレイヤーへ向きを変える
function cogShot(e, ai) {
  const n = ai.enraged ? 6 : 4, a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) Object.assign(eball(e.x, e.y - 6, a0 + TAU / n * i, 70, e.dmg * 0.6, 'cog'), { r: 7 * CHAOS.area, turnT: 1.0, keepSp: 70 });
  burst(e.x, e.y - 6, 14, BRASS, { sp: 70, glow: true, life: 0.35 }); AudioMan.tick(2); AudioMan.dash();
}
// 鐘の衝撃: 0.8秒 鐘が光る → 衝撃の輪を 3つ、0.4秒おき(半径 30 → 150、毎秒 120)。触れると 50 外へ押す(ダメージなし)
function bellShock(e, ai) {
  ai.bellT = 0.8; AudioMan.charge(0.8);
  for (let i = 0; i < 3; i++) later(ai, 0.8 + i * 0.4, () => {
    addHazard('quake', e.x, e.y, { r: 30, spd: 120, max: 150, dur: 9, dmg: 0, push: 50, bell: true });
    AudioMan.knell(); shockAt(e.x, e.y, 1.1, 0.8); shake(3);
    fxRays(e.x, e.y - 10, 46, '#8a6a2a', { foe: true, n: 12, life: 0.32, core: '#ffb347' }); // 鐘が鳴るたびに真鍮の光
  });
  hint('bell', _t('鐘の衝撃'), _t('輪に触れると外へ押される'));
}
// 大歯車: 0.7秒(経路の帯)→ 半径 30 の歯車が速さ 90 で転がり、画面の縁(闘技場では壁)で 2回はね返る(8秒)。×1.0・触れると 1秒 移動速度 ×0.6。HP 5% で壊せる
//   激昂は 2個: プレイヤーへの向きから ±0.35rad の V 字に転がす
function bigGear(e, ai, a) {
  const dirs = ai.enraged ? [a - 0.35, a + 0.35] : [a];
  for (const g of dirs) pushWarn({ kind: 'line', x: e.x, y: e.y, a: g, len: 260, w: 60, t: 0, life: 0.7, fixed: true });
  e.sq = 1.25; AudioMan.charge(0.7);
  windup(e, 0.7, () => {
    for (const g of dirs) {
      const x = e.x + Math.cos(g) * 20, y = e.y + Math.sin(g) * 20;
      const o = spawnObj(e, 'biggear', x, y, { pct: 0.05, r: 30, life: 8 });
      o.vx = Math.cos(g) * 90; o.vy = Math.sin(g) * 90; o.bounce = 2; o.rise = 1;
      bossBlast(x, y, 30, Object.assign({ n: 12, cracks: 6 }, BFX.warden)); // 歯車が落ちた地面が割れる
    }
    shake(6); AudioMan.boom(); e.sq = 0.75;
    hint('biggear', _t('大歯車'), _t('縁ではね返る。壊すこともできる'));
  });
}
// 歯車の床: 0.8秒(床に歯車の模様)→ プレイヤーの位置と、そこから 半径 ×2 離れた位置に、回る歯車の床(半径 75)を 8秒。上にいると回る向きへ流される(毎秒 50)
//   2枚はちょうど接する(逆向きに回る、かみ合った歯車)。攻撃範囲の倍率で半径が広がっても接したまま
function gearFloors(e, ai) {
  const R = 75, gap = 2 * R * CHAOS.area, ga = rand(0, TAU), pts = [{ x: P.x, y: P.y }, { x: P.x + Math.cos(ga) * gap, y: P.y + Math.sin(ga) * gap }];
  pts.forEach((p, i) => {
    pushWarn({ kind: 'circle', x: p.x, y: p.y, r: R, t: 0, life: 0.8 });
    addHazard('gearfloor', p.x, p.y, { r: R, dur: 8, delay: 0.8, dir: i ? -1 : 1, seed: (Math.random() * 1e6) | 0 });
  });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { AudioMan.tick(0); AudioMan.thud(); hint('gearfloor', _t('歯車の床'), _t('回る向きへ流される')); });
}
// リングギア(激昂): 番人を軸に、中が空いた歯車(半径 190・幅 16)。1秒の予告(番人についてくる赤い輪の帯)の間に上から降りてくる
//   → 10秒、番人を軸に回る。輪に触れると ×0.9(内側は安全)。最後に上へ戻る。時針と分針とは同時に使わない
function ringGear(e, ai) {
  addHazard('ringgear', e.x, e.y, { owner: e, r: 190, w: 16 * CHAOS.area, land: 1, dur: 11.4, dmg: e.dmg * 0.9, dir: Math.random() < 0.5 ? 1 : -1, rot0: rand(0, TAU) });
  AudioMan.charge(1); AudioMan.warning();
  hint('ringgear', _t('リングギア'), _t('番人を囲む歯車の輪が降りてくる。輪に触れないように(内側は安全)'));
}
