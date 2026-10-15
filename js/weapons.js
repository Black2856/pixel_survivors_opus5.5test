// weapons.js — 武器(自動攻撃・弾・設置ゾーン)
'use strict';

// ============================================================
// 武器
// ============================================================
function addWeapon(k) {
  const w = P.weapons[k];
  // 新しい武器は Lv1(クラスLv の startLv: ラン中に手に入れた武器はその分だけ高い Lv から。はじめのメイン武器は除く)
  if (!w) { P.weapons[k] = { lv: Math.min(5, 1 + (Object.keys(P.weapons).length ? P.lvFx.startLv || 0 : 0)), cd: 0.3, evo: false, t: 0, q: [], tick: 0 }; P.wm[k] = weaponMastery(k); }
  else w.lv = Math.min(5, w.lv + 1);
  S.hudDirty = true;
}
function canHit(e, key, cd) {
  const h = e.hc || (e.hc = {});
  if ((h[key] || 0) > S.time) return false;
  h[key] = S.time + cd;
  return true;
}
function randomTargets(n) {
  const vis = enemies.filter(e => !e.dead && !e.hidden && onScreen(e.x, e.y, -6));
  return shuffle(vis).slice(0, n);
}
function aimAt(maxD) {
  const m = mouseAimPt();
  if (m) return Math.atan2(m.y - P.y, m.x - P.x);
  const t = nearestEnemy(P.x, P.y, maxD);
  return t ? Math.atan2(t.y - P.y, t.x - P.x) : (P.facing > 0 ? 0 : Math.PI);
}

// アーケインレイの旋回性能(rad/s)。以前の既定値 4 の 20%
const ARCANE_TURN = 0.8;
// 追尾弾の狙い: 一番近い敵のうち、その弾がまだ当たっていない敵(hit は当たった敵の id。当たった敵の周りを回り続けないように)
function nearestUnhit(x, y, maxD, hit) {
  let best = null, bd = maxD * maxD;
  for (const e of enemies) {
    if (e.dead || e.hidden || hit.has(e.id)) continue;
    const d = d2(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function fire(kind, x, y, ang, spd, o) {
  if (o.src === P.mainW && o.el === undefined) o.el = clsNextEl(); // 通常攻撃の1発ごとに属性(メイジ)
  projs.push(Object.assign({ kind, x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, ang, t: 0, life: 1.5, r: 3, pierce: 0, hit: new Set() }, o));
}

// 通常攻撃の撃ち手: 撃つ位置と狙い。自分は P_ORG、影・分身などは orgOf(位置を持つもの) で作る
//   main: 自分(刃輪展開・メイジの属性など自分だけの効果)/ aim(maxD): 狙う向き(照準 → 一番近い敵 → 向き)/ hk: 当たり判定の間隔を自分と分けるときの印
const P_ORG = { main: true, hk: '', get x() { return P.x; }, get y() { return P.y; }, get face() { return P.facing; }, aim: maxD => aimAt(maxD) };
function orgOf(p, hk = '') {
  const face = () => p.face || P.facing;
  return { main: false, hk, get x() { return p.x; }, get y() { return p.y; }, get face() { return face(); },
    aim(maxD) { const t = mouseAimPt() || nearestEnemy(p.x, p.y, maxD); return t ? Math.atan2(t.y - p.y, t.x - p.x) : (face() > 0 ? 0 : Math.PI); } };
}

function updWeapons(dt) {
  // クールダウン(P.cdMul)は全ての武器と E / Q に、攻撃速度(P.atkSpd)は全ての武器の通常攻撃にだけ効く(E / Q には効かない)
  const cdt = atkLock() ? 0 : dt * cdRateK(); // スロウタイム・痺れの間は CD の回復が遅い / 凍結・麻痺の間は攻撃が出ない(回り続ける刃・オーラは hitEnemy で当たらない)
  for (const k in P.weapons) weaponStep(k, P.weapons[k], dt, cdt, P_ORG);
}
// 武器 k を dt 進める(攻撃間隔 → 攻撃、時間差の攻撃、回り続ける刃、オーラ)
//   w: その撃ち手の武器の状態(自分は P.weapons[k]。分身などは Lv・進化を自分の武器から引き継いだ別の状態)
//   w.haste / w.hasteT: 一時的な攻撃速度の倍率と、その終わる時刻(影の追撃の残響など)
function weaponStep(k, w, dt, cdt, o) {
  const st = wst(k), spd = P.atkSpd * (w.hasteT > S.time ? w.haste : 1);
  w.t += dt;
  w.cd -= cdt * spd;
  switch (k) {
    case 'blade': { // 回り続ける刃(攻撃間隔はない)
      // 回転速度: クールダウン・攻撃速度(熟練のクールダウンも)で速くなる。刃輪展開(E)の間は半径・刃のサイズ・回転・威力が上がる(自分の刃だけ)
      const n = (st.count || 1) + P.shots, bE = o.main ? P.bladeE : null, mcd = (P.wm[k] || {}).cd || 0;
      const rotK = spd / (P.cdMul * (1 - mcd)) * (bE ? bE.rot : 1), R = st.radius * P.area * (bE ? bE.rMul : 1), size = (st.size || 1) * (bE ? bE.size : 1); // 刃の大きさ(武器Lv)× 刃輪展開
      w.ang = (w.ang || 0) + st.rot * rotK * dt;
      const rings = w.evo ? [[n, R, 1], [Math.max(3, n - 3), R * 0.55, -1.4]] : [[n, R, 1]];
      const dmg = st.dmg * (bE ? bE.pow : 1), bleed = w.evo ? DATA.weapons.blade.evo.bleed : 0;
      w.blades = [];
      rings.forEach(([cnt, rad, dir], ri) => {
        for (let i = 0; i < cnt; i++) {
          const a = w.ang * dir + (TAU / cnt) * i;
          const bx = o.x + Math.cos(a) * rad, by = o.y + Math.sin(a) * rad;
          w.blades.push({ x: bx, y: by, a, s: size, dir });
          forEachNear(bx, by, 5 * size, e => {
            if (!canHit(e, 'blade' + ri + o.hk, DATA.weapons.blade.hitCd)) return;
            hitEnemy(e, dmg, { src: k, ang: a + Math.PI / 2 * dir, kb: 45, eHit: !!bE, cl: !!(bE && bE.cl) });
            if (bleed && !e.prop) addBleed(e, bleed); // ブラッドサークル: 命中で出血
          });
        }
      });
      break;
    }
    case 'aura': { // 周りに継続ダメージ(判定の間隔 tick。クールダウンは判定の間隔に効く)
      w.R = st.radius * P.area;
      w.tick -= cdt * spd; // 攻撃速度
      if (w.tick <= 0) { w.tick = st.tick * P.cdMul; weaponFire(k, w, st, o); }
      break;
    }
    default:
      // 攻撃間隔が来たら 1回攻撃する。狙う敵がいなくて撃てなかったときは少し待って撃ち直す(マジックボルト・長弓 0.1秒 / サンダー 0.2秒)
      if (w.cd <= 0) w.cd = weaponFire(k, w, st, o) ? st.cd * P.cdMul : k === 'thunder' ? 0.2 : 0.1;
  }
  // 時間差の攻撃(長弓の連射・騎士剣と刀の往復)。s.st: 撃ったときのステータス(影の追撃で威力を上げた分も)/ s.o: 撃ち手
  if (w.q && w.q.length) for (let i = w.q.length - 1; i >= 0; i--) {
    const s = w.q[i];
    s.t -= dt;
    if (s.t > 0) continue;
    w.q.splice(i, 1);
    const qs = s.st || st, qo = s.o || o;
    if (k === 'longbow') shootArrow(k, qs, w.evo, qo);
    else if (k === 'longsword') { // 正面を大きく薙ぎ払う。聖剣: 当たった敵に光の剣が上から降る(25%)
      const hits = sweep(qo.aim(qs.aoe * P.area + 20), qs, s.flip, { src: k, col: '#ffe9a0', colEvo: '#fff3a0', arc: 1.35, kb: 90, evo: w.evo }, qo);
      if (w.evo) hits.slice(0, 8).forEach((e, j) => skyBlade(e, qs.dmg * 0.25, k, 0.08 + j * 0.035)); // 聖剣: 光の剣が上から追撃(25%)
    } else if (k === 'katana') doSlash(qo.aim(qs.aoe * P.area + 20), qs, w.evo, s.flip, qo, w);
  }
}
// 武器 k の 1回の攻撃(通常攻撃)。o: 撃ち手 / st: ステータス(影の追撃は威力を上げたもの)
//   撃てたら true(狙う敵がいないときは false)。時間差で撃つ武器(長弓・騎士剣・刀)は w.q に積む
//   回り続ける刃(オービットブレード)は、刃の輪が通る帯の敵へ 1回ずつ当たる
function weaponFire(k, w, st, o) {
  const n = (st.count || 1) + P.shots; // 弾数(千手の など)
  switch (k) {
    case 'bolt': {
      const t = mouseAimPt() || nearestEnemy(o.x, o.y, 180);
      if (!t) return false;
      const base = Math.atan2(t.y - o.y, t.x - o.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.13;
        fire('bolt', o.x, o.y, a, st.speed, { dmg: st.dmg, pierce: st.pierce, life: 1.5, src: k, home: w.evo, homing: w.evo ? ARCANE_TURN : 0, col: w.evo ? '#ff9bf5' : '#7ad7ff', r: 3 });
      }
      burst(o.x + Math.cos(base) * 6, o.y + Math.sin(base) * 6, 4, ['#7ad7ff', '#ffffff'], { sp: 40, glow: true, life: 0.25 });
      AudioMan.shoot();
      return true;
    }
    case 'blade': { // 刃の輪が一周、帯の敵へ 1回ずつ
      const R = st.radius * P.area, band = 5 * (st.size || 1) + 2, x = o.x, y = o.y;
      asMine(() => {
        forEachNear(x, y, R + band, e => {
          if (Math.abs(Math.hypot(e.x - x, e.y - y) - R) > band + (e.r || 4)) return;
          hitEnemy(e, st.dmg, { src: k, ang: Math.atan2(e.y - y, e.x - x) + Math.PI / 2, kb: 45 });
          if (w.evo && !e.prop) addBleed(e, DATA.weapons.blade.evo.bleed);
        });
        slashes.push({ x, y, follow: o.main ? true : null, a: rand(0, TAU), r: R + band * 0.5, t: 0, life: 0.22, full: true, pal: SWING_PAL.ring });
      });
      AudioMan.slash();
      return true;
    }
    case 'thunder': {
      const ts = randomTargets(((st.strikes || 1) + P.shots) * (S.time < (P.stormT || 0) ? 2 : 1)); // 雷雨(グラビティスパークの後): 回数 ×2
      if (!ts.length) return false;
      ts.forEach((t, i) => setTimeout(() => state === 'play' && strike(t.x, t.y, st, w.evo), i * 70));
      return true;
    }
    case 'aura': { // 周りの敵へ 1回(サンクチュアリ: 命中 1回につき HP 回復。1回で 5回分まで)
      let healed = 0;
      forEachNear(o.x, o.y, st.radius * P.area, e => {
        hitEnemy(e, st.dmg, { src: k, noNum: Math.random() < 0.5, ang: Math.atan2(e.y - o.y, e.x - o.x), kb: 6 });
        if (w.evo && healed < 5 && missed !== e) { heal(0.4, true); healed++; } // 外れた命中では回復しない
      });
      return true;
    }
    case 'axe': {
      const sz = st.size || 1; // 斧の大きさ(武器Lv・熟練): 当たり判定の半径 5 と見た目に掛ける
      for (let i = 0; i < n; i++) {
        const dir = (i % 2 ? -1 : 1) * o.face;
        const p = { dmg: st.dmg, pierce: 999, life: 2.4, src: k, g: 300, spin: dir * 12, r: 5 * sz, sz, whirl: !!w.evo, wdmg: st.dmg * DATA.weapons.axe.evo.whirlPow }; // whirl: 巨斧旋風
        projs.push(Object.assign({ kind: 'axe', x: o.x, y: o.y - 4, vx: dir * rand(20, 55) + i * 8 * dir, vy: -rand(150, 185), ang: 0, t: 0, hit: new Set() }, p));
      }
      AudioMan.slash();
      return true;
    }
    case 'wisp': // 精霊を四方へ放つ(放つときは追うときの 90/110 の速さ)。近くのまだ当たっていない敵を追う
      for (let i = 0; i < n; i++) fire('wisp', o.x, o.y, rand(0, TAU), st.speed * 90 / 110, { dmg: st.dmg, pierce: st.pierce, life: 3.2, src: k, homing: 5.5, speed: st.speed, col: '#9dffcf' });
      return true;
    case 'fire': {
      const base = o.aim(160), ar = 1 + ((P.wm[k] || {}).area || 0); // 熟練の範囲: 火炎弾の大きさと爆炎の半径
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.22;
        fire('fire', o.x, o.y, a, 135, { dmg: st.dmg, pierce: 999, life: 0.95, src: k, burn: st.burn, r: 4 * ar, boom: w.evo ? 6 : 0, boomR: 16 * ar, col: '#ff8a3d' });
      }
      AudioMan.fire();
      return true;
    }
    case 'blizzard': {
      const t = mouseAimPt() || randomTargets(1)[0], x = t ? t.x : o.x + rand(-40, 40), y = t ? t.y : o.y + rand(-40, 40);
      zones.push({ kind: 'blizz', x, y, r: st.radius * P.area, r0: st.radius * P.area, t: 0, dur: st.dur, tick: 0, dmg: st.dmg, evo: w.evo });
      AudioMan.blizz();
      return true;
    }
    case 'bhole': {
      const t = mouseAimPt() || randomTargets(1)[0], tx = t ? t.x : o.x + o.face * 70, ty = t ? t.y : o.y;
      const a = Math.atan2(ty - o.y, tx - o.x), dist = Math.hypot(tx - o.x, ty - o.y);
      fire('orbShot', o.x, o.y, a, 160, { life: dist / 160, pierce: 999, noHit: true, src: k, col: '#c78bff', onEnd: p => spawnHole(p.x, p.y, st, w.evo) });
      return true;
    }
    case 'longbow': // 照準方向へ貫通する矢。本数が多いときは同じ方向へ時間差で撃つ
      if (!mouseAimPt() && !nearestEnemy(o.x, o.y, 220 * P.range)) return false;
      for (let i = 0; i < n; i++) w.q.push({ t: i * 0.1, st, o });
      return true;
    case 'longsword': // 正面を大きく薙ぎ払う(回数が多いときは往復で時間差)
      for (let i = 0; i < n; i++) w.q.push({ t: i * 0.14, flip: i % 2, st, o });
      return true;
    case 'katana':
      for (let i = 0; i < n; i++) w.q.push({ t: i * 0.09, flip: i % 2, st, o });
      return true;
  }
  return false;
}

// 遅延実行される自分の攻撃も「自分の演出」として扱う
function asMine(fn) { const prev = FX_MINE; FX_MINE = true; try { fn(); } finally { FX_MINE = prev; } }
function strike(x, y, st, evo) { asMine(() => strikeNow(x, y, st, evo)); }
function strikeNow(x, y, st, evo) {
  const R = st.aoe * P.area;
  const shock = DATA.weapons.thunder.shock;
  forEachNear(x, y, R, e => {
    const dealt = hitEnemy(e, st.dmg, { src: 'thunder', ang: Math.atan2(e.y - y, e.x - x), kb: 30, col: '#fff27a' });
    if (!dealt) return;
    addShock(e, dealt, shock);               // 感電
    if (evo) addShock(e, dealt, shock);      // ジャッジメント: 感電をもう1回
  });
  bolts.push({ x0: x + rand(-20, 20), y0: cam.y - 10, x1: x, y1: y, t: 0, life: 0.22, w: 2 });
  addFlash(x, y, 70, '#fff27a', 0.3);
  addRing(x, y, R, '#fff27a', { life: 0.3 });
  burst(x, y, 14, ['#fff27a', '#ffffff', '#7ad7ff'], { sp: 90, glow: true, life: 0.4 });
  shake(2); AudioMan.zap();
}

function spawnHole(x, y, st, evo) {
  zones.push({ kind: 'hole', x, y, r: st.radius * P.area, t: 0, dur: st.dur, tick: 0, dmg: st.dmg, pull: st.pull, evo });
  AudioMan.hole(); shockAt(x, y, 0.8, 0.5);
}

// 長弓の矢(天弓: 同じ敵に二重ヒット。2回目は貫通を1消費)
// 敵の炎上: 燃やすたびに別々の炎上として積む(スタック)。perSec = 1秒あたりの基礎ダメージ(攻撃力を掛ける前)
// 0.5秒ごとに、残っている炎上の合計を出どころごとにまとめて与える。1体あたり最大 40 個
function addBurn(e, perSec, dur = DATA.debuff.burnDur, src = 'fire') {
  if (!(perSec > 0) || e.dead || e.prop || missed === e) return; // 外れた攻撃(砂塵・暗闇)では付かない
  dur += clsBurnDur(); // クラスの持続の追加(パイロマンサー)
  const b = e.burns || (e.burns = []);
  b.push({ v: perSec, t: dur, src });
  if (b.length > 40) b.shift();
  if (e.burnT <= 0) e.burnTick = DATA.debuff.burnTick;
  e.burnT = Math.max(e.burnT, dur);
}
// 敵の出血: n スタック積み、持続を戻す。上限と持続の追加はクラスが決める(上限が無いクラスは無制限)
function addBleed(e, n) {
  if (!(n > 0) || e.dead || e.prop || missed === e) return; // 外れた攻撃(砂塵・暗闇)では付かない
  e.bleed = Math.min(clsBleedCap(), (e.bleed || 0) + n);
  e.bleedT = DATA.bleed.dur + clsBleedDur();
}
function shootArrow(k, st, evo, o = P_ORG) {
  const a = o.aim(220 * P.range);
  fire('arrow', o.x, o.y - 2, a, st.speed, { dmg: st.dmg, pierce: st.pierce, life: 0.9 * P.range, src: k, r: 3, col: evo ? '#ffe14a' : '#e4ffd8', dbl: evo });
  part(o.x + Math.cos(a) * 8, o.y - 2 + Math.sin(a) * 8, Math.cos(a) * 40, Math.sin(a) * 40, 0.2, '#e4ffd8', { glow: true });
  AudioMan.shoot();
}
// 斬撃の振り抜き(render.js の drawSwing)の配色。淡い色はライト・発光・ブルームが重なると白に飛ぶので、胴体は濃い色にする
const SWING_PAL = {
  katana:    { body: '#c8243e', edge: '#ff6a80', glow: '#ff3b5c' },
  katanaEvo: { body: '#8a0c22', edge: '#ff2a48', glow: '#ff3b5c' },
  sword:     { body: '#b88a20', edge: '#ffd34a', glow: '#f2c84b' },
  parry:     { body: '#2a8ab8', edge: '#7fe8ff', glow: '#9ff7ff' },
  ranbu:     { body: '#a8185a', edge: '#e8357f', glow: '#b8205e' },
  enemy:     { body: '#8a0c22', edge: '#ff3b5c', glow: '#ff3b5c' },
  fire:      { body: '#a0300c', edge: '#ff8a3d', glow: '#ff6a2a', core: '#fff0b0' }, // イフリートの炎の鞭
  blood:     { body: '#3a0008', edge: '#8e0016', glow: '#5a000c', core: '#c0102a' }, // 血の色(ブラッドアサシン)
  rage:      { body: '#2a0408', edge: '#7a1418', glow: '#2a0508', core: '#b8402a' }, // 赤黒い闘気(バーサーカー。明るい赤は敵の攻撃の色なので芯だけ。光の層は色で明るさが決まるので暗く)
  ring:      { body: '#3a4668', edge: '#8ea6d8', glow: '#3a4668' },
  shadow:    { body: '#2a1240', edge: '#a66bff', glow: '#4a1a7a', core: '#e8c8ff' }, // 影の王の影の剣
  cerb:      { body: '#3a0a1a', edge: '#ff5a5a', glow: '#5a1020', core: '#ffd0d0' }, // ケルベロスの影の突進の最後の切り裂き                  // オービットブレードの輪が一周する(影の追撃)
};
// 騎士剣の薙ぎ払い(扇形)。o.arc: 半分の角度 / o.evo: 聖剣(当てるたびに 5秒のシールド +1。1回の攻撃につき1まで)/ org: 撃ち手
function sweep(a, st, flip, o, org = P_ORG) {
  const R = st.aoe * P.area, el = o.src === P.mainW && org.main ? clsNextEl() : undefined, x = org.x, y = org.y;
  slashes.push({ x, y, follow: org.main ? true : org, a, r: R, t: 0, life: 0.24, flip, span: o.arc * 2, pal: SWING_PAL.sword }); // 見た目 = 当たり判定(半径 R・角度 ±arc)
  const hits = [];
  forEachNear(x, y, R, e => {
    let diff = Math.atan2(e.y - y, e.x - x) - a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > o.arc) return;
    hitEnemy(e, st.dmg, { src: o.src, ang: a, kb: o.kb, col: o.col, el });
    if (!e.prop && missed !== e) hits.push(e); // 外れた敵には追撃・シールドなし
  });
  if (hits.length && o.evo) timedShield(1, 5); // 聖剣
  AudioMan.slash();
  return hits;
}
// 聖剣: 当たった敵へ、光の剣が上から降って追撃する(見た目は S.skyBlades、render.js で描く)
const SKY_FALL = 0.16;
function skyBlade(e, dmg, src, delay) {
  (S.skyBlades || (S.skyBlades = [])).push({ e, x: e.x, y: e.y, t0: S.time + delay });
  setTimeout(() => {
    if (state !== 'play' || e.dead) return;
    asMine(() => {
      hitEnemy(e, dmg, { src, col: '#fff3a0', kb: 20, ang: Math.atan2(e.y - P.y, e.x - P.x), noNum: Math.random() < 0.3 });
      addFlash(e.x, e.y - 2, 34, '#fff1d0', 0.2); addRing(e.x, e.y + 2, 9, '#ffe9a0', { life: 0.25 });
      burst(e.x, e.y - 2, 8, ['#ffffff', '#fff3a0', '#f2c84b'], { sp: 70, up: 20, glow: true, life: 0.3 });
    });
    AudioMan.hit();
  }, (delay + SKY_FALL) * 1000);
}
const KATANA_ARC = 1.05; // 刀の斬撃の半分の角度(全体で約 120°)
// 刀の斬撃(扇形)。org: 撃ち手 / w: 村正の数を数える武器の状態(撃ち手ごと)
function doSlash(a, st, evo, flip, org = P_ORG, w = P.weapons.katana) {
  const R = st.aoe * P.area, el = P.mainW === 'katana' && org.main ? clsNextEl() : undefined, x = org.x, y = org.y; // 斬撃1回 = 1属性(メイジ。メイン武器のときだけ)
  let hits = 0;
  slashes.push({ x, y, follow: org.main ? true : org, a, r: R, t: 0, life: 0.2, flip, span: KATANA_ARC * 2, pal: evo ? SWING_PAL.katanaEvo : SWING_PAL.katana }); // 見た目 = 当たり判定
  forEachNear(x, y, R, e => {
    let diff = Math.atan2(e.y - y, e.x - x) - a;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    if (Math.abs(diff) > KATANA_ARC) return;
    hitEnemy(e, st.dmg, { src: 'katana', ang: a, kb: 55, col: '#ff8a9a', el });
    if (!e.prop && missed !== e) hits++; // 外れた斬撃は村正の数に数えない
  });
  // 鬼神・村正: 刀が CUT_EVERY 回当たるごとに、一閃の切り裂き(CD CUT_CD 秒。CD 中は CUT_EVERY で止めて待ち、明けた後の命中で出る)
  if (evo && hits && w) {
    w.cutN = Math.min(CUT_EVERY, (w.cutN || 0) + hits);
    if (w.cutN >= CUT_EVERY && S.time >= (w.cutAt || 0)) { w.cutN = 0; w.cutAt = S.time + CUT_CD; muramasaCut(st, org); }
  }
  AudioMan.slash();
}
// 鬼神・村正の一閃: 近くの敵を通るランダムな向きの長い切り裂き(刀の威力 × 800%、出血 +5)
//   時刻はゲーム時間(slashes の t)で進め、決まった時刻に s.ev のイベントを起こす(ヒットストップ・スローでもずれない)
//   0 〜 CUT_OMEN      予兆: 周りが少し暗くなり、刃の筋が点線でうっすら走る。始点と自分の刀がきらめく
//   CUT_OMEN 〜 CUT_RUN  一閃: 切っ先が端から端へ走る(色収差)。走り終えた瞬間に一瞬止まる
//   CUT_RUN 〜           残心: 白い芯 → 赤 → 墨の縁と細くなって消える。空間が裂けたように線が二つに分かれる
//   CUT_HIT              遅れて斬撃が炸裂: ダメージ・出血・敵の上の斬り跡・血しぶきと墨の飛沫
const CUT_EVERY = 50, CUT_CD = 1, CUT_OMEN = 0.1, CUT_RUN = 0.16, CUT_HIT = 0.24, CUT_LIFE = 0.85;
// 一閃の配色(村正・居合)。core: 芯 / flash: 炸裂の閃き / omen: 予兆の点線(無ければ白・淡い桃色)
const CUT_PAL = { dark: '#3a0610', mid: '#a8102a', bright: '#ff2a48', wakeGlow: '#a0102a', edge: '#1a0408', rim: '#ff9aa6', glow: '#ff3b5c' };
// 血の色(ブラッドアサシン): 白や桃色を使わず、暗い紅と黒に近い赤で塗る(明るいのは芯の血の赤だけ)
const CUT_PAL_BLOOD = { dark: '#1e0004', mid: '#5a000c', bright: '#8e0016', wakeGlow: '#3a0008', edge: '#0a0002', rim: '#a8081c', glow: '#6a000e',
  core: '#d0142a', flash: '#b80c22', omen: '#8a1020', glowK: 0.35, lightK: 0.45 };
const BLOOD = ['#5a000c', '#8e0016', '#3a0008', '#b80c22']; // 血の飛沫・霧の色
// 一閃の中心線(少し反った三日月)。u = 0..1
function cutPt(s, u) {
  const b = s.bulge * Math.sin(Math.PI * u);
  return [s.x0 + (s.x1 - s.x0) * u + s.nx * b, s.y0 + (s.y1 - s.y0) * u + s.ny * b];
}
// 点 (x, y) が一閃の線(三日月)から W 以内か(当たり判定)
function cutNear(s, x, y, W) {
  const L2 = (s.x1 - s.x0) ** 2 + (s.y1 - s.y0) ** 2, u = clamp(((x - s.x0) * (s.x1 - s.x0) + (y - s.y0) * (s.y1 - s.y0)) / L2, 0, 1), [px, py] = cutPt(s, u);
  return d2(x, y, px, py) <= W * W;
}
// 一閃を作る(村正・居合・乱れ桜で共有)。時刻 omen / run / hit と life はゲーム時間
//   o.wk: 帯の太さの倍率 / o.nodim: 周りを暗くしない / o.pal: 配色 / o.late: hit 時刻に s.onHit を呼ぶ(あとから決まる処理用)
function makeCut(x0, y0, x1, y1, o = {}) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, a = Math.atan2(dy, dx);
  const s = { cut: true, a, x0, y0, x1, y1, nx: -Math.sin(a), ny: Math.cos(a), bulge: len * 0.025 * (Math.random() < 0.5 ? -1 : 1), len, t: 0,
    omen: o.omen ?? CUT_OMEN, run: o.run ?? CUT_RUN, hit: o.hit ?? CUT_HIT, life: o.life ?? CUT_LIFE, wk: o.wk ?? 1, nodim: !!o.nodim, pal: o.pal || CUT_PAL, ev: [] };
  if (o.late) s.ev.push({ at: s.hit, fn: () => { s.hitDue = true; if (s.onHit) s.onHit(); } });
  slashes.push(s);
  return s;
}
// 走り終えた瞬間の火花(線に沿って進行方向へ飛ぶ。切っ先の先で小さく爆ぜる)
function cutSpark(s, n, cols = ['#ffffff', '#ffd0d8', '#ff8a9a']) {
  asMine(() => {
    for (let i = 0; i < n; i++) { const [x, y] = cutPt(s, Math.random()), sp = rand(60, 170); part(x, y, Math.cos(s.a) * sp, Math.sin(s.a) * sp, rand(0.12, 0.28), pick(cols), { glow: true, drag: 5 }); }
    burst(s.x1, s.y1, 12, [cols[0], cols[cols.length - 1]], { sp: 110, glow: true, life: 0.3 });
  });
}
function muramasaCut(st, org = P_ORG) {
  const tg = nearestEnemy(org.x, org.y, 140), cx = tg ? tg.x : org.x, cy = tg ? tg.y : org.y;
  const a = rand(0, TAU), L = 120 * P.area, W = 14 * P.area;
  const s = makeCut(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
  s.ev.push(
    { at: CUT_OMEN, fn: () => { AudioMan.cut(); GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9 * SET.fxA); } },
    { at: CUT_RUN, fn: () => { hitstop(0.05); shake(3); screenFlash(0.08 * SET.fxA, '#ff3b5c'); cutSpark(s, 22); } }, // 走り終えた瞬間: 一瞬止める
    { at: CUT_HIT, fn: () => cutHit(s, st, W) },
  );
  AudioMan.cutDraw();
}
// 遅れて斬撃が炸裂する: 線(三日月)に沿って当たり判定
function cutHit(s, st, W) {
  if (state !== 'play') return;
  asMine(() => {
    const L2 = (s.x1 - s.x0) ** 2 + (s.y1 - s.y0) ** 2, cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2, ca = Math.cos(s.a), sa = Math.sin(s.a);
    let marks = 0;
    forEachNear(cx, cy, s.len / 2 + W, e => {
      const u = clamp(((e.x - s.x0) * (s.x1 - s.x0) + (e.y - s.y0) * (s.y1 - s.y0)) / L2, 0, 1), [px, py] = cutPt(s, u);
      if (d2(e.x, e.y, px, py) > (W + (e.r || 4)) ** 2) return;
      if (e.prop) { killEnemy(e); return; }
      const sd = (e.x - px) * s.nx + (e.y - py) * s.ny < 0 ? -1 : 1; // 線のどちら側にいるか(そちらへ押し出す)
      hitEnemy(e, st.dmg * 8, { src: 'katana', ang: Math.atan2(s.ny * sd, s.nx * sd), kb: 70, col: '#ff3b5c' });
      addBleed(e, 5); // 出血 5
      if (marks++ < 8) slashes.push({ mark: true, x: e.x - ca * 8, y: e.y - sa * 8, x1: e.x + ca * 8, y1: e.y + sa * 8, t: 0, life: 0.16 }); // 敵の上の細い斬り跡(重なって白く飛ばないよう 8体まで)
      for (let i = 0; i < 10; i++) { // 血しぶき(線の両側へ。重さで落ちる)
        const k = i % 2 ? 1 : -1, sp = rand(40, 130);
        part(e.x, e.y, s.nx * k * sp + ca * rand(-30, 30), s.ny * k * sp + sa * rand(-30, 30) - 20, rand(0.35, 0.7), pick(['#a0122a', '#5a0a14', '#ff3b5c']), { g: 220, drag: 2, sz: pick([1, 2]) });
      }
    });
    for (let i = 0; i < 36; i++) { // 墨のような飛沫(線全体から)
      const [x, y] = cutPt(s, Math.random()), k = Math.random() < 0.5 ? -1 : 1, sp = rand(20, 110);
      part(x, y, s.nx * k * sp, s.ny * k * sp - 10, rand(0.4, 0.9), pick(['#1a0508', '#1a0508', '#a0122a', '#ff3b5c', '#ffd0d8']), { g: 140, drag: 2.5, sz: pick([1, 1, 2]), glow: Math.random() < 0.3 });
    }
    for (let i = 0; i < 10; i++) { const [x, y] = cutPt(s, Math.random()); part(x, y, rand(-15, 15), -rand(10, 30), rand(0.7, 1.1), pick(['#ff5d73', '#ff8a9a']), { glow: true, drag: 1 }); } // ゆっくり舞う赤い光
    for (const u of [0.2, 0.5, 0.8]) { const [x, y] = cutPt(s, u); shockAt(x, y, 0.7, 1.3); }
    shake(6);
  });
  AudioMan.cutHit();
}


// 天弓の 2回目: 少し遅れて(TENKYU_ECHO 秒)、金の残像の矢が同じ向きでもう一度突き刺さる(ダメージの数字も出す。同じ瞬間に当てると 1回に見えるため)
const TENKYU_ECHO = 0.08;
function tenkyuEcho(e, dmg, ang, o) {
  setTimeout(() => {
    if (state !== 'play' || e.dead) return;
    asMine(() => {
      hitEnemy(e, dmg, o);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      slashes.push({ mark: true, x: e.x - ca * 9, y: e.y - 2 - sa * 9, x1: e.x + ca * 3, y1: e.y - 2 + sa * 3, t: 0, life: 0.16, col: '#8a6a10', core: '#ffe14a' }); // 金の残像の矢
      burst(e.x, e.y - 2, 5, ['#ffe14a', '#fff6c8'], { sp: 55, glow: true, life: 0.22 });
    });
  }, TENKYU_ECHO * 1000);
}
// ---------- 弾 ----------
function updProjs(dt) {
  for (let i = projs.length - 1; i >= 0; i--) {
    const p = projs[i];
    p.t += dt;
    if ((p.homing || p.home) && !p.spiral) {
      // target: 一斉射撃の狙った敵 / seek: 弾ごとの狙い方(スピリットストーム: まだ取り憑かれていない敵)/ それ以外は、まだ当たっていない一番近い敵
      const tg = p.target && !p.target.dead ? p.target : p.seek ? p.seek(p) : nearestUnhit(p.x, p.y, 120, p.hit);
      if (tg && !p.hit.has(tg.id)) {
        const want = Math.atan2(tg.y - p.y, tg.x - p.x);
        let cur = Math.atan2(p.vy, p.vx), diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
        cur += clamp(diff, -(p.homing || 4) * dt, (p.homing || 4) * dt);
        const sp = p.speed || Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
    }
    if (p.spiral && p.spiralT && p.t >= p.spiralT) { // らせんを終えて、そのときの向きのまま普通に飛ぶ(スピリットストーム: ここから敵を追う)
      const k = (p.speed || Math.hypot(p.vx, p.vy)) / (Math.hypot(p.vx, p.vy) || 1);
      p.vx *= k; p.vy *= k; p.spiral = null;
    }
    if (p.spiral) { // らせん(刃輪展開の飛び散る刃・スピリットストーム): 中心から外へ広がりながら回り続ける(回る速さは一定)
      const s = p.spiral;
      s.r += s.vr * dt; s.a += s.vt / Math.max(8, s.r) * dt;
      p.vx = (s.cx + Math.cos(s.a) * s.r - p.x) / dt; p.vy = (s.cy + Math.sin(s.a) * s.r - p.y) / dt; // 向きは描画・ノックバック用
    }
    if (p.toP) { // 自分のところへ戻る(刃の雨)。届いたら消える
      const a = Math.atan2(P.y - p.y, P.x - p.x);
      p.vx = Math.cos(a) * p.speed; p.vy = Math.sin(a) * p.speed;
      if (d2(p.x, p.y, P.x, P.y) < 64) p.t = p.life;
    }
    if (p.whirl) axeWhirl(p, dt); // 巨斧旋風(テンペスト)
    if (p.g) p.vy += p.g * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spin) p.ang += p.spin * dt;
    // 軌跡パーティクル
    if (p.kind === 'bolt' || p.kind === 'wisp' || p.kind === 'orbShot') part(p.x, p.y, rand(-5, 5), rand(-5, 5), 0.25, p.col, { glow: true, drag: 5 });
    if (p.kind === 'fire' && Math.random() < 0.8) part(p.x + rand(-2, 2), p.y + rand(-2, 2), rand(-10, 10), rand(-25, -5), 0.4, pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true, sz: pick([1, 2]) });
    if (p.t >= p.life) { if (p.onEnd) p.onEnd(p); projs.splice(i, 1); continue; }
    if (p.noHit) continue;
    let dead = false;
    forEachNear(p.x, p.y, p.r, e => {
      if (p.hit.has(e.id)) return;
      p.hit.add(e.id);
      const ang = Math.atan2(p.vy, p.vx);
      let dmg = p.dmg;
      if (p.focus) { if (e.fcId !== p.focus) { e.fcId = p.focus; e.fcN = 0; } dmg *= 1 + Math.min(0.5, 0.05 * e.fcN++); } // 集中砲火
      hitEnemy(e, dmg, { src: p.src, ang, kb: p.kind === 'axe' ? 50 : 22, col: p.col, el: p.el, eHit: p.eHit, forceCrit: p.forceCrit, cl: p.cl });
      if (missed === e) return; // 外れ(砂塵・暗闇)・攻撃不能: 弾はそのまま抜ける(貫通を減らさない。当たったときの効果・爆発もない)
      if (p.onHit) p.onHit(e);
      if (p.dbl && p.pierce > 0 && !e.dead) { p.pierce--; tenkyuEcho(e, dmg, ang, { src: p.src, col: p.col, el: p.el, eHit: p.eHit, cl: p.cl }); } // 天弓: 二重ヒット(貫通を1消費)
      if (p.burn) addBurn(e, p.burn, 3, p.src);
      if (p.boom > 0) {
        p.boom--;
        const bx = e.x, by = e.y;
        const BR = (p.boomR || 16) * P.area;
        forEachNear(bx, by, BR, e2 => { if (e2 !== e) hitEnemy(e2, p.dmg * 0.6, { src: p.src, noNum: true, col: '#ff8a3d' }); });
        burst(bx, by, 12, ['#ff6a2a', '#ffc34a', '#fff6c8'], { sp: 70, glow: true });
        addFlash(bx, by, 40, '#ff8a3d', 0.2); addRing(bx, by, BR, '#ffc34a', { life: 0.2 });
      }
      if (p.pierce-- <= 0) {
        dead = true;
        burst(p.x, p.y, 5, [p.col || '#fff', '#ffffff'], { sp: 50, glow: true, life: 0.3 });
        if (p.onEnd) p.onEnd(p); // 消えるとき(寿命で消えるときと同じ)
        return false;
      }
    });
    if (dead) { projs.splice(i, 1); continue; }
    if (p.kind === 'axe' && p.y > cam.y + GFX.VH + 30) projs.splice(i, 1);
  }
}

// 巨斧旋風(スローイングアックスの進化「テンペスト」): 上がりきる手前で重力を切ってだんだん止まり、速く回りながら周りを斬る → 重力をだんだん戻して落ちる
//   p.wh: 0 = 上昇 / 1 = 旋回 / 2 = 落下。止まっている間のぶん寿命を延ばす(落ちる長さは今までと同じ)
function axeWhirl(p, dt) {
  const W = DATA.weapons.axe.evo;
  if (!p.wh) {
    if (p.vy < -W.brake) return;
    p.wh = 1; p.wt = 0; p.tick = 0; p.g0 = p.g; p.g = 0; p.life += W.whirlT;
    AudioMan.dash();
  }
  p.wt += dt;
  if (p.wh === 1) {
    const k = Math.exp(-W.damp * dt), s = Math.sign(p.spin) || 1;
    p.vx *= k; p.vy *= k;                                            // なめらかに止まる
    p.spin = s * Math.min(W.spinMax, Math.abs(p.spin) + 60 * dt);   // 回転がだんだん速くなる
    if ((p.tick -= dt) <= 0) {
      p.tick += W.every;
      const R = W.whirlR * P.area, x = p.x, y = p.y;
      asMine(() => {
        forEachNear(x, y, R, e => {
          if (e.prop) { killEnemy(e); return; }
          hitEnemy(e, p.wdmg, { src: p.src, ang: Math.atan2(e.y - y, e.x - x), kb: 20, col: '#ffb070', noNum: Math.random() < 0.75 }); // 何度も当たるので数字は少なめ(ブラックホールと同じ)
        });
        for (let i = 0; i < 4; i++) { const a = rand(0, TAU); part(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8, -Math.sin(a) * 90 * s, Math.cos(a) * 90 * s, 0.25, pick(['#ffb070', '#fff1d0', '#8a5a2a']), { glow: i === 0, drag: 2 }); }
      });
    }
    if (p.wt >= W.whirlT) { p.wh = 2; p.wt = 0; }
    return;
  }
  p.g = p.g0 * Math.min(1, p.wt / W.fallEase); // 落下: 重力をだんだん戻す
}

// ---------- 設置ゾーン(ブリザード / ブラックホール) ----------
const ICE_FALL = 0.15; // つららが落ちてくる時間
// アローレインの見た目の矢: RAIN_FALL 秒で空から落ち(高さ RAIN_H)、刺さってから RAIN_STUCK 秒で消える
const RAIN_FALL = 0.12, RAIN_H = 60, RAIN_STUCK = 0.6;
// 1回に降らせる見た目の矢: nArrows は半径 60 のときの本数。広いほど増やして密度を保つ(最大 2.5倍)。画質で減らす
const rainArrowN = z => Math.max(2, Math.round(z.nArrows * clamp((z.r / 60) ** 2, 1, 2.5) * Math.min(1, 0.3 + gq().parts)));
// 矢が刺さった瞬間: 土煙と火花(炎の矢は火の粉)
function rainImpact(z, ar) {
  asMine(() => {
    part(ar.x + rand(-1, 1), ar.y, rand(-14, 14), -rand(8, 22), rand(0.25, 0.4), pick(['#6a5a40', '#4a3e2e', '#8a7a5a']), { g: 90, drag: 3 });
    if (Math.random() < 0.6) part(ar.x, ar.y - 1, rand(-30, 30), -rand(20, 50), 0.15, z.fire ? pick(['#ffc34a', '#ff8a3d']) : pick(['#e4ffd8', '#b8ff9a']), { glow: true, drag: 4 });
    if (z.fire && Math.random() < 0.5) part(ar.x + rand(-1, 1), ar.y - 2, rand(-6, 6), -rand(15, 30), rand(0.4, 0.7), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true, drag: 1 });
  });
}
function updZones(dt) {
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t += dt; z.tick -= dt;
    if (z.kind === 'blizz') {
      if (z.evo) z.r = z.r0 * (1 + 0.1 * z.t);
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU), r = rand(0, z.r);
        part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.sin(a) * 40, Math.cos(a) * 40, 0.5, pick(['#bff4ff', '#ffffff', '#7ad7ff']), { glow: true, drag: 1 });
      }
      if (z.tick <= 0) {
        z.tick = 0.25;
        forEachNear(z.x, z.y, z.r, e => {
          if (z.dmg) hitEnemy(e, z.dmg, { src: 'blizzard', noNum: Math.random() < 0.6, col: '#bff4ff', frost: true }); else rollHit(e); // ダメージのない吹雪も外れる
          if (z.maxFrost) addFrost(e, mageFrostCap(), mageFrostCap()); else addFrost(e, 1, 10); // maxFrost: 絶対零度
        });
      }
    } else if (z.kind === 'rain') { // アローレイン: 範囲のランダムな位置へ矢が斜めに降って刺さる(follow: 追従。ついていく使い手)
      //   見た目の矢: t < 0 は降り始める前(少しずつずらして降らせる)→ RAIN_FALL 秒で落ちる → 刺さって残る。終わった後も linger 秒は刺さった矢だけ残る
      const live = z.t < z.dur;
      if (z.follow && live) { z.x = z.follow.x; z.y = z.follow.y; }
      for (const ar of z.arrows) { ar.t += dt; if (!ar.hit && ar.t >= RAIN_FALL) { ar.hit = true; rainImpact(z, ar); } }
      z.arrows = z.arrows.filter(ar => ar.t < RAIN_FALL + RAIN_STUCK);
      if (z.t >= z.delay && live) {
        z.acc += dt;
        while (z.acc >= z.every) { // every 秒ごとに、範囲内の敵全員へ(見た目の矢はランダムな位置に。最後の 1回は倍の本数)
          z.acc -= z.every; z.pulseT = z.t;
          const el = clsNextEl(), x0 = z.x, y0 = z.y, n = rainArrowN(z) * (z.t + z.every >= z.dur ? 2 : 1);
          for (let i = 0; i < n; i++) { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * z.r; z.arrows.push({ x: x0 + Math.cos(a) * rr, y: y0 + Math.sin(a) * rr, t: -i * z.every / n }); }
          if (z.arrows.length > 220) z.arrows.splice(0, z.arrows.length - 220);
          AudioMan.rainTick();
          setTimeout(() => { // 矢が落ちてから当たる
            if (state !== 'play') return;
            asMine(() => {
              forEachNear(x0, y0, z.r, e => {
                const dealt = hitEnemy(e, z.dmg, { src: 'arrowrain', col: z.fire ? '#ff8a3d' : '#b8ff9a', el, eHit: true, noNum: Math.random() < 0.5, cl: z.cl });
                if (z.fire && dealt && !e.dead) addBurn(e, dealt * z.fire / z.fireT / dmgMul(), z.fireT, 'arrowrain'); // 炎の矢(与えたダメージの 40% を3秒で)
                if (Math.random() < 0.4) part(e.x, e.y, rand(-20, 20), -rand(10, 30), 0.3, pick(['#b8ff9a', '#e4ffd8', '#8a8098']), { glow: true });
              });
            });
          }, RAIN_FALL * 1000); // 1本目の矢が刺さる瞬間
        }
      }
      if (z.t + dt >= z.dur && !z.done) { // 降り終わり: 光が弾け、輪が外へ広がって土煙が上がる
        z.done = true;
        asMine(() => {
          addFlash(z.x, z.y, z.r * 2.4, z.fire ? '#ff8a3d' : '#b8ff9a', 0.3); addRing(z.x, z.y, z.r, z.fire ? '#ffe0b0' : '#e4ffd8', { w: 2, life: 0.35 });
          addRing(z.x, z.y, z.r * 1.25, z.fire ? '#ffb070' : '#b8ff9a', { r0: z.r * 0.7, life: 0.45 });
          burst(z.x, z.y, 18, ['#6a5a40', '#4a3e2e', '#8a7a5a'], { sp: 60, up: 20, g: 120, life: 0.5, drag: 2 });
          shake(2);
        });
      }
    } else if (z.kind === 'lightrain') { // 光の雨: 中にいると HP が回復する
      if (d2(P.x, P.y, z.x, z.y) < z.r * z.r) heal(DATA.weapons.aura.skill.rainHeal * dt, true);
      if (Math.random() < dt * 12) part(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.5, 0, -rand(10, 25), 0.6, pick(['#ffe38a', '#fff6d8']), { glow: true });
    } else if (z.kind === 'pillar') { // 光の柱(見た目だけ)
    } else if (z.kind === 'gspark') { // グラビティスパーク: 最初に1回大きく引き寄せ → 爆発
      if (!z.pulled) {
        z.pulled = true;
        forEachNear(z.x, z.y, z.r, e => { if (e.boss || e.prop) return; const k = 8 * (1 - (e.kbRes || 0) * 0.5); e.kx += (z.x - e.x) * k; e.ky += (z.y - e.y) * k; });
        for (let i = 0; i < 30; i++) { const a = rand(0, TAU), r = z.r * rand(0.6, 1); part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.cos(a) * r * 4, -Math.sin(a) * r * 4, 0.22, pick(['#9fd8ff', '#fff27a', '#ffffff']), { glow: true, drag: 0 }); }
      }
      const sk = DATA.weapons.thunder.skill;
      if (!z.boomed && Math.random() < dt * 26) { const a = rand(0, TAU), L = rand(6, 14) + z.r * 0.15 * (z.t / sk.boomT); asMine(() => bolts.push({ x0: z.x, y0: z.y, x1: z.x + Math.cos(a) * L, y1: z.y + Math.sin(a) * L, t: 0, life: 0.06, w: 1 })); } // 球のまわりではじける稲妻(爆発が近いほど長い)
      if (!z.boomed && z.t >= sk.boomT) {
        z.boomed = true;
        const el = clsNextEl();
        asMine(() => {
          forEachNear(z.x, z.y, z.boomR, e => {
            if (e.prop) { killEnemy(e); return; }
            const dealt = hitEnemy(e, z.dmg, { src: 'gspark', ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 30, col: '#9fd8ff', el, eHit: true, cl: z.cl });
            if (dealt && !e.dead) addShock(e, dealt, sk.shock);
            if (z.stun && dealt && !e.dead) e.stun = Math.max(e.stun || 0, e.boss ? sk.bossStun : sk.stun); // 超電磁(外れた敵は止まらない)
          });
          for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rand(-0.2, 0.2), L = z.boomR * rand(1, 1.6); bolts.push({ x0: z.x, y0: z.y, x1: z.x + Math.cos(a) * L, y1: z.y + Math.sin(a) * L, t: 0, life: 0.2, w: 1 }); }
          addFlash(z.x, z.y, z.boomR * 2.2, '#9fd8ff', 0.22); addRing(z.x, z.y, z.boomR, '#ffffff', { w: 2, life: 0.35 });
          burst(z.x, z.y, 30, ['#9fd8ff', '#fff27a', '#ffffff'], { sp: 150, glow: true, life: 0.4 }); shockAt(z.x, z.y, 1.3, 1); shake(6);
          fxRays(z.x, z.y, z.boomR * 1.6, '#4aa8f0', { n: 14, life: 0.32, core: '#9fd8ff' });
          fxDecal(z.x, z.y + 2, z.boomR * 0.8, 'scorch', { col: '#0a0c18', hot: '#9fd8ff', heatT: 0.7, life: 2.5 });
        });
        AudioMan.boom(); AudioMan.zap();
      }
    } else if (z.kind === 'tower') { // 鉄塔: every 秒ごとに近くの敵 1体へ放電 / 送電線
      const top = z.y - (z.big ? 31 : 21); // 先端の球
      if (z.tick <= 0) {
        z.tick = DATA.classes.electro.q.every;
        const tg = nearestEnemy(z.x, z.y, z.r);
        if (tg) asMine(() => {
          const dealt = hitEnemy(tg, z.pow, { src: 'tower', ang: Math.atan2(tg.y - z.y, tg.x - z.x), kb: 20, col: '#fff27a' });
          if (dealt) { addShock(tg, dealt, z.shock); if (z.dis) addShock(tg, dealt, z.dis, { noCharge: true }); }
          bolts.push({ x0: z.x, y0: top, x1: tg.x, y1: tg.y, t: 0, life: 0.18, w: z.big ? 3 : 2 });
          addFlash(tg.x, tg.y, 30, '#fff27a', 0.2);
        });
        if (tg) AudioMan.zap();
      }
      if (z.wire) { // 送電線: 自分と鉄塔を線でつなぐ
        z.wireT -= dt;
        if (z.wireT <= 0) {
          z.wireT = DATA.classes.electro.q.wireEvery;
          const W = DATA.classes.electro.q.wireW, ax = z.x, ay = top + 3, bx = P.x, by = P.y - 8, L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
          asMine(() => forEachNear((ax + bx) / 2, (ay + by) / 2, Math.sqrt(L2) / 2 + W, e => {
            if (e.prop) return;
            const u = clamp(((e.x - ax) * (bx - ax) + (e.y - ay) * (by - ay)) / L2, 0, 1), px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
            if (d2(e.x, e.y, px, py) < W * W) hitEnemy(e, z.wire, { src: 'tower', noNum: Math.random() < 0.6, col: '#fff27a' });
          }));
        }
      }
      if (Math.random() < dt * 6) bolts.push({ x0: z.x, y0: top, x1: z.x + rand(-6, 6), y1: top + rand(-6, 2), t: 0, life: 0.06, w: 1 }); // 先端の火花
      if (z.t + dt >= z.dur && !z.done) { z.done = true; asMine(() => burst(z.x, z.y - 10, z.big ? 20 : 12, ['#8a8098', '#fff27a'], { sp: 60, up: 20, life: 0.4 })); } // 崩れる
    } else if (z.kind === 'icicle') { // アイシクルフォール: every 秒ごとに1本。範囲内の敵を狙う(いなければランダムな位置)
      for (const ic of z.ices) ic.t += dt;
      z.acc += dt;
      while (z.left > 0 && z.acc >= z.every) {
        z.acc -= z.every; z.left--;
        let x, y;
        const tg = pick(enemies.filter(e => !e.dead && !e.prop && d2(e.x, e.y, z.x, z.y) < z.r * z.r));
        if (tg) { x = tg.x; y = tg.y; } else { const a = rand(0, TAU), rr = Math.sqrt(Math.random()) * z.r; x = z.x + Math.cos(a) * rr; y = z.y + Math.sin(a) * rr; }
        z.ices.push({ x, y, t: 0 });
        if (z.left === 0 && z.big) z.ices.push({ x: z.x, y: z.y, t: -0.35, big: true }); // 大氷柱: 最後に巨大なつらら
      }
      for (const ic of z.ices) {
        if (ic.done || ic.t < ICE_FALL) continue;
        ic.done = true;
        const R = ic.big ? z.bigR : z.iceR, dmg = ic.big ? z.big : z.dmg, el = clsNextEl();
        asMine(() => {
          forEachNear(ic.x, ic.y, R, e => {
            if (e.prop) { killEnemy(e); return; }
            hitEnemy(e, dmg, { src: 'icicle', ang: Math.atan2(e.y - ic.y, e.x - ic.x), kb: ic.big ? 120 : 15, col: '#bff4ff', el, eHit: true, frost: true, noNum: !ic.big && Math.random() < 0.4, cl: z.cl });
            if (!e.dead) addFrost(e, z.frost, 10);
          });
          burst(ic.x, ic.y, ic.big ? 40 : 8, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: ic.big ? 160 : 70, up: 30, g: 160, glow: true, life: 0.45 });
          addFlash(ic.x, ic.y, R * (ic.big ? 2.2 : 1.4), '#bff4ff', ic.big ? 0.4 : 0.08);
          if (ic.big) { addRing(ic.x, ic.y, R, '#ffffff', { w: 3, life: 0.45 }); shockAt(ic.x, ic.y, 1.6, 1); shake(8); hitstop(0.05); AudioMan.boom(); fxRays(ic.x, ic.y - 4, R * 1.5, '#7ad7ff', { n: 16, life: 0.38 }); fxDecal(ic.x, ic.y, R, 'frost', { life: 3.5, n: 10 }); }
          else { shake(1); if (Math.random() < 0.4) fxDecal(ic.x, ic.y, R * 0.9, 'frost', { life: 1.8, n: 5 }); }
        });
        if (z.patch) zones.push({ kind: 'frostpatch', x: ic.x, y: ic.y, r: R, t: 0, dur: DATA.weapons.blizzard.skill.patchT, tick: 0.5 }); // 凍てつく大地
        if (!ic.big && Math.random() < 0.5) AudioMan.hit();
      }
      z.ices = z.ices.filter(ic => !ic.done || ic.t < ICE_FALL + 0.4);
      if (z.left > 0 || z.ices.length) z.dur = Math.max(z.dur, z.t + 0.1); // 降り終わるまで残す
    } else if (z.kind === 'frostpatch') { // 凍てつく大地: 触れた敵に凍傷 +1 / 0.5秒
      if (z.tick <= 0) { z.tick = 0.5; forEachNear(z.x, z.y, z.r, e => { if (!e.prop && rollHit(e)) addFrost(e, 1, 10); }); } // 効果だけの攻撃も外れる
    } else if (z.kind === 'ddust') { // ダイヤモンドダスト: 自分についてくる細氷の領域
      z.x = P.x; z.y = P.y;
      if (z.tick <= 0) {
        z.tick = z.every;
        asMine(() => forEachNear(z.x, z.y, z.r, e => {
          if (e.prop) return;
          e.dustT = S.time; // この範囲内で凍結すると凍結時間が延びる
          const frozen = !!e.freeze;
          hitEnemy(e, z.dmg, { src: 'ddust', col: '#bff4ff', noNum: Math.random() < 0.6, frost: true });
          if (!e.dead) addFrost(e, z.frost, 10);
          if (z.glitter && frozen && !e.dead) { hitEnemy(e, z.glitter, { src: 'ddust', col: '#ffffff', noNum: Math.random() < 0.5 }); part(e.x, e.y - 4, 0, -20, 0.4, '#ffffff', { glow: true, sz: 2 }); } // 煌めき
        }));
      }
      for (let k = 0; k < 4; k++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * z.r; part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, rand(-8, 8), rand(-12, 4), rand(0.4, 0.8), pick(['#ffffff', '#bff4ff', '#e0f8ff']), { glow: true, drag: 1 }); }
    } else if (z.kind === 'grudge') { // 慟哭(葬送の特殊強化): 着弾地点に残る念。lingerEvery 秒ごとに範囲の敵へ
      if (z.tick <= 0) {
        z.tick = DATA.classes.necro.q.lingerEvery;
        asMine(() => forEachNear(z.x, z.y, z.r, e => { if (!e.prop) hitEnemy(e, z.dmg, { src: 'nrite', noNum: Math.random() < 0.5, col: '#a58cff' }); }));
      }
      if (Math.random() < dt * 14) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * z.r; asMine(() => part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * 0.7, rand(-6, 6), -rand(10, 25), 0.6, pick(['#8a6cff', '#5a3ab0', '#3a2a6a']), { glow: true, drag: 1 })); }
    } else if (z.kind === 'residue') { // ブリンクの氷の残滓: 触れた敵に凍傷
      if (Math.random() < dt * 20) part(z.x + rand(-z.r, z.r), z.y + rand(-z.r, z.r) * 0.6, 0, -10, 0.5, pick(['#bff4ff', '#ffffff']), { glow: true });
      if (z.tick <= 0) {
        z.tick = 0.3;
        forEachNear(z.x, z.y, z.r, e => { if (!e.prop && rollHit(e)) addFrost(e, 1, mageFrostCap()); }); // 効果だけの攻撃も外れる
      }
    } else if (z.kind === 'hole') {
      const R = z.r * Math.min(1, z.t * 5);
      if (z.evo) forEachNear(z.x, z.y, R, e => { e.atkDownT = S.time + 0.15; }); // ビッグクランチ: 中の敵(ボスも)は攻撃力が下がる
      forEachNear(z.x, z.y, R * 1.6, e => {
        if (e.boss || e.obj) return; // ボスが出した物は吸い込まれない
        const a = Math.atan2(z.y - e.y, z.x - e.x), dd = Math.sqrt(d2(z.x, z.y, e.x, e.y));
        const k = Math.min(dd, z.pull * dt * (1 - (e.kbRes || 0) * 0.6));
        e.x += Math.cos(a) * k; e.y += Math.sin(a) * k;
      });
      if (z.tick <= 0) {
        z.tick = 0.1;
        if (z.dmg) forEachNear(z.x, z.y, R, e => { hitEnemy(e, z.dmg, { src: 'bhole', noNum: Math.random() < 0.75, col: '#c78bff' }); }); // dmg 0 の渦は引き寄せだけ
      }
      for (let k = 0; k < 3; k++) {
        const a = rand(0, TAU), r = R * rand(1, 1.6);
        part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.cos(a) * r * 2.5, -Math.sin(a) * r * 2.5, 0.4, pick(['#c78bff', '#6a3aa0', '#ffffff']), { glow: true, drag: 0 });
      }
      if (z.t >= z.dur && z.evo) {
        const ER = z.r * 1.5;
        forEachNear(z.x, z.y, ER, e => hitEnemy(e, 110, { src: 'bhole', ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 120, col: '#ff9bf5' }));
        burst(z.x, z.y, 60, ['#c78bff', '#ff9bf5', '#ffffff'], { sp: 160, glow: true, life: 0.8 });
        addRing(z.x, z.y, ER, '#ff9bf5', { w: 2, life: 0.4 }); addFlash(z.x, z.y, 120, '#c78bff', 0.4);
        shockAt(z.x, z.y, 1.6, 0.8); shake(6); AudioMan.boom();
      }
    }
    if (z.t >= z.dur + (z.linger || 0)) zones.splice(i, 1); // linger: 終わった後も見た目だけ残す秒(アローレインの刺さった矢)
  }
}
