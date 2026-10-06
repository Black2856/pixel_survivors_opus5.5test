// world.js — プレイヤー / ステータス / 武器 / ダメージ / 敵・ボス / ドロップ / スポナー / 報酬ロジック
'use strict';

const ECOL = {
  zombie: ['#7fb069', '#6b5a8e'], bat: ['#8a4fc0', '#2a1838'], slime: ['#4fd6a8', '#d8fff2'], slimelet: ['#4fd6a8', '#d8fff2'],
  skeleton: ['#e8e6da', '#6b6a60'], archer: ['#e8e6da', '#35523d'], ghost: ['#dcefff', '#8ab8ff'], brute: ['#c46a4a', '#6b4a2a'],
  imp: ['#ff6a3d', '#8a2a4a'], goblin: ['#8fd06a', '#ffcc33'], brazier: ['#ff6a2a', '#ffc34a'],
  sandmage: ['#e8c88a', '#8a5a2a'], spear: ['#c8b89a', '#7a3a2a'], hound: ['#ff6a2a', '#3a1a1a'], onibi: ['#7ad7ff', '#ffffff'], lslime: ['#ff6a2a', '#5a1a14'],
  jslime: ['#9ff7ff', '#ff8ad8'], beetle: ['#5a4a8a', '#9ff7ff'], fairy: ['#ffd0f0', '#9ff7ff'],
  jelly: ['#ffb0e0', '#bff4ff'], sahagin: ['#3a9a8a', '#bff4ff'], puffer: ['#e8c86a', '#8a6a3a'], angler: ['#2a4a5a', '#fff6a0'],
  wolf: ['#d8e4f4', '#6a7a9a'], icesprite: ['#9ff7ff', '#ffffff'], yeti: ['#f0f4ff', '#7a8aa8'],
  gear: ['#c8a050', '#5a4a30'], clockman: ['#c8a050', '#e8e0c8'], hglass: ['#e8c88a', '#9ff7ff'],
};
const xpFor = l => Math.floor(4 + l * 2.6 + Math.pow(l, 1.72));

// ============================================================
// ラン初期化 / ステータス
// ============================================================
// ---------- カオス強化の効果(ラン開始時に S.chaos から計算) ----------
// area: 敵の攻撃範囲の倍率 / rate: 敵の攻撃頻度の倍率 / debuff: デバフの時間の倍率 / bossLv・startLv: 敵Lv(Lv × per)
// bossHp: ボスの HP の倍率 / escort: ボスと一緒に入場するエリートの数(闘技場)
let CHAOS = { area: 1, rate: 1, debuff: 1, lvSpeed: 1, spawn: 1, loot: 0, bossLv: 0, rage: false, twin: false, bossHp: 1, escort: 0 };
// key: モード・ステージのキー(闘技場は闘技場の項目だけを見る)
function setupChaos(lv, key) {
  const mods = chaosMods(key), M = k => mods.find(m => m.k === k);
  const L = k => (M(k) ? chaosLv(lv, M(k)) : 0), per = k => (M(k) ? M(k).per / 100 : 0), n = k => (M(k) ? L(k) * M(k).per : 0);
  CHAOS = {
    area: 1 + L('area') * per('area'), rate: 1 + L('rate') * per('rate'), debuff: 1 + L('debuff') * per('debuff'),
    lvSpeed: 1 + L('lvSpeed') * per('lvSpeed'), spawn: 1 + L('spawn') * per('spawn'), loot: L('loot') * per('loot'),
    bossLv: n('bossLv'), startLv: n('startLv'), rage: !!L('rage'), twin: !!L('twin'),
    bossHp: 1 + L('bossHp') * per('bossHp'), escort: n('escort'),
  };
}
// 敵の攻撃の予告(攻撃範囲の倍率で広げる。当たり判定の hitCircle / hitLine と揃える)
// fixed: 移動の経路・出現位置の予告(突進・飛びつき・瞬間移動)。攻撃範囲ではないので広げない
function pushWarn(w) {
  if (!w.fixed) {
    if (w.r) w.r *= CHAOS.area;
    if (w.w) w.w *= CHAOS.area;
    if (w.len) w.len *= CHAOS.area;
  }
  warns.push(w);
}

// 通常モード(ステージを1つ選ぶ)の出現スケジュール。t はフェーズの時計(ボス・エリート群の間は止まる)
// 3分 → エリート群 → 3分 → ボス1 → 3分 → ボス2(倒すとクリア)。同じ t ではフェーズの開始を波の切り替えより先に処理する
const stageRun = n => DATA.stageRuns.find(r => r.no === n); // ステージのキーの番号(stage1〜7)から
// 出現の候補には「敵のまとまり」(配列)が入ることがある(時計塔の「今までの敵」)。まとまりは 1枠として選ばれ、その中から1種
// spawnW: 選ばれやすさ(既定 1)/ group: 6体の小集団(noGroup の敵は出ない)/ maxAlive: 同時にいられる数(超えるなら選ばない)。選べないときは null
function pickType(types, group) {
  const ok = t => { const d = DATA.enemies[t]; return !(group && d.noGroup) && !(d.maxAlive && enemies.filter(e => !e.dead && e.type === t).length >= d.maxAlive); };
  const slots = [];
  for (const t of types) {
    if (Array.isArray(t)) { const m = t.filter(ok); if (m.length) slots.push({ w: 1, ts: m }); }
    else if (ok(t)) slots.push({ w: DATA.enemies[t].spawnW ?? 1, ts: [t] });
  }
  if (!slots.length) return null;
  let r = Math.random() * slots.reduce((a, s) => a + s.w, 0);
  for (const s of slots) if ((r -= s.w) <= 0) return pick(s.ts);
  return pick(slots[slots.length - 1].ts);
}
const flatTypes = types => [...new Set(types.flat())];
function stageSchedule(n) {
  const R = stageRun(n), F = DATA.flow, L = F.seg;
  const seen = new Set(), uniq = a => a.filter(t => !seen.has(String(t)) && seen.add(String(t))); // まとまりは中身が同じなら同じもの
  const s1 = R.segs[0], s2 = R.segs[1] || s1, s3 = R.segs[2] || uniq([...s1, ...s2]);
  const out = F.waves[0].map((w, i) => ({ t: w.t, types: s1.slice(0, i + 1), interval: w.interval, max: w.max }));
  out.push({ t: L, elites: F.elites });
  for (const w of F.waves[1]) out.push({ t: L + w.t, types: s2, interval: w.interval, max: w.max });
  out.push({ t: L + F.horde, event: 'horde' });
  out.push({ t: L * 2, boss: [R.bosses[0]] });
  for (const w of F.waves[2]) out.push({ t: L * 2 + w.t, types: s3, interval: w.interval, max: w.max });
  out.push({ t: L * 2 + F.horde, event: 'horde' });
  out.push({ t: L * 3, boss: [R.bosses[1]], final: true });
  return out;
}
// エスカレーション: tier 1 → 4 を通す。tier ごとに同じ tier のステージからランダムに1つ選び、3分(通常モードの最初の3分と同じ出方)→ ボス → 次の tier
//   ボスはそのステージのボス2体からランダム。tier 4(時計塔)は死神(→ 終刻の死神)で、倒すとクリア。敵Lv は通して上がり続ける(ボスの間は止まる)
function escSchedule(R, tier) {
  const F = DATA.flow, s1 = R.segs[0];
  const out = F.waves[0].map((w, i) => ({ t: w.t, types: s1.slice(0, i + 1), interval: w.interval, max: w.max }));
  out.push(tier >= 4 ? { t: F.seg, boss: ['reaper'], final: true } : { t: F.seg, boss: R.bosses });
  return out;
}
function escStage(tier, first) {
  const R = pick(DATA.stageRuns.filter(r => r.tier === tier));
  S.tier = tier; S.escRun = R.no; setStage(R.stage);
  S.ptime = 0; S.schedIdx = 0; S.sched = escSchedule(R, tier);
  if (first) return;
  AudioMan.playMusic(DATA.stages[R.stage - 1].music);
  UI.banner('TIER ' + tier, DATA.stages[R.stage - 1].label, 2200);
  screenFlash(0.4); shockAt(P.x, P.y, 1.5, 0.8);
}
function initRun(mode = 'escalation', stageNo = 1) {
  S = {
    mode, arena: null, time: 0, kills: 0, totalDmg: 0, dmgBy: {}, stage: 1, loop: 1,
    combo: 0, comboT: 0, bestCombo: 0, gemStreak: 0, gemStreakT: 0,
    freeze: 0, ts: 1, tsBack: 0, schedIdx: 0, spawnT: 0, spawnCfg: null,
    eatk: 1, // 敵の攻撃力の倍率(敵ごとの処理の間だけ。ビッグクランチのブラックホールの中で下がる)
    eliteT: 95, goblinT: 70, propT: 2, elv: 1, elvT: 0, boss: null, pendingLv: 0, lvFx: 0,
    ptime: 0, phase: null, tier: 0, // ptime: フェーズの時計(通常モード) / phase: ボス・エリート群のフェーズ { kind, t } / tier: ステージの tier(通常モード)
    rerolls: 0, weaponSlots: 4, lvQueue: [],
    gold: 0, deathT: 0, victoryT: 0, hudDirty: true, won: false, hint: {}, decoy: null, bossKills: 0, loot: [],
  };
  P = {
    cls: META.cls, mainW: META.classes[META.cls].weapon, micro: {}, lvFx: classLvFx(META.cls), wm: {}, x: 0, y: 0, hp: 0, maxhp: 100, level: 1, xp: 0, xpNext: xpFor(1), weapons: {},
    ifr: 0, facing: 1, animT: 0, moving: false, hurtT: 0, dead: false,
    slowT: 0, cdSlowT: 0, burnT: 0, burnDmg: 0, burnTick: 0, shield: 0, oShield: 0, oChunks: [],
    frost: 0, frostT: 0, bleed: 0, bleedT: 0, bleedTick: 0, // 自分の凍傷・出血(スタック数と、消えるまでの秒)
    push: null, rootT: 0, current: null, // ボスの押し出し・引き寄せ / 絡め取りで動けない(秒)/ 海流
    frzT: 0, iceT: 0, ivx: 0, ivy: 0, // 凍結(氷の槍。歩けない秒)/ 滑る床の上(秒)と、そのときの速度
    fatigueT: 0, // 疲労(スタミナを減らす攻撃を受けた): スタミナ回復 -50% の残り秒
  };
  enemies = []; projs = []; eprojs = []; gems = []; drops = []; props = []; hazards = [];
  parts = []; floats = []; rings = []; zones = []; slashes = []; bolts = []; warns = []; flashes = []; bfx = [];
  eqInitRun();
  const st = recalc();
  P.hp = P.maxhp;
  addWeapon(P.mainW); // 1枠目はクラスのメイン武器(固定)
  S.rerolls = st.v.reroll; S.weaponSlots = st.v.wslot;
  clsInit();
  S.stageNo = stageNo; S.sched = mode === 'stage' ? stageSchedule(stageNo) : []; // エスカレーションは下の escStage で、闘技場は使わない
  if (mode === 'arena') { S.stage = 4; S.elv = DATA.arena.elv[0]; S.arena = { idx: 0, restT: 3, warned: false }; } // 開始時の敵Lv(深い闇)は下で足す。ラウンドの敵Lv は arenaLv
  if (mode === 'stage') { const R = stageRun(stageNo); S.stage = R.stage; S.tier = R.tier; } // 開始の敵Lv は 1 + 深い闇(tier のカオス強化)
  if (mode === 'escalation') escStage(1, true); // エスカレーション: tier 1 のステージから
  // カオス強化: クリアするまでは tier の値で固定(エスカレーション・闘技場は無し)。クリア後は META.chaos[キー]
  const ck = mode === 'stage' ? 'stage' + stageNo : mode;
  S.chaos = Object.assign({}, chaosSetting(ck));
  S.chaosPt = chaosPoints(S.chaos, ck); S.chaosReward = chaosReward(S.chaosPt);
  setupChaos(S.chaos, ck);
  S.elv += CHAOS.startLv;
  recalc(); // 報酬をステータスへ
}
// 現在地から n レベル上がるのに必要な経験値(倍率適用前)
function xpForLevels(n) {
  let v = P.xpNext - P.xp;
  for (let l = P.level + 1; l < P.level + n; l++) v += xpFor(l);
  return v;
}

// ステータスの再計算(stats.js)
function recalc() {
  const st = applyStats();
  S.hudDirty = true;
  return st;
}
// 攻撃力倍率 = ステータス + クラスの一時的な強化(剣気満タン・残心など)
// 与えるダメージ(バーサーカーの怒り・狂乱)は攻撃力とは別の倍率として掛ける。継続ダメージの割り戻し(/ dmgMul())でも一緒に戻る
function dmgMul() {
  return (1 + P.atk + clsAtkBonus() + (P.uq.berserk ? 1 - P.hp / P.maxhp : 0)) * P.atkMul * clsDmgDealt();
}
const critRate = () => P.crit;
// 武器の現在のステータス。熟練(クラスLv の共通強化)の威力・範囲・クールダウンを掛けたもの(Lv / 進化が変わるまでキャッシュ)
const wst = k => {
  const w = P.weapons[k], base = w.evo ? DATA.weapons[k].evo.st : DATA.weapons[k].lv[w.lv - 1], m = P.wm[k];
  if (!m || (!m.dmg && !m.area && !m.cd && !m.count && !m.pierce && !m.speed && !m.dur && !m.size)) return base;
  if (w.stBase !== base) {
    w.stBase = base;
    w.st = Object.assign({}, base, { dmg: base.dmg * (1 + (m.dmg || 0)) });
    if (base.cd !== undefined) w.st.cd = base.cd * (1 - (m.cd || 0)); // 攻撃間隔のない武器(オービットブレード)は回転速度で扱う
    for (const f of ['aoe', 'radius']) if (base[f]) w.st[f] = base[f] * (1 + (m.area || 0));
    if (base.count) w.st.count = base.count + (m.count || 0);
    if (base.strikes) w.st.strikes = base.strikes + (m.count || 0); // サンダーの回数
    if (base.pierce !== undefined) w.st.pierce = base.pierce + (m.pierce || 0);
    if (base.speed) w.st.speed = base.speed * (1 + (m.speed || 0));
    if (base.dur) w.st.dur = base.dur + (m.dur || 0);
    if (base.tick && m.cd) w.st.tick = base.tick * (1 - m.cd); // ホーリーオーラ: 熟練のクールダウンは判定の間隔に
    if (base.size && m.size) w.st.size = base.size * (1 + m.size); // スローイングアックス: 熟練の大きさ
  }
  return w.st;
};

// ---------- 敵レベル ----------
// 敵の強さの基本倍率(Lv成長は別)
const enemyBase = () => (P.uq.pact ? 1.1 : 1); // 背徳の: 敵の基礎ステータス +10%
const lvK = (kind, lv = S.elv) => 1 + DATA.enemyLevel[kind] * (lv - 1);
// HP倍率 = 線形 + 指数(Lv1 = 1)。雑魚とボスで共通
const hpK = (lv = S.elv) => DATA.enemyLevel.hpLin * (lv - 1) + Math.pow(DATA.enemyLevel.hpExp, lv - 1);
const enemyDmgK = () => enemyBase() * lvK('dmg');
function updEnemyLevel(dt) {
  if (S.phase || S.mode === 'arena') return; // ボス・エリート群のフェーズ中は停止(闘技場はラウンドごとに固定)
  S.elvT += dt * CHAOS.lvSpeed; // カオス: 敵Lv の上昇速度
  if (S.elvT >= DATA.enemyLevel.interval) { S.elvT -= DATA.enemyLevel.interval; S.elv++; UI.enemyLvUp(); }
}
function heal(n, silent) {
  if (P.uq.mercy) n *= 1.25;
  n *= clsHealMul(); // クラスの被回復量の補正(クレリック)
  if (P.burnT > 0) n *= DATA.debuff.burnHeal; // 炎上中は HP回復 -50%
  S.healed = (S.healed || 0) + n; // 回復した量の合計(聖痕)
  const before = P.hp;
  overheal(P.hp + n - P.maxhp);
  P.hp = Math.min(P.maxhp, P.hp + n);
  if (!silent && P.hp - before >= 1) {
    addFloat(P.x, P.y - 12, '+' + Math.round(P.hp - before), '#5dff8a');
    burst(P.x, P.y, 8, ['#5dff8a', '#b0ffb0'], { sp: 30, up: 30, glow: true });
    AudioMan.heal();
  }
}

// ============================================================
// プレイヤー
// ============================================================
function updPlayer(dt) {
  let [mx, my] = moveInput();
  if (P.rootT > 0) { P.rootT -= dt; if (P.invT > 0) P.rootT = 0; mx = my = 0; } // 絡め取り(クラーケン): 動けない。回避の無敵で抜けられる
  if (P.frzT > 0) mx = my = 0; // 凍結(雪華の女王の氷の槍): 歩けない。回避の無敵では解けない(回避の移動とスキルは使える)
  P.moving = mx !== 0 || my !== 0;
  if (P.moving) { P.dir = [mx, my]; if (mx) P.facing = mx > 0 ? 1 : -1; }
  const aim = mouseAimPt();
  if (aim && aim.x !== P.x) P.facing = aim.x > P.x ? 1 : -1; // 照準中はマウス側を向く(アックスの投擲方向も追従)
  clsUpdate(dt);
  const sp = P.speed * P.moveMul * (P.slowT > 0 ? P.slowK || DATA.debuff.slow : 1) * playerFrostMul();
  let vx = mx * sp, vy = my * sp;
  if (P.iceT > 0) { // 滑る床(霜の巨人): 向きを変えるのに 0.35秒の慣性がかかる
    P.iceT -= dt;
    const k = Math.min(1, dt / 0.35);
    P.ivx += (vx - P.ivx) * k; P.ivy += (vy - P.ivy) * k; vx = P.ivx; vy = P.ivy;
    if (Math.hypot(vx, vy) > 20 && Math.random() < dt * 20) part(P.x + rand(-3, 3), P.y + 7, -vx * 0.2, -rand(2, 8), 0.35, pick(['#ffffff', '#bff4ff']), { drag: 3 }); // 氷の上を滑る削りくず
  } else { P.ivx = vx; P.ivy = vy; }
  P.x += vx * dt; P.y += vy * dt;
  if (P.current && P.current.t > 0) { // 海流(深淵の海竜): 一定の向きへ流される(ダッシュなら逆らえる)
    P.current.t -= dt; P.x += P.current.vx * dt; P.y += P.current.vy * dt;
    if (Math.random() < dt * 20) part(P.x + rand(-6, 6), P.y + rand(-4, 6), P.current.vx * 1.5, P.current.vy * 1.5, 0.4, pick(['#bff4ff', '#7ad7ff']), { drag: 1 });
  }
  if (P.push) { // ボスの押し出し・引き寄せ(回避の無敵で打ち消せる)
    if (P.invT > 0 || P.dead) P.push = null;
    else {
      const k = Math.min(dt, P.push.t);
      P.x += P.push.vx * k; P.y += P.push.vy * k; P.push.t -= dt;
      if (Math.random() < dt * 40) part(P.x + rand(-3, 3), P.y + 6, -P.push.vx * 0.15 + rand(-8, 8), -rand(4, 14), 0.35, pick(['#c8b8a0', '#8a8098', '#ffffff']), { drag: 3 }); // 足元の土煙
      if (P.push.t <= 0) P.push = null;
    }
  }
  if (P.after) for (const a of P.after) a.t += dt;
  if (P.after) P.after = P.after.filter(a => a.t < 0.25);
  P.animT += dt * (P.moving ? 1 : 0.35);
  P.ifr -= dt; P.hurtT -= dt;
  updDebuffs(dt);
  const rg = P.regen + clsRegen(); // クラスの一時的な HP回復速度(バーサーカーの昂り・狂乱など)
  if (rg > 0) { const n = rg * dt * clsHealMul() * (P.burnT > 0 ? DATA.debuff.burnHeal : 1) * (P.cdSlowT > 0 ? DATA.debuff.slowRegen : 1); S.healed = (S.healed || 0) + n; overheal(P.hp + n - P.maxhp); P.hp = Math.min(P.maxhp, P.hp + n); } // 満タンで余った分は超過回復
  updOverShield(dt); // 聖盾のシールドは得た分ごとに時間で消える
  if (P.moving && Math.random() < dt * 10) part(P.x + rand(-2, 2), P.y + 6, rand(-6, 6), rand(-8, -2), 0.35, '#8a8098', { drag: 4 });
  GFX.fx.lowhp = lerp(GFX.fx.lowhp, P.hp / P.maxhp < 0.3 ? 1 : 0, dt * 3);
}

// 状態異常(ボス由来): 粘液・スロウタイムの減速 / CD回復低下、炎上の継続ダメージ(無敵時間を無視)
function updDebuffs(dt) {
  P.slowT -= dt; P.cdSlowT -= dt;
  if (P.fatigueT > 0) { P.fatigueT -= dt; if (Math.random() < dt * 6) part(P.x + rand(-5, 5), P.y - 8 + rand(-2, 2), rand(-6, 6), rand(4, 12), 0.5, pick(['#7ad7ff', '#bff4ff']), { g: 80 }); } // 疲労: 汗のしずく
  if (P.frzT > 0) { P.frzT -= dt; if (Math.random() < dt * 18) part(P.x + rand(-5, 5), P.y + rand(-6, 6), 0, 6, 0.5, pick(['#ffffff', '#9ff7ff']), { glow: true, drag: 1 }); } // 凍結: 氷の粒がこぼれる
  if (P.slowT > 0 && Math.random() < dt * 8) part(P.x + rand(-3, 3), P.y + 6, 0, 8, 0.4, P.cdSlowT > 0 ? '#c29bff' : '#4fd6a8', { glow: P.cdSlowT > 0 });
  updFrostBleed(dt);
  if (P.burnT <= 0) return;
  P.burnT -= dt; P.burnTick -= dt;
  if (Math.random() < dt * 16) part(P.x + rand(-4, 4), P.y + rand(-4, 4), 0, -26, 0.4, pick(['#ff6a2a', '#ffc34a']), { glow: true });
  if (P.burnTick > 0) return;
  P.burnTick = DATA.debuff.burnTick;
  const dmg = Math.max(1, Math.round(P.burnDmg));
  P.hp -= dmg; breakCombo(); S.hudDirty = true;
  if (P.hp <= 0 && clsSaveLethal()) P.hp = 1; // 倒れるダメージをクラスが耐える(バーサーカーの不死の狂乱)
  addFloat(P.x, P.y - 10, String(dmg), '#ff8a3d');
  if (P.hp <= 0) playerDown();
}
function burnPlayer(dmg) {
  if (P.invT > 0 || P.dead) return;
  dmg *= S.eatk ?? 1; // 攻撃してきた敵の攻撃力の倍率(ビッグクランチ)
  if (P.burnT <= 0) { P.burnTick = DATA.debuff.burnTick; P.burnDmg = 0; }
  P.burnT = DATA.debuff.burnDur * CHAOS.debuff; P.burnDmg = Math.max(P.burnDmg, dmg); // カオス: デバフの時間
}
function breakCombo() {
  if (S.combo >= 10) addFloat(P.x, P.y - 18, 'x' + S.combo, '#8a8098');
  S.combo = 0; S.comboT = 0;
}
// 自分の凍傷・出血(敵の技から)。どちらも最後に受けてから DATA.debuff.pDur 秒で全部消える
//   凍傷: 1スタックにつき移動速度 −frostSlow(最大 ×0.2)。減速を受けない状態(不屈)では付かない
//   出血: 1スタックにつき 1秒ごとに 最大HP × pBleed(最大 pBleedMax スタック)。防御力・シールドでは減らない
const playerFrostMul = () => Math.max(0.2, 1 - DATA.debuff.frostSlow * P.frost);
function frostPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead || clsSlowImmune()) return;
  const was = P.frost;
  P.frost = Math.min(Math.round(0.8 / DATA.debuff.frostSlow), P.frost + n); P.frostT = DATA.debuff.pDur * CHAOS.debuff;
  burst(P.x, P.y - 4, 6 + n * 3, ['#bff4ff', '#ffffff', '#7ad7ff'], { sp: 50, glow: true, life: 0.4 }); // 霜が弾ける
  if (Math.floor(was / 4) < Math.floor(P.frost / 4)) { addRing(P.x, P.y, 14, '#9ff7ff', { life: 0.3 }); AudioMan.frost(); } // 4スタックごとに凍みる音
  S.hudDirty = true;
}
// 減速(粘液・スロウタイム・時の歪み): k = 移動速度の倍率(重なったら強い方)。cd: クールダウンの回復も遅くする。減速を受けない状態(不屈)では付かない
function slowPlayer(k, t, cd) {
  if (P.dead || clsSlowImmune()) return;
  P.slowK = P.slowT > 0 ? Math.min(P.slowK || 1, k) : k;
  P.slowT = Math.max(P.slowT, t);
  if (cd) P.cdSlowT = Math.max(P.cdSlowT, t);
}
// 凍結(雪華の女王の氷の槍): t 秒 歩けない。減速を受けない状態(不屈)では付かない
function freezePlayer(t) {
  if (P.invT > 0 || P.dead || clsSlowImmune()) return;
  P.frzT = Math.max(P.frzT, t * CHAOS.debuff);
  addRing(P.x, P.y, 12, '#9ff7ff', { life: 0.3 }); burst(P.x, P.y - 2, 14, ['#ffffff', '#bff4ff', '#7ad7ff'], { sp: 60, glow: true, life: 0.4 }); AudioMan.frost();
}
function bleedPlayer(n) {
  if (!(n > 0) || P.invT > 0 || P.dead) return;
  if (P.bleed <= 0) P.bleedTick = 1;
  P.bleed = Math.min(DATA.debuff.pBleedMax, P.bleed + n); P.bleedT = DATA.debuff.pDur * CHAOS.debuff;
  for (let i = 0; i < 6 + n * 3; i++) part(P.x + rand(-3, 3), P.y - 4 + rand(-3, 3), rand(-50, 50), rand(-70, -20), rand(0.35, 0.6), pick(['#a0122a', '#ff3b5c', '#5a0a14']), { g: 240, drag: 1.5, sz: pick([1, 2]) }); // 血しぶき
  S.hudDirty = true;
}
function updFrostBleed(dt) {
  if (P.frost > 0) {
    if ((P.frostT -= dt) <= 0) { P.frost = 0; burst(P.x, P.y, 10, ['#bff4ff', '#ffffff'], { sp: 40, life: 0.3 }); S.hudDirty = true; } // 溶けて消える
    else if (Math.random() < dt * (3 + P.frost)) part(P.x + rand(-5, 5), P.y + rand(-8, 4), rand(-4, 4), rand(4, 12), 0.6, pick(['#ffffff', '#bff4ff', '#9ff7ff']), { glow: true, drag: 1 }); // 積むほど霜が舞う
  }
  if (P.bleed > 0) {
    if ((P.bleedT -= dt) <= 0) { P.bleed = 0; S.hudDirty = true; return; }
    if (Math.random() < dt * (4 + P.bleed * 2)) part(P.x + rand(-3, 3), P.y + rand(-4, 2), rand(-6, 6), 10, 0.5, pick(['#a0122a', '#5a0a14']), { g: 160, sz: pick([1, 2]) }); // したたる血
    if ((P.bleedTick -= dt) > 0) return;
    P.bleedTick = 1;
    const dmg = Math.max(1, Math.round(P.maxhp * DATA.debuff.pBleed * P.bleed));
    P.hp -= dmg; breakCombo(); S.hudDirty = true; GFX.fx.hurt = Math.max(GFX.fx.hurt, 0.35);
    if (P.hp <= 0 && clsSaveLethal()) P.hp = 1;
    addFloat(P.x, P.y - 10, String(dmg), '#c8102e');
    if (P.hp <= 0) playerDown();
  }
}

// シールド: P.shield(魔力障壁など。時間では消えない)+ P.oShield(時間で消える。聖盾の 10秒・守印 5秒など)。合計は最大HP まで
// P.oChunks = [{ v, t, dur }](得た順)。少しずつ得る分は、同じ長さで1秒以内なら同じかたまりにまとめる
const shieldTotal = () => (P.shield || 0) + (P.oShield || 0);
// シールドの上限: クラスが決める(ナイトは最大HP の 50% など)。無ければ最大HP
const shieldCap = () => (typeof clsShieldCap === 'function' ? clsShieldCap() : P.maxhp);
function timedShield(n, dur) {
  const v = Math.min(n * clsShieldGain(), shieldCap() - shieldTotal()), last = P.oChunks[P.oChunks.length - 1];
  if (v <= 0) return;
  if (last && last.dur === dur && last.t > dur - 1) last.v += v; else P.oChunks.push({ v, t: dur, dur });
  P.oShield += v; S.hudDirty = true;
}
// 最大HP を超えた回復量(聖盾の: 20% を10秒のシールドに)
function overheal(n) { if (!(n > 0)) return; if (P.uq.aegis) timedShield(n * 0.2, 10); clsOnOverheal(n); } // 聖盾の / クレリックの祈り
function updOverShield(dt) {
  if (!P.oChunks.length) return;
  for (const c of P.oChunks) c.t -= dt;
  for (const c of P.oChunks) if (c.t <= 0) { P.oShield = Math.max(0, P.oShield - c.v); S.hudDirty = true; }
  P.oChunks = P.oChunks.filter(c => c.t > 0);
}
// 時間で消えるシールドを a だけ削る(古いかたまりから)
function takeOverShield(a) {
  P.oShield = Math.max(0, P.oShield - a);
  while (a > 0 && P.oChunks.length) { const c = P.oChunks[0], k = Math.min(c.v, a); c.v -= k; a -= k; if (c.v <= 1e-9) P.oChunks.shift(); }
}
// o.pierce: 被弾後の無敵(P.ifr)を無視する(連続技)。回避・防御スキルの無敵(P.invT)とガードでは防げる
// 返り値: 当たった(シールドで受けた場合も含む)なら true。無敵・ガードで防いだら false(炎上などの追加効果はこれを見る)
function hurtPlayer(dmg, o) {
  if ((P.ifr > 0 && !(o && o.pierce)) || P.invT > 0 || P.dead || state !== 'play') return false;
  dmg *= S.eatk ?? 1; // 攻撃してきた敵の攻撃力の倍率(ビッグクランチ)
  const r = clsOnHurt(dmg); // ガードなどでクラスが受けきった場合は null
  if (r === null) { S.hudDirty = true; return false; }
  dmg = Math.max(1, Math.round((r - P.armor) * (1 - P.dr)));
  // シールドが先に受ける
  const a = Math.min(Math.floor(shieldTotal()), dmg); // 整数で受ける。先に消える聖盾から
  if (a > 0) {
    const fromO = Math.min(P.oShield || 0, a);
    takeOverShield(fromO); P.shield = Math.max(0, P.shield - (a - fromO));
    dmg -= a; S.hudDirty = true;
    addFloat(P.x, P.y - 10, String(a), '#7ab8ff', 1);
    burst(P.x, P.y, 8, ['#9fd8ff', '#4f8ff0', '#ffffff'], { sp: 60, glow: true, life: 0.3 });
    if (shieldTotal() < 1) { P.shield = P.oShield = 0; P.oChunks = []; addRing(P.x, P.y, 20, '#4f8ff0', { w: 2, life: 0.3 }); AudioMan.hit(); clsOnShieldBreak(); } // 割れた
    if (dmg <= 0) { P.ifr = P.iframe * clsIfrMul(); AudioMan.hit(); return true; }
  }
  P.hp -= dmg; P.ifr = P.iframe * clsIfrMul(); P.hurtT = 0.12; // 被弾後の無敵時間(クラスの倍率: アストロマンサーの不動)
  if (P.hp <= 0 && clsSaveLethal()) P.hp = 1; // 倒れるダメージをクラスが耐える(バーサーカーの不死の狂乱)
  if (P.uq.adversity) P.sta = Math.min(P.maxSta, P.sta + dmg);
  breakCombo();
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 0.9);
  shake(4); AudioMan.hurt();
  addFloat(P.x, P.y - 10, String(dmg), '#ff4a5a', 1);
  burst(P.x, P.y, 10, ['#ff4a5a', '#ffffff', '#8a1a2a'], { sp: 70 });
  S.hudDirty = true;
  if (P.hp <= 0) playerDown();
  return true;
}
// 自分の技で受けるダメージ(HP を払う: ワイルドトマホークの代償・仁王立ちなど)。防御力・ダメージ軽減・シールドでは減らず、無敵時間も付かない
//   被弾として扱うクラスは clsSelfHurt で量を変える(バーサーカー: 怒り・昂り、不屈などの軽減)。自分の技では倒れない(HP は 1 未満にならない)
//   返り値: 実際に減った HP
function selfHurt(n) {
  if (P.dead) return 0;
  const d = Math.floor(Math.min(P.hp - 1, Math.max(1, Math.round(clsSelfHurt(n)))));
  if (d <= 0) return 0;
  P.hp -= d; P.hurtT = 0.12; S.hudDirty = true;
  addFloat(P.x, P.y - 10, String(d), '#ff4a5a', 1);
  burst(P.x, P.y - 4, 8, ['#8e0016', '#5a000c', '#3a0008'], { sp: 60, life: 0.35 });
  return d;
}

function playerDown() {
  if (P.uq.phoenix && !P.revived) {
    P.revived = true; P.hp = P.maxhp * 0.25; P.ifr = 2;
    UI.announce('REVIVE', '不死鳥の加護'); AudioMan.evolve();
    screenFlash(0.6, '#ffb347'); shockAt(P.x, P.y, 2, 0.8); addRing(P.x, P.y, 60, '#ffb347', { w: 3, life: 0.6 });
    burst(P.x, P.y, 60, ['#ffb347', '#ff6a2a', '#ffffff'], { sp: 140, up: 60, glow: true, life: 1 });
    return;
  }
  P.dead = true; P.hp = 0;
  S.deathT = 1.8; slowmo(0.25, 2.5);
  screenFlash(0.8, '#ff3b5c'); shockAt(P.x, P.y, 2, 0.6); shake(12);
  burst(P.x, P.y, 80, ['#4c3a86', '#e8434f', '#9ff7ff', '#ffffff'], { sp: 140, glow: true, life: 1.4 });
  AudioMan.death(); AudioMan.stopMusic(2);
}

function gainXP(v) {
  P.xp += v * P.xpMul;
  while (P.xp >= P.xpNext) {
    P.xp -= P.xpNext; P.level++; P.xpNext = xpFor(P.level); S.pendingLv++; S.lvQueue.push(P.level);
  }
  S.hudDirty = true;
}

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
  const cdt = dt * (P.cdSlowT > 0 ? DATA.debuff.cdRate : 1); // スロウタイム中はCD回復が遅い
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
      const ts = randomTargets((st.strikes || 1) + P.shots);
      if (!ts.length) return false;
      ts.forEach((t, i) => setTimeout(() => state === 'play' && strike(t.x, t.y, st, w.evo), i * 70));
      return true;
    }
    case 'aura': { // 周りの敵へ 1回(サンクチュアリ: 命中 1回につき HP 回復。1回で 5回分まで)
      let healed = 0;
      forEachNear(o.x, o.y, st.radius * P.area, e => {
        hitEnemy(e, st.dmg, { src: k, noNum: Math.random() < 0.5, ang: Math.atan2(e.y - o.y, e.x - o.x), kb: 6 });
        if (w.evo && healed < 5) { heal(0.4, true); healed++; }
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
  if (!(perSec > 0) || e.dead || e.prop) return;
  dur += clsBurnDur(); // クラスの持続の追加(パイロマンサー)
  const b = e.burns || (e.burns = []);
  b.push({ v: perSec, t: dur, src });
  if (b.length > 40) b.shift();
  if (e.burnT <= 0) e.burnTick = DATA.debuff.burnTick;
  e.burnT = Math.max(e.burnT, dur);
}
// 敵の出血: n スタック積み、持続を戻す。上限と持続の追加はクラスが決める(上限が無いクラスは無制限)
function addBleed(e, n) {
  if (!(n > 0) || e.dead || e.prop) return;
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
  ring:      { body: '#3a4668', edge: '#8ea6d8', glow: '#3a4668' },                  // オービットブレードの輪が一周する(影の追撃)
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
    if (!e.prop) hits.push(e);
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
    if (!e.prop) hits++;
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
          if (z.dmg) hitEnemy(e, z.dmg, { src: 'blizzard', noNum: Math.random() < 0.6, col: '#bff4ff', frost: true });
          if (z.maxFrost) addFrost(e, mageFrostCap(), mageFrostCap()); else addFrost(e, 1, 10); // maxFrost: 絶対零度
        });
      }
    } else if (z.kind === 'crack') { // 地割れ(グランドスラムの特殊強化)
      if (z.tick <= 0) {
        z.tick = 0.5;
        asMine(() => forEachNear(z.x, z.y, z.r, e => { if (!e.prop) hitEnemy(e, z.dmg, { src: 'slam', noNum: Math.random() < 0.6, col: '#ffb347', eHit: true, cl: z.cl }); }));
      }
      if (Math.random() < dt * 10) part(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.4, 0, -15, 0.5, pick(['#ffb347', '#8a5a2a']), { glow: true });
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
    } else if (z.kind === 'gspark') { // グラビティスパーク: 最初に1回大きく引き寄せ → 爆発(残留磁場: その後も弱く引き寄せる)
      if (!z.pulled) {
        z.pulled = true;
        forEachNear(z.x, z.y, z.r, e => { if (e.boss || e.prop) return; const k = 8 * (1 - (e.kbRes || 0) * 0.5); e.kx += (z.x - e.x) * k; e.ky += (z.y - e.y) * k; });
        for (let i = 0; i < 30; i++) { const a = rand(0, TAU), r = z.r * rand(0.6, 1); part(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r, -Math.cos(a) * r * 4, -Math.sin(a) * r * 4, 0.22, pick(['#9fd8ff', '#fff27a', '#ffffff']), { glow: true, drag: 0 }); }
      }
      const sk = DATA.weapons.thunder.skill;
      if (!z.boomed && z.t >= sk.boomT) {
        z.boomed = true;
        const el = clsNextEl();
        asMine(() => {
          forEachNear(z.x, z.y, z.boomR, e => {
            if (e.prop) { killEnemy(e); return; }
            const dealt = hitEnemy(e, z.dmg, { src: 'gspark', ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 30, col: '#9fd8ff', el, eHit: true, cl: z.cl });
            if (dealt && !e.dead) addShock(e, dealt, sk.shock);
            if (z.stun && !e.dead) e.stun = Math.max(e.stun || 0, e.boss ? sk.bossStun : sk.stun); // 超電磁
          });
          for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + rand(-0.2, 0.2), L = z.boomR * rand(1, 1.6); bolts.push({ x0: z.x, y0: z.y, x1: z.x + Math.cos(a) * L, y1: z.y + Math.sin(a) * L, t: 0, life: 0.2, w: 1 }); }
          addFlash(z.x, z.y, z.boomR * 2.2, '#9fd8ff', 0.22); addRing(z.x, z.y, z.boomR, '#ffffff', { w: 2, life: 0.35 });
          burst(z.x, z.y, 30, ['#9fd8ff', '#fff27a', '#ffffff'], { sp: 150, glow: true, life: 0.4 }); shockAt(z.x, z.y, 1.3, 1); shake(6);
        });
        AudioMan.boom(); AudioMan.zap();
      }
      if (z.field && z.boomed) forEachNear(z.x, z.y, z.r, e => { // 残留磁場
        if (e.boss || e.prop || e.obj) return; // ボスが出した物は動かない
        const a = Math.atan2(z.y - e.y, z.x - e.x), dd = Math.sqrt(d2(z.x, z.y, e.x, e.y)), k = Math.min(dd, DATA.weapons.thunder.skill.fieldPull * dt);
        e.x += Math.cos(a) * k; e.y += Math.sin(a) * k;
      });
    } else if (z.kind === 'tower') { // 鉄塔: every 秒ごとに近くの敵 1体へ放電 / 送電線 / 過充電
      if (z.tick <= 0) {
        z.tick = DATA.classes.electro.q.every;
        const tg = nearestEnemy(z.x, z.y, z.r);
        if (tg) asMine(() => {
          const dealt = hitEnemy(tg, z.pow, { src: 'tower', ang: Math.atan2(tg.y - z.y, tg.x - z.x), kb: 20, col: '#fff27a' });
          if (dealt) { addShock(tg, dealt, z.shock); if (z.dis) addShock(tg, dealt, z.dis, { noCharge: true }); }
          bolts.push({ x0: z.x, y0: z.y - 21, x1: tg.x, y1: tg.y, t: 0, life: 0.18, w: 2 });
          addFlash(tg.x, tg.y, 30, '#fff27a', 0.2);
        });
        if (tg) AudioMan.zap();
      }
      if (z.wire) { // 送電線: 同じ Q の鉄塔のうち一番近いものと線でつなぐ(自分より後の鉄塔とだけ)
        z.wireT -= dt;
        if (z.wireT <= 0) {
          z.wireT = DATA.classes.electro.q.wireEvery;
          const others = zones.filter(o => o !== z && o.kind === 'tower' && o.id === z.id);
          let nb = null, nd = Infinity;
          for (const o of others) { const d = d2(o.x, o.y, z.x, z.y); if (d < nd) { nd = d; nb = o; } }
          z.link = nb;
          if (nb && zones.indexOf(nb) > zones.indexOf(z)) {
            const W = DATA.classes.electro.q.wireW, ax = z.x, ay = z.y - 18, bx = nb.x, by = nb.y - 18, L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
            asMine(() => forEachNear((ax + bx) / 2, (ay + by) / 2, Math.sqrt(L2) / 2 + W, e => {
              if (e.prop) return;
              const u = clamp(((e.x - ax) * (bx - ax) + (e.y - ay) * (by - ay)) / L2, 0, 1), px = ax + (bx - ax) * u, py = ay + (by - ay) * u;
              if (d2(e.x, e.y, px, py) < W * W) hitEnemy(e, z.wire, { src: 'tower', noNum: Math.random() < 0.6, col: '#fff27a' });
            }));
          }
        }
      }
      if (Math.random() < dt * 6) bolts.push({ x0: z.x, y0: z.y - 21, x1: z.x + rand(-6, 6), y1: z.y - 21 + rand(-6, 2), t: 0, life: 0.06, w: 1 }); // 先端の火花
      if (z.t + dt >= z.dur && !z.done) {
        z.done = true;
        if (z.boom) { // 過充電
          const R = DATA.classes.electro.q.boomR * P.area;
          asMine(() => {
            forEachNear(z.x, z.y, R, e => { if (!e.prop) hitEnemy(e, z.boom, { src: 'tower', ang: Math.atan2(e.y - z.y, e.x - z.x), kb: 90, col: '#fff27a' }); });
            addFlash(z.x, z.y, R * 3, '#fff27a', 0.4); addRing(z.x, z.y, R, '#ffffff', { w: 3, life: 0.4 });
            burst(z.x, z.y, 30, ['#fff27a', '#ffffff', '#9fd8ff'], { sp: 150, glow: true, life: 0.45 }); shockAt(z.x, z.y, 1.3, 1); shake(5);
          });
          AudioMan.boom();
        } else asMine(() => burst(z.x, z.y - 10, 12, ['#8a8098', '#fff27a'], { sp: 60, up: 20, life: 0.4 }));
      }
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
          if (ic.big) { addRing(ic.x, ic.y, R, '#ffffff', { w: 3, life: 0.45 }); shockAt(ic.x, ic.y, 1.6, 1); shake(8); hitstop(0.05); AudioMan.boom(); }
          else shake(1);
        });
        if (z.patch) zones.push({ kind: 'frostpatch', x: ic.x, y: ic.y, r: R, t: 0, dur: DATA.weapons.blizzard.skill.patchT, tick: 0.5 }); // 凍てつく大地
        if (!ic.big && Math.random() < 0.5) AudioMan.hit();
      }
      z.ices = z.ices.filter(ic => !ic.done || ic.t < ICE_FALL + 0.4);
      if (z.left > 0 || z.ices.length) z.dur = Math.max(z.dur, z.t + 0.1); // 降り終わるまで残す
    } else if (z.kind === 'frostpatch') { // 凍てつく大地: 触れた敵に凍傷 +1 / 0.5秒
      if (z.tick <= 0) { z.tick = 0.5; forEachNear(z.x, z.y, z.r, e => { if (!e.prop) addFrost(e, 1, 10); }); }
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
      if (z.whiteout) for (const p of eprojs) if (!p.wo && d2(p.x, p.y, z.x, z.y) < z.r * z.r) { p.wo = true; p.vx *= z.whiteout; p.vy *= z.whiteout; p.life = (p.life || 4) / z.whiteout; } // ホワイトアウト
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
        forEachNear(z.x, z.y, z.r, e => { if (!e.prop) addFrost(e, 1, mageFrostCap()); });
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

// ============================================================
// ダメージ・撃破
// ============================================================
function hitEnemy(e, base, o = {}) {
  if (e.dead) return 0;
  if (e.prop) { killEnemy(e, o); return 0; }
  if (e.flying || e.invuln) return 0; // 空を飛んでいるボス(カオスドラゴンの空襲)・変身中の死神には当たらない
  let dmg = (base + clsHitBonus(e, o)) * dmgMul() * clsDmgTaken(e, o) * wsDmgTaken(e) * (e.takeK || 1); // 祈りの一撃などの追加 / 印・凍結・侵蝕などで敵が受けるダメージが増える / takeK: ボスの状態(岩の鎧・ひるみ・分裂など)
  if (e.frost > 0 && P.weapons.blizzard && P.weapons.blizzard.evo) dmg *= 1 + 0.01 * e.frost;
  const crit = o.forceCrit || (!o.noCrit && Math.random() < critRate() + clsCritBonus(e));
  if (crit) dmg *= P.critMul + clsCritDmgBonus(e); else if (P.uq.exec) dmg *= 0.8; // 処刑人の
  dmg = Math.max(1, Math.round(dmg * rand(0.9, 1.1)));
  e.hp -= dmg; e.flash = 0.08;
  if (o.src && o.src === P.mainW) clsOnMainHit(e); // 通常攻撃(メイン武器)の命中
  if (o.eHit) clsOnEHit(e, dmg);                   // 武器スキル(E)の命中
  if (o.el) clsOnElement(e, o.el, dmg);             // 属性(メイジの元素循環)
  if (!o.dot && (o.eHit || (o.src && P.weapons[o.src]))) clsOnWeaponHit(e, dmg, crit, o); // 武器の命中(炎上などの継続ダメージは除く)
  S.totalDmg += dmg;
  if (o.src) S.dmgBy[o.src] = (S.dmgBy[o.src] || 0) + dmg;
  if (o.kb && o.ang !== undefined && !e.boss) {
    const k = o.kb * (1 - (e.kbRes || 0));
    e.kx += Math.cos(o.ang) * k; e.ky += Math.sin(o.ang) * k;
  }
  // quiet: 画面中の敵へまとめて当てる攻撃(ディメンション・リフト)。音・光を出さず、数字はクリティカルだけ
  if (crit) {
    addFloat(e.x, e.y - e.r - 3, dmg + '!', '#ffe14a', 1, -38);
    if (!o.quiet) { burst(e.x, e.y, 6, ['#ffe14a', '#ffffff'], { sp: 90, glow: true, life: 0.3 }); AudioMan.crit(); }
  } else {
    if (!o.noNum) addFloat(e.x, e.y - e.r - 3, String(dmg), '#ffffff');
    if (!o.quiet && Math.random() < 0.5) part(e.x + rand(-2, 2), e.y + rand(-2, 2), rand(-40, 40), rand(-40, 10), 0.25, o.col || '#ffffff', { glow: true });
    if (!o.quiet) AudioMan.hit();
  }
  if (e.boss) S.hudDirty = true;
  if (e.hp <= 0) { if (o.noKill) e.hp = 1; else killEnemy(e, o); } // noKill: 倒さずに HP 1 で残す(爆弾のエリート)
  return dmg;
}

function killEnemy(e, o = {}) {
  if (e.dead) return;
  if (e.boss === 'reaper' && !e.morphed) { startReaperMorph(e); return; } // 死神の第一形態は倒れると終刻の死神に変身する(報酬は第二形態で)
  e.dead = true;
  if (e.boss) return onBossDeath(e);
  if (e.obj) return objDown(e, true); // ボスが出した物(壊した)
  const col = ECOL[e.type] || ['#ffffff', '#888888'];
  if (e.prop) {
    burst(e.x, e.y, 18, ['#ff6a2a', '#ffc34a', '#3a3040', '#6a6070'], { sp: 70, up: 20, glow: true });
    addFlash(e.x, e.y, 50, '#ffb347', 0.3);
    const r = Math.random();
    const kind = r < 0.3 ? 'coin' : r < 0.55 ? 'meat' : r < 0.7 ? 'magnet' : r < 0.82 ? 'bomb' : 'gem';
    if (kind === 'coin') for (let i = 0; i < 5; i++) dropItem('coin', e.x, e.y, 2);
    else if (kind === 'gem') dropGem(e.x, e.y, 10);
    else dropItem(kind, e.x, e.y);
    AudioMan.kill();
    return;
  }
  S.kills++;
  S.combo++; S.comboT = DATA.player.comboTime; S.bestCombo = Math.max(S.bestCombo, S.combo);
  if (S.combo % 100 === 0) { UI.announce(S.combo + ' COMBO!!', 'ボーナス +' + Math.round(S.combo / 10) + 'G'); addGold(S.combo / 10); }
  burst(e.x, e.y, e.elite ? 40 : 7, [col[0], col[1], '#ffffff'], { sp: e.elite ? 120 : 60, up: 15, g: 120, drag: 3 });
  part(e.x, e.y, 0, -20, 0.45, '#ffffff', { glow: true, sz: 2, drag: 1 });
  addRing(e.x, e.y, e.r + 4, col[0], { life: 0.18 });
  if (e.xp > 0) dropGem(e.x, e.y, e.xp * (e.elite ? 12 : 1)); // 経験値のない敵(巨大スライムの中スライム)はジェムを落とさない
  if (Math.random() < 0.035) dropItem('coin', e.x, e.y, 1);
  if (Math.random() < 0.004) dropItem('meat', e.x, e.y);
  clsOnKill(e, o); // o: 倒した一撃の指定(o.cl: 分身など自分以外の使い手の武器スキル)
  if (P.uq.vamp && Math.random() < 0.25) heal(P.maxhp * 0.01, true); // 吸血鬼の
  // ソウルイーター: 撃破地点から魂を召喚(同時40体まで)
  const ww = P.weapons.wisp;
  if (ww && ww.evo && projs.filter(p => p.summon).length < 40) {
    const st = wst('wisp');
    fire('wisp', e.x, e.y, rand(0, TAU), st.speed * 90 / 110, { dmg: st.dmg, pierce: st.pierce, life: 2.2, src: 'wisp', homing: 5.5, speed: st.speed, col: '#9dffcf', summon: true });
    part(e.x, e.y, 0, -30, 0.5, '#9dffcf', { glow: true, sz: 2 });
  }
  AudioMan.kill();
  const ed = DATA.enemies[e.type];
  if (ed.split && !e.elite && !e.owner) for (let i = 0; i < 2; i++) spawnEnemy(ed.split, { x: e.x + rand(-4, 4), y: e.y + rand(-4, 4) }); // ボスの中スライムは分裂しない
  if (ed.fireFloor) lavaPool(e, ed.fireFloor); // 溶岩スライム: 倒れた場所に燃える床
  if (e.phaseElite && S.phase && S.phase.kind === 'elite') { S.phase.lastX = e.x; S.phase.lastY = e.y; } // エリート群: 宝箱は最後の1体の位置に
  if (e.elite || e.type === 'goblin') {
    hitstop(0.06); shake(6); shockAt(e.x, e.y, 1.2, 0.8); addFlash(e.x, e.y, 100, '#ffd23f', 0.4);
    if (!e.noChest) dropItem('chest', e.x, e.y); // 自然発生のエリート・トレジャー(ゴブリン)は装備宝箱を落とす(エリート群・親衛隊・ボス戦中のエリートは落とさない)
    const n = e.type === 'goblin' ? 18 : 4;
    for (let i = 0; i < n; i++) dropItem('coin', e.x, e.y, e.type === 'goblin' ? 3 : 2);
    AudioMan.boom();
  }
}

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
  const hpk = base * hpK() * (o.elite ? EL.elite : 1);
  const spk = base * Math.min(EL.spdMax, lvK('spd')) * (P.uq.clock ? 1.15 : 1) * (o.elite ? 1.1 : 1); // 狂時の: 速度 +15%
  const e = {
    id: nextId++, type, x, y, hp: d.hp * hpk, maxhp: d.hp * hpk, spd: d.spd * spk * rand(0.9, 1.1), dmg: d.dmg * enemyDmgK() * (o.elite ? EL.eliteDmg : 1),
    rateK: o.elite ? EL.eliteRate : 1, areaK: o.elite ? EL.eliteArea : 1, // エリート: 攻撃速度・攻撃範囲
    r: d.r * (o.elite ? 2 : 1), xp: d.xp * lvK('xp'), ai: d.ai, kbRes: o.elite ? 0.9 : d.kbRes || 0, ghost: d.ghost,
    t: rand(0, 5), seed: Math.random(), kx: 0, ky: 0, flash: 0, elite: !!o.elite, scale: o.elite ? 2 : 1,
    frost: 0, frostT: 0, burns: [], burnT: 0, burnTick: 0, stun: 0, slowT: 0, bleed: 0, bleedT: 0, shotT: (d.shot || d.throw || d.rush || d.puff || d.lantern || d.snowball || d.blink || d.warp) ? rand(1, (d.shot || d.throw || d.rush || d.puff || d.lantern || d.snowball || d.blink || d.warp).cd) : 0, wind: 0, hopT: rand(0, 1),
    life: type === 'goblin' ? 16 : 0,
    noChest: !!o.noChest, phaseElite: !!o.phaseElite, // 宝箱を落とさない / エリート群のエリート
  };
  enemies.push(e);
  return e;
}

function spawnProp() {
  const a = rand(0, TAU), R = rand(180, 260);
  const e = spawnEnemy('zombie', { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R });
  Object.assign(e, { type: 'brazier', prop: true, hidden: true, hp: 1, maxhp: 1, spd: 0, dmg: 0, r: 4, ai: 'none', xp: 0, kbRes: 1 });
}

// ---------- 通常敵の攻撃 ----------
// 射撃(弓兵・火の小鬼・砂術師): 弾のダメージ = その敵のダメージ × n。count 発を spread rad おきの扇に(count が [最小, 最大] なら1回ごとにランダム)
const SHOT_R = { arrow: 2, efire: 3, esand: 2.5, eice: 2.5 }; // 弾の当たり判定の半径(見た目の大きさ。攻撃範囲の倍率で広がる)
function enemyShoot(e, s, a) {
  const n = Array.isArray(s.count) ? randi(s.count[0], s.count[1]) : s.count || 1;
  for (let i = 0; i < n; i++) {
    const aa = a + (i - (n - 1) / 2) * (s.spread || 0);
    eprojs.push({ kind: s.kind, x: e.x, y: e.y - 2, vx: Math.cos(aa) * s.spd, vy: Math.sin(aa) * s.spd, dmg: e.dmg * s.n * S.eatk, burn: s.burn ? e.dmg * s.burn * S.eatk : 0, frost: s.frost || 0, life: 4, t: 0, r: (SHOT_R[s.kind] || 3) * CHAOS.area * e.areaK, sk: e.areaK }); // sk: 弾の見た目の大きさ(エリートは範囲 ×1.5)
  }
  if (s.kind === 'eice') { burst(e.x + Math.cos(a) * 4, e.y - 2 + Math.sin(a) * 4, 7, ['#9ff7ff', '#ffffff', '#7ad7ff'], { sp: 45, glow: true, life: 0.3 }); AudioMan.frost(); }
  if (s.kind === 'efire') { burst(e.x + Math.cos(a) * 4, e.y - 2 + Math.sin(a) * 4, 7, ['#ff6a2a', '#ffc34a', '#fff6c8'], { sp: 45, glow: true, life: 0.3 }); AudioMan.fire(); }
  else if (s.kind === 'esand') { burst(e.x, e.y - 2, 12, ['#e8c88a', '#c8a060', '#fff0c0'], { sp: 60, life: 0.4, drag: 2 }); addRing(e.x, e.y + 3, 10, '#e8c88a', { life: 0.3 }); }
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
  P.fatigueT = Math.max(P.fatigueT || 0, DATA.debuff.fatigueDur * CHAOS.debuff);
  for (let i = 0; i < 8; i++) part(P.x + rand(-4, 4), P.y - 4 + rand(-3, 3), rand(-40, 40), rand(-50, -10), 0.5, pick(['#7ad7ff', '#bff4ff', '#2a8ac8']), { g: 160, drag: 1 });
  AudioMan.drain();
}
// イエティの雪玉: 1秒の放物線。着弾 半径 r に ×n・凍傷 +frost と、雪の床(floor 秒)
function yetiThrow(e, sb) {
  const dmg = e.dmg * sb.n;
  lob('snowball', e.x, e.y - 8, e.tx, e.ty, 1.0, 45, p => {
    if (hitCircle(p.x, p.y, sb.r * e.areaK, dmg)) frostPlayer(sb.frost);
    addHazard('snow', p.x, p.y, { r: sb.r * e.areaK, dur: sb.floor, tick: 1 });
    burst(p.x, p.y, 22, ['#ffffff', '#e8f4ff', '#bff4ff'], { sp: 90, up: 40, g: 200, life: 0.6 }); addRing(p.x, p.y, sb.r * CHAOS.area * e.areaK, '#ffffff', { life: 0.3 });
    AudioMan.thud();
  });
  e.sq = 0.7; e.kx -= Math.cos(Math.atan2(e.ty - e.y, e.tx - e.x)) * 20;
  burst(e.x, e.y - 8, 8, ['#ffffff', '#e8f4ff'], { sp: 40, life: 0.3 }); AudioMan.dash();
}
// 溶岩スライム: 着地・倒れた場所に燃える床
function lavaPool(e, f) {
  addHazard('fire', e.x, e.y + 2, { r: f.r * e.areaK, dur: f.dur, dmg: e.dmg });
  burst(e.x, e.y + 2, 9, ['#ff6a2a', '#ffc34a', '#5a1a14'], { sp: 55, g: 180, life: 0.45 });
}

function updEnemies(dt) {
  const R2 = Math.pow(Math.hypot(GFX.VW, GFX.VH) * 0.75, 2);
  for (const e of enemies) {
    if (e.dead) continue;
    S.eatk = e.atkDownT > S.time ? 1 - DATA.weapons.bhole.evo.atkDown : 1; // ビッグクランチ: ブラックホールの中の敵は攻撃力が下がる(体当たり・矢・ボスの攻撃)
    e.t += dt; e.flash -= dt;
    if (e.prop) { if (d2(e.x, e.y, P.x, P.y) > R2 * 2) e.dead = true; continue; }
    // 状態異常
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
      if (!e.burns.length && bs.length) clsOnBurnOut(e, bs.reduce((a, b) => a + b.v, 0), bs.every(b => b.src === 'ember')); // 全部切れた
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
    if (e.boss) { const r0 = CHAOS.rate; CHAOS.rate *= clsBossRate(e); try { bossAI(e, dt); } finally { CHAOS.rate = r0; } } // 凍結中のボスは攻撃速度 -30%
    else {
      const tw = clsEnemySlow(e); // 時の歪み(アストロマンサーの重力圏): 移動・攻撃が遅くなる
      const slow = Math.max(0.2, 1 - DATA.debuff.frostSlow * (e.frost || 0)) * (e.slowT > 0 ? 0.6 : 1) * tw; // 凍傷(時の歪みと掛け算)
      const sp = e.spd * slow;
      const dc = S.decoy && d2(e.x, e.y, S.decoy.x, S.decoy.y) < 200 * 200 ? S.decoy : P; // 空蝉の分身
      const a = Math.atan2(dc.y - e.y, dc.x - e.x), d = DATA.enemies[e.type];
      let mx = Math.cos(a), my = Math.sin(a);
      if (e.ai === 'flutter') { const w = Math.sin(e.t * 5 + e.seed * 10) * (d.wobble || 0.8); mx -= Math.sin(a) * w; my += Math.cos(a) * w; }
      else if (e.ai === 'hop') { // 跳ねる(宝石スライムは速い間隔で大きく跳ぶ)
        const hp = d.hop, every = e.hopEvery = hp ? hp.every : 1.1, air = e.hopAir = hp ? every * 0.45 : 0.35, k = hp ? hp.k : 2.4;
        e.hopT -= dt; const hop = e.hopT < air;
        if (e.hopT <= 0) { e.hopT = every; if (d.fireFloor && Math.random() < d.fireFloor.chance) lavaPool(e, d.fireFloor); } // 着地(溶岩スライム: 燃える床)
        mx *= hop ? k : 0.1; my *= hop ? k : 0.1;
      } else if (e.ai === 'keep') { // 距離を取って射撃(弓兵・火の小鬼・砂術師)
        const s = d.shot, dd = Math.sqrt(d2(e.x, e.y, P.x, P.y));
        const k = e.wind > 0 ? 0 : dd > d.keep[1] ? 1 : dd < d.keep[0] ? -1 : 0; // 構えている間は止まる
        mx *= k; my *= k;
        if (!s) { /* 射撃のない敵(砂時計の精)は距離を保つだけ */ }
        else if (e.wind > 0) { // 構え(砂術師): 足元で砂が渦を巻き、終わると撃つ
          e.wind -= dt * CHAOS.rate * tw;
          if (Math.random() < dt * 45) { const pa = rand(0, TAU), pr = rand(5, 10); part(e.x + Math.cos(pa) * pr, e.y + 4 + Math.sin(pa) * pr * 0.5, -Math.sin(pa) * 34, Math.cos(pa) * 16 - 10, 0.35, pick(['#e8c88a', '#c8a060', '#fff0c0']), { drag: 2 }); }
          if (e.wind <= 0) enemyShoot(e, s, Math.atan2(dc.y - e.y, dc.x - e.x));
        } else {
          e.shotT -= dt * CHAOS.rate * tw * e.rateK; // カオス: 攻撃頻度 / 時の歪み
          if (e.shotT <= 0 && dd < s.range) {
            e.shotT = s.cd;
            if (s.wind) { e.wind = s.wind; AudioMan.sand(); } else enemyShoot(e, s, a);
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
        if (e.life <= 0) { e.dead = true; UI.announce('逃げられた…', ''); burst(e.x, e.y, 20, ['#ffffff', '#ffcc33'], { sp: 60 }); continue; }
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
            e.shotT = sb.cd; e.wind = 0.5; e.tx = P.x; e.ty = P.y;
            pushWarn({ kind: 'circle', x: P.x, y: P.y, r: sb.r * e.areaK, t: 0, life: 1.5, owner: e });
          }
        }
        e.aim = e.wind > 0;
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
      e.x += mx * sp * dt; e.y += my * sp * dt;
      e.face = (mx || dc.x - e.x) < 0 ? -1 : 1; // 止まっている間はプレイヤーの方を向く
      // 分離(重なり防止)
      if (!e.ghost && e.ai !== 'roll') {
        let n = 0;
        forEachNear(e.x, e.y, e.r, o => {
          if (o === e || o.ghost || o.prop) return;
          const dx = e.x - o.x, dy = e.y - o.y, dd = Math.hypot(dx, dy) || 0.1, ov = e.r + o.r - dd;
          if (ov > 0) { const push = ov * 0.35 * (o.boss ? 2 : 1); e.x += dx / dd * push; e.y += dy / dd * push; }
          if (++n > 6) return false;
        });
      }
      // 遠すぎる敵は進行方向の反対側へ再配置
      if (d2(e.x, e.y, P.x, P.y) > R2 && e.type !== 'goblin' && e.ai !== 'roll') {
        const a2 = Math.atan2(P.y - e.y, P.x - e.x) + rand(-0.5, 0.5), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 12;
        e.x = P.x + Math.cos(a2) * R; e.y = P.y + Math.sin(a2) * R;
      }
    }
    const td = !e.boss && DATA.enemies[e.type]; // 触れたとき: 鬼火は当たらない / ヘルハウンドは噛みつくと炎上 / クラゲはスタミナを吸う
    if (e.dmg > 0 && !e.air && !(td && td.noTouch) && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2) && hurtPlayer(e.dmg) && td) { if (td.touchBurn) burnPlayer(e.dmg * td.touchBurn); if (td.touchSta) drainSta(td.touchSta); if (td.touchFrost) frostPlayer(td.touchFrost); }
  }
  S.eatk = 1;
  if (enemies.length > 40) enemies = enemies.filter(e => !e.dead);
}

// ============================================================
// ボス
// ============================================================
function spawnBoss(key, final, companion) {
  const b = DATA.bosses[key];
  AudioMan.roar(); AudioMan.warning(); AudioMan.playMusic(b.music);
  UI.banner('⚠ WARNING ⚠', b.name);
  shake(8); screenFlash(0.3, '#ff3b5c');
  const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 30;
  const hp = b.hp * enemyBase() * hpK() * CHAOS.bossHp; // カオス: ボスの基礎体力(闘技場)
  const e = {
    id: nextId++, type: key, boss: key, name: b.name, final: !!final, enrage: b.enrage ?? 0.6, x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R,
    hp, maxhp: hp, spd: b.spd * Math.min(DATA.enemyLevel.spdMax, lvK('spd')), dmg: b.dmg * enemyDmgK(), r: b.r, col: b.col, xp: 0, kbRes: 1,
    t: 0, seed: 0, kx: 0, ky: 0, flash: 0, frost: 0, frostT: 0, burns: [], burnT: 0, burnTick: 0, stun: 0, slowT: 0, scale: 1, jz: 0, sq: 1,
    ai: {
      ph: 'chase', pt: 0, atk: 3, sum: 7, slam: 6, ring: 3, aim: 2, tp: 5, spiral: 3.5, spN: 0, spGap: 0, spA: 0, enraged: false,
      q: [], act: null, wind: 0, cd: 2.5, hop: 1, spinCd: 4, beamCd: 8, throw: 3, clock: 7,
    },
  };
  Object.assign(e.ai, BOSS_AI0[key] || {});
  if (CHAOS.rage) e.enrage = 2; // カオス: 常に激怒(最初のフレームで激昂する)
  enemies.push(e);
  S.boss = e;
  UI.bossBar(e);
  S.bosses = [e];
  if (!S.phase || S.phase.kind !== 'boss') S.phase = { kind: 'boss', t: 0 }; // ボスのフェーズ(双王の2体目では始め直さない)
  if (CHAOS.twin && !companion) { // カオス: もう1体(このステージ以外のボスからランダム)
    const here = new Set(S.sched ? S.sched.filter(x => x.boss).flatMap(x => x.boss) : []);
    const pool = Object.keys(DATA.bosses).filter(k => k !== key && !here.has(k) && !DATA.bosses[k].form2); // 第二形態(終刻の死神)は単独では出ない
    const k2 = pick(pool.length ? pool : Object.keys(DATA.bosses).filter(k => k !== key && !DATA.bosses[k].form2));
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
const hitCircle = (x, y, r, dmg) => { r *= CHAOS.area; return d2(x, y, P.x, P.y) < (r + 3) * (r + 3) && hurtPlayer(dmg); }; // 当たったら true
const inLine = (x, y, a, len, w) => { len *= CHAOS.area; w *= CHAOS.area; return segD2(P.x, P.y, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len) < Math.pow(w / 2 + 3, 2); };
const hitLine = (x, y, a, len, w, dmg, o) => inLine(x, y, a, len, w) && hurtPlayer(dmg, o); // 当たったら true
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// 扇の当たり判定(中心 x, y・向き a・半径 r・片側 h rad。半径は攻撃範囲の倍率で広がる)
const inFan = (x, y, a, r, h) => { r *= CHAOS.area; const d = Math.sqrt(d2(x, y, P.x, P.y)); return d < r + 3 && (d < 4 || Math.abs(angDiff(Math.atan2(P.y - y, P.x - x), a)) < h + 3 / d); };
const hitFan = (x, y, a, r, h, dmg, o) => inFan(x, y, a, r, h) && hurtPlayer(dmg, o);
// 予備動作(停止して点滅 → fn)
function windup(e, t, fn) { e.ai.wind = t; e.ai.fire = fn; }
// ノックバック: ang の向きへ dist を dur 秒かけて(一定の速さ)。回避の無敵中は押されない(押されている途中で回避すると止まる)。闘技場では壁で止まる
function pushPlayer(ang, dist, dur) {
  if (P.dead || P.invT > 0 || !(dist > 0)) return false;
  P.push = { vx: Math.cos(ang) * dist / dur, vy: Math.sin(ang) * dist / dur, t: dur };
  return true;
}
// 新しい仕組みの説明(そのランで初めて見たときに一度だけ)
function hint(key, main, sub) { if (S.hint[key]) return; S.hint[key] = true; UI.announce(main, sub); }
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
  } else if (e.obj === 'crystal' || e.obj === 'prism') { // 結晶: 七色のきらめき
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
  } else if (e.obj === 'iceblock') { // 氷塊(霜の巨人): 冷気が立ちのぼる
    if (Math.random() < dt * 4) part(e.x + rand(-8, 8), e.y - rand(0, 12), rand(-3, 3), -rand(3, 8), 0.8, pick(SNOW), { drag: 1 });
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
  } else if (e.obj === 'altar') {
    burst(e.x, e.y - 6, Math.round(36 * k), ['#3a2a2a', '#6a5050', '#ff6a2a', '#ffc34a'], { sp: 110 * k, g: 200, life: 0.7 });
    if (broken) { addFlash(e.x, e.y, 80, '#ff8a3d', 0.6); shake(5); AudioMan.boom(); UI.announce('祭壇の火が消えた', ''); }
  } else if (e.obj === 'crystal' || e.obj === 'prism') { // 結晶: 七色のかけらになって砕ける
    burst(e.x, e.y - 8, Math.round(40 * k), [...PRISM, '#ffffff'], { sp: 130 * k, g: 180, glow: true, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 70, '#d88aff', 0.5); shake(3); AudioMan.chime(); AudioMan.thud(); }
  } else if (e.obj === 'tentacle') { // 触手: ちぎれて海に沈む
    burst(e.x, e.y - 8, Math.round(30 * k), ['#a8486a', '#d86a8a', '#5a2a4a', '#bff4ff'], { sp: 100 * k, g: 220, life: 0.6 });
    burst(e.x, e.y, Math.round(14 * k), SPLASH, { sp: 70 * k, up: 40, g: 200 });
    if (broken) { addFlash(e.x, e.y, 60, '#7ad7ff', 0.4); shake(3); AudioMan.splat(); AudioMan.splash(); }
  } else if (e.obj === 'sandglass') { // 砂時計: 割れると死神が 1.5秒ひるむ
    burst(e.x, e.y - 8, Math.round(36 * k), ['#e8c88a', '#c29bff', '#d8c8ff', '#ffffff'], { sp: 120 * k, g: 200, glow: true, life: 0.6 });
    if (broken && !e.owner.dead) { e.owner.stun = 1.5; addFlash(e.x, e.y, 70, '#c29bff', 0.5); shake(5); AudioMan.chime(); AudioMan.thud(); UI.announce('砂時計が割れた!', '死神がひるんでいる'); }
  } else if (e.obj === 'doom') { // 終刻の時計: 壊すと死神が 3秒ひるむ。壊せないまま時間が来ると、時が巻き戻る
    burst(e.x, e.y - 10, Math.round(60 * k), ['#ff3b5c', '#c8a050', '#e8e0d0', '#1a0a14'], { sp: 160 * k, g: 200, glow: true, life: 0.8 });
    if (broken && !e.owner.dead) { e.owner.stun = 3; addFlash(e.x, e.y, 120, '#ff3b5c', 0.7); hitstop(0.1); shake(12); shockAt(e.x, e.y, 2.4, 0.7); AudioMan.crush(); AudioMan.knell(); UI.announce('終刻の時計が砕けた!', '死神が 3秒ひるむ'); }
    else if (!broken && e.life <= 0) finaleRewind(e.owner);
  } else if (e.obj === 'tomb') { // 氷柱の墓標: 砕けると滑る床も一緒に消える
    burst(e.x, e.y - 12, Math.round(50 * k), [...SNOW, '#ffffff', '#7ab8e8'], { sp: 140 * k, g: 180, glow: true, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 90, '#bff4ff', 0.5); shake(5); AudioMan.chime(); AudioMan.thud(); UI.announce('氷柱が砕けた', '滑る床が消える'); }
  } else if (e.obj === 'biggear') { // 大歯車: 歯と真鍮のかけらが飛び散る
    burst(e.x, e.y, Math.round(50 * k), [...BRASS, '#5a5a6a'], { sp: 150 * k, g: 220, life: 0.7 });
    if (broken) { addFlash(e.x, e.y, 90, '#ffd27a', 0.5); shake(6); AudioMan.crush(); }
  } else if (e.obj === 'iceblock') { // 氷塊: 砕けて氷のかけら
    burst(e.x, e.y - 6, Math.round(30 * k), ['#bff4ff', '#7ad7ff', '#ffffff', '#5a8ab8'], { sp: 110 * k, g: 220, life: 0.6 });
    if (broken) { addFlash(e.x, e.y, 60, '#9fd8ff', 0.4); shake(3); AudioMan.frost(); AudioMan.thud(); }
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
  pqueen: { tp: 3, beam: 3, cageCd: 10, mirror: 8, chain: 5, blink: 6 },
};
const BOSS_ENRAGE = { king: { slam: 6 }, ifrit: { altar: true }, stag: { herd: 4 }, pqueen: { spiral: 3 }, levia: { breath: 4 }, fgiant: { drift: 5 }, squeen: { lance: 3 }, warden: { pendCd: 6 }, reaper: { sum: 7 }, fhour: { cross: 4 } };

function bossAI(e, dt) {
  const ai = e.ai, a = Math.atan2(P.y - e.y, P.x - e.x), dist = Math.sqrt(d2(e.x, e.y, P.x, P.y));
  const slow = (1 - 0.03 * e.frost) * clsEnemySlow(e); // 凍傷 / 時の歪み(移動。攻撃の速さは clsBossRate)
  e.face = P.x < e.x ? -1 : 1;
  if (!ai.enraged && e.hp < e.maxhp * e.enrage) {
    ai.enraged = true; e.spd *= 1.35;
    Object.assign(ai, BOSS_ENRAGE[e.boss] || {});
    UI.announce(e.name.split(' ')[0] + ' が激昂した!!', ''); AudioMan.roar(); shake(8); screenFlash(0.25, '#ff3b5c');
  }
  runLater(ai, dt);
  e.sq = lerp(e.sq, 1, Math.min(1, dt * 6));
  if (ai.wind > 0) {
    ai.wind -= dt;
    e.flash = Math.sin(ai.wind * 40) > 0 ? 0.05 : 0;
    if (ai.chg) { const pa = rand(0, TAU), pr = rand(24, 40); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(['#ff4a8a', '#ffd0f0', '#ffffff']), { glow: true, drag: 0 }); }
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
  }
}

// ---------- 腐肉の王: 突進 / 腐肉の山(壊せる物)/ 王の咆哮(押し出し → 突進)/ 死者の手(足元を追う印)/ 腐肉の噛みつき(出血)/ 激昂: 叩きつけ ----------
function kingAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  // 死者の手: 王の動きとは別に、プレイヤーの足元を追う印を出す(突進中は出さない)
  ai.hands -= dt * R;
  if (ai.hands <= 0 && ai.ph !== 'charge') { ai.hands = ai.enraged ? 4.5 : 6; deadHands(e, ai); }
  if (ai.ph === 'post') { ai.pt -= dt; if (ai.pt <= 0) startKingCharge(e, ai); return; } // 咆哮のあと: 押し出している間は待つ
  if (ai.ph === 'tele') { // 突進の予告: 経路の帯が出て、王が身を沈める
    ai.pt -= dt; e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0; e.sq = 0.85;
    if (ai.pt <= 0) { ai.ph = 'charge'; ai.pt = 0.8; AudioMan.roar(); shake(4); }
    return;
  }
  if (ai.ph === 'charge') { // 突進: 体当たり ×1.0(接触のダメージ)。土と腐肉をまき散らす
    ai.pt -= dt;
    e.x += Math.cos(ai.dir) * 330 * dt; e.y += Math.sin(ai.dir) * 330 * dt;
    part(e.x + rand(-8, 8), e.y + 10, rand(-20, 20), rand(-30, 0), 0.6, pick(['#7fae4e', '#4a6e30', '#b8d86a', '#5a4030']), { sz: 2 });
    if (ai.pt <= 0) { ai.ph = 'chase'; ai.atk = ai.enraged ? 3.6 : 5.2; }
    return;
  }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  ai.atk -= dt * R; ai.mound -= dt * R; ai.roar -= dt * R; ai.bite -= dt * R;
  if (ai.enraged) ai.slam -= dt * R;
  if (ai.roar <= 0) { // 王の咆哮: 周りを押し出し、そのまま突進へつなぐ
    ai.roar = ai.enraged ? 6 : 8;
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 90, t: 0, life: 0.7, track: w => { w.x = e.x; w.y = e.y; } });
    e.sq = 1.25; AudioMan.charge(0.7);
    windup(e, 0.7, () => {
      const R0 = 90 * CHAOS.area, inside = d2(e.x, e.y, P.x, P.y) < (R0 + 3) * (R0 + 3);
      hitCircle(e.x, e.y, 90, e.dmg * 0.4);
      if (inside) pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 70, 0.3);
      AudioMan.roar(); AudioMan.boom(); shake(9); shockAt(e.x, e.y, 2, 0.7); e.sq = 0.7;
      addRing(e.x, e.y, R0, '#b8d86a', { w: 3, life: 0.45 }); addRing(e.x, e.y, R0 * 0.6, '#ffffff', { w: 2, life: 0.35 });
      for (let i = 0; i < 40; i++) { const pa = TAU / 40 * i; part(e.x, e.y, Math.cos(pa) * R0 * 2.4, Math.sin(pa) * R0 * 2.4, 0.4, pick(['#7fae4e', '#b8d86a', '#d8ff9a']), { drag: 4, sz: 2 }); } // 腐った息の波
      hint('roar', '王の咆哮', '押し出される。回避の無敵なら押されない');
      ai.ph = 'post'; ai.pt = 0.3; // 押し出しが終わると突進
    });
  } else if (ai.atk <= 0) startKingCharge(e, ai);
  else if (ai.mound <= 0) { // 腐肉の山: 肉塊を吐き出して地面に据える(同時 2個まで)
    if (enemies.filter(o => o.owner === e && o.obj === 'meat' && !o.dead).length >= 2) { ai.mound = 3; return; }
    ai.mound = 14; e.sq = 1.3; AudioMan.charge(0.6);
    windup(e, 0.6, () => {
      const ma = rand(0, TAU), md = rand(80, 120), tx = e.x + Math.cos(ma) * md, ty = e.y + Math.sin(ma) * md;
      e.sq = 0.7; AudioMan.splat();
      burst(e.x, e.y - 8, 16, ['#7fae4e', '#c2483a', '#3a1a14'], { sp: 80, g: 160 });
      lob('gore', e.x, e.y - 10, tx, ty, 0.7, 50, p => {
        spawnObj(e, 'meat', p.x, p.y, { pct: 0.03, r: 8, life: 15, spawnT: 1.5 });
        burst(p.x, p.y, 24, ['#7fae4e', '#c2483a', '#3a1a14', '#b8d86a'], { sp: 90, g: 200 }); shockAt(p.x, p.y, 0.8, 0.9); AudioMan.splat();
        hint('meat', '腐肉の山', 'ゾンビが湧き続ける。壊すと止まる');
      });
    });
  } else if (ai.bite <= 0 && dist < 50) { // 腐肉の噛みつき: 前方の扇。当たると出血
    ai.bite = ai.enraged ? 4 : 6;
    const ba = a;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a: ba, r: 45, h: 0.873, t: 0, life: 0.4 });
    windup(e, 0.4, () => {
      const R0 = 45 * CHAOS.area;
      for (const f of [0, 1]) slashes.push({ x: e.x, y: e.y, a: ba, r: R0, t: 0, life: 0.22, flip: f, span: 1.75, pal: SWING_PAL.enemy, enemy: true }); // 上下から閉じる顎
      if (hitFan(e.x, e.y, ba, 45, 0.873, e.dmg * 0.9)) { bleedPlayer(2); hint('bite', '腐肉の噛みつき', '出血: 5秒受けなければ消える'); }
      AudioMan.slash(); AudioMan.thud(); shake(3);
      burst(e.x + Math.cos(ba) * R0 * 0.6, e.y + Math.sin(ba) * R0 * 0.6, 12, ['#c2483a', '#7a2a20', '#e8e0c0'], { sp: 70, g: 160 });
    });
  } else if (ai.enraged && ai.slam <= 0) { // 叩きつけ(激昂): 範囲 + 全周の弾
    ai.slam = 7;
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 70, t: 0, life: 1 });
    e.sq = 1.3;
    windup(e, 1, () => {
      hitCircle(e.x, e.y, 70, e.dmg * 1.2);
      for (let i = 0; i < 14; i++) eball(e.x, e.y, TAU / 14 * i, 55, e.dmg * 0.55);
      shockAt(e.x, e.y, 1.8, 0.8); shake(10); AudioMan.boom(); e.sq = 0.6;
      burst(e.x, e.y, 50, ['#7fae4e', '#b8d86a', '#3a1a14'], { sp: 150, g: 200 });
    });
  }
}
function startKingCharge(e, ai) {
  const a = Math.atan2(P.y - e.y, P.x - e.x);
  ai.ph = 'tele'; ai.pt = 0.8; ai.dir = a;
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 260, w: e.r * 2, t: 0, life: 0.8, fixed: true }); // 突進の経路(体当たりなので広げない)
}
// 死者の手: 印がプレイヤーの足元を 1.2秒追って止まり、0.3秒後に地面から手が突き出る
function deadHands(e, ai) {
  const w = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: 18, t: 0, life: 1.5 }, 1.2, 50);
  pushWarn(w);
  bfx.push({ kind: 'grave', x: w.x, y: w.y, t: 0, life: 1.5, track: f => { f.x = w.x; f.y = w.y; } }); // 印の中で土がうごめく
  AudioMan.charge(1.2);
  hint('hands', '死者の手', '足元の印が追ってくる。止まると地面から手が出る');
  later(ai, 1.5, () => {
    hitCircle(w.x, w.y, 18, e.dmg * 0.8);
    bfx.push({ kind: 'hands', x: w.x, y: w.y, r: 18 * CHAOS.area, t: 0, life: 0.7, seed: (Math.random() * 1e6) | 0 });
    burst(w.x, w.y, 22, ['#5a4030', '#3a2a1a', '#e8e0c0', '#7fae4e'], { sp: 90, g: 220 });
    shockAt(w.x, w.y, 0.8, 0.9); shake(4); AudioMan.thud();
  });
}

// ---------- 白骨竜: 肋骨の魔弾(撃ち続ける骨柱 → 螺旋)/ 狙い撃ち(頭が光る)/ 尾の薙ぎ払い(回る帯)/ 骨槍(追う帯)/ 弓兵召喚 ----------
function wyrmAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'tail') { // 尾の薙ぎ払い: 0.8秒の予告(止まって身構える)→ 同じ軌道を 0.4秒で薙ぐ
    const tl = ai.tl;
    tl.t += dt;
    if (tl.t < 0.8) { e.sq = 1.1; return; }
    const k = Math.min(1, (tl.t - 0.8) / 0.4), ang = tl.a0 + tl.dir * Math.PI * k, L = 130 * CHAOS.area;
    if (!tl.swung) {
      tl.swung = true; AudioMan.slash(); AudioMan.dash(); shake(3);
      slashes.push({ x: e.x, y: e.y, a: tl.a0 + tl.dir * Math.PI / 2, r: L, t: 0, life: 0.5, flip: tl.dir < 0 ? 1 : 0, span: Math.PI, pal: SWING_PAL.enemy, enemy: true });
    }
    hitLine(e.x, e.y, ang, 130, 20, e.dmg * 1.1);
    for (let i = 0; i < 2; i++) { const r = rand(0.5, 1) * L; part(e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r, rand(-20, 20), -rand(10, 40), 0.4, pick(['#c8b8a0', '#8a8676', '#efe9d4']), { g: 120 }); } // 尾が地面を擦る土煙
    if (k >= 1) { ai.act = null; shake(4); AudioMan.thud(); }
    return;
  }
  // 距離 110 を保ちながら横へ回り込む
  const want = 110, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 22) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 22) * slow * dt;
  if (ai.spN > 0 && (ai.spGap -= dt * R) <= 0) { // 螺旋(肋骨の魔弾の直後だけ): 反対向きに 2発ずつ回しながら
    ai.spGap = ai.enraged ? 0.09 : 0.12; ai.spN--; ai.spA += 0.5;
    for (const o of [0, Math.PI]) eball(e.x, e.y - 4, ai.spA + o, 60, e.dmg * 0.5);
    if (ai.spN % 4 === 0) AudioMan.shoot();
  }
  if (ai.aiming > 0 && (ai.aiming -= dt) <= 0) { // 狙い撃ち: 頭が光ったあと 3発の扇
    for (let i = -1; i <= 1; i++) eball(e.x, e.y - 8, a + i * 0.22, 78, e.dmg * 0.6);
    AudioMan.shoot(); burst(e.x + Math.cos(a) * 8, e.y - 8 + Math.sin(a) * 8, 8, ['#6ee7ff', '#efe9d4', '#ffffff'], { sp: 60, glow: true, life: 0.25 });
  }
  ai.shield -= dt * R; ai.aim -= dt * R; ai.tail -= dt * R; ai.spear -= dt * R; ai.sum -= dt * R;
  if (ai.shield <= 0) { ai.shield = ai.enraged ? 12 : 16; ribShield(e, ai); }
  if (ai.aim <= 0 && !(ai.aiming > 0)) { ai.aim = ai.enraged ? 1.8 : 2.2; ai.aiming = 0.3; }
  if (ai.tail <= 0 && dist < 150) { ai.tail = ai.enraged ? 4.5 : 6; startTail(e, ai, a); return; }
  if (ai.spear <= 0) { ai.spear = ai.enraged ? 4 : 5; boneSpear(e, ai); }
  if (ai.sum <= 0) { // 弓兵召喚: 骨の砂ぼこりから弓兵 3体
    ai.sum = 11;
    for (let i = 0; i < 3; i++) { const sa = TAU / 3 * i + rand(-0.4, 0.4), s = spawnEnemy('archer', { x: e.x + Math.cos(sa) * 24, y: e.y + Math.sin(sa) * 24 }); burst(s.x, s.y, 12, ['#efe9d4', '#8a8676', '#5a4030'], { sp: 60, g: 150 }); }
    AudioMan.summon();
  }
}
// 肋骨の魔弾: プレイヤーの周り 半径 80 に骨柱 4本(HP 各 5%・10秒)。骨柱はプレイヤーへ弾を撃ち続ける(最初の1発は 1 / 1.5 / 2 / 2.5秒後とずらす)。立った直後に螺旋
function ribShield(e, ai) {
  const a0 = rand(0, TAU), pts = [0, 1, 2, 3].map(i => ({ x: P.x + Math.cos(a0 + i * Math.PI / 2) * 80, y: P.y + Math.sin(a0 + i * Math.PI / 2) * 80 }));
  for (const p of pts) pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 6, t: 0, life: 0.8, fixed: true }); // 骨柱が立つ場所(攻撃ではないので広げない)
  AudioMan.charge(0.8);
  later(ai, 0.8, () => {
    pts.forEach((p, i) => {
      spawnObj(e, 'pillar', p.x, p.y, { pct: 0.05, r: 6, life: 10, spawnT: 1 + i * 0.5 });
      burst(p.x, p.y, 18, ['#efe9d4', '#8a8676', '#5a4030', '#6ee7ff'], { sp: 90, g: 220 }); shockAt(p.x, p.y, 0.6, 0.9);
    });
    shake(6); AudioMan.thud(); AudioMan.boom();
    ai.spN = Math.round((ai.enraged ? 4 : 3) / (ai.enraged ? 0.09 : 0.12)); ai.spGap = 0.25; ai.spA = rand(0, TAU);
    hint('ribs', '肋骨の魔弾', '骨柱は弾を撃ち続ける。壊して止めよう');
  });
}
// 尾の薙ぎ払い: 尾の帯(長さ 130・幅 20)が 0.8秒かけて 180° 回りながら薙ぐ範囲を示す
function startTail(e, ai, a) {
  const dir = Math.random() < 0.5 ? 1 : -1, a0 = a - dir * Math.PI / 2;
  ai.act = 'tail'; ai.tl = { t: 0, a0, dir };
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a: a0, r: 140, h: 0.001, t: 0, life: 1.2, noFill: true, track: w => { const k = Math.min(1, w.t / 0.8); w.h = Math.max(0.001, Math.PI * k / 2); w.a = a0 + dir * w.h; } });
  pushWarn({ kind: 'line', x: e.x, y: e.y, a: a0, len: 130, w: 20, t: 0, life: 0.8, track: w => { w.a = a0 + dir * Math.PI * Math.min(1, w.t / 0.8); } });
  AudioMan.charge(0.8);
}
// 骨槍: 竜からプレイヤーへの帯が 1.0秒追い、0.3秒止まってから、帯の長さだけ飛ぶ骨槍(貫通)。3本(±0.2rad)、激昂は 5本(±0.2rad の中に 0.1rad おき)
function boneSpear(e, ai) {
  const offs = ai.enraged ? [-0.2, -0.1, 0, 0.1, 0.2] : [-0.2, 0, 0.2];
  const ws = offs.map(o => {
    const w = { kind: 'line', x: e.x, y: e.y, a: Math.atan2(P.y - e.y, P.x - e.x) + o, len: 260, w: 8, t: 0, life: 1.3, track: q => { q.x = e.x; q.y = e.y; if (q.t < 1) q.a = Math.atan2(P.y - e.y, P.x - e.x) + o; } };
    pushWarn(w);
    return w;
  });
  AudioMan.charge(1.3);
  later(ai, 1.3, () => {
    const len = 260 * CHAOS.area, spd = 280;
    for (const w of ws) eprojs.push({ kind: 'bspear', x: e.x, y: e.y, vx: Math.cos(w.a) * spd, vy: Math.sin(w.a) * spd, dmg: e.dmg * 1.2 * (S.eatk ?? 1), life: len / spd, t: 0, r: 4 * CHAOS.area, keep: true });
    AudioMan.spearThrow(); shake(3);
    burst(e.x, e.y, 14, ['#efe9d4', '#6ee7ff', '#ffffff'], { sp: 90, glow: true, life: 0.3 });
  });
}

// ---------- 巨大スライム: 跳ねて接近し粘液床 / スライム召喚 → 吸収 / 大跳躍(落下点が追う)/ 弾み体当たり / 粘液弾 / 激昂: 分裂 ----------
function gslimeAI(e, ai, dt, a, dist, slow) {
  if (!ai.split0 && !ai.act && e.hp < e.maxhp * 0.5) { ai.split0 = true; startSplit(e, ai); return; } // 分裂: 残りHP 50% で1回(血の夜明けでも HP で決める)
  if (ai.act === 'split0' || ai.act === 'split' || ai.act === 'reform') { updSplit(e, ai, dt); return; }
  if (ai.act === 'leap') { // 大跳躍: 高く跳び、プレイヤーを追う落下点(着地の 0.35秒前に止まる)へ落ちる
    const s = ai.st, w = s.w;
    s.t += dt;
    const k = Math.min(1, s.t / s.T);
    e.x = lerp(s.x0, w.x, k); e.y = lerp(s.y0, w.y, k);
    e.jz = Math.sin(k * Math.PI) * 80; e.air = k < 0.92;
    if (k > 0.75 && !s.fall) { s.fall = true; AudioMan.dash(); } // 落ちてくる風切り
    if (k < 1) return;
    ai.act = null; e.jz = 0; e.air = false; e.sq = 0.45; ai.cd = ai.enraged ? 2 : 3;
    hitCircle(e.x, e.y, 44, e.dmg * 1.3);
    addHazard('goo', e.x, e.y, { r: 30, dur: 8 });
    const R0 = 44 * CHAOS.area;
    shockAt(e.x, e.y, 2, 0.75); shake(11); AudioMan.boom(); AudioMan.splat(); hitstop(0.05);
    addRing(e.x, e.y, R0, '#d8fff2', { w: 3, life: 0.4 }); addRing(e.x, e.y, R0 * 1.4, '#4fd6a8', { w: 2, life: 0.55 });
    burst(e.x, e.y, 50, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 160, g: 220 });
    for (let i = 0; i < 24; i++) { const pa = TAU / 24 * i; part(e.x + Math.cos(pa) * 10, e.y + Math.sin(pa) * 6, Math.cos(pa) * R0 * 2.2, Math.sin(pa) * R0 * 1.6, 0.4, pick(['#4fd6a8', '#8affd8']), { drag: 5, sz: 2 }); } // 飛び散る粘液の輪
    return;
  }
  if (ai.act === 'bounce') { // 弾み体当たり: 線上の 3点を 0.25秒おきに順に跳ねて着地
    const b = ai.bn;
    b.t += dt;
    const k = Math.min(1, b.t / 0.25), p = b.pts[b.i];
    e.x = lerp(b.fx, p.x, k); e.y = lerp(b.fy, p.y, k); e.jz = Math.sin(k * Math.PI) * 22; e.air = k < 0.85;
    if (k < 1) return;
    e.jz = 0; e.air = false; e.sq = 0.6;
    hitCircle(p.x, p.y, 26, e.dmg * 0.8);
    addHazard('goo', p.x, p.y, { r: 17, dur: 7 });
    shockAt(p.x, p.y, 0.9, 0.85); shake(5); AudioMan.splat();
    burst(p.x, p.y, 18, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 100, g: 200 });
    addRing(p.x, p.y, 26 * CHAOS.area, '#d8fff2', { w: 2, life: 0.3 });
    if (++b.i >= b.pts.length) { ai.act = null; ai.cd = ai.enraged ? 2.2 : 3.2; return; }
    b.t = 0; b.fx = p.x; b.fy = p.y;
    return;
  }
  // 跳ねながら接近。着地点に粘液を残す
  ai.hop -= dt * CHAOS.rate;
  const air = ai.hop < 0.5;
  e.jz = air ? Math.sin(ai.hop / 0.5 * Math.PI) * 7 : 0;
  e.air = e.jz > 3;
  if (air) { e.x += Math.cos(a) * e.spd * 2.6 * slow * dt; e.y += Math.sin(a) * e.spd * 2.6 * slow * dt; }
  if (ai.hop <= 0) {
    ai.hop = ai.enraged ? 1.0 : 1.3; e.sq = 0.75;
    if (ai.enraged || Math.random() < 0.4) addHazard('goo', e.x, e.y + 4, { r: 14, dur: 6 });
  }
  ai.cd -= dt * CHAOS.rate; ai.sum -= dt * CHAOS.rate;
  if (ai.cd > 0 || air) return;
  ai.cd = ai.enraged ? 2.2 : 3.2;
  if (ai.sum <= 0) slimeSummon(e, ai); // スライム召喚(4秒後に 50% で吸収)
  else if (dist < 150 && Math.random() < 0.35) slimeLeap(e, ai); // 大跳躍: 落下点がプレイヤーを追う
  else if (dist < 150 && Math.random() < 0.25) slimeBounce(e, ai, a); // 弾み体当たり: プレイヤーへ向かう線上の 3点に跳ねて着地
  else { // 粘液弾: プレイヤー周辺へ放物線で撒き、着弾点に粘液床
    e.sq = 1.3;
    windup(e, 0.5, () => {
      const n = ai.enraged ? 8 : 5;
      for (let i = 0; i < n; i++) {
        const tx = P.x + (i ? rand(-55, 55) : 0), ty = P.y + (i ? rand(-45, 45) : 0), T = 0.9 + i * 0.06;
        pushWarn({ kind: 'circle', x: tx, y: ty, r: 14, t: 0, life: T });
        lob('glob', e.x, e.y - 6, tx, ty, T, 40, p => {
          hitCircle(p.x, p.y, 14, e.dmg * 0.7);
          addHazard('goo', p.x, p.y, { r: 17, dur: 7 });
          burst(p.x, p.y, 10, ['#4fd6a8', '#d8fff2'], { sp: 60 }); AudioMan.splat();
        });
      }
      e.sq = 0.7; AudioMan.fire();
    });
  }
}

function slimeSummon(e, ai) {
  ai.sum = 12; e.sq = 1.3;
  const n = ai.enraged ? 6 : 4, list = [];
  for (let i = 0; i < n; i++) list.push(spawnEnemy('slime', { x: e.x + Math.cos(TAU / n * i) * 22, y: e.y + Math.sin(TAU / n * i) * 22 }));
  burst(e.x, e.y, 30, ['#4fd6a8', '#d8fff2'], { sp: 110 }); AudioMan.splat();
  later(ai, 4, () => { if (Math.random() < 0.5 && !ai.act) startAbsorb(e, list); });
}
function slimeLeap(e, ai) {
  const w = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: 44, t: 0, life: 1.65 }, 1.3, 50);
  pushWarn(w);
  ai.act = 'leap'; ai.st = { t: 0, T: 1.65, x0: e.x, y0: e.y, w };
  e.sq = 0.6; AudioMan.dash(); shake(3);
  burst(e.x, e.y + 6, 20, ['#4fd6a8', '#d8fff2'], { sp: 90, up: 40 });
  hint('leap', '大跳躍', '落下点が追ってくる。最後に止まったら離れろ');
}
function slimeBounce(e, ai, a) {
  const pts = [1, 2, 3].map(i => ({ x: e.x + Math.cos(a) * 70 * i, y: e.y + Math.sin(a) * 70 * i }));
  pts.forEach((p, i) => pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 26, t: 0, life: 0.6 + 0.25 * (i + 1) }));
  e.sq = 1.3;
  windup(e, 0.6, () => { ai.act = 'bounce'; ai.bn = { i: 0, t: 0, pts, fx: e.x, fy: e.y }; AudioMan.dash(); });
}
// 吸収: 召喚したスライムを光の線で結び、3秒かけて本体へ引き寄せる(速さ 60)。吸った1体につき 最大HP 3% 回復
function startAbsorb(e, list) {
  const alive = list.filter(s => !s.dead);
  if (!alive.length || e.dead) return;
  for (const s of alive) { s.pulled = e; s.pullT = S.time + 3; }
  e.sq = 1.25; AudioMan.charge(1);
  hint('absorb', '吸収', '光の線につながったスライムを倒せ。吸われると回復される');
}
function slimeAbsorbed(b, s) {
  s.dead = true; s.pulled = null; // 吸われた(倒した扱いにしない)
  const n = b.maxhp * 0.03;
  b.hp = Math.min(b.maxhp, b.hp + n); S.hudDirty = true;
  addFloat(b.x, b.y - 18, '+' + Math.round(n), '#5dff8a', 1);
  burst(s.x, s.y, 14, ['#4fd6a8', '#d8fff2', '#5dff8a'], { sp: 60, glow: true });
  addRing(b.x, b.y, b.r + 8, '#5dff8a', { w: 2, life: 0.35 }); b.sq = 1.2;
  AudioMan.splat(); AudioMan.heal();
}
// 分裂: 1秒縮み、中スライム 2体(HP 各 8%・半径 9・接触 ×0.6・跳ねて追う)に分かれて 12秒。本体は動かず受けるダメージ ×0.4
//   2体を倒すか 12秒で元に戻り、戻る位置に 円 半径 40 ×1.0(予告 0.8秒)
function startSplit(e, ai) {
  ai.act = 'split0'; ai.pt = 1; ai.r0 = e.r;
  AudioMan.charge(1); shake(4);
  hint('split', '分裂', '中スライムを倒すと元に戻る。分かれている間、本体は硬い');
}
function updSplit(e, ai, dt) {
  ai.pt -= dt;
  if (ai.act === 'split0') { // 縮んで震える
    const k = 1 - Math.max(0, ai.pt);
    e.scale = 1 - 0.45 * k; e.sq = 1 + Math.sin(k * 40) * 0.1 * (1 - k); e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0;
    if (Math.random() < dt * 30) part(e.x + rand(-10, 10), e.y + rand(-6, 6), rand(-20, 20), rand(-30, -5), 0.5, pick(['#4fd6a8', '#d8fff2']), { g: 120 });
    if (ai.pt > 0) return;
    ai.act = 'split'; ai.pt = 12; e.takeK = 0.4; e.air = true; e.r = Math.max(6, Math.round(ai.r0 * 0.55));
    ai.mids = [-1, 1].map(s => {
      const m = spawnEnemy('slime', { x: e.x + s * 16, y: e.y + 4 });
      Object.assign(m, { hp: e.maxhp * 0.08, maxhp: e.maxhp * 0.08, r: 9, scale: 1.8, dmg: e.dmg * 0.6, xp: 0, owner: e, noChest: true, kbRes: 0.9 });
      m.kx = s * 140; // 左右へ弾け飛ぶ
      return m;
    });
    burst(e.x, e.y, 46, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 150, g: 160 }); shockAt(e.x, e.y, 1.5, 0.8); shake(8); AudioMan.splat(); AudioMan.boom();
    addRing(e.x, e.y, 30, '#d8fff2', { w: 2, life: 0.4 });
    return;
  }
  if (ai.act === 'split') { // 分かれている間: 2体を倒すか、12秒たつと戻る(残った中スライムは本体へ溶けて戻る)
    if (ai.mids.every(m => m.dead) || ai.pt <= 0) {
      for (const m of ai.mids) if (!m.dead) { m.dead = true; burst(m.x, m.y, 16, ['#4fd6a8', '#d8fff2'], { sp: 70 }); }
      ai.act = 'reform'; ai.pt = 0.8;
      pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 40, t: 0, life: 0.8 });
      AudioMan.charge(0.8);
    }
    return;
  }
  e.scale = 0.55 + 0.45 * (1 - Math.max(0, ai.pt) / 0.8); // 戻る: 膨らんで、戻った瞬間に周りを潰す
  if (ai.pt > 0) return;
  ai.act = null; e.takeK = 1; e.air = false; e.r = ai.r0; e.scale = 1; e.sq = 0.5; ai.cd = ai.enraged ? 2.2 : 3.2;
  hitCircle(e.x, e.y, 40, e.dmg);
  const R0 = 40 * CHAOS.area;
  shockAt(e.x, e.y, 1.8, 0.75); shake(10); AudioMan.boom(); AudioMan.splat();
  addRing(e.x, e.y, R0, '#d8fff2', { w: 3, life: 0.4 });
  burst(e.x, e.y, 40, ['#4fd6a8', '#d8fff2', '#23735f'], { sp: 150, g: 200 });
}

// ---------- ゴーレム: 地割れ(伸びる帯)/ 岩投げ / 岩の散弾 / 両腕回転 / ストンプ(衝撃波で押し出す)/ 岩の鎧(DPSチェック) ----------
function golemAI(e, ai, dt, a, dist, slow) {
  if (ai.overT > 0) { // 全速(岩の鎧を削れなかった): 速さ ×1.4・技の間隔 ×0.7。赤い蒸気を噴く
    ai.overT -= dt;
    if (Math.random() < dt * 24) part(e.x + rand(-10, 10), e.y - rand(4, 16), rand(-10, 10), -rand(20, 50), rand(0.4, 0.7), pick(['#ff6a2a', '#ff3b1a', '#8a8676']), { glow: Math.random() < 0.5, drag: 1 });
    if (ai.overT <= 0) { e.spd /= 1.4; burst(e.x, e.y, 16, ['#8a8676', '#c8b8a0'], { sp: 60 }); }
  }
  if (!ai.act) for (const th of [0.6, 0.25]) if (!ai['arm' + th] && e.hp < e.maxhp * th) { ai['arm' + th] = true; startArmor(e, ai); return; } // 岩の鎧: 残りHP 60% と 25% で1回ずつ
  if (ai.act === 'armor' || ai.act === 'stagger') { updArmor(e, ai, dt); return; }
  if (ai.act === 'spin') {
    ai.pt -= dt; ai.spinA += (ai.enraged ? 9 : 7) * dt;
    e.x += Math.cos(a) * e.spd * 1.5 * slow * dt; e.y += Math.sin(a) * e.spd * 1.5 * slow * dt;
    const FR = 30 * CHAOS.area; // 腕の長さも攻撃範囲の倍率で伸ばす(拳の判定 7 と同じ倍率。予告の円との比は倍率 1 のときと同じ)
    e.fists = [0, 1].map(i => { const fa = ai.spinA + Math.PI * i; return { x: e.x + Math.cos(fa) * FR, y: e.y + Math.sin(fa) * FR }; });
    for (const f of e.fists) {
      hitCircle(f.x, f.y, 7, e.dmg);
      if (Math.random() < 0.5) part(f.x, f.y, rand(-20, 20), rand(-20, 20), 0.4, pick(['#a89e8c', '#6ee7ff']), { glow: true });
    }
    ai.snd = (ai.snd || 0) - dt;
    if (ai.snd <= 0) { ai.snd = 0.28; AudioMan.slash(); }
    if (ai.pt <= 0) { ai.act = null; e.fists = null; ai.cd = ai.enraged ? 1.4 : 2.2; }
    return;
  }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  const R = CHAOS.rate / (ai.overT > 0 ? 0.7 : 1);
  ai.cd -= dt * R; ai.spinCd -= dt * R;
  if (ai.cd > 0) return;
  ai.cd = ai.enraged ? 1.8 : 2.6;
  const r = Math.random();
  if (dist > 95) { if (r < 0.9) golemThrow(e, ai); else fissure(e, ai, a); } // 遠い: 岩投げ 90% / 地割れ 10%
  else if (ai.spinCd <= 0 && r < 0.35) { // 両腕を回し続けながら追ってくる
    ai.spinCd = 10;
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 34, t: 0, life: 0.6 });
    windup(e, 0.6, () => { ai.act = 'spin'; ai.pt = ai.enraged ? 4.5 : 3.5; ai.spinA = a; AudioMan.roar(); });
  } else if (r < 0.6) fissure(e, ai, a); // 地割れ 25%(両腕回転が使えないときはその分も)
  else if (r < 0.8) rockScatter(e, ai, a); // 岩の散弾 20%
  else { // ストンプ 20%: 周囲に範囲ダメージ + 外へ広がる衝撃波(触れると押し出す)
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 58, t: 0, life: 1 });
    windup(e, 1, () => {
      hitCircle(e.x, e.y, 58, e.dmg * 1.3);
      addHazard('quake', e.x, e.y, { r: 58, spd: 100, max: 170, dur: 9, dmg: e.dmg * 0.8, push: 40 });
      if (ai.enraged) later(ai, 0.45, () => addHazard('quake', e.x, e.y, { r: 20, spd: 100, max: 170, dur: 9, dmg: e.dmg * 0.8, push: 40 }));
      burst(e.x, e.y, 50, ['#a89e8c', '#6a6258', '#6ee7ff'], { sp: 160, g: 220 });
      shockAt(e.x, e.y, 2, 0.8); shake(11); AudioMan.boom();
    });
  }
}
function golemThrow(e, ai) {
  e.hold = true;
  windup(e, 0.7, () => {
    e.hold = false;
    const n = ai.enraged ? 3 : 1;
    for (let i = 0; i < n; i++) later(ai, i * 0.35, () => {
      const tx = P.x + (i ? rand(-45, 45) : 0), ty = P.y + (i ? rand(-40, 40) : 0), T = 1.1;
      pushWarn({ kind: 'circle', x: tx, y: ty, r: 24, t: 0, life: T });
      lob('rock', e.x, e.y - 16, tx, ty, T, 70, p => {
        hitCircle(p.x, p.y, 24, e.dmg * 1.1);
        burst(p.x, p.y, 30, ['#a89e8c', '#6a6258', '#3a3530'], { sp: 120, g: 220 });
        shockAt(p.x, p.y, 1, 0.9); shake(6); AudioMan.boom();
      });
      AudioMan.dash();
    });
  });
}
// 地割れ: ゴーレムからプレイヤーへ帯(幅 22)が毎秒 300 で 260 まで伸び、伸び切って 0.2秒後に帯の全体に ×1.3。激昂は 2本(±25°)
function fissure(e, ai, a) {
  const angs = ai.enraged ? [a - 0.436, a + 0.436] : [a], L = 260, T = L / 300, x0 = e.x, y0 = e.y + 4;
  for (const fa of angs) {
    pushWarn({ kind: 'line', x: x0, y: y0, a: fa, len: 1, w: 22, t: 0, life: T + 0.2, track: q => { q.len = Math.max(1, Math.min(L, 300 * q.t)) * CHAOS.area; } });
    bfx.push({ kind: 'crack', x: x0, y: y0, a: fa, len: L * CHAOS.area, w: 22 * CHAOS.area, T, t: 0, life: T + 0.9, seed: (Math.random() * 1e6) | 0 });
  }
  e.sq = 1.2; AudioMan.charge(T + 0.2); shake(3);
  hint('fissure', '地割れ', '地面の裂け目は前へ伸びる。横へ逃げろ');
  windup(e, T + 0.2, () => {
    for (const fa of angs) {
      hitLine(x0, y0, fa, L, 22, e.dmg * 1.3);
      for (let d = 10; d < L * CHAOS.area; d += 8) burst(x0 + Math.cos(fa) * d, y0 + Math.sin(fa) * d, 2, ['#a89e8c', '#6a6258', '#3a3530', '#ffb347'], { sp: 70, up: 70, g: 260, life: 0.6 }); // 帯に沿って岩が噴き上がる
    }
    shake(10); AudioMan.boom(); AudioMan.crush(); shockAt(x0 + Math.cos(angs[0]) * 60, y0 + Math.sin(angs[0]) * 60, 1.4, 0.8);
    e.sq = 0.7;
  });
}
// 岩の散弾: 0.5秒構え(前方の扇)、プレイヤーへ扇状に岩の破片 7発
function rockScatter(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 150, h: 0.5, t: 0, life: 0.5 });
  e.sq = 1.25;
  windup(e, 0.5, () => {
    for (let i = 0; i < 7; i++) eball(e.x + Math.cos(a) * 8, e.y - 4 + Math.sin(a) * 8, a - 0.5 + i / 6, 90, e.dmg * 0.5, 'rbit');
    burst(e.x + Math.cos(a) * 10, e.y + Math.sin(a) * 10, 20, ['#a89e8c', '#6a6258', '#3a3530'], { sp: 120, g: 160 });
    AudioMan.boom(); shake(5); e.sq = 0.75;
  });
}
// 岩の鎧: 4秒 動かず受けるダメージ ×0.5。4秒で最大HP の 5% を削ると砕けて 2秒ひるむ(受けるダメージ ×1.5)。削れなければ 10秒 全速
function startArmor(e, ai) {
  ai.act = 'armor'; ai.pt = 4; ai.armHp = e.hp; ai.armK = 0; e.takeK = 0.5; e.fists = null; e.hold = false;
  shake(7); AudioMan.thud(); AudioMan.charge(0.6);
  for (let i = 0; i < 30; i++) { const pa = rand(0, TAU), pr = rand(30, 50); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr, -Math.cos(pa) * pr * 3, -Math.sin(pa) * pr * 3, 0.3, pick(['#544c44', '#7a6f60', '#241f1c']), { drag: 0, sz: 2 }); } // 岩が集まって体を覆う
  hint('armor', '岩の鎧', '4秒で最大HP の 5% を削ると砕ける');
}
function updArmor(e, ai, dt) {
  ai.pt -= dt;
  if (ai.act === 'armor') {
    const need = e.maxhp * 0.05;
    ai.armK = Math.min(1, (ai.armHp - e.hp) / need);
    if (ai.armK >= 1) { // 砕けた: 2秒ひるむ(受けるダメージ ×1.5)
      ai.act = 'stagger'; ai.pt = 2; e.takeK = 1.5;
      burst(e.x, e.y, 70, ['#544c44', '#7a6f60', '#241f1c', '#6ee7ff', '#ffffff'], { sp: 180, g: 260, life: 0.9 });
      hitstop(0.1); shake(14); screenFlash(0.35, '#6ee7ff'); shockAt(e.x, e.y, 2.2, 0.7); AudioMan.crush(); AudioMan.boom();
      addRing(e.x, e.y, 50, '#6ee7ff', { w: 3, life: 0.5 });
      UI.announce('岩の鎧が砕けた!', 'ひるんでいる 2秒は 1.5倍のダメージ');
    } else if (ai.pt <= 0) { // 削れなかった: 10秒 全速(速さ ×1.4・技の間隔 ×0.7)
      ai.act = null; e.takeK = 1; ai.overT = 10; e.spd *= 1.4; ai.cd = 0.6;
      burst(e.x, e.y, 40, ['#ff6a2a', '#ff3b1a', '#8a8676'], { sp: 140, glow: true });
      shake(9); AudioMan.roar(); screenFlash(0.25, '#ff3b1a');
      UI.announce('ゴーレムが全速になった!', '10秒 速さ ×1.4・技の間隔 ×0.7');
    }
    return;
  }
  e.flash = Math.sin(ai.pt * 30) > 0.6 ? 0.04 : 0; // ひるみ: 白く明滅して、頭の上を星が回る
  if (ai.pt <= 0) { ai.act = null; e.takeK = 1; ai.cd = 1; }
}

// ---------- カオスドラゴン: 持続ファイアブレス / 一周ビーム / グランドクロス / 切り裂き / 渦(吸引) ----------
const BEAM_LEN = 260, LUNGE_RANGE = 150, LUNGE_SPD = 420;
function dragonAI(e, ai, dt, a, dist, slow) {
  const endAct = () => { ai.act = null; ai.cd = ai.enraged ? 1.6 : 2.4; };
  if (ai.act === 'breath') { // ゆっくりプレイヤーを追う扇状の炎。当たると炎上
    ai.pt -= dt;
    ai.ba += clamp(angDiff(a, ai.ba), -0.9 * dt, 0.9 * dt);
    const L = 125 * CHAOS.area, H = 0.32, mx = e.x + Math.cos(ai.ba) * 10, my = e.y + Math.sin(ai.ba) * 10;
    for (let i = 0; i < 4; i++) {
      const aa = ai.ba + rand(-H, H), sp = rand(120, 170) * CHAOS.area; // 炎の届く距離 = 当たり判定の長さ L
      part(mx, my, Math.cos(aa) * sp, Math.sin(aa) * sp, rand(0.55, 0.8), pick(['#ff6a2a', '#ffc34a', '#ff4a8a', '#fff6c8']), { glow: true, drag: 0.6, sz: pick([1, 2, 2]) });
    }
    if (dist < L && Math.abs(angDiff(a, ai.ba)) < H + 4 / Math.max(dist, 1)) { hurtPlayer(e.dmg * 0.3); burnPlayer(e.dmg * 0.03); }
    AudioMan.fire();
    if (ai.pt <= 0) endAct();
    return;
  }
  if (ai.act === 'beam') { // 全周を薙ぎ払うビーム(ダッシュの無敵ですり抜ける前提)
    ai.pt += dt;
    const k = ai.pt / ai.T;
    ai.bA = ai.b0 + ai.dir * TAU * Math.min(1, k);
    if (hitLine(e.x, e.y, ai.bA, BEAM_LEN, 10, e.dmg * 1.2)) burnPlayer(e.dmg * 0.03); // 当たると炎上
    const r = rand(20, BEAM_LEN * CHAOS.area);
    part(e.x + Math.cos(ai.bA) * r, e.y + Math.sin(ai.bA) * r, rand(-30, 30), rand(-30, 30), 0.4, pick(['#ff4a8a', '#ffd0f0', '#ffffff']), { glow: true });
    shake(1.5);
    if (k >= 1) { ai.bA = null; endAct(); }
    return;
  }
  if (ai.act === 'lunge') { // 切り裂き: 踏み込んで二連の爪撃(距離に応じて踏み込み時間が伸びる)
    ai.pt -= dt;
    e.x += Math.cos(ai.la) * LUNGE_SPD * dt; e.y += Math.sin(ai.la) * LUNGE_SPD * dt;
    if (ai.pt > 0) return;
    endAct();
    for (let c = 0; c < 2; c++) later(ai, c * 0.14, () => {
      const ca = Math.atan2(P.y - e.y, P.x - e.x), R = 47 * CHAOS.area;
      slashes.push({ x: e.x, y: e.y, a: ai.la, r: R, t: 0, life: 0.22, flip: c % 2, span: 2.2, pal: SWING_PAL.enemy, enemy: true }); // 見た目 = 当たり判定(半径 R・角度 ±1.1)
      if (d2(e.x, e.y, P.x, P.y) < R * R && Math.abs(angDiff(ca, ai.la)) < 1.1) hurtPlayer(e.dmg * 0.6, { pierce: true }); // 2回とも当たる(被弾後の無敵を無視。回避では防げる)
      AudioMan.slash();
    });
    return;
  }
  if (ai.act === 'raid') { updRaid(e, ai, dt); return; }
  if (ai.act === 'gust') { // 翼の暴風: 0.5秒、前方の扇の中にいると竜から 110 押し出される(ダメージなし)
    ai.pt -= dt;
    const H = 1.047, R0 = 140 * CHAOS.area;
    for (let i = 0; i < 5; i++) { const aa = ai.ga + rand(-H, H), r = rand(10, R0), sp = rand(160, 260); part(e.x + Math.cos(aa) * r * 0.3, e.y + Math.sin(aa) * r * 0.3, Math.cos(aa) * sp, Math.sin(aa) * sp, rand(0.25, 0.45), pick(['#ffffff', '#ffd0f0', '#c8b8c0']), { drag: 1, sz: 1 }); } // 吹き抜ける風
    if (!ai.gpushed && inFan(e.x, e.y, ai.ga, 140, H)) ai.gpushed = pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 110, 0.5);
    e.sq = 1 + Math.sin(ai.pt * 40) * 0.08; shake(1.2);
    if (ai.pt <= 0) endAct();
    return;
  }
  // 距離を保って旋回
  const want = 95, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 18) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 18) * slow * dt;
  ai.cd -= dt * CHAOS.rate; ai.beamCd -= dt * CHAOS.rate; ai.raidCd -= dt * CHAOS.rate; ai.gustCd -= dt * CHAOS.rate;
  if (ai.cd > 0) return;
  ai.cd = 99; // 行動終了時に再設定
  if (ai.beamCd <= 0) {
    ai.beamCd = ai.enraged ? 11 : 15;
    ai.b0 = a + Math.PI; ai.dir = Math.random() < 0.5 ? 1 : -1; ai.chg = true;
    pushWarn({ kind: 'line', x: e.x, y: e.y, a: ai.b0, len: BEAM_LEN, w: 10, t: 0, life: 1.3 });
    AudioMan.warning(); AudioMan.charge(1.3);
    if (!S.hint.beam) { S.hint.beam = true; UI.announce('全周ビーム!!', 'ダッシュの無敵ですり抜けろ'); }
    windup(e, 1.3, () => { ai.act = 'beam'; ai.pt = 0; ai.T = ai.enraged ? 2 : 2.4; AudioMan.zap(); shockAt(e.x, e.y, 1, 1); });
  } else if (ai.raidCd <= 0) { // 空襲: 飛び上がり、画面を横切る影が燃える床を残していく
    ai.raidCd = ai.enraged ? 12 : 16;
    startRaid(e, ai);
  } else if (ai.gustCd <= 0) { // 翼の暴風: 前方の扇を押し出す
    ai.gustCd = ai.enraged ? 7 : 10;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 140, h: 1.047, t: 0, life: 0.7 });
    e.sq = 1.25; AudioMan.charge(0.7);
    hint('gust', '翼の暴風', '押し出される(ダメージはない)。燃える床に注意');
    windup(e, 0.7, () => { ai.act = 'gust'; ai.pt = 0.5; ai.ga = a; ai.gpushed = false; AudioMan.roar(); AudioMan.dash(); shockAt(e.x, e.y, 1, 0.9); });
  } else if (dist < LUNGE_RANGE && (dist < 60 || Math.random() < 0.35)) { // 近距離は必ず、中距離は確率で飛びつき
    pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: LUNGE_RANGE + 20, w: 34, t: 0, life: 0.4, fixed: true }); // 踏み込みの経路(爪撃は自分で範囲を描く)
    windup(e, 0.4, () => {
      ai.act = 'lunge'; ai.la = Math.atan2(P.y - e.y, P.x - e.x);
      ai.pt = clamp((Math.sqrt(d2(e.x, e.y, P.x, P.y)) - 14) / LUNGE_SPD, 0.08, (LUNGE_RANGE + 20) / LUNGE_SPD); // プレイヤーの手前まで踏み込む
    });
  } else if (dist < 130 && Math.random() < 0.55) { // 予兆はボスからプレイヤーへ向きを追随
    pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 125, w: 30, t: 0, life: 0.6, track: w => { w.x = e.x; w.y = e.y; w.a = Math.atan2(P.y - e.y, P.x - e.x); } });
    windup(e, 0.6, () => { ai.act = 'breath'; ai.pt = 2.6; ai.ba = Math.atan2(P.y - e.y, P.x - e.x); AudioMan.roar(); });
  } else { // グランドクロス: プレイヤーの位置に十字の光柱(激昂時は続けてX字)
    // 腕の始点は倍率を掛けた長さ LA で決める(十字の中心をプレイヤーの位置に保つ)。予告と判定の len・w は自分で倍率を掛けるので掛ける前の値を渡す
    const tx = P.x, ty = P.y, L = 120, W = 16, T = 1.2, LA = L * CHAOS.area;
    const arms = off => [off, off + Math.PI / 2].map(aa => ({ x: tx - Math.cos(aa) * LA, y: ty - Math.sin(aa) * LA, a: aa }));
    const mark = off => arms(off).forEach(r => pushWarn({ kind: 'line', x: r.x, y: r.y, a: r.a, len: L * 2, w: W, t: 0, life: T }));
    const blast = off => {
      for (const r of arms(off)) {
        if (hitLine(r.x, r.y, r.a, L * 2, W, e.dmg * 1.3)) burnPlayer(e.dmg * 0.03); // 当たると炎上
        slashes.push({ line: true, x: r.x, y: r.y, x1: r.x + Math.cos(r.a) * LA * 2, y1: r.y + Math.sin(r.a) * LA * 2, t: 0, life: 0.45, w: 10 * CHAOS.area, enemy: true });
      }
      addFlash(tx, ty, 160 * CHAOS.area, '#ff4a8a', 0.5); shockAt(tx, ty, 1.6, 0.9); shake(7); AudioMan.boom(); AudioMan.zap();
      burst(tx, ty, 30, ['#ff4a8a', '#ffd0f0', '#ffffff'], { sp: 140, glow: true });
    };
    mark(0); later(ai, T, () => blast(0));
    if (ai.enraged) { later(ai, 0.5, () => mark(Math.PI / 4)); later(ai, 0.5 + T, () => blast(Math.PI / 4)); }
    AudioMan.charge(T);
    endAct();
  }
}

// ---------- 炎魔イフリート: 炎の踏み込み → 炎の鞭(攻めの中心)/ 炎の壁(越えられない)→ 炎の突進 / 灼熱の鎖(引き寄せ → 鞭)/ 爆炎(押し出し)/ 激昂: 炎の祭壇・姿が変わる・踏み込みが 2連続 ----------
//   燃えている祭壇 1つにつき 与ダメージ +10%・技の間隔 ×0.95。炎上は ボスのダメージ × 0.03(カオスドラゴンと同じ)
function ifritAI(e, ai, dt, a, dist, slow) {
  e.jz = 3 + Math.sin(e.t * 3) * 2; // 浮いている
  if (ai.altar) { ai.altar = false; ifritRage(e); fireAltars(e); }
  const nAlt = enemies.filter(o => o.owner === e && o.obj === 'altar' && !o.dead).length;
  e.altK = 1 + 0.1 * nAlt;
  const R = CHAOS.rate / Math.pow(0.95, nAlt);
  const hot = ai.enraged; // 激昂: 炎が白く強くなる
  if (Math.random() < dt * (hot ? 32 : 14)) part(e.x + rand(-8, 8), e.y + 6 + rand(-2, 4), rand(-6, 6), -rand(20, hot ? 70 : 45), rand(0.3, 0.6), pick(hot ? ['#ffc34a', '#fff0b0', '#ffffff', '#ff6a2a'] : ['#ff6a2a', '#ffc34a', '#ff3b1a']), { glow: true, drag: 1 }); // 下半身の炎
  if (hot && Math.random() < dt * 10) { const pa = rand(0, TAU), pr = rand(14, 22); part(e.x + Math.cos(pa) * pr, e.y + Math.sin(pa) * pr * 0.6, 0, -rand(15, 35), 0.5, pick(['#ff6a2a', '#ffc34a']), { glow: true, drag: 1 }); } // 激昂: まわりに火の粉
  if (ai.act === 'lunge') { // 炎の踏み込み: 予告の帯の端まで速さ 420(体当たり ×1.0 = 接触のダメージ)→ 着いたらすぐ炎の鞭
    const step = 420 * dt;
    e.x += Math.cos(ai.la) * step; e.y += Math.sin(ai.la) * step;
    if (hot && (ai.trail += step) >= 14) { ai.trail -= 14; addHazard('fire', e.x, e.y + 4, { r: 10, dur: 3, dmg: e.dmg, lite: 0.5 }); } // 激昂: 跡に燃える床
    for (let i = 0; i < 3; i++) part(e.x + rand(-8, 8), e.y + rand(-6, 8), -Math.cos(ai.la) * 90 + rand(-20, 20), -Math.sin(ai.la) * 90 - rand(10, 30), rand(0.25, 0.45), pick(['#ff6a2a', '#ffc34a', '#fff0b0']), { glow: true, drag: 2 });
    if ((ai.pt -= dt) <= 0) {
      ai.act = null; shake(3);
      ai.whip = hot ? 3 : 4; fireWhip(e, ai, Math.atan2(P.y - e.y, P.x - e.x), 0.3);
      if (hot && !ai.second) ai.again = 0.3; // 激昂: 鞭を振り終えたら、もう一度踏み込む
    }
    return;
  }
  if (ai.again > 0) { if ((ai.again -= dt) <= 0) ifritLunge(e, ai, true); return; }
  if (ai.act === 'pull') { // 灼熱の鎖で引き寄せている間は待ち、終わったら(鎖が切れても)炎の鞭
    if ((ai.pt -= dt) <= 0 || !P.push) { ai.act = null; ai.whip = ai.enraged ? 3 : 4; fireWhip(e, ai, Math.atan2(P.y - e.y, P.x - e.x)); }
    return;
  }
  if (ai.act === 'wallwait') { // 炎の壁が立ったあと、1秒で突進の予告へ
    if ((ai.pt -= dt) <= 0) {
      ai.act = 'chargeTele'; ai.pt = 0.6;
      pushWarn({ kind: 'line', x: e.x, y: e.y, a: ai.wa, len: 200, w: e.r * 2, t: 0, life: 0.6, fixed: true }); // 突進の経路(体当たりなので広げない)
      AudioMan.charge(0.6);
    }
    return;
  }
  if (ai.act === 'chargeTele') { e.flash = Math.sin(ai.pt * 40) > 0 ? 0.05 : 0; if ((ai.pt -= dt) <= 0) { ai.act = 'charge'; ai.pt = 200 / 320; ai.fire = 0; AudioMan.roar(); shake(5); } return; }
  if (ai.act === 'charge') { // 炎の突進: 壁に沿って速さ 320。体当たり ×1.0(接触のダメージ)、通った跡に燃える床
    const step = 320 * dt;
    e.x += Math.cos(ai.wa) * step; e.y += Math.sin(ai.wa) * step;
    if ((ai.fire += step) >= 14) { ai.fire -= 14; addHazard('fire', e.x, e.y + 4, { r: 12, dur: 4, dmg: e.dmg, lite: 0.5 }); }
    for (let i = 0; i < 3; i++) part(e.x + rand(-8, 8), e.y + rand(-6, 8), -Math.cos(ai.wa) * 80 + rand(-20, 20), -Math.sin(ai.wa) * 80 - rand(10, 30), rand(0.3, 0.5), pick(['#ff6a2a', '#ffc34a', '#fff0b0']), { glow: true, drag: 2 });
    if ((ai.pt -= dt) <= 0) { ai.act = null; shake(4); }
    return;
  }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  ai.wall -= dt * R; ai.whip -= dt * R; ai.chain -= dt * R; ai.blast -= dt * R; ai.lunge -= dt * R;
  if (ai.wall <= 0) { ai.wall = ai.enraged ? 11 : 15; flameWalls(e, ai, a); }
  else if (ai.blast <= 0 && dist < 100) { // 爆炎: 周りを吹き飛ばす
    ai.blast = ai.enraged ? 7 : 9;
    pushWarn({ kind: 'circle', x: e.x, y: e.y, r: 80, t: 0, life: 0.7, track: w => { w.x = e.x; w.y = e.y; } });
    e.sq = 1.25; AudioMan.charge(0.7);
    windup(e, 0.7, () => {
      const R0 = 80 * CHAOS.area, inside = d2(e.x, e.y, P.x, P.y) < (R0 + 3) * (R0 + 3), d = e.dmg * e.altK;
      if (hitCircle(e.x, e.y, 80, d)) burnPlayer(d * 0.03); // 爆炎: 半径 80 に ×1.0・炎上
      if (inside) pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 100, 0.35);
      burst(e.x, e.y, 60, ['#ff6a2a', '#ffc34a', '#fff0b0', '#ff3b1a'], { sp: 200, glow: true, life: 0.6 });
      addRing(e.x, e.y, R0, '#ffc34a', { w: 3, life: 0.4 }); addRing(e.x, e.y, R0 * 1.3, '#ff6a2a', { w: 2, life: 0.55 }); addFlash(e.x, e.y, R0 * 3, '#ff8a3d', 1);
      shockAt(e.x, e.y, 2.2, 0.7); shake(11); hitstop(0.05); AudioMan.boom(); AudioMan.fire(); e.sq = 0.7;
      hint('blast', '爆炎', '吹き飛ばされる。燃える床・炎の壁へ押し込まれないように');
    });
  } else if (ai.chain <= 0 && dist > 50 && dist < 180) { // 灼熱の鎖: 当たると引き寄せ → 炎の鞭。予告の帯は 0.35秒 プレイヤーを追い、0.15秒止まる
    ai.chain = ai.enraged ? 7 : 10;
    const cw = { kind: 'line', x: e.x, y: e.y, a, len: 180, w: 10, t: 0, life: 0.5 };
    cw.track = q => { q.x = e.x; q.y = e.y; if (q.t < 0.35) q.a = Math.atan2(P.y - e.y, P.x - e.x); };
    pushWarn(cw);
    AudioMan.charge(0.5);
    windup(e, 0.5, () => {
      const ca = cw.a;
      bfx.push({ kind: 'chain', x: e.x, y: e.y, a: ca, len: 180 * CHAOS.area, t: 0, life: 0.25 }); // 鎖が飛ぶ
      AudioMan.spearThrow();
      if (inLine(e.x, e.y, ca, 180, 10) && P.invT <= 0) { // 当たった: 1秒かけて手前 40 まで引き寄せる(ダメージなし)
        const d = Math.sqrt(d2(e.x, e.y, P.x, P.y));
        pushPlayer(Math.atan2(e.y - P.y, e.x - P.x), Math.max(0, d - 40), 1);
        bfx.push({ kind: 'chain', x: e.x, y: e.y, t: 0, life: 1, hold: true, track: f => { f.x = e.x; f.y = e.y; if (!P.push) f.t = f.life; } }); // つながった鎖(プレイヤーまで。回避で切れる)
        hint('chain', '灼熱の鎖', '引き寄せられたあとに炎の鞭が来る。回避で鎖を切れる');
        ai.act = 'pull'; ai.pt = 1;
      }
    });
  } else if (ai.lunge <= 0 && dist > 70) { // 炎の踏み込み: 離れていると踏み込んで、そのまま炎の鞭(攻めの中心)
    ai.lunge = ai.enraged ? 2.5 : 3.5;
    ifritLunge(e, ai, false);
  } else if (ai.whip <= 0 && dist < 70) { // 炎の鞭: 二振り(2回目は無敵無視)
    ai.whip = ai.enraged ? 3 : 4;
    fireWhip(e, ai, a);
  }
}
// 炎の踏み込み: 0.5秒の予告(経路の帯。長さ = プレイヤーまでの距離 − 25、40〜220。最初の 0.35秒はプレイヤーを追い、0.15秒止まる)
//   → 帯の端まで速さ 420 で踏み込み、着いたらすぐ炎の鞭(予告 0.3秒)。second: 激昂の 2回目
function ifritLunge(e, ai, second) {
  const w = { kind: 'line', x: e.x, y: e.y, a: 0, len: 40, w: e.r * 2, t: 0, life: 0.5, fixed: true }; // 体当たりの経路なので広げない
  w.track = q => { q.x = e.x; q.y = e.y; if (q.t < 0.35) { q.a = Math.atan2(P.y - e.y, P.x - e.x); q.len = clamp(Math.sqrt(d2(e.x, e.y, P.x, P.y)) - 25, 40, 220); } };
  w.track(w); pushWarn(w);
  AudioMan.charge(0.5); e.sq = 0.85;
  hint('lunge', '炎の踏み込み', '離れていても踏み込んでくる。着いたらすぐ炎の鞭');
  windup(e, 0.5, () => { ai.act = 'lunge'; ai.la = w.a; ai.pt = w.len / 420; ai.trail = 0; ai.second = second; AudioMan.dash(); AudioMan.fire(); shake(3); });
}
// 炎の鞭: 前方の扇(半径 60・±60°)に ×1.0・炎上 → 0.2秒後に反対向きにもう一振り ×0.6(無敵無視。全部当たると ×1.6)。wind: 予告の秒(踏み込みのあとは 0.3)
function fireWhip(e, ai, a, wind = 0.5) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 60, h: 1.047, t: 0, life: wind });
  windup(e, wind, () => {
    const R0 = 60 * CHAOS.area, d = e.dmg * e.altK, wa = a;
    for (const [c, k, o] of [[0, 1, undefined], [1, 0.6, { pierce: true }]]) later(ai, c * 0.2, () => {
      slashes.push({ x: e.x, y: e.y, a: wa, r: R0, t: 0, life: 0.24, flip: c, span: 2.1, pal: SWING_PAL.fire, enemy: true });
      if (hitFan(e.x, e.y, wa, 60, 1.047, d * k, o)) burnPlayer(d * 0.03);
      AudioMan.slash(); AudioMan.fire(); shake(3);
      burst(e.x + Math.cos(wa) * R0 * 0.7, e.y + Math.sin(wa) * R0 * 0.7, 10, ['#ff6a2a', '#ffc34a', '#fff0b0'], { sp: 80, glow: true, life: 0.3 });
    });
  });
}
// 炎の壁: プレイヤーをはさむ平行な帯 2本(長さ 320・幅 24、左右 ±70。向きはイフリート → プレイヤー)が 0.9秒の予告のあと 7秒燃える
//   上にいると 0.5秒ごとに ×0.4・炎上。越えられない(ダッシュ・瞬間移動でも。壁の端を回れば出られる)。立った 1秒後に、壁の間を炎の突進
function flameWalls(e, ai, a) {
  const cx = P.x, cy = P.y, nx = -Math.sin(a), ny = Math.cos(a), L = 320;
  const walls = [-1, 1].map(s => ({ x: cx + nx * 70 * s - Math.cos(a) * L / 2, y: cy + ny * 70 * s - Math.sin(a) * L / 2 }));
  const W = 24 * CHAOS.area; // 壁の幅は攻撃範囲の倍率で広がる(長さと間隔はそのまま)
  for (const w of walls) pushWarn({ kind: 'line', x: w.x, y: w.y, a, len: L, w: W, t: 0, life: 0.9, fixed: true });
  ai.wa = a; AudioMan.charge(0.9);
  hint('fwall', '炎の壁', '壁の上は燃える。壁の間を炎の突進が走る');
  windup(e, 0.9, () => {
    for (const w of walls) addHazard('fwall', w.x, w.y, { a, len: L, w: W, dur: 7, dmg: e.dmg, owner2: e, tick: 0 });
    AudioMan.boom(); AudioMan.fire(); shake(8);
    for (const w of walls) for (let d = 0; d < L; d += 10) burst(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 2, ['#ff6a2a', '#ffc34a', '#fff0b0'], { sp: 50, up: 60, glow: true, life: 0.5 });
    ai.act = 'wallwait'; ai.pt = 1;
  });
}
// 激昂の変身: 炎が白く燃え上がり、姿が大きく赤熱する(角と筋が光る)。このあと踏み込みが 2連続・跡に燃える床
function ifritRage(e) {
  e.spr = 'ifritRage'; e.scale = 1.15;
  burst(e.x, e.y, 90, ['#ffffff', '#fff0b0', '#ffc34a', '#ff6a2a'], { sp: 200, up: 80, glow: true, life: 0.9 });
  for (let i = 0; i < 40; i++) part(e.x + rand(-10, 10), e.y + rand(-4, 8), rand(-15, 15), -rand(80, 200), rand(0.5, 1), pick(['#fff0b0', '#ffc34a', '#ff6a2a']), { glow: true, drag: 1.5 }); // 火柱
  addRing(e.x, e.y, 70, '#ffc34a', { w: 3, life: 0.6 }); addFlash(e.x, e.y, 220, '#ff8a3d', 1.2);
  shockAt(e.x, e.y, 2.4, 0.7); hitstop(0.08);
}
// 炎の祭壇(激昂したときに1回): プレイヤーから 150 の 4方向に祭壇(HP 各 10%)
function fireAltars(e) {
  const a0 = rand(0, TAU);
  for (let i = 0; i < 4; i++) {
    const aa = a0 + TAU / 4 * i, x = P.x + Math.cos(aa) * 150, y = P.y + Math.sin(aa) * 150;
    spawnObj(e, 'altar', x, y, { pct: 0.1, r: 7, life: Infinity });
    burst(x, y, 30, ['#ff6a2a', '#ffc34a', '#fff0b0', '#3a2a2a'], { sp: 90, up: 80, glow: true, life: 0.7 }); shockAt(x, y, 0.8, 0.85);
  }
  shake(8); AudioMan.roar(); AudioMan.fire(); screenFlash(0.3, '#ff6a2a');
  UI.announce('炎の祭壇', '燃えている祭壇 1つにつき、イフリートの与ダメージ +10%・技が速くなる。壊せる');
}

// ---------- 晶角の大鹿: 連続突進(終点に結晶の柱)→ 残像の突進 / 晶棘の列 / 七色の欠片 / 角の薙ぎ払い(押し出し → 突進)/ 激昂: 群れの疾走 ----------
//   結晶の柱は大鹿の欠片と残像を遮る。大鹿が突進で柱にぶつかると柱が砕け、1.5秒ひるむ(受けるダメージ ×1.5)
const PRISM = ['#ff5d73', '#ff9a3d', '#ffd23f', '#7dff9a', '#7ad7ff', '#8a7aff', '#d88aff']; // 七色(弾・棘・光線の色)
function stagAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'stun') { e.flash = Math.sin(ai.pt * 30) > 0.6 ? 0.04 : 0; if ((ai.pt -= dt) <= 0) { ai.act = null; e.takeK = 1; } return; }
  if (ai.act === 'rush') { updStagRush(e, ai, dt); return; }
  // 距離 120 を保って速く回り込む(ときどき回る向きを変える)
  if ((ai.flip = (ai.flip ?? 3) - dt) <= 0) { ai.flip = rand(2.5, 4.5); ai.side = -ai.side; }
  const want = 120, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 30 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 30 * ai.side) * slow * dt;
  ai.rush -= dt * R; ai.spike -= dt * R; ai.shard -= dt * R; ai.sweep -= dt * R; if (ai.enraged) ai.herd -= dt * R;
  if (ai.shard <= 0) { ai.shard = ai.enraged ? 3 : 4; prismShards(e, 0); if (ai.enraged) later(ai, 0.3, () => prismShards(e, Math.PI / 7)); } // 七色の欠片(ほかの技と並んで撃つ)
  if (dist < 50 && ai.sweep <= 0) { // 角の薙ぎ払い: 押し飛ばして、続けて突進 1回(どちらも無敵無視)
    ai.sweep = 3;
    const ba = a;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a: ba, r: 55, h: 1.22, t: 0, life: 0.4 });
    windup(e, 0.4, () => {
      slashes.push({ x: e.x, y: e.y, a: ba, r: 55 * CHAOS.area, t: 0, life: 0.24, span: 2.44, pal: SWING_PAL.enemy, enemy: true });
      if (inFan(e.x, e.y, ba, 55, 1.22)) { hurtPlayer(e.dmg * 1.1, { pierce: true }); pushPlayer(ba, 100, 0.3); }
      AudioMan.slash(); shake(4);
      startStagRush(e, ai, 1, { pierce: true, k: 0.9 });
    });
  } else if (ai.rush <= 0) { ai.rush = ai.enraged ? 4.5 : 6; startStagRush(e, ai, ai.enraged ? 4 : 3, {}); }
  else if (ai.enraged && ai.herd <= 0) { ai.herd = 7; stagHerd(e, ai); }
  else if (ai.spike <= 0) { ai.spike = ai.enraged ? 4 : 5; crystalSpikes(e, ai, a); }
}
// 連続突進: 各 0.45秒の予告(最初の 0.3秒はプレイヤーを追い、残りは止まる)→ 速さ 380 で 220。終点に結晶の柱
//   o.pierce: 角の薙ぎ払いのあとの突進(×0.9・無敵無視・柱は立てない・残像なし)
function startStagRush(e, ai, n, o) {
  ai.act = 'rush'; ai.rs = { n, i: 0, segs: [], pierce: !!o.pierce, k: o.k || 1, mine: new Set() }; // mine: この連続突進で立てた柱(ぶつからない。次の突進から当たる)
  stagTele(e, ai);
}
function stagTele(e, ai) {
  const rs = ai.rs;
  rs.ph = 'tele'; rs.t = 0; rs.dir = Math.atan2(P.y - e.y, P.x - e.x); rs.hit = false;
  pushWarn({ kind: 'line', x: e.x, y: e.y, a: rs.dir, len: 220, w: e.r * 2, t: 0, life: 0.45, fixed: true, track: q => { q.x = e.x; q.y = e.y; if (q.t < 0.3) rs.dir = q.a = Math.atan2(P.y - e.y, P.x - e.x); } }); // 突進の経路(体当たりなので広げない)
}
function updStagRush(e, ai, dt) {
  const rs = ai.rs;
  rs.t += dt;
  if (rs.ph === 'tele') { // 角が光り、前脚で地面をかく
    e.flash = Math.sin(rs.t * 40) > 0 ? 0.04 : 0; e.face = Math.cos(rs.dir) < 0 ? -1 : 1;
    if (Math.random() < dt * 30) part(e.x + rand(-6, 6), e.y + 10, -Math.cos(rs.dir) * 30 + rand(-10, 10), -rand(10, 25), 0.4, pick(['#5a4a8a', '#3a2c5a', '#9ff7ff']), { drag: 2 });
    if (rs.t < 0.45) return;
    rs.ph = 'dash'; rs.t = 0; rs.x0 = e.x; rs.y0 = e.y; e.air = rs.pierce; // 無敵無視の突進は自分で当たりを判定する
    rs.ignore = new Set([...rs.mine, ...enemies.filter(o => o.obj === 'crystal' && !o.dead && d2(o.x, o.y, e.x, e.y) < Math.pow(o.r + e.r + 2, 2))]); // 走り出す場所の柱と、この連続突進で立てた柱は無視
    AudioMan.dash(); AudioMan.roar();
    return;
  }
  const step = 380 * dt;
  e.x += Math.cos(rs.dir) * step; e.y += Math.sin(rs.dir) * step; e.face = Math.cos(rs.dir) < 0 ? -1 : 1;
  for (let i = 0; i < 2; i++) part(e.x + rand(-8, 8), e.y + rand(-6, 6), -Math.cos(rs.dir) * 60, -Math.sin(rs.dir) * 60, 0.35, pick(PRISM), { glow: true, drag: 3 }); // 七色の光の尾
  if (rs.pierce && !rs.hit && d2(e.x, e.y, P.x, P.y) < Math.pow(e.r + 4, 2)) { rs.hit = true; hurtPlayer(e.dmg * rs.k, { pierce: true }); }
  for (const o of enemies) { // 結晶の柱にぶつかった: 柱が砕けて、大鹿は 1.5秒ひるむ
    if (o.obj !== 'crystal' || o.dead || rs.ignore.has(o) || d2(o.x, o.y, e.x, e.y) > Math.pow(o.r + e.r, 2)) continue;
    o.dead = true; objDown(o, true); e.air = false;
    ai.act = 'stun'; ai.pt = 1.5; e.takeK = 1.5;
    hitstop(0.08); shake(10); shockAt(e.x, e.y, 1.6, 0.8); AudioMan.crush();
    burst(e.x, e.y, 50, [...PRISM, '#ffffff'], { sp: 160, glow: true, life: 0.7 });
    UI.announce('柱にぶつかった!', 'ひるんでいる間は 1.5倍のダメージ');
    return;
  }
  if (rs.t * 380 < 220) return;
  rs.segs.push({ x0: rs.x0, y0: rs.y0, x1: e.x, y1: e.y });
  e.air = false;
  if (!rs.pierce) rs.mine.add(crystalPillar(e, e.x, e.y));
  if (++rs.i < rs.n) { stagTele(e, ai); return; }
  ai.act = null;
  if (!rs.pierce) stagAfterimage(e, ai, rs.segs, rs.mine);
}
// 結晶の柱(HP 2%・半径 10・12秒・最大 5本。多いときは古いものから崩れる)
function crystalPillar(e, x, y) {
  const mine = enemies.filter(o => o.owner === e && o.obj === 'crystal' && !o.dead);
  if (mine.length >= 5) { mine[0].dead = true; objDown(mine[0], false); }
  const o = spawnObj(e, 'crystal', x, y, { pct: 0.02, r: 10, life: 12 });
  burst(x, y, 24, [...PRISM, '#ffffff'], { sp: 90, up: 40, glow: true, life: 0.5 }); shockAt(x, y, 0.7, 0.85); AudioMan.chime();
  hint('crystal', '結晶の柱', '次の突進を柱へ誘うと、大鹿がぶつかってひるむ。柱は欠片と残像も遮る');
  return o;
}
// 残像の突進: 突進の経路が光の線で残り、1秒後に同じ経路を結晶の残像が同じ速さで走る(×0.6。柱で消える)
function stagAfterimage(e, ai, segs, mine) { // mine: この連続突進で立てた柱(残像はすり抜ける)
  let delay = 1, total = 0;
  for (const g of segs) total += Math.hypot(g.x1 - g.x0, g.y1 - g.y0) / 380;
  bfx.push({ kind: 'trail', x: 0, y: 0, segs, t: 0, life: 1 + total + 0.2 });
  for (const g of segs) {
    const L = Math.hypot(g.x1 - g.x0, g.y1 - g.y0), ang = Math.atan2(g.y1 - g.y0, g.x1 - g.x0);
    later(ai, delay, () => { eprojs.push({ kind: 'phantom', x: g.x0, y: g.y0, vx: Math.cos(ang) * 380, vy: Math.sin(ang) * 380, dmg: e.dmg * 0.6 * (S.eatk ?? 1), life: L / 380, t: 0, r: e.r, keep: true, blk: 'crystal', ignore: mine, face: Math.cos(ang) < 0 ? -1 : 1 }); AudioMan.dash(); });
    delay += L / 380;
  }
}
// 七色の欠片: 全周へ 7発(速さ 95・×0.45)
function prismShards(e, off) {
  for (let i = 0; i < 7; i++) { const p = eball(e.x, e.y - 6, TAU / 7 * i + off, 95, e.dmg * 0.45, 'pshard'); p.ci = i; p.blk = 'crystal'; }
  burst(e.x, e.y - 6, 14, PRISM, { sp: 70, glow: true, life: 0.3 }); AudioMan.chime();
}
// 晶棘の列: 大鹿からプレイヤーへ 円 半径 12 を 6個(0.6秒の予告)→ 根元から順に 0.08秒おきに結晶の棘 ×0.8
function crystalSpikes(e, ai, a) {
  const pts = [1, 2, 3, 4, 5, 6].map(i => ({ x: e.x + Math.cos(a) * 22 * i, y: e.y + Math.sin(a) * 22 * i }));
  pts.forEach((p, i) => pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 12, t: 0, life: 0.6 + 0.08 * i }));
  e.sq = 1.2; AudioMan.charge(0.6);
  pts.forEach((p, i) => later(ai, 0.6 + 0.08 * i, () => {
    hitCircle(p.x, p.y, 12, e.dmg * 0.8);
    bfx.push({ kind: 'spike', x: p.x, y: p.y, r: 12 * CHAOS.area, t: 0, life: 0.7, ci: i % 7, seed: (Math.random() * 1e6) | 0 });
    burst(p.x, p.y, 8, [PRISM[i % 7], '#ffffff'], { sp: 60, up: 30, glow: true, life: 0.35 });
    if (i % 2 === 0) { AudioMan.chime(); shake(2); }
  }));
}
// 群れの疾走(激昂): 画面を横切る帯 5本(幅 20・50 おき)が 0.4秒おきに順に光り、各帯の 0.6秒後に幻の鹿が走る(速さ 400・×0.8)
function stagHerd(e, ai) {
  const th = rand(0, TAU), L = Math.min(480, Math.hypot(GFX.VW, GFX.VH) + 60), c = Math.cos(th), s = Math.sin(th), nx = -s, ny = c;
  hint('herd', '群れの疾走', '光った帯を幻の鹿が駆け抜ける。帯のすき間へ');
  AudioMan.roar();
  for (let i = 0; i < 5; i++) {
    const off = (i - 2) * 50, x0 = P.x + nx * off - c * L / 2, y0 = P.y + ny * off - s * L / 2;
    later(ai, 0.4 * i, () => {
      pushWarn({ kind: 'line', x: x0, y: y0, a: th, len: L, w: 20 * CHAOS.area, t: 0, life: 0.6, fixed: true });
      later(ai, 0.6, () => { eprojs.push({ kind: 'phantom', x: x0, y: y0, vx: c * 400, vy: s * 400, dmg: e.dmg * 0.8 * (S.eatk ?? 1), life: L / 400, t: 0, r: 10 * CHAOS.area, keep: true, face: c < 0 ? -1 : 1 }); AudioMan.dash(); });
    });
  }
}

// ---------- 七彩の女王: 3秒ごとに瞬間移動 / 七彩の光線 / 虹の檻(壊せる結晶)/ 鏡の分身(本物を探す)/ 光の鎖 / 瞬き / 激昂: 虹の螺旋 ----------
function pqueenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  updCage(e, ai, dt); updTether(e, ai, dt); updClones(e, ai, dt);
  if (ai.spT > 0) { // 虹の螺旋(激昂): 3本の腕
    ai.spT -= dt; ai.spGap -= dt;
    if (ai.spGap <= 0) { ai.spGap = 0.12; ai.spA += 0.32; for (let i = 0; i < 3; i++) { const p = eball(e.x, e.y - 6, ai.spA + TAU / 3 * i, 70, e.dmg * 0.4, 'pshard'); p.ci = (i * 2 + Math.floor(ai.spA * 3)) % 7; } if (Math.floor(ai.spT * 8) % 2) AudioMan.shoot(); }
  }
  if (ai.act === 'beams') { updBeams(e, ai, dt); return; }
  // ゆっくり漂う(距離はおよそ 120)
  const want = 120, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 25 ? 0.6 : 0;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 8) * slow * dt; e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 8) * slow * dt;
  ai.tp -= dt; ai.beam -= dt * R; ai.cageCd -= dt * R; ai.mirror -= dt * R; ai.chain -= dt * R; ai.blink -= dt * R; if (ai.enraged) ai.spiral -= dt * R;
  if (ai.tp <= 0 && !ai.clones && !ai.cage) { ai.tp = 3; const ta = rand(0, TAU), tr = rand(100, 140); queenWarp(e, P.x + Math.cos(ta) * tr, P.y + Math.sin(ta) * tr); return; }
  if (ai.enraged && ai.spiral <= 0) { ai.spiral = 5; ai.spT = 2.5; ai.spGap = 0; ai.spA = rand(0, TAU); }
  if (ai.cageCd <= 0 && !ai.clones && !ai.cage) { ai.cageCd = ai.enraged ? 12 : 16; startCage(e, ai); }
  else if (ai.mirror <= 0 && !ai.cage) { ai.mirror = ai.enraged ? 10 : 14; startClones(e, ai); }
  else if (ai.beam <= 0) { ai.beam = ai.enraged ? 4.5 : 6; startBeams(e, ai, a); }
  else if (ai.chain <= 0 && !ai.tether) { ai.chain = ai.enraged ? 8 : 11; queenChain(e, ai); }
  else if (ai.blink <= 0 && !ai.clones && !ai.cage) { ai.blink = ai.enraged ? 6 : 8; queenBlink(e, ai); }
}
// 瞬間移動: 七色の光の粒になって消え、別の場所に現れる
function queenWarp(e, x, y) {
  burst(e.x, e.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 });
  e.x = x; e.y = y;
  burst(e.x, e.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 }); addRing(e.x, e.y, 16, '#ffd0f0', { life: 0.3 });
  AudioMan.chime();
}
// 七彩の光線: プレイヤーの方向に扇状の帯 7本(±54°)を 0.9秒予告 → 2秒の光線 ×0.8。真ん中の 1本は毎秒 1.0rad で追う。激昂は残り 6本も 1秒で 30° 回る
function startBeams(e, ai, a) {
  const offs = [-3, -2, -1, 0, 1, 2, 3].map(i => i * 0.314);
  for (const o of offs) pushWarn({ kind: 'line', x: e.x, y: e.y, a: a + o, len: 200, w: 8, t: 0, life: 0.9 });
  AudioMan.charge(0.9);
  windup(e, 0.9, () => { ai.act = 'beams'; ai.bt = 0; ai.bAng = offs.map(o => a + o); ai.bRot = Math.random() < 0.5 ? 1 : -1; AudioMan.zap(); shake(3); });
}
function updBeams(e, ai, dt) {
  ai.bt += dt;
  const m = 3;
  ai.bAng[m] += clamp(angDiff(Math.atan2(P.y - e.y, P.x - e.x), ai.bAng[m]), -dt, dt);
  if (ai.enraged && ai.bt < 1) for (let i = 0; i < 7; i++) if (i !== m) ai.bAng[i] += ai.bRot * 0.524 * dt;
  for (const ba of ai.bAng) hitLine(e.x, e.y - 6, ba, 200, 8, e.dmg * 0.8);
  if (Math.random() < dt * 30) { const i = (Math.random() * 7) | 0, r = rand(10, 200 * CHAOS.area); part(e.x + Math.cos(ai.bAng[i]) * r, e.y - 6 + Math.sin(ai.bAng[i]) * r, rand(-20, 20), rand(-20, 20), 0.35, PRISM[i], { glow: true, drag: 2 }); }
  if (ai.bt >= 2) { ai.act = null; ai.bAng = null; }
}
// 虹の檻: プレイヤーの周り 半径 85 に結晶 4個(HP 各 2%)。1秒後、隣どうしを結ぶ 4辺の光線(幅 10)が 5秒
//   辺に触れると ×0.6(0.5秒ごと)、檻の中にいる間は 1秒ごとに ×0.2。結晶を壊すとその 2辺が消え、檻が開く
function startCage(e, ai) {
  const a0 = rand(0, TAU), pts = [0, 1, 2, 3].map(i => ({ x: P.x + Math.cos(a0 + i * Math.PI / 2) * 85, y: P.y + Math.sin(a0 + i * Math.PI / 2) * 85 }));
  for (const p of pts) pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 6, t: 0, life: 1, fixed: true }); // 結晶が立つ場所
  AudioMan.charge(1);
  ai.cage = { t: -1, objs: null, pts, tick: 0 };
  hint('cage', '虹の檻', '結晶を1つ壊すと檻が開く。光の辺に触れると痛い');
}
function updCage(e, ai, dt) {
  const c = ai.cage;
  if (!c) return;
  c.t += dt;
  if (!c.objs && c.t >= 0) { // 結晶が立つ
    c.objs = c.pts.map(p => spawnObj(e, 'prism', p.x, p.y, { pct: 0.02, r: 6, life: 6.2 }));
    for (const p of c.pts) burst(p.x, p.y, 16, [...PRISM, '#ffffff'], { sp: 80, up: 30, glow: true, life: 0.45 });
    AudioMan.chime(); shake(3);
  }
  if (c.t > 6) { ai.cage = null; return; }
  if (c.t < 1) return;
  const o = c.objs, W = 10 * CHAOS.area;
  for (let i = 0; i < 4; i++) {
    const A = o[i], B = o[(i + 1) % 4];
    if (!A.dead && !B.dead && segD2(P.x, P.y, A.x, A.y, B.x, B.y) < Math.pow(W / 2 + 3, 2)) hurtPlayer(e.dmg * 0.6);
  }
  const closed = o.every(x => !x.dead);
  if (closed && inQuad(P.x, P.y, o)) { if ((c.tick -= dt) <= 0) { c.tick = 1; hurtPlayer(e.dmg * 0.2); } } else c.tick = 0;
}
// 点が4点の多角形の中か(外積の符号がそろうか)
function inQuad(x, y, q) {
  let sg = 0;
  for (let i = 0; i < q.length; i++) {
    const A = q[i], B = q[(i + 1) % q.length], cr = (B.x - A.x) * (y - A.y) - (B.y - A.y) * (x - A.x);
    if (cr !== 0) { if (sg && Math.sign(cr) !== sg) return false; sg = Math.sign(cr); }
  }
  return true;
}
// 鏡の分身: 女王と同じ姿の分身 3体(激昂 4体)が 6秒。全員が 1.5秒ごとに光の弾。分身は 1撃で消え、本物だけ HP が減る(本物は 0.5秒ごとに弱く光る)
function startClones(e, ai) {
  const n = ai.enraged ? 4 : 3, total = n + 1, a0 = rand(0, TAU), R0 = rand(110, 130), real = (Math.random() * total) | 0;
  const spots = [...Array(total)].map((_, i) => ({ x: P.x + Math.cos(a0 + TAU / total * i) * R0, y: P.y + Math.sin(a0 + TAU / total * i) * R0 }));
  queenWarp(e, spots[real].x, spots[real].y);
  const list = spots.filter((_, i) => i !== real).map(p => {
    const c = spawnObj(e, 'clone', p.x, p.y, { pct: 0, r: e.r, life: 6 });
    c.hp = c.maxhp = 1; c.disguise = true;
    burst(p.x, p.y - 6, 22, [...PRISM, '#ffffff'], { sp: 80, glow: true, life: 0.45 });
    return c;
  });
  ai.clones = { t: 0, list, shot: 1.5 };
  screenFlash(0.25, '#ffd0f0'); AudioMan.chime(); AudioMan.zap();
  hint('mirror', '鏡の分身', '分身は1撃で消える。弱く光るのが本物');
}
function updClones(e, ai, dt) {
  const c = ai.clones;
  if (!c) return;
  c.t += dt; c.shot -= dt * CHAOS.rate;
  if (c.shot <= 0) {
    c.shot = 1.5;
    for (const s of [e, ...c.list.filter(x => !x.dead)]) { const p = eball(s.x, s.y - 6, Math.atan2(P.y - s.y, P.x - s.x), 80, e.dmg * 0.4, 'pshard'); p.ci = (Math.random() * 7) | 0; }
    AudioMan.shoot();
  }
  for (const s of c.list) if (!s.dead) s.face = P.x < s.x ? -1 : 1;
  if (c.t >= 6) { for (const s of c.list) if (!s.dead) { s.dead = true; objDown(s, false); } ai.clones = null; }
}
// 光の鎖: 0.5秒の予告(女王からプレイヤーへ細い帯)→ 当たると 3秒、女王から 130 より離れると毎秒 50 引き戻され、0.5秒ごとに ×0.2
function queenChain(e, ai) {
  const a = Math.atan2(P.y - (e.y - 6), P.x - e.x), len = Math.sqrt(d2(e.x, e.y - 6, P.x, P.y)) + 12; // 鎖は女王の胸元から
  pushWarn({ kind: 'line', x: e.x, y: e.y - 6, a, len, w: 4, t: 0, life: 0.5, fixed: true });
  windup(e, 0.5, () => {
    bfx.push({ kind: 'lchain', x: e.x, y: e.y - 6, a, len, t: 0, life: 0.2 });
    AudioMan.zap();
    if (inLine(e.x, e.y - 6, a, len, 6) && P.invT <= 0) { ai.tether = { t: 3, tick: 0 }; hint('lchain', '光の鎖', '女王から離れすぎると引き戻されて痛い'); }
  });
}
function updTether(e, ai, dt) {
  const th = ai.tether;
  if (!th) return;
  if ((th.t -= dt) <= 0 || P.dead) { ai.tether = null; return; }
  const d = Math.sqrt(d2(e.x, e.y, P.x, P.y));
  if (d > 130 && P.invT <= 0) {
    const k = Math.min(d - 130, 50 * dt);
    P.x += (e.x - P.x) / d * k; P.y += (e.y - P.y) / d * k;
    if ((th.tick -= dt) <= 0) { th.tick = 0.5; hurtPlayer(e.dmg * 0.2); }
  }
}
// 瞬き: プレイヤーの隣に 円 半径 40(0.4秒)→ そこに現れて光の爆発 ×0.9
function queenBlink(e, ai) {
  const ba = rand(0, TAU), tx = P.x + Math.cos(ba) * 20, ty = P.y + Math.sin(ba) * 20;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 40, t: 0, life: 0.4 });
  AudioMan.charge(0.4);
  windup(e, 0.4, () => {
    queenWarp(e, tx, ty);
    hitCircle(tx, ty, 40, e.dmg * 0.9);
    const R0 = 40 * CHAOS.area;
    burst(tx, ty, 40, [...PRISM, '#ffffff'], { sp: 150, glow: true, life: 0.5 });
    addRing(tx, ty, R0, '#ffffff', { w: 3, life: 0.35 }); addFlash(tx, ty, R0 * 3, '#ffd0f0', 0.9);
    shockAt(tx, ty, 1.4, 0.8); shake(7); AudioMan.boom();
  });
}

// ---------- 大海魔クラーケン: 動かない固定砲台。触手の森(壊せる触手)/ 触手の叩きつけ / 墨 / 絡め取り / 潮の満ち引き / 水弾 ----------
//   触手が 2本以上あると本体の被ダメ ×0.5。プレイヤーが 280 より離れると触手ごと潜り、2秒後にプレイヤーから 140 の位置に出直す
const SPLASH = ['#bff4ff', '#7ad7ff', '#ffffff', '#2a8ac8'];
function krakenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate, tents = enemies.filter(o => o.owner === e && o.obj === 'tentacle' && !o.dead);
  e.takeK = tents.length >= 2 ? 0.5 : 1;
  if (ai.grabT > 0) { // 絡め取り中: 回避の無敵で抜けられる。1.5秒動けなかったら最後に ×0.8
    if (!(P.rootT > 0)) ai.grabT = 0;
    else if ((ai.grabT -= dt) <= 0) { P.rootT = 0; hurtPlayer(e.dmg * 0.8); shake(5); burst(P.x, P.y, 16, SPLASH, { sp: 90 }); AudioMan.splat(); }
  }
  if (ai.act === 'dive') { // 潜っている: 2秒後に出直す(出る位置の予告 1秒)
    ai.pt -= dt;
    if (ai.pt <= 1 && !ai.warned) { ai.warned = true; const ta = rand(0, TAU); ai.tx = P.x + Math.cos(ta) * 140; ai.ty = P.y + Math.sin(ta) * 140; pushWarn({ kind: 'circle', x: ai.tx, y: ai.ty, r: 20, t: 0, life: 1, fixed: true }); bfx.push({ kind: 'ripple', x: ai.tx, y: ai.ty, t: 0, life: 1 }); }
    if (ai.pt > 0) return;
    e.x = ai.tx; e.y = ai.ty; e.flying = e.hidden = false; e.air = false; ai.act = null; e.sq = 0.6;
    burst(e.x, e.y, 50, SPLASH, { sp: 150, up: 60, g: 200, life: 0.7 }); shockAt(e.x, e.y, 1.5, 0.8); shake(7); AudioMan.splash(); AudioMan.roar();
    return;
  }
  if (!ai.act && ai.wind <= 0 && dist > 280) { // 触手ごと潜って、プレイヤーのそばへ
    ai.act = 'dive'; ai.pt = 2; ai.warned = false; e.flying = e.hidden = true; e.air = true;
    ai.q = []; // 出かかっていた触手・叩きつけ・潮は取りやめ(潜った後に元の場所で出ないように)
    for (const o of tents) { o.dead = true; objDown(o, false); }
    P.rootT = 0; ai.grabT = 0;
    burst(e.x, e.y, 40, SPLASH, { sp: 120, up: 40, g: 200 }); AudioMan.splash();
    return;
  }
  if (ai.wbN > 0 && (ai.wbGap -= dt) <= 0) { ai.wbGap = 0.3; ai.wbN--; eball(e.x, e.y - 8, Math.atan2(P.y - e.y + 8, P.x - e.x), 120, e.dmg * 0.4, 'water'); AudioMan.shoot(); } // 水弾: 0.3秒おきに 3発
  ai.forest -= dt * R; ai.slam -= dt * R; ai.ink -= dt * R; ai.grab -= dt * R; ai.tide -= dt * R; ai.water -= dt * R;
  const inkOn = hazards.some(h => h.kind === 'ink');
  if (ai.forest <= 0) { ai.forest = ai.enraged ? 14 : 18; tentacleForest(e, ai); }
  else if (ai.tide <= 0) { ai.tide = ai.enraged ? 10 : 14; tideStart(e, ai); }
  else if (ai.ink <= 0) { ai.ink = ai.enraged ? 8 : 10; inkShot(e, ai); }
  else if (ai.grab <= 0 && !inkOn && !(P.rootT > 0)) { ai.grab = ai.enraged ? 7 : 9; krakenGrab(e, ai, a); }
  else if (ai.slam <= 0) { ai.slam = ai.enraged ? 3.5 : 4.5; tentacleSlam(e, ai); }
  else if (ai.water <= 0) { ai.water = ai.enraged ? 4.5 : 6; ai.wbN = 3; ai.wbGap = 0; }
}
// 触手の森: 本体の周り 100〜160 に触手 3本(激昂 5本。HP 各 4%・半径 8・15秒)。触手は 2.5秒ごとに帯を予告して薙ぐ
function tentacleForest(e, ai) {
  const n = ai.enraged ? 5 : 3, a0 = rand(0, TAU);
  for (let i = 0; i < n; i++) {
    const ta = a0 + TAU / n * i + rand(-0.3, 0.3), tr = rand(100, 160), x = e.x + Math.cos(ta) * tr, y = e.y + Math.sin(ta) * tr;
    bfx.push({ kind: 'ripple', x, y, t: 0, life: 0.8 }); // 地面(海底)が泡立つ
    later(ai, 0.8, () => { spawnObj(e, 'tentacle', x, y, { pct: 0.08, r: 8, life: 15, spawnT: rand(1, 2.5) }); burst(x, y, 20, SPLASH, { sp: 90, up: 50, g: 200 }); AudioMan.splash(); });
  }
  AudioMan.roar();
  hint('forest', '触手の森', '触手が 2本以上あると本体のダメージが半分。触手を壊せ');
}
// 触手の叩きつけ: プレイヤーの周りに帯(長さ 140・幅 18)を 3本(激昂 5本)→ ×1.0・スタミナ −20
function tentacleSlam(e, ai) {
  const n = ai.enraged ? 5 : 3, LA = 70 * CHAOS.area, bands = [];
  for (let i = 0; i < n; i++) {
    const ba = rand(0, Math.PI), oa = rand(0, TAU), off = rand(0, 25), cx = P.x + Math.cos(oa) * off, cy = P.y + Math.sin(oa) * off;
    const b = { x: cx - Math.cos(ba) * LA, y: cy - Math.sin(ba) * LA, a: ba };
    bands.push(b);
    pushWarn({ kind: 'line', x: b.x, y: b.y, a: ba, len: 140, w: 18, t: 0, life: 0.9, ink: true });
  }
  AudioMan.charge(0.9);
  later(ai, 0.9, () => {
    for (const b of bands) {
      if (hitLine(b.x, b.y, b.a, 140, 18, e.dmg)) drainSta(20);
      bfx.push({ kind: 'tslap', x: b.x, y: b.y, a: b.a, len: 140 * CHAOS.area, w: 18 * CHAOS.area, t: 0, life: 0.4 });
      burst(b.x + Math.cos(b.a) * LA, b.y + Math.sin(b.a) * LA, 14, SPLASH, { sp: 100, up: 40, g: 200 });
    }
    shake(7); AudioMan.splash(); AudioMan.boom();
  });
}
// 墨: 墨の玉を放物線で(1秒)。墨だまり(半径 75)5秒: 中にいる間スタミナが回復しない・周りが暗くなり触手の予告が見えない
//   予告の円と墨の玉の落下点は、最初の 0.7秒 プレイヤーを追い、着弾までの 0.3秒は止まる
function inkShot(e, ai) {
  const R = 75, w = { kind: 'circle', x: P.x, y: P.y, r: R, t: 0, life: 1 };
  pushWarn(w);
  const ball = lob('inkball', e.x, e.y - 10, w.x, w.y, 1, 60, p => {
    addHazard('ink', p.x, p.y, { r: R, dur: 5 });
    burst(p.x, p.y, 30, ['#0a0a14', '#1a1a2a', '#2a2a4a'], { sp: 110, g: 160, life: 0.7 }); shockAt(p.x, p.y, 0.8, 0.9); AudioMan.splat();
    hint('ink', '墨', '墨だまりの中ではスタミナが回復せず、触手の予告も見えない');
  });
  ball.follow = b => { if (b.t < 0.7) { b.tx = P.x; b.ty = P.y; } w.x = b.tx; w.y = b.ty; };
  AudioMan.dash();
}
// 絡め取り: 0.7秒の予告(本体からプレイヤーへ帯)→ 当たると 1.5秒 動けない(回避の無敵で抜けられる)。つかんだ瞬間にスタミナ −20
function krakenGrab(e, ai, a) {
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 170, w: 14, t: 0, life: 0.7 });
  AudioMan.charge(0.7);
  windup(e, 0.7, () => {
    bfx.push({ kind: 'tslap', x: e.x, y: e.y, a, len: 170 * CHAOS.area, w: 10 * CHAOS.area, t: 0, life: 0.25 });
    AudioMan.dash();
    if (inLine(e.x, e.y, a, 170, 14) && P.invT <= 0 && !P.dead) {
      P.rootT = 1.6; ai.grabT = 1.5; drainSta(20); // 動けない時間は少し長めに持たせ、最後の ×0.8 を本体の側で判定する
      bfx.push({ kind: 'grab', x: e.x, y: e.y, t: 0, life: 1.5, track: f => { if (!(P.rootT > 0)) f.t = f.life; } });
      AudioMan.splat(); shake(4);
      hint('grab', '絡め取り', '1.5秒動けない。回避の無敵で抜けられる');
    }
  });
}
// 潮の満ち引き: プレイヤーの位置に 円 半径 120(0.8秒)→ 2秒 中心へ毎秒 40 引く → 1秒 外へ毎秒 90 押す → 縁(半径 120〜135)に触手の輪 ×0.8
function tideStart(e, ai) {
  const tx = P.x, ty = P.y;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 120, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { addHazard('tide', tx, ty, { r: 120, dur: 3.4, dmg: e.dmg }); AudioMan.splash(); hint('tide', '潮の満ち引き', '引き寄せられたあと押し出される。最後に縁へ触手の輪'); });
}

// ---------- 深淵の海竜: 動き回る。海流(流され続ける → 大津波)/ 大津波(岩礁の陰に隠れる)/ 潜航・浮上(影が追う)/ 水柱 / 尾撃 / 激昂: 水流ブレス ----------
function leviaAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (ai.act === 'dive') { updLeviaDive(e, ai, dt); return; }
  if (ai.act === 'breath') { // 水流ブレス: 1.5秒かけて 90° 薙ぐ。当たると ×1.0・スタミナ −20(1回の薙ぎで 1回まで。回避の無敵・被弾後の無敵で防げる)
    ai.pt += dt;
    const k = Math.min(1, ai.pt / 1.5);
    ai.ba = ai.ba0 + ai.bdir * (Math.PI / 2) * k;
    if (!ai.bhit && hitLine(e.x, e.y, ai.ba, 220, 14, e.dmg)) { ai.bhit = true; drainSta(20); }
    for (let i = 0; i < 2; i++) { const r = rand(10, 220 * CHAOS.area); part(e.x + Math.cos(ai.ba) * r, e.y + Math.sin(ai.ba) * r, rand(-30, 30), rand(-30, 30), 0.35, pick(SPLASH), { drag: 2 }); }
    if (k >= 1) { ai.act = null; ai.ba = null; }
    return;
  }
  if ((ai.flip = (ai.flip ?? 4) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -ai.side; }
  const want = 130, dir = dist > want ? a : a + Math.PI, k = Math.abs(dist - want) > 20 ? 1 : 0.25;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * 26 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * 26 * ai.side) * slow * dt;
  ai.current -= dt * R; ai.wave -= dt * R; ai.dive -= dt * R; ai.pillar -= dt * R; ai.tail -= dt * R; if (ai.enraged) ai.breath -= dt * R;
  if (ai.current <= 0) { ai.current = ai.enraged ? 12 : 16; seaCurrent(e, ai); }
  else if (ai.wave <= 0) { ai.wave = ai.enraged ? 9 : 12; tsunami(e, rand(0, TAU)); }
  else if (ai.tail <= 0 && dist < 60) { ai.tail = ai.enraged ? 4.5 : 6; leviaTail(e, ai, a); }
  else if (ai.dive <= 0) { ai.dive = ai.enraged ? 6 : 8; startLeviaDive(e, ai); }
  else if (ai.pillar <= 0) { ai.pillar = ai.enraged ? 9 : 12; waterPillars(e, ai); }
  else if (ai.enraged && ai.breath <= 0) { ai.breath = 5; leviaBreath(e, ai, a); }
}
// 海流: 1秒の予告(画面に流れの矢印)→ 6秒 一定の向きに毎秒 35 流される。始まって 2秒で、流れと同じ向きの大津波
function seaCurrent(e, ai) {
  const th = rand(0, TAU);
  bfx.push({ kind: 'flow', x: 0, y: 0, th, t: 0, life: 7 });
  AudioMan.charge(1);
  hint('current', '海流', '6秒 流され続ける(ダッシュなら逆らえる)。途中で大津波が来る');
  later(ai, 1, () => { P.current = { vx: Math.cos(th) * 35, vy: Math.sin(th) * 35, t: 6 }; AudioMan.splash(); });
  later(ai, 3, () => tsunami(e, th));
}
// 大津波: 1.2秒の予告(画面の端に帯と矢印)と同時に画面の中に岩礁 3個(半径 12・壊れない)→ 画面を横切る大波(速さ 150)
//   波に触れると ×1.0・スタミナ −30。岩礁の陰(幅 26・長さ 60)には当たらない。波が通ると岩礁は消える
function tsunami(e, th) {
  const c = Math.cos(th), s = Math.sin(th), cx = cam.x + GFX.VW / 2, cy = cam.y + GFX.VH / 2;
  const half = (Math.abs(c) * GFX.VW + Math.abs(s) * GFX.VH) / 2 + 20, span = (Math.abs(s) * GFX.VW + Math.abs(c) * GFX.VH) / 2 + 60;
  const x0 = cx - c * half, y0 = cy - s * half, dur = 2 * half / 150, reefs = [];
  for (let i = 0; i < 3; i++) { // 岩礁: 画面の中ほど(波の来る側から 30% 〜 80% の所)に。互いに少し離す
    let along = 0, side = 0;
    for (let k = 0; k < 8; k++) {
      along = rand(0.3, 0.8) * 2 * half; side = rand(-0.8, 0.8) * Math.min(span - 60, GFX.VW / 2);
      if (reefs.every(r => Math.abs(r.side - side) > 50 || Math.abs(r.along - along) > 70)) break;
    }
    const r = { kind: 'reef', x: x0 + c * along - s * side, y: y0 + s * along + c * side, along, side, th, r: 12, t: 0, dur: 1.2 + dur + 1, seed: (Math.random() * 1e6) | 0 };
    reefs.push(r); hazards.push(r);
    burst(r.x, r.y, 14, ['#3a4a50', '#5a6a6a', '#bff4ff'], { sp: 70, up: 40, g: 200 });
  }
  bfx.push({ kind: 'wavewarn', x: x0, y: y0, th, span, len: 2 * half, t: 0, life: 1.2 });
  AudioMan.charge(1.2); AudioMan.warning();
  hint('tsunami', '大津波', '岩礁の陰に入るか、ダッシュの無敵ですり抜けろ');
  later(e.ai, 1.2, () => { hazards.push({ kind: 'tsunami', x: x0, y: y0, th, span, reefs, d: 0, pd: 0, t: 0, dur, dmg: e.dmg, seed: (Math.random() * 1e6) | 0 }); AudioMan.splash(); AudioMan.roar(); shake(5); });
}
// 潜航・浮上: 潜っている 2.5秒(攻撃が当たらない)、円 半径 40 の影がプレイヤーを追い(速さ 60)、浮上の 0.5秒前に止まる → 浮上で ×1.3
function startLeviaDive(e, ai) {
  ai.act = 'dive'; ai.pt = 2.5; e.flying = e.hidden = true; e.air = true;
  ai.dw = chaseWarn({ kind: 'circle', x: e.x, y: e.y, r: 40, t: 0, life: 2.5 }, 2, 60);
  pushWarn(ai.dw);
  burst(e.x, e.y, 30, SPLASH, { sp: 110, up: 40, g: 200 }); AudioMan.splash();
  hint('dive', '潜航・浮上', '影が追ってくる。歩けば離せる');
}
function updLeviaDive(e, ai, dt) {
  ai.pt -= dt;
  const w = ai.dw;
  e.x = w.x; e.y = w.y; // 海竜は影の下を泳ぐ
  if (Math.random() < dt * 25) part(w.x + rand(-20, 20), w.y + rand(-14, 14), 0, -rand(10, 25), 0.5, pick(['#bff4ff', '#ffffff']), { drag: 1 }); // 泡
  if (ai.pt > 0) return;
  e.flying = e.hidden = false; e.air = false; ai.act = null; e.sq = 0.6;
  hitCircle(w.x, w.y, 40, e.dmg * 1.3);
  const R0 = 40 * CHAOS.area;
  burst(w.x, w.y, 60, SPLASH, { sp: 170, up: 80, g: 220, life: 0.8 }); addRing(w.x, w.y, R0, '#ffffff', { w: 3, life: 0.4 });
  shockAt(w.x, w.y, 1.8, 0.75); shake(10); AudioMan.splash(); AudioMan.boom();
}
// 水柱: プレイヤーの周り 120 の 3方向に 円 半径 16(0.8秒)→ 水柱 3本が 7秒、プレイヤーへゆっくり寄る(速さ 40)。触れると ×0.6・スタミナ −15(1本につき 1回)
function waterPillars(e, ai) {
  const a0 = rand(0, TAU), pts = [0, 1, 2].map(i => ({ x: P.x + Math.cos(a0 + TAU / 3 * i) * 120, y: P.y + Math.sin(a0 + TAU / 3 * i) * 120 }));
  for (const p of pts) pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 16, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { for (const p of pts) { addHazard('wpillar', p.x, p.y, { r: 16, dur: 7, dmg: e.dmg }); burst(p.x, p.y, 16, SPLASH, { sp: 80, up: 60, g: 160 }); } AudioMan.splash(); });
}
// 尾撃: 距離 60 以内で 0.5秒の扇(半径 70・±60°)→ ×0.9・スタミナ −20、海竜から 110 飛ばす
function leviaTail(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 70, h: 1.047, t: 0, life: 0.5 });
  windup(e, 0.5, () => {
    slashes.push({ x: e.x, y: e.y, a, r: 70 * CHAOS.area, t: 0, life: 0.26, span: 2.1, pal: SWING_PAL.enemy, enemy: true });
    if (inFan(e.x, e.y, a, 70, 1.047)) { if (hurtPlayer(e.dmg * 0.9)) drainSta(20); pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 110, 0.35); }
    burst(e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, 18, SPLASH, { sp: 110 }); AudioMan.splash(); shake(5);
  });
}
// 水流ブレス(激昂): 0.6秒の予告(プレイヤーへの帯)→ 1.5秒かけて 90° 薙ぐ
function leviaBreath(e, ai, a) {
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 220, w: 14, t: 0, life: 0.6, track: w => { w.x = e.x; w.y = e.y; } });
  AudioMan.charge(0.6);
  windup(e, 0.6, () => { ai.act = 'breath'; ai.pt = 0; ai.bdir = Math.random() < 0.5 ? 1 : -1; ai.ba0 = a - ai.bdir * Math.PI / 4; ai.bhit = false; AudioMan.roar(); });
}

// ---------- 霜の巨人: ゆっくり追う。凍傷を積んでから重い一撃。氷槌(凍て割り)/ 吹雪の風(氷塊の風下に隠れる)/ 雪崩 / 大雪玉 / 激昂: 地吹雪 ----------
const SNOW = ['#ffffff', '#e8f4ff', '#bff4ff', '#9fd8ff'];
function fgiantAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (dist > 28) { e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt; }
  if (Math.random() < dt * 6) part(e.x + rand(-10, 10), e.y + 12, rand(-6, 6), -rand(4, 10), 0.6, pick(SNOW), { drag: 1 }); // 足元の雪煙
  if (ai.glowT > 0) ai.glowT -= dt;
  ai.hammer -= dt * R; ai.blizz -= dt * R; ai.aval -= dt * R; ai.ball -= dt * R; if (ai.enraged) ai.drift -= dt * R;
  if (ai.hammer <= 0 && dist < 80) { ai.hammer = ai.enraged ? 3.5 : 4.5; giantHammer(e, ai, a); }
  else if (ai.blizz <= 0) { ai.blizz = ai.enraged ? 11 : 15; giantBlizzard(e, ai, a); }
  else if (ai.aval <= 0) { ai.aval = ai.enraged ? 9 : 12; avalanche(e, ai); }
  else if (ai.ball <= 0) { ai.ball = ai.enraged ? 7 : 9; bigSnowball(e, ai, a); }
  else if (ai.enraged && ai.drift <= 0) { ai.drift = 12; groundBlizzard(e, ai); }
}
// 氷槌: 0.9秒 前方に円 半径 45 → ×1.3・凍傷 +3。跡に氷塊(半径 14・HP 2%・10秒)と滑る床(半径 45・6秒)
// 凍て割り(プレイヤーの凍傷が 6 以上のとき、氷槌の代わりに): 1.1秒 前方に円 半径 60 → ×1.6・凍傷 +3
function giantHammer(e, ai, a) {
  const big = P.frost >= 6, R0 = big ? 60 : 45, off = big ? 34 : 28, T = big ? 1.1 : 0.9;
  const cx = e.x + Math.cos(a) * off, cy = e.y + Math.sin(a) * off;
  pushWarn({ kind: 'circle', x: cx, y: cy, r: R0, t: 0, life: T });
  e.sq = 1.3; ai.raise = T; AudioMan.charge(T);
  if (big) { hint('shatter', '凍て割り', '凍傷が 6 以上だと、氷槌がもっと重く広くなる'); AudioMan.frost(); }
  windup(e, T, () => {
    if (hitCircle(cx, cy, R0, e.dmg * (big ? 1.6 : 1.3))) frostPlayer(3);
    const RR = R0 * CHAOS.area;
    burst(cx, cy, big ? 70 : 45, [...SNOW, '#7ad7ff'], { sp: big ? 190 : 140, up: 60, g: 220, life: 0.7 });
    for (let i = 0; i < 10; i++) { const pa = TAU / 10 * i; bfx.push({ kind: 'icespike', x: cx + Math.cos(pa) * RR * 0.75, y: cy + Math.sin(pa) * RR * 0.75, t: 0, life: 0.8, h: rand(8, 14) }); } // 氷の棘が突き出る
    addRing(cx, cy, RR, '#bff4ff', { w: 3, life: 0.4 }); shockAt(cx, cy, big ? 2.2 : 1.6, 0.75); shake(big ? 12 : 8); hitstop(big ? 0.06 : 0.03);
    AudioMan.boom(); AudioMan.frost(); e.sq = 0.7; ai.raise = 0;
    addHazard('ice', cx, cy, { r: R0, dur: 6 });
    spawnObj(e, 'iceblock', cx, cy, { pct: 0.02, r: 14, life: 10 });
  });
}
// 吹雪の風: 1.0秒(画面に風の線)→ 5秒、巨人の向き(巨人 → プレイヤー)へ毎秒 45 押し、1秒ごとに凍傷 +1。氷塊の風下(幅 30・長さ 70)では受けない
function giantBlizzard(e, ai, a) {
  bfx.push({ kind: 'windwarn', x: 0, y: 0, th: a, t: 0, life: 1 });
  AudioMan.charge(1); AudioMan.blizz();
  hint('blizzard', '吹雪の風', '氷塊の風下に入れば、風も凍傷も受けない');
  later(ai, 1, () => { hazards.push({ kind: 'blizzard', x: e.x, y: e.y, th: a, t: 0, dur: 5, tick: 1, seed: (Math.random() * 1e6) | 0 }); AudioMan.blizz(); e.sq = 1.2; });
}
// 吹雪の風の風下: 氷塊の後ろ(幅 30・長さ 70)にいるか
function inLee(th) {
  const c = Math.cos(th), s = Math.sin(th), L = 70 * CHAOS.area, W = 15 * CHAOS.area;
  return enemies.some(o => o.obj === 'iceblock' && !o.dead && (() => { const al = (P.x - o.x) * c + (P.y - o.y) * s, sd = -(P.x - o.x) * s + (P.y - o.y) * c; return al > -o.r * 0.5 && al < L && Math.abs(sd) < W; })());
}
// 雪崩: 画面の片側から帯 5本(幅 28・すき間 26)が 0.3秒おきに順に光る(1.2秒)→ 各帯を雪の塊が速さ 130 で転がる。×1.0・凍傷 +3
function avalanche(e, ai) {
  const th = pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), c = Math.cos(th), s = Math.sin(th), A = CHAOS.area;
  const cx = cam.x + GFX.VW / 2, cy = cam.y + GFX.VH / 2, half = (Math.abs(c) * GFX.VW + Math.abs(s) * GFX.VH) / 2 + 24;
  const W = 28 * A, G = 26 * A, span = 5 * W + 4 * G, off = -span / 2 + W / 2 + rand(-(W + G) / 2, (W + G) / 2); // 帯の並びの位置は、プレイヤーを中心に少しずらす
  const pside = -(P.x - cx) * s + (P.y - cy) * c;
  const order = Math.random() < 0.5 ? [0, 1, 2, 3, 4] : [4, 3, 2, 1, 0];
  order.forEach((li, k) => {
    const side = pside + off + li * (W + G), x0 = cx - c * half - s * side, y0 = cy - s * half + c * side;
    later(ai, 0.3 * k, () => { pushWarn({ kind: 'line', x: x0, y: y0, a: th, len: 2 * half, w: W, t: 0, life: 1.2, fixed: true }); AudioMan.thud(); });
    later(ai, 0.3 * k + 1.2, () => { hazards.push({ kind: 'aval', x: x0, y: y0, th, len: 2 * half, w: W, d: 0, t: 0, dur: 2 * half / 130, dmg: e.dmg, seed: (Math.random() * 1e6) | 0 }); shake(3); AudioMan.boom(); });
  });
  AudioMan.warning();
  hint('avalanche', '雪崩', '光った帯を雪の塊が転がる。すき間に立て');
}
// 大雪玉: 0.6秒(経路の帯)→ 雪玉(半径 14)がプレイヤーへ転がる(速さ 120)。×1.0・凍傷 +2。激昂は 2個
function bigSnowball(e, ai, a) {
  const angs = ai.enraged ? [a - 0.3, a + 0.3] : [a];
  for (const aa of angs) pushWarn({ kind: 'line', x: e.x, y: e.y, a: aa, len: 300, w: 28, t: 0, life: 0.6 });
  e.sq = 1.25; AudioMan.charge(0.6);
  windup(e, 0.6, () => {
    for (const aa of angs) eprojs.push({ kind: 'bigsnow', x: e.x + Math.cos(aa) * 14, y: e.y + Math.sin(aa) * 14, vx: Math.cos(aa) * 120, vy: Math.sin(aa) * 120, dmg: e.dmg * (S.eatk ?? 1), frost: 2, life: 300 * CHAOS.area / 120, t: 0, r: 14 * CHAOS.area });
    e.sq = 0.75; shake(4); AudioMan.thud(); AudioMan.dash();
  });
}
// 地吹雪(激昂): 0.5秒 巨人の周りが白く光る → 巨人の周り 半径 70 に 4秒。中にいると 1秒ごとに凍傷 +1
function groundBlizzard(e, ai) {
  ai.glowT = 0.5; AudioMan.charge(0.5);
  later(ai, 0.5, () => { addHazard('drift', e.x, e.y, { r: 70, dur: 4, owner: e, tick: 1 }); AudioMan.blizz(); shockAt(e.x, e.y, 1.2, 0.9); });
}

// ---------- 雪華の女王: 距離 110 を保って滑るように回り込む。雪華弾 / 縮む氷輪 / 氷柱の墓標 / 吹雪の帳 / 雪華の輪舞 / 激昂: 氷の槍 ----------
function squeenAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if ((ai.flip = (ai.flip ?? 4) - dt) <= 0) { ai.flip = rand(3, 5); ai.side = -ai.side; }
  const dir = dist > 110 ? a : a + Math.PI, k = Math.abs(dist - 110) > 15 ? 1 : 0.2;
  e.x += (Math.cos(dir) * e.spd * k + Math.cos(a + Math.PI / 2) * e.spd * 0.9 * ai.side) * slow * dt;
  e.y += (Math.sin(dir) * e.spd * k + Math.sin(a + Math.PI / 2) * e.spd * 0.9 * ai.side) * slow * dt;
  if (Math.random() < dt * 14) part(e.x + rand(-6, 6), e.y + 10, rand(-8, 8), -rand(2, 8), 0.6, pick(SNOW), { glow: true, drag: 1 }); // 裾から雪の結晶がこぼれる
  ai.flake -= dt * R; ai.ring -= dt * R; ai.tomb -= dt * R; ai.veil -= dt * R; ai.dance -= dt * R; if (ai.enraged) ai.lance -= dt * R;
  if (ai.flake <= 0) { ai.flake = ai.enraged ? 2.5 : 3.5; snowFlakes(e); } // 弾はほかの技と並んで撃つ
  if (ai.tomb <= 0) { ai.tomb = ai.enraged ? 20 : 25; iceTomb(e, ai); }
  else if (ai.veil <= 0) { ai.veil = ai.enraged ? 13 : 18; frostVeil(e, ai); }
  else if (ai.ring <= 0) { ai.ring = ai.enraged ? 7 : 10; iceRing(e, ai); }
  else if (ai.dance <= 0) { ai.dance = ai.enraged ? 6 : 9; snowDance(e, ai); }
  else if (ai.enraged && ai.lance <= 0) { ai.lance = 6; iceLance(e, ai); }
}
// 雪華弾: 6方向に雪の結晶(速さ 55)。1秒後にそれぞれ 3つに割れる。×0.6・凍傷 +1
function snowFlakes(e) {
  const a0 = rand(0, TAU);
  for (let i = 0; i < 6; i++) Object.assign(eball(e.x, e.y - 4, a0 + TAU / 6 * i, 55, e.dmg * 0.6, 'flake'), { frost: 1, splitT: 1 });
  burst(e.x, e.y - 4, 12, SNOW, { sp: 50, glow: true, life: 0.35 }); AudioMan.chime();
}
// 縮む氷輪: 0.8秒 プレイヤーを中心に円 半径 90 → 氷の輪が 2秒かけて半径 90 → 0 へ縮む。輪に触れると ×1.0・凍傷 +2
function iceRing(e, ai) {
  const tx = P.x, ty = P.y;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 90, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { addHazard('icering', tx, ty, { r: 90, r0: 90 * CHAOS.area, dur: 2, dmg: e.dmg }); AudioMan.frost(); });
}
// 氷柱の墓標: 女王の頭上に大きな氷柱ができて空へ飛ぶ(0.6秒)→ 円 半径 44 の予告がプレイヤーを 1.5秒追い(速さ 70)、0.4秒止まる
//   → 氷柱が落ちて 半径 44 に ×1.3・凍傷 +3。氷柱は地面に刺さったまま残り(HP 8%・15秒)、まわり 半径 110 が滑る床(霜の巨人と同じ慣性)になる
//   氷柱を壊すと滑る床も消える。女王は動き続ける
function iceTomb(e, ai) {
  bfx.push({ kind: 'skyspear', x: e.x, y: e.y - 14, t: 0, life: 0.6, up: true });
  burst(e.x, e.y - 14, 20, SNOW, { sp: 70, glow: true, life: 0.4 }); AudioMan.charge(0.6); AudioMan.chime();
  later(ai, 0.6, () => {
    const w = chaseWarn({ kind: 'circle', x: P.x, y: P.y, r: 44, t: 0, life: 1.9 }, 1.5, 70);
    pushWarn(w); AudioMan.charge(1.9);
    hint('tomb', '氷柱の墓標', '落ちてくる氷柱の円から離れる。刺さった氷柱のまわりは滑る。氷柱を壊すと床も消える');
    later(ai, 1.65, () => bfx.push({ kind: 'skyspear', x: w.x, y: w.y, t: 0, life: 0.25, up: false })); // 空から落ちてくる
    later(ai, 1.9, () => {
      const x = w.x, y = w.y, R0 = 44 * CHAOS.area;
      if (hitCircle(x, y, 44, e.dmg * 1.3)) frostPlayer(3);
      burst(x, y, 50, [...SNOW, '#ffffff'], { sp: 150, up: 40, glow: true, life: 0.6 }); addRing(x, y, R0, '#bff4ff', { w: 3, life: 0.4 });
      for (let k = 0; k < 8; k++) { const pa = TAU / 8 * k; bfx.push({ kind: 'icespike', x: x + Math.cos(pa) * R0 * 0.6, y: y + Math.sin(pa) * R0 * 0.6, t: 0, life: 0.7, h: rand(8, 13) }); }
      shockAt(x, y, 2, 0.75); shake(10); hitstop(0.05); AudioMan.boom(); AudioMan.frost();
      const o = spawnObj(e, 'tomb', x, y, { pct: 0.08, r: 9, life: 15 });
      addHazard('ice', x, y, { r: 110, dur: 15 }).spire = o; // 滑る床: 氷柱が砕けたら一緒に消える
    });
  });
}
// 吹雪の帳: 1.0秒 画面の縁が白く凍る → 6秒かけて凍った範囲が縁から毎秒 25(激昂 30)で迫る(最後はプレイヤーの周り 半径 110 が残る)。中にいると 0.5秒ごとに凍傷 +2・×0.2
function frostVeil(e, ai) {
  const cx = P.x, cy = P.y, R0 = Math.hypot(GFX.VW, GFX.VH) / 2;
  bfx.push({ kind: 'veilwarn', x: cx, y: cy, R: R0, t: 0, life: 1 });
  AudioMan.charge(1); AudioMan.blizz();
  hint('veil', '吹雪の帳', '画面の縁から凍りつく。真ん中に残れ');
  later(ai, 1, () => hazards.push({ kind: 'veil', x: cx, y: cy, R: R0, Rmin: 110, spd: ai.enraged ? 30 : 25, t: 0, dur: 6, tick: 0.5, dmg: e.dmg * 0.2, seed: (Math.random() * 1e6) | 0 }));
}
// 雪華の輪舞: 円 3個(半径 30)が、使ったときのプレイヤーの位置から 75 の距離を回る(毎秒 1.5rad で 2秒、最後の 1秒でイージングで止まる)→ 止まって 0.3秒後に ×1.0・凍傷 +2
//   回る中心は使ったときの位置に固定(プレイヤーについて回ると、円が重ならず当たらないため)
const DANCE_R = 75, danceAng = t => (t < 2 ? 1.5 * t : 3 + 1.5 * (Math.min(1, t - 2) - Math.pow(Math.min(1, t - 2), 2) / 2)); // 回った角度(最後の 1秒は速さが 1.5 → 0 へ)
function snowDance(e, ai) {
  const a0 = rand(0, TAU), ws = [], cx = P.x, cy = P.y;
  bfx.push({ kind: 'dance', x: cx, y: cy, t: 0, life: 3.3 });
  for (let i = 0; i < 3; i++) {
    const w = { kind: 'circle', x: cx, y: cy, r: 30, t: 0, life: 3.3, dance: true };
    w.track = q => { const aa = a0 + TAU / 3 * i + danceAng(Math.min(3, q.t)); q.x = cx + Math.cos(aa) * DANCE_R; q.y = cy + Math.sin(aa) * DANCE_R; };
    w.track(w); pushWarn(w); ws.push(w);
  }
  AudioMan.chime();
  later(ai, 3.3, () => {
    let hit = false;
    for (const w of ws) {
      if (!hit && hitCircle(w.x, w.y, 30, e.dmg)) { hit = true; frostPlayer(2); }
      burst(w.x, w.y, 28, SNOW, { sp: 110, glow: true, life: 0.45 }); addRing(w.x, w.y, 30 * CHAOS.area, '#bff4ff', { w: 2, life: 0.3 });
      for (let k = 0; k < 6; k++) { const pa = TAU / 6 * k; bfx.push({ kind: 'icespike', x: w.x + Math.cos(pa) * 15 * CHAOS.area, y: w.y + Math.sin(pa) * 15 * CHAOS.area, t: 0, life: 0.6, h: rand(7, 11) }); }
    }
    shake(4); AudioMan.frost(); AudioMan.thud();
  });
}
// 氷の槍(激昂): 女王からプレイヤーへの帯(長さ 240・幅 10)が 0.9秒追い、0.3秒止まる → 氷の槍(速さ 300)。×1.2・凍傷 +3、当たると 1秒 凍結(歩けない)
function iceLance(e, ai) {
  const w = { kind: 'line', x: e.x, y: e.y, a: Math.atan2(P.y - e.y, P.x - e.x), len: 240, w: 10, t: 0, life: 1.2 };
  w.track = q => { if (q.t < 0.9) { q.x = e.x; q.y = e.y; q.a = Math.atan2(P.y - e.y, P.x - e.x); } };
  pushWarn(w);
  AudioMan.charge(1.2);
  later(ai, 1.2, () => {
    eprojs.push({ kind: 'ispear', x: w.x, y: w.y, vx: Math.cos(w.a) * 300, vy: Math.sin(w.a) * 300, dmg: e.dmg * 1.2 * (S.eatk ?? 1), frost: 3, freeze: 1, life: w.len / 300, t: 0, r: 5 * CHAOS.area });
    burst(w.x, w.y, 14, SNOW, { sp: 90, glow: true, life: 0.35 }); AudioMan.spearThrow(); AudioMan.frost();
    hint('lance', '氷の槍', '当たると 1秒 凍結して歩けなくなる(回避は使える)');
  });
}

// ---------- 時計仕掛けの番人: プレイヤーへまっすぐ。ゼンマイ巻き(DPSチェック)/ 時針と分針 / 歯車弾 / 鐘の衝撃 / 大歯車 / 歯車の床 / 激昂: 振り子 ----------
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
  if (ai.pend) { // 振り子(激昂): 0.8秒 薄い帯 → 帯(長さ 210・幅 14)が ±70° を 1.6秒周期で振れる。5秒、当たると ×0.9
    const pd = ai.pend;
    pd.t += dt;
    pd.a = pd.base + (pd.t > 0.8 ? 1.2217 * Math.sin((pd.t - 0.8) * TAU / 1.6) : 0);
    if (pd.t > 0.8) { hitLine(e.x, e.y, pd.a, 210, 14, e.dmg * 0.9); if (Math.abs(Math.cos((pd.t - 0.8) * TAU / 1.6)) > 0.98 && (pd.snd = (pd.snd || 0) - dt) <= 0) { pd.snd = 0.3; AudioMan.slash(); } }
    if (pd.t >= 5.8) ai.pend = null;
  }
  ai.spring -= dt * R; ai.handCd -= dt * R; ai.cog -= dt * R; ai.bell -= dt * R; ai.big -= dt * R; ai.floor -= dt * R; if (ai.enraged) ai.pendCd -= dt * R;
  if (ai.spring <= 0 && !ai.hands && !ai.pend) { ai.spring = ai.enraged ? 16 : 22; startSpring(e, ai); return; }
  if (ai.cog <= 0) { ai.cog = ai.enraged ? 4 : 5; cogShot(e, ai); } // 弾はほかの技と並んで撃つ
  if (ai.handCd <= 0 && !ai.hands && !ai.pend) { ai.handCd = ai.enraged ? 7 : 9; ai.hands = { t: 0, a1: a + Math.PI, a2: a + 0.9 }; for (const ha of [ai.hands.a1, ai.hands.a2]) pushWarn({ kind: 'line', x: e.x, y: e.y, a: ha, len: 180, w: 10, t: 0, life: 1, track: w => { w.x = e.x; w.y = e.y; } }); AudioMan.charge(1); hint('hands', '時針と分針', '2本の針が番人のまわりを回る'); }
  else if (ai.big <= 0) { ai.big = ai.enraged ? 8 : 10; bigGear(e, ai, a); }
  else if (ai.floor <= 0) { ai.floor = ai.enraged ? 9 : 12; gearFloors(e, ai); }
  else if (ai.bell <= 0) { ai.bell = ai.enraged ? 8 : 10; bellShock(e, ai); }
  else if (ai.enraged && ai.pendCd <= 0 && !ai.hands && !ai.pend) { ai.pendCd = 12; ai.pend = { t: 0, base: a, a }; pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 210, w: 14, t: 0, life: 0.8, track: w => { w.x = e.x; w.y = e.y; } }); AudioMan.charge(0.8); }
}
// ゼンマイ巻き: 背中のゼンマイが回り始める → 4秒 動かず巻き上げる(被ダメ ×1.3)。4秒で最大HP の 5% を削ると 2秒止まる。削れなければ 10秒 全速
function startSpring(e, ai) {
  ai.act = 'spring'; ai.pt = 4; ai.armHp = e.hp; ai.armK = 0; e.takeK = 1.3; ai.hands = null; ai.pend = null;
  AudioMan.charge(0.6); shake(4);
  hint('spring', 'ゼンマイ巻き', '4秒で最大HP の 5% を削ると止まる。削れないと全速になる');
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
      UI.announce('ゼンマイが止まった!', '2秒 動けない');
    } else if (ai.pt <= 0) { // 巻き切った: 10秒 全速
      ai.act = null; e.takeK = 1; ai.fastT = 10; e.spd *= 1.6;
      burst(e.x, e.y, 40, ['#ff8a3d', '#fff0c8', '#c8a050'], { sp: 140, glow: true });
      shake(9); AudioMan.roar(); screenFlash(0.25, '#ff8a3d');
      UI.announce('番人が全速になった!', '10秒 速さ ×1.6・技の間隔 ×0.6');
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
  });
  hint('bell', '鐘の衝撃', '輪に触れると外へ押される');
}
// 大歯車: 0.7秒(経路の帯)→ 半径 30 の歯車が速さ 90 で転がり、画面の縁(闘技場では壁)で 2回はね返る(8秒)。×1.0・触れると 1秒 移動速度 ×0.6。HP 3% で壊せる
function bigGear(e, ai, a) {
  pushWarn({ kind: 'line', x: e.x, y: e.y, a, len: 260, w: 60, t: 0, life: 0.7, fixed: true });
  e.sq = 1.25; AudioMan.charge(0.7);
  windup(e, 0.7, () => {
    const o = spawnObj(e, 'biggear', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20, { pct: 0.03, r: 30, life: 8 });
    o.vx = Math.cos(a) * 90; o.vy = Math.sin(a) * 90; o.bounce = 2; o.rise = 1;
    shake(6); AudioMan.boom(); e.sq = 0.75;
    hint('biggear', '大歯車', '縁ではね返る。壊すこともできる');
  });
}
// 歯車の床: 0.8秒(床に歯車の模様)→ プレイヤーの位置と、そこから 120 離れた位置に、回る歯車の床(半径 50)を 8秒。上にいると回る向きへ流される(毎秒 50)
function gearFloors(e, ai) {
  const ga = rand(0, TAU), pts = [{ x: P.x, y: P.y }, { x: P.x + Math.cos(ga) * 120, y: P.y + Math.sin(ga) * 120 }];
  pts.forEach((p, i) => {
    pushWarn({ kind: 'circle', x: p.x, y: p.y, r: 50, t: 0, life: 0.8 });
    addHazard('gearfloor', p.x, p.y, { r: 50, dur: 8, delay: 0.8, dir: i ? -1 : 1, seed: (Math.random() * 1e6) | 0 });
  });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { AudioMan.tick(0); AudioMan.thud(); hint('gearfloor', '歯車の床', '回る向きへ流される'); });
}

// ---------- 死神・第一形態: プレイヤーへまっすぐ。瞬間移動 / 死の宣告 / 鎌投げ / 刈り取り / スロウタイム / 砂時計 / 激昂: 時計兵召喚 ----------
const REAP = ['#c29bff', '#2b1b4a', '#ffffff', '#6a4ab0'];
function reaperAI(e, ai, dt, a, dist, slow) {
  const glass = enemies.some(o => o.owner === e && o.obj === 'sandglass' && !o.dead), R = CHAOS.rate / (glass ? 0.75 : 1); // 砂時計が立っている間は技の間隔 ×0.75
  if (ai.tpTo) { // 瞬間移動: 消えて、出現位置に現れる(現れたときの攻撃はなし)。この間は止まる
    ai.tpTo.t -= dt; e.hideA = Math.max(0.15, ai.tpTo.t / 0.55);
    if (ai.tpTo.t <= 0) {
      burst(e.x, e.y, 24, REAP, { sp: 100, glow: true });
      e.x = ai.tpTo.x; e.y = ai.tpTo.y; ai.tpTo = null; e.hideA = 1;
      burst(e.x, e.y, 24, ['#c29bff', '#ffffff'], { sp: 100, glow: true }); shockAt(e.x, e.y, 1, 1); AudioMan.zap(); screenFlash(0.1, '#c29bff');
    }
    return;
  }
  e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
  ai.tp -= dt * R; ai.mark -= dt * R; ai.throw -= dt * R; ai.reap -= dt * R; ai.clock -= dt * R; ai.glass -= dt * R; if (ai.enraged) ai.sum -= dt * R;
  if (ai.throw <= 0) { // 鎌投げ: 投げた大鎌が減速して死神のもとへ戻ってくる(ほかの技と並んで)
    ai.throw = ai.enraged ? 3.4 : 5.5;
    if (ai.enraged) { boomerang(e, a - 0.35); boomerang(e, a + 0.35); } else boomerang(e, a);
    AudioMan.slash(); burst(e.x, e.y, 10, ['#c29bff', '#ffffff'], { sp: 60, glow: true });
  }
  if (ai.tp <= 0) {
    ai.tp = ai.enraged ? 3.8 : 6;
    const ta = rand(0, TAU), tr = rand(60, 90);
    ai.tpTo = { x: P.x + Math.cos(ta) * tr, y: P.y + Math.sin(ta) * tr, t: 0.55 };
    pushWarn({ kind: 'circle', x: ai.tpTo.x, y: ai.tpTo.y, r: 20, t: 0, life: 0.55, fixed: true }); // 出現位置の目印(範囲攻撃ではない)
  } else if (ai.mark <= 0) { ai.mark = ai.enraged ? 8 : 12; deathMark(e, ai); }
  else if (ai.reap <= 0 && dist < 60) { ai.reap = ai.enraged ? 3.5 : 5; reaperReap(e, ai, a); }
  else if (ai.clock <= 0) { // スロウタイム: 死神についてくる時計盤(半径 80・5秒)
    ai.clock = ai.enraged ? 9 : 14;
    addHazard('clock', e.x, e.y, { owner: e, r: 80, dur: 5 });
    AudioMan.charge(0.5); shockAt(e.x, e.y, 1.2, 0.6); screenFlash(0.15, '#c29bff');
    hint('clock', 'スロウタイム', '範囲内は移動速度とクールダウンが低下');
  } else if (ai.glass <= 0) { ai.glass = 20; sandglassDrop(e, ai); }
  else if (ai.enraged && ai.sum <= 0) { // 時計兵召喚(激昂)
    ai.sum = 6;
    for (let i = 0; i < 3; i++) { const sa = TAU / 3 * i, c = spawnEnemy('clockman', { x: e.x + Math.cos(sa) * 22, y: e.y + Math.sin(sa) * 22 }); c.noChest = true; burst(c.x, c.y, 10, ['#ffd27a', '#c8a050', '#c29bff'], { sp: 60, glow: true }); }
    AudioMan.summon();
  }
}
// 死の宣告: 紫の印がプレイヤーの足元を 4秒追い(速さ 50)、最後の 0.5秒で赤く止まる → 止まった位置に 円 半径 44 で ×1.5
function deathMark(e, ai) {
  const m = { kind: 'deathmark', x: P.x, y: P.y, t: 0, life: 4.3 };
  m.track = (f, dt) => { if (f.t < 3.5) { const d = Math.sqrt(d2(f.x, f.y, P.x, P.y)), k = Math.min(d, 50 * dt); if (d > 0.01) { f.x += (P.x - f.x) / d * k; f.y += (P.y - f.y) / d * k; } } };
  bfx.push(m);
  later(ai, 3.5, () => { pushWarn({ kind: 'circle', x: m.x, y: m.y, r: 44, t: 0, life: 0.5 }); AudioMan.charge(0.5); });
  later(ai, 4, () => {
    hitCircle(m.x, m.y, 44, e.dmg * 1.5);
    const R0 = 44 * CHAOS.area;
    burst(m.x, m.y, 50, REAP, { sp: 150, glow: true, life: 0.6 }); addRing(m.x, m.y, R0, '#c29bff', { w: 3, life: 0.4 }); addFlash(m.x, m.y, R0 * 2.5, '#c29bff', 0.5);
    shockAt(m.x, m.y, 1.8, 0.8); shake(8); AudioMan.knell(); AudioMan.boom();
  });
  AudioMan.knell();
  hint('deathmark', '死の宣告', '印は 4秒 足元を追い、最後に止まって炸裂する');
}
// 刈り取り: 距離 60 以内で 0.4秒 前方の扇(半径 65・±70°)→ ×0.8・出血 +2
function reaperReap(e, ai, a) {
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 65, h: 1.22, t: 0, life: 0.4 });
  windup(e, 0.4, () => {
    slashes.push({ x: e.x, y: e.y, a, r: 65 * CHAOS.area, t: 0, life: 0.26, span: 2.44, pal: SWING_PAL.enemy, enemy: true });
    if (hitFan(e.x, e.y, a, 65, 1.22, e.dmg * 0.8)) bleedPlayer(2);
    AudioMan.slash(); shake(3);
  });
}
// 砂時計: プレイヤーから 110 に砂時計が落ちてくる(HP 8%・12秒)。立っている間 死神の技の間隔 ×0.75。壊すと死神が 1.5秒ひるむ
function sandglassDrop(e, ai) {
  const ga = rand(0, TAU), x = P.x + Math.cos(ga) * 110, y = P.y + Math.sin(ga) * 110;
  pushWarn({ kind: 'circle', x, y, r: 12, t: 0, life: 0.6, fixed: true });
  later(ai, 0.6, () => {
    const o = spawnObj(e, 'sandglass', x, y, { pct: 0.08, r: 9, life: 12 }); o.dropT = 0.35;
    hint('sandglass', '砂時計', '立っている間 死神の技が速くなる。壊すと死神がひるむ');
  });
  AudioMan.charge(0.6);
}

// ---------- 死神の変身: 第一形態を倒すと 2秒 時が止まり(画面が色あせる)、同じ場所で終刻の死神になる ----------
function startReaperMorph(e) {
  e.morphed = true; e.hp = 1; e.invuln = true; e.hideA = 1;
  for (const o of enemies) if (o.owner === e && !o.dead) { o.dead = true; if (o.obj) objDown(o, false); }
  eprojs = []; warns = []; hazards = []; bfx = []; P.push = null; P.rootT = 0; e.ai.q = []; e.ai.wind = 0; S.tstop = 0; S.madClock = null; S.rewind = 0;
  S.morph = { e, t: 2 };
  hitstop(0.1); shake(10); screenFlash(0.5, '#ffffff'); AudioMan.knell(); AudioMan.hum(2);
  UI.announce('時が止まる…', '');
}
function updMorph(rdt) { // main.js の update から(この間はほかのすべてが止まる)
  const m = S.morph;
  m.t -= rdt;
  GFX.fx.sat = lerp(GFX.fx.sat, 0.08, Math.min(1, rdt * 4));
  if (Math.random() < rdt * 30) { const pa = rand(0, TAU), pr = rand(10, 40); part(m.e.x + Math.cos(pa) * pr, m.e.y + Math.sin(pa) * pr, -Math.cos(pa) * pr * 2, -Math.sin(pa) * pr * 2, 0.4, pick(['#ff3b5c', '#c29bff', '#ffffff']), { glow: true, drag: 0 }); }
  if (m.t > 0) return;
  const e = m.e;
  S.morph = null; GFX.fx.sat = 1; e.dead = true;
  const partner = (S.bosses || []).filter(b => b !== e && !b.dead), wasMain = S.boss === e;
  const f = spawnBoss('fhour', e.final, true);
  f.x = e.x; f.y = e.y;
  S.bosses = wasMain ? [f, ...partner] : [...partner, f]; S.boss = S.bosses[0]; UI.bossBar(S.boss);
  burst(f.x, f.y, 120, ['#ff3b5c', '#1a0a14', '#c8a050', '#ffffff'], { sp: 220, glow: true, life: 1.2 });
  addRing(f.x, f.y, 120, '#ff3b5c', { w: 3, life: 0.7 }); addFlash(f.x, f.y, 240, '#ff3b5c', 1);
  shockAt(f.x, f.y, 3, 0.6); shake(16); hitstop(0.12); screenFlash(0.6, '#ff3b5c'); AudioMan.roar(); AudioMan.boom();
}

// ---------- 時の操作(終刻の死神): 時間停止(敵の弾が止まる)/ 狂い時計(弾の進みが不規則)/ 逆戻し(終刻の時計を壊せなかった) ----------
// 敵の弾の時間の倍率(0 = 止まる、負 = 巻き戻る)。死神とプレイヤーの動きは変わらない
function eprojTimeK() {
  if (S.tstop > 0) return 0;
  if (S.rewind > 0) return -1.5;
  const m = S.madClock;
  if (!m) return 1;
  if (m.mode === 'surge') { const u = m.t % 1; return u < 0.7 ? 2.5 * Math.pow(1 - u / 0.7, 2) : 0; } // 急加速と停止: ×2.5 → 0.7秒かけて止まる → 0.3秒待つ
  if (m.mode === 'rewind') return m.t < 1 ? 1 - m.t : -1; // 停止と巻き戻し: 1秒で止まる → 逆向きに ×1
  return Math.floor(m.t / 2) % 2 ? 2 : 0.5; // 緩急: ×0.5 と ×2.0 を 2秒ごとに
}
function updTimeMods(dt) {
  if (S.tstop > 0) { S.tstop -= dt; GFX.fx.sat = lerp(GFX.fx.sat, 0.35, Math.min(1, dt * 6)); if (S.tstop <= 0) { GFX.fx.sat = 1; AudioMan.zap(); screenFlash(0.2, '#ffffff'); } }
  if (S.rewind > 0) { S.rewind -= dt; GFX.fx.sat = lerp(GFX.fx.sat, 0.3, Math.min(1, dt * 6)); if (S.rewind <= 0) GFX.fx.sat = 1; }
  if (S.madClock && (S.madClock.t += dt) >= S.madClock.dur) S.madClock = null;
}

// ---------- 終刻の死神: プレイヤーへまっすぐ(速い)。技は1つずつ、技のあと 1秒(激昂 0.7秒)あける ----------
//   刻の大鎌 / スロウタイム・リバース / 時間停止 / 十二の刻印 / 秒針の弾幕 / 狂い時計(弾の技のあとに続くことがある)/ 終刻(残りHP 50% で1回)/ 激昂: デッドクロス
function fhourAI(e, ai, dt, a, dist, slow) {
  const R = CHAOS.rate;
  if (!ai.finale && e.hp < e.maxhp * 0.5) { ai.finale = true; startFinale(e, ai); }
  if (ai.healT > 0) { const k = Math.min(ai.healT, dt); e.hp = Math.min(e.maxhp, e.hp + e.maxhp * 0.3 * k / 1.5); ai.healT -= dt; S.hudDirty = true; } // 逆戻し: 1.5秒で HP 30% を取り戻す
  if (!e.hidden) { // 十二の刻印で消えている間は動かず、霧も出さない
    e.x += Math.cos(a) * e.spd * slow * dt; e.y += Math.sin(a) * e.spd * slow * dt;
    if (Math.random() < dt * 10) part(e.x + rand(-6, 6), e.y + rand(-4, 10), rand(-6, 6), -rand(10, 25), 0.6, pick(['#ff3b5c', '#1a0a14', '#c8a050']), { glow: Math.random() < 0.4, drag: 1 }); // 赤黒い霧
  }
  ai.scy -= dt * R; ai.rev -= dt * R; ai.stop -= dt * R; ai.marks -= dt * R; ai.sec -= dt * R; if (ai.enraged) ai.cross -= dt * R;
  if (ai.busy > 0) { if ((ai.busy -= dt) <= 0) ai.gap = ai.enraged ? 0.7 : 1; return; } // 技の途中
  if (ai.gap > 0) { ai.gap -= dt; return; } // 技のあとの間
  const doom = enemies.some(o => o.owner === e && o.obj === 'doom' && !o.dead);
  if (ai.enraged && ai.cross <= 0 && !doom) { ai.cross = 15; deadCross(e, ai); }
  else if (ai.stop <= 0 && !doom) { ai.stop = ai.enraged ? 12 : 16; timeStop(e, ai); } // 逆戻し(終刻の時計を壊せなかった)の間も使う
  else if (ai.marks <= 0) { ai.marks = ai.enraged ? 12 : 15; twelveMarks(e, ai); }
  else if (ai.rev <= 0) { ai.rev = ai.enraged ? 10 : 14; slowReverse(e, ai); }
  else if (ai.sec <= 0) { ai.sec = ai.enraged ? 5 : 7; secondHand(e, ai); }
  else if (ai.scy <= 0 && dist < 90) { ai.scy = ai.enraged ? 2.5 : 3.5; hourScythe(e, ai, a); }
}
// 狂い時計: 弾を飛ばす技のあと 50%(激昂 70%)で続く。0.4秒(針が狂ったように回る・画面の縁が紫に揺れる)→ 6秒、画面にある敵の弾すべての進みを不規則に
function maybeMadClock(e, ai) {
  if (Math.random() >= (ai.enraged ? 0.7 : 0.5)) return;
  ai.busy = Math.max(ai.busy, 0.5);
  bfx.push({ kind: 'madwarn', x: 0, y: 0, t: 0, life: 0.4 });
  for (let i = 0; i < 8; i++) later(ai, i * 0.05, () => AudioMan.tick(8 + i));
  later(ai, 0.4, () => {
    S.madClock = { mode: pick(['surge', 'rewind', 'swing']), t: 0, dur: 6 };
    AudioMan.zap(); screenFlash(0.15, '#c29bff');
    hint('madclock', '狂い時計', '弾の進みが狂う(青 = 止まる・赤 = 速い・紫 = 巻き戻る)');
  });
}
// 刻の大鎌: 0.6秒 前方の扇(半径 75・±80°)→ 2回続けて斬る(0.25秒おき、×0.7、無敵無視)。斬る度に鎌を 4つ飛ばす(×0.7)
function hourScythe(e, ai, a) {
  ai.busy = 1.2;
  pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 75, h: 1.396, t: 0, life: 0.6, track: w => { w.x = e.x; w.y = e.y; } });
  AudioMan.charge(0.6);
  windup(e, 0.6, () => {
    for (let k = 0; k < 2; k++) later(ai, k * 0.25, () => {
      slashes.push({ x: e.x, y: e.y, a, r: 75 * CHAOS.area, t: 0, life: 0.24, span: 2.8, pal: SWING_PAL.enemy, enemy: true, rev: k === 1 });
      hitFan(e.x, e.y, a, 75, 1.396, e.dmg * 0.7, { pierce: true });
      for (let i = 0; i < 4; i++) eball(e.x, e.y, a + (i - 1.5) * 0.3, 100, e.dmg * 0.7, 'rscythe');
      AudioMan.slash(); shake(4);
    });
  });
}
// スロウタイム・リバース: 死神についてくる時計盤(半径 80)を 6秒。最初の 3秒は中が遅く、3秒たつと外が遅くなる(反転の 1秒前に針が逆回り・縁が点滅)
function slowReverse(e, ai) {
  ai.busy = 0.5;
  addHazard('clock', e.x, e.y, { owner: e, r: 80, dur: 6, rev: 3 });
  AudioMan.charge(0.5); shockAt(e.x, e.y, 1.2, 0.6); screenFlash(0.15, '#c29bff');
  hint('reverse', 'スロウタイム・リバース', '3秒たつと逆に、時計盤の外が遅くなる');
}
// 時間停止: 1秒(時計の音・画面が白く光る)→ 1.5秒 敵の弾が止まり、その間にプレイヤーの周り(半径 90)に鎌 12本が並ぶ。時が動き出すと中心へ飛ぶ(×0.7)
function timeStop(e, ai) {
  ai.busy = 3.2;
  for (let i = 0; i < 4; i++) later(ai, i * 0.25, () => AudioMan.tick(i * 3));
  AudioMan.charge(1);
  later(ai, 1, () => {
    S.tstop = 1.5; screenFlash(0.5, '#ffffff'); AudioMan.knell(); shake(4);
    const cx = P.x, cy = P.y, a0 = rand(0, TAU);
    for (let i = 0; i < 12; i++) later(ai, i * 0.08, () => { // 止まった時の中で、鎌が 1本ずつ並ぶ
      const sa = a0 + TAU / 12 * i, x = cx + Math.cos(sa) * 90, y = cy + Math.sin(sa) * 90;
      Object.assign(eball(x, y, sa + Math.PI, 150, e.dmg * 0.7, 'rscythe'), { life: 1.3 });
      burst(x, y, 6, ['#ff3b5c', '#ffffff'], { sp: 30, glow: true, life: 0.3 }); AudioMan.tick(10);
    });
    hint('timestop', '時間停止', '時が動き出すと、並んだ鎌が中心へ飛ぶ');
  });
  later(ai, 2.5, () => maybeMadClock(e, ai));
}
// 十二の刻印: 死神が消える → プレイヤーのいた位置に 円 半径 30(1秒)→ 死神がそこに現れて斬る(×1.2)
//   → 斬り終えたら(0.35秒)、0.5秒 死神から時計の 12方向へ帯(長さ 150・幅 12)→ 12時の方向(上)から時計回りに 0.1秒おきに炸裂(×0.8)
function twelveMarks(e, ai) {
  ai.busy = 3.25;
  const x0 = P.x, y0 = P.y;
  bfx.push({ kind: 'afterimg', spr: 'fhour', x: e.x, y: e.y - (e.jz || 0), flip: (e.face || 1) < 0, t: 0, life: 0.4 }); // 溶けるように消える残像
  e.flying = e.hidden = e.air = true; // 消える(攻撃が当たらない・触れても当たらない)
  burst(e.x, e.y, 40, ['#ff3b5c', '#1a0a14', '#c8a050'], { sp: 120, glow: true, life: 0.5 }); addFlash(e.x, e.y, 80, '#ff3b5c', 0.5); AudioMan.dash(); AudioMan.knell();
  pushWarn({ kind: 'circle', x: x0, y: y0, r: 30, t: 0, life: 1 });
  AudioMan.charge(1);
  hint('marks', '十二の刻印', '死神が円に現れて斬る。そのあと 12方向の帯が 12時から順に炸裂する');
  later(ai, 0.7, () => { for (let i = 0; i < 28; i++) { const pa = TAU / 28 * i, r = rand(40, 55); part(x0 + Math.cos(pa) * r, y0 + Math.sin(pa) * r, -Math.cos(pa) * r / 0.3, -Math.sin(pa) * r / 0.3, 0.3, pick(['#ff3b5c', '#1a0a14', '#c8a050']), { glow: true, drag: 0 }); } }); // 現れる前: 赤黒い霧が円へ集まる
  later(ai, 1, () => { // 現れて、大鎌を一回転させて斬る
    e.x = x0; e.y = y0; e.flying = e.hidden = e.air = false; e.sq = 0.6; e.flash = 0.12;
    const R0 = 30 * CHAOS.area;
    hitCircle(x0, y0, 30, e.dmg * 1.2);
    bfx.push({ kind: 'spincut', x: x0, y: y0, a0: rand(0, TAU), dir: Math.random() < 0.5 ? 1 : -1, r: R0 + 8, t: 0, life: 0.45 });
    burst(x0, y0, 30, ['#ff3b5c', '#ffffff', '#8e0016'], { sp: 150, glow: true, life: 0.4 }); shockAt(x0, y0, 1.4, 0.8); shake(7); hitstop(0.04); AudioMan.slash(); AudioMan.cutHit(); AudioMan.boom();
    later(ai, 0.35, () => { // 斬り終えてから 12方向の帯
      for (let i = 0; i < 12; i++) {
        const ma = -Math.PI / 2 + TAU / 12 * i;
        pushWarn({ kind: 'line', x: x0, y: y0, a: ma, len: 150, w: 12, t: 0, life: 0.5 + 0.1 * i });
        later(ai, 0.5 + 0.1 * i, () => {
          hitLine(x0, y0, ma, 150, 12, e.dmg * 0.8);
          bfx.push({ kind: 'pillar', x: x0, y: y0, a: ma, len: 150 * CHAOS.area, w: 12 * CHAOS.area, t: 0, life: 0.35 });
          AudioMan.tick(i); if (i % 3 === 0) { AudioMan.boom(); shake(3); }
        });
      }
      AudioMan.charge(0.5);
    });
  });
}
// 秒針の弾幕: 2秒(周りに時計の目盛り 12個が光る)→ 12方向に弾を 0.2秒おきに 5回(激昂 8回)。1回ごとに 6°ずつ時計回りにずらす(速さ 65、×0.8)
//   射程は約 2300(弾の寿命 35秒。ほかの弾の 5倍)
function secondHand(e, ai) {
  const n = ai.enraged ? 8 : 5, a0 = -Math.PI / 2, W = 2;
  ai.busy = W + n * 0.2; ai.secGlow = W;
  AudioMan.charge(W);
  later(ai, W, () => { ai.secGlow = 0; });
  for (let k = 0; k < n; k++) later(ai, W + k * 0.2, () => {
    for (let i = 0; i < 12; i++) eball(e.x, e.y - 4, a0 + TAU / 12 * i + k * 0.1047, 65, e.dmg * 0.8, 'tick').life = 35;
    AudioMan.tick(k);
  });
  later(ai, W + n * 0.2, () => maybeMadClock(e, ai));
}
// 終刻(残りHP 50% を下回ったときに 1回): プレイヤーから 120、死神と反対側に時計(HP 12%)。12秒以内に壊すと死神が 3秒ひるむ。壊せないと逆戻し(1.5秒)で HP 30% 回復
function startFinale(e, ai) {
  const d = Math.sqrt(d2(e.x, e.y, P.x, P.y)) || 1, x = P.x + (P.x - e.x) / d * 120, y = P.y + (P.y - e.y) / d * 120;
  const o = spawnObj(e, 'doom', x, y, { pct: 0.12, r: 16, life: 12 }); o.scale = 2; // 大きな柱時計
  burst(x, y, 40, ['#ff3b5c', '#c8a050', '#ffffff'], { sp: 120, glow: true, life: 0.6 }); shockAt(x, y, 1.6, 0.8); shake(8); AudioMan.knell(); AudioMan.warning();
  UI.announce('終刻', '12秒以内に時計を壊せ');
  return o;
}
// 終刻の時計を壊せなかった: 全ての時が止まり逆戻しの演出(1.5秒)、その間に死神の HP が 30% 回復する
function finaleRewind(e) {
  if (e.dead) return;
  S.rewind = 1.5; e.ai.healT = 1.5;
  screenFlash(0.6, '#c29bff'); shake(10); AudioMan.knell(); AudioMan.hum(1.5);
  UI.announce('時が巻き戻る…', '死神の HP が回復する');
}
// デッドクロス(激昂): 1.5秒、プレイヤーの位置を中心に X字の帯 2本(長さ 280・幅 20)が速く回りながら減速して止まる → 0.3秒後に斬る。当たると HP が 1 になる
function deadCross(e, ai) {
  ai.busy = 2.1;
  const cx = P.x, cy = P.y, a0 = rand(0, TAU), ang = (i, t) => a0 + i * Math.PI / 2 + 3 * Math.PI * (1 - Math.pow(1 - Math.min(1, t / 1.5), 3)); // 1.5回転してイージングで止まる
  for (let i = 0; i < 2; i++) pushWarn({ kind: 'line', x: cx, y: cy, a: ang(i, 0), len: 280, w: 20, t: 0, life: 1.8, cross: true, track: q => { q.a = ang(i, q.t); q.x = cx - Math.cos(q.a) * q.len / 2; q.y = cy - Math.sin(q.a) * q.len / 2; } });
  AudioMan.charge(1.5); AudioMan.warning();
  hint('deadcross', 'デッドクロス', '当たると HP が 1 になる。回避かガードで防げ');
  later(ai, 1.8 - CUT_HIT, () => { // 村正の一閃と同じ作りの、赤黒い X の斬撃(炸裂の時刻に当たり判定)
    const L = 140 * CHAOS.area, fa = [ang(0, 2), ang(1, 2)];
    let done = false;
    for (const sa of fa) {
      const s = makeCut(cx - Math.cos(sa) * L, cy - Math.sin(sa) * L, cx + Math.cos(sa) * L, cy + Math.sin(sa) * L, { pal: CUT_PAL_XCROSS, wk: 1.8, nodim: true, late: true });
      s.enemy = true;
      s.ev.push({ at: CUT_RUN, fn: () => { hitstop(0.05); shake(6); cutSpark(s, 18, ['#ff3b5c', '#8e0016', '#ffffff']); } });
      s.onHit = () => { if (done) return; done = true; deadCrossHit(cx, cy, fa); };
    }
    AudioMan.cutDraw(); later(ai, CUT_OMEN, () => AudioMan.cut());
  });
}
const CUT_PAL_XCROSS = { dark: '#0a0002', mid: '#3a0008', bright: '#8e0016', wakeGlow: '#2a0006', edge: '#000000', rim: '#ff2a48', glow: '#6a000e', core: '#ff3b5c', flash: '#ffffff', omen: '#ff2a48', glowK: 0.5, lightK: 0.6 };
function deadCrossHit(cx, cy, angs) {
  if (state !== 'play' || P.dead) return;
  AudioMan.cutHit(); shake(12); screenFlash(0.35, '#ff3b5c'); shockAt(cx, cy, 2.4, 0.7);
  const hit = angs.some(sa => inLine(cx - Math.cos(sa) * 140 * CHAOS.area, cy - Math.sin(sa) * 140 * CHAOS.area, sa, 280, 20));
  if (!hit || P.invT > 0) return; // 回避の無敵で防げる(被弾後の無敵は無視)
  if (clsOnHurt(Math.max(1, P.hp - 1)) === null) { S.hudDirty = true; return; } // ガード系の防御で防げる
  if (P.hp > 1) { addFloat(P.x, P.y - 14, 'DEAD CROSS', '#ff3b5c', 1.4); P.hp = 1; }
  P.ifr = P.iframe; P.hurtT = 0.2; breakCombo(); S.hudDirty = true;
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 1.5); hitstop(0.15);
  burst(P.x, P.y, 40, ['#ff3b5c', '#8e0016', '#0a0002', '#ffffff'], { sp: 160, life: 0.6 }); AudioMan.hurt();
}

// 空襲: 0.8秒で飛び上がる(この間に画面を横切る帯 = 影の通り道が出る)→ 空の上(攻撃が当たらない)を影が速さ 280 で走り、通った跡に燃える床(帯と同じ幅 60。通ってから 8秒)
//   影(帯と同じ幅 60)に触れると ×1.0・炎上 → 影が抜けたら、プレイヤーのそばへ舞い降りる(0.4秒)。激昂は降りてすぐもう1回
function startRaid(e, ai) {
  const th = rand(0, TAU), L = Math.min(440, Math.hypot(GFX.VW, GFX.VH) + 40), W = 60 * CHAOS.area; // 影が横切るのは約1.6秒(速さ 280)
  const rd = ai.rd = { ph: 'up', t: 0, th, L, sx: P.x - Math.cos(th) * L / 2, sy: P.y - Math.sin(th) * L / 2, fire: 0 };
  ai.act = 'raid';
  pushWarn({ kind: 'line', x: rd.sx, y: rd.sy, a: th, len: L, w: W, t: 0, life: 0.8 + L / 280, fixed: true }); // 影の通り道(帯の幅は攻撃範囲の倍率で広がる)
  AudioMan.roar(); shake(5); e.sq = 0.7;
  hint('raid', '空襲', '空を横切る影に触れると炎上。影の跡は燃える床になる');
}
function updRaid(e, ai, dt) {
  const rd = ai.rd;
  rd.t += dt;
  if (rd.ph === 'up') { // 羽ばたいて飛び上がる(足元に土煙)
    const k = Math.min(1, rd.t / 0.8);
    e.jz = 140 * k * k; e.air = true;
    if (Math.random() < dt * 50) { const pa = rand(0, TAU); part(e.x + Math.cos(pa) * 14, e.y + 8 + Math.sin(pa) * 6, Math.cos(pa) * 90, Math.sin(pa) * 30, 0.5, pick(['#8a6a5a', '#c8a090', '#5a3a30']), { drag: 2 }); }
    if (rd.t >= 0.8 && !rd.flap) { rd.flap = true; AudioMan.dash(); }
    if (k < 1) return;
    rd.ph = 'sky'; rd.t = 0; e.flying = true; e.hidden = true; e.jz = 0; // 空の上: 攻撃が当たらない・狙われない
    return;
  }
  if (rd.ph === 'sky') { // 影が帯を走る。跡に燃える床
    const run = Math.min(rd.L, rd.t * 280), c = Math.cos(rd.th), s = Math.sin(rd.th);
    e.x = rd.sx + c * run; e.y = rd.sy + s * run; // 竜は影の真上を飛ぶ
    if (!rd.band) { rd.band = true; addHazard('fband', rd.sx, rd.sy, { a: rd.th, L: rd.L, spd: 280, stay: 8, w: 60 * CHAOS.area, dur: 8 + rd.L / 280, dmg: e.dmg }); } // 燃える床: 影と同じ速さで伸び、通ってから 8秒で消える
    const R0 = 30 * CHAOS.area; // 影の当たり判定 = 帯の幅の半分
    if (d2(e.x, e.y, P.x, P.y) < (R0 + 3) * (R0 + 3) && hurtPlayer(e.dmg)) burnPlayer(e.dmg * 0.03);
    if (Math.random() < dt * 30) part(e.x + rand(-12, 12), e.y + rand(-6, 6), c * 60 + rand(-20, 20), s * 60 - rand(10, 30), 0.5, pick(['#ff6a2a', '#ffc34a', '#ff4a8a']), { glow: true, drag: 1 }); // 炎の粉が降る
    rd.wind = (rd.wind || 0) - dt;
    if (rd.wind <= 0) { rd.wind = 0.3; AudioMan.fire(); }
    if (run < rd.L) return;
    // 舞い降りる位置: プレイヤーから影が抜けた側へ 100
    rd.ph = 'down'; rd.t = 0; rd.lx = P.x + c * 100; rd.ly = P.y + s * 100;
    e.x = rd.lx; e.y = rd.ly;
    return;
  }
  const k = Math.min(1, rd.t / 0.4); // 舞い降りる
  e.x = rd.lx; e.y = rd.ly; e.jz = 140 * (1 - k) * (1 - k);
  if (k > 0.3) { e.flying = false; e.hidden = false; }
  if (k < 1) return;
  e.jz = 0; e.air = false; e.sq = 0.6; ai.act = null; ai.cd = ai.enraged ? 1.6 : 2.4;
  shockAt(e.x, e.y, 1.6, 0.8); shake(9); AudioMan.boom();
  burst(e.x, e.y, 36, ['#8a6a5a', '#c8a090', '#ff6a2a', '#ffc34a'], { sp: 130, g: 200 });
  addRing(e.x, e.y, 40, '#ff4a8a', { w: 2, life: 0.4 });
  if (ai.enraged && !rd.again) { startRaid(e, ai); ai.rd.again = true; } // 激昂: 降りてすぐもう1回(2回まで)
}

function onBossDeath(e) {
  clsOnBossKill(e); // クラスの「ボスを倒した」(ネクロマンサー: 死霊を上限まで)
  for (const o of enemies) if (o.owner === e && !o.dead) { o.dead = true; if (o.obj) objDown(o, false); else burst(o.x, o.y, 16, ECOL[o.type] || ['#ffffff'], { sp: 70 }); } // ボスが出した物・中スライムは一緒に崩れる
  e.takeK = 1; e.flying = false; e.hidden = false;
  // 2体のボス(カオス: 双王): 両方倒すまで次へ進まない
  const rest = (S.bosses || []).filter(b => b !== e && !b.dead);
  if (rest.length) {
    S.bosses = rest; S.boss = rest[0]; UI.bossBar(rest[0]); S.bossKills++; S.twinFinal = S.twinFinal || e.final;
    burst(e.x, e.y, 90, [e.col, '#ffd23f', '#ffffff'], { sp: 180, glow: true, life: 1.2 }); addFlash(e.x, e.y, 200, '#ffd23f', 0.8); shake(10); AudioMan.boom();
    UI.announce('1体 撃破!', 'もう1体を倒せ'); // 宝箱はフェーズのクリア(2体目)で
    return;
  }
  if (S.twinFinal) { e.final = true; S.twinFinal = false; }
  S.bosses = [];
  S.boss = null;
  S.phase = null; // ボスのフェーズのクリア(闇の霧も晴れる)
  UI.bossBar(null);
  hitstop(0.18); slowmo(0.2, 2); screenFlash(0.9); shake(16);
  shockAt(e.x, e.y, 3, 0.55);
  setTimeout(() => shockAt(e.x, e.y, 2, 0.8), 250);
  burst(e.x, e.y, 180, [e.col, '#ffd23f', '#ffffff', '#ff8c42'], { sp: 220, glow: true, life: 1.6, g: 40 });
  addRing(e.x, e.y, 140, '#ffd23f', { w: 3, life: 0.8 }); addRing(e.x, e.y, 90, '#ffffff', { w: 2, life: 0.6 });
  addFlash(e.x, e.y, 260, '#ffd23f', 1.2);
  AudioMan.boom(); AudioMan.chest();
  eprojs = []; warns = []; hazards = []; bfx = []; P.push = null; P.current = null; P.rootT = 0; S.tstop = 0; S.madClock = null; S.rewind = 0;
  S.bossKills++;
  if (S.mode === 'arena') return arenaBossDown(e);
  if (CHAOS.bossLv) { S.elv += CHAOS.bossLv; UI.enemyLvUp(); } // カオス: ボスを倒すたびに敵Lv アップ
  const rk = S.tier; // 撃破報酬: tier で数える(通常モード・エスカレーション)
  for (let i = 0; i < 14; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), 20 * rk);
  for (let i = 0; i < 25; i++) dropItem('coin', e.x, e.y, 3 * rk);
  dropItem('meat', e.x + 14, e.y); dropItem('magnet', e.x - 14, e.y);
  dropItem('chest', e.x, e.y - 14); chestBeacon(e.x, e.y - 14); // 装備宝箱(フェーズのクリア)
  if (e.final) {
    if (S.mode === 'stage' || (S.loop === 1 && !S.won)) { S.won = true; S.victoryT = 2.4; AudioMan.stopMusic(1.5); return; }
    S.loop++; escStage(1); UI.announce('LOOP ' + S.loop, '敵はさらに強くなる…'); return; // エスカレーションの周回: tier 1 から
  }
  if (S.mode === 'stage') { UI.announce('BOSS 1/2 撃破!', '次のボスに備えよ'); AudioMan.playMusic(DATA.stages[S.stage - 1].music); return; } // ステージ単体: ステージはそのまま
  escStage(S.tier + 1); // エスカレーション: 次の tier のステージへ
}

function setStage(n) {
  S.stage = n;
  groundCache.clear();
  S.hudDirty = true;
}

// ============================================================
// フェーズ(通常モード): エリート群 / ボス。フェーズの間はフェーズの時計が止まり、3分を超えると闇の霧
// ============================================================
// フェーズのクリアで落ちる宝箱の光の柱(上へ昇る光の粒と、地面の輪)
function chestBeacon(x, y) {
  addFlash(x, y, 120, '#ffd23f', 0.9);
  for (let k = 0; k < 3; k++) addRing(x, y, 18 + k * 14, k ? '#ffd23f' : '#ffffff', { w: 2, life: 0.5 + k * 0.2 });
  for (let i = 0; i < 46; i++) part(x + rand(-6, 6), y + rand(-2, 4), rand(-8, 8), -rand(60, 190), rand(0.6, 1.3), pick(['#ffd23f', '#fff6c8', '#ffffff', '#ffb347']), { glow: true, drag: 0.6, sz: pick([1, 2]) });
}
// エリート群の襲来: そのステージの今の候補から n 体を、画面の外の 3方向(120°おき)から一斉に
function startElitePhase(n) {
  const pool = flatTypes((S.spawnCfg && S.spawnCfg.types) || ['zombie']).filter(k => !DATA.enemies[k].noElite);
  const R = Math.hypot(GFX.VW, GFX.VH) / 2 + 10, a0 = rand(0, TAU), elites = [];
  for (let i = 0; i < n; i++) {
    const a = a0 + TAU / n * i, x = P.x + Math.cos(a) * R, y = P.y + Math.sin(a) * R;
    const e = spawnEnemy(pool[i % pool.length], { x, y, elite: true, noChest: true, phaseElite: true });
    elites.push(e);
    // 画面の端から入ってくる方向に、赤い光の帯(予告)と地響き
    warns.push({ kind: 'line', x: P.x + Math.cos(a) * 26, y: P.y + Math.sin(a) * 26, a, len: R - 26, w: 10, t: 0, life: 1.2, fixed: true });
  }
  S.phase = { kind: 'elite', t: 0, elites, lastX: P.x, lastY: P.y };
  UI.banner('ELITE 襲来!!', `エリート ${n}体を倒せ`, 2200);
  AudioMan.eliteHorn(); shake(7); screenFlash(0.35, '#ff3b5c'); shockAt(P.x, P.y, 1.6, 0.7);
  slowmo(0.35, 0.6);
}
function endElitePhase() {
  const ph = S.phase, x = ph.lastX, y = ph.lastY;
  S.phase = null;
  dropItem('chest', x, y - 10); chestBeacon(x, y - 10);
  hitstop(0.12); slowmo(0.3, 1.2); shake(10); screenFlash(0.5, '#ffd23f'); shockAt(x, y, 2.2, 0.6);
  addRing(x, y, 120, '#ffd23f', { w: 3, life: 0.8 }); addRing(x, y, 70, '#ffffff', { w: 2, life: 0.6 });
  UI.banner('PHASE CLEAR', 'エリート群を撃破!', 2200, 'gold');
  AudioMan.phaseClear();
}
// 毎フレーム: フェーズの外ではフェーズの時計を進め、フェーズの中では経過を数えて闇の霧
function updPhase(dt) {
  const ph = S.phase;
  if (!ph) { S.ptime += dt; return; }
  ph.t += dt;
  if (ph.kind === 'elite' && ph.elites.every(e => e.dead)) return endElitePhase();
  const F = DATA.flow.fog;
  if (ph.t >= F.start - 10 && !ph.fogWarn) { ph.fogWarn = true; UI.announce('闇の霧が迫る…', 'あと 10秒で HP が削られはじめる'); AudioMan.heartbeat(0.7); }
  const fk = fogDarkK();
  if (fk > 0) fogWisps(dt, fk);
  if (ph.t < F.start) return;
  if (!ph.fogOn) { ph.fogOn = true; ph.fogTick = 1; UI.banner('闇の霧', '早く倒さないと HP が削られ続ける', 2200, 'fog'); AudioMan.fogRise(); shake(5); }
  ph.fogDmg = F.dmg * (1 + Math.floor((ph.t - F.start) / F.step)); // 1秒ごとのダメージ(10秒ごとに +1)
  if ((ph.fogTick -= dt) > 0) return;
  ph.fogTick += 1;
  fogHurt(ph.fogDmg);
}
// 闇の霧の暗さ(0〜1): 霧の 10秒前(予告)から暗くなり始め、霧が出て 5秒で最も暗い
function fogDarkK() {
  if (!S || !S.phase) return 0;
  return clamp((S.phase.t - (DATA.flow.fog.start - 10)) / 15, 0, 1);
}
// 霧のもや: 画面の縁から内側へ這い寄る暗い粒(光らせない。光の層は色が明るさになるため)
function fogWisps(dt, k) {
  const n = dt * 40 * k;
  for (let i = 0; i < n || Math.random() < n - i; i++) {
    const side = Math.random() * 4 | 0, u = Math.random();
    const x = cam.x + (side === 0 ? 0 : side === 1 ? GFX.VW : u * GFX.VW), y = cam.y + (side === 2 ? 0 : side === 3 ? GFX.VH : u * GFX.VH);
    const a = Math.atan2(P.y - y, P.x - x), sp = rand(10, 26);
    part(x, y, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.2, 2.2), pick(['#1a0a2a', '#2a1240', '#3a1a5a']), { drag: 0.3, sz: pick([2, 3, 3]) });
  }
}
// 闇の霧のダメージ: 防御力・シールド・無敵では減らない(炎上と同じ)
function fogHurt(n) {
  if (P.dead) return;
  P.hp -= n; breakCombo(); S.hudDirty = true; GFX.fx.hurt = Math.max(GFX.fx.hurt, 0.5);
  AudioMan.heartbeat(Math.min(1.3, 0.6 + n * 0.08));
  for (let i = 0; i < 10; i++) { const a = rand(0, TAU); part(P.x + Math.cos(a) * 12, P.y + Math.sin(a) * 12, -Math.cos(a) * 25, -Math.sin(a) * 25, 0.6, pick(['#2a1240', '#5a2a8a', '#8a5ad0']), { glow: true, drag: 1 }); } // 霧が体へまとわりつく
  if (P.hp <= 0 && clsSaveLethal()) P.hp = 1;
  addFloat(P.x, P.y - 10, String(n), '#b07aff');
  if (P.hp <= 0) playerDown();
}

// ---------- 敵弾 ----------
function updEprojs(dt0) {
  updTimeMods(dt0);
  const tk = eprojTimeK(); // 時の操作(終刻の死神): 敵の弾の時間の倍率
  for (let i = eprojs.length - 1; i >= 0; i--) {
    const p = eprojs[i];
    // 時間停止(アストロマンサーの重力圏): 止まった弾は当たらず、時間が来たら消える
    if (p.stopT) { if (S.time >= p.stopT) { burst(p.x, p.y - (p.z || 0), 5, ['#8a2a6e', '#3a1438'], { sp: 30, life: 0.25 }); eprojs.splice(i, 1); } continue; }
    const dt = dt0 * clsProjTime(p) * tk; // 時の歪み: 重力圏の中の弾は時間がゆっくり進む(0 = 止まった)/ 時間停止・狂い時計・逆戻し
    p.tk = tk;
    p.t += dt;
    if (p.lob) {
      if (p.follow) p.follow(p); // 落下点が動く(墨の玉)
      const k = clamp(p.t / p.T, 0, 1); // 巻き戻しでは戻る
      p.x = lerp(p.x0, p.tx, k); p.y = lerp(p.y0, p.ty, k); p.z = Math.sin(k * Math.PI) * p.H;
      if (k >= 1) { eprojs.splice(i, 1); p.onLand(p); }
      continue;
    }
    if (p.kind === 'boomer') {
      if (!p.ret) {
        p.v -= 200 * dt;
        if (p.v <= 0) { p.ret = true; p.v = 0; }
        p.x += Math.cos(p.a) * p.v * dt; p.y += Math.sin(p.a) * p.v * dt;
      } else {
        p.v = Math.min(240, p.v + 260 * dt);
        const ta = Math.atan2(p.owner.y - p.y, p.owner.x - p.x);
        p.x += Math.cos(ta) * p.v * dt; p.y += Math.sin(ta) * p.v * dt;
        if (p.owner.dead || d2(p.x, p.y, p.owner.x, p.owner.y) < 100) p.t = p.life + 1;
      }
    } else { p.x += p.vx * dt; p.y += p.vy * dt; }
    // 通常敵の弾の軌跡: 火の玉は火の粉、砂の弾は砂煙、槍は白い風切り
    if (p.kind === 'efire' && Math.random() < dt * 40) part(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.15 + rand(-6, 6), -p.vy * 0.15 - rand(4, 12), rand(0.2, 0.4), pick(['#ff6a2a', '#ffc34a', '#b8261a']), { glow: true, drag: 2 });
    else if (p.kind === 'esand' && Math.random() < dt * 30) part(p.x, p.y, rand(-8, 8), rand(-8, 4), 0.35, pick(['#e8c88a', '#c8a060']), { drag: 3 });
    else if (p.kind === 'espear' && Math.random() < dt * 50) part(p.x - p.vx * 0.03, p.y - p.vy * 0.03, 0, 0, 0.12, '#ffffff', { drag: 0 });
    else if ((p.kind === 'eice' || p.kind === 'ispear' || p.kind === 'flake') && Math.random() < dt * (p.kind === 'ispear' ? 60 : 25)) part(p.x + rand(-1, 1), p.y + rand(-1, 1), -p.vx * 0.1, -p.vy * 0.1, 0.3, pick(['#bff4ff', '#ffffff', '#7ad7ff']), { glow: true, drag: 2 }); // 氷の弾: 霜のきらめき
    else if (p.kind === 'bigsnow') { p.spin = (p.spin || 0) + dt * Math.hypot(p.vx, p.vy) / 14; if (Math.random() < dt * 30) part(p.x + rand(-10, 10), p.y + 10, -p.vx * 0.2 + rand(-15, 15), -rand(10, 30), 0.5, pick(['#ffffff', '#e8f4ff']), { g: 120, drag: 1 }); } // 大雪玉: 転がって雪煙
    if (p.kind === 'cog') p.spin = (p.spin || 0) + dt * 10;
    if (p.turnT && p.t >= p.turnT) { // 歯車弾: 1回だけプレイヤーへ向きを変える
      p.turnT = 0; const ta = Math.atan2(P.y - p.y, P.x - p.x), sp = Math.hypot(p.vx, p.vy);
      p.vx = Math.cos(ta) * sp; p.vy = Math.sin(ta) * sp;
      burst(p.x, p.y, 5, BRASS, { sp: 30, glow: true, life: 0.2 });
    }
    if (p.splitT && p.t >= p.splitT) { // 雪華弾: 3つに割れる
      const a = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy);
      for (const da of [-0.45, 0, 0.45]) Object.assign(eball(p.x, p.y, a + da, sp * 1.15, 0, 'flake'), { dmg: p.dmg, frost: p.frost, small: true, life: 4 }); // ダメージは割れる前の弾と同じ
      burst(p.x, p.y, 6, ['#ffffff', '#bff4ff'], { sp: 40, glow: true, life: 0.25 });
      eprojs.splice(i, 1); continue;
    }
    if (p.t > p.life) { if (p.kind === 'espear' || p.kind === 'bspear') burst(p.x, p.y, 5, ['#c8b89a', '#7a6a5a'], { sp: 30, life: 0.25 }); eprojs.splice(i, 1); continue; } // 槍は帯の端で地面に刺さる
    if (p.blk) { // 大鹿の欠片・残像は結晶の柱に当たると砕けて消える
      let wall = null;
      forEachNear(p.x, p.y, p.r, o => { if (o.obj === p.blk && !(p.ignore && p.ignore.has(o))) { wall = o; return false; } }); // blk: 遮る物の種類(結晶の柱)
      if (wall) { burst(p.x, p.y, 7, ['#efe9d4', '#6ee7ff', '#ffffff'], { sp: 45, glow: true, life: 0.25 }); wall.flash = 0.06; eprojs.splice(i, 1); continue; }
    }
    if (d2(p.x, p.y, P.x, P.y) < Math.pow(p.r + 3, 2)) {
      if (P.invT > 0) continue;
      if (!p.keep && clsBlockProj()) { burst(p.x, p.y, 8, ['#fff27a', '#ffffff'], { sp: 60, glow: true, life: 0.25 }); eprojs.splice(i, 1); continue; } // 静電気
      if (hurtPlayer(p.dmg)) { if (p.burn) burnPlayer(p.burn); if (p.sta) drainSta(p.sta); if (p.frost) frostPlayer(p.frost); if (p.freeze) freezePlayer(p.freeze); } // 火の玉: 炎上 / 海淵の弾: スタミナ / 霊峰の弾: 凍傷・氷の槍の凍結
      if (p.keep) continue;
      const icy = p.frost > 0;
      burst(p.x, p.y, icy ? 10 : 6, p.kind === 'efire' ? ['#ff6a2a', '#ffc34a', '#ffffff'] : p.kind === 'esand' ? ['#e8c88a', '#fff0c0', '#ffffff'] : icy ? ['#bff4ff', '#ffffff', '#7ad7ff'] : ['#ff3b5c', '#ffffff'], { sp: 50, glow: true });
      eprojs.splice(i, 1);
    }
  }
}

// ---------- 設置物(粘液床 / 燃える床 / 衝撃波 / スロウタイム / 渦) ----------
function updHazards(dt) {
  S.inInk = false; S.lee = false;
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (h.delay > 0) { h.delay -= dt; continue; } // 予告のあとに出る床
    h.t += dt;
    if (h.owner) { if (h.owner.dead) h.t = h.dur; else { h.x = h.owner.x; h.y = h.owner.y; } }
    const dd = d2(h.x, h.y, P.x, P.y);
    if (h.kind === 'goo') {
      if (dd < h.r * h.r && h.t > 0.1) slowPlayer(DATA.debuff.slow, 0.15 * CHAOS.debuff); // 減速を受けないクラスの状態(不屈)は除く
      if (Math.random() < dt * h.r * 0.15) part(h.x + rand(-h.r, h.r) * 0.7, h.y + rand(-h.r, h.r) * 0.7, 0, -6, 0.5, '#8affd8', { drag: 1 });
    } else if (h.kind === 'fire') { // 燃える床: 上にいる間、炎上(その敵のダメージ × 0.1 を 0.5秒ごと)
      const R = h.r * Math.min(1, h.t * 8);
      if (dd < R * R && h.t > 0.05 && h.t < h.dur - 0.2) burnPlayer(h.dmg * 0.1);
      if (Math.random() < dt * (4 + h.r * 0.9)) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, rand(-4, 4), -rand(14, 34), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1.5 }); }
    } else if (h.kind === 'fband') { // 空襲の燃える床(カオスドラゴン): 影の通り道と同じ幅の帯。先は影と同じ速さで伸び、後ろは通ってから stay 秒で消える。上にいる間、炎上
      const c = Math.cos(h.a), s = Math.sin(h.a), head = Math.min(h.L, h.t * h.spd), tail = Math.max(0, (h.t - h.stay) * h.spd);
      if (head > tail && segD2(P.x, P.y, h.x + c * tail, h.y + s * tail, h.x + c * head, h.y + s * head) < Math.pow(h.w / 2, 2)) burnPlayer(h.dmg * 0.1);
      if (Math.random() < dt * (head - tail) * 0.12) { const d = rand(tail, head), o = rand(-0.45, 0.45) * h.w; part(h.x + c * d - s * o, h.y + s * d + c * o, rand(-4, 4), -rand(14, 34), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1.5 }); }
    } else if (h.kind === 'fwall') { // 炎の壁(イフリート): 上にいると 0.5秒ごとに ×0.4・炎上(祭壇の強化も乗る)
      const c = Math.cos(h.a), s = Math.sin(h.a);
      if (!P.dead) { // 越えられない: 壁の長さの範囲では、立ったときにいた側の縁で止まる(ダッシュ・瞬間移動・押し出しでも)。壁の端を回れば反対側へ行ける
        const ox = P.x - h.x, oy = P.y - h.y, along = ox * c + oy * s, sd = -ox * s + oy * c, half = h.w / 2;
        if (!h.side) h.side = Math.sign(sd) || 1;
        if (along < -4 || along > h.len + 4) { if (Math.abs(sd) > half) h.side = Math.sign(sd); }
        else if (sd * h.side < half) { const k = h.side * half - sd; P.x -= s * k; P.y += c * k; }
      }
      h.tick -= dt;
      if (h.tick <= 0 && h.t > 0.1 && segD2(P.x, P.y, h.x, h.y, h.x + c * h.len, h.y + s * h.len) < Math.pow(h.w / 2 + 3, 2)) {
        h.tick = 0.5;
        const k = h.owner2 && !h.owner2.dead ? h.owner2.altK || 1 : 1;
        if (hurtPlayer(h.dmg * k * 0.4)) burnPlayer(h.dmg * k * 0.03);
      }
      if (Math.random() < dt * 40) { const d = rand(0, h.len); part(h.x + c * d + rand(-2, 2), h.y + s * d + rand(-2, 2), rand(-5, 5), -rand(25, 55), rand(0.3, 0.6), pick(['#ff6a2a', '#ffc34a', '#ff3b1a', '#fff0b0']), { glow: true, drag: 1 }); }
    } else if (h.kind === 'quake') {
      h.r += h.spd * dt;
      if (Math.abs(Math.sqrt(dd) - h.r) < 5) { // 輪に触れると ×0.8(ゴーレムの衝撃波は外へ押し出す。1つの輪で1回)
        if (h.dmg > 0) hurtPlayer(h.dmg); // 鐘の衝撃はダメージなし(押すだけ)
        if (h.push && !h.pushed && pushPlayer(Math.atan2(P.y - h.y, P.x - h.x), h.push, 0.2)) h.pushed = true;
      }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, 0, -rand(10, 40), 0.35, h.bell ? pick(['#ffd27a', '#fff0c8', '#c8a050']) : pick(['#a89e8c', '#6a6258', '#ffb347']), { g: 120, sz: pick([1, 2]), glow: !!h.bell }); }
      if (h.r >= h.max) h.t = h.dur;
    } else if (h.kind === 'clock') {
      const R = h.r * Math.min(1, h.t * 4);
      const out = h.rev && h.t >= h.rev; // スロウタイム・リバース(終刻の死神): 反転したあとは範囲の外が遅くなる
      if (out && !h.flipped) { // 反転の瞬間: 時計盤の縁から外へ紫の衝撃波が走り、画面の外側が紫にかすむ
        h.flipped = true;
        for (let k = 0; k < 3; k++) addRing(h.x, h.y, R + 40 + k * 60, '#c29bff', { w: 3 - k, life: 0.45 + k * 0.15 });
        for (let k = 0; k < 36; k++) { const pa = TAU / 36 * k; part(h.x + Math.cos(pa) * R, h.y + Math.sin(pa) * R, Math.cos(pa) * 160, Math.sin(pa) * 160, 0.5, pick(['#c29bff', '#ffffff', '#6a3aa0']), { glow: true, drag: 2 }); }
        screenFlash(0.25, '#c29bff'); shockAt(h.x, h.y, 1.6, 0.8); shake(6); AudioMan.knell(); AudioMan.zap();
        UI.announce('反転', '時計盤の外が遅くなる。死神のそばへ');
      }
      if (out ? dd >= R * R : dd < R * R) slowPlayer(h.slow || DATA.debuff.slow, 0.15 * CHAOS.debuff, true); // スロウタイム(死神)/ 時の歪み(砂時計の精: ×0.7)。どちらもクールダウン・スタミナ・HP の回復が下がる
    } else if (h.kind === 'vortex') { // 中心へ引き寄せる(移動速度より弱いので歩いて脱出できる)
      const R = h.r * Math.min(1, h.t * 4), d = Math.sqrt(dd);
      if (d < R && d > 2 && !P.dead && state === 'play') {
        const k = Math.min(d, h.pull * Math.min(1, (h.dur - h.t) * 2) * dt);
        P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k;
      }
      if (Math.random() < dt * 30) { const pa = rand(0, TAU), pr = rand(0.5, 1) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, (Math.cos(pa + 1.2) * -pr) * 0.9, (Math.sin(pa + 1.2) * -pr) * 0.9, 0.6, pick(['#ff4a8a', '#c78bff', '#ffd0f0']), { glow: true, drag: 1 }); }
    } else if (h.kind === 'ink') { // 墨だまり(クラーケン): 中にいる間スタミナが回復しない
      const R = h.r * Math.min(1, h.t * 6);
      if (dd < R * R && h.t < h.dur - 0.3) { P.staLockT = Math.max(P.staLockT, 0.1); S.inInk = true; }
      if (Math.random() < dt * 8) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, 0, -rand(4, 10), 0.8, pick(['#2a2a4a', '#3a3a5a', '#1a1a2a']), { drag: 1 }); }
    } else if (h.kind === 'tide') { // 潮の満ち引き(クラーケン): 2秒 中心へ引く → 1秒 外へ押す → 縁に触手の輪
      const d = Math.sqrt(dd), live = !P.dead && state === 'play' && P.invT <= 0;
      if (h.t < 2 && d < h.r && d > 2 && live) { const k = Math.min(d, 40 * dt); P.x += (h.x - P.x) / d * k; P.y += (h.y - P.y) / d * k; }
      else if (h.t >= 2 && h.t < 3 && d < h.r + 10 && live) { const a = d > 0.5 ? Math.atan2(P.y - h.y, P.x - h.x) : rand(0, TAU); P.x += Math.cos(a) * 90 * dt; P.y += Math.sin(a) * 90 * dt; }
      if (h.t >= 3 && !h.rung) { // 縁(半径 120〜135)に触手がせり上がる
        h.rung = true;
        if (Math.abs(d - h.r * 1.06) < h.r * 0.07 + 6) hurtPlayer(h.dmg * 0.8);
        for (let k = 0; k < 24; k++) { const pa = TAU / 24 * k; burst(h.x + Math.cos(pa) * h.r * 1.06, h.y + Math.sin(pa) * h.r * 1.06, 2, SPLASH, { sp: 60, up: 50, g: 200, life: 0.5 }); }
        shake(6); AudioMan.splash(); AudioMan.boom();
      }
      if (h.t < 3 && Math.random() < dt * 40) { // 水の流れ(引き = 内向き / 押し = 外向き)
        const pa = rand(0, TAU), pr = rand(0.3, 1) * h.r, v = h.t < 2 ? -50 : 90;
        part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, Math.cos(pa) * v, Math.sin(pa) * v, 0.5, pick(['#bff4ff', '#7ad7ff', '#ffffff']), { drag: 0.5 });
      }
    } else if (h.kind === 'tsunami') { // 大津波(深淵の海竜): 画面を横切る波。岩礁の陰(幅 26・長さ 60)には当たらない
      const c = Math.cos(h.th), s = Math.sin(h.th);
      h.pd = h.d; h.d = h.t * 150;
      const along = (P.x - h.x) * c + (P.y - h.y) * s, side = -(P.x - h.x) * s + (P.y - h.y) * c;
      if (!h.hit && along > h.pd - 8 && along < h.d + 4 && Math.abs(side) < h.span) {
        const safe = h.reefs.some(r => along > r.along && along - r.along < 60 * CHAOS.area && Math.abs(side - r.side) < 13 * CHAOS.area);
        if (!safe && hurtPlayer(h.dmg)) { h.hit = true; drainSta(30); pushPlayer(h.th, 50, 0.3); }
      }
      for (const r of h.reefs) if (!r.gone && h.d > r.along + 70) { // 波が通った岩礁は崩れる
        r.gone = true; r.t = r.dur;
        burst(r.x, r.y, 20, ['#3a4a50', '#5a6a6a', '#8a9a9a', '#bff4ff'], { sp: 90, up: 30, g: 220, life: 0.6 }); AudioMan.thud();
      }
      for (let k = 0; k < 6; k++) { const sd = rand(-h.span, h.span); part(h.x + c * h.d - s * sd, h.y + s * h.d + c * sd, c * rand(80, 160) + rand(-20, 20), s * rand(80, 160) - rand(20, 60), 0.5, pick(SPLASH), { g: 160, drag: 1 }); }
    } else if (h.kind === 'wpillar') { // 水柱(深淵の海竜): プレイヤーへゆっくり寄る。触れると ×0.6・スタミナ −15 で崩れる
      const d = Math.sqrt(dd);
      if (d > 1 && h.t < h.dur - 0.3) { const k = Math.min(d, 40 * dt); h.x += (P.x - h.x) / d * k; h.y += (P.y - h.y) / d * k; }
      if (d < h.r + 3 && h.t < h.dur - 0.3 && hurtPlayer(h.dmg * 0.6)) {
        drainSta(15); h.t = h.dur - 0.3;
        burst(h.x, h.y, 24, SPLASH, { sp: 110, up: 50, g: 200, life: 0.6 }); AudioMan.splash();
      }
      if (Math.random() < dt * 30) part(h.x + rand(-h.r, h.r) * 0.6, h.y - rand(0, 30), rand(-10, 10), -rand(20, 50), 0.5, pick(SPLASH), { drag: 1 });
    } else if (h.kind === 'gearfloor') { // 歯車の床(番人): 上にいると回る向きへ流される(毎秒 50)
      const d = Math.sqrt(dd);
      if (d < h.r && d > 1 && h.t < h.dur - 0.2 && !P.dead && state === 'play' && P.invT <= 0) { const vx = -(P.y - h.y) / d * h.dir * 50, vy = (P.x - h.x) / d * h.dir * 50; P.x += vx * dt; P.y += vy * dt; }
      if (Math.random() < dt * 6) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.r, h.y + Math.sin(pa) * h.r, -Math.sin(pa) * h.dir * 40, Math.cos(pa) * h.dir * 40, 0.3, '#ffd27a', { glow: true, drag: 2 }); } // 縁の火花
    } else if (h.kind === 'ice') { // 滑る床(霜の巨人・氷柱の墓標): 上では向きを変えるのに慣性がかかる
      if (h.spire && h.spire.dead && h.t < h.dur - 0.3) h.t = h.dur - 0.3; // 氷柱の墓標: 氷柱が砕けたら床も消える
      if (dd < h.r * h.r && h.t < h.dur - 0.2) P.iceT = 0.1;
      if (Math.random() < dt * 5) { const pa = rand(0, TAU), pr = Math.sqrt(Math.random()) * h.r; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr * 0.8, 0, -2, 0.5, '#ffffff', { glow: true, drag: 1 }); }
    } else if (h.kind === 'snow' || h.kind === 'drift') { // 雪の床(イエティ)/ 地吹雪(霜の巨人の周り): 中にいると 1秒ごとに凍傷 +1
      const R = h.r * Math.min(1, h.t * 6);
      if (dd < R * R && h.t < h.dur - 0.2 && (h.tick -= dt) <= 0) { h.tick = 1; frostPlayer(1); }
      if (h.kind === 'drift') for (let k = 0; k < 2; k++) { const pa = rand(0, TAU), pr = rand(0.2, 1) * R; part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, -Math.sin(pa) * 70, Math.cos(pa) * 70 - 10, 0.5, pick(SNOW), { drag: 1.5 }); } // 渦を巻く雪
    } else if (h.kind === 'blizzard') { // 吹雪の風(霜の巨人): 巨人の向きへ毎秒 45 押し、1秒ごとに凍傷 +1。氷塊の風下では受けない
      const lee = inLee(h.th), c = Math.cos(h.th), s = Math.sin(h.th);
      S.lee = lee;
      if (!lee && !P.dead && state === 'play' && P.invT <= 0) { P.x += c * 45 * dt; P.y += s * 45 * dt; }
      if ((h.tick -= dt) <= 0) { h.tick = 1; if (!lee) frostPlayer(1); }
      for (let k = 0; k < 5; k++) { // 画面を吹き抜ける雪
        const x = cam.x + rand(-20, GFX.VW + 20) - c * 40, y = cam.y + rand(-20, GFX.VH + 20) - s * 40;
        part(x, y, c * rand(140, 220) + rand(-10, 10), s * rand(140, 220) + rand(-10, 10), rand(0.4, 0.8), pick(SNOW), { drag: 0 });
      }
    } else if (h.kind === 'aval') { // 雪崩(霜の巨人): 帯を雪の塊が転がる。×1.0・凍傷 +3
      const c = Math.cos(h.th), s = Math.sin(h.th);
      h.d = h.t * 130;
      const along = (P.x - h.x) * c + (P.y - h.y) * s, side = -(P.x - h.x) * s + (P.y - h.y) * c;
      if (!h.hit && Math.abs(side) < h.w / 2 + 3 && Math.abs(along - h.d) < h.w / 2 + 2 && hurtPlayer(h.dmg)) { h.hit = true; frostPlayer(3); }
      for (let k = 0; k < 3; k++) { const sd = rand(-h.w / 2, h.w / 2); part(h.x + c * (h.d - 6) - s * sd, h.y + s * (h.d - 6) + c * sd, -c * rand(20, 60) + rand(-20, 20), -s * rand(20, 60) - rand(10, 40), 0.6, pick(SNOW), { g: 120, drag: 1 }); } // 巻き上がる雪煙
    } else if (h.kind === 'icering') { // 縮む氷輪(雪華の女王): 輪に触れると ×0.8・凍傷 +2
      h.rr = h.r0 * Math.max(0, 1 - h.t / h.dur);
      if (!h.hit && Math.abs(Math.sqrt(dd) - h.rr) < 5 && hurtPlayer(h.dmg)) { h.hit = true; frostPlayer(2); }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU); part(h.x + Math.cos(pa) * h.rr, h.y + Math.sin(pa) * h.rr, 0, -rand(6, 14), 0.4, pick(SNOW), { glow: true, drag: 1 }); }
    } else if (h.kind === 'veil') { // 吹雪の帳(雪華の女王): 縁から毎秒 spd で凍りつく。凍った所にいると 0.5秒ごとに凍傷 +2・×0.2
      h.cur = Math.max(h.Rmin, h.R - h.spd * h.t);
      if (dd > h.cur * h.cur && h.t < h.dur - 0.3 && (h.tick -= dt) <= 0) { h.tick = 0.5; frostPlayer(2); hurtPlayer(h.dmg); }
      for (let k = 0; k < 3; k++) { const pa = rand(0, TAU), pr = h.cur + rand(0, 40); part(h.x + Math.cos(pa) * pr, h.y + Math.sin(pa) * pr, -Math.cos(pa) * 20, -Math.sin(pa) * 20, 0.6, pick(SNOW), { glow: true, drag: 1 }); } // 凍った縁から吹きこむ雪
    }
    if (h.t >= h.dur) hazards.splice(i, 1);
  }
}

// ============================================================
// ジェム・ドロップ
// ============================================================
const gemTier = v => v >= 60 ? 3 : v >= 20 ? 2 : v >= 5 ? 1 : 0;
function dropGem(x, y, v) {
  if (gems.length > 380) { const g = gems[(Math.random() * 40) | 0]; g.v += v; g.tier = gemTier(g.v); return; }
  gems.push({ x, y, v, tier: gemTier(v), t: rand(0, 3), home: false, sp: 0, z: 0, vz: -rand(40, 70), vx: rand(-20, 20), vy: rand(-20, 20) });
}
function dropItem(kind, x, y, val = 0) {
  if (CHAOS.loot && kind !== 'chest' && Math.random() < CHAOS.loot) return; // カオス: アイテムの出現率(装備宝箱は除く)
  drops.push({ kind, x, y, val, t: 0, z: 0, vz: -rand(60, 110), vx: rand(-35, 35), vy: rand(-25, 25), home: false, sp: 0 });
}
function addGold(v) {
  const g = Math.max(1, Math.round(v * P.goldMul));
  S.gold += g; S.hudDirty = true;
  return g;
}

function bounce(o, dt) {
  if (o.vz === 0 && o.z === 0) return;
  o.vz += 260 * dt; o.z += o.vz * dt;
  o.x += o.vx * dt; o.y += o.vy * dt;
  if (o.z >= 0) { o.z = 0; if (Math.abs(o.vz) > 30) { o.vz *= -0.4; o.vx *= 0.5; o.vy *= 0.5; } else { o.vz = 0; o.vx = o.vy = 0; } }
}

function updGems(dt) {
  S.gemStreakT -= dt;
  if (S.gemStreakT <= 0) S.gemStreak = 0;
  const mr2 = P.magnet * P.magnet;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt;
    bounce(g, dt);
    const dd = d2(g.x, g.y, P.x, P.y);
    if (!g.home && dd < mr2) { g.home = true; g.sp = -40; }
    if (g.home) {
      g.sp += 520 * dt;
      const a = Math.atan2(P.y - g.y, P.x - g.x);
      g.x += Math.cos(a) * g.sp * dt; g.y += Math.sin(a) * g.sp * dt;
    }
    if (dd < 36) {
      gems.splice(i, 1);
      S.gemStreak++; S.gemStreakT = 0.6;
      AudioMan.gem(S.gemStreak);
      const cols = [['#4cc3ff', '#e0fbff'], ['#5dff8a', '#eaffea'], ['#ff5d73', '#ffe0e6'], ['#ffd23f', '#fffbe0']][g.tier];
      burst(P.x, P.y - 4, 3, cols, { sp: 35, glow: true, life: 0.35 });
      gainXP(g.v);
      clsOnPickup('gem'); // クラスの「アイテムを拾った」(アストロマンサー: 質量)
    }
  }
}

function updDrops(dt) {
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.t += dt;
    bounce(d, dt);
    const dd = d2(d.x, d.y, P.x, P.y);
    if (d.kind === 'coin' && d.t > 0.4 && (d.home || dd < P.magnet * P.magnet)) {
      d.home = true; d.sp += 500 * dt;
      const a = Math.atan2(P.y - d.y, P.x - d.x);
      d.x += Math.cos(a) * d.sp * dt; d.y += Math.sin(a) * d.sp * dt;
    }
    if (dd > 100 || d.t < 0.35) continue;
    drops.splice(i, 1);
    clsOnPickup(d.kind);
    switch (d.kind) {
      case 'coin': { const g = addGold(d.val); addFloat(P.x, P.y - 12, '+' + g, '#ffcc33'); AudioMan.coin(); break; }
      case 'meat': heal(P.maxhp * DATA.player.food * P.foodMul); break; // 最大HP の 20%(食べ物の効果で増える)
      case 'magnet':
        for (const g of gems) { g.home = true; g.sp = Math.max(g.sp, 60); }
        for (const c of drops) if (c.kind === 'coin') c.home = true;
        addRing(P.x, P.y, 200, '#6ee7ff', { w: 2, life: 0.6 }); shockAt(P.x, P.y, 0.8);
        UI.announce('MAGNET!', ''); AudioMan.select();
        break;
      case 'bomb': {
        screenFlash(0.85, '#fff4d0'); shockAt(P.x, P.y, 2.5, 0.7); shake(12); hitstop(0.08); AudioMan.boom();
        addFlash(P.x, P.y, 300, '#ffb347', 0.8);
        for (const e of enemies) if (!e.dead && !e.prop && onScreen(e.x, e.y, 10)) { if (e.boss || e.obj || e.owner || e.elite) hitEnemy(e, 250, { src: 'bomb', noCrit: true, noKill: e.elite }); else killEnemy(e, {}); } // ボス・ボスの出した物は一撃では壊れない / エリートは倒れない(HP 1 で残る)
        UI.announce('BOOM!!', '');
        break;
      }
      case 'chest': UI.openChest(openEquipChest()); break;
    }
  }
}

// ============================================================
// スポナー
// ============================================================
// 通常の出現: 群れで出る敵(雪狼)は pack の数をまとめて同じ方向から(エリート・大群は1体ずつ)
function spawnPack(t) {
  if (!t) return;
  const pk = DATA.enemies[t].pack;
  if (!pk) return spawnEnemy(t);
  const a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16, n = pk[0] + Math.floor(Math.random() * (pk[1] - pk[0] + 1));
  for (let i = 0; i < n; i++) spawnEnemy(t, { x: P.x + Math.cos(a) * R + rand(-12, 12), y: P.y + Math.sin(a) * R + rand(-12, 12) });
}
function updSpawner(dt) {
  if (S.mode === 'arena') return updArena(dt);
  // 出現のスケジュールはフェーズの時計(ボス・エリート群の間は止まる。エスカレーションはステージごとに 0 から)
  const stage = S.mode === 'stage', sc = S.sched, el = S.ptime;
  while (S.schedIdx < sc.length && el >= sc[S.schedIdx].t) {
    const en = sc[S.schedIdx++];
    if (en.boss) spawnBoss(pick(en.boss), en.final);
    else if (en.elites) startElitePhase(en.elites);
    else if (en.event === 'horde') horde();
    else S.spawnCfg = en;
  }
  const cfg = S.spawnCfg;
  if (!cfg) return;
  const rate = (1 + (S.loop - 1) * 0.3) * (P.uq.clock ? 1.15 : 1) * (S.phase ? 0.6 : 1) * CHAOS.spawn; // 狂時の: 出現数 +15% / フェーズ中は減らす / カオス: 出現率
  S.spawnT -= dt;
  while (S.spawnT <= 0) {
    S.spawnT += cfg.interval / rate;
    if (enemies.length < cfg.max * (P.uq.clock ? 1.15 : 1) * CHAOS.spawn) {
      // 時々小集団で出現
      if (Math.random() < 0.12) {
        const t = pickType(cfg.types, true), a = rand(0, TAU), R = Math.hypot(GFX.VW, GFX.VH) / 2 + 16;
        if (t) for (let i = 0; i < 6; i++) spawnEnemy(t, { x: P.x + Math.cos(a) * R + rand(-14, 14), y: P.y + Math.sin(a) * R + rand(-14, 14) });
      } else spawnPack(pickType(cfg.types));
    }
  }
  // 自然発生のエリート・ゴブリン・篝火: 通常モードではフェーズの時計で進む(フェーズ中は止まる)。エスカレーションは経過時間(ボス戦の間も進む)
  const tdt = stage && S.phase ? 0 : dt;
  if ((stage ? S.ptime : S.time) > 90) {
    S.eliteT -= tdt;
    if (S.eliteT <= 0) {
      S.eliteT = 60;
      const pool = flatTypes(cfg.types).filter(k => !DATA.enemies[k].noElite);
      if (pool.length) spawnEnemy(pick(pool), { elite: true, noChest: !!S.phase }); // ボス戦中に出たエリートは宝箱を落とさない
      UI.banner('ELITE 出現!!', S.phase ? 'ボス戦中のエリート' : '倒すと宝箱を落とす', 1600); AudioMan.warning();
    }
  }
  S.goblinT -= tdt;
  if (S.goblinT <= 0) {
    S.goblinT = 140;
    const a = rand(0, TAU);
    spawnEnemy('goblin', { x: P.x + Math.cos(a) * 110, y: P.y + Math.sin(a) * 110 });
    UI.announce('トレジャーゴブリン!', '逃がすな!');
  }
  S.propT -= tdt;
  if (S.propT <= 0) { S.propT = 6; if (enemies.filter(e => e.prop && !e.dead).length < 5) spawnProp(); }
}

// ============================================================
// 闘技場(ボスラッシュ): 休憩 → ボス入場 → 撃破報酬 → 休憩 …
// ============================================================
function updArena(dt) {
  const A = S.arena, cfg = DATA.arena;
  if (S.boss || S.won || A.idx >= cfg.order.length || S.pendingLv > 0) return; // レベルアップ処理中は休憩時間を止める
  A.restT -= dt;
  if (!A.warned && A.restT <= 2.5) { A.warned = true; UI.announce('ROUND ' + (A.idx + 1) + ' / ' + cfg.order.length, '次の挑戦者が入場する…'); AudioMan.warning(); }
  if (A.restT > 0) return;
  S.elv = arenaLv(A.idx); UI.enemyLvUp();
  const ord = cfg.order[A.idx], e = spawnBoss(Array.isArray(ord) ? pick(ord) : ord, A.idx === cfg.order.length - 1); // 配列のラウンドはステージのボス2体のどちらか
  // 闘技場の中、プレイヤーと中心を挟んだ反対側から入場
  const a = Math.hypot(P.x, P.y) > 30 ? Math.atan2(-P.y, -P.x) : rand(0, TAU), R = cfg.r * 0.6;
  e.x = Math.cos(a) * R; e.y = Math.sin(a) * R;
  shockAt(e.x, e.y, 1.5, 0.6); burst(e.x, e.y, 40, [e.col, '#ffffff'], { sp: 120, glow: true });
  if (CHAOS.escort) arenaEscort(e, CHAOS.escort, a, R);
}
// 闘技場のラウンド i の敵Lv: ラウンドごとの値 + カオス(深い闇 + 復讐の連鎖 × それまでに倒したボスの数)
const arenaLv = i => DATA.arena.elv[i] + CHAOS.startLv + CHAOS.bossLv * i;
// カオス「親衛隊」: ボスの左右からエリートが n 体入場する(そのボスのステージの敵から)
function arenaEscort(boss, n, a, R) {
  const run = DATA.stageRuns.find(r => r.bosses.includes(boss.type)) || DATA.stageRuns[0];
  const types = [...new Set(run.segs.filter(Boolean).flat(2))].filter(k => DATA.enemies[k] && !DATA.enemies[k].noElite);
  for (let i = 0; i < n; i++) {
    const b = a + (i - (n - 1) / 2) * 0.35 + (i % 2 ? 0.12 : -0.12), r = R * rand(0.85, 1.05);
    const x = Math.cos(b) * r, y = Math.sin(b) * r;
    spawnEnemy(pick(types.length ? types : ['skeleton']), { elite: true, noChest: true, x, y }); // 親衛隊は宝箱を落とさない
    burst(x, y, 16, ['#ffd23f', '#ffffff'], { sp: 80, glow: true, life: 0.5 });
  }
}
function arenaBossDown(e) {
  const A = S.arena, cfg = DATA.arena, xp = xpForLevels(cfg.rewardLv), n = 14;
  for (let i = 0; i < n; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), xp / n);
  for (let i = 0; i < 25; i++) dropItem('coin', e.x, e.y, 2 + A.idx);
  dropItem('meat', e.x + 14, e.y); dropItem('magnet', e.x - 14, e.y);
  dropItem('chest', e.x, e.y - 14); // 装備宝箱
  A.idx++;
  if (A.idx >= cfg.order.length) { S.won = true; S.victoryT = 3.2; AudioMan.stopMusic(1.5); UI.announce('ARENA CLEAR!!', '全ボス撃破'); return; }
  A.restT = cfg.rest; A.warned = false;
  UI.announce('ROUND ' + A.idx + ' CLEAR!', '報酬を拾って次に備えよ');
  AudioMan.playMusic(DATA.stages[S.stage - 1].music);
}
// 闘技場の壁: プレイヤー・敵・ドロップを円内に収める
function confineArena() {
  const R = DATA.arena.r;
  const fit = (o, r) => { const d = Math.hypot(o.x, o.y), m = R - r; if (d > m) { o.x *= m / d; o.y *= m / d; } };
  fit(P, 5);
  for (const e of enemies) if (!e.dead) fit(e, e.r);
  for (const g of gems) fit(g, 3);
  for (const d of drops) fit(d, 5);
}

function horde() {
  UI.banner('HORDE INCOMING!!', '大群が迫ってくる…', 2000);
  AudioMan.warning(); shake(5);
  const cfg = S.spawnCfg || { types: ['zombie'] }, R = Math.hypot(GFX.VW, GFX.VH) / 2 + 20, n = 48;
  for (let i = 0; i < n; i++) { const a = TAU / n * i, t = pickType(cfg.types); if (t) spawnEnemy(t, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); }
}

// ============================================================
// 報酬ロジック(レベルアップ)
// 3の倍数の Lv = クラス強化 / それ以外 = 武器カード / 武器カードを取り切ったら微強化(メニューなし)
// ============================================================
const isClassLv = lv => lv % 3 === 0;
// 3の倍数以外: 武器カードと装備カードを混ぜる。1枚ごとに cardRate で装備カード(片方が尽きたらもう片方)
// 進化できる武器があれば必ず1枚入れる。両方尽きたら空(微強化)
function buildChoices(lv) {
  if (isClassLv(lv)) return clsChoices(3 + (P.stats.v.classPick || 0));
  const n = 3 + (P.stats.v.gearPick || 0), wp = weaponPool(), eq = shuffle(eqCards()), evo = evolvable();
  const out = evo.length ? [{ type: 'evo', key: evo[0] }] : [];
  while (out.length < n && (wp.length || eq.length)) {
    if (eq.length && (!wp.length || Math.random() < DATA.equip.cardRate)) { out.push(eq.pop()); continue; }
    let r = Math.random() * wp.reduce((sum, c) => sum + c.w, 0), i = 0; // 武器は重み付きで引く
    while ((r -= wp[i].w) > 0) i++;
    out.push(wp.splice(i, 1)[0]);
  }
  return out;
}
// 武器カードの候補: 新しいサブ武器(武器枠に空きがあるとき)/ 所持武器の Lv +1
function weaponPool() {
  const pool = [], wc = Object.keys(P.weapons).length;
  for (const k in DATA.weapons) {
    const w = P.weapons[k];
    if (!w) { if (wc < S.weaponSlots) pool.push({ type: 'weapon', key: k, w: 1 }); } // サブ武器(メイン武器は所持済みなので Lv アップのみ)
    else if (w.lv < 5) pool.push({ type: 'weapon', key: k, w: 1.6 });
  }
  return pool;
}
function applyChoice(c) {
  if (c.type === 'weapon') addWeapon(c.key);
  else if (c.type === 'evo') P.weapons[c.key].evo = true;
  else if (c.type === 'cls') clsApply(c);
  else if (c.type === 'eqopt') eqLvUp(c.slot, c.i);
  else if (c.type === 'item') { /* 宝箱を開けた時点でインベントリに入っている */ }
  S.hudDirty = true;
}
// 進化: 武器Lv5 かつ 熟練で解放済み(その武器を持つクラスの Lv10。メイン武器もサブ武器も)
function evolvable() {
  return Object.keys(P.weapons).filter(k => {
    const w = P.weapons[k];
    return w.lv >= 5 && !w.evo && !!(P.wm[k] && P.wm[k].evo);
  });
}
// 微強化: 武器カードを取り切った後のレベルアップ(ランダムに1つ、浮き文字で通知)
function microBuff() {
  const m = pick(DATA.micro);
  P.micro[m.k] = (P.micro[m.k] || 0) + m.v;
  recalc();
  addFloat(P.x, P.y - 20, m.label, '#ffd23f', 1.1);
  burst(P.x, P.y, 14, ['#ffd23f', '#ffffff'], { sp: 90, up: 40, glow: true });
}
