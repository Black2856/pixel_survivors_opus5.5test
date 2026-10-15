// world.js — ラン初期化 / ステータス(カオス強化・敵レベル)/ 敵の色。プレイヤー・武器・敵・ボスなどは分けたファイル(index.html の順に読む)
'use strict';

const ECOL = {
  zombie: ['#7fb069', '#6b5a8e'], bat: ['#8a4fc0', '#2a1838'], slime: ['#4fd6a8', '#d8fff2'], slimelet: ['#4fd6a8', '#d8fff2'],
  skeleton: ['#e8e6da', '#6b6a60'], archer: ['#e8e6da', '#35523d'], ghost: ['#dcefff', '#8ab8ff'], brute: ['#c46a4a', '#6b4a2a'],
  imp: ['#ff6a3d', '#8a2a4a'], goblin: ['#8fd06a', '#ffcc33'], brazier: ['#ff6a2a', '#ffc34a'],
  sandmage: ['#e8c88a', '#8a5a2a'], spear: ['#c8b89a', '#7a3a2a'], hound: ['#ff6a2a', '#3a1a1a'], onibi: ['#7ad7ff', '#ffffff'], lslime: ['#ff6a2a', '#5a1a14'], mworm: ['#ff6a2a', '#3a1a10'],
  jslime: ['#9ff7ff', '#ff8ad8'], beetle: ['#5a4a8a', '#9ff7ff'], fairy: ['#ffd0f0', '#9ff7ff'],
  jelly: ['#ffb0e0', '#bff4ff'], sahagin: ['#3a9a8a', '#bff4ff'], puffer: ['#e8c86a', '#8a6a3a'], angler: ['#2a4a5a', '#fff6a0'],
  wolf: ['#d8e4f4', '#6a7a9a'], icesprite: ['#9ff7ff', '#ffffff'], yeti: ['#f0f4ff', '#7a8aa8'],
  gear: ['#c8a050', '#5a4a30'], clockman: ['#c8a050', '#e8e0c8'], hglass: ['#e8c88a', '#9ff7ff'],
  spider: ['#6a4a8a', '#7dff6a'], ghoul: ['#8aa86a', '#5a3a6a'], shadoweye: ['#c79bff', '#3a1a5a'], stalker: ['#4a3a6a', '#c79bff'],
  sapling: ['#8fd06a', '#5a3a1a'], treant: ['#6a8a3a', '#4a3020'], bee: ['#ffd23f', '#2a2010'], squirrel: ['#c8783a', '#f0d8b0'], bear: ['#7a4a2a', '#3a2010'],
  scorpion: ['#e09048', '#3a1e0c'], vulture: ['#4a3020', '#e8e0d0'], sanddoll: ['#e8c88a', '#a8803a'], sandmound: ['#e8c88a', '#a8803a'], antlion: ['#b8946a', '#e8d8b0'],
  raichild: ['#8aa8ff', '#e8f0ff'], raincloud: ['#8a84b8', '#d8c8ff'], twinsprite: ['#b8a0ff', '#5ac8ff'], tarmor: ['#6a7aa8', '#d8b060'],
  firemage: ['#d8583a', '#ffd27a'], frostmage: ['#dceeff', '#5a8ac8'], thundermage: ['#f0c840', '#3c3c5c'],
  lightmoth: ['#fff2c8', '#ffd23f'], lampkeeper: ['#5a5678', '#ffd23f'], glassangel: ['#e84860', '#4878e8'], holymage: ['#fffaf0', '#ffd23f'],
};
// メイジのバフ(DATA.enemies の buff.k)の色: 足元の輪の [手前, 光, 奥] と、バフの間に昇る粒 / メイジの構えで杖の珠へ集まる光
const BUFF_COL = {
  atk: { ring: ['#ff8a3d', '#7a3010', '#a8481a'], parts: ['#ff8a3d', '#ffc34a'] },
  def: { ring: ['#7ad7ff', '#1a4a6a', '#3a7aa8'], parts: ['#9ff7ff', '#e8f8ff'] },
  spd: { ring: ['#ffe14a', '#6a5a14', '#a8902a'], parts: ['#ffe14a', '#fff6a0'] },
  heal: { ring: ['#ffe8a0', '#6a5a24', '#c8a050'], parts: ['#fff6c8', '#ffe8a0'] }, // ホーリーメイジの回復(時間のバフではないので足元の輪は出ない。広がる輪と粒の色)
};
const MAGE_COL = { firemage: ['#ff6a2a', '#ffc34a', '#fff6c8'], frostmage: ['#9ff7ff', '#7ad7ff', '#ffffff'], thundermage: ['#ffe14a', '#d8c8ff', '#ffffff'], holymage: ['#ffd23f', '#fff6c8', '#ffffff'] };
// メイジのバフの量(かかっていなければ 0): atk = 攻撃力 +v / def = 受けるダメージ −v / spd = 移動速度 +v
const buffOn = (e, k) => { const b = e.buffs && e.buffs[k]; return b && b.t > S.time ? b.v : 0; };
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
    if (w.r0) w.r0 *= CHAOS.area; // 輪(影の三重輪)の内側
    if (w.w) w.w *= CHAOS.area;
    if (w.len) w.len *= CHAOS.area;
  }
  warns.push(w);
}

// 通常モード(ステージを1つ選ぶ)の出現スケジュール。t はフェーズの時計(ボス・エリート群の間は止まる)
// 3分 → エリート群 → 3分 → ボス1 → 3分 → ボス2(倒すとクリア)。同じ t ではフェーズの開始を波の切り替えより先に処理する
const stageRun = n => DATA.stageRuns.find(r => r.no === n); // ステージのキーの番号(stage1〜12)から
// 出現の候補には「敵のまとまり」(配列)が入ることがある(時計塔の「今までの敵」)。まとまりは 1枠として選ばれ、その中から1種
// spawnW: 選ばれやすさ(既定 1)/ group: 6体の小集団(noGroup の敵は出ない)/ maxAlive: 同時にいられる数(超えるなら選ばない)/ skip: 選ばない種類(大群で一度出た solo の敵)。選べないときは null
function pickType(types, group, skip) {
  const ok = t => { const d = DATA.enemies[t]; return !(group && d.noGroup) && !(skip && skip.has(t)) && !(d.maxAlive && enemies.filter(e => !e.dead && e.type === t).length >= d.maxAlive); };
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
// エスカレーション: tier 1 → 4 を通す。tier ごとに同じ tier のステージからランダムに1つ選び、3分(3種 → 5種 → 全種。DATA.flow.esc)→ ボス → 次の tier
//   ボスはそのステージのボス2体からランダム。敵Lv は通して上がり続ける(ボスの間は止まる)
//   tier 4 は 3分 → ボス(そのステージの1体目)→ esc.rest 秒 → ラスボス(2体目。時計塔 = 死神(→ 終刻の死神)/ 王墓 = 影の王)で、倒すとクリア
//   敵: 0秒 = そのステージの最初の3種 / 60秒 = 同じ tier のほかのステージの敵からランダムに add 種を足す / 120秒 = その tier のステージの敵の全部
//   ほかのステージからは、そのステージの敵だけを足す(時計塔の「今までの敵」のまとまりは、時計塔のときだけ出る)
function escSchedule(R, tier) {
  const F = DATA.flow, E = F.esc;
  const cands = r => r.segs.filter(Boolean).flat(); // ステージの出現の候補(まとまりは 1つの候補のまま)
  const own = cands(R).filter((t, i, a) => a.findIndex(u => String(u) === String(t)) === i); // まとまりは中身が同じなら同じもの
  const other = [...new Set(DATA.stageRuns.filter(r => r.tier === tier && r !== R).flatMap(cands).filter(t => typeof t === 'string' && !own.includes(t)))];
  const lists = [R.segs[0], [...R.segs[0], ...shuffle(other.slice()).slice(0, E.add)], [...own, ...other]];
  const out = E.waves.map((w, i) => ({ t: w.t, types: lists[i], interval: w.interval, max: w.max }));
  if (tier >= 4) out.push({ t: F.seg, boss: [R.bosses[0]] }, { t: F.seg + E.rest, boss: [R.bosses[1]], final: true }); // ラスボスはボスを倒してから rest 秒(ボスの間はフェーズの時計が止まる)
  else out.push({ t: F.seg, boss: R.bosses });
  return out;
}
// 報酬の倍率(獲得ゴールド・装備品質・宝箱品質・クラス経験値。stats.js の computeStats が掛ける)
//   通常モード = ステージの tier(DATA.flow.tierRew)/ エスカレーション = S.rewMul(tier が進むたびに上がる)/ 闘技場 = ラウンドの tier(2ラウンドごと)
function rewMul() {
  if (!S) return 1;
  const T = DATA.flow.tierRew;
  if (S.mode === 'escalation') return S.rewMul || 1;
  if (S.mode === 'arena') return T[Math.min(T.length - 1, Math.floor((S.arena ? S.arena.idx : 0) / 2))];
  return T[Math.max(0, Math.min(T.length - 1, (S.tier || 1) - 1))];
}
function escStage(tier, first) {
  const R = pick(DATA.stageRuns.filter(r => r.tier === tier));
  S.tier = tier; S.escRun = R.no; setStage(R.stage);
  S.ptime = 0; S.schedIdx = 0; S.sched = escSchedule(R, tier);
  if (first) return;
  const ER = DATA.flow.escRew; // 報酬の倍率: tier が進むたびに +step(周回してからは +loopStep。max まで)
  S.rewMul = Math.min(ER.max, Math.round(((S.rewMul || 1) + (S.loop > 1 ? ER.loopStep : ER.step)) * 100) / 100);
  recalc();
  AudioMan.playMusic(DATA.stages[R.stage - 1].music);
  UI.banner('TIER ' + tier, _t`${DATA.stages[R.stage - 1].label} ・ 報酬 ×${S.rewMul.toFixed(1)}`, 2200);
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
    rewMul: 1, cxpK: 0, cxpB: 0, // rewMul: エスカレーションの報酬の倍率(tier が進むたびに上がる)/ cxpK・cxpB: 撃破数・ボス撃破数に、倒したときの報酬の倍率を掛けて足したもの(クラス経験値)
  };
  P = {
    cls: META.cls, mainW: META.classes[META.cls].weapon, micro: {}, lvFx: classLvFx(META.cls), wm: {}, x: 0, y: 0, hp: 0, maxhp: 100, level: 1, xp: 0, xpNext: xpFor(1), weapons: {},
    ifr: 0, facing: 1, animT: 0, moving: false, hurtT: 0, dead: false,
    slowT: 0, cdSlowT: 0, burnT: 0, burnDmg: 0, burnTick: 0, shield: 0, oShield: 0, oChunks: [],
    frost: 0, frostT: 0, bleed: 0, bleedT: 0, bleedTick: 0, // 自分の凍傷・出血(スタック数と、消えるまでの秒)
    push: null, rootT: 0, current: null, // ボスの押し出し・引き寄せ / 絡め取りで動けない(秒)/ 海流
    frzT: 0, iceT: 0, ivx: 0, ivy: 0, // 凍結(凍傷が上限に達した。行動不能・攻撃不能の秒)/ 滑る床の上(秒)と、そのときの速度
    fatigueT: 0, // 疲労(スタミナを減らす攻撃を受けた): スタミナ回復 -50% の残り秒
    poison: 0, poisonT: 0, darkT: 0, // 毒(スタック数・消えるまでの秒)/ 暗闇の残り秒(王墓)
    numb: 0, numbT: 0, paraT: 0, dust: 0, dustT: 0, weak: 0, weakT: 0, // 痺れ・砂塵・衰弱(スタック数・消えるまでの秒)/ 麻痺(痺れが上限に達した。攻撃不能の秒)
    lockT: 0, lockMax: 0, noHealT: 0, noHealMax: 0, // 攻撃不能・回復不能(熾天使のラストラディアンス)の残り秒と、付いたときの長さ
    dazT: 0, dazMax: 0, dazImm: 0, // 眩惑(光の蝶)の残り秒・付いたときの長さ / 眩惑にならない残り秒(眩惑の間と、切れてからしばらく)
  };
  enemies = []; projs = []; eprojs = []; gems = []; drops = []; props = []; hazards = [];
  parts = []; floats = []; rings = []; zones = []; slashes = []; bolts = []; warns = []; flashes = []; bfx = []; sfx = [];
  eqInitRun();
  const st = recalc();
  P.hp = P.maxhp;
  addWeapon(P.mainW); // 1枠目はクラスのメイン武器(固定)
  S.rerolls = st.v.reroll; S.weaponSlots = st.v.wslot;
  clsInit();
  S.stageNo = stageNo; S.sched = mode === 'stage' ? stageSchedule(stageNo) : []; // エスカレーションは下の escStage で、闘技場は使わない
  if (mode === 'arena') { S.stage = 4; S.elv = DATA.arena.elv[0]; S.arena = { idx: 0, restT: 3, warned: false, order: arenaOrder() }; } // 開始時の敵Lv(深い闇)は下で足す。ラウンドの敵Lv は arenaLv
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
  if (P.noHealT > 0) return; // 回復不能(ラストラディアンス): 肉・スキル・吸血など、すべての回復が効かない
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
