// phase.js — ボスの撃破(報酬・次のステージ)/ フェーズ(エリート群・ボス)/ 宝箱の光の柱
'use strict';

function onBossDeath(e) {
  clsOnBossKill(e); // クラスの「ボスを倒した」(ネクロマンサー: 死霊を上限まで)
  for (const o of enemies) if (o.owner === e && !o.dead) { o.dead = true; if (o.obj) objDown(o, false); else burst(o.x, o.y, 16, ECOL[o.type] || ['#ffffff'], { sp: 70 }); } // ボスが出した物・中スライムは一緒に崩れる
  e.takeK = 1; e.flying = false; e.hidden = false;
  // 2体のボス(カオス: 双王): 両方倒すまで次へ進まない
  const rest = (S.bosses || []).filter(b => b !== e && !b.dead);
  if (rest.length) {
    S.bosses = rest; S.boss = rest[0]; UI.bossBar(rest[0]); for (const p of players) { p.bossKills++; p.cxpB += rewMul(); } S.twinFinal = S.twinFinal || e.final;
    burst(e.x, e.y, 90, [e.col, '#ffd23f', '#ffffff'], { sp: 180, glow: true, life: 1.2 }); addFlash(e.x, e.y, 200, '#ffd23f', 0.8); shake(10); AudioMan.boom();
    UI.announce(_t('1体 撃破!'), _t('もう1体を倒せ')); // 宝箱はフェーズのクリア(2体目)で
    return;
  }
  if (S.twinFinal) { e.final = true; S.twinFinal = false; }
  S.bosses = [];
  S.boss = null;
  S.phase = null; // ボスのフェーズのクリア(闇の霧も晴れる)
  UI.bossBar(null);
  hitstop(0.18, true); slowmo(0.2, 2, true); screenFlash(0.9); shake(16);
  shockAt(e.x, e.y, 3, 0.55);
  simTimeout(() => shockAt(e.x, e.y, 2, 0.8), 250);
  burst(e.x, e.y, 180, [e.col, '#ffd23f', '#ffffff', '#ff8c42'], { sp: 220, glow: true, life: 1.6, g: 40 });
  addRing(e.x, e.y, 140, '#ffd23f', { w: 3, life: 0.8 }); addRing(e.x, e.y, 90, '#ffffff', { w: 2, life: 0.6 });
  addFlash(e.x, e.y, 260, '#ffd23f', 1.2);
  AudioMan.boom(); AudioMan.chest();
  eprojs = []; warns = []; hazards = []; bfx = []; P.push = null; P.current = null; P.rootT = 0; S.tstop = 0; S.madClock = null; S.rewind = 0;
  P.chain = null; S.cine = null; S.shadows = []; // 影の王: 鎖・影
  for (const p of players) { p.bossKills++; p.cxpB += rewMul(); } // ボスの撃破は全員に入る。クラス経験値は倒したときの報酬の倍率で数える
  if (S.mode === 'arena') return arenaBossDown(e);
  if (S.mode === 'tower') towerClear(); // タワー: 階のクリア(貯蓄経験値が入る)。ボスの報酬はこの後に落ち、休憩中に拾う
  if (CHAOS.bossLv) { S.elv += CHAOS.bossLv; UI.enemyLvUp(); } // カオス: ボスを倒すたびに敵Lv アップ
  const rk = S.tier; // 撃破報酬: tier で数える(通常モード・エスカレーション・タワー)
  for (let i = 0; i < 14; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), 20 * rk);
  for (let i = 0; i < 25; i++) dropItem('coin', e.x, e.y, 3 * rk);
  dropItem('meat', e.x + 14, e.y); dropItem('magnet', e.x - 14, e.y);
  dropItem('chest', e.x, e.y - 14); chestBeacon(e.x, e.y - 14); // 装備宝箱(フェーズのクリア。タワーは代わりのゴールド)
  if (S.mode === 'tower') return; // 最後のボス(死神・影の王・熾天使)でも勝ちにしない
  if (e.final) {
    if (S.mode === 'stage' || (S.loop === 1 && !S.won)) { S.won = true; S.victoryT = 2.4; AudioMan.stopMusic(1.5); return; }
    S.loop++; escStage(1); UI.announce('LOOP ' + S.loop, _t('敵はさらに強くなる…')); return; // エスカレーションの周回: tier 1 から
  }
  if (S.mode === 'stage' || S.tier >= 4) { UI.announce(_t('BOSS 1/2 撃破!'), _t('次のボスに備えよ')); AudioMan.playMusic(DATA.stages[S.stage - 1].music); return; } // ステージ単体・エスカレーションの tier 4(ボス → ラスボス): ステージはそのまま
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
  UI.banner(_t('ELITE 襲来!!'), _t`エリート ${n}体を倒せ`, 2200);
  AudioMan.eliteHorn(); shake(7); screenFlash(0.35, '#ff3b5c'); shockAt(P.x, P.y, 1.6, 0.7);
  slowmo(0.35, 0.6, true);
}
function endElitePhase() {
  const ph = S.phase, x = ph.lastX, y = ph.lastY;
  S.phase = null;
  if (CHAOS.bossLv) { S.elv += CHAOS.bossLv; UI.enemyLvUp(); } // カオス「復讐の連鎖」: エリート群を倒しても敵Lv アップ(ボスと同じ)
  dropItem('chest', x, y - 10); chestBeacon(x, y - 10);
  hitstop(0.12, true); slowmo(0.3, 1.2, true); shake(10); screenFlash(0.5, '#ffd23f'); shockAt(x, y, 2.2, 0.6);
  addRing(x, y, 120, '#ffd23f', { w: 3, life: 0.8 }); addRing(x, y, 70, '#ffffff', { w: 2, life: 0.6 });
  UI.banner('PHASE CLEAR', _t('エリート群を撃破!'), 2200, 'gold');
  AudioMan.phaseClear();
}
// ボス・エリート群のフェーズの中か(タワーの階の霧の時計 kind 'wave' は除く: 出現率 ×0.6・エリートが宝箱を落とさない・HUD の「ボス戦」を付けない)
const inPhase = () => !!S.phase && S.phase.kind !== 'wave';
// 毎フレーム: フェーズの外ではフェーズの時計を進め、フェーズの中では経過を数えて闇の霧
function updPhase(dt) {
  const ph = S.phase;
  if (!ph) { S.ptime += dt; return; }
  if (!ph.hold && !(ph.fogPause > 0)) ph.t += dt; // 影の王: 4回目の影を倒すまで止まる / 冥鎖の杭を壊した: 霧が晴れている間も止まる
  if (ph.fogPause > 0) ph.fogPause -= dt;
  if (ph.kind === 'elite' && ph.elites.every(e => e.dead)) return endElitePhase();
  const F = DATA.flow.fog;
  if (ph.t >= F.start - 10 && !ph.fogWarn) { ph.fogWarn = true; UI.announce(_t('闇の霧が迫る…'), _t('あと 10秒で HP が削られはじめる')); AudioMan.heartbeat(0.7); }
  const fk = fogDarkK();
  if (fk > 0) fogWisps(dt, fk);
  if (ph.t < F.start || ph.fogPause > 0) return;
  if (!ph.fogOn) { ph.fogOn = true; ph.fogTick = 1; UI.banner(_t('闇の霧'), _t('早く倒さないと HP が削られ続ける'), 2200, 'fog'); AudioMan.fogRise(); shake(5); }
  ph.fogDmg = F.dmg * (1 + Math.floor((ph.t - F.start) / F.step)); // 1秒ごとのダメージ(10秒ごとに +1)
  if ((ph.fogTick -= dt) > 0) return;
  ph.fogTick += 1;
  fogHurt(ph.fogDmg);
}
// 闇の霧の暗さ(0〜1): 霧の 10秒前(予告)から暗くなり始め、霧が出て 5秒で最も暗い
function fogDarkK() {
  if (!S || !S.phase || S.phase.fogPause > 0) return 0;
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
