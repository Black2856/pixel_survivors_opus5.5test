// bosses/reaper.js — ボス: 死神・第一形態: プレイヤーへまっすぐ。瞬間移動 / 死の宣告 / 鎌投げ / 刈り取り / スロウタイム / 砂時計 / 激昂: 時計兵召喚
'use strict';

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
    fxRays(e.x, e.y, 70, '#5a3a8a', { foe: true, n: 14, life: 0.4, core: '#c29bff' });
    hint('clock', _t('スロウタイム'), _t('範囲内は移動速度とクールダウンが低下'));
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
    bossBlast(m.x, m.y, R0, Object.assign({ n: 16 }, BFX.reaper)); // 紫の光芒と、紫に光って冷える地割れ
  });
  AudioMan.knell();
  hint('deathmark', _t('死の宣告'), _t('印は 4秒 足元を追い、最後に止まって炸裂する'));
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
// 砂時計: プレイヤーから 110 に砂時計が落ちてくる(HP 12%・12秒)。立っている間 死神の技の間隔 ×0.75。壊すと死神が 1.5秒ひるむ
function sandglassDrop(e, ai) {
  const ga = rand(0, TAU), x = P.x + Math.cos(ga) * 110, y = P.y + Math.sin(ga) * 110;
  pushWarn({ kind: 'circle', x, y, r: 12, t: 0, life: 0.6, fixed: true });
  later(ai, 0.6, () => {
    const o = spawnObj(e, 'sandglass', x, y, { pct: 0.12, r: 9, life: 12 }); o.dropT = 0.35;
    hint('sandglass', _t('砂時計'), _t('立っている間 死神の技が速くなる。壊すと死神がひるむ'));
  });
  AudioMan.charge(0.6);
}

// ---------- 死神の変身: 第一形態を倒すと 2秒 時が止まり(画面が色あせる)、同じ場所で終刻の死神になる ----------
function startReaperMorph(e) {
  e.morphed = true; e.hp = 1; e.invuln = true; e.hideA = 1;
  for (const o of enemies) if (o.owner === e && !o.dead) { o.dead = true; if (o.obj) objDown(o, false); }
  eprojs = []; warns = []; hazards = []; bfx = []; P.push = null; P.rootT = 0; e.ai.q = []; e.ai.wind = 0; S.tstop = 0; S.madClock = null; S.rewind = 0;
  S.morph = { e, t: 2 };
  hitstop(0.1, true); shake(10); screenFlash(0.5, '#ffffff'); AudioMan.knell(); AudioMan.hum(2);
  UI.announce(_t('時が止まる…'), '');
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
  shockAt(f.x, f.y, 3, 0.6); shake(16); hitstop(0.12, true); screenFlash(0.6, '#ff3b5c'); AudioMan.roar(); AudioMan.boom();
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
  ai.scy -= dt * R; ai.rev -= dt * R; ai.stop -= dt * R; ai.marks -= dt * R; ai.sec -= dt * R; if (ai.enraged) { ai.cross -= dt * R; ai.echo -= dt * R; }
  if (ai.busy > 0) { if ((ai.busy -= dt) <= 0) ai.gap = ai.enraged ? 0.7 : 1; return; } // 技の途中
  if (ai.gap > 0) { ai.gap -= dt; return; } // 技のあとの間
  const doom = enemies.some(o => o.owner === e && o.obj === 'doom' && !o.dead);
  if (ai.enraged && ai.cross <= 0 && !doom) { ai.cross = 15; deadCross(e, ai); }
  else if (ai.stop <= 0 && !doom) { ai.stop = ai.enraged ? 12 : 16; timeStop(e, ai); } // 逆戻し(終刻の時計を壊せなかった)の間も使う
  else if (ai.marks <= 0) { ai.marks = ai.enraged ? 12 : 15; const x = e.x, y = e.y, tg = twelveMarks(e, ai); chronoEcho(e, ai, x, y, (g, ga) => twelveMarks(g, ga, tg)); }
  else if (ai.rev <= 0) { ai.rev = ai.enraged ? 10 : 14; slowReverse(e, ai); }
  else if (ai.sec <= 0) { ai.sec = ai.enraged ? 5 : 7; secondHand(e, ai); chronoEcho(e, ai, e.x, e.y, (g, ga) => secondHand(g, ga)); }
  else if (ai.scy <= 0 && dist < 90) { ai.scy = ai.enraged ? 2.5 : 3.5; hourScythe(e, ai, a); chronoEcho(e, ai, e.x, e.y, (g, ga) => hourScythe(g, ga, a)); }
}
// クロノ・エコー(激昂・間隔 20): 刻の大鎌・十二の刻印・秒針の弾幕が終わってから 3秒後に、同じ位置で灰色の死神が同じ技をもう一度(向き・狙った位置も同じ)
//   技の終わり = 技の長さ(ai.busy: 刻の大鎌 1.2秒・十二の刻印 2.9秒・秒針の弾幕 3.6秒(激昂))
//   灰色の死神は 0.4秒で現れてから技を始め、終わると 0.4秒で消える。攻撃は当たらない(ただの姿)。技の当たり判定は本物と同じ
function chronoEcho(e, ai, x, y, fn) {
  if (!ai.enraged || ai.echo > 0) return;
  ai.echo = 20;
  const face = e.face, dur = ai.busy || 0; // 呼ぶのは技を始めた直後なので、ai.busy = 技の長さ
  later(ai, dur + 2.6, () => {
    const g = { echo: true, x, y, face, dmg: e.dmg, sq: 1, jz: 0, t: 0, ai: { q: [], wind: 0, enraged: true, echo: true } };
    (ai.echoes = ai.echoes || []).push(g);
    burst(x, y, 24, ['#9a9aaa', '#d8d8e0', '#5a5a6a'], { sp: 70, glow: true, life: 0.5 }); AudioMan.hum(0.6); AudioMan.tick(6);
    hint('echo', _t('クロノ・エコー'), _t('3秒前の技を、灰色の死神が同じ場所でもう一度くり返す'));
    later(g.ai, 0.4, () => { g.started = true; fn(g, g.ai); });
  });
}
function updEchoes(ai, dt) {
  for (let i = ai.echoes.length - 1; i >= 0; i--) {
    const g = ai.echoes[i], ga = g.ai;
    g.t += dt; g.sq = lerp(g.sq, 1, Math.min(1, dt * 6));
    runLater(ga, dt);
    if (ga.wind > 0) { ga.wind -= dt; if (ga.wind <= 0) ga.fire(); } // 構え(windup)
    if (g.started && !ga.q.length && !(ga.wind > 0)) { g.out = (g.out || 0) + dt; if (g.out >= 0.4) ai.echoes.splice(i, 1); } // 技が終わったら消える
  }
}
// 狂い時計: 弾を飛ばす技のあと 50%(激昂 70%)で続く。0.4秒(針が狂ったように回る・画面の縁が紫に揺れる)→ 6秒、画面にある敵の弾すべての進みを不規則に
function maybeMadClock(e, ai) {
  if (ai.echo === true || Math.random() >= (ai.enraged ? 0.7 : 0.5)) return; // クロノ・エコーの分身からは続かない
  ai.busy = Math.max(ai.busy, 0.5);
  bfx.push({ kind: 'madwarn', x: 0, y: 0, t: 0, life: 0.4 });
  for (let i = 0; i < 8; i++) later(ai, i * 0.05, () => AudioMan.tick(8 + i));
  later(ai, 0.4, () => {
    S.madClock = { mode: pick(['surge', 'rewind', 'swing']), t: 0, dur: 6 };
    AudioMan.zap(); screenFlash(0.15, '#c29bff');
    hint('madclock', _t('狂い時計'), _t('弾の進みが狂う(青 = 止まる・赤 = 速い・紫 = 巻き戻る)'));
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
  hint('reverse', _t('スロウタイム・リバース'), _t('3秒たつと逆に、時計盤の外が遅くなる'));
}
// 時間停止: 1秒(時計の音・画面が白く光る)→ 1.5秒 敵の弾が止まり、その間にプレイヤーの周り(半径 90)に鎌 12本が並ぶ。時が動き出すと中心へ飛ぶ(×0.7、射程 約 975)
function timeStop(e, ai) {
  ai.busy = 3.2;
  for (let i = 0; i < 4; i++) later(ai, i * 0.25, () => AudioMan.tick(i * 3));
  AudioMan.charge(1);
  later(ai, 1, () => {
    S.tstop = 1.5; screenFlash(0.5, '#ffffff'); AudioMan.knell(); shake(4);
    const cx = P.x, cy = P.y, a0 = rand(0, TAU);
    for (let i = 0; i < 12; i++) later(ai, i * 0.08, () => { // 止まった時の中で、鎌が 1本ずつ並ぶ
      const sa = a0 + TAU / 12 * i, x = cx + Math.cos(sa) * 90, y = cy + Math.sin(sa) * 90;
      Object.assign(eball(x, y, sa + Math.PI, 150, e.dmg * 0.7, 'rscythe'), { life: 6.5 }); // 射程 約 975(前の 5倍)
      burst(x, y, 6, ['#ff3b5c', '#ffffff'], { sp: 30, glow: true, life: 0.3 }); AudioMan.tick(10);
      fxGlint(x, y, 7, '#ff3b5c', { foe: true, life: 0.3 }); // 鎌が並ぶたびに赤いきらめき
    });
    hint('timestop', _t('時間停止'), _t('時が動き出すと、並んだ鎌が中心へ飛ぶ'));
  });
  later(ai, 2.5, () => maybeMadClock(e, ai));
}
// 十二の刻印: 死神が消える → プレイヤーのいた位置に 円 半径 50(1秒)→ 死神がそこに現れて斬る(×1.2)
//   → 赤い円が消えた瞬間(現れて斬るのと同時)から、0.5秒 死神から時計の 12方向へ帯(長さ 150・幅 16)→ 12時の方向(上)から時計回りに 0.1秒おきに炸裂(×0.8)
//   at: 現れる位置(クロノ・エコーは本物と同じ位置)。返り値は現れた位置
function twelveMarks(e, ai, at) {
  ai.busy = 2.9;
  const x0 = at ? at.x : P.x, y0 = at ? at.y : P.y;
  if (!e.echo) bfx.push({ kind: 'afterimg', spr: 'fhour', x: e.x, y: e.y - (e.jz || 0), flip: (e.face || 1) < 0, t: 0, life: 0.4 }); // 溶けるように消える残像
  e.flying = e.hidden = e.air = true; // 消える(攻撃が当たらない・触れても当たらない)
  burst(e.x, e.y, 40, ['#ff3b5c', '#1a0a14', '#c8a050'], { sp: 120, glow: true, life: 0.5 }); addFlash(e.x, e.y, 80, '#ff3b5c', 0.5); AudioMan.dash(); AudioMan.knell();
  pushWarn({ kind: 'circle', x: x0, y: y0, r: 50, t: 0, life: 1 });
  AudioMan.charge(1);
  hint('marks', _t('十二の刻印'), _t('死神が円に現れて斬る。そのあと 12方向の帯が 12時から順に炸裂する'));
  later(ai, 0.7, () => { for (let i = 0; i < 28; i++) { const pa = TAU / 28 * i, r = rand(40, 55); part(x0 + Math.cos(pa) * r, y0 + Math.sin(pa) * r, -Math.cos(pa) * r / 0.3, -Math.sin(pa) * r / 0.3, 0.3, pick(['#ff3b5c', '#1a0a14', '#c8a050']), { glow: true, drag: 0 }); } }); // 現れる前: 赤黒い霧が円へ集まる
  later(ai, 1, () => { // 現れて、大鎌を一回転させて斬る
    e.x = x0; e.y = y0; e.flying = e.hidden = e.air = false; e.sq = 0.6; e.flash = 0.12;
    const R0 = 50 * CHAOS.area;
    hitCircle(x0, y0, 50, e.dmg * 1.2);
    bfx.push({ kind: 'spincut', x: x0, y: y0, a0: rand(0, TAU), dir: Math.random() < 0.5 ? 1 : -1, r: R0 + 8, t: 0, life: 0.45 });
    burst(x0, y0, 30, ['#ff3b5c', '#ffffff', '#8e0016'], { sp: 150, glow: true, life: 0.4 }); shockAt(x0, y0, 1.4, 0.8); shake(7); hitstop(0.04, true); AudioMan.slash(); AudioMan.cutHit(); AudioMan.boom();
    bossBlast(x0, y0, R0, Object.assign({ n: 16 }, BFX.fhour)); // 斬った所の地面が割れる
    later(ai, 0, () => { // 赤い円が消えた瞬間から 12方向の帯
      for (let i = 0; i < 12; i++) {
        const ma = -Math.PI / 2 + TAU / 12 * i;
        pushWarn({ kind: 'line', x: x0, y: y0, a: ma, len: 150, w: 16, t: 0, life: 0.5 + 0.1 * i });
        later(ai, 0.5 + 0.1 * i, () => {
          hitLine(x0, y0, ma, 150, 16, e.dmg * 0.8);
          bfx.push({ kind: 'pillar', x: x0, y: y0, a: ma, len: 150 * CHAOS.area, w: 16 * CHAOS.area, t: 0, life: 0.35 });
          AudioMan.tick(i); if (i % 3 === 0) { AudioMan.boom(); shake(3); }
        });
      }
      AudioMan.charge(0.5);
    });
  });
  return { x: x0, y: y0 };
}
// 秒針の弾幕: 2秒(周りに時計の目盛り 12個が光る)→ 12方向に弾を 0.2秒おきに 5回(激昂 8回)。1回ごとに 6°ずつ時計回りにずらす(速さ 65、×0.8)
function secondHand(e, ai) {
  const n = ai.enraged ? 8 : 5, a0 = -Math.PI / 2, W = 2;
  ai.busy = W + n * 0.2; ai.secGlow = W;
  AudioMan.charge(W);
  later(ai, W, () => { ai.secGlow = 0; });
  for (let k = 0; k < n; k++) later(ai, W + k * 0.2, () => {
    for (let i = 0; i < 12; i++) eball(e.x, e.y - 4, a0 + TAU / 12 * i + k * 0.1047, 65, e.dmg * 0.8, 'tick');
    AudioMan.tick(k);
  });
  later(ai, W + n * 0.2, () => maybeMadClock(e, ai));
}
// 終刻(残りHP 50% を下回ったときに 1回): プレイヤーから 120、死神と反対側に時計(HP 24%)。12秒以内に壊すと死神が 3秒ひるむ。壊せないと逆戻し(1.5秒)で HP 30% 回復
function startFinale(e, ai) {
  const d = Math.sqrt(d2(e.x, e.y, P.x, P.y)) || 1, x = P.x + (P.x - e.x) / d * 120, y = P.y + (P.y - e.y) / d * 120;
  const o = spawnObj(e, 'doom', x, y, { pct: 0.24, r: 16, life: 12 }); o.scale = 2; // 大きな柱時計
  burst(x, y, 40, ['#ff3b5c', '#c8a050', '#ffffff'], { sp: 120, glow: true, life: 0.6 }); shockAt(x, y, 1.6, 0.8); shake(8); AudioMan.knell(); AudioMan.warning();
  UI.announce(_t('終刻'), _t('12秒以内に時計を壊せ'));
  return o;
}
// 終刻の時計を壊せなかった: 全ての時が止まり逆戻しの演出(1.5秒)、その間に死神の HP が 30% 回復する
function finaleRewind(e) {
  if (e.dead) return;
  S.rewind = 1.5; e.ai.healT = 1.5;
  screenFlash(0.6, '#c29bff'); shake(10); AudioMan.knell(); AudioMan.hum(1.5);
  UI.announce(_t('時が巻き戻る…'), _t('死神の HP が回復する'));
}
// デッドクロス(激昂): 1秒、プレイヤーの位置を中心に X字の帯 2本(長さ 280・幅 20)が速く回りながら減速して止まる → 止まった瞬間に斬る。当たると HP が 1 になる
function deadCross(e, ai) {
  ai.busy = 1.3;
  const cx = P.x, cy = P.y, a0 = rand(0, TAU), ang = (i, t) => a0 + i * Math.PI / 2 + 3 * Math.PI * (1 - Math.pow(1 - Math.min(1, t / 1), 3)); // 1秒で 1.5回転してイージングで止まる
  for (let i = 0; i < 2; i++) pushWarn({ kind: 'line', x: cx, y: cy, a: ang(i, 0), len: 280, w: 20, t: 0, life: 1.0, cross: true, track: q => { q.a = ang(i, q.t); q.x = cx - Math.cos(q.a) * q.len / 2; q.y = cy - Math.sin(q.a) * q.len / 2; } });
  AudioMan.charge(1); AudioMan.warning();
  hint('deadcross', _t('デッドクロス'), _t('当たると HP が 1 になる。回避かガードで防げ'));
  later(ai, 1.0 - CUT_HIT, () => { // 村正の一閃と同じ作りの、赤黒い X の斬撃(帯が止まった瞬間の炸裂の時刻に当たり判定)
    const L = 140 * CHAOS.area, fa = [ang(0, 2), ang(1, 2)];
    let done = false;
    for (const sa of fa) {
      const s = makeCut(cx - Math.cos(sa) * L, cy - Math.sin(sa) * L, cx + Math.cos(sa) * L, cy + Math.sin(sa) * L, { pal: CUT_PAL_XCROSS, wk: 1.8, nodim: true, late: true });
      s.enemy = true;
      s.ev.push({ at: CUT_RUN, fn: () => { hitstop(0.05, true); shake(6); cutSpark(s, 18, ['#ff3b5c', '#8e0016', '#ffffff']); fxDecal(cx, cy, L, 'scar', { foe: true, hx: Math.cos(sa) * L, hy: Math.sin(sa) * L, col: '#0a0002', hot: '#ff3b5c', heatT: 1.2, life: 3.5 }); } }); // X の斬撃の跡が地面に残る
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
  GFX.fx.hurt = 1; GFX.fx.aberr = Math.max(GFX.fx.aberr, 1.5); hitstop(0.15, true);
  burst(P.x, P.y, 40, ['#ff3b5c', '#8e0016', '#0a0002', '#ffffff'], { sp: 160, life: 0.6 }); AudioMan.hurt();
}

// ---------- 描画(render.js の render / drawBossFx / drawBossGround から呼ぶ)----------
function drawReaperFx(e, sx, gx, ex, ey, yo) {
  const k = 1 - S.morph.t / 2, R = Math.round(30 + 40 * k);
  sx.globalAlpha = 0.5 * k; pCircle(sx, ex, ey, R, '#c29bff'); pCircle(sx, ex, ey, R - 3, '#ff3b5c'); sx.globalAlpha = 1;
  for (let i = 0; i < 12; i++) { const a = TAU / 12 * i; sx.fillStyle = gx.fillStyle = '#ffd0d8'; sx.fillRect(Math.round(ex + Math.cos(a) * (R - 6)), Math.round(ey + Math.sin(a) * (R - 6)), 2, 2); gx.fillRect(Math.round(ex + Math.cos(a) * (R - 6)), Math.round(ey + Math.sin(a) * (R - 6)), 1, 1); }
  const ha = -Math.PI / 2 + (1 - k) * 8; pLine(sx, ex, ey, ex + Math.cos(ha) * R * 0.8, ey + Math.sin(ha) * R * 0.8, '#ffffff', 2); pLine(gx, ex, ey, ex + Math.cos(ha) * R * 0.8, ey + Math.sin(ha) * R * 0.8, '#5a1020', 1);
  for (let i = 0; i < Math.floor(k * 10); i++) { const a = hash2(i, 61) * TAU, l = 6 + hash2(i, 67) * 10; pLine(gx, ex, ey + yo - 6, ex + Math.cos(a) * l, ey + yo - 6 + Math.sin(a) * l, '#ff3b5c', 1); } // 赤いひび
  addLight(e.x, e.y, 60 + 120 * k, '#ff3b5c', 0.4 + 0.6 * k);
}
// 十二の刻印で消えている間は描かない
function drawFhourFx(e, ai, sx, gx, ex, ey, sp, yo, t) {
  const R = 22, frozen = S.tstop > 0, rv = S.rewind > 0 ? -4 : 1;
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + TAU / 12 * i, glow = ai.secGlow > 0 && Math.floor(t * 12 + i) % 2 === 0, rr = ai.secGlow > 0 ? R + 10 : R;
    sx.fillStyle = glow ? '#ffffff' : '#c8a050'; sx.fillRect(Math.round(ex + Math.cos(a) * rr), Math.round(ey + yo - 4 + Math.sin(a) * rr), i % 3 ? 1 : 2, i % 3 ? 1 : 2);
    if (glow) { gx.fillStyle = '#ff3b5c'; gx.fillRect(Math.round(ex + Math.cos(a) * rr), Math.round(ey + yo - 4 + Math.sin(a) * rr), 2, 2); }
  }
  const ha = frozen ? -Math.PI / 2 : t * 2 * rv - Math.PI / 2, ma = frozen ? Math.PI / 6 : t * 0.3 * rv;
  sx.globalAlpha = 0.7; pLine(sx, ex, ey + yo - 4, ex + Math.cos(ha) * (R - 3), ey + yo - 4 + Math.sin(ha) * (R - 3), '#ff3b5c'); pLine(sx, ex, ey + yo - 4, ex + Math.cos(ma) * (R - 8), ey + yo - 4 + Math.sin(ma) * (R - 8), '#c8a050', 2); sx.globalAlpha = 1;
  if (ai.secGlow > 0) addLight(e.x, e.y, 100, '#ff3b5c', 0.7);
  drawSp(sp, e.x, e.y + yo, { flip: (e.face || 1) < 0, sy: e.sq || 1, sxk: 2 - (e.sq || 1), white: e.flash > 0 }); // 光輪の上に体を描き直す
}
function drawFhourFx2(e, ai, sx, sp, t) {
  for (const g of ai.echoes) {
    if (g.hidden) continue;
    const a = Math.min(1, g.t / 0.4) * (g.out ? Math.max(0, 1 - g.out / 0.4) : 1), gx0 = g.x - cam.x, gy0 = g.y - cam.y;
    sx.globalAlpha = 0.75 * a; sx.drawImage(grayOf((g.face || 1) < 0 ? ART.variant(sp, 'flip') : sp.c), Math.round(gx0 - sp.w / 2), Math.round(gy0 - sp.h / 2));
    if (g.ai.secGlow > 0) for (let i = 0; i < 12; i++) { const ta = -Math.PI / 2 + TAU / 12 * i; if (Math.floor(t * 12 + i) % 2) continue; sx.fillStyle = '#e8e8f0'; sx.fillRect(Math.round(gx0 + Math.cos(ta) * 32), Math.round(gy0 - 4 + Math.sin(ta) * 32), 2, 2); }
    sx.globalAlpha = 1;
    addLight(g.x, g.y, 46, '#9a9aaa', 0.5 * a);
  }
}
// 死の宣告: 足元を追う紫の印(回る時計の目盛りと髑髏)。止まると赤く
BFX_DRAW.deathmark = (f, fx, fy, u, bd) => {
  const { sx, gx, t } = bd;
  const R = 44 * CHAOS.area, stopd = f.t >= 3.5, col = stopd ? '#ff3b5c' : '#c29bff', fade = Math.min(1, f.t * 3, (f.life - f.t) * 4);
  sx.globalAlpha = 0.18 * fade; pDisc(sx, fx, fy, Math.round(R), stopd ? '#ff3b5c' : '#6a3aa0'); sx.globalAlpha = fade;
  pCircle(sx, fx, fy, Math.round(R), col); pCircle(gx, fx, fy, Math.round(R), stopd ? '#5a1020' : '#2a1a4a');
  for (let i = 0; i < 12; i++) { const a = -t * (stopd ? 0 : 1.2) + TAU / 12 * i, r0 = R - 4, r1 = R - (i % 3 ? 7 : 11); pLine(sx, fx + Math.cos(a) * r0, fy + Math.sin(a) * r0, fx + Math.cos(a) * r1, fy + Math.sin(a) * r1, col); } // 目盛り
  const hx = Math.round(fx), hy = Math.round(fy) - 2; // 髑髏
  sx.fillStyle = col; sx.fillRect(hx - 3, hy - 3, 7, 5); sx.fillRect(hx - 2, hy + 2, 5, 2); sx.fillStyle = '#0c0913'; sx.fillRect(hx - 2, hy - 1, 2, 2); sx.fillRect(hx + 1, hy - 1, 2, 2); sx.fillRect(hx - 1, hy + 2, 1, 1); sx.fillRect(hx + 1, hy + 2, 1, 1);
  gx.fillStyle = stopd ? '#5a1020' : '#2a1a4a'; gx.fillRect(hx - 2, hy - 2, 5, 4);
  sx.globalAlpha = 1;
  addLight(f.x, f.y, R * 1.8, col, 0.4 * fade);
};
// 十二の刻印の炸裂: 帯に沿って立つ赤い光の柱
BFX_DRAW.pillar = (f, fx, fy, u, bd) => {
  const { t, sx, gx } = bd;
  const k = 1 - u, c = Math.cos(f.a), s = Math.sin(f.a), n = Math.floor(f.len / 6);
  for (let i = 1; i <= n; i++) { const d = i * 6, x = Math.round(fx + c * d), y = Math.round(fy + s * d), H = Math.round((10 + 8 * Math.sin(i + t * 20)) * k); sx.globalAlpha = k; sx.fillStyle = i % 2 ? '#ff3b5c' : '#ffd0d8'; sx.fillRect(x - 1, y - H, 2, H); gx.fillStyle = '#5a1020'; gx.fillRect(x, y - H, 1, H); }
  sx.globalAlpha = 0.5 * k; pLine(sx, fx, fy, fx + c * f.len, fy + s * f.len, '#ff3b5c', Math.round(f.w)); sx.globalAlpha = 1;
  addLight(f.x + c * f.len / 2, f.y + s * f.len / 2, f.len, '#ff3b5c', 0.6 * k);
};
// 狂い時計の予告: 画面の縁が紫に揺れる
BFX_DRAW.madwarn = (f, fx, fy, u, bd) => {
  const { t, sx } = bd;
  const VW = GFX.VW, VH = GFX.VH;
  for (let i = 0; i < 4; i++) { const w = Math.round(4 + 4 * Math.abs(Math.sin(t * 30 + i))); sx.globalAlpha = 0.35; sx.fillStyle = '#8a4ae0'; if (i === 0) sx.fillRect(0, 0, VW, w); else if (i === 1) sx.fillRect(0, VH - w, VW, w); else if (i === 2) sx.fillRect(0, 0, w, VH); else sx.fillRect(VW - w, 0, w, VH); }
  sx.globalAlpha = 1;
};
// 消える残像: 縦に伸びて細くなりながら溶ける
BFX_DRAW.afterimg = (f, fx, fy, u, bd) => {
  const { sx } = bd;
  sx.globalAlpha = Math.max(0, 1 - u); drawSp(ART.S[f.spr], f.x, f.y, { flip: f.flip, sy: 1 + u * 0.5, sxk: Math.max(0.1, 1 - u * 0.8), white: u < 0.15 }); sx.globalAlpha = 1;
};
// 十二の刻印の回転斬り: 大鎌が一回転する三日月の斬撃(白い刃先・赤い軌跡・黒い縁)
BFX_DRAW.spincut = (f, fx, fy, u, bd) => {
  const { sx, gx } = bd;
  const k = 1 - Math.pow(1 - Math.min(1, u / 0.55), 3), head = f.a0 + f.dir * TAU * k;
  const tail = 2.6 * Math.min(1, k * 3) * (1 - Math.max(0, (u - 0.55) / 0.45)); // 軌跡の長さ(rad): 振り始めに伸び、振り切ったあと縮んで消える
  const n = Math.ceil(tail * f.r);
  for (let i = 0; i <= n; i++) {
    const s = i / Math.max(1, n), a = head - f.dir * tail * s, w = Math.max(1, Math.round((1 - s) * 7)); // 刃先ほど太い
    for (let j = 0; j < w; j++) {
      const rr = f.r - j + 1, x = Math.round(fx + Math.cos(a) * rr), y = Math.round(fy + Math.sin(a) * rr);
      sx.fillStyle = j === 0 && s < 0.5 ? '#000000' : s < 0.1 ? '#ffffff' : s < 0.45 ? '#ff3b5c' : '#8e0016';
      sx.globalAlpha = 1 - s * 0.6; sx.fillRect(x, y, 1, 1);
      if (j > 0 && s < 0.45) { gx.fillStyle = s < 0.1 ? '#ffffff' : '#5a000c'; gx.fillRect(x, y, 1, 1); }
    }
  }
  sx.globalAlpha = 1;
  const hx2 = f.x + Math.cos(head) * f.r, hy2 = f.y + Math.sin(head) * f.r;
  if (u < 0.55) drawRot('rscythe', head + f.dir * Math.PI / 2, hx2, hy2, { scale: 1.6 }); // 刃先の大鎌
  addLight(hx2, hy2, 50, '#ff3b5c', 0.9 * (1 - u)); addLight(f.x, f.y, f.r * 2.5, '#ff3b5c', 0.4 * (1 - u));
};
