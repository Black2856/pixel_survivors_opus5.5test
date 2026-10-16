// tower.js — チャレンジタワー(claudedocs/tower.md): 休憩 → 階(撃破数でクリア。5階ごとにボス)→ 休憩 → 次の階 …。40階で 1周
'use strict';

// 協力プレイで全員が同じもの(階・撃破数・霧の時計・ステージ・カオス強化)は S.tower に、1人ずつのもの(貯蓄経験値)は P.bank に持つ
const towerLap = n => Math.floor((n - 1) / DATA.tower.lap) + 1;       // 何周目か(1〜40階 = 1)
const towerIsBoss = n => n % DATA.tower.bossEvery === 0;                // ボスの階(5・10・15 …)
const towerGoal = n => DATA.tower.kills + (n - 1) * DATA.tower.killStep; // その階の撃破数
// 飛ばせる階の数: 撃破数に届くまでの秒 t で決まる。次のボスの階は越えない(4階なら 0)
function towerSkip(n, t) {
  const C = DATA.tower, cap = Math.ceil((n + 1) / C.bossEvery) * C.bossEvery - n - 1, s = C.skip.find(([sec]) => t <= sec);
  return s ? Math.min(cap, s[1]) : 0;
}

// 1周の顔ぶれ(周の始めに1回): 5階ずつの 8区間。tier 1〜3 は、その tier のステージから 2つ(ステージの並び順)。ボスはそのステージの 2体のどちらか
//   31〜35階は tier 4 のどれかのステージで 1体目のボス、36〜40階は tier 4 のどれかのステージで 2体目のボス
//   extra: 2周目から足す、同じ tier のほかのステージ(2周目 1つ、3周目から 2つ = その tier の全部)
function towerPlan(lap) {
  const out = [], others = R => shuffle(DATA.stageRuns.filter(r => r.tier === R.tier && r !== R)).slice(0, Math.min(2, lap - 1));
  for (const t of [1, 2, 3]) {
    const rs = DATA.stageRuns.filter(r => r.tier === t);
    for (const R of shuffle(rs.slice()).slice(0, 2).sort((a, b) => rs.indexOf(a) - rs.indexOf(b))) out.push({ run: R, tier: t, bosses: R.bosses.slice(), extra: others(R) });
  }
  const t4 = DATA.stageRuns.filter(r => r.tier === 4);
  for (const i of [0, 1]) { const R = pick(t4); out.push({ run: R, tier: 4, bosses: [R.bosses[i]], extra: others(R) }); }
  return out;
}
// ラン開始(initRun から): 1周目の顔ぶれと、1階の前の短い休憩
function towerInit() {
  const plan = towerPlan(1);
  S.tower = {
    floor: 0, next: 1, lap: 1, plan, top: 0, topT: 0, // top / topT: 着いた階の一番上と、そこに着いたときの経過時間(記録)
    wave: false, boss: false, kills: 0, goal: 0, t: 0, // wave: 階の途中(経験値は貯めるだけ)/ t: その階の経過秒(スキップの速さ)
    rest: 2, warned: false, hpK: DATA.tower.partyHp[0], twinEx: [], // rest: 休憩の残り秒 / hpK: 敵の HP の人数の倍率 / twinEx: 双王の相方に選ばないボス(その階のステージのボス2体)
  };
  S.stage = plan[0].run.stage; S.tier = 1;
}

// 毎フレーム(updSpawner から): 階の途中なら経過を数えて撃破数でクリア。休憩中は時間で次の階へ。戻り値: 通常の出現を進めるか
function updTower(dt) {
  const T = S.tower;
  if (T.wave) {
    T.t += dt;
    if (!T.boss && T.kills >= T.goal) towerClear();
    return T.wave;
  }
  const choosing = players.some(p => p.pendingLv > 0 || p.lvPick);
  if (players.length > 1) T.waitT = (T.waitT || 0) + dt; // 協力プレイ: クリアからの秒(tower.md #31)
  else if (choosing) return false; // 1人: レベルアップの選択中は休憩の時計も止まる
  T.rest -= dt;
  if (!T.warned && T.rest <= 2.5) {
    T.warned = true;
    UI.announce(T.next + 'F', towerIsBoss(T.next) ? _t('ボスの階') : _t`${towerGoal(T.next)}体 倒すと次の階へ`);
    AudioMan.warning();
  }
  // 協力プレイ: 全員が選び終わり、かつ休憩が終わった時か、クリアから coopWait 秒(選び終わっていない人は次の階でも選び続ける)
  if (T.rest <= 0 && (players.length === 1 || !choosing || T.waitT >= DATA.tower.coopWait)) { T.waitT = 0; towerFloor(T.next); }
  return false;
}

// 階の始め: 敵Lv = 階、ステージ・出現の候補・カオス強化をその階のものに。ボスの階はボスを出す
function towerFloor(n) {
  if (players.length > 1) for (const p of players) if (p.dead && !p.left) withPlayer(p, coopRevive); // 協力プレイ: 倒れた人は次の階の始めに戻る(tower.md #17)
  const T = S.tower, C = DATA.tower, lap = towerLap(n), pos = (n - 1) % C.lap;
  if (lap !== T.lap) { T.lap = lap; T.plan = towerPlan(lap); }
  const B = T.plan[Math.floor(pos / C.bossEvery)], i = pos % C.bossEvery, goal = towerGoal(n);
  T.floor = n; T.kills = 0; T.t = 0; T.wave = true; T.boss = towerIsBoss(n); T.goal = T.boss ? 0 : goal;
  if (n > T.top) { T.top = n; T.topT = S.time; }
  S.tier = B.tier; S.elv = n; UI.enemyLvUp();
  if (S.stage !== B.run.stage) setStage(B.run.stage);
  // 敵: 区間の 1・2階 = 1つ目の段、3階 = 2つ目、4・5階 = そのステージの敵の全部(2周目からは、ほかのステージの同じ段も足す)
  const li = i < 2 ? 0 : i < 3 ? 1 : 2;
  S.spawnCfg = { types: uniqTypes([B.run, ...B.extra].flatMap(R => runLists(R)[li])), interval: C.spawnK / goal, max: goal * C.maxK };
  const chaos = towerChaos(n, lap);
  recalc(); // 報酬の倍率(tier)・カオス強化の報酬
  T.twinEx = B.run.bosses.slice(); // 双王の相方に選ばない(影の王・熾天使は DATA.bosses の noTwin でどのモードでも選ばれない)
  if (T.boss) {
    spawnBoss(pick(B.bosses)); // ボスのフェーズ(出現率 ×0.6・ボスの出現から 3分で闇の霧)
    if (chaos) UI.announce(n + 'F', chaos);
  } else {
    S.phase = { kind: 'wave', t: 0 }; // 闇の霧の時計だけ(ボス・エリート群のフェーズの決まりは付けない。inPhase)
    AudioMan.playMusic(DATA.stages[S.stage - 1].music);
    UI.banner(n + 'F', chaos || _t`${goal}体 倒すと次の階へ`, 1800);
  }
}
// カオス強化(2周目から): 周ごとに 1つずつ増える。通常の階は chaos から最大 4つ、ボスの階は 血の夜明けか双王のどちらかを候補に足して最大 5つ。Lv は最大
//   戻り値: 付いた項目の名前(帯に出す。無ければ '')
function towerChaos(n, lap) {
  const C = DATA.tower, mods = chaosMods('tower'), lv = {};
  if (lap > 1) for (const k of shuffle(towerIsBoss(n) ? [...C.chaos, pick(C.bossChaos)] : C.chaos.slice()).slice(0, lap - 1)) lv[k] = mods.find(m => m.k === k).max;
  S.chaos = lv; S.chaosPt = chaosPoints(lv, 'tower'); S.chaosReward = chaosReward(S.chaosPt);
  setupChaos(lv, 'tower');
  return mods.filter(m => lv[m.k]).map(m => m.name).join(_t('・'));
}

// 階のクリア(撃破数に届いた / ボスを倒した): 床のジェムを貯蓄へ → 貯蓄経験値 ×(1 + 飛ばした階の数)が入る → 残った敵は消える → 休憩
//   ボスの階は onBossDeath から(ボスの報酬はこの後に落ちるので、休憩中に拾ってそのまま経験値になる)
function towerClear() {
  const T = S.tower, C = DATA.tower, skip = T.boss ? 0 : towerSkip(T.floor, T.t);
  T.wave = false;
  for (const g of gems) P.bank += g.v * P.xpMul;
  gems = [];
  const xp = P.bank * (1 + skip);
  P.bank = 0;
  if (xp > 0) xpIn(xp);
  for (const e of enemies) if (!e.dead && !e.boss && !e.prop) { e.dead = true; burst(e.x, e.y, 6, ['#3a3040', '#6a6070', '#ffffff'], { sp: 40, up: 15 }); }
  eprojs = []; warns = []; hazards = [];
  S.phase = null; // 闇の霧も晴れる
  T.next = T.floor + 1 + skip; T.rest = C.rest; T.warned = false;
  if (T.boss) { UI.announce(_t('FLOOR CLEAR'), _t('報酬を拾って次に備えよ')); AudioMan.playMusic(DATA.stages[S.stage - 1].music); return; } // 撃破の演出は onBossDeath
  UI.banner('FLOOR CLEAR', skip ? _t`${skip}階 スキップ! 経験値 ×${1 + skip}` : _t('次の階へ'), 2200, 'gold');
  AudioMan.phaseClear(); screenFlash(0.35, '#ffd23f'); shockAt(P.x, P.y, 1.6, 0.6);
  addRing(P.x, P.y, 120, '#ffd23f', { w: 3, life: 0.8 });
}

// HUD のステージ名の横: 休憩の残り / ボス戦 / 撃破数と、今のスキップが続く残り時間
function towerInfo() {
  const T = S.tower, C = DATA.tower, fog = S.phase && S.phase.fogOn ? _t(' · 闇の霧') : '';
  if (!T.wave) return _t`休憩 ${Math.ceil(Math.max(0, T.rest))}秒 → ${T.next}F`;
  if (T.boss) return _t('ボス戦') + fog;
  const v = towerSkip(T.floor, T.t), end = Math.max(0, ...C.skip.filter(([sec]) => sec > T.t && towerSkip(T.floor, sec) >= v).map(([sec]) => sec));
  return `☠ ${T.kills}/${T.goal}` + (v ? _t` · +${v}階 あと ${fmtTime(end - T.t)}` : '') + fog;
}
// HUD の LV の横: 貯蓄経験値が入ると上がる Lv の数(階の途中だけ)
function towerBankLv() {
  if (!S.tower || !S.tower.wave || !P.bank) return 0;
  let x = P.xp + P.bank, l = P.level, need = P.xpNext, n = 0;
  while (x >= need && n < 999) { x -= need; l++; n++; need = xpFor(l); }
  return n;
}
