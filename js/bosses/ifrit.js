// bosses/ifrit.js — ボス: 炎魔イフリート: 炎の踏み込み → 炎の鞭(攻めの中心)/ 炎の壁(越えられない)→ 炎の突進 / 灼熱の鎖(引き寄せ → 鞭)/ 爆炎(押し出し)/ 激昂: 炎の祭壇・姿が変わる・踏み込みが 2連続
'use strict';

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
      bossBlast(e.x, e.y, R0 * 0.8, Object.assign({ n: 18 }, BFX.ifrit)); // 焼け焦げた地面と燻る火の粉
      if (hitCircle(e.x, e.y, 80, d)) burnPlayer(d * 0.03); // 爆炎: 半径 80 に ×1.0・炎上
      if (inside) pushPlayer(Math.atan2(P.y - e.y, P.x - e.x), 100, 0.35);
      burst(e.x, e.y, 60, ['#ff6a2a', '#ffc34a', '#fff0b0', '#ff3b1a'], { sp: 200, glow: true, life: 0.6 });
      addRing(e.x, e.y, R0, '#ffc34a', { w: 3, life: 0.4 }); addRing(e.x, e.y, R0 * 1.3, '#ff6a2a', { w: 2, life: 0.55 }); addFlash(e.x, e.y, R0 * 3, '#ff8a3d', 1);
      shockAt(e.x, e.y, 2.2, 0.7); shake(11); hitstop(0.05); AudioMan.boom(); AudioMan.fire(); e.sq = 0.7;
      hint('blast', _t('爆炎'), _t('吹き飛ばされる。燃える床・炎の壁へ押し込まれないように'));
      heatedRocks(e, ai.enraged ? 6 : 4);
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
        hint('fchain', _t('灼熱の鎖'), _t('引き寄せられたあとに炎の鞭が来る。回避で鎖を切れる'));
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
  hint('lunge', _t('炎の踏み込み'), _t('離れていても踏み込んでくる。着いたらすぐ炎の鞭'));
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
  hint('fwall', _t('炎の壁'), _t('壁の上は燃える。壁の間を炎の突進が走る'));
  windup(e, 0.9, () => {
    for (const w of walls) addHazard('fwall', w.x, w.y, { a, len: L, w: W, dur: 7, dmg: e.dmg, owner2: e, tick: 0 });
    AudioMan.boom(); AudioMan.fire(); shake(8);
    for (const w of walls) for (let d = 0; d < L; d += 10) burst(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, 2, ['#ff6a2a', '#ffc34a', '#fff0b0'], { sp: 50, up: 60, glow: true, life: 0.5 });
    for (const w of walls) for (let d = 20; d < L; d += 40) fxBeam(w.x + Math.cos(a) * d, w.y + Math.sin(a) * d, { foe: true, up: true, t: -d / 1600, w: 2.5, H: 34, col: '#ff6a2a', mid: '#ffc34a', core: '#fff0b0', wob: 1.2, life: 0.5, drop: 0.12 }); // 壁に沿って順に炎の柱が噴き上がる
    ai.act = 'wallwait'; ai.pt = 1;
  });
}
// 爆炎の熱された岩: 爆発と同時に n 個がランダムな方向へ飛ぶ(イフリートから 60〜150、0.9秒。着弾点に 円 半径 30 の予告)
//   → 着弾点にマグマ溜まり(半径 30・6秒。上にいると炎上。燃える床と同じ)
function heatedRocks(e, n) {
  const a0 = rand(0, TAU), d = e.dmg * e.altK;
  for (let i = 0; i < n; i++) {
    const a = a0 + TAU / n * i + rand(-0.35, 0.35), r = rand(60, 150), tx = e.x + Math.cos(a) * r, ty = e.y + Math.sin(a) * r;
    pushWarn({ kind: 'circle', x: tx, y: ty, r: 30, t: 0, life: 0.9 });
    lob('hrock', e.x, e.y - 10, tx, ty, 0.9, 60, p => {
      addHazard('magma', p.x, p.y, { r: 30, dur: 6, dmg: d });
      burst(p.x, p.y, 18, ['#2a1410', '#ff6a2a', '#ffc34a', '#fff0b0'], { sp: 90, up: 30, g: 200, glow: true, life: 0.5 }); shake(2); AudioMan.thud();
    });
  }
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
  UI.announce(_t('炎の祭壇'), _t('燃えている祭壇 1つにつき、イフリートの与ダメージ +10%・技が速くなる。壊せる'));
}
