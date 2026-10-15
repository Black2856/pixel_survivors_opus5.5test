// bosses/king.js — ボス: 腐肉の王: 突進 / 腐肉の山(壊せる物)/ 王の咆哮(押し出し → 突進)/ 死者の手(足元を追う印)/ 腐肉の噛みつき(出血)/ 激昂: 叩きつけ
'use strict';

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
      bossBlast(e.x, e.y, R0 * 0.7, Object.assign({ n: 16, decal: 'scorch' }, BFX.king)); // 腐った息で焼けた地面
      hint('roar', _t('王の咆哮'), _t('押し出される。回避の無敵なら押されない'));
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
        hint('meat', _t('腐肉の山'), _t('ゾンビが湧き続ける。壊すと止まる'));
      });
    });
  } else if (ai.bite <= 0 && dist < 50) { // 腐肉の噛みつき: 前方の扇。当たると出血
    ai.bite = ai.enraged ? 4 : 6;
    const ba = a;
    pushWarn({ kind: 'fan', x: e.x, y: e.y, a: ba, r: 45, h: 0.873, t: 0, life: 0.4 });
    windup(e, 0.4, () => {
      const R0 = 45 * CHAOS.area;
      for (const f of [0, 1]) slashes.push({ x: e.x, y: e.y, a: ba, r: R0, t: 0, life: 0.22, flip: f, span: 1.75, pal: SWING_PAL.enemy, enemy: true }); // 上下から閉じる顎
      if (hitFan(e.x, e.y, ba, 45, 0.873, e.dmg * 0.9)) { bleedPlayer(2); hint('bite', _t('腐肉の噛みつき'), _t('出血: 5秒受けなければ消える')); }
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
      bossBlast(e.x, e.y, 70 * CHAOS.area, BFX.king); // 叩き割った地面
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
  hint('hands', _t('死者の手'), _t('足元の印が追ってくる。止まると地面から手が出る'));
  later(ai, 1.5, () => {
    hitCircle(w.x, w.y, 18, e.dmg * 0.8);
    bfx.push({ kind: 'hands', x: w.x, y: w.y, r: 18 * CHAOS.area, t: 0, life: 0.7, seed: (Math.random() * 1e6) | 0 });
    fxDecal(w.x, w.y + 2, 18 * CHAOS.area, 'crack', { foe: true, n: 5, col: '#1a120a', hot: '#7fae4e', heatT: 0.5, life: 2.5 }); // 手が突き出た地面のひび
    burst(w.x, w.y, 22, ['#5a4030', '#3a2a1a', '#e8e0c0', '#7fae4e'], { sp: 90, g: 220 });
    shockAt(w.x, w.y, 0.8, 0.9); shake(4); AudioMan.thud();
  });
}
