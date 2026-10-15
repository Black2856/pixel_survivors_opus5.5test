// bosses/kraken.js — ボス: 大海魔クラーケン: 動かない固定砲台。触手の森(壊せる触手)/ 触手の叩きつけ / 墨 / 絡め取り / 潮の満ち引き / 水弾
'use strict';

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
  hint('forest', _t('触手の森'), _t('触手が 2本以上あると本体のダメージが半分。触手を壊せ'));
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
      fxRays(b.x + Math.cos(b.a) * LA, b.y + Math.sin(b.a) * LA, 34, '#1a4a7a', { foe: true, n: 9, life: 0.28, core: '#4ab8e8' }); // 叩きつけた水しぶきの光
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
    hint('ink', _t('墨'), _t('墨だまりの中ではスタミナが回復せず、触手の予告も見えない'));
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
      hint('grab', _t('絡め取り'), _t('1.5秒動けない。回避の無敵で抜けられる'));
    }
  });
}
// 潮の満ち引き: プレイヤーの位置に 円 半径 120(0.8秒)→ 2秒 中心へ毎秒 40 引く → 1秒 外へ毎秒 90 押す → 縁(半径 120〜135)に触手の輪 ×0.8
function tideStart(e, ai) {
  const tx = P.x, ty = P.y;
  pushWarn({ kind: 'circle', x: tx, y: ty, r: 120, t: 0, life: 0.8 });
  AudioMan.charge(0.8);
  later(ai, 0.8, () => { addHazard('tide', tx, ty, { r: 120, dur: 3.4, dmg: e.dmg }); AudioMan.splash(); hint('tide', _t('潮の満ち引き'), _t('引き寄せられたあと押し出される。最後に縁へ触手の輪')); });
}
