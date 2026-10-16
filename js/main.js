// main.js — 画面遷移 / メイン更新 / カメラ / メインループ
'use strict';

// ============================================================
// 画面遷移
// ============================================================
function startRun(mode = 'escalation', stageNo = 1) {
  AudioMan.unlock();
  initRun(mode, stageNo);
  GFX.fx.sat = 1; // 時間停止・変身の途中で終わったランの色あせを戻す
  UI.bossBar(null); // 前のランでボス戦中に倒れたときのボスの HP バーを消す
  cam.fx = P.x - GFX.VW / 2; cam.fy = P.y - GFX.VH / 2;
  groundCache.clear();
  UI.show(UI.$('hud'));
  UI.beginPlay();
  AudioMan.playMusic(DATA.stages[S.stage - 1].music); // ステージのフィールド曲(闘技場は荒野の曲)
  // 闘技場: 雑魚から経験値を稼げないので開始時にまとめてレベルアップ
  if (mode === 'arena') gainXP(xpForLevels(DATA.arena.startLv) / P.xpMul);
  screenFlash(0.5);
  shockAt(P.x, P.y, 1.5);
}
// クリア記録のキー: escalation / arena / stage1〜12
const runKey = () => (S.mode === 'stage' ? 'stage' + S.stageNo : S.mode);
// 協力プレイは止めない(#9。ESC・ウィンドウを離れた時・縦向きでも)
function pauseGame() { if (state !== 'play' || COOP.on) return; state = 'pause'; UI.pause(true); AudioMan.pauseMusic(); }
function resumeGame() { if (state !== 'pause') return; state = 'play'; UI.pause(false); AudioMan.resumeMusic(); }
function endRun(win) {
  if (COOP.on) return coopEndRun(win); // 協力プレイ(4段の仮): 記録・報酬はまだ保存しない
  const earned = P.gold + Math.floor(P.kills / 25);
  META.gold += earned; META.runs++;
  if (S.mode === 'arena') { // 闘技場は専用の記録(撃破ラウンド / 最速クリア)
    META.best.arenaRound = Math.max(META.best.arenaRound || 0, S.arena.idx);
    if (win) META.best.arenaTime = Math.min(META.best.arenaTime || Infinity, S.time);
  } else if (S.mode === 'tower') { // タワーも専用の記録(着いた階の一番上 / その階に着いたときの経過時間。同じ階なら早い方)
    const B = META.best, T = S.tower;
    if (T.top > (B.towerFloor || 0) || (T.top && T.top === B.towerFloor && T.topT < (B.towerTime ?? Infinity))) { B.towerFloor = T.top; B.towerTime = T.topT; }
  } else {
    if (S.time > META.best.time) META.best.time = S.time;
    META.best.kills = Math.max(META.best.kills, P.kills);
    META.best.level = Math.max(META.best.level, P.level);
  }
  const locked = DATA.classOrder.filter(k => !clsUnlocked(k));
  // 初クリアのゴールド: ステージ(通常モード)を初めてクリアしたとき、そのステージの tier の額(エスカレーション・闘技場には無い)
  const first = win && S.mode === 'stage' && !META.stageClear[runKey()] ? DATA.flow.firstClear[S.tier - 1] || 0 : 0;
  META.gold += first;
  if (win) META.stageClear[runKey()] = true; // クリアしたモード・ステージ(カオス強化・クラスの解放条件)
  const loot = runEndLoot(win), cxp = gainClassXp(); // 装備の報酬(インベントリへ)とクラス経験値
  cxp.newCls = locked.filter(clsUnlocked); // このクリアで解放されたクラス
  saveMeta();
  state = win ? 'victory' : 'over';
  if (!win) AudioMan.stopMusic(1.5);
  UI.result(win, earned, loot, cxp, first);
}
function startEndless() {
  // エスカレーションのクリア後もそのまま続行(tier 1 のステージから。ゴールドはリザルト時に精算済みなのでリセット)
  P.gold = 0; S.loop = 2; S.won = false;
  escStage(1);
  UI.show(UI.$('hud')); UI.pause(false);
  state = 'play';
  UI.announce('ENDLESS MODE', _t('LOOP 2 — 敵はさらに強くなる'));
}
function goTitle() {
  state = 'title';
  demoWorld();
  UI.title();
  AudioMan.playMusic('title');
}
function demoWorld() {
  initRun('stage', 1); // タイトルの背景は草原
  S.demo = true;
  groundCache.clear();
}

function onKey(e) {
  if (StatusUI.modalOpen()) { if (e.code === 'Escape' || e.code === 'Tab') { if (e.preventDefault) e.preventDefault(); StatusUI.closeModal(); } return; } // 詳細のモーダルを先に閉じる
  if (Help.onKey(e)) return; // ガイド画面(ESC で戻る)
  if (e.code === 'KeyM') AudioMan.toggleMute();
  if (e.code === 'Escape') { if (state === 'play') pauseGame(); else if (state === 'pause') resumeGame(); else if (state === 'settings') UI.closeSettings(); }
  if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) MetaUI.stageSelect();
  else if ((state === 'over' || state === 'victory') && e.code === 'KeyR') startRun(S.mode, S.stageNo);
  else if (state === 'victory' && e.code === 'Enter' && S.mode === 'escalation') startEndless();
  UI.onKey(e);
  MetaUI.onKey(e);
  Gacha.onKey(e);
  StatusUI.onKey(e);
}

// ============================================================
// メイン更新
// ============================================================
// inp: この計算 1回の入力の記録(省略で今の入力を取る。通信の遅れを試す NET_SIM・協力プレイは列から渡す)。協力プレイは players の順の配列
function update(rdt, inp = readInput()) {
  const ins = Array.isArray(inp) ? inp : [inp];
  players.forEach((p, i) => {
    const r = ins[i] || NO_INPUT;
    p.inp = r;
    if (r.e) p.wantE = true; // 押した印は、スキルの処理が使い切るまで残す(ヒットストップの間に押しても消えない)
    if (r.q) p.wantQ = true;
  });
  const step = () => { updWorld(rdt); tickSimTimers(rdt); }; // タイマーはヒットストップ・時間停止の間も進む(今までの setTimeout と同じく実時間の側)
  if (SIM_VIEW.on) simView(step); else step(); // 入力の照準は入れ替える前の本当のカメラで取る(readInput)
}
function updWorld(rdt) {
  if (S.freeze > 0) { S.freeze -= rdt; return; }
  if (S.morph) { updMorph(rdt); return; } // 死神の変身: 時が止まる(すべて止まり、画面が色あせる)
  if (S.cine) { updCine(rdt); return; } // 影の王の冥鎖: 杭が落ちて鎖がつながる間は、すべて止まる
  if (S.tsBack > 0) S.tsBack -= rdt; else S.ts = Math.min(1, S.ts + rdt * 1.5);
  const dt = rdt * S.ts;
  // 1人ずつの処理は players の順に P を入れ替えて(1人用は 1回)。共有の処理は誰か 1人でも生きていれば
  if (anyAlive()) S.time += dt;
  for (const p of players) if (!p.dead) withPlayer(p, () => updPlayer(dt));
  buildGrid();
  FX_MINE = true; // 自分の攻撃による演出(濃さ設定の対象)
  for (const p of players) if (!p.dead) withPlayer(p, () => updWeapons(dt));
  updProjs(dt); // 弾・ゾーンは作った人で(owned)
  updZones(dt);
  FX_MINE = false;
  updEnemies(dt);
  if (anyAlive()) { updEnemyLevel(dt); updPhase(dt); } // フェーズの時計 / エリート群の終わり / 闇の霧
  updEprojs(dt);
  updHazards(dt);
  if (S.mode === 'arena') confineArena();
  if (anyAlive()) { updGems(dt); updDrops(dt); updSpawner(dt); }
  updFx(dt);
  if (anyAlive()) updSky(dt); // ステージの空(雲海の稲光と遠雷)
  for (const p of players) { p.comboT -= dt; if (p.comboT <= 0 && p.combo > 0) p.combo = 0; }

  // レベルアップ演出 → 選択画面(自分 = players[0]。協力プレイのほかの人の止まらないレベルアップは 5段)
  if (COOP.on) coopAutoLevel(); // 協力プレイ(4段の仮): 止まらないレベルアップの画面は 5段
  else if (P.pendingLv > 0 && !P.dead && state === 'play') {
    if (P.lvUpT <= 0) {
      P.lvUpT = 0.4;
      AudioMan.levelup(); slowmo(0.15, 0.3);
      screenFlash(0.35, '#ffd23f'); shockAt(P.x, P.y, 1.2, 1.1);
      addRing(P.x, P.y, 60, '#ffd23f', { w: 3, life: 0.4 }); addFlash(P.x, P.y, 140, '#ffd23f', 0.5);
      for (let i = 0; i < 40; i++) part(P.x + rand(-8, 8), P.y + rand(-2, 6), rand(-15, 15), -rand(60, 160), rand(0.5, 1), pick(['#ffd23f', '#fff6c8', '#ff8c42']), { glow: true, drag: 1.5 });
    }
    P.lvUpT -= rdt;
    if (P.lvUpT <= 0) {
      P.pendingLv--;
      const lv = P.lvQueue.shift() || P.level, list = buildChoices(lv);
      if (list.length) UI.levelUp(lv, list); else microBuff();
    }
  }
  if (!anyAlive()) { P.deathT -= rdt; if (P.deathT <= 0) endRun(false); } // 全員が倒れたら(倒れた人の復活は tower.md #17・5段)
  if (S.victoryT > 0) { S.victoryT -= rdt; if (S.victoryT <= 0) { AudioMan.playMusic('title'); endRun(true); } }
}

function updCam(dt) {
  if (S.demo) { cam.fx = (cam.fx || 0) + dt * 10; cam.fy = (cam.fy || 0) + dt * 4; }
  else {
    const [mx, my] = P.dead ? [0, 0] : moveInput();
    const tx = P.x - GFX.VW / 2 + mx * 14, ty = P.y - GFX.VH / 2 + my * 10;
    const k = 1 - Math.exp(-6 * dt);
    cam.fx += (tx - cam.fx) * k; cam.fy += (ty - cam.fy) * k;
  }
  cam.shake = Math.max(0, cam.shake - dt * 30);
  const s = cam.shake;
  cam.x = Math.round(cam.fx + frand(-s, s)); cam.y = Math.round(cam.fy + frand(-s, s)); // 揺れは見た目の列(フレームの数は人によって違う)
  GFX.fx.aberr = Math.max(GFX.fx.aberr, s * 0.04);
}

// ============================================================
// メインループ
// ============================================================
let lastT = performance.now();
// 計算を 1/60 秒ずつ進める形(協力プレイは全員が同じ長さで進める。協力プレイの時に on にする: claudedocs/coop.md #23)
//   1人用は今までどおり画面のフレームの長さで進める(120Hz・144Hz の画面でもなめらか)。試すときはコンソールで FIXED_STEP.on = true
//   溜まった実時間の分だけ進める。遅れが大きいときは max 回まで(残りは捨てる)。60Hz の画面の揺らぎで 0回 / 2回にならないよう、少し早めに進める
//   lerp: 描く間だけ、動く物を「1つ前の計算」と「今の計算」の間に置く(補間。画面が 144Hz でもなめらか。見た目は最大 1/60 秒遅れる)
const FIXED_STEP = { on: false, dt: 1 / 60, acc: 0, max: 4, slack: 0.002, lerp: true };
function stepFixed(sec) {
  const F = FIXED_STEP;
  F.acc = Math.min(F.acc + sec, F.dt * F.max);
  if (COOP.on) { // 協力プレイ: 全員の入力がそろったフレームだけ進める(net.js)
    if (!COOP.manual) while (F.acc >= F.dt - F.slack && state === 'play' && !COOP.desync) { if (!coopStepOnce(F.dt)) { COOP.stalls++; break; } F.acc -= F.dt; }
    return;
  }
  while (F.acc >= F.dt - F.slack && state === 'play') {
    if (NET_SIM.on && !netHeadReady()) { NET_SIM.stalls++; break; } // 相手の入力がまだ届いていない: 届くまで進めない
    F.acc -= F.dt; interpSave();
    if (NET_SIM.on) { const r = netTake(); simScope(() => update(F.dt, r)); } else simScope(() => update(F.dt));
  }
}

// ---------- 通信の遅れを 1人用で試す(協力プレイ: claudedocs/coop.md #1・#3)----------
//   URL に ?lag=4&ping=120&jitter=20 を付ける(付けると 1/60 秒ずつ進める形になる。値はコンソールの NET_SIM でも変えられる)
//   lag: 自分の入力を何フレーム後に使うか(協力プレイの入力の遅れ。4 = 約 67ms)
//   ping: 相手との往復の時間(ms)・jitter: その揺れ(± ms)。相手の入力は「入力を取ってから ping / 2 ± jitter 後」に届くものとして、届くまで計算を止める
//   入力の記録(core.js の readInput)を計算 1回ぶんずつ取って列に入れ、lag 回あとに使う
const NET_SIM = { on: false, lag: 4, ping: 0, jitter: 0, q: [], run: null, pending: false, lastAt: 0, stalls: 0 };
{
  const qs = new URLSearchParams(location.search), num = (k, d) => (qs.has(k) ? Math.max(0, +qs.get(k) || 0) : d);
  if (qs.has('lag') || qs.has('ping')) {
    Object.assign(NET_SIM, { on: true, lag: Math.round(num('lag', 4)), ping: num('ping', 0), jitter: num('jitter', 0) });
    FIXED_STEP.on = true; SIM_VIEW.on = true; // 協力プレイと同じ計算の形で
    console.info('NET_SIM', NET_SIM.lag + 'フレーム', 'ping ' + NET_SIM.ping + 'ms', '± ' + NET_SIM.jitter + 'ms');
  }
}
const netBlank = () => Object.assign({}, NO_INPUT, { at: 0 });
function netReset() { // ランの始めと lag を変えたとき
  Object.assign(NET_SIM, { q: Array.from({ length: NET_SIM.lag }, netBlank), run: S, qLag: NET_SIM.lag, pending: false, lastAt: 0 });
  SIM_VIEW.w = GFX.VW; SIM_VIEW.h = GFX.VH; // 計算用の画面の大きさ: ランの始めの自分の窓(協力プレイでは全員の窓の一番大きいもの。#16)。小さいと敵が見えている所から出てくる
}
// 計算 1回ぶんの入力を取り、相手に届く時刻を決める(届く順は送った順)
function netSample() {
  const r = readInput(), N = NET_SIM, at = performance.now() + N.ping / 2 + (fxRandom() * 2 - 1) * N.jitter;
  r.at = N.lastAt = Math.max(N.lastAt, at);
  return r;
}
// 列の先頭(今の計算で使う入力)が相手に届いているか。止まっている間に新しく取らないよう、取るのは計算 1回につき 1度
function netHeadReady() {
  const N = NET_SIM;
  if (N.run !== S || N.qLag !== N.lag) netReset();
  if (!N.pending) { N.q.push(netSample()); N.pending = true; }
  return performance.now() >= N.q[0].at;
}
// 列の先頭(今の計算で使う入力)を取り出す
function netTake() { NET_SIM.pending = false; return NET_SIM.q.shift(); }

// ---------- 描画の補間 ----------
//   計算の前に位置を控え(_ix / _iy)、描く前に間の値へ置き換え、描いた後に戻す。計算はこの値を読まない
//   配列の外の座標(ボスの体の部品・鎖・光線の端など)は 1/60 秒刻みのまま
const INTERP_JUMP = 48; // 1回の計算でこれより動いた物(瞬間移動・出し直し)は補間しない
const interpLists = () => [enemies, projs, eprojs, hazards, zones, gems, drops, parts, floats, bfx, sfx, P.flamePuffs || []];
const interpMoved = [];
let interpReady = false; // 直前に計算を進めた(控えが今の計算の 1つ前)
function interpSave() {
  for (const p of players) { p._ix = p.x; p._iy = p.y; } // 全員
  for (const a of interpLists()) for (const o of a) { o._ix = o.x; o._iy = o.y; }
  interpReady = true;
}
function interpOne(o, k) {
  if (o._ix === undefined) return; // この計算で出てきた物
  const dx = o.x - o._ix, dy = o.y - o._iy;
  if (Math.abs(dx) + Math.abs(dy) > INTERP_JUMP) return;
  o._cx = o.x; o._cy = o.y; o.x = o._ix + dx * k; o.y = o._iy + dy * k;
  interpMoved.push(o);
}
function interpApply(k) {
  for (const p of players) interpOne(p, k);
  for (const a of interpLists()) for (const o of a) interpOne(o, k);
}
function interpRestore() {
  for (const o of interpMoved) { o.x = o._cx; o.y = o._cy; }
  interpMoved.length = 0;
}

function frame(ts) {
  const sec = (ts - lastT) / 1000, rdt = Math.min(1 / 30, sec);
  lastT = ts;
  if (state === 'play') { if (FIXED_STEP.on) stepFixed(sec); else simScope(() => update(rdt)); } // 計算の乱数の列で(core.js)
  else { FIXED_STEP.acc = 0; if (state === 'over' || state === 'victory') updFx(rdt * 0.3); }
  if (state !== 'play' || !FIXED_STEP.on) interpReady = false;
  const lerpK = FIXED_STEP.lerp && interpReady ? clamp(FIXED_STEP.acc / FIXED_STEP.dt, 0, 1) : 1;
  if (lerpK < 1) interpApply(lerpK); // カメラも補間した位置を追う
  try {
    if (state !== 'pause' && state !== 'levelup' && state !== 'chest') updCam(rdt);
    GFX.updateFx(rdt);
    render();
  } finally { if (lerpK < 1) interpRestore(); } // 描画で落ちても計算の位置は必ず戻す
  GFX.present();
  UI.hud(rdt);
  requestAnimationFrame(frame);
}

demoWorld();
UI.title();
// 初回操作でタイトル曲を再生(自動再生制限対策)
addEventListener('pointerdown', () => { if (state === 'title' && !AudioMan.musicName) AudioMan.playMusic('title'); });
addEventListener('keydown', () => { if (state === 'title' && !AudioMan.musicName) AudioMan.playMusic('title'); });
requestAnimationFrame(frame);
