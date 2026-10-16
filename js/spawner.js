// spawner.js — スポナー(通常の出現)/ 闘技場(ボスラッシュ)の流れ
'use strict';

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
// 熾天使がラストラディアンスを始めてから倒れるまで(立ち尽くす間も)
const serLROn = () => (S.bosses || []).some(b => !b.dead && b.boss === 'seraph' && b.ai && b.ai.lr);
function updSpawner(dt) {
  if (S.mode === 'arena') return updArena(dt);
  if (S.mode === 'tower' && !updTower(dt)) return; // タワー: 休憩中は出さない(出方は階ごとに S.spawnCfg。tower.js)
  if (serLROn()) return; // ラストラディアンス: 敵(雑魚・エリート・ゴブリン)も篝火も出ない。フェーズの時計も止まっているので、倒れてから続きが出る
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
  const rate = (1 + (S.loop - 1) * 0.3) * (P.uq.clock ? 1.15 : 1) * (inPhase() ? 0.6 : 1) * CHAOS.spawn; // 狂時の: 出現数 +15% / フェーズ中は減らす / カオス: 出現率
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
      if (pool.length) spawnEnemy(pick(pool), { elite: true, noChest: inPhase() }); // ボス戦中に出たエリートは宝箱を落とさない
      UI.banner(_t('ELITE 出現!!'), inPhase() ? _t('ボス戦中のエリート') : S.mode === 'tower' ? _t('倒すと大金を落とす') : _t('倒すと宝箱を落とす'), 1600); AudioMan.warning();
    }
  }
  S.goblinT -= tdt;
  if (S.goblinT <= 0) {
    S.goblinT = 140;
    const a = rand(0, TAU);
    spawnEnemy('goblin', { x: P.x + Math.cos(a) * 110, y: P.y + Math.sin(a) * 110 });
    UI.announce(_t('トレジャーゴブリン!'), _t('逃がすな!'));
  }
  S.propT -= tdt;
  if (S.propT <= 0) { S.propT = 6; if (enemies.filter(e => e.prop && !e.dead).length < 5) spawnProp(); }
}

// ============================================================
// 闘技場(ボスラッシュ): 休憩 → ボス入場 → 撃破報酬 → 休憩 …
// ============================================================
function updArena(dt) {
  const A = S.arena, cfg = DATA.arena;
  if (S.boss || S.won || A.idx >= cfg.rounds || players.some(p => p.pendingLv > 0)) return; // レベルアップ処理中は休憩時間を止める(誰か 1人でも)
  A.restT -= dt;
  if (!A.warned && A.restT <= 2.5) { A.warned = true; UI.announce('ROUND ' + (A.idx + 1) + ' / ' + cfg.rounds, _t('次の挑戦者が入場する…')); AudioMan.warning(); }
  if (A.restT > 0) return;
  S.elv = arenaLv(A.idx); UI.enemyLvUp();
  const ord = A.order[A.idx], e = spawnBoss(Array.isArray(ord) ? pick(ord) : ord, A.idx === cfg.rounds - 1); // 配列のラウンドはステージのボス2体のどちらか
  // 闘技場の中、プレイヤーと中心を挟んだ反対側から入場
  const a = Math.hypot(P.x, P.y) > 30 ? Math.atan2(-P.y, -P.x) : rand(0, TAU), R = cfg.r * 0.6;
  e.x = Math.cos(a) * R; e.y = Math.sin(a) * R;
  shockAt(e.x, e.y, 1.5, 0.6); burst(e.x, e.y, 40, [e.col, '#ffffff'], { sp: 120, glow: true });
  if (CHAOS.escort) arenaEscort(e, CHAOS.escort, a, R);
}
// 闘技場の顔ぶれ(ラン開始時に1回): tier 1〜3 は、その tier のステージから2つ(ランダム。順番はステージの並び順)をラウンドに。各ラウンドはそのステージのボス2体のどちらか
//   ラウンド 7・8 は tier 4 のステージの1体目どうし・2体目どうしから(番人かケルベロス → 死神か影の王)。ステージが2つずつなら今までと同じ
function arenaOrder() {
  const out = [];
  for (const t of [1, 2, 3]) {
    const rs = DATA.stageRuns.filter(r => r.tier === t);
    for (const r of shuffle(rs.slice()).slice(0, 2).sort((a, b) => rs.indexOf(a) - rs.indexOf(b))) out.push(r.bosses.slice());
  }
  const t4 = DATA.stageRuns.filter(r => r.tier === 4);
  out.push(t4.map(r => r.bosses[0]), t4.map(r => r.bosses[1]));
  return out;
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
  if (A.idx >= cfg.rounds) { S.won = true; S.victoryT = 3.2; AudioMan.stopMusic(1.5); UI.announce('ARENA CLEAR!!', _t('全ボス撃破')); return; }
  recalc(); // 報酬の倍率はラウンドの tier(2ラウンドごとに上がる)
  A.restT = cfg.rest; A.warned = false;
  UI.announce('ROUND ' + A.idx + ' CLEAR!', _t('報酬を拾って次に備えよ'));
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
  UI.banner('HORDE INCOMING!!', _t('大群が迫ってくる…'), 2000);
  AudioMan.warning(); shake(5);
  const cfg = S.spawnCfg || { types: ['zombie'] }, R = Math.hypot(GFX.VW, GFX.VH) / 2 + 20, n = 48, once = new Set(); // once: solo の敵(メイジ)は大群にも 1体まで
  for (let i = 0; i < n; i++) { const a = TAU / n * i, t = pickType(cfg.types, false, once); if (t) { if (DATA.enemies[t].solo) once.add(t); spawnEnemy(t, { x: P.x + Math.cos(a) * R, y: P.y + Math.sin(a) * R }); } }
}
