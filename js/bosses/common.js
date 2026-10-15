// bosses/common.js — ボス共通(体を作る・出す・敵弾の作り方・時間差処理・壊せる物・AI の入口 bossAI)
'use strict';

// 設置物(hazards)の描き方: 種類 → (h, hx, hy, fade, hd) => { … }(hx, hy: 画面の座標 / fade: 出始めと消え際の濃さ / hd: render() の sx・gx・t・warnBlink・VW・VH)
//   各ボスのファイルで HAZ_DRAW.<種類> = … と足す。render() の設置物のループが呼ぶ(ここにない種類は render.js の中で描く)
const HAZ_DRAW = {};
// ボスの見た目だけの演出(bfx)の描き方: 種類 → (f, fx, fy, u, bd) => { … }(fx, fy: 画面の座標 / u: 経過 0〜1 / bd: drawBfx の sx・gx・t)
//   各ボスのファイルで BFX_DRAW.<種類> = … と足す。render.js の drawBfx が呼ぶ(ここにない種類は drawBfx の中で描く)
const BFX_DRAW = {};

// ============================================================
// ボス
// ============================================================
// ボスの体を作る(出現の演出・曲・HP バーなどの副作用なし)。hpMul: HP の倍率(影の王が呼ぶ影は 0.25)
function makeBoss(key, x, y, hpMul = 1) {
  const b = DATA.bosses[key];
  const hp = b.hp * enemyBase() * hpK() * CHAOS.bossHp * hpMul; // カオス: ボスの基礎体力(闘技場)
  const e = {
    id: nextId++, type: key, boss: key, name: b.name, final: false, enrage: b.enrage ?? 0.6, x, y,
    hp, maxhp: hp, spd: b.spd * Math.min(DATA.enemyLevel.spdMax, lvK('spd')), dmg: b.dmg * enemyDmgK(), r: b.r, col: b.col, xp: 0, kbRes: 1,
    t: 0, seed: 0, kx: 0, ky: 0, flash: 0, frost: 0, frostT: 0, burns: [], burnT: 0, burnTick: 0, stun: 0, slowT: 0, scale: 1, jz: 0, sq: 1,
    ai: {
      ph: 'chase', pt: 0, atk: 3, sum: 7, slam: 6, ring: 3, aim: 2, tp: 5, spiral: 3.5, spN: 0, spGap: 0, spA: 0, enraged: false,
      q: [], act: null, wind: 0, cd: 2.5, hop: 1, spinCd: 4, beamCd: 8, throw: 3, clock: 7,
    },
  };
  Object.assign(e.ai, BOSS_AI0[key] || {});
  return e;
}
function spawnBoss(key, final, companion) {
  const b = DATA.bosses[key];
  AudioMan.roar(); AudioMan.warning(); AudioMan.playMusic(b.music);
  UI.banner('⚠ WARNING ⚠', b.name);
  shake(8); screenFlash(0.3, '#ff3b5c');
  const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 30;
  const e = makeBoss(key, P.x + Math.cos(a) * R, P.y + Math.sin(a) * R);
  e.final = !!final;
  if (key === 'shadowking') e.hpFloor = e.maxhp; // 影の王: 最初の影を呼ぶまでは HP が減らない(出てすぐのフレームも)
  if (key === 'seraph') e.hpFloor = e.maxhp * 0.01; // 熾天使: 残り HP 1% でラストラディアンス(終わって立ち尽くすまで、それより下がらない。大きな一撃でも飛ばさない)
  if (CHAOS.rage) e.enrage = 2; // カオス: 常に激怒(最初のフレームで激昂する)
  enemies.push(e);
  S.boss = e;
  UI.bossBar(e);
  S.bosses = [e];
  if (!S.phase || S.phase.kind !== 'boss') S.phase = { kind: 'boss', t: 0 }; // ボスのフェーズ(双王の2体目では始め直さない)
  if (CHAOS.twin && !companion) { // カオス: もう1体(このステージ以外のボスからランダム)
    const here = new Set(S.sched ? S.sched.filter(x => x.boss).flatMap(x => x.boss) : []);
    const solo = k => !DATA.bosses[k].form2 && !DATA.bosses[k].noTwin; // 第二形態(終刻の死神)は単独では出ない / 影の王は相方に選ばれない
    const pool = Object.keys(DATA.bosses).filter(k => k !== key && !here.has(k) && solo(k));
    const k2 = pick(pool.length ? pool : Object.keys(DATA.bosses).filter(k => k !== key && solo(k)));
    const e2 = spawnBoss(k2, false, true);
    S.bosses = [e, e2]; S.boss = e; UI.bossBar(e);
  }
  return e;
}

// dmg: 当たったときのダメージ(呼ぶ側で ボスの基礎ダメージ × n にする。e.dmg に敵Lv の倍率は入っている)
function eball(x, y, a, spd, dmg, kind = 'ball') {
  const p = { kind, x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, dmg: dmg * (S.eatk ?? 1), life: 7, t: 0, r: (kind === 'scythe' || kind === 'rscythe' ? 4 : 3) * CHAOS.area };
  eprojs.push(p);
  return p;
}
// 放物線で飛ぶ弾(着弾まで当たり判定なし。着地で onLand)
function lob(kind, x, y, tx, ty, T, H, onLand) {
  const p = { kind, lob: true, x, y, x0: x, y0: y, tx, ty, T, H, z: 0, t: 0, onLand };
  eprojs.push(p);
  return p; // follow(p) を付けると、飛んでいる間に落下点(tx, ty)を動かせる
}
// 往復する大鎌(当たっても消えない)
function boomerang(e, a) {
  eprojs.push({ kind: 'boomer', x: e.x, y: e.y, a, v: 220, ret: false, owner: e, t: 0, life: 8, r: 7 * CHAOS.area, keep: true, dmg: e.dmg * 0.65 * (S.eatk ?? 1) });
}
function addHazard(kind, x, y, o) {
  if ((kind === 'goo' || kind === 'fire') && hazards.length > 80) { const i = hazards.findIndex(h => h.kind === kind); if (i >= 0) hazards.splice(i, 1); } // 床が増えすぎたら古いものから
  const h = Object.assign({ kind, x, y, t: 0, r: 10, dur: 6, seed: (Math.random() * 1e6) | 0 }, o);
  h.r *= CHAOS.area; if (h.max) h.max *= CHAOS.area; // カオス: 攻撃範囲
  hazards.push(h);
  return h;
}

// ---------- ボス共通 ----------
// 時間差処理はゲーム時間で進める(setTimeout だとポーズ・選択画面中も進んでしまう)
const later = (ai, t, fn) => ai.q.push({ t, fn });
function runLater(ai, dt) {
  for (let i = ai.q.length - 1; i >= 0; i--) { const q = ai.q[i]; if ((q.t -= dt) <= 0) { ai.q.splice(i, 1); q.fn(); } }
}
function segD2(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0, vy = y1 - y0, k = clamp(((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return d2(px, py, x0 + vx * k, y0 + vy * k);
}
const hitCircle = (x, y, r, dmg, o) => { r *= CHAOS.area; return d2(x, y, P.x, P.y) < (r + 3) * (r + 3) && hurtPlayer(dmg, o); }; // 当たったら true(o: hurtPlayer に渡す。pierce = 無敵無視)
const inLine = (x, y, a, len, w) => { len *= CHAOS.area; w *= CHAOS.area; return segD2(P.x, P.y, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len) < Math.pow(w / 2 + 3, 2); };
const hitLine = (x, y, a, len, w, dmg, o) => inLine(x, y, a, len, w) && hurtPlayer(dmg, o); // 当たったら true
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// 扇の当たり判定(中心 x, y・向き a・半径 r・片側 h rad。半径は攻撃範囲の倍率で広がる)
const inFan = (x, y, a, r, h) => { r *= CHAOS.area; const d = Math.sqrt(d2(x, y, P.x, P.y)); return d < r + 3 && (d < 4 || Math.abs(angDiff(Math.atan2(P.y - y, P.x - x), a)) < h + 3 / d); };
const hitFan = (x, y, a, r, h, dmg, o) => inFan(x, y, a, r, h) && hurtPlayer(dmg, o);
// 予備動作(停止して点滅 → fn)
//   windT: 構えの長さ(render.js の足元の輪)/ glint: 技の直前の合図を出したか
function windup(e, t, fn) { e.ai.wind = t; e.ai.windT = t; e.ai.glint = false; e.ai.fire = fn; }
// 大きな着弾の演出(ボスの攻撃の層。攻撃の濃さの設定で薄くならない): 赤い光芒と、地面の跡(既定は赤く光って冷える地割れ)
//   r: 当たり判定と同じ半径(CHAOS.area を掛けた値)/ o.col: 光芒の色 / o.core: 根元の色 / o.light: 光芒がまわりを照らす強さ / o.decal: 'crack' | 'scorch' | 'frost' | false / o.hot: 跡の光る芯 / o.dark: 跡の暗い色
function bossBlast(x, y, r, o = {}) {
  fxRays(x, y, r * 1.25, o.col || '#a0122a', { foe: true, n: o.n || 14, life: o.life || 0.34, core: o.core || '#ff3b5c', light: o.light || 0.8 });
  if (o.decal !== false) fxDecal(x, y + 2, r * 0.85, o.decal || 'crack', { foe: true, col: o.dark || '#100406', hot: o.hot || '#ff3b5c', heatT: 0.8, life: 3, n: o.cracks || 8 });
}
// ボスごとの着弾の色(光芒 col / 根元 core / 地面の跡の光る芯 hot / 暗い色 dark)。根元は淡い色にしない(着弾の閃光と重なって白く飛ぶ)
const BFX = {
  king: { col: '#4a6e30', core: '#b8d86a', hot: '#7fae4e', dark: '#141a08' },
  wyrm: { col: '#2a5a7a', core: '#6ee7ff', hot: '#6ee7ff', dark: '#0a1418' },
  gslime: { col: '#23735f', core: '#4fd6a8', hot: '#4fd6a8', dark: '#08140e', decal: 'scorch' },
  golem: { col: '#6a6258', core: '#6ee7ff', hot: '#ffb347', dark: '#14100c' },
  cdragon: { col: '#a01a4a', core: '#ff4a8a', hot: '#ff4a8a', dark: '#140408' },
  ifrit: { col: '#a03010', core: '#ff8a3d', hot: '#ff6a2a', dark: '#140804', decal: 'scorch' },
  stag: { col: '#5a4a8a', core: '#6ee7ff', hot: '#d88aff', dark: '#0a0814' },
  pqueen: { col: '#a04a8a', core: '#ff8ad8', hot: '#ff8ad8', dark: '#140810' },
  sea: { col: '#1a4a7a', core: '#4ab8e8', decal: false }, // クラーケン・海竜(水しぶき。地面の跡は残さない)
  ice: { col: '#2a5a88', core: '#4ab8e8', decal: false, light: 0.3 }, // 霜の巨人・雪華の女王(着弾の雪と氷がもともと白く明るいので、照らす光は弱く。凍った床が出るので地面の跡は残さない)
  warden: { col: '#8a6a2a', core: '#ffb347', hot: '#ffb347', dark: '#140c04' },
  cerberus: { col: '#2e6a1a', core: '#7dff6a', hot: '#7dff6a', dark: '#081406' },
  shadowking: { col: '#3a1a5a', core: '#a66bff', hot: '#a66bff', dark: '#06030c' },
  reaper: { col: '#5a3a8a', core: '#c29bff', hot: '#c29bff', dark: '#0a0614' },
  fhour: { col: '#8a0c22', core: '#ff3b5c', hot: '#ff3b5c', dark: '#0a0204' },
  qbee: { col: '#8a6a10', core: '#ffd23f', hot: '#ffd23f', dark: '#141004' },
  elder: { col: '#3a5a2a', core: '#8fd06a', hot: '#c8a060', dark: '#0e1408' },
  escorp: { col: '#6a4a1a', core: '#ffb040', hot: '#ffd27a', dark: '#140c04' },
  sphinx: { col: '#8a6a2a', core: '#ffd27a', hot: '#ffd27a', dark: '#14100a' },
  raiju: { col: '#3a3aa0', core: '#7a8aff', hot: '#b8a0ff', dark: '#0a0a1e', light: 0.5 }, // 暗い雲の床で明るい光芒は白く飛ぶので、照らす光は弱く
  raijin: { col: '#7a2a20', core: '#e8805a', hot: '#b8a0ff', dark: '#140806', light: 0.5 },
  trichroma: { col: '#5a5a8a', core: '#a8b0e8', hot: '#c8c0ff', dark: '#141420', light: 0.4 }, // 明るい床で光芒が白く飛ばないように、照らす光は弱く
  seraph: { col: '#8a7a4a', core: '#e8d088', hot: '#fff2b0', dark: '#1a1408', light: 0.4 },
};
// ノックバック: ang の向きへ dist を dur 秒かけて(一定の速さ)。回避の無敵中は押されない(押されている途中で回避すると止まる)。闘技場では壁で止まる
function pushPlayer(ang, dist, dur) {
  if (P.dead || P.invT > 0 || !(dist > 0)) return false;
  P.push = { vx: Math.cos(ang) * dist / dur, vy: Math.sin(ang) * dist / dur, t: dur };
  return true;
}
// 新しい仕組みの説明(そのランで初めて見たときに一度だけ)
function hint(key, main, sub) { if (S.hint[key] || !SET.hints) return; S.hint[key] = true; UI.announce(main, sub); } // 初見の説明(設定で OFF にできる)
// 動く予告の円: follow 秒のあいだ速さ spd で target(既定はプレイヤー)を追い、そのあと止まる(track は FX の更新で毎フレーム呼ばれる)
function chaseWarn(w, follow, spd, target = P) {
  w.track = q => {
    const dt = q.t - (q.tl || 0); q.tl = q.t;
    if (q.t >= follow) return;
    const d = Math.sqrt(d2(q.x, q.y, target.x, target.y)), k = Math.min(d, spd * dt);
    if (d > 0.01) { q.x += (target.x - q.x) / d * k; q.y += (target.y - q.y) / d * k; }
  };
  return w;
}

// ---------- ボスが出す壊せる物(肉塊・骨柱など) ----------
// 敵として扱い、攻撃が当たる。HP はボスの最大HP × pct(敵Lv・巨躯で一緒に上がる)。life 秒で崩れ、ボスが倒れると一緒に崩れる。経験値・撃破数はなし
function spawnObj(owner, kind, x, y, o) {
  const hp = owner.maxhp * o.pct;
  const e = {
    id: nextId++, type: 'obj_' + kind, obj: kind, owner, x, y, hp, maxhp: hp, spd: 0, dmg: 0, r: o.r, xp: 0, kbRes: 1, ai: 'obj',
    t: 0, seed: Math.random(), kx: 0, ky: 0, flash: 0, scale: 1, frost: 0, frostT: 0, burns: [], burnT: 0, burnTick: 0, stun: 0, slowT: 0, bleed: 0, bleedT: 0,
    life: o.life, rise: 0, spawnT: o.spawnT || 0,
  };
  enemies.push(e);
  return e;
}
function updObj(e, dt) {
  e.rise = Math.min(1, e.rise + dt * 5); // 地面からせり上がる
  if (e.owner.dead || (e.life -= dt) <= 0) { e.dead = true; objDown(e, false); return; }
  if (e.obj === 'meat') { // 腐肉の山: 腐臭の泡を吹き、3秒ごとにゾンビ 2体を生む
    if (Math.random() < dt * 7) part(e.x + rand(-6, 6), e.y - rand(0, 5), rand(-4, 4), -rand(6, 16), rand(0.6, 1), pick(['#7fae4e', '#4a6e30', '#b8d86a']), { drag: 1 });
    if ((e.spawnT -= dt) <= 0) {
      e.spawnT = 3; e.flash = 0.1; e.pulse = 0.25;
      for (let i = 0; i < 2; i++) { const z = spawnEnemy('zombie', { x: e.x + (i ? 9 : -9), y: e.y + rand(2, 8) }); z.noChest = true; burst(z.x, z.y, 8, ['#7fae4e', '#3a1a14', '#b8d86a'], { sp: 50, g: 160 }); }
      AudioMan.splat();
    }
    e.pulse = Math.max(0, (e.pulse || 0) - dt);
  } else if (e.obj === 'crystal' || e.obj === 'qmirror') { // 結晶・女王の鏡: 七色のきらめき
    if (Math.random() < dt * 6) part(e.x + rand(-5, 5), e.y - rand(4, 18), 0, -rand(4, 10), 0.6, pick(PRISM), { glow: true, drag: 1 });
  } else if (e.obj === 'tentacle') { // 触手(クラーケン): 2.5秒ごとにプレイヤーの方へ帯(長さ 90・幅 16)を予告して薙ぐ → ×0.8・スタミナ −15
    if (e.swT > 0) {
      e.swA += angDiff(Math.atan2(P.y - e.y, P.x - e.x), e.swA) * Math.min(1, dt * 1.5); // 予告の間、少しだけプレイヤーを追う
      e.ta = e.swA;
      if ((e.swT -= dt) <= 0) {
        if (hitLine(e.x, e.y, e.swA, 90, 16, e.owner.dmg * 0.8)) drainSta(15);
        bfx.push({ kind: 'tslap', x: e.x, y: e.y, a: e.swA, len: 90 * CHAOS.area, w: 12 * CHAOS.area, t: 0, life: 0.35 });
        burst(e.x + Math.cos(e.swA) * 60, e.y + Math.sin(e.swA) * 60, 10, SPLASH, { sp: 80, up: 30, g: 200 }); AudioMan.dash();
        e.sq = 0.5;
      }
    } else if ((e.spawnT -= dt) <= 0 && d2(e.x, e.y, P.x, P.y) < 120 * 120) {
      e.spawnT = 2.5; e.swT = 0.6; e.swA = Math.atan2(P.y - e.y, P.x - e.x);
      pushWarn({ kind: 'line', x: e.x, y: e.y, a: e.swA, len: 90, w: 16, t: 0, life: 0.6, ink: true, owner: e, track: w => { w.a = e.swA; } });
    }
    if (Math.random() < dt * 3) part(e.x + rand(-5, 5), e.y + rand(-1, 3), 0, -rand(6, 14), 0.6, '#bff4ff', { drag: 1 }); // 根元の泡
  } else if (e.obj === 'sandglass') { // 死神の砂時計: 落ちてきて立つ。砂が死神へ流れる
    if (e.dropT > 0 && (e.dropT -= dt) <= 0) { burst(e.x, e.y, 20, ['#e8c88a', '#c29bff', '#ffffff'], { sp: 80, g: 200 }); shake(4); AudioMan.thud(); }
    if (Math.random() < dt * 8) { const o = e.owner, pa = Math.atan2(o.y - e.y, o.x - e.x); part(e.x, e.y - 8, Math.cos(pa) * 70, Math.sin(pa) * 70, 0.9, pick(['#e8c88a', '#c29bff']), { glow: true, drag: 0 }); }
  } else if (e.obj === 'doom') { // 終刻の時計: 文字盤に残り秒。1秒ごとに時計の音
    if (Math.ceil(e.life) !== e.lastSec) { e.lastSec = Math.ceil(e.life); AudioMan.tick(12 - e.lastSec); if (e.lastSec <= 3) AudioMan.heartbeat(1); e.pulse = 0.25; }
    e.pulse = Math.max(0, (e.pulse || 0) - dt);
    if (Math.random() < dt * 10) part(e.x + rand(-8, 8), e.y - rand(4, 24), 0, -rand(6, 14), 0.6, pick(['#ff3b5c', '#c8a050']), { glow: true, drag: 1 });
  } else if (e.obj === 'pillar') { // 肋骨の魔弾(白骨竜)の骨柱: 2秒ごと(激昂 1.5秒)にプレイヤーへ骨の魔弾(撃つ 0.3秒前に光る。攻撃頻度のカオス強化が効く)
    e.spawnT -= dt * CHAOS.rate; e.glint = e.spawnT < 0.3;
    if (e.spawnT <= 0) {
      e.spawnT = e.owner.ai.enraged ? 1.5 : 2;
      eball(e.x, e.y - 10, Math.atan2(P.y - (e.y - 10), P.x - e.x), 75, e.owner.dmg * 0.4, 'bball'); // 骨柱と同じ青白い弾(竜の赤い弾と見分ける)
      burst(e.x, e.y - 10, 7, ['#efe9d4', '#6ee7ff', '#ffffff'], { sp: 45, glow: true, life: 0.25 }); AudioMan.shoot();
    }
    if (Math.random() < dt * 4) part(e.x + rand(-3, 3), e.y - rand(4, 14), 0, -rand(4, 10), 0.6, pick(['#6ee7ff', '#efe9d4']), { glow: true, drag: 1 }); // 骨の隙間から青い光
  } else if (e.obj === 'tomb') { // 氷柱の墓標(雪華の女王): 地面に刺さった大きな氷柱。冷気が立ちのぼる
    if (Math.random() < dt * 8) part(e.x + rand(-6, 6), e.y - rand(0, 22), rand(-4, 4), -rand(4, 12), 0.8, pick(SNOW), { glow: Math.random() < 0.5, drag: 1 });
  } else if (e.obj === 'biggear') { // 大歯車(番人): 転がって画面の縁(闘技場では壁)で 2回はね返る。触れると ×1.0・1秒 移動速度 ×0.6
    e.x += e.vx * dt; e.y += e.vy * dt; e.spin = (e.spin || 0) + Math.hypot(e.vx, e.vy) * dt / e.r;
    let hit = false;
    if (S.mode === 'arena') {
      const d = Math.hypot(e.x, e.y), m = DATA.arena.r - e.r;
      if (d > m && (e.x * e.vx + e.y * e.vy) > 0) { const nx = e.x / d, ny = e.y / d, dot = e.vx * nx + e.vy * ny; e.vx -= 2 * dot * nx; e.vy -= 2 * dot * ny; hit = true; }
    } else {
      if ((e.x - e.r < cam.x && e.vx < 0) || (e.x + e.r > cam.x + GFX.VW && e.vx > 0)) { e.vx = -e.vx; hit = true; }
      if ((e.y - e.r < cam.y && e.vy < 0) || (e.y + e.r > cam.y + GFX.VH && e.vy > 0)) { e.vy = -e.vy; hit = true; }
    }
    if (hit) {
      if (e.bounce-- <= 0) { e.dead = true; objDown(e, false); return; } // 3回目の縁で崩れる
      burst(e.x, e.y, 16, BRASS, { sp: 90, glow: true, life: 0.3 }); shake(4); AudioMan.thud();
    }
    if (d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2) && hurtPlayer(e.owner.dmg)) slowPlayer(0.6, 1);
    if (Math.random() < dt * 20) part(e.x + rand(-e.r, e.r) * 0.5, e.y + e.r * 0.8, -e.vx * 0.2 + rand(-15, 15), -rand(10, 30), 0.35, pick(['#ffd27a', '#c8a050', '#8a7a60']), { glow: Math.random() < 0.3, g: 160 }); // 火花と砂ぼこり
  } else if (e.obj === 'stake') { // 冥鎖の杭: 紫のルーンが脈打ち、黒いもやが立ちのぼる
    if (Math.random() < dt * 8) part(e.x + rand(-3, 3), e.y - rand(0, 16), rand(-4, 4), -rand(6, 16), 0.7, pick(SKC.slice(0, 4)), { glow: Math.random() < 0.3, drag: 1 });
  } else if (e.obj === 'cdog') updCerbDog(e, dt); // 冥犬の犬(分裂形態): 走る・技
  else if (e.obj === 'iceblock') { // 氷塊(霜の巨人): 冷気が立ちのぼる
    if (Math.random() < dt * 4) part(e.x + rand(-8, 8), e.y - rand(0, 12), rand(-3, 3), -rand(3, 8), 0.8, pick(SNOW), { drag: 1 });
  } else if (e.obj === 'wbee') { // 蜂の陣の働き蜂: 1秒で輪の位置へ集まり、2.5秒かけて輪が中心へ縮む。縮みきると散る。触れると ×0.6
    const g = e.ring, k = e.t, R = k < 1 ? g.R : g.R * Math.max(0.04, 1 - (k - 1) / 2.5), wob = Math.sin(e.t * 9 + e.ang * 5) * 2;
    const tx = g.cx + Math.cos(e.ang) * (R + wob), ty = g.cy + Math.sin(e.ang) * (R + wob);
    if (k < 1) { const u = easeOutCubic(k); e.x = lerp(e.sx, tx, u); e.y = lerp(e.sy, ty, u); } else { e.x = tx; e.y = ty; }
    e.face = Math.cos(e.ang) > 0 ? -1 : 1; // 中心の方を向く
    if (k >= 3.5) { e.dead = true; objDown(e, false); return; }
    if (k > 0.8 && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2)) hurtPlayer(e.owner.dmg * 0.6);
  } else if (e.obj === 'beeball') { // 蜂球(女王蜂): プレイヤーを追う(速さ 30)。触れると 0.5秒ごとに ×0.8
    const pa = Math.atan2(P.y - e.y, P.x - e.x);
    e.x += Math.cos(pa) * 30 * dt; e.y += Math.sin(pa) * 30 * dt; e.face = Math.cos(pa) < 0 ? -1 : 1;
    if ((e.tick -= dt) <= 0 && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2)) { e.tick = 0.5; hurtPlayer(e.owner.dmg * 0.8); }
    if (Math.random() < dt * 14) part(e.x + rand(-9, 9), e.y + rand(-9, 9), rand(-20, 20), rand(-20, 20), 0.3, pick(HONEY), { drag: 2 }); // まわりを飛ぶ蜂
  } else if (e.obj === 'sprout') { // 若芽(古樹の主): 葉がふるえる。育つ前の 2秒は光る
    if (e.life < 2 && Math.random() < dt * 10) part(e.x + rand(-4, 4), e.y - rand(2, 8), 0, -rand(8, 16), 0.5, pick(['#d8ff9a', '#8fd06a']), { glow: true, drag: 1 });
  } else if (e.obj === 'scrystal') { // クリスタルサテライト(熾天使): 熾天使のまわり(半径 100)を回り、1.5秒ごとにプレイヤーへ光弾 ×0.4(撃つ 0.3秒前に光る)
    const o = e.owner; e.orbA += dt * 0.8;
    e.x = o.x + Math.cos(e.orbA) * 100; e.y = o.y + Math.sin(e.orbA) * 100;
    e.spawnT -= dt * CHAOS.rate; e.glint = e.spawnT < 0.3;
    if (e.spawnT <= 0 && !(o.ai.lr && o.ai.lr.still) && !(o.ai.wo && o.ai.wo.t >= 4.6)) { // 立ち尽くした・ホワイトアウトの爆発の間は撃たない
      e.spawnT = 1.5;
      Object.assign(serBall(o, e.x, e.y - 10, Math.atan2(P.y - (e.y - 10), P.x - e.x), 110, 0.4, 'sbolt'), { r: 3 * CHAOS.area });
      burst(e.x, e.y - 10, 8, ['#bff4ff', '#ffffff', '#ffe8a0'], { sp: 50, glow: true, life: 0.25 }); AudioMan.shoot();
    }
    if (Math.random() < dt * 6) part(e.x + rand(-3, 3), e.y - rand(4, 16), 0, -rand(4, 10), 0.6, pick(['#bff4ff', '#ffffff']), { glow: true, drag: 1 });
  } else if (e.obj === 'tcrystal') { // 巨大クリスタル(トリニティサンクチュアリ): 天から降りて立つ。光の粒が熾天使へ流れる(10秒で熾天使を回復)
    if (e.dropT > 0) e.dropT -= dt;
    else if (Math.random() < dt * 10) { const o = e.owner, pa = Math.atan2(o.y - o.jz - (e.y - 16), o.x - e.x); part(e.x + rand(-3, 3), e.y - 16, Math.cos(pa) * 110, Math.sin(pa) * 110, 0.9, pick(['#bff4ff', '#ffe8a0', '#ffffff']), { glow: true, drag: 0 }); }
    e.pulse = Math.max(0, (e.pulse || 0) - dt);
  } else if (e.obj === 'altar') { // 炎の祭壇: 炎が燃えさかり、火の粉がイフリートへ流れる
    if (Math.random() < dt * 16) part(e.x + rand(-3, 3), e.y - 10 + rand(-2, 2), rand(-6, 6), -rand(20, 40), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#fff0b0']), { glow: true, drag: 1 });
    if (Math.random() < dt * 6) { const o = e.owner, pa = Math.atan2(o.y - e.y, o.x - e.x); part(e.x, e.y - 10, Math.cos(pa) * 90, Math.sin(pa) * 90, 0.8, '#ffc34a', { glow: true, drag: 0 }); }
  }
}
// 壊れた(broken: 攻撃で壊した / false: 時間切れ・ボスの撃破で崩れた)
function objDown(e, broken) {
  const k = broken ? 1 : 0.5;
  if (e.obj === 'meat') {
    burst(e.x, e.y, Math.round(36 * k), ['#7fae4e', '#4a6e30', '#3a1a14', '#c2483a'], { sp: 110 * k, g: 220, life: 0.7 });
    if (broken) { addFlash(e.x, e.y, 70, '#b8d86a', 0.5); shake(4); AudioMan.splat(); AudioMan.kill(); }
  } else if (e.obj === 'pillar') {
    burst(e.x, e.y - 6, Math.round(30 * k), ['#efe9d4', '#d8d0b8', '#8a8676', '#6ee7ff'], { sp: 100 * k, g: 240, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 60, '#6ee7ff', 0.4); shake(3); AudioMan.thud(); }
  } else if (e.obj === 'scrystal') { // クリスタルサテライト: 砕けて光のかけら
    burst(e.x, e.y - 8, Math.round(26 * k), ['#bff4ff', '#ffffff', '#ffe8a0', '#7ad7ff'], { sp: 110 * k, g: 160, glow: true, life: 0.5 });
    if (broken) { addFlash(e.x, e.y, 60, '#9fd8ff', 0.4); shake(3); AudioMan.chime(); AudioMan.crush(); }
  } else if (e.obj === 'tcrystal') { // 巨大クリスタル: 壊すと砕けて、壊れた姿がその場に残る(ホワイトアウトの影になる)
    burst(e.x, e.y - 14, Math.round(60 * k), ['#bff4ff', '#ffffff', '#ffe8a0', '#7ad7ff'], { sp: 150 * k, g: 180, glow: true, life: 0.7 });
    if (broken && !e.owner.dead) {
      const ai = e.owner.ai; (ai.husks = ai.husks || []).push({ x: e.x, y: e.y, r: 15 });
      addFlash(e.x, e.y, 90, '#9fd8ff', 0.5); shockAt(e.x, e.y, 1.2, 0.8); shake(6); hitstop(0.05); AudioMan.crush(); AudioMan.chime();
      hint('ser_husk', _t('壊れたクリスタル'), _t('壊れたクリスタルは残り、ホワイトアウトのときに影(安全な所)を作る'));
    }
  } else if (e.obj === 'altar') {
    burst(e.x, e.y - 6, Math.round(36 * k), ['#3a2a2a', '#6a5050', '#ff6a2a', '#ffc34a'], { sp: 110 * k, g: 200, life: 0.7 });
    if (broken) { addFlash(e.x, e.y, 80, '#ff8a3d', 0.6); shake(5); AudioMan.boom(); UI.announce(_t('祭壇の火が消えた'), ''); }
  } else if (e.obj === 'crystal' || e.obj === 'qmirror') { // 結晶・女王の鏡: 七色のかけらになって砕ける
    burst(e.x, e.y - 8, Math.round(40 * k), [...PRISM, '#ffffff'], { sp: 130 * k, g: 180, glow: true, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 70, '#d88aff', 0.5); shake(3); AudioMan.chime(); AudioMan.thud(); }
  } else if (e.obj === 'tentacle') { // 触手: ちぎれて海に沈む
    burst(e.x, e.y - 8, Math.round(30 * k), ['#a8486a', '#d86a8a', '#5a2a4a', '#bff4ff'], { sp: 100 * k, g: 220, life: 0.6 });
    burst(e.x, e.y, Math.round(14 * k), SPLASH, { sp: 70 * k, up: 40, g: 200 });
    if (broken) { addFlash(e.x, e.y, 60, '#7ad7ff', 0.4); shake(3); AudioMan.splat(); AudioMan.splash(); }
  } else if (e.obj === 'sandglass') { // 砂時計: 割れると死神が 1.5秒ひるむ
    burst(e.x, e.y - 8, Math.round(36 * k), ['#e8c88a', '#c29bff', '#d8c8ff', '#ffffff'], { sp: 120 * k, g: 200, glow: true, life: 0.6 });
    if (broken && !e.owner.dead) { e.owner.stun = 1.5; addFlash(e.x, e.y, 70, '#c29bff', 0.5); shake(5); AudioMan.chime(); AudioMan.thud(); UI.announce(_t('砂時計が割れた!'), _t('死神がひるんでいる')); }
  } else if (e.obj === 'doom') { // 終刻の時計: 壊すと死神が 3秒ひるむ。壊せないまま時間が来ると、時が巻き戻る
    burst(e.x, e.y - 10, Math.round(60 * k), ['#ff3b5c', '#c8a050', '#e8e0d0', '#1a0a14'], { sp: 160 * k, g: 200, glow: true, life: 0.8 });
    if (broken && !e.owner.dead) { e.owner.stun = 3; addFlash(e.x, e.y, 120, '#ff3b5c', 0.7); hitstop(0.1); shake(12); shockAt(e.x, e.y, 2.4, 0.7); AudioMan.crush(); AudioMan.knell(); UI.announce(_t('終刻の時計が砕けた!'), _t('死神が 3秒ひるむ')); }
    else if (!broken && e.life <= 0) finaleRewind(e.owner);
  } else if (e.obj === 'tomb') { // 氷柱の墓標: 砕けると滑る床も一緒に消える
    burst(e.x, e.y - 12, Math.round(50 * k), [...SNOW, '#ffffff', '#7ab8e8'], { sp: 140 * k, g: 180, glow: true, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 90, '#bff4ff', 0.5); shake(5); AudioMan.chime(); AudioMan.thud(); UI.announce(_t('氷柱が砕けた'), _t('滑る床が消える')); }
  } else if (e.obj === 'biggear') { // 大歯車: 歯と真鍮のかけらが飛び散る
    burst(e.x, e.y, Math.round(50 * k), [...BRASS, '#5a5a6a'], { sp: 150 * k, g: 220, life: 0.7 });
    if (broken) { addFlash(e.x, e.y, 90, '#ffd27a', 0.5); shake(6); AudioMan.crush(); }
  } else if (e.obj === 'tpillar') { // 雷柱(雷神の雷の檻): 緑青の銅のかけらと紫の火花。壊すと、その柱から出る線が消える
    burst(e.x, e.y - 6, Math.round(30 * k), ['#3a7a64', '#6ab89a', '#a8603a', '#b8a0ff'], { sp: 100 * k, g: 220, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 50, '#7a5ad8', 0.35); shake(3); AudioMan.zap(); AudioMan.thud(); }
  } else if (e.obj === 'iceblock') { // 氷塊: 砕けて氷のかけら
    burst(e.x, e.y - 6, Math.round(30 * k), ['#bff4ff', '#7ad7ff', '#ffffff', '#5a8ab8'], { sp: 110 * k, g: 220, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 60, '#9fd8ff', 0.4); shake(3); AudioMan.frost(); AudioMan.thud(); }
  } else if (e.obj === 'stake') { // 冥鎖の杭: 砕けると鎖が切れ、闇の霧が 20秒 遅れる(霧が出たあとなら 20秒 晴れる)
    burst(e.x, e.y - 8, Math.round(50 * k), ['#5a5a6a', '#9a9aaa', ...SKC], { sp: 150 * k, g: 220, glow: true, life: 0.7 });
    if (P.chain && P.chain.stake === e) P.chain = null;
    if (broken) {
      const ph = S.phase;
      if (ph) { if (ph.fogOn) ph.fogPause = (ph.fogPause || 0) + 20; else { ph.t -= 20; if (ph.t < DATA.flow.fog.start - 10) ph.fogWarn = false; } }
      addFlash(e.x, e.y, 110, '#a66bff', 0.6); shake(8); hitstop(0.06); AudioMan.crush(); AudioMan.chain();
      UI.announce(_t('鎖が切れた!'), ph && ph.fogPause > 0 ? _t('闇の霧が 20秒 晴れる') : _t('闇の霧が 20秒 遅れる'));
    }
    return;
  } else if (e.obj === 'cdog') { // 冥犬の犬: 首の色の光と黒い血。倒した犬の首は合体しても戻らない(3匹とも倒すと倒れ込む)
    const o = e.owner, C = CERB[e.hk], y = e.y - 6;
    burst(e.x, y, Math.round(46 * k), [C[0], C[1], '#1a0a14', '#ffffff'], { sp: 150 * k, g: 220, glow: true, life: 0.7 });
    if (broken && !o.dead) {
      const h = o.ai.hs[e.slot]; h.dead = true; h.hp = 0;
      addFlash(e.x, y, 90, C[0], 0.5); shake(7); hitstop(0.05); AudioMan.crush(); AudioMan.bite();
      bossBlast(e.x, y, 26, { col: C[1], core: C[0], decal: false, n: 14, light: 0.6 });
      for (let i = 0; i < 14; i++) part(e.x + rand(-3, 3), y + rand(-3, 3), rand(-60, 60), -rand(40, 110), rand(0.5, 0.9), pick(['#1a0a14', '#5a1020', C[1]]), { g: 300, drag: 0.5, sz: pick([1, 2]) }); // 黒い血
      if (o.ai.hs.every(q => q.dead)) cerbDownStart(o, o.ai, e.x, e.y); // 3匹とも倒した
      else hint('dogdown', _t('首を落とした'), _t('倒した犬の首は、合体しても戻らない(次の分裂で生え直す)'));
    }
    return;
  } else if (e.obj === 'wbee') { // 働き蜂: 落ちる / 散る(金の輪は出さない)
    burst(e.x, e.y, broken ? 6 : 3, HONEY, { sp: broken ? 50 : 30, life: 0.3 });
    return;
  } else if (e.obj === 'beeball') { // 蜂球: 壊すと蜂が散る
    burst(e.x, e.y, Math.round(40 * k), [...HONEY, '#2a2010'], { sp: 130 * k, life: 0.55, drag: 1 });
    if (broken) { addFlash(e.x, e.y, 60, '#8a6a10', 0.4); shake(3); AudioMan.puff(); }
  } else if (e.obj === 'sprout') { // 若芽: 壊すと葉が散る。壊せないまま育つと茨の木(15秒 通れない。近づくと枝で叩く)
    burst(e.x, e.y - 4, Math.round(16 * k), ['#8fd06a', '#5a9a48', '#5a3a1a'], { sp: 70 * k, g: 160, life: 0.5 });
    if (broken) AudioMan.slash();
    else if (!e.owner.dead && e.life <= 0) {
      addHazard('thorn', e.x, e.y, { r: 10, dur: 15, owner2: e.owner, dmg: e.owner.dmg, lashT: 1, rise: 0 });
      burst(e.x, e.y - 8, 26, ['#3a6a34', '#5a9a48', '#5a3a1a', '#c8e890'], { sp: 90, up: 40, g: 160, life: 0.6 }); shake(2); AudioMan.thud();
      hint('elder_thorn', _t('茨の木'), _t('茨の木は通れない。近づくと枝で叩かれる'));
    }
    return;
  } else if (e.obj === 'clone') { // 鏡の分身: 鏡のように割れて消える
    burst(e.x, e.y - 6, 26, ['#ffffff', '#d8e8ff', '#ffd0f0', '#9ff7ff'], { sp: 110, glow: true, life: 0.45 });
    addRing(e.x, e.y, 14, '#ffffff', { life: 0.25 }); AudioMan.chime();
    return;
  }
  if (broken) addRing(e.x, e.y, e.r + 10, '#ffe14a', { life: 0.3 });
}

// ボスごとの技の初回(出現から最初に使うまでの秒)/ 激昂したときに始め直す技の時計
const BOSS_AI0 = {
  king: { atk: 3, mound: 5, roar: 6, hands: 4, bite: 0 },
  wyrm: { shield: 9, aim: 2, tail: 4, spear: 3, sum: 7 },
  cdragon: { raidCd: 12, gustCd: 5 },
  ifrit: { wall: 8, whip: 3, chain: 4, blast: 6, lunge: 2 },
  stag: { rush: 3, spike: 4, shard: 2, sweep: 0, side: 1 },
  kraken: { forest: 6, slam: 3, ink: 7, grab: 5, tide: 10, water: 4 },
  levia: { current: 10, wave: 8, dive: 5, pillar: 7, tail: 0, side: 1 },
  fgiant: { hammer: 3, blizz: 9, aval: 7, ball: 5 },
  squeen: { flake: 2, ring: 6, tomb: 8, veil: 14, dance: 4, side: 1 },
  warden: { spring: 12, handCd: 6, cog: 3, bell: 8, big: 5, floor: 9 },
  reaper: { tp: 5, mark: 8, throw: 3, reap: 2, clock: 7, glass: 12 },
  fhour: { scy: 1.5, rev: 8, stop: 10, marks: 5, sec: 3, busy: 0.6 },
  pqueen: { tp: 3, beam: 3, mirror: 8, scatter: 6, orb: 4, blink: 6 },
  cerberus: { howl: 8, rush: 3, breath: 6, orb: 9, gap: 0 },
  shadowking: { sword: 4, rings: 8, blades: 10, chase: 6, sever: 15, gap: 0 },
  qbee: { sting: 2, ring: 8, dive: 4, call: 7, side: 1 },
  elder: { sprout: 6, roots: 3, sweep: 0, fruit: 5, leaves: 8 },
  escorp: { vortex: 8, grab: 3, stab: 5, sand: 2, burrow: 10 },
  sphinx: { rid: 6, eyes: 3, fea: 2, paw: 0, haze: 9, side: 1 },
  raiju: { dash: 4, blink: 8, dis: 6, orb: 5, side: 1 },
  raijin: { ring: 4, cage: 9, net: 2, pair: 7, gale: 12, side: 1, busy: 0 },
  trichroma: { lampCd: 3, conv: 9, pill: 6, split: 2, side: 1, busy: 0 },
  seraph: { cRay: 1.5, cHoly: 4, cVort: 3, cBar: 5, cRift: 10, cRonde: 8, cSat: 6, cShift: 8, cTrin: 99, side: 1, busy: 0 },
};
const BOSS_ENRAGE = { king: { slam: 6 }, ifrit: { altar: true }, stag: { herd: 4 }, pqueen: { spiral: 3 }, levia: { breath: 4 }, fgiant: { drift: 5 }, squeen: { lance: 3 }, warden: { ringCd: 6 }, reaper: { sum: 7 }, fhour: { cross: 4, echo: 0 }, cerberus: { rain: 5 }, shadowking: { chainCd: 1 }, qbee: { ball: 4 }, elder: { cage: 5 }, escorp: { pinch: 4 }, sphinx: { storm: 4 }, raiju: { form: 3 }, raijin: { god: 5 }, trichroma: { ballCd: 4 }, seraph: { cTrin: 1 } };

function bossAI(e, dt) {
  const ai = e.ai, a = Math.atan2(P.y - e.y, P.x - e.x), dist = Math.sqrt(d2(e.x, e.y, P.x, P.y));
  const slow = (1 - 0.03 * e.frost) * clsEnemySlow(e); // 凍傷 / 時の歪み(移動。攻撃の速さは clsBossRate)
  e.face = P.x < e.x ? -1 : 1;
  if (!ai.enraged && e.hp < e.maxhp * e.enrage) {
    ai.enraged = true; e.spd *= 1.35;
    Object.assign(ai, BOSS_ENRAGE[e.boss] || {});
    UI.enrage(I18N.bossShort(e.name)); AudioMan.roar(); shake(8); screenFlash(0.25, '#ff3b5c');
    if (e.boss === 'shadowking' && !e.shadow) AudioMan.playMusic('b_tomb2'); // 影の王: 激昂で曲がボス2 に変わる
    bossBlast(e.x, e.y + e.r * 0.5, e.r * 2.6, { n: 18, life: 0.45, cracks: 10 }); addRing(e.x, e.y, e.r * 3, '#ff3b5c', { r0: e.r, w: 3, life: 0.45 }); // 赤い光芒と、足元の地面が割れる
  }
  runLater(ai, dt);
  if (e.shadow && Math.random() < dt * 16) part(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r * 0.5), rand(-6, 6), -rand(10, 26), rand(0.5, 0.9), pick(['#0a0612', '#1a0a2a', '#3a1a5a', '#7a3ab0']), { drag: 1, sz: pick([1, 2]) }); // 影: 体から黒紫のもやが立ちのぼる
  if (ai.echoes) updEchoes(ai, dt); // クロノ・エコー(終刻の死神)の灰色の分身: 本体の構えの間も動かす
  e.sq = lerp(e.sq, 1, Math.min(1, dt * 6));
  if (ai.wind > 0) {
    ai.wind -= dt;
    e.flash = Math.sin(ai.wind * 40) > 0 ? 0.05 : 0;
    if (ai.chg) { const pa = rand(0, TAU), pr = rand(24, 40); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(['#ff4a8a', '#ffd0f0', '#ffffff']), { glow: true, drag: 0 }); }
    else if (Math.random() < dt * 22) { const pa = rand(0, TAU), pr = e.r * rand(1.8, 2.6); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr * 0.6, -Math.cos(pa) * pr * 2.5, -Math.sin(pa) * pr * 1.5, 0.35, pick(['#ff3b5c', '#a0122a', '#5a0a14']), { glow: Math.random() < 0.4, drag: 0 }); } // 構え: 赤い気が体へ集まる
    if (!ai.glint && ai.wind <= 0.15) { ai.glint = true; fxGlint(e.x, e.y - e.r - 10 - (e.jz || 0), 9, '#ff3b5c', { foe: true, life: 0.22 }); AudioMan.cue(); } // 技の直前: 頭上に赤いきらめき(避ける合図)
    if (ai.wind <= 0) { ai.chg = false; ai.fire(); }
    return;
  }
  switch (e.boss) {
    case 'king': kingAI(e, ai, dt, a, dist, slow); break;

    case 'wyrm': wyrmAI(e, ai, dt, a, dist, slow); break;

    case 'reaper': reaperAI(e, ai, dt, a, dist, slow); break;
    case 'fhour': fhourAI(e, ai, dt, a, dist, slow); break;

    case 'gslime': gslimeAI(e, ai, dt, a, dist, slow); break;
    case 'golem': golemAI(e, ai, dt, a, dist, slow); break;
    case 'cdragon': dragonAI(e, ai, dt, a, dist, slow); break;
    case 'ifrit': ifritAI(e, ai, dt, a, dist, slow); break;
    case 'stag': stagAI(e, ai, dt, a, dist, slow); break;
    case 'pqueen': pqueenAI(e, ai, dt, a, dist, slow); break;
    case 'kraken': krakenAI(e, ai, dt, a, dist, slow); break;
    case 'levia': leviaAI(e, ai, dt, a, dist, slow); break;
    case 'fgiant': fgiantAI(e, ai, dt, a, dist, slow); break;
    case 'squeen': squeenAI(e, ai, dt, a, dist, slow); break;
    case 'warden': wardenAI(e, ai, dt, a, dist, slow); break;
    case 'cerberus': cerberusAI(e, ai, dt, a, dist, slow); break;
    case 'shadowking': shadowKingAI(e, ai, dt, a, dist, slow); break;
    case 'qbee': qbeeAI(e, ai, dt, a, dist, slow); break;
    case 'elder': elderAI(e, ai, dt, a, dist, slow); break;
    case 'escorp': escorpAI(e, ai, dt, a, dist, slow); break;
    case 'sphinx': sphinxAI(e, ai, dt, a, dist, slow); break;
    case 'raiju': raijuAI(e, ai, dt, a, dist, slow); break;
    case 'raijin': raijinAI(e, ai, dt, a, dist, slow); break;
    case 'trichroma': trichromaAI(e, ai, dt, a, dist, slow); break;
    case 'seraph': seraphAI(e, ai, dt, a, dist, slow); break;
  }
}
