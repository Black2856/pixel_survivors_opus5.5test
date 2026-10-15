// bosses/cdragon.js — ボス: カオスドラゴン: 持続ファイアブレス / 一周ビーム / グランドクロス / 切り裂き / 渦(吸引)
'use strict';

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
    hint('beam', _t('全周ビーム!!'), _t('ダッシュの無敵ですり抜けろ'));
    windup(e, 1.3, () => { ai.act = 'beam'; ai.pt = 0; ai.T = ai.enraged ? 2 : 2.4; AudioMan.zap(); shockAt(e.x, e.y, 1, 1); fxRays(e.x, e.y - 4, 70, '#a01a4a', { foe: true, n: 16, life: 0.4, core: '#ff4a8a' }); });
  } else if (ai.raidCd <= 0) { // 空襲: 飛び上がり、画面を横切る影が燃える床を残していく
    ai.raidCd = ai.enraged ? 12 : 16;
    startRaid(e, ai);
  } else if (ai.gustCd <= 0) { // 翼の暴風: 前方の扇を押し出す
    ai.gustCd = ai.enraged ? 7 : 10;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a, r: 140, h: 1.047, t: 0, life: 0.7 });
    e.sq = 1.25; AudioMan.charge(0.7);
    hint('gust', _t('翼の暴風'), _t('押し出される(ダメージはない)。燃える床に注意'));
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
      bossBlast(tx, ty, 34 * CHAOS.area, BFX.cdragon); // 十字の交わる所の地面が裂ける
      burst(tx, ty, 30, ['#ff4a8a', '#ffd0f0', '#ffffff'], { sp: 140, glow: true });
    };
    mark(0); later(ai, T, () => blast(0));
    if (ai.enraged) { later(ai, 0.5, () => mark(Math.PI / 4)); later(ai, 0.5 + T, () => blast(Math.PI / 4)); }
    AudioMan.charge(T);
    endAct();
  }
}
